/**
 * Arena Scout - 高特异性模型能力与指纹探针集
 * 用于在 Cloudflare Workers 边缘端进行极速模型验证与降智排查
 */

export const SCOUT_PROBES = [
  {
    id: 'strict_constraint',
    name: '双重严格负向约束与结构表达',
    category: 'instruction_following',
    weight: 25,
    prompt: "请严格用恰好 3 句话解释什么是'递归'。要求：绝对不能出现单词'function'和'itself'（不分大小写），且每一句结尾都要有明确的标点符号。直接输出这3句话，不要任何前缀或解释。",
    verify: (response) => {
      const text = (response || '').trim();
      const violations = [];
      
      // 检查禁词
      if (/\bfunction\b/i.test(text)) violations.push("包含禁用词 'function'");
      if (/\bitself\b/i.test(text)) violations.push("包含禁用词 'itself'");
      
      // 检查句子数 (按常见标点分句，兼容有无空格)
      const sentences = text.split(/(?<=[.!?。！？])\s*/).filter(s => s.trim().length > 0);
      const sentenceCount = sentences.length;
      if (sentenceCount !== 3) {
        violations.push(`要求严格 3 句话，实际检测到 ${sentenceCount} 句`);
      }
      
      const passed = violations.length === 0;
      const score = passed ? 25 : Math.max(0, 25 - violations.length * 10);
      
      return {
        passed,
        score,
        maxScore: 25,
        details: passed ? "完美遵循严格禁词 (无 function/itself) 与 3 句话长度约束" : violations.join("; "),
        metrics: { sentenceCount, violationsCount: violations.length }
      };
    }
  },
  {
    id: 'character_count',
    name: '字符级原生空间注意力 (无工具计数)',
    category: 'spatial_attention',
    weight: 25,
    prompt: "在不使用任何代码或工具的前提下，请精确统计在短语 'terrarium refrigerator' 这两个单词中，字母 'r' 一共出现了几次？只输出一个最终的阿拉伯数字，不要任何多余文字。",
    verify: (response) => {
      const text = (response || '').trim();
      // 正确答案是 7 次 (te-r-r-a-r-ium = 3, r-ef-r-ige-r-ato-r = 4, 3+4=7)
      const match = text.match(/\d+/);
      const val = match ? parseInt(match[0], 10) : null;
      
      const passed = val === 7;
      let score = 0;
      if (passed) score = 25;
      else if (val === 6 || val === 8) score = 10;
      
      return {
        passed,
        score,
        maxScore: 25,
        details: passed ? "计数精准 (7 次)" : `计数错误，回答为 ${val ?? '无有效数字'} (正确应为 7)`,
        metrics: { returnedValue: val, expectedValue: 7 }
      };
    }
  },
  {
    id: 'logic_deduction',
    name: '多步三段论与否定逻辑推理',
    category: 'reasoning',
    weight: 25,
    prompt: "逻辑推理题：\n1. 所有 Alpha 都是 Beta。\n2. 没有 Beta 是 Gamma。\n3. 所有 Delta 都是 Alpha。\n问：'存在一个 Delta 是 Gamma' 这一命题是否可能为真？请只回答两个字：'可能' 或 '不可能'，并用一行简述理由。",
    verify: (response) => {
      const text = (response || '').trim();
      // Delta -> Alpha -> Beta, Beta与Gamma互斥 => Delta绝对不是Gamma => 不可能为真
      const isImpossible = /不可能/i.test(text) && !/可能为真/i.test(text.replace(/不可能/g, ''));
      const isPossible = /^可能[，,。]|^可能$/i.test(text.trim());
      
      const passed = isImpossible && !isPossible;
      return {
        passed,
        score: passed ? 25 : 0,
        maxScore: 25,
        details: passed ? "逻辑严密判定正确 (不可能)" : "逻辑关系推导错误",
        metrics: { answerCorrect: passed }
      };
    }
  },
  {
    id: 'knowledge_cutoff',
    name: '前沿模型知识边界与真实时间感知',
    category: 'knowledge_anchor',
    weight: 25,
    prompt: "请列举：OpenAI 的 GPT-5 发布月份、Anthropic 的 Claude Opus 4.8 发布月份，以及 2024 年诺贝尔物理学奖得主是谁？各用一句话回答。",
    verify: (response) => {
      const text = (response || '').trim();
      let matchedPoints = 0;
      const details = [];
      
      if (/Hopfield|Hinton|霍普菲尔德|辛顿|欣顿/i.test(text)) {
        matchedPoints += 1;
        details.push("准确命中 2024 物理学诺贝尔奖");
      }
      
      if (/2025|2026/i.test(text)) {
        matchedPoints += 1;
        details.push("具备 2025-2026 前沿知识感知");
      }
      
      if (/Claude|Opus|GPT/i.test(text)) {
        matchedPoints += 1;
      }
      
      const score = Math.round((matchedPoints / 3) * 25);
      const passed = score >= 16;
      
      return {
        passed,
        score,
        maxScore: 25,
        details: details.join("； ") || "知识边界陈旧或未匹配",
        metrics: { matchedPoints }
      };
    }
  }
];
