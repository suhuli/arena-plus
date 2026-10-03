# ⚡ Arena Plus (Cloudflare Workers + MCP Server)

[🇨🇳 中文文档](./README_CN.md) | [🇺🇸 English](./README.md)

> **Arena.ai 多账号管理、S 级顶尖旗舰模型 Scout 保底与 Remote MCP 边缘服务**  
> 运行在 Cloudflare Workers 全球边缘网络，0 服务器成本，直连 Cursor / Claude Desktop / Cline。

---

## 🌟 核心特性

- 🌐 **运行在 Cloudflare Workers 边缘端**：24/7 全天候运行，无需本地常驻软件，利用 Cloudflare 免费额度实现零成本托管。
- 🔑 **支持【邮箱+密码直接登录】与【Token 录入】双模式**：支持直接输入 Arena 账号与密码，Worker 边缘端自动完成登录并提取鉴权 Session；勾选自动续期后，Token 过期时后台自动无感重登，告别手动抓包。
- 👑 **S 级旗舰模型自动抽取与保底（Flagship Gating）**：
  - 融合 **`ccfingerprint` 确定性分级能力题库**（球拍思维陷阱、混合算术、严格第4词提取、干扰文本藏针、日期推导）与 **`LLM-Fingerprinter` 风格负向约束**；
  - **如果会话出现降智或轻量模型，后台自动重新抽取（Re-roll），直到捕获 90~100 分的 S 级顶级旗舰模型（如 Claude 3.7 / GPT 顶阶）才返回给 IDE！**
- 🔌 **标准 Remote MCP 协议（Server-Sent Events）**：
  - 一键挂载到 **Cursor (`~/.cursor/mcp.json`)**、**Claude Desktop (`claude_desktop_config.json`)** 和 **Cline / Windsurf**；
  - 暴露 `arena_ask`、`arena_reroll_flagship`、`arena_inspect_model` 等全功能工具。
- 👥 **多账号管理与负载轮询**：
  - 基于 Cloudflare KV (`ARENA_KV`) 隔离存储多个 Arena 账号的 Session Token；
  - 多号自动轮询与健康检查，避免单个账号触发速率限制。
- 📊 **内嵌单文件可视化控制台 (`/dashboard`)**：
  - 现代化暗色主题 UI（TailwindCSS + Vue 3），管理账号、监控 S 级会话池、在线跑测探针沙箱、一键复制 IDE 配置。

---

## 🚀 快速部署到 Cloudflare Workers

### 1. 前置准备
- 安装 [Node.js](https://nodejs.org/) (>= 18)
- 拥有一个 [Cloudflare](https://dash.cloudflare.com/) 免费账号

### 2. 克隆仓库与安装依赖
```bash
git clone https://github.com/suhuli/arena-plus.git
cd arena-plus
npm install
```

### 3. 创建 Cloudflare KV 命名空间
```bash
# 登录 Cloudflare
npx wrangler login

# 创建生产环境 KV 命名空间
npx wrangler kv:namespace create ARENA_KV

# 创建预览/测试环境 KV 命名空间
npx wrangler kv:namespace create ARENA_KV --preview
```

将终端输出中的 `id` 和 `preview_id` 填入 `wrangler.toml` 文件：
```toml
[[kv_namespaces]]
binding = "ARENA_KV"
id = "你的_KV_ID"
preview_id = "你的_PREVIEW_KV_ID"
```

### 4. 部署上线
```bash
npm run deploy
```
部署成功后，你将获得一个 Worker 域名，例如：`https://arena-plus.your-subdomain.workers.dev`。

---

## 🖥️ Web 可视化控制台使用指南

1. 打开浏览器访问：`https://arena-plus.your-subdomain.workers.dev/dashboard`
2. 点击 **【+ 录入新 Arena 账号】**，粘贴你从 Arena.ai 登录后获取的 `session_token` 或 Bearer 令牌；
3. 点击 **【⚡ 自动洗号 (抽 S 级)】**，系统将在后台自动为该账号新建会话并执行 4 道探针，直到捕获 S 级旗舰会话；
4. 切换到 **【🔌 MCP 接入配置】** 选项卡，一键复制 IDE 配置。

---

## 🔌 接入 IDE 配置指南

### 1. Cursor IDE 配置 (`~/.cursor/mcp.json`)
在 Cursor 的 `Settings -> Features -> MCP` 中添加：
```json
{
  "mcpServers": {
    "arena-plus": {
      "url": "https://arena-plus.your-subdomain.workers.dev/sse?key=arena-plus-secret-key"
    }
  }
}
```

### 2. Claude Desktop 配置 (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "arena-plus": {
      "url": "https://arena-plus.your-subdomain.workers.dev/sse?key=arena-plus-secret-key"
    }
  }
}
```

---

## 🛠️ MCP 工具列表 (Tools)

| 工具名称 | 参数 | 说明 |
| :--- | :--- | :--- |
| **`arena_ask`** | `prompt` (必填), `require_flagship` (默认 true) | **核心主力工具**。提问并自动使用 S 级旗舰会话（若无旗舰则自动在后台抽取后作答）。 |
| **`arena_reroll_flagship`** | `max_tries` (默认 5), `account_id` (选填) | 强制开启全新会话并连续做题跑测，直到抽中 S 级旗舰模型并返回鉴定报告。 |
| **`arena_inspect_model`** | `chat_id` (选填), `account_id` (选填) | 对指定会话运行 4 道高特异性探针，输出 4 维能力雷达评分与模型归因。 |
| **`arena_list_accounts`** | 无 | 查看当前 Worker 中所有账号与 S 级会话池健康状态。 |

---

## 🔍 Scout 探针与打分体系

| 探针类别 | 考察维度 | 满分标准 | 判定指向 |
| :--- | :--- | :--- | :--- |
| **Probe 1: 双重负向约束** | 指令遵循与克制力 | 严格 3 句话解释递归，且绝对不含 `function` 和 `itself` | 旗舰模型 100% 遵守；弱模型直接违规 |
| **Probe 2: 原生空间注意力** | Tokenizer 字符精确定位 | 无工具统计 `terrarium refrigerator` 中 `r` 的个数（答案: 7） | 旗舰稳过；降级模型易错答 5/6 |
| **Probe 3: 否定三段论** | 多步集合与逻辑推理 | Alpha/Beta/Gamma/Delta 互斥逻辑严格推导 | 逻辑严密判定正确（不可能） |
| **Probe 4: 前沿时间感知** | 知识截止与防幻觉 | 2024 物理诺奖 (Hopfield/Hinton) 及 2025-2026 前沿模型节点 | 区分 2026 最新旗舰与老旧版本 |

- **👑 S 级 (90-100分)**：顶尖旗舰模型（Claude 3.7 / 3.5 Sonnet、GPT-4o/o3 顶阶梯队）
- **✨ A 级 (75-89分)**：高阶主力模型（Qwen 2.5 / DeepSeek / Gemini Pro）
- **⚡ B 级 (55-74分)**：标准日常模型
- **⚠️ C 级 (<55分)**：轻量/降级模型（系统自动触发重抽）

---

## 📄 开源许可证

[MIT License](./LICENSE)
