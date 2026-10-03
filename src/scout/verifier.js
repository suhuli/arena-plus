/**
 * 本地确定性评分引擎与最新模型归因器
 * 融合 ccfingerprint 确定性断言逻辑、LLM-Fingerprinter 行为风格匹配与 2026 最新真实旗舰映射
 */
import { SCOUT_PROBES } from './probes.js';

// 2026 最新全量模型代号与代际分类体系
const MODEL_REGISTRY = [
  // ─── 2026 顶级旗舰 (S-Tier) ──────────────────────────────────────────
  { family: 'Anthropic', tier: 'S', gen: 'Claude-5.5', label: 'Claude Opus 5.5 (2026 最新顶阶旗舰)', codename: 'opus-5.5', re: /\bclaude[-\s]?(?:opus)?[-\s]?5[.\-]?5/i },
  { family: 'Anthropic', tier: 'S', gen: 'Claude-5.5-Sonnet', label: 'Claude Sonnet 5.5 (2026 最新主力旗舰)', codename: 'sonnet-5.5', re: /\bclaude[-\s]?(?:sonnet)?[-\s]?5[.\-]?5/i },
  { family: 'Anthropic', tier: 'S', gen: 'Claude-Fable', label: 'Claude Fable 5.1 / Mythos 5.1 (Mythos 超前沿旗舰)', codename: 'fable/mythos', re: /\b(?:claude[-\s]?(?:fable|mythos)[-\s]?5[.\-]?1|fable[-\s]?5[.\-]?1|mythos[-\s]?5[.\-]?1)/i },
  { family: 'OpenAI', tier: 'S', gen: 'GPT-6', label: 'GPT-6 Astra (OpenAI 2026 顶阶旗舰)', codename: 'astra', re: /\bgpt[-\s]?6(?:[-\s]?(?:astra|max|high))?/i },
  { family: 'OpenAI', tier: 'S', gen: 'GPT-6-Sol', label: 'GPT-6 Sol / Luna (OpenAI 2026 旗舰)', codename: 'sol/luna', re: /\bgpt[-\s]?6[-\s]?(?:sol|luna)/i },

  // ─── 2026 高阶主力梯队 (A-Tier) ───────────────────────────────────────
  { family: 'OpenAI', tier: 'A', gen: 'GPT-5.6', label: 'GPT-5.6 (Sol/Luna/Terra) 高阶主力', codename: 'sol/luna/terra', re: /\bgpt[-\s]?5[.\-]?6(?:[-\s]?(?:sol|luna|terra|astra))?/i },
  { family: 'OpenAI', tier: 'A', gen: 'GPT-5.5', label: 'GPT-5.5 Agentic 高阶主力', codename: 'gpt-5.5', re: /\bgpt[-\s]?5[.\-]?5/i },
  { family: 'Anthropic', tier: 'A', gen: 'Claude-Opus-4.8', label: 'Claude Opus 4.8 / Claude 5 高阶主力', codename: 'opus-4.8', re: /\bclaude[-\s]?(?:opus|sonnet)?[-\s]?(?:4[.\-]?8|5(?![.\-]?5))/i },
  { family: 'Google', tier: 'A', gen: 'Gemini-3.8', label: 'Gemini 3.8 / 3.7 Pro 高阶旗舰', codename: 'gemini-3.8', re: /\bgemini[-\s]?3[.\-]?[78]/i },
  { family: 'DeepSeek', tier: 'A', gen: 'DeepSeek-V4', label: 'DeepSeek V4.1 / V4 推理主力', codename: 'deepseek-v4', re: /\bdeepseek[-\s]?v?4(?:[.\-]?1)?/i },
  { family: 'Qwen', tier: 'A', gen: 'Qwen-3.8', label: 'Qwen 3.8 / 3.5 Max 高阶主力', codename: 'qwen-3.8', re: /\bqwen[-\s]?3[.\-]?[58]/i },
  { family: 'Moonshot', tier: 'A', gen: 'Kimi-K3', label: 'Kimi K3 / K2.6 高阶主力', codename: 'kimi-k3', re: /\bkimi[-\s]?k[23]/i },

  // ─── 旧代标准梯队 (B-Tier) ───────────────────────────────────────────
  { family: 'Anthropic', tier: 'B', gen: 'Claude-3.7', label: 'Claude 3.7 / 3.5 Sonnet (旧代模型)', codename: 'sonnet-3.7', re: /\bclaude[-\s]?3[.\-]?[57]/i },
  { family: 'OpenAI', tier: 'B', gen: 'GPT-5.2', label: 'GPT-5.2 / GPT-5 / o3 (旧代模型)', codename: 'gpt-5.2', re: /\b(?:gpt[-\s]?5[.\-]?[0-2]|o[134])/i },
  { family: 'OpenAI', tier: 'B', gen: 'GPT-4o', label: 'GPT-4o / GPT-4 系列 (旧代模型)', codename: 'gpt-4o', re: /\bgpt[-\s]?4/i }
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
    tierLabel = '2026 最新顶尖旗舰模型 (SOTA)';
    isFlagship = true;
  } else if (scorePercentage >= 75) {
    tier = 'A';
    tierLabel = '高阶主力模型 (High Tier)';
    isFlagship = true;
  } else if (scorePercentage >= 55) {
    tier = 'B';
    tierLabel = '标准/前代模型 (Standard)';
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
      // Claude Opus 5.5 / Sonnet 5.5 特征：在负向禁词与严格格式提取上保持 100% 纪律
      if (categoryScores.negative_constraint === 15 && categoryScores.strict_discipline === 30) {
        predictedModel = 'Claude Opus 5.5 / Sonnet 5.5 / Fable 5.1 (Anthropic 2026 顶阶旗舰)';
        predictedFamily = 'Anthropic';
      } else {
        predictedModel = 'GPT-6 Astra / Sol (OpenAI 2026 顶阶旗舰)';
        predictedFamily = 'OpenAI';
      }
    } else if (scorePercentage >= 75) {
      predictedModel = 'GPT-5.6 / Claude Opus 4.8 / DeepSeek-V4.1 / Gemini 3.8 梯队';
      predictedFamily = 'Frontier-High';
    } else if (scorePercentage >= 55) {
      predictedModel = 'Claude 3.7 / 3.5 Sonnet / GPT-5.2 (前代标准模型)';
      predictedFamily = 'Standard-Previous';
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
