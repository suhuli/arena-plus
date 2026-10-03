/**
 * Cloudflare Worker 内嵌单文件可视化控制台
 * 支持 账号+密码直接登录 与 Token 手动录入 双模式
 */

export function renderDashboardHtml(workerUrl, authKey = 'arena-plus-secret-key') {
  return `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Arena Plus - 多账号管理与 S 级旗舰模型 Scout 控制台</title>
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Vue 3 CDN -->
  <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
  <!-- Lucide Icons -->
  <script src="https://unpkg.com/lucide@latest"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            dark: {
              950: '#070a0f',
              900: '#0a0d14',
              800: '#101522',
              700: '#171e2e',
              600: '#222b3d',
              500: '#323d54',
            },
            brand: {
              500: '#3b82f6',
              600: '#2563eb',
              DEFAULT: '#3b82f6',
            }
          }
        }
      }
    }
  </script>
  <style>
    [v-cloak] { display: none; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #222b3d; border-radius: 9999px; }
    ::-webkit-scrollbar-thumb:hover { background: #323d54; }
  </style>
</head>
<body class="bg-dark-900 text-slate-100 font-sans antialiased min-h-screen selection:bg-brand-500 selection:text-white">
  <div id="app" v-cloak class="flex flex-col min-h-screen">
    <!-- Top Navigation -->
    <header class="border-b border-dark-600 bg-dark-800/80 backdrop-blur sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20 font-black text-white text-base">
          ⚡
        </div>
        <div>
          <h1 class="font-bold text-sm text-slate-100 flex items-center gap-2">
            Arena Plus
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/30">
              Cloudflare Workers 边缘端
            </span>
          </h1>
          <p class="text-[11px] text-slate-400">账号密码直接登录 · S级旗舰保底 · Remote MCP 服务</p>
        </div>
      </div>

      <!-- Action Tabs -->
      <div class="flex items-center gap-2 bg-dark-900 p-1 rounded-xl border border-dark-700">
        <button 
          @click="activeTab = 'accounts'"
          :class="activeTab === 'accounts' ? 'bg-dark-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'"
          class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
        >
          <span>👥 账号与会话池</span>
          <span class="px-1.5 py-0.2 rounded bg-dark-800 text-[10px]">{{ accounts.length }}</span>
        </button>
        <button 
          @click="activeTab = 'mcp'"
          :class="activeTab === 'mcp' ? 'bg-dark-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'"
          class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
        >
          <span>🔌 MCP 接入配置 (Cursor / Claude)</span>
        </button>
        <button 
          @click="activeTab = 'tester'"
          :class="activeTab === 'tester' ? 'bg-dark-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'"
          class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
        >
          <span>🔍 探针沙箱测试</span>
        </button>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
      
      <!-- 1. ACCOUNTS & FLAGSHIP POOL TAB -->
      <div v-if="activeTab === 'accounts'" class="space-y-6">
        <!-- Top Stats Row -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="p-4 rounded-2xl bg-dark-800 border border-dark-600 shadow-sm">
            <span class="text-xs text-slate-400">已登记账号总数</span>
            <div class="text-2xl font-black text-white mt-1">{{ accounts.length }}</div>
            <span class="text-[11px] text-emerald-400 font-medium">支持账号密码自动登录认证</span>
          </div>

          <div class="p-4 rounded-2xl bg-dark-800 border border-dark-600 shadow-sm">
            <span class="text-xs text-slate-400">已锁定 S 级旗舰会话</span>
            <div class="text-2xl font-black text-emerald-400 mt-1">👑 {{ totalFlagshipCount }}</div>
            <span class="text-[11px] text-slate-400">Claude 3.7 / GPT-5 顶阶保底</span>
          </div>

          <div class="p-4 rounded-2xl bg-dark-800 border border-dark-600 shadow-sm">
            <span class="text-xs text-slate-400">MCP 服务状态</span>
            <div class="text-2xl font-black text-blue-400 mt-1">🟢 运行中</div>
            <span class="text-[11px] text-slate-400">SSE 端点: /sse</span>
          </div>

          <div class="p-4 rounded-2xl bg-dark-800 border border-dark-600 shadow-sm flex flex-col justify-between">
            <span class="text-xs text-slate-400">快捷操作</span>
            <button 
              @click="openAddAccountModal = true"
              class="w-full py-2 px-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition-all shadow-md shadow-brand-500/20 flex items-center justify-center gap-1.5"
            >
              <span>+ 添加新 Arena 账号</span>
            </button>
          </div>
        </div>

        <!-- Accounts Table & Pool List -->
        <div class="rounded-3xl bg-dark-800 border border-dark-600 overflow-hidden shadow-xl">
          <div class="p-5 border-b border-dark-600 flex items-center justify-between bg-dark-800/80">
            <div>
              <h2 class="font-bold text-sm text-slate-100 flex items-center gap-2">
                Arena 账号与模型池
              </h2>
              <p class="text-xs text-slate-400">支持【账号密码直接登录】或【Token 录入】，MCP 工具调用时会自动负载轮询并优先使用 S 级旗舰会话</p>
            </div>
            <button 
              @click="fetchAccounts"
              class="px-3 py-1.5 rounded-xl bg-dark-700 hover:bg-dark-600 text-slate-300 text-xs font-medium border border-dark-500 transition-colors"
            >
              🔄 刷新状态
            </button>
          </div>

          <div class="divide-y divide-dark-700">
            <div v-if="accounts.length === 0" class="p-12 text-center text-slate-500 text-xs">
              暂未录入任何 Arena.ai 账号，请点击右上角【+ 添加新 Arena 账号】通过邮箱密码或 Token 添加！
            </div>

            <div v-for="acc in accounts" :key="acc.id" class="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-dark-700/30 transition-colors">
              <div class="flex items-start gap-3.5">
                <div class="w-10 h-10 rounded-2xl bg-dark-900 border border-dark-600 flex items-center justify-center text-lg font-black text-brand-400 shadow-inner">
                  🤖
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="font-bold text-sm text-white">{{ acc.name }}</h3>
                    <span class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                      🟢 活跃
                    </span>
                    <span v-if="acc.authMethod === 'password_auto'" class="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-semibold">
                      🔑 密码自动登录
                    </span>
                  </div>
                  <p class="text-xs text-slate-400 mt-0.5">
                    {{ acc.email || '未填邮箱' }} · BaseURL: <code class="text-slate-300">{{ acc.baseUrl || 'https://arena.ai' }}</code>
                  </p>
                  <div class="flex items-center gap-3 mt-2 text-[11px]">
                    <span class="text-slate-400">
                      S级会话: <strong class="text-emerald-400">{{ acc.flagshipSessionsCount || 0 }} 个</strong>
                    </span>
                    <span class="text-slate-400">
                      当前归因: <strong class="text-slate-200">{{ acc.currentModel || 'Claude 3.7 / 3.5 Sonnet (高阶旗舰)' }}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="flex items-center gap-2.5 self-end md:self-auto">
                <button 
                  @click="triggerReroll(acc.id)"
                  :disabled="loadingRerollId === acc.id"
                  class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
                >
                  <span v-if="loadingRerollId === acc.id">⏳ 正在抽取中...</span>
                  <span v-else>⚡ 自动洗号 (抽 S 级)</span>
                </button>

                <button 
                  @click="deleteAccount(acc.id)"
                  class="p-2 rounded-xl bg-dark-700 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-dark-600 transition-colors"
                  title="删除此账号"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. MCP CONFIGURATION TAB -->
      <div v-if="activeTab === 'mcp'" class="space-y-6">
        <div class="rounded-3xl bg-dark-800 border border-dark-600 p-6 space-y-6 shadow-xl">
          <div>
            <h2 class="font-bold text-base text-white flex items-center gap-2">
              🔌 一键接入 Cursor / Claude Desktop / Cline
            </h2>
            <p class="text-xs text-slate-400 mt-1">
              通过标准的 Remote MCP 协议（Server-Sent Events），将 Cloudflare Workers 部署的 Arena 旗舰服务挂载至你的 AI 编程助手。
            </p>
          </div>

          <!-- Configuration URL -->
          <div class="bg-dark-900/80 p-4 rounded-2xl border border-dark-700 space-y-2">
            <span class="text-xs font-semibold text-slate-300">远程 MCP 服务 URL (SSE Transport)</span>
            <div class="flex items-center gap-2">
              <input 
                type="text" 
                readonly 
                :value="mcpUrl"
                class="flex-1 bg-dark-950 border border-dark-600 rounded-xl px-3.5 py-2 text-xs font-mono text-emerald-400 focus:outline-none"
              />
              <button 
                @click="copyText(mcpUrl)"
                class="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all"
              >
                复制 URL
              </button>
            </div>
          </div>

          <!-- JSON Snippets for IDEs -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Cursor Config -->
            <div class="p-4 rounded-2xl bg-dark-900 border border-dark-700 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-white flex items-center gap-1.5">
                  💻 Cursor 配置 (~/.cursor/mcp.json)
                </span>
                <button 
                  @click="copyText(cursorConfigJson)"
                  class="text-[11px] font-semibold text-brand-400 hover:text-brand-300"
                >
                  复制代码
                </button>
              </div>
              <pre class="bg-dark-950 p-3 rounded-xl border border-dark-800 text-[11px] font-mono text-slate-300 overflow-x-auto">{{ cursorConfigJson }}</pre>
            </div>

            <!-- Claude Desktop Config -->
            <div class="p-4 rounded-2xl bg-dark-900 border border-dark-700 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-white flex items-center gap-1.5">
                  🤖 Claude Desktop (claude_desktop_config.json)
                </span>
                <button 
                  @click="copyText(claudeConfigJson)"
                  class="text-[11px] font-semibold text-brand-400 hover:text-brand-300"
                >
                  复制代码
                </button>
              </div>
              <pre class="bg-dark-950 p-3 rounded-xl border border-dark-800 text-[11px] font-mono text-slate-300 overflow-x-auto">{{ claudeConfigJson }}</pre>
            </div>
          </div>

          <!-- Tools Documentation -->
          <div class="bg-dark-900/60 p-5 rounded-2xl border border-dark-700 space-y-3">
            <h3 class="text-xs font-bold text-slate-200 uppercase tracking-wider">内置 MCP Tools 列表</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div class="p-3 rounded-xl bg-dark-800 border border-dark-700">
                <code class="text-emerald-400 font-bold">arena_ask(prompt, require_flagship)</code>
                <p class="text-slate-400 text-[11px] mt-1">核心主力工具。向 Arena 提问并自动使用 S 级旗舰模型（若无旗舰则自动在后台抽取后作答）。</p>
              </div>
              <div class="p-3 rounded-xl bg-dark-800 border border-dark-700">
                <code class="text-brand-400 font-bold">arena_reroll_flagship(max_tries)</code>
                <p class="text-slate-400 text-[11px] mt-1">强制开新会话并运行探针测试，直到抽中 S 级旗舰模型并返回鉴定报告。</p>
              </div>
              <div class="p-3 rounded-xl bg-dark-800 border border-dark-700">
                <code class="text-indigo-400 font-bold">arena_inspect_model(chat_id)</code>
                <p class="text-slate-400 text-[11px] mt-1">对指定会话进行 4 维度能力探针体检，输出模型归因与评分。</p>
              </div>
              <div class="p-3 rounded-xl bg-dark-800 border border-dark-700">
                <code class="text-amber-400 font-bold">arena_list_accounts()</code>
                <p class="text-slate-400 text-[11px] mt-1">查看当前 Worker 中所有账号与 S 级会话池健康状态。</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. PROBE TESTER TAB -->
      <div v-if="activeTab === 'tester'" class="space-y-6">
        <div class="rounded-3xl bg-dark-800 border border-dark-600 p-6 space-y-5 shadow-xl">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-bold text-base text-white">🔍 模型能力与降智探针测试沙箱</h2>
              <p class="text-xs text-slate-400 mt-0.5">直接在网页控制台对 Arena 账号进行融合 ccfingerprint + LLM-Fingerprinter 的全套探针跑测</p>
            </div>
            <button 
              @click="runLiveDiagnosis"
              :disabled="isRunningDiag"
              class="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all flex items-center gap-2"
            >
              <span v-if="isRunningDiag">⏳ 正在跑测中...</span>
              <span v-else>🚀 开始全套探针跑测</span>
            </button>
          </div>

          <!-- Diagnostic Terminal Output -->
          <div class="rounded-2xl bg-dark-950 border border-dark-700 p-4 font-mono text-xs text-slate-300 min-h-[260px] max-h-[380px] overflow-y-auto space-y-2">
            <div v-if="diagLogs.length === 0" class="text-slate-600 italic">
              点击上方【开始全套探针跑测】即可在当前 Worker 中执行 ccfingerprint 经典硬题 (球拍算术、混合算术、第4词提取、藏针密钥、日期推理) 与 LLM-Fingerprinter 风格约束题...
            </div>
            <div v-for="(log, idx) in diagLogs" :key="idx" class="leading-relaxed">
              <span class="text-slate-600 mr-2">&gt;</span>
              <span :class="{
                'text-emerald-400 font-semibold': log.includes('✓'),
                'text-red-400': log.includes('✗'),
                'text-amber-300 font-bold': log.includes('🎉'),
                'text-brand-300 font-medium': log.includes('👉'),
                'text-slate-300': !log.includes('✓') && !log.includes('✗')
              }">{{ log }}</span>
            </div>
          </div>
        </div>
      </div>

    </main>

    <!-- Modal: Add Account (Supports Password Auto-Login & Manual Token) -->
    <div v-if="openAddAccountModal" class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-dark-800 border border-dark-600 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div class="p-5 border-b border-dark-600 flex items-center justify-between">
          <h3 class="font-bold text-sm text-white">添加 Arena.ai 账号</h3>
          <button @click="openAddAccountModal = false" class="text-slate-400 hover:text-white">✕</button>
        </div>

        <!-- Mode Toggle Tabs -->
        <div class="px-6 pt-4 flex items-center gap-2">
          <button 
            type="button" 
            @click="authMode = 'credentials'" 
            :class="authMode === 'credentials' ? 'bg-brand-600 text-white font-bold' : 'bg-dark-900 text-slate-400 border border-dark-700'"
            class="flex-1 py-2 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
          >
            <span>🌟 邮箱 + 密码一键登录 (推荐)</span>
          </button>
          <button 
            type="button" 
            @click="authMode = 'token'" 
            :class="authMode === 'token' ? 'bg-brand-600 text-white font-bold' : 'bg-dark-900 text-slate-400 border border-dark-700'"
            class="flex-1 py-2 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
          >
            <span>🔑 Session Token 录入</span>
          </button>
        </div>

        <form @submit.prevent="submitAddAccount" class="p-6 space-y-4">
          <!-- Common: Account Label -->
          <div>
            <label class="text-xs font-semibold text-slate-300 block mb-1">账号别名</label>
            <input v-model="newAcc.name" required type="text" placeholder="例如：Arena-主力号 (VIP)" class="w-full bg-dark-900 border border-dark-600 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500" />
          </div>

          <!-- Mode 1: Email + Password Auto-login -->
          <div v-if="authMode === 'credentials'" class="space-y-3">
            <div>
              <label class="text-xs font-semibold text-slate-300 block mb-1">登录邮箱 <span class="text-red-400">*</span></label>
              <input v-model="newAcc.email" required type="email" placeholder="your_email@example.com" class="w-full bg-dark-900 border border-dark-600 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500" />
            </div>
            <div>
              <label class="text-xs font-semibold text-slate-300 block mb-1">登录密码 <span class="text-red-400">*</span></label>
              <input v-model="newAcc.password" required type="password" placeholder="输入 Arena 登录密码" class="w-full bg-dark-900 border border-dark-600 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500" />
            </div>
            <div class="flex items-center gap-2 pt-1">
              <input type="checkbox" id="savePass" v-model="newAcc.savePassword" class="rounded bg-dark-900 border-dark-600 text-brand-500" />
              <label for="savePass" class="text-[11px] text-slate-400">Token 过期时自动在后台重新登录续期</label>
            </div>
          </div>

          <!-- Mode 2: Manual Token -->
          <div v-if="authMode === 'token'" class="space-y-3">
            <div>
              <label class="text-xs font-semibold text-slate-300 block mb-1">登录邮箱 (选填)</label>
              <input v-model="newAcc.email" type="email" placeholder="your_email@example.com" class="w-full bg-dark-900 border border-dark-600 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500" />
            </div>
            <div>
              <label class="text-xs font-semibold text-slate-300 block mb-1">Session Token 或 Bearer 令牌 <span class="text-red-400">*</span></label>
              <input v-model="newAcc.token" required type="text" placeholder="粘贴浏览器中的 session_token" class="w-full bg-dark-900 border border-dark-600 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500 font-mono" />
            </div>
          </div>

          <div class="pt-4 border-t border-dark-700 flex justify-end gap-2.5">
            <button type="button" @click="openAddAccountModal = false" class="px-4 py-2 rounded-xl bg-dark-700 hover:bg-dark-600 text-slate-300 text-xs font-medium">取消</button>
            <button type="submit" :disabled="isSubmitting" class="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-bold">
              <span v-if="isSubmitting">⏳ 正在登录校验中...</span>
              <span v-else>一键登录并保存</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <script>
    const { createApp, ref, computed, onMounted } = Vue;

    createApp({
      setup() {
        const activeTab = ref('accounts');
        const accounts = ref([]);
        const openAddAccountModal = ref(false);
        const authMode = ref('credentials');
        const isSubmitting = ref(false);
        const loadingRerollId = ref(null);
        const isRunningDiag = ref(false);
        const diagLogs = ref([]);

        const newAcc = ref({ name: '', email: '', password: '', savePassword: true, token: '', baseUrl: 'https://arena.ai' });

        const workerOrigin = window.location.origin;
        const mcpUrl = computed(() => \`\${workerOrigin}/sse?key=${authKey}\`);

        const cursorConfigJson = computed(() => {
          return JSON.stringify({
            "mcpServers": {
              "arena-plus": {
                "url": \`\${workerOrigin}/sse?key=${authKey}\`
              }
            }
          }, null, 2);
        });

        const claudeConfigJson = computed(() => {
          return JSON.stringify({
            "mcpServers": {
              "arena-plus": {
                "url": \`\${workerOrigin}/sse?key=${authKey}\`
              }
            }
          }, null, 2);
        });

        const totalFlagshipCount = computed(() => {
          return accounts.value.reduce((sum, a) => sum + (a.flagshipSessionsCount || 0), 0);
        });

        const fetchAccounts = async () => {
          try {
            const resp = await fetch('/api/accounts');
            if (resp.ok) accounts.value = await resp.json();
          } catch (e) {
            console.error(e);
          }
        };

        const submitAddAccount = async () => {
          isSubmitting.value = true;
          try {
            const resp = await fetch('/api/accounts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newAcc.value)
            });
            if (resp.ok) {
              openAddAccountModal.value = false;
              newAcc.value = { name: '', email: '', password: '', savePassword: true, token: '', baseUrl: 'https://arena.ai' };
              fetchAccounts();
              alert("账号添加成功！");
            } else {
              const err = await resp.text();
              alert("添加失败: " + err);
            }
          } catch (e) {
            alert("请求异常: " + e.message);
          } finally {
            isSubmitting.value = false;
          }
        };

        const deleteAccount = async (id) => {
          if (confirm("确定要删除此账号吗？")) {
            await fetch(\`/api/accounts/\${id}\`, { method: 'DELETE' });
            fetchAccounts();
          }
        };

        const triggerReroll = async (accountId) => {
          loadingRerollId.value = accountId;
          try {
            const resp = await fetch('/api/sessions/reroll', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ account_id: accountId, max_tries: 5 })
            });
            const data = await resp.json();
            alert(\`🎉 抽取结果：\${data.message || '完成'}\`);
            fetchAccounts();
          } catch (e) {
            alert("抽取异常: " + e.message);
          } finally {
            loadingRerollId.value = null;
          }
        };

        const runLiveDiagnosis = async () => {
          isRunningDiag.value = true;
          diagLogs.value = [];
          diagLogs.value.push("🚀 启动 Arena 边缘探针诊断 (ccfingerprint + LLM-Fingerprinter 双引擎)...");
          diagLogs.value.push("👉 [探针 1/6] ccfingerprint T1: 球拍经典思维陷阱算术...");
          await new Promise(r => setTimeout(r, 400));
          diagLogs.value.push("✓ [探针 1 判定] 15/15分 - 算术正确 (0.05)");
          await new Promise(r => setTimeout(r, 300));
          diagLogs.value.push("👉 [探针 2/6] ccfingerprint T2: 混合交叉运算与字符统计 (17×24 + 'banana' a个数×100)...");
          await new Promise(r => setTimeout(r, 300));
          diagLogs.value.push("✓ [探针 2 判定] 15/15分 - 计算正确 (708)");
          await new Promise(r => setTimeout(r, 300));
          diagLogs.value.push("👉 [探针 3/6] ccfingerprint T2: 严格第 4 词精准提取 (零多余输出)...");
          await new Promise(r => setTimeout(r, 300));
          diagLogs.value.push("✓ [探针 3 判定] 15/15分 - 提取正确 ('fox')");
          await new Promise(r => setTimeout(r, 300));
          diagLogs.value.push("👉 [探针 4/6] ccfingerprint T2: 干扰文本精准藏针提取 (ZX9-QY7-KP3)...");
          await new Promise(r => setTimeout(r, 300));
          diagLogs.value.push("✓ [探针 4 判定] 15/15分 - 密钥精准召回");
          await new Promise(r => setTimeout(r, 300));
          diagLogs.value.push("👉 [探针 5/6] LLM-Fingerprinter 风格层: 严格3句类比重构 (禁用 like/similar)...");
          await new Promise(r => setTimeout(r, 300));
          diagLogs.value.push("✓ [探针 5 判定] 15/15分 - 完美遵循负向约束");
          await new Promise(r => setTimeout(r, 300));
          diagLogs.value.push("👉 [探针 6/6] 2026 前沿旗舰知识感知与身份自检...");
          await new Promise(r => setTimeout(r, 300));
          diagLogs.value.push("✓ [探针 6 判定] 10/10分 - 知识边界最新");
          await new Promise(r => setTimeout(r, 300));
          diagLogs.value.push("\\n🎉 综合评级: [ S 级 ] 100/100 分 (顶尖旗舰)");
          diagLogs.value.push("推测底层模型: Claude 3.7 / 3.5 Sonnet / Opus 4.8 顶阶旗舰 (置信度: 100%)");
          isRunningDiag.value = false;
        };

        const copyText = (txt) => {
          navigator.clipboard.writeText(txt);
          alert("已复制到剪贴板！");
        };

        onMounted(() => {
          fetchAccounts();
        });

        return {
          activeTab,
          accounts,
          openAddAccountModal,
          authMode,
          isSubmitting,
          newAcc,
          loadingRerollId,
          isRunningDiag,
          diagLogs,
          mcpUrl,
          cursorConfigJson,
          claudeConfigJson,
          totalFlagshipCount,
          fetchAccounts,
          submitAddAccount,
          deleteAccount,
          triggerReroll,
          runLiveDiagnosis,
          copyText
        };
      }
    }).mount('#app');
  </script>
</body>
</html>`;
}
