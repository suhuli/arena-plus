/**
 * Arena.ai API 客户端
 * 负责与 Arena.ai 官方或反代接口进行通信：创建会话、发送探针、接收回答
 */

export class ArenaClient {
  constructor(account) {
    this.account = account;
    this.token = account.token || '';
    this.baseUrl = (account.baseUrl || 'https://arena.ai').replace(/\/+$/, '');
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/event-stream, */*',
      'Content-Type': 'application/json',
      'Authorization': this.token.startsWith('Bearer ') ? this.token : `Bearer ${this.token}`,
      'Cookie': account.cookie || (this.token ? `session_token=${this.token}` : '')
    };
  }

  /**
   * 创建一个全新的会话
   */
  async createChat(title = 'Arena-Plus Session') {
    // 兼容 Arena REST API 与标准 Web 会话创建
    const endpoint = `${this.baseUrl}/api/chat/new`;
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ title, mode: 'agent' })
      });

      if (resp.ok) {
        const data = await resp.json();
        return data.id || data.chat_id || data.sessionId || `chat_${Date.now()}`;
      }
    } catch (e) {
      console.warn("REST createChat 异常，采用通用会话 ID 生成", e);
    }
    // 回退到基于时间的独立会话 ID
    return `chat_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * 发送消息并获取完整模型回答 (支持流式 SSE 解析与普通 JSON)
   */
  async sendMessage(chatId, promptText) {
    const endpoint = `${this.baseUrl}/api/chat/completions`;
    
    const payload = {
      chat_id: chatId,
      messages: [{ role: 'user', content: promptText }],
      stream: false
    };

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Arena API 响应失败 (${resp.status}): ${errText.slice(0, 200)}`);
      }

      const contentType = resp.headers.get('content-type') || '';
      
      if (contentType.includes('text/event-stream')) {
        // 解析 SSE 流
        const text = await resp.text();
        return this.parseSSEStream(text);
      } else {
        const data = await resp.json();
        return data.choices?.[0]?.message?.content || data.response || data.text || JSON.stringify(data);
      }
    } catch (err) {
      // 如果是模拟或离线环境，返回可调试的探针应答
      throw err;
    }
  }

  /**
   * 解析 SSE 数据流并拼接出完整文本
   */
  parseSSEStream(sseText) {
    const lines = sseText.split('\n');
    let result = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data:')) {
        const jsonStr = trimmed.slice(5).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta?.content || parsed.text || '';
          result += delta;
        } catch {
          // 纯文本 delta
          result += jsonStr;
        }
      }
    }

    return result.trim();
  }
}
