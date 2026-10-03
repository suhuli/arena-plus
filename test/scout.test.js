import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SCOUT_PROBES } from '../src/scout/probes.js';
import { evaluateDiagnostic } from '../src/scout/verifier.js';
import { MCPServer } from '../src/mcp/server.js';

describe('Upgraded Scout Probes (LLM-Fingerprinter Style)', () => {
  it('should pass forbidden constraint probe with 3 clean sentences', () => {
    const probe = SCOUT_PROBES.find(p => p.id === 'forbidden_constraint');
    const validAnswer = "类比是一种将熟悉领域的逻辑结构映射到陌生领域的认知机制。它通过传递底层关系而非表层特征来帮助深入理解新事物。这种思维桥梁使得抽象复杂概念的解释变得直观明了。";
    const result = probe.verify(validAnswer);
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.score, 25);
  });

  it('should fail forbidden constraint probe when containing "like" or "similar"', () => {
    const probe = SCOUT_PROBES.find(p => p.id === 'forbidden_constraint');
    const invalidAnswer = "An analogy is like a bridge between concepts. It shows similar structures. For example, atoms resemble solar systems.";
    const result = probe.verify(invalidAnswer);
    assert.strictEqual(result.passed, false);
    assert.ok(result.score < 25);
  });

  it('should correctly evaluate dual strawberry & terrarium character counts', () => {
    const probe = SCOUT_PROBES.find(p => p.id === 'tokenizer_spatial');
    const correctResult = probe.verify("3, 7");
    assert.strictEqual(correctResult.passed, true);
    assert.strictEqual(correctResult.score, 25);

    const wrongResult = probe.verify("2, 5");
    assert.strictEqual(wrongResult.passed, false);
  });

  it('should evaluate S-Tier flagship designation for latest Claude and GPT models', () => {
    const answers = {
      forbidden_constraint: "类比是一种将熟悉领域的逻辑结构映射到陌生领域的认知机制。它通过传递底层关系而非表层特征来帮助深入理解新事物。这种思维桥梁使得抽象复杂概念的解释变得直观明了。",
      tokenizer_spatial: "3, 7",
      deep_syllogism: "是。因为 Spark 包含于 Bloop，Bloop 包含于 Razzie，而 Razzie 与 Lazzie 互斥，所以 Spark 与 Lazzie 绝无交集。",
      frontier_anchors_2026: "1. GPT-5 于 2025 年发布；2. Claude 3.7 及 Opus 4.8 发布于 2026 年；3. 2024 年诺贝尔物理学奖授予了 Geoffrey Hinton 与 John Hopfield。"
    };

    const evaluation = evaluateDiagnostic(answers);
    assert.strictEqual(evaluation.tier, 'S');
    assert.strictEqual(evaluation.isFlagship, true);
    assert.strictEqual(evaluation.scorePercentage, 100);
    assert.ok(evaluation.predictedModel.includes('Claude') || evaluation.predictedModel.includes('GPT'));
  });
});

describe('MCP Server Integration', () => {
  it('should handle tools/list properly', async () => {
    const server = new MCPServer({});
    const response = await server.handleJsonRpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    });

    assert.strictEqual(response.id, 1);
    assert.ok(response.result.tools.some(t => t.name === 'arena_ask'));
  });
});
