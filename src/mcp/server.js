/**
 * MCP (Model Context Protocol) 协议实现
 * 支持 Remote SSE 传输，专为 Cursor / Claude Desktop / Cline 设计
 */
import { AccountPool } from '../arena/account-pool.js';
import { ArenaClient } from '../arena/client.js';
import { SCOUT_PROBES } from '../scout/probes.js';
import { evaluateDiagnostic } from '../scout/verifier.js';

export const MCP_TOOLS = [
  {
    name: 'arena_ask',
    description: '向 Arena.ai 提问并获取高智能回答。默认自动路由到经过探针验证的 S 级顶级旗舰模型（如 Claude 3.7 / GPT 顶阶），杜绝轻量与降智。',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: '发送给模型的具体问题、代码编写或重构任务要求'
        },
        require_flagship: {
          type: 'boolean',
          description: '是否必须要求 S 级旗舰模型（若为 true 且当前无旗舰会话，会自动在后台重新抽取直到抽中 S 级）',
          default: true
        },
        account_id: {
          type: 'string',
          description: '可选：指定使用的 Arena 账号 ID，留空则自动轮询'
        }
      },
      required: ['prompt']
    }
  },
  {
    name: 'arena_reroll_flagship',
    description: '为当前 Arena.ai 账号强制开启全新会话，并连续运行 4 道高特异性探针，直到捕获一个 S 级顶级旗舰模型（SOTA）会话并返回鉴定报告。',
    inputSchema: {
      type: 'object',
      properties: {
        max_tries: {
          type: 'number',
          description: '最大重试轮数 (默认 5 轮)',
          default: 5
        },
        account_id: {
          type: 'string',
          description: '可选：指定 Arena 账号 ID'
        }
      }
    }
  },
  {
    name: 'arena_inspect_model',
    description: '对指定的 Arena 会话运行能力探针（包含严格禁词约束、无工具字符计数、三段论逻辑、2026 前沿知识感知），输出诊断报告与模型家族归因。',
    inputSchema: {
      type: 'object',
      properties: {
        chat_id: {
          type: 'string',
          description: '待检测的 Arena 会话 ID'
        },
        account_id: {
          type: 'string',
          description: '可选：Arena 账号 ID'
        }
      }
    }
  },
  {
    name: 'arena_list_accounts',
    description: '列出当前 Cloudflare Worker 账号池中所有 Arena.ai 账号的状态、S 级会话数量与当前归因模型。',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

export class MCPServer {
  constructor(env) {
    this.env = env;
    this.accountPool = new AccountPool(env);
  }

  /**
   * 处理 MCP JSON-RPC 2.0 请求
   */
  async handleJsonRpc(requestJson) {
    const { id, method, params } = requestJson;

    // 1. 初始化握手
    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: true }
          },
          serverInfo: {
            name: 'arena-plus-mcp',
            version: '1.2.0'
          }
        }
      };
    }

    if (method === 'notifications/initialized') {
      return null; // 不需要响应
    }

    // 2. 列出可用工具
    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOLS
        }
      };
    }

    // 3. 执行工具调用
    if (method === 'tools/call') {
      const toolName = params?.name;
      const args = params?.arguments || {};

      try {
        const toolResult = await this.executeTool(toolName, args);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2)
              }
            ]
          }
        };
      } catch (err) {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            isError: true,
            content: [{ type: 'text', text: `[MCP Tool Error] ${err.message}` }]
          }
        };
      }
    }

    // 未知方法
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`
      }
    };
  }

  /**
   * 具体工具调度与执行
   */
  async executeTool(name, args) {
    const accounts = await this.accountPool.getAccounts();
    if (accounts.length === 0) {
      throw new Error("请先在 Cloudflare Workers 控制台 (/dashboard) 录入至少一个 Arena.ai 账号！");
    }

    const selectedAccount = args.account_id 
      ? accounts.find(a => a.id === args.account_id) || accounts[0]
      : accounts[0];

    // Tool: arena_ask
    if (name === 'arena_ask') {
      const { prompt, require_flagship = true } = args;
      const client = new ArenaClient(selectedAccount);

      let targetSession;
      if (require_flagship) {
        const rollResult = await this.accountPool.getOrRollFlagshipSession(selectedAccount.id, 5);
        targetSession = rollResult.session;
      } else {
        const chatId = await client.createChat("Arena-Plus Chat");
        targetSession = { chatId };
      }

      const response = await client.sendMessage(targetSession.chatId, prompt);
      return response;
    }

    // Tool: arena_reroll_flagship
    if (name === 'arena_reroll_flagship') {
      const maxTries = args.max_tries || 5;
      const rollResult = await this.accountPool.getOrRollFlagshipSession(selectedAccount.id, maxTries);
      return {
        success: true,
        session: rollResult.session,
        evaluation: rollResult.evaluation || rollResult.session.evaluation,
        message: `成功捕获 ${rollResult.session.tier} 级会话: ${rollResult.session.predictedModel}`
      };
    }

    // Tool: arena_inspect_model
    if (name === 'arena_inspect_model') {
      const client = new ArenaClient(selectedAccount);
      const chatId = args.chat_id || (await client.createChat("[Inspect] 会话能力诊断"));

      const probeAnswers = {};
      for (const probe of SCOUT_PROBES) {
        try {
          probeAnswers[probe.id] = await client.sendMessage(chatId, probe.prompt);
        } catch (e) {
          probeAnswers[probe.id] = '';
        }
      }

      const evaluation = evaluateDiagnostic(probeAnswers);
      return evaluation;
    }

    // Tool: arena_list_accounts
    if (name === 'arena_list_accounts') {
      return accounts.map(a => ({
        id: a.id,
        name: a.name,
        email: a.email,
        status: a.status,
        flagshipSessionsCount: a.flagshipSessionsCount || 0,
        currentModel: a.currentModel || '待测试'
      }));
    }

    throw new Error(`Unsupported tool: ${name}`);
  }
}
