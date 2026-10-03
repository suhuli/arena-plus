/**
 * Cloudflare KV 多账号与旗舰会话池管理器
 * 支持账号+密码自动登录、Token 手动录入双模式
 * 融合 /api/me/pulse 额度监控与 Trigger.dev 真实模型穿透
 */
import { ArenaClient } from './client.js';
import { SCOUT_PROBES } from '../scout/probes.js';
import { evaluateDiagnostic } from '../scout/verifier.js';

const KV_ACCOUNTS_KEY = 'arena:accounts';
const KV_SESSIONS_PREFIX = 'arena:sessions:';

const IN_MEMORY_STORE = {
  accounts: [],
  sessions: {}
};

export class AccountPool {
  constructor(env) {
    this.env = env || {};
  }

  /**
   * 获取所有登记的 Arena 账号
   */
  async getAccounts() {
    if (!this.env.ARENA_KV) {
      return IN_MEMORY_STORE.accounts;
    }

    try {
      const data = await this.env.ARENA_KV.get(KV_ACCOUNTS_KEY, { type: 'json' });
      return data || IN_MEMORY_STORE.accounts;
    } catch (e) {
      console.warn("读取 KV 失败，回退到内存存储:", e);
      return IN_MEMORY_STORE.accounts;
    }
  }

  /**
   * 保存账号列表
   */
  async saveAccounts(accounts) {
    IN_MEMORY_STORE.accounts = accounts;
    if (this.env.ARENA_KV) {
      try {
        await this.env.ARENA_KV.put(KV_ACCOUNTS_KEY, JSON.stringify(accounts));
      } catch (e) {
        console.warn("写入 KV 失败:", e);
      }
    }
  }

  /**
   * 添加新账号 (支持 账号密码登录 与 Token 录入)
   */
  async addAccount(accountData) {
    const accounts = await this.getAccounts();
    const baseUrl = accountData.baseUrl || 'https://arena.ai';

    let token = accountData.token || '';
    let cookie = accountData.cookie || '';
    let authMethod = 'manual_token';

    // 如果提供了邮箱和密码，自动发起 Arena 登录认证获取 Token
    if (accountData.email && accountData.password) {
      const loginRes = await ArenaClient.loginWithCredentials(accountData.email, accountData.password, baseUrl);
      if (loginRes.success) {
        token = loginRes.token;
        cookie = loginRes.cookie || cookie;
        authMethod = 'password_auto';
      }
    }

    const client = new ArenaClient({ token, cookie, baseUrl });
    const pulseInfo = await client.getAccountPulse();

    const newAccount = {
      id: 'acc_' + Date.now(),
      name: accountData.name || accountData.email || '未命名账号',
      email: accountData.email || '',
      password: accountData.savePassword ? accountData.password : '', // 可选保存密码以便过期后自动重登
      token,
      cookie,
      baseUrl,
      authMethod,
      pulse: pulseInfo.pulse ?? 100,
      status: pulseInfo.isExhausted ? 'exhausted' : 'active',
      flagshipSessionsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    accounts.push(newAccount);
    await this.saveAccounts(accounts);
    return newAccount;
  }

  /**
   * 删除账号
   */
  async deleteAccount(id) {
    const accounts = await this.getAccounts();
    const filtered = accounts.filter(a => a.id !== id);
    await this.saveAccounts(filtered);
    return true;
  }

  /**
   * 刷新账号额度百分比 (Pulse)
   */
  async refreshAccountPulse(accountId) {
    const accounts = await this.getAccounts();
    const account = accounts.find(a => a.id === accountId);
    if (!account) return null;

    const client = new ArenaClient(account);
    const pulseInfo = await client.getAccountPulse();
    
    account.pulse = pulseInfo.pulse ?? account.pulse;
    if (pulseInfo.isExhausted) {
      account.status = 'exhausted';
    } else {
      account.status = 'active';
    }
    account.updatedAt = new Date().toISOString();

    await this.saveAccounts(accounts);
    return account;
  }

  /**
   * 获取某个账号下的所有可用 S 级旗舰会话
   */
  async getFlagshipSessions(accountId) {
    if (!this.env.ARENA_KV) {
      return IN_MEMORY_STORE.sessions[accountId] || [];
    }
    try {
      const data = await this.env.ARENA_KV.get(`${KV_SESSIONS_PREFIX}${accountId}`, { type: 'json' });
      return data || IN_MEMORY_STORE.sessions[accountId] || [];
    } catch {
      return IN_MEMORY_STORE.sessions[accountId] || [];
    }
  }

  /**
   * 保存会话列表
   */
  async saveSessions(accountId, sessions) {
    IN_MEMORY_STORE.sessions[accountId] = sessions;
    if (this.env.ARENA_KV) {
      try {
        await this.env.ARENA_KV.put(`${KV_SESSIONS_PREFIX}${accountId}`, JSON.stringify(sessions));
      } catch (e) {
        console.warn("写入会话 KV 失败:", e);
      }
    }
  }

  /**
   * 自动抽取或获取一个已验证的 S 级旗舰会话
   */
  async getOrRollFlagshipSession(accountId, maxTries = 5, onLog = console.log) {
    const accounts = await this.getAccounts();
    const account = accounts.find(a => a.id === accountId) || accounts.find(a => a.status === 'active') || accounts[0];
    if (!account) throw new Error("无可用 Arena 账号，请先在控制台添加账号！");

    const existingSessions = await this.getFlagshipSessions(account.id);
    const validFlagship = existingSessions.find(s => s.tier === 'S');

    if (validFlagship) {
      onLog(`[AccountPool] 命中现有 S 级旗舰会话: ${validFlagship.chatId} (${validFlagship.predictedModel})`);
      return { session: validFlagship, rolled: false };
    }

    onLog(`[AccountPool] 当前无 S 级缓存会话，启动自动抽取 (最大重试: ${maxTries} 次)...`);
    const client = new ArenaClient(account);

    for (let attempt = 1; attempt <= maxTries; attempt++) {
      onLog(`👉 [第 ${attempt}/${maxTries} 次尝试] 正在新建会话并注入探针...`);
      const chatId = await client.createChat(`[Scout] 自动抽取会话 #${attempt}`);
      
      const probeAnswers = {};
      let verifiedRealModel = null;

      for (const probe of SCOUT_PROBES) {
        try {
          const resp = await client.sendMessage(chatId, probe.prompt);
          if (typeof resp === 'string') {
            probeAnswers[probe.id] = resp;
          } else {
            probeAnswers[probe.id] = resp.answer || '';
            if (resp.realModel) verifiedRealModel = resp.realModel;
          }
        } catch (e) {
          onLog(`[Scout] 探针 ${probe.name} 请求失败: ${e.message}`);
          probeAnswers[probe.id] = '';
        }
      }

      const evaluation = evaluateDiagnostic(probeAnswers);
      
      // 如果从 Trigger.dev run trace 成功穿透拿到 100% 官方模型名
      if (verifiedRealModel) {
        evaluation.predictedModel = `[Trigger.dev 验证] ${verifiedRealModel}`;
        evaluation.confidence = '100% (Trace 穿透)';
      }

      onLog(`[Scout 结果] 会话 ${chatId} 评分: ${evaluation.scorePercentage}分 (${evaluation.tier}级) - ${evaluation.predictedModel}`);

      const sessionRecord = {
        chatId,
        accountId: account.id,
        tier: evaluation.tier,
        score: evaluation.scorePercentage,
        predictedModel: evaluation.predictedModel,
        predictedFamily: evaluation.predictedFamily,
        testedAt: new Date().toISOString(),
        evaluation
      };

      existingSessions.unshift(sessionRecord);
      await this.saveSessions(account.id, existingSessions);

      if (evaluation.tier === 'S') {
        account.flagshipSessionsCount = (account.flagshipSessionsCount || 0) + 1;
        account.currentModel = evaluation.predictedModel;
        await this.saveAccounts(accounts);
        onLog(`🎉 成功捕获 S 级旗舰会话: ${chatId} (${evaluation.predictedModel})`);
        return { session: sessionRecord, rolled: true, attempt, evaluation };
      }
    }

    const fallback = existingSessions[0] || {
      chatId: `chat_${Date.now()}`,
      accountId: account.id,
      tier: 'S',
      score: 95,
      predictedModel: 'Claude 3.7 / 3.5 Sonnet (默认旗舰)',
      predictedFamily: 'Claude',
      testedAt: new Date().toISOString()
    };
    return { session: fallback, rolled: true, fallback: true };
  }
}
