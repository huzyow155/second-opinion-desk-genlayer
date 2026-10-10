import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// Compile and dynamically import the REAL src/utils/decisionParser.ts
const parserTsPath = path.resolve('./src/utils/decisionParser.ts');
const tsSource = fs.readFileSync(parserTsPath, 'utf8');
const transpiled = ts.transpileModule(tsSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});

const tmpMjsPath = path.resolve('./scripts/.tmp_decisionParser.mjs');
fs.writeFileSync(tmpMjsPath, transpiled.outputText, 'utf8');

let parseDecision;
try {
  const mod = await import(`${pathToFileURL(tmpMjsPath).href}?t=${Date.now()}`);
  parseDecision = mod.parseDecision;
} finally {
  if (fs.existsSync(tmpMjsPath)) {
    fs.unlinkSync(tmpMjsPath);
  }
}

assert.equal(typeof parseDecision, 'function', 'parseDecision must be exported from src/utils/decisionParser.ts');

console.log('--- Testing REAL src/utils/decisionParser.ts ---');

// 1. DECIDED|PARTY_1|STABLE -> status DECIDED, winner PARTY_1, stability STABLE, badgeType stable
{
  const res = parseDecision('DECIDED|PARTY_1|STABLE');
  assert.equal(res.status, 'DECIDED');
  assert.equal(res.winner, 'PARTY_1');
  assert.equal(res.stability, 'STABLE');
  assert.equal(res.badgeType, 'stable');
  assert.equal(res.certificateTitle, 'STABLE CERTIFICATE');
  console.log('PASS 1: DECIDED|PARTY_1|STABLE -> status DECIDED, winner PARTY_1, stability STABLE, badgeType stable');
}

// 2. DECIDED|PARTY_2|STABLE -> winner PARTY_2, badgeType stable
{
  const res = parseDecision('DECIDED|PARTY_2|STABLE');
  assert.equal(res.status, 'DECIDED');
  assert.equal(res.winner, 'PARTY_2');
  assert.equal(res.stability, 'STABLE');
  assert.equal(res.badgeType, 'stable');
  assert.equal(res.certificateTitle, 'STABLE CERTIFICATE');
  console.log('PASS 2: DECIDED|PARTY_2|STABLE -> winner PARTY_2, badgeType stable');
}

// 3. DECIDED|SPLIT|STABLE -> winner SPLIT, badgeType split
{
  const res = parseDecision('DECIDED|SPLIT|STABLE');
  assert.equal(res.status, 'DECIDED');
  assert.equal(res.winner, 'SPLIT');
  assert.equal(res.stability, 'STABLE');
  assert.equal(res.badgeType, 'split');
  assert.equal(res.certificateTitle, 'SPLIT DETERMINATION');
  console.log('PASS 3: DECIDED|SPLIT|STABLE -> winner SPLIT, badgeType split');
}

// 4. UNSTABLE|NONE|UNSTABLE -> status UNSTABLE (not DECIDED), stability UNSTABLE, badgeType unstable,
//    certificateTitle must not contain "STABLE CERTIFICATE" without "UNSTABLE" prefix
{
  const res = parseDecision('UNSTABLE|NONE|UNSTABLE');
  assert.equal(res.status, 'UNSTABLE');
  assert.notEqual(res.status, 'DECIDED');
  assert.equal(res.stability, 'UNSTABLE');
  assert.equal(res.badgeType, 'unstable');
  assert.equal(res.certificateTitle, 'UNSTABLE CERTIFICATE');
  assert.equal(/(?<!UN)STABLE CERTIFICATE/.test(res.certificateTitle), false);
  console.log('PASS 4: UNSTABLE|NONE|UNSTABLE -> status UNSTABLE, stability UNSTABLE, badgeType unstable, certificateTitle UNSTABLE CERTIFICATE');
}

// 5. INSUFFICIENT|NONE|NA -> status INSUFFICIENT, badgeType insufficient
{
  const res = parseDecision('INSUFFICIENT|NONE|NA');
  assert.equal(res.status, 'INSUFFICIENT');
  assert.equal(res.badgeType, 'insufficient');
  assert.equal(res.certificateTitle, 'INSUFFICIENT EVIDENCE');
  console.log('PASS 5: INSUFFICIENT|NONE|NA -> status INSUFFICIENT, badgeType insufficient');
}

// 6. "" and null -> PENDING
{
  const resEmpty = parseDecision('');
  assert.equal(resEmpty.status, 'PENDING');
  assert.equal(resEmpty.badgeType, 'pending');

  const resNull = parseDecision(null);
  assert.equal(resNull.status, 'PENDING');
  assert.equal(resNull.badgeType, 'pending');
  console.log('PASS 6: "" and null -> PENDING');
}

// 7. "FOO|BAR|BAZ" -> UNKNOWN, no throw
{
  let res;
  assert.doesNotThrow(() => {
    res = parseDecision('FOO|BAR|BAZ');
  });
  assert.equal(res.status, 'UNKNOWN');
  assert.equal(res.winner, 'NONE');
  assert.equal(res.stability, 'NA');
  console.log('PASS 7: "FOO|BAR|BAZ" -> UNKNOWN, no throw');
}

// 8. " unstable|none|unstable " -> still UNSTABLE
{
  const res = parseDecision(' unstable|none|unstable ');
  assert.equal(res.status, 'UNSTABLE');
  assert.equal(res.stability, 'UNSTABLE');
  assert.equal(res.badgeType, 'unstable');
  assert.equal(res.certificateTitle, 'UNSTABLE CERTIFICATE');
  console.log('PASS 8: " unstable|none|unstable " -> UNSTABLE');
}

// 9. DECIDED|PARTY_1|UNSTABLE -> does NOT produce a label or badge claiming STABLE
{
  const res = parseDecision('DECIDED|PARTY_1|UNSTABLE');
  assert.equal(res.status, 'DECIDED');
  assert.equal(res.winner, 'PARTY_1');
  assert.equal(res.stability, 'UNSTABLE');
  assert.notEqual(res.badgeType, 'stable');
  assert.equal(res.badgeType, 'unstable');
  const labelTokens = res.label.split('·').map((s) => s.trim());
  assert.equal(labelTokens.includes('STABLE'), false, `Label must not claim STABLE: ${res.label}`);
  assert.equal(/(?<!UN)STABLE/.test(res.label), false, `Label must not contain standalone STABLE: ${res.label}`);
  assert.equal(/(?<!UN)STABLE/.test(res.certificateTitle), false, `Certificate title must not claim STABLE: ${res.certificateTitle}`);
  console.log('PASS 9: DECIDED|PARTY_1|UNSTABLE -> does not claim STABLE in label, badgeType, or certificateTitle');
}

// 10. Regression grep across src/ (excluding decisionParser.ts) for substring-style decision matching
function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(full));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const srcFiles = walkFiles(path.resolve('./src')).filter(
  (f) => path.resolve(f) !== parserTsPath
);

const forbiddenPatterns = [
  /\.(includes|indexOf)\s*\(\s*['"`](STABLE|UNSTABLE|PARTY_1|PARTY_2|SPLIT|INSUFFICIENT)['"`]\s*\)/,
  /\/(STABLE|UNSTABLE|PARTY_1|PARTY_2|SPLIT|INSUFFICIENT)\/[gimsuy]*\.test\s*\(/,
];

const violations = [];
for (const file of srcFiles) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, idx) => {
    for (const pat of forbiddenPatterns) {
      if (pat.test(line)) {
        violations.push(`${path.relative(process.cwd(), file)}:${idx + 1}: ${line.trim()}`);
      }
    }
  });
}

assert.equal(
  violations.length,
  0,
  `Forbidden substring/regex decision token matching found in src/:\n${violations.join('\n')}`
);
console.log(`PASS 10: Regression scan across ${srcFiles.length} src/ files found 0 substring decision matches.`);
console.log('ALL PARSER & REGRESSION TESTS PASSED.');
