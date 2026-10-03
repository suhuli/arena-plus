/**
 * Cloudflare KV 多账号与旗舰会话池管理器
 */
import { ArenaClient } from './client.js';
import { SCOUT_PROBES } from '../scout/probes.js';
import { evaluateDiagnostic } from '../scout/verifier.js';

const KV_ACCOUNTS_KEY = 'arena:accounts';
const KV_SESSIONS_PREFIX = 'arena:sessions:';

export class AccountPool {
  constructor(env) {
    this.env = env;
  }

  /**
   * 获取所有登记的 Arena 账号
   */
  async getAccounts() {
    if (!this.env.ARENA_KV) {
      // 本地无 KV 模拟数据
      return [
        {
          id: 'acc_default_1',
          name: 'Arena-主力号 (Google)',
          email: 'main.developer@gmail.com',
          token: 'arena_token_mock_1',
          status: 'active',
          flagshipSessionsCount: 2,
          lastTestedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          currentModel: 'Claude 3.7 / 3.5 Sonnet (高阶旗舰)'
        }
      ];
    }

    try {
      const data = await this.env.ARENA_KV.get(KV_ACCOUNTS_KEY, { type: 'json' });
      return data || [];
    } catch {
      return [];
    }
  }

  /**
   * 保存账号列表
   */
  async saveAccounts(accounts) {
    if (this.env.ARENA_KV) {
      await this.env.ARENA_KV.put(KV_ACCOUNTS_KEY, JSON.stringify(accounts));
    }
  }

  /**
   * 添加新账号
   */
  async addAccount(accountData) {
    const accounts = await this.getAccounts();
    const newAccount = {
      id: 'acc_' + Date.now(),
      name: accountData.name || '未命名账号',
      email: accountData.email || '',
      token: accountData.token || '',
      cookie: accountData.cookie || '',
      baseUrl: accountData.baseUrl || 'https://arena.ai',
      status: 'active',
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
   * 获取某个账号下的所有可用 S 级旗舰会话
   */
  async getFlagshipSessions(accountId) {
    if (!this.env.ARENA_KV) return [];
    try {
      const data = await this.env.ARENA_KV.get(`${KV_SESSIONS_PREFIX}${accountId}`, { type: 'json' });
      return data || [];
    } catch {
      return [];
    }
  }

  /**
   * 保存会话列表
   */
  async saveSessions(accountId, sessions) {
    if (this.env.ARENA_KV) {
      await this.env.ARENA_KV.put(`${KV_SESSIONS_PREFIX}${accountId}`, JSON.stringify(sessions));
    }
  }

  /**
   * 自动抽取或获取一个已验证的 S 级旗舰会话
   * 如果当前无可用 S 级会话，自动启动跑测抽取流程
   */
  async getOrRollFlagshipSession(accountId, maxTries = 5, onLog = console.log) {
    const accounts = await this.getAccounts();
    const account = accounts.find(a => a.id === accountId) || accounts[0];
    if (!account) throw new Error("无可用 Arena 账号，请先在控制台添加账号！");

    const existingSessions = await this.getFlagshipSessions(account.id);
    const validFlagship = existingSessions.find(s => s.tier === 'S');

    if (validFlagship) {
      onLog(`[AccountPool] 命中现有 S 级旗舰会话: ${validFlagship.chatId} (${validFlagship.predictedModel})`);
      return { session: validFlagship, rolled: false };
    }

    // 启动自动抽取流程
    onLog(`[AccountPool] 当前无 S 级缓存会话，启动自动抽取 (最大重试: ${maxTries} 次)...`);
    const client = new ArenaClient(account);

    for (let attempt = 1; attempt <= maxTries; attempt++) {
      onLog(`👉 [第 ${attempt}/${maxTries} 次尝试] 正在新建会话并注入探针...`);
      const chatId = await client.createChat(`[Scout] 自动抽取会话 #${attempt}`);
      
      const probeAnswers = {};
      for (const probe of SCOUT_PROBES) {
        try {
          const ans = await client.sendMessage(chatId, probe.prompt);
          probeAnswers[probe.id] = ans;
        } catch (e) {
          onLog(`[Scout] 探针 ${probe.name} 请求失败: ${e.message}`);
          probeAnswers[probe.id] = '';
        }
      }

      const evaluation = evaluateDiagnostic(probeAnswers);
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
        onLog(`🎉 成功捕获 S 级旗舰会话: ${chatId} (${evaluation.predictedModel})`);
        return { session: sessionRecord, rolled: true, attempt, evaluation };
      }
    }

    // 如果未抽中 S 级，退回使用最近的一个会话
    const fallback = existingSessions[0];
    return { session: fallback, rolled: true, fallback: true };
  }
}
