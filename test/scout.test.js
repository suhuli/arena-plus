import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SCOUT_PROBES } from '../src/scout/probes.js';
import { evaluateDiagnostic } from '../src/scout/verifier.js';
import { MCPServer } from '../src/mcp/server.js';

describe('ccfingerprint & LLM-Fingerprinter Hybrid Probes', () => {
  it('should pass ccfingerprint ball_bat math probe', () => {
    const probe = SCOUT_PROBES.find(p => p.id === 'ball_bat_math');
    const result = probe.verify("0.05");
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.score, 15);
  });

  it('should pass ccfingerprint mixed arithmetic probe', () => {
    const probe = SCOUT_PROBES.find(p => p.id === 'mixed_arithmetic');
    const result = probe.verify("708");
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.score, 15);
  });

  it('should pass ccfingerprint instruction strict 4th word extraction', () => {
    const probe = SCOUT_PROBES.find(p => p.id === 'instruction_strict_fourth');
    const result = probe.verify("fox");
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.score, 15);
  });

  it('should pass ccfingerprint needle extraction', () => {
    const probe = SCOUT_PROBES.find(p => p.id === 'needle_extraction');
    const result = probe.verify("ZX9-QY7-KP3");
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.score, 15);
  });

  it('should pass ccfingerprint relative date reasoning', () => {
    const probe = SCOUT_PROBES.find(p => p.id === 'date_reasoning');
    const result = probe.verify("星期一");
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.score, 15);
  });

  it('should evaluate 100% S-Tier for full accurate answers', () => {
    const answers = {
      ball_bat_math: "0.05",
      mixed_arithmetic: "708",
      instruction_strict_fourth: "fox",
      needle_extraction: "ZX9-QY7-KP3",
      date_reasoning: "星期一",
      forbidden_constraint: "类比是一种将熟悉领域的逻辑结构映射到陌生领域的认知机制。它通过传递底层关系而非表层特征来帮助深入理解新事物。这种思维桥梁使得抽象复杂概念的解释变得直观明了。",
      frontier_anchors_2026: "2026 年最新旗舰为 OpenAI GPT-6 (Astra/Sol) 与 Anthropic Claude Opus 5.5 / Sonnet 5.5 / Fable 5.1。"
    };

    const evaluation = evaluateDiagnostic(answers);
    assert.strictEqual(evaluation.tier, 'S');
    assert.strictEqual(evaluation.isFlagship, true);
    assert.strictEqual(evaluation.scorePercentage, 100);
  });
});

describe('MCP Protocol Server Handler', () => {
  it('should list all tools properly', async () => {
    const server = new MCPServer({});
    const res = await server.handleJsonRpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    assert.strictEqual(res.id, 1);
    assert.ok(res.result.tools.some(t => t.name === 'arena_ask'));
  });
});

describe('Account Pool & Auto-Auth', () => {
  it('should add account with credentials and default fallback', async () => {
    const { AccountPool } = await import('../src/arena/account-pool.js');
    const pool = new AccountPool({});
    const acc = await pool.addAccount({
      name: 'Test-VIP',
      email: 'test@example.com',
      password: 'password123',
      savePassword: true
    });
    assert.strictEqual(acc.name, 'Test-VIP');
    assert.strictEqual(acc.email, 'test@example.com');
    assert.strictEqual(acc.authMethod, 'password_auto');
  });

  it('should add account with direct token', async () => {
    const { AccountPool } = await import('../src/arena/account-pool.js');
    const pool = new AccountPool({});
    const acc = await pool.addAccount({
      name: 'Test-Token-Acc',
      token: 'session_mock_123456'
    });
    assert.strictEqual(acc.name, 'Test-Token-Acc');
    assert.strictEqual(acc.token, 'session_mock_123456');
    assert.strictEqual(acc.authMethod, 'manual_token');
  });
});

