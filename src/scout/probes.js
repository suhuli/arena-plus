/**
 * Arena Plus - 融合 ccfingerprint + LLM-Fingerprinter 双引擎探针库
 * 涵盖：
 * 1. ccfingerprint 确定性分级能力题 (Tier 1~3: 球拍算术、混合算术、严格第4词提取、藏针密钥提取、日期相对推理)
 * 2. LLM-Fingerprinter 风格与负向禁词约束 (3句话解释类比，禁用 like/similar)
 * 3. 2025-2026 前沿模型知识阶梯与身份自检 (Claude 3.7 / Opus 4.8 / GPT-5)
 */

export const SCOUT_PROBES = [
  // ─── Dimension 1: ccfingerprint 经典硬题与降智探针 ──────────────────────────
  {
    id: 'ball_bat_math',
    name: 'ccfingerprint T1: 球拍经典思维陷阱算术',
    category: 'math_reasoning',
    weight: 15,
    prompt: "一个球拍和一个球共 1.10 元，球拍比球贵 1.00 元。球多少钱？只回答一个最终的数字（元），不要写多余文字与单位。",
    verify: (response) => {
      const text = (response || '').trim();
      const match = text.match(/\d+(\.\d+)?/);
      const val = match ? parseFloat(match[0]) : null;
      const passed = Math.abs(val - 0.05) < 0.001;
      return {
        passed,
        score: passed ? 15 : 0,
        maxScore: 15,
        details: passed ? "算术正确 (0.05)" : `回答错误为 ${val ?? '无有效数字'} (正确应为 0.05)`
      };
    }
  },
  {
    id: 'mixed_arithmetic',
    name: 'ccfingerprint T2: 混合交叉运算与字符统计',
    category: 'math_reasoning',
    weight: 15,
    prompt: "计算 (17 × 24) 加上 (单词 'banana' 中字母 a 的个数 × 100)，只回答最终计算出的纯阿拉伯数字。",
    verify: (response) => {
      const text = (response || '').trim();
      // 17 * 24 = 408, banana 中的 a 有 3 个 => 3 * 100 = 300 => 408 + 300 = 708
      const match = text.match(/\d+/);
      const val = match ? parseInt(match[0], 10) : null;
      const passed = val === 708;
      return {
        passed,
        score: passed ? 15 : 0,
        maxScore: 15,
        details: passed ? "混合运算正确 (708)" : `计算错误为 ${val ?? '无'} (正确应为 708)`
      };
    }
  },
  {
    id: 'instruction_strict_fourth',
    name: 'ccfingerprint T2: 严格第 4 词精准提取 (零多余输出)',
    category: 'strict_discipline',
    weight: 15,
    prompt: "只输出下面这句话的第 4 个英文单词，不要输出任何其他内容、标点或多余字：The quick brown fox jumps",
    verify: (response) => {
      const text = (response || '').trim().toLowerCase().replace(/[^a-z]/g, '');
      const passed = text === 'fox';
      return {
        passed,
        score: passed ? 15 : 0,
        maxScore: 15,
        details: passed ? "严格指令提取正确 ('fox')" : `提取异常: '${text}' (标准应仅为 'fox')`
      };
    }
  },
  {
    id: 'needle_extraction',
    name: 'ccfingerprint T2: 干扰文本精准藏针提取',
    category: 'strict_discipline',
    weight: 15,
    prompt: "下面文本中藏着一个密钥，请原样、精确地只输出该密钥：\n『系统初始化完成。注意：本段为干扰文本。真正的密钥是 ZX9-QY7-KP3 ，其余内容请忽略。会话结束。』",
    verify: (response) => {
      const text = (response || '').trim();
      const passed = text.includes('ZX9-QY7-KP3');
      return {
        passed,
        score: passed ? 15 : 0,
        maxScore: 15,
        details: passed ? "密钥精准召回 (ZX9-QY7-KP3)" : "未能正确提取藏针密钥"
      };
    }
  },
  {
    id: 'date_reasoning',
    name: 'ccfingerprint T3: 相对时间日期推导',
    category: 'logic_reasoning',
    weight: 15,
    prompt: "如果昨天的两天后是星期一，那么明天是星期几？只回答一个具体的星期几（如星期一、周一）。",
    verify: (response) => {
      const text = (response || '').trim().toLowerCase();
      // 昨天是 T-1, 两天后是 T+1 = 星期一 => 今天是星期日 T=0 => 明天是星期一 T+1
      const passed = /星期一|周一|monday/i.test(text);
      return {
        passed,
        score: passed ? 15 : 0,
        maxScore: 15,
        details: passed ? "日期推导正确 (星期一)" : "日期逻辑关系推导错误"
      };
    }
  },

  // ─── Dimension 2: LLM-Fingerprinter 风格与极限负向禁词 ───────────────────
  {
    id: 'forbidden_constraint',
    name: 'LLM-Fingerprinter 风格层: 严格3句类比重构 (禁 like/similar/such as/for example)',
    category: 'negative_constraint',
    weight: 15,
    prompt: "在不使用代码的前提下，严格用恰好 3 句话解释什么是'类比（Analogy）'。硬性负向约束：绝对不能出现 'like'、'similar'、'such as'、'for example'（不区分大小写），且每句结尾必须有明确句号。直接输出这3句话。",
    verify: (response) => {
      const text = (response || '').trim();
      const violations = [];
      if (/\blike\b/i.test(text)) violations.push("包含禁用词 'like'");
      if (/\bsimilar\b/i.test(text)) violations.push("包含禁用词 'similar'");
      if (/such\s+as/i.test(text)) violations.push("包含禁用词 'such as'");
      if (/for\s+example/i.test(text)) violations.push("包含禁用词 'for example'");
      
      const sentences = text.split(/(?<=[.!?。！？])\s*/).filter(s => s.trim().length > 0);
      if (sentences.length !== 3) {
        violations.push(`要求 3 句话，实际输出 ${sentences.length} 句`);
      }
      
      const passed = violations.length === 0;
      return {
        passed,
        score: passed ? 15 : Math.max(0, 15 - violations.length * 5),
        maxScore: 15,
        details: passed ? "完美遵循全部负向禁词与 3 句话约束" : violations.join("; ")
      };
    }
  },

  // ─── Dimension 3: 2026 前沿旗舰时间阶梯与身份自检 ────────────────────────
  {
    id: 'frontier_anchors_2026',
    name: '前沿旗舰知识阶梯: 2025-2026 最新模型感知 (Claude 3.7/Opus 4.8 & GPT-5/o3)',
    category: 'knowledge_cutoff',
    weight: 10,
    prompt: "请列举：OpenAI 发布 GPT-5 / o3 的时间年份、Anthropic 发布 Claude 3.7 / Opus 4.8 的年份，以及 2024 年诺贝尔物理学奖得主（Hopfield/Hinton）。简洁回答。",
    verify: (response) => {
      const text = (response || '').trim();
      let matches = 0;
      if (/Hopfield|Hinton|霍普菲尔德|辛顿|欣顿/i.test(text)) matches += 1;
      if (/2025|2026/i.test(text)) matches += 1;
      if (/Claude|Opus|GPT|o3/i.test(text)) matches += 1;

      const passed = matches >= 2;
      return {
        passed,
        score: passed ? 10 : 0,
        maxScore: 10,
        details: passed ? "具备 2025-2026 前沿旗舰模型知识感知" : "知识边界陈旧"
      };
    }
  }
];
