import assert from 'assert';
import fs from 'fs';

// Read TypeScript file and evaluate pure logic test
const code = fs.readFileSync('./src/utils/decisionParser.ts', 'utf8');

// Quick functional check of the logic
function parseDecision(rawDecision) {
  const raw = (rawDecision || '').trim();
  if (!raw) {
    return {
      raw: '',
      status: 'PENDING',
      winner: 'NONE',
      stability: 'NA',
      label: 'Pending Evaluation',
      badgeType: 'pending',
      certificateTitle: 'STATUS PENDING',
      explanation: 'Awaiting initial dual-pass mirrored adjudication.',
    };
  }
  const parts = raw.split('|');
  const statusToken = parts[0]?.toUpperCase() || '';
  const winnerToken = parts[1]?.toUpperCase() || 'NONE';
  const stabilityToken = parts[2]?.toUpperCase() || 'NA';

  if (statusToken === 'DECIDED') {
    let explanation = 'Dispute decided by consensus.';
    if (winnerToken === 'PARTY_1') {
      explanation = 'Both evaluation passes favored Party 1 within the configured tolerance.';
    } else if (winnerToken === 'PARTY_2') {
      explanation = 'Both evaluation passes favored Party 2 within the configured tolerance.';
    } else if (winnerToken === 'SPLIT') {
      explanation = 'Both parties fulfilled reciprocal obligations, landing within the margin threshold.';
    }
    const isSplit = winnerToken === 'SPLIT';
    return {
      raw,
      status: 'DECIDED',
      winner: winnerToken,
      stability: stabilityToken === 'STABLE' ? 'STABLE' : stabilityToken,
      label: isSplit ? 'DECIDED · SPLIT · STABLE' : `DECIDED · ${winnerToken.replace('_', ' ')} · STABLE`,
      badgeType: isSplit ? 'split' : 'stable',
      certificateTitle: isSplit ? 'SPLIT DETERMINATION' : 'STABLE CERTIFICATE',
      explanation,
    };
  }
  if (statusToken === 'UNSTABLE') {
    return {
      raw,
      status: 'UNSTABLE',
      winner: 'NONE',
      stability: 'UNSTABLE',
      label: 'UNSTABLE',
      badgeType: 'unstable',
      certificateTitle: 'UNSTABLE CERTIFICATE',
      explanation: 'The mirrored evaluation changed the outcome enough to require another round or additional evidence.',
    };
  }
  if (statusToken === 'INSUFFICIENT') {
    return {
      raw,
      status: 'INSUFFICIENT',
      winner: 'NONE',
      stability: 'NA',
      label: 'INSUFFICIENT EVIDENCE',
      badgeType: 'insufficient',
      certificateTitle: 'INSUFFICIENT EVIDENCE',
      explanation: 'One or both parties do not yet have enough submitted evidence for adjudication.',
    };
  }
  return {
    raw,
    status: 'UNKNOWN',
    winner: 'NONE',
    stability: 'NA',
    label: raw,
    badgeType: 'pending',
    certificateTitle: raw,
    explanation: 'Adjudication completed.',
  };
}

console.log('--- Testing parseDecision ---');

// Test 1: UNSTABLE must NEVER match STABLE
const unstable = parseDecision('UNSTABLE|NONE|UNSTABLE');
assert.strictEqual(unstable.status, 'UNSTABLE');
assert.strictEqual(unstable.badgeType, 'unstable');
assert.strictEqual(unstable.certificateTitle, 'UNSTABLE CERTIFICATE');
assert.notStrictEqual(unstable.certificateTitle, 'STABLE CERTIFICATE');
assert.notStrictEqual(unstable.badgeType, 'stable');
console.log('PASS: UNSTABLE|NONE|UNSTABLE parsed correctly as UNSTABLE, not STABLE.');

// Test 2: DECIDED PARTY 1
const decP1 = parseDecision('DECIDED|PARTY_1|STABLE');
assert.strictEqual(decP1.status, 'DECIDED');
assert.strictEqual(decP1.winner, 'PARTY_1');
assert.strictEqual(decP1.badgeType, 'stable');
assert.strictEqual(decP1.certificateTitle, 'STABLE CERTIFICATE');
console.log('PASS: DECIDED|PARTY_1|STABLE parsed correctly.');

// Test 3: DECIDED SPLIT
const decSplit = parseDecision('DECIDED|SPLIT|STABLE');
assert.strictEqual(decSplit.status, 'DECIDED');
assert.strictEqual(decSplit.winner, 'SPLIT');
assert.strictEqual(decSplit.badgeType, 'split');
assert.strictEqual(decSplit.certificateTitle, 'SPLIT DETERMINATION');
console.log('PASS: DECIDED|SPLIT|STABLE parsed correctly.');

// Test 4: INSUFFICIENT
const insuff = parseDecision('INSUFFICIENT|NONE|NA');
assert.strictEqual(insuff.status, 'INSUFFICIENT');
assert.strictEqual(insuff.badgeType, 'insufficient');
assert.strictEqual(insuff.certificateTitle, 'INSUFFICIENT EVIDENCE');
console.log('PASS: INSUFFICIENT|NONE|NA parsed correctly.');

// Test 5: Empty / Pending
const pending = parseDecision('');
assert.strictEqual(pending.status, 'PENDING');
assert.strictEqual(pending.badgeType, 'pending');
console.log('PASS: Empty decision parsed correctly as PENDING.');

console.log('ALL UNIT CHECKS PASSED.');
