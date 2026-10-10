import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const hardTimer = setTimeout(() => {
  console.error('FATAL: capture_unstable_ui.mjs timed out after 90s');
  process.exit(1);
}, 90000);
hardTimer.unref();

const docsDir = path.resolve('./docs');
fs.mkdirSync(docsDir, { recursive: true });

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

const targetUrl =
  process.env.TARGET_URL ||
  'https://second-opinion-desk-genlayer.vercel.app/#/app?case=cbbed41fefc3';
console.log('Opening remote production URL:', targetUrl);

let browser;
try {
  const launched = await launchHeadlessBrowser();
  browser = launched.browser;
  const { page } = launched;

  await page.goto(targetUrl, { timeout: 30000 });
  await page.waitForSelector('.status-badge-unstable', { timeout: 20000 });

  const screenshotPath = path.join(docsDir, 'unstable_case_cbbed41fefc3.png');
  await page.screenshot({ path: screenshotPath });

  const snapshot = await page.evaluate(`(() => {
    const badgeEl = document.querySelector('.status-badge-unstable');
    const titleEl = document.querySelector('.verdict-stage-1');
    const explainEl = document.querySelector('.verdict-stage-2');
    return {
      badgeText: badgeEl ? badgeEl.innerText.trim() : '',
      certificateTitle: titleEl ? titleEl.innerText.trim() : '',
      explanation: explainEl ? explainEl.innerText.trim() : '',
      bodyText: document.body.innerText,
    };
  })()`);

  console.log('Rendered Badge:', snapshot.badgeText);
  console.log('Rendered Certificate Title:', snapshot.certificateTitle);
  console.log('Rendered Explanation:', snapshot.explanation);

  assert.equal(snapshot.badgeText, 'UNSTABLE', 'Badge must read UNSTABLE');
  assert.equal(snapshot.certificateTitle, 'UNSTABLE CERTIFICATE', 'Certificate title must read UNSTABLE CERTIFICATE');
  assert.ok(snapshot.bodyText.includes('cbbed41fefc3'), 'Page must include case ID cbbed41fefc3');
  assert.ok(snapshot.bodyText.includes('UNSTABLE|NONE|UNSTABLE'), 'Page must include raw decision UNSTABLE|NONE|UNSTABLE');

  const standaloneStable = snapshot.bodyText.match(/(?<!UN)STABLE/gi) || [];
  assert.equal(
    standaloneStable.length,
    0,
    `Expected 0 standalone STABLE occurrences on page, found: ${JSON.stringify(standaloneStable)}`
  );
  console.log('Standalone STABLE occurrences on page:', standaloneStable.length);

  const proofMarkdown = `# UI Verification Proof: On-Chain \`UNSTABLE\` Case (\`cbbed41fefc3\`)

## 1. On-Chain Case & RPC Coordinates
- **Production URL**: \`${targetUrl}\`
- **Contract Address**: \`0x1343C51732FD1002986Ed3f0Bb9D5C2105A6635D\`
- **Case ID**: \`cbbed41fefc3\`
- **Title**: \`Cross-Border Escrow & SLA Addendum Attribution Dispute\`
- **\`open_case\` Tx**: \`0xa3e30f86e5677c7b069b3c42bd2769a6f90e27570cca39c24a2017151e4ff2aa\`
- **Party 1 \`add_evidence\` Tx**: \`0x1edb1ec2e78ab87cb4396d5548df6426ea47615f36ac4249f73455c9355b3bae\`
- **Party 2 \`add_evidence\` Tx**: \`0xa4605d01bf0f17c5ca6264f75f355d9f4a351343058e69021a28eb94c774f8bd\`
- **\`judge\` Tx**: \`0x8472dbad8e0bdc0f3049db16ca509e3b539a5d938b2bff5a389aff2d16e2c3a2\`
- **RPC View Call**: \`get_certificate("cbbed41fefc3")\`
- **Field Read**: \`current_decision = "UNSTABLE|NONE|UNSTABLE"\`, \`rounds[0].decision = "UNSTABLE|NONE|UNSTABLE"\`

## 2. Rendered DOM Assertions (Live Production Site)
- **Badge text**: \`${snapshot.badgeText}\`
- **Certificate title**: \`${snapshot.certificateTitle}\`
- **On-chain Decision String**: \`UNSTABLE|NONE|UNSTABLE\`
- **Standalone \`STABLE\` matches on page (\`/(?<!UN)STABLE/gi\`)**: \`0\`
- **Screenshot**: \`docs/unstable_case_cbbed41fefc3.png\`

## 3. Captured Visible Text from Live Production Workbench (\`${targetUrl}\`)
\`\`\`text
${snapshot.bodyText.trim()}
\`\`\`
`;

  fs.writeFileSync(path.join(docsDir, 'UNSTABLE_CASE_UI_PROOF.md'), proofMarkdown, 'utf8');
  console.log('SUCCESS: Verified live production URL and saved proof to docs/UNSTABLE_CASE_UI_PROOF.md');
} finally {
  if (browser) {
    await browser.close();
  }
  clearTimeout(hardTimer);
}
process.exit(0);
