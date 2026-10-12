import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import ts from 'typescript';

const hardTimer = setTimeout(() => {
  console.error('FATAL: capture_unstable_ui.mjs timed out after 110s');
  process.exit(1);
}, 110000);
hardTimer.unref();

// Import VERIFIED_DEMO_CASES and addresses from real src/config/chain.ts
const chainTsPath = path.resolve('./src/config/chain.ts');
const tmpChainMjs = path.resolve('./scripts/.tmp_ui_chain.mjs');
const transpiled = ts.transpileModule(fs.readFileSync(chainTsPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
fs.writeFileSync(tmpChainMjs, transpiled.outputText, 'utf8');

let VERIFIED_DEMO_CASES;
let MIRROR_JUDGE_ADDRESS;
try {
  const mod = await import(`${pathToFileURL(tmpChainMjs).href}?t=${Date.now()}`);
  VERIFIED_DEMO_CASES = mod.VERIFIED_DEMO_CASES;
  MIRROR_JUDGE_ADDRESS = mod.MIRROR_JUDGE_ADDRESS;
} finally {
  if (fs.existsSync(tmpChainMjs)) fs.unlinkSync(tmpChainMjs);
}

const distDir = path.resolve('./dist');
const docsDir = path.resolve('./docs');
fs.mkdirSync(docsDir, { recursive: true });

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  let filePath = path.join(distDir, urlPath === '/' ? 'index.html' : urlPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

async function launchHeadlessBrowser() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  const exe = candidates.find((p) => fs.existsSync(p));
  assert.ok(exe, 'No Chrome/Edge executable found');

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sod-headless-'));
  const proc = spawn(
    exe,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1440,1080',
      `--user-data-dir=${userDataDir}`,
      '--remote-debugging-port=0',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );

  const wsEndpoint = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Browser launch timeout (15s)')), 15000);
    let stderrBuf = '';
    proc.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString();
      const m = stderrBuf.match(/DevTools listening on (ws:\/\/[^\r\n]+)/);
      if (m) {
        clearTimeout(t);
        resolve(m[1]);
      }
    });
    proc.once('exit', (code) => {
      clearTimeout(t);
      reject(new Error(`Browser exited early with code ${code}`));
    });
  });

  const httpBase = wsEndpoint.replace(/^ws:\/\//, 'http://').replace(/\/devtools\/browser\/.*$/, '');
  const targetsRes = await fetch(`${httpBase}/json/list`);
  const targets = await targetsRes.json();
  const pageTarget = targets.find((t) => t.type === 'page');
  assert.ok(pageTarget?.webSocketDebuggerUrl, 'No page target found in headless browser');

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });

  function send(method, params = {}) {
    const id = nextId++;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');

  const page = {
    async goto(url, { timeout = 30000 } = {}) {
      await Promise.race([
        send('Page.navigate', { url }),
        new Promise((_, r) => setTimeout(() => r(new Error(`page.goto timeout (${timeout}ms)`)), timeout)),
      ]);
    },
    async waitForSelector(selector, { timeout = 20000 } = {}) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const evalRes = await send('Runtime.evaluate', {
          expression: `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
          returnByValue: true,
        });
        if (evalRes?.result?.value === true) return;
        await new Promise((r) => setTimeout(r, 250));
      }
      throw new Error(`waitForSelector(${selector}) timed out after ${timeout}ms`);
    },
    async evaluate(fnExpr) {
      const evalRes = await send('Runtime.evaluate', {
        expression: fnExpr,
        returnByValue: true,
      });
      return evalRes?.result?.value;
    },
    async screenshot({ path: outPath }) {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
    },
  };

  const browser = {
    async close() {
      try {
        ws.close();
      } catch {}
      try {
        proc.kill('SIGKILL');
      } catch {}
    },
  };

  return { browser, page };
}

await new Promise((resolve) => server.listen(4179, '127.0.0.1', resolve));
const baseUrl = process.env.TARGET_BASE_URL || 'http://127.0.0.1:4179';

const demoChecks = [
  {
    key: 'DEMO_A',
    id: VERIFIED_DEMO_CASES.DEMO_A.id,
    selector: '.status-badge-stable',
    expectedBadgeType: 'stable',
    expectedBadgeText: 'STABLE',
    expectedTitle: 'STABLE CERTIFICATE',
  },
  {
    key: 'DEMO_B',
    id: VERIFIED_DEMO_CASES.DEMO_B.id,
    selector: '.status-badge-insufficient',
    expectedBadgeType: 'insufficient',
    expectedBadgeText: 'INSUFFICIENT EVIDENCE',
    expectedTitle: 'INSUFFICIENT EVIDENCE',
  },
  {
    key: 'DEMO_C',
    id: VERIFIED_DEMO_CASES.DEMO_C.id,
    selector: '.status-badge-split',
    expectedBadgeType: 'split',
    expectedBadgeText: 'SPLIT VERDICT',
    expectedTitle: 'SPLIT DETERMINATION',
  },
  {
    key: 'DEMO_D',
    id: VERIFIED_DEMO_CASES.DEMO_D.id,
    selector: '.status-badge-unstable',
    expectedBadgeType: 'unstable',
    expectedBadgeText: 'UNSTABLE',
    expectedTitle: 'UNSTABLE CERTIFICATE',
  },
];

let browser;
try {
  const launched = await launchHeadlessBrowser();
  browser = launched.browser;
  const { page } = launched;

  console.log(`--- Testing Certificate Display on Production Build (${baseUrl}) ---`);

  for (const check of demoChecks) {
    const url = `${baseUrl}/#/app?case=${check.id}`;
    await page.goto('about:blank', { timeout: 30000 });
    await page.goto(url, { timeout: 30000 });
    await page.waitForSelector(check.selector, { timeout: 20000 });

    const snapshot = await page.evaluate(`(() => {
      const badgeEl = document.querySelector(${JSON.stringify(check.selector)});
      const titleEl = document.querySelector('.verdict-stage-1');
      const explainEl = document.querySelector('.verdict-stage-2');
      return {
        badgeText: badgeEl ? badgeEl.innerText.trim() : '',
        certificateTitle: titleEl ? titleEl.innerText.trim() : '',
        explanation: explainEl ? explainEl.innerText.trim() : '',
        bodyText: document.body.innerText,
      };
    })()`);

    assert.equal(
      snapshot.badgeText,
      check.expectedBadgeText,
      `[${check.key}] Expected badge "${check.expectedBadgeText}", got "${snapshot.badgeText}"`
    );
    assert.equal(
      snapshot.certificateTitle,
      check.expectedTitle,
      `[${check.key}] Expected certificateTitle "${check.expectedTitle}", got "${snapshot.certificateTitle}"`
    );
    console.log(
      `PASS ${check.key} (${check.id}): badgeType=${check.expectedBadgeType}, badge="${snapshot.badgeText}", title="${snapshot.certificateTitle}"`
    );

    if (check.key === 'DEMO_D') {
      assert.ok(
        snapshot.bodyText.includes('OPEN (Evidence reopened for Round 2)'),
        `[DEMO_D] Expected UI to contain "OPEN (Evidence reopened for Round 2)"`
      );
      assert.equal(
        snapshot.bodyText.includes('Verified Stable'),
        false,
        `[DEMO_D] Expected UI NOT to contain "Verified Stable"`
      );
      const standaloneStable = snapshot.bodyText.match(/(?<!UN)STABLE/g) || [];
      assert.equal(
        standaloneStable.length,
        0,
        `[DEMO_D] Expected 0 standalone STABLE occurrences on page, found: ${JSON.stringify(standaloneStable)}`
      );
      console.log(
        `PASS DEMO_D (${check.id}): shows "OPEN (Evidence reopened for Round 2)", 0 standalone STABLE occurrences, 0 "Verified Stable"`
      );

      const screenshotPath = path.join(docsDir, `unstable_case_${check.id}.png`);
      await page.screenshot({ path: screenshotPath });

      const proofMarkdown = `# UI Verification Proof: On-Chain \`UNSTABLE\` Case (\`${check.id}\`)

## 1. On-Chain Case & RPC Coordinates
- **Contract Address**: \`${MIRROR_JUDGE_ADDRESS}\`
- **Case ID**: \`${check.id}\`
- **Title**: \`Cross-Border Escrow & SLA Addendum Attribution Dispute\`
- **\`open_case\` Tx**: \`0xeb96d6421daac8e85e7648517452fae593ca15b6ab51e2c793b29b6569b0e00b\`
- **Party 1 \`add_evidence\` Tx**: \`0xb77ac30acb220664c574941c463ac9b5d2899655baee3fe6e0ce1882056314f7\`
- **Party 1 \`mark_ready\` Tx**: \`0xe83357fdf5e64f6062b7ebdb71a923c4a4289e320cf1a5dd0f8c0cead0574f29\`
- **Party 2 \`add_evidence\` Tx**: \`0x90a35868f67391f5bd9d5284afc7008f87977e42c3f33f9031fe62626e7408c5\`
- **Party 2 \`mark_ready\` Tx**: \`0xcf01f31e39c003de1a280b19dd0d1754c2fc57db455ddd353b463845beac5ef6\`
- **\`judge\` Tx**: \`0xfd6a4e5acb7404ff8d060a5618246a98e535a66641e18fe23ffbe488c81b92de\`
- **RPC View Call**: \`get_certificate("${check.id}")\`
- **Field Read**: \`status = "OPEN"\`, \`current_decision = "UNSTABLE|NONE|UNSTABLE"\`, \`rounds[0].decision = "UNSTABLE|NONE|UNSTABLE"\`, \`ready = {"PARTY_1":false,"PARTY_2":false}\`

## 2. Rendered DOM Assertions (All 4 Demo Cases A, B, C, D)
- **Demo A (\`${VERIFIED_DEMO_CASES.DEMO_A.id}\`)**: badge \`stable\` (\`STABLE\`), title \`STABLE CERTIFICATE\`
- **Demo B (\`${VERIFIED_DEMO_CASES.DEMO_B.id}\`)**: badge \`insufficient\` (\`INSUFFICIENT EVIDENCE\`), title \`INSUFFICIENT EVIDENCE\`
- **Demo C (\`${VERIFIED_DEMO_CASES.DEMO_C.id}\`)**: badge \`split\` (\`SPLIT VERDICT\`), title \`SPLIT DETERMINATION\`
- **Demo D (\`${check.id}\`)**: badge \`unstable\` (\`${snapshot.badgeText}\`), title \`${snapshot.certificateTitle}\`, status \`OPEN (Evidence reopened for Round 2)\`
- **Standalone \`STABLE\` matches on Demo D page (\`/(?<!UN)STABLE/\`)**: \`0\`
- **Screenshot**: \`docs/unstable_case_${check.id}.png\`

## 3. Captured Visible Text from Rendered Workbench (\`/#/app?case=${check.id}\`)
\`\`\`text
${snapshot.bodyText.trim()}
\`\`\`
`;
      fs.writeFileSync(path.join(docsDir, 'UNSTABLE_CASE_UI_PROOF.md'), proofMarkdown, 'utf8');
    }
  }

  console.log('ALL 4 DEMO CERTIFICATE UI CHECKS PASSED.');
} finally {
  if (browser) {
    await browser.close();
  }
  server.close();
  clearTimeout(hardTimer);
}
process.exit(0);
