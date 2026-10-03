/**
 * Arena Plus - Cloudflare Workers 边缘主入口
 * 包含 Web 可视化控制台、Remote MCP (SSE Transport) 与多账号管理
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { MCPServer } from './mcp/server.js';
import { AccountPool } from './arena/account-pool.js';
import { renderDashboardHtml } from './views/dashboard.js';

const app = new Hono();

// 启用全局 CORS 跨域支持 (为 Cursor / IDE MCP 连接提供保障)
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-MCP-Session-Id']
}));

// 1. 首页与可视化控制台重定向
app.get('/', (c) => c.redirect('/dashboard'));

app.get('/dashboard', (c) => {
  const url = new URL(c.req.url);
  const authKey = c.env?.MCP_AUTH_KEY || 'arena-plus-secret-key';
  const html = renderDashboardHtml(url.origin, authKey);
  return c.html(html);
});

// 2. Remote MCP 协议端点: SSE 通道 (Server-Sent Events)
app.get('/sse', async (c) => {
  const url = new URL(c.req.url);
  const providedKey = url.searchParams.get('key');
  const expectedKey = c.env?.MCP_AUTH_KEY || 'arena-plus-secret-key';

  // 安全密钥校验 (可选保护)
  if (expectedKey && providedKey && providedKey !== expectedKey) {
    return c.text('Unauthorized: Invalid MCP Auth Key', 401);
  }

  const sessionId = 'mcp_' + Date.now() + '_' + Math.random().toString(36).substring(7);
  const postEndpoint = `/message?sessionId=${sessionId}`;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      
      // 发送 MCP 标准 endpoint 事件告知客户端 POST 目标
      const endpointEvent = `event: endpoint\ndata: ${postEndpoint}\n\n`;
      controller.enqueue(encoder.encode(endpointEvent));

      // 维持心跳 Ping
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`));
        } catch {
          clearInterval(interval);
        }
      }, 25000);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    }
  });
});

// 3. Remote MCP JSON-RPC 消息接收端点
app.post('/message', async (c) => {
  try {
    const jsonBody = await c.req.json();
    const server = new MCPServer(c.env);
    const response = await server.handleJsonRpc(jsonBody);

    if (response === null) {
      return c.json({ jsonrpc: '2.0', result: {} });
    }

    return c.json(response);
  } catch (err) {
    return c.json({
      jsonrpc: '2.0',
      error: { code: -32603, message: `Internal error: ${err.message}` }
    }, 500);
  }
});

// 4. REST API: 账号管理
app.get('/api/accounts', async (c) => {
  const pool = new AccountPool(c.env);
  const accounts = await pool.getAccounts();
  return c.json(accounts);
});

app.post('/api/accounts', async (c) => {
  const body = await c.req.json();
  const pool = new AccountPool(c.env);
  const newAccount = await pool.addAccount(body);
  return c.json(newAccount);
});

app.delete('/api/accounts/:id', async (c) => {
  const id = c.req.param('id');
  const pool = new AccountPool(c.env);
  await pool.deleteAccount(id);
  return c.json({ success: true });
});

// 5. REST API: 自动抽取 S 级旗舰会话
app.post('/api/sessions/reroll', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const accountId = body.account_id;
  const maxTries = body.max_tries || 5;

  const pool = new AccountPool(c.env);
  const result = await pool.getOrRollFlagshipSession(accountId, maxTries);
  return c.json({
    success: true,
    session: result.session,
    evaluation: result.evaluation,
    message: `成功捕获 ${result.session.tier} 级会话 (${result.session.predictedModel})`
  });
});

export default app;
