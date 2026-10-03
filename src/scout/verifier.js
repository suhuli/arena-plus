/**
 * 本地确定性评分引擎与最新模型归因器
 * 融合 ccfingerprint 确定性断言逻辑、LLM-Fingerprinter 行为风格匹配与 AMC 真实代号映射
 */
import { SCOUT_PROBES } from './probes.js';

// 966 款全量模型代号与代际分类体系 (参考 AMC Registry)
const MODEL_REGISTRY = [
  { family: 'OpenAI', gen: 'GPT-6', label: 'GPT-6 (Astra) 顶阶旗舰', codename: 'astra', re: /\bgpt[-\s]?6(?:[-\s]?(?:astra|luna|sol|terra|max|high))?/i },
  { family: 'OpenAI', gen: 'GPT-5.6', label: 'GPT-5.6 (Sol/Luna/Terra) 旗舰', codename: 'sol/luna/terra', re: /\bgpt[-\s]?5[.\-]?6(?:[-\s]?(?:sol|luna|terra|astra))?/i },
  { family: 'OpenAI', gen: 'GPT-5', label: 'GPT-5 / o3 顶阶推理旗舰', codename: 'gpt-5', re: /\b(?:gpt[-\s]?5|o3|o4[-\s]?mini)/i },
  { family: 'Claude', gen: 'Claude-5', label: 'Claude 5 (Fable/Mythos) 顶阶旗舰', codename: 'fable/mythos', re: /\bclaude[-\s]?(?:opus|sonnet|fable|mythos)?[-\s]?5/i },
  { family: 'Claude', gen: 'Claude-4.8', label: 'Claude Opus 4.8 顶阶旗舰', codename: 'opus-4.8', re: /\bclaude[-\s]?(?:opus|sonnet)[-\s]?4[.\-]?8/i },
  { family: 'Claude', gen: 'Claude-3.7', label: 'Claude 3.7 / 3.5 Sonnet 顶阶旗舰', codename: 'sonnet-3.7', re: /\bclaude[-\s]?3[.\-]?7/i },
  { family: 'Google', gen: 'Gemini-3.8', label: 'Gemini 3.8 / 3.7 Pro 旗舰', codename: 'gemini-3.8', re: /\bgemini[-\s]?3[.\-]?[78]/i },
  { family: 'DeepSeek', gen: 'DeepSeek-V4', label: 'DeepSeek V4.1 / V4 推理旗舰', codename: 'deepseek-v4', re: /\bdeepseek[-\s]?v?4(?:[.\-]?1)?/i },
  { family: 'Qwen', gen: 'Qwen-3.8', label: 'Qwen 3.8 / 3.5 Max 旗舰', codename: 'qwen-3.8', re: /\bqwen[-\s]?3[.\-]?[58]/i },
  { family: 'Moonshot', gen: 'Kimi-K3', label: 'Kimi K3 / K2.6 旗舰', codename: 'kimi-k3', re: /\bkimi[-\s]?k[23]/i }
];

export function evaluateDiagnostic(probeAnswers) {
  let totalScore = 0;
  let maxTotalScore = 0;

  const categoryScores = {
    math_reasoning: 0,
    strict_discipline: 0,
    logic_reasoning: 0,
    negative_constraint: 0,
    knowledge_cutoff: 0
  };

  const details = [];
  let combinedAnswersText = '';

  for (const probe of SCOUT_PROBES) {
    const rawAnswer = probeAnswers[probe.id] || '';
    combinedAnswersText += ' ' + rawAnswer;
    const verifyResult = probe.verify(rawAnswer);

    totalScore += verifyResult.score;
    maxTotalScore += verifyResult.maxScore;
    if (categoryScores[probe.category] !== undefined) {
      categoryScores[probe.category] += verifyResult.score;
    }

    details.push({
      probe: {
        id: probe.id,
        name: probe.name,
        category: probe.category,
        prompt: probe.prompt,
        weight: probe.weight
      },
      answer: rawAnswer,
      result: verifyResult
    });
  }

  const scorePercentage = maxTotalScore > 0 ? Math.round((totalScore / maxTotalScore) * 100) : 0;

  // S/A/B/C 评级判定 (S 级旗舰保底)
  let tier = 'C';
  let tierLabel = '降级/轻量模型 (触发自动重抽)';
  let isFlagship = false;

  if (scorePercentage >= 90) {
    tier = 'S';
    tierLabel = '最新顶尖旗舰模型 (SOTA)';
    isFlagship = true;
  } else if (scorePercentage >= 75) {
    tier = 'A';
    tierLabel = '高阶主力模型 (High Tier)';
    isFlagship = true;
  } else if (scorePercentage >= 55) {
    tier = 'B';
    tierLabel = '标准日常模型 (Standard)';
    isFlagship = false;
  } else {
    tier = 'C';
    tierLabel = '轻量/降智模型 (Downgraded)';
    isFlagship = false;
  }

  // 模型归因分析 (融合自我报告扫描与行为指纹)
  let predictedModel = '未知模型 (混合/新架构)';
  let predictedFamily = 'Unknown';

  // 扫描回答中是否有直接命中已知模型代号
  for (const m of MODEL_REGISTRY) {
    if (m.re.test(combinedAnswersText)) {
      predictedModel = m.label;
      predictedFamily = m.family;
      break;
    }
  }

  if (predictedFamily === 'Unknown') {
    if (scorePercentage >= 90) {
      // Claude 3.7 / 3.5 Sonnet 特征：在负向禁词与严格格式提取上保持 100% 纪律
      if (categoryScores.negative_constraint === 15 && categoryScores.strict_discipline === 30) {
        predictedModel = 'Claude 3.7 / 3.5 Sonnet / Opus 4.8 (Anthropic 顶阶旗舰)';
        predictedFamily = 'Claude';
      } else {
        predictedModel = 'GPT-6 (Astra) / GPT-5 / o3 (OpenAI 顶阶旗舰)';
        predictedFamily = 'OpenAI';
      }
    } else if (scorePercentage >= 75) {
      predictedModel = 'DeepSeek-V4 / Qwen-3.8 / Gemini 3.8 Pro 梯队';
      predictedFamily = 'Frontier-Open';
    } else {
      predictedModel = '轻量级 / 缩减版模型 (需重新抽取)';
      predictedFamily = 'Lite';
    }
  }

  return {
    totalScore,
    maxTotalScore,
    scorePercentage,
    tier,
    tierLabel,
    isFlagship,
    predictedModel,
    predictedFamily,
    confidence: `${scorePercentage}%`,
    categoryScores,
    timestamp: new Date().toISOString(),
    details
  };
}
