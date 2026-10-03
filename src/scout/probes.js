/**
 * Arena Plus - 升级版多维高特异性探针集
 * 深度融合 LLM-Fingerprinter 与 ModelTrace 2026 最新前沿模型特征
 * 专为甄别最新 Claude (Claude 3.7 / Opus 4.8 / Sonnet 5) 与最新 GPT (o3 / GPT-5 / GPT-5.5) 设计
 */

export const SCOUT_PROBES = [
  {
    id: 'forbidden_constraint',
    name: 'LLM-Fingerprinter 风格层：极限负向禁词与严格概念重构',
    category: 'instruction_discipline',
    weight: 25,
    prompt: "在不使用任何代码的前提下，严格用恰好 3 句话解释什么是'类比（Analogy）'。硬性负向约束：绝对不能出现 'like'、'similar'、'such as'、'for example'（包含大小写与任何变形），每句话结尾必须有明确句号。直接输出这3句话，不要任何前缀或引言。",
    verify: (response) => {
      const text = (response || '').trim();
      const violations = [];
      
      // 检查禁词
      if (/\blike\b/i.test(text)) violations.push("违规包含禁用词 'like'");
      if (/\bsimilar\b/i.test(text)) violations.push("违规包含禁用词 'similar'");
      if (/such\s+as/i.test(text)) violations.push("违规包含禁用词 'such as'");
      if (/for\s+example/i.test(text)) violations.push("违规包含禁用词 'for example'");
      
      // 检查句子数
      const sentences = text.split(/(?<=[.!?。！？])\s*/).filter(s => s.trim().length > 0);
      const sentenceCount = sentences.length;
      if (sentenceCount !== 3) {
        violations.push(`要求严格 3 句话，实际输出 ${sentenceCount} 句`);
      }
      
      const passed = violations.length === 0;
      const score = passed ? 25 : Math.max(0, 25 - violations.length * 8);
      
      return {
        passed,
        score,
        maxScore: 25,
        details: passed ? "完美遵循全部负向禁词与 3 句话长度纪律" : violations.join("; "),
        metrics: { sentenceCount, violationsCount: violations.length }
      };
    }
  },
  {
    id: 'tokenizer_spatial',
    name: '分词器与原生空间注意力：多词混合字母精准统计 (无工具)',
    category: 'spatial_attention',
    weight: 25,
    prompt: "不使用任何编程代码、脚本或工具，仅凭自身原生注意力，回答两个计数：\n1. 单词 'strawberry' 中字母 r 出现几次？\n2. 短语 'terrarium refrigerator' 两个词中字母 r 一共出现几次？\n只按格式输出两个数字（如 3, 7），不要解释。",
    verify: (response) => {
      const text = (response || '').trim();
      const numbers = text.match(/\d+/g)?.map(n => parseInt(n, 10)) || [];
      
      // 正确答案：strawberry = 3, terrarium refrigerator = 7
      const has3 = numbers.includes(3);
      const has7 = numbers.includes(7);
      
      const passed = has3 && has7;
      let score = 0;
      if (passed) score = 25;
      else if (has3 || has7) score = 15;
      
      return {
        passed,
        score,
        maxScore: 25,
        details: passed ? "双计数完全正确 (3 与 7)" : `计数异常，提取数字: [${numbers.join(', ')}] (标准应为 3, 7)`,
        metrics: { numbers, correctCount: (has3 ? 1 : 0) + (has7 ? 1 : 0) }
      };
    }
  },
  {
    id: 'deep_syllogism',
    name: '复杂多步三段论与隐式互斥逻辑推理',
    category: 'deep_reasoning',
    weight: 25,
    prompt: "逻辑推理：\n1. 所有 Bloop 都是 Razzie。\n2. 没有 Razzie 是 Lazzie。\n3. 所有 Spark 都是 Bloop。\n问：'存在至少一个 Spark 属于 Lazzie' 这一命题是否必然为假？请只回答两个字：'是' 或 '否'，并用一句话说明集合包含关系。",
    verify: (response) => {
      const text = (response || '').trim();
      // Spark ⊆ Bloop ⊆ Razzie，Razzie ∩ Lazzie = ∅ => Spark ∩ Lazzie = ∅ => 命题必然为假 => 答案是 "是"
      const isYes = /^是[，,。]|^是$/i.test(text.trim()) || (/必然为假/i.test(text) && !/不能确定必然为假/i.test(text));
      const isNo = /^否[，,。]|^否$/i.test(text.trim());
      
      const passed = isYes && !isNo;
      return {
        passed,
        score: passed ? 25 : 0,
        maxScore: 25,
        details: passed ? "高阶逻辑严密判定正确 (必然为假)" : "集合互斥推导错误",
        metrics: { answerCorrect: passed }
      };
    }
  },
  {
    id: 'frontier_anchors_2026',
    name: '2025-2026 最新旗舰模型发布与时间感知阶梯',
    category: 'frontier_knowledge',
    weight: 25,
    prompt: "请列举：\n1. OpenAI 发布 GPT-5 / o3 这一梯队模型的具体月份？\n2. Anthropic 发布 Claude 3.7 / Claude Opus 4.8 的具体月份？\n3. 2024年诺贝尔物理学奖授予了哪位神经网络先驱？\n各用一句话简洁作答。",
    verify: (response) => {
      const text = (response || '').trim();
      let matchedPoints = 0;
      const details = [];
      
      // 检查诺贝尔奖 (Hopfield / Hinton / 霍普菲尔德 / 辛顿)
      if (/Hopfield|Hinton|霍普菲尔德|辛顿|欣顿/i.test(text)) {
        matchedPoints += 1;
        details.push("命中 2024 物理学诺贝尔奖 (Hinton/Hopfield)");
      }
      
      // 检查前沿最新模型时间节点 (2025/2026 年)
      if (/2025|2026/i.test(text)) {
        matchedPoints += 1;
        details.push("具备 2025-2026 最新大模型时间感知");
      }
      
      // 检查 Claude 3.7 / Opus / GPT 旗舰标识
      if (/Claude|Opus|Sonnet|GPT|o3/i.test(text)) {
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
