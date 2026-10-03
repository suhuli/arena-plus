/**
 * 本地确定性评分引擎与最新模型归因器
 * 融合 ccfingerprint 确定性断言逻辑与 LLM-Fingerprinter 行为风格匹配
 */
import { SCOUT_PROBES } from './probes.js';

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

  for (const probe of SCOUT_PROBES) {
    const rawAnswer = probeAnswers[probe.id] || '';
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

  // 模型归因分析 (Claude vs OpenAI vs 开源)
  let predictedModel = '未知模型 (混合/新架构)';
  let predictedFamily = 'Unknown';

  if (scorePercentage >= 90) {
    // Claude 3.7 / 3.5 Sonnet 特征：在负向禁词与严格格式提取上保持 100% 纪律
    if (categoryScores.negative_constraint === 15 && categoryScores.strict_discipline === 30) {
      predictedModel = 'Claude 3.7 / 3.5 Sonnet / Opus 4.8 (Anthropic 顶阶旗舰)';
      predictedFamily = 'Claude';
    } else {
      predictedModel = 'GPT-5 / o3 / o4-mini (OpenAI 顶阶旗舰)';
      predictedFamily = 'GPT';
    }
  } else if (scorePercentage >= 75) {
    predictedModel = 'DeepSeek-R1 (推理版) / Qwen 2.5/3 / Gemini 3 Pro 梯队';
    predictedFamily = 'Open/Frontier';
  } else {
    predictedModel = '轻量级 / 缩减版模型 (需重新抽取)';
    predictedFamily = 'Lite';
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
