import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SCOUT_PROBES } from '../src/scout/probes.js';
import { evaluateDiagnostic } from '../src/scout/verifier.js';
import { MCPServer, MCP_TOOLS } from '../src/mcp/server.js';

describe('Scout Probes & Verifier Tests', () => {
  it('should pass strict negative constraint probe when valid', () => {
    const probe = SCOUT_PROBES.find(p => p.id === 'strict_constraint');
    const validAnswer = "递归是一种优雅的算法策略。基准出口是防止栈溢出的必备关键要素。它通过层层回溯完成全部计算任务。";
    const result = probe.verify(validAnswer);
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.score, 25);
  });

  it('should fail strict negative constraint probe when containing forbidden words', () => {
    const probe = SCOUT_PROBES.find(p => p.id === 'strict_constraint');
    const invalidAnswer = "A function that calls itself is recursive. It needs a base condition. It repeats until done.";
    const result = probe.verify(invalidAnswer);
    assert.strictEqual(result.passed, false);
    assert.ok(result.score < 25);
  });

  it('should correctly evaluate zero-tool character count probe', () => {
    const probe = SCOUT_PROBES.find(p => p.id === 'character_count');
    const correctResult = probe.verify("7");
    assert.strictEqual(correctResult.passed, true);
    assert.strictEqual(correctResult.score, 25);

    const wrongResult = probe.verify("5");
    assert.strictEqual(wrongResult.passed, false);
  });

  it('should correctly evaluate multi-step syllogism probe', () => {
    const probe = SCOUT_PROBES.find(p => p.id === 'logic_deduction');
    const correctResult = probe.verify("不可能。由三段论可得 Delta 包含于 Beta，而 Beta 与 Gamma 互斥。");
    assert.strictEqual(correctResult.passed, true);
  });

  it('should compute S-Tier evaluation for high scores', () => {
    const answers = {
      strict_constraint: "递归是一种优雅的算法策略。基准出口是防止栈溢出的必备关键要素。它通过层层回溯完成全部计算任务。",
      character_count: "7",
      logic_deduction: "不可能。Delta 与 Gamma 互斥。",
      knowledge_cutoff: "GPT-5 于 2025 年 8 月发布，Claude Opus 4.8 于 2026 年 5 月发布，2024 物理诺贝尔奖为 Hopfield 和 Hinton。"
    };

    const evaluation = evaluateDiagnostic(answers);
    assert.strictEqual(evaluation.tier, 'S');
    assert.strictEqual(evaluation.isFlagship, true);
    assert.strictEqual(evaluation.scorePercentage, 100);
  });
});

describe('MCP Server Protocol Tests', () => {
  it('should return valid initialization response', async () => {
    const server = new MCPServer({});
    const response = await server.handleJsonRpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {}
    });

    assert.strictEqual(response.jsonrpc, '2.0');
    assert.strictEqual(response.id, 1);
    assert.ok(response.result.serverInfo);
    assert.strictEqual(response.result.serverInfo.name, 'arena-plus-mcp');
  });

  it('should list all available tools', async () => {
    const server = new MCPServer({});
    const response = await server.handleJsonRpc({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    });

    assert.strictEqual(response.id, 2);
    assert.ok(Array.isArray(response.result.tools));
    const toolNames = response.result.tools.map(t => t.name);
    assert.ok(toolNames.includes('arena_ask'));
    assert.ok(toolNames.includes('arena_reroll_flagship'));
    assert.ok(toolNames.includes('arena_inspect_model'));
  });
});
