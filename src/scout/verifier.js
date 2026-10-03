/**
 * 本地确定性评分引擎与模型归因器
 */
import { SCOUT_PROBES } from './probes.js';

export function evaluateDiagnostic(probeAnswers) {
  let totalScore = 0;
  let maxTotalScore = 0;

  const categoryScores = {
    instruction_following: 0,
    spatial_attention: 0,
    reasoning: 0,
    knowledge_anchor: 0
  };

  const details = [];

  for (const probe of SCOUT_PROBES) {
    const rawAnswer = probeAnswers[probe.id] || '';
    const verifyResult = probe.verify(rawAnswer);

    totalScore += verifyResult.score;
    maxTotalScore += verifyResult.maxScore;
    categoryScores[probe.category] = verifyResult.score;

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

  // 评级判定 (S / A / B / C)
  let tier = 'C';
  let tierLabel = '降级/轻量模型 (建议重抽)';
  let isFlagship = false;

  if (scorePercentage >= 90) {
    tier = 'S';
    tierLabel = '顶尖旗舰模型 (SOTA)';
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
    tierLabel = '降级/轻量模型 (Downgraded)';
    isFlagship = false;
  }

  // 推测模型家族与型号
  let predictedModel = '未知模型 (混合/新架构)';
  let predictedFamily = 'Unknown';

  if (scorePercentage >= 90) {
    if (categoryScores.instruction_following === 25 && categoryScores.spatial_attention === 25) {
      predictedModel = 'Claude 3.7 / 3.5 Sonnet (高阶旗舰)';
      predictedFamily = 'Claude';
    } else {
      predictedModel = 'GPT-4o / o3 / GPT-5 梯队';
      predictedFamily = 'GPT';
    }
  } else if (scorePercentage >= 75) {
    predictedModel = 'Qwen 2.5 / DeepSeek / Gemini Pro 梯队';
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
