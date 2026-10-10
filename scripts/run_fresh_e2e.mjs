import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { createClient, createAccount } from 'genlayer-js';

// Compile and dynamically import the REAL src/config/chain.ts and src/services/contractService.ts
const chainTsPath = path.resolve('./src/config/chain.ts');
const serviceTsPath = path.resolve('./src/services/contractService.ts');

const tmpChainMjs = path.resolve('./scripts/.tmp_chain.mjs');
const tmpServiceMjs = path.resolve('./scripts/.tmp_contractService.mjs');

const chainTranspiled = ts.transpileModule(fs.readFileSync(chainTsPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
fs.writeFileSync(tmpChainMjs, chainTranspiled.outputText, 'utf8');

const serviceSource = fs
  .readFileSync(serviceTsPath, 'utf8')
  .replace(/from\s+['"]\.\.\/config\/chain['"]/g, "from './.tmp_chain.mjs'");
const serviceTranspiled = ts.transpileModule(serviceSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
fs.writeFileSync(tmpServiceMjs, serviceTranspiled.outputText, 'utf8');

let chainMod;
let serviceMod;
try {
  const bust = `?t=${Date.now()}`;
  chainMod = await import(`${pathToFileURL(tmpChainMjs).href}${bust}`);
  serviceMod = await import(`${pathToFileURL(tmpServiceMjs).href}${bust}`);
} finally {
  if (fs.existsSync(tmpServiceMjs)) fs.unlinkSync(tmpServiceMjs);
  if (fs.existsSync(tmpChainMjs)) fs.unlinkSync(tmpChainMjs);
}

const { MIRROR_JUDGE_ADDRESS, CONSUMER_CONTRACT_ADDRESS } = chainMod;
const {
  STUDIONET_CONFIG,
  executeOpenCase,
  executeAddEvidence,
  executeJudge,
  executeFinalize,
  executeConsumerSettle,
  waitForReceiptWithProgress,
  verifyPostWriteState,
  fetchCase,
  fetchCertificate,
  fetchConsumerSettlement,
  fetchLatestCaseForPair,
  extractRevertReason,
} = serviceMod;

function assertStrictSuccessReceipt(res, stepLabel) {
  assert.ok(res?.receipt, `[${stepLabel}] Missing receipt`);
  assert.equal(
    res.receipt.status_name,
    'ACCEPTED',
    `[${stepLabel}] Expected status_name === 'ACCEPTED', got ${res.receipt.status_name}`
  );
  const leaderReceipts = res.receipt?.consensus_data?.leader_receipt || [];
  assert.ok(
    Array.isArray(leaderReceipts) && leaderReceipts.length > 0,
    `[${stepLabel}] Expected non-empty consensus_data.leader_receipt`
  );
  for (const [idx, lr] of leaderReceipts.entries()) {
    assert.equal(
      lr?.execution_result,
      'SUCCESS',
      `[${stepLabel}] Expected leader_receipt[${idx}].execution_result === 'SUCCESS', got ${lr?.execution_result}`
    );
  }
  assert.equal(res.success, true, `[${stepLabel}] Expected waitForReceiptWithProgress.success === true`);
  return leaderReceipts.map((r) => r.execution_result);
}

async function main() {
  console.log('================================================================');
  console.log('COMPREHENSIVE E2E SUITE (REAL chain.ts + contractService.ts)');
  console.log('MirrorJudge Address:        ', MIRROR_JUDGE_ADDRESS);
  console.log('MirrorJudgeConsumer Address:', CONSUMER_CONTRACT_ADDRESS);
  console.log('================================================================\n');

  const overallStart = Date.now();

  const party1Account = createAccount();
  const party2Account = createAccount();
  console.log('Party 1 (Opener):  ', party1Account.address);
  console.log('Party 2 (Opposing):', party2Account.address);

  const client1 = createClient({
    chain: STUDIONET_CONFIG,
    account: party1Account,
  });
  const client2 = createClient({
    chain: STUDIONET_CONFIG,
    account: party2Account,
  });

  // -------------------------------------------------------------------------
  // 1. OPEN_CASE
  // -------------------------------------------------------------------------
  const title = `Fresh E2E Milestone Verification ${Date.now()}`;
  const criteria = [
    {
      id: 'milestone_delivery',
      text: 'Which party substantiated full completion of milestone deliverables: PARTY_1 or PARTY_2?',
      weight_bp: 6000,
    },
    {
      id: 'spec_compliance',
      text: 'Which party adhered to specifications and code standards: PARTY_1 or PARTY_2?',
      weight_bp: 4000,
    },
  ];
  const criteriaJson = JSON.stringify(criteria);
  const aliases1 = 'Alice, Alice Corp';
  const aliases2 = 'Bob, Bob Dev';

  console.log('\n--- [Step 1/6] executeOpenCase ---');
  const openTx = await executeOpenCase(
    client1,
    title,
    criteriaJson,
    aliases1,
    aliases2,
    party2Account.address
  );
  const openReceiptRes = await waitForReceiptWithProgress(client1, openTx);
  const openLeaderExec = assertStrictSuccessReceipt(openReceiptRes, 'open_case');

  const pairLookup = await fetchLatestCaseForPair(party1Account.address, party2Account.address);
  assert.equal(pairLookup.ok, true, 'fetchLatestCaseForPair must succeed');
  assert.ok(pairLookup.data && pairLookup.data.length === 12, `Expected 12-char caseId, got ${pairLookup.data}`);
  const caseId = pairLookup.data;

  const openVerify = await verifyPostWriteState('open', caseId, { title });
  assert.equal(openVerify.verified, true, `verifyPostWriteState('open') failed: ${openVerify.message}`);
  console.log(`Tx Hash:  ${openTx}`);
  console.log(`Status:   ${openReceiptRes.receipt.status_name} (leader_receipt: ${JSON.stringify(openLeaderExec)})`);
  console.log(`Readback: case_id=${caseId}, status=${openVerify.readData.status}, title="${openVerify.readData.title}"`);

  // -------------------------------------------------------------------------
  // 2. ADD_EVIDENCE (PARTY 1)
  // -------------------------------------------------------------------------
  console.log('\n--- [Step 2/6] executeAddEvidence (Party 1) ---');
  const ev1 =
    'Alice Corp submitted audited git repository logs and test suites proving Alice completed all software deliverables with zero critical defects.';
  const ev1Tx = await executeAddEvidence(client1, caseId, ev1);
  const ev1ReceiptRes = await waitForReceiptWithProgress(client1, ev1Tx);
  const ev1LeaderExec = assertStrictSuccessReceipt(ev1ReceiptRes, 'add_evidence_party_1');

  const ev1Verify = await verifyPostWriteState('evidence', caseId, { minCount: 1 });
  assert.equal(ev1Verify.verified, true, `verifyPostWriteState('evidence' P1) failed: ${ev1Verify.message}`);
  console.log(`Tx Hash:  ${ev1Tx}`);
  console.log(`Status:   ${ev1ReceiptRes.receipt.status_name} (leader_receipt: ${JSON.stringify(ev1LeaderExec)})`);
  console.log(`Readback: evidence.length=${ev1Verify.readData.evidence.length}, last.by=${ev1Verify.readData.evidence.at(-1).by}`);

  // -------------------------------------------------------------------------
  // 3. ADD_EVIDENCE (PARTY 2)
  // -------------------------------------------------------------------------
  console.log('\n--- [Step 3/6] executeAddEvidence (Party 2) ---');
  const ev2 =
    'Bob Dev explicitly admits in written correspondence: Alice Corp successfully completed all software deliverables on schedule and complied with specifications.';
  const ev2Tx = await executeAddEvidence(client2, caseId, ev2);
  const ev2ReceiptRes = await waitForReceiptWithProgress(client2, ev2Tx);
  const ev2LeaderExec = assertStrictSuccessReceipt(ev2ReceiptRes, 'add_evidence_party_2');

  const ev2Verify = await verifyPostWriteState('evidence', caseId, { minCount: 2 });
  assert.equal(ev2Verify.verified, true, `verifyPostWriteState('evidence' P2) failed: ${ev2Verify.message}`);
  console.log(`Tx Hash:  ${ev2Tx}`);
  console.log(`Status:   ${ev2ReceiptRes.receipt.status_name} (leader_receipt: ${JSON.stringify(ev2LeaderExec)})`);
  console.log(`Readback: evidence.length=${ev2Verify.readData.evidence.length}, last.by=${ev2Verify.readData.evidence.at(-1).by}`);

  // -------------------------------------------------------------------------
  // 4. JUDGE
  // -------------------------------------------------------------------------
  console.log('\n--- [Step 4/6] executeJudge ---');
  const judgeTx = await executeJudge(client1, caseId);
  const judgeReceiptRes = await waitForReceiptWithProgress(client1, judgeTx);
  const judgeLeaderExec = assertStrictSuccessReceipt(judgeReceiptRes, 'judge');

  const judgeVerify = await verifyPostWriteState('judge', caseId, { prevRoundsCount: 0 });
  assert.equal(judgeVerify.verified, true, `verifyPostWriteState('judge') failed: ${judgeVerify.message}`);
  const certRead = await fetchCertificate(caseId);
  assert.equal(certRead.ok, true);
  assert.ok(certRead.data);
  console.log(`Tx Hash:  ${judgeTx}`);
  console.log(`Status:   ${judgeReceiptRes.receipt.status_name} (leader_receipt: ${JSON.stringify(judgeLeaderExec)})`);
  console.log(`Readback: current_decision=${certRead.data.current_decision}, is_decided=${certRead.data.is_decided}, rounds=${certRead.data.rounds.length}`);

  // -------------------------------------------------------------------------
  // 5. FINALIZE
  // -------------------------------------------------------------------------
  console.log('\n--- [Step 5/6] executeFinalize ---');
  const finalizeTx = await executeFinalize(client1, caseId);
  const finalizeReceiptRes = await waitForReceiptWithProgress(client1, finalizeTx);
  const finalizeLeaderExec = assertStrictSuccessReceipt(finalizeReceiptRes, 'finalize');

  const finalizeVerify = await verifyPostWriteState('finalize', caseId);
  assert.equal(finalizeVerify.verified, true, `verifyPostWriteState('finalize') failed: ${finalizeVerify.message}`);
  assert.equal(finalizeVerify.readData.status, 'FINAL');
  console.log(`Tx Hash:  ${finalizeTx}`);
  console.log(`Status:   ${finalizeReceiptRes.receipt.status_name} (leader_receipt: ${JSON.stringify(finalizeLeaderExec)})`);
  console.log(`Readback: case.status=${finalizeVerify.readData.status}`);

  // -------------------------------------------------------------------------
  // 6. CONSUMER SETTLE_DISPUTE
  // -------------------------------------------------------------------------
  console.log('\n--- [Step 6/6] executeConsumerSettle ---');
  const settleTx = await executeConsumerSettle(client1, caseId);
  const settleReceiptRes = await waitForReceiptWithProgress(client1, settleTx);
  const settleLeaderExec = assertStrictSuccessReceipt(settleReceiptRes, 'settle_dispute');

  const settleVerify = await verifyPostWriteState('settle', caseId);
  assert.equal(settleVerify.verified, true, `verifyPostWriteState('settle') failed: ${settleVerify.message}`);
  const settlementRead = await fetchConsumerSettlement(caseId);
  assert.equal(settlementRead.ok, true);
  assert.equal(settlementRead.data, 'SETTLED_PARTY_1');
  console.log(`Tx Hash:  ${settleTx}`);
  console.log(`Status:   ${settleReceiptRes.receipt.status_name} (leader_receipt: ${JSON.stringify(settleLeaderExec)})`);
  console.log(`Readback: consumerSettlement=${settlementRead.data}`);

  // -------------------------------------------------------------------------
  // NEGATIVE CHECKS (3a, 3b, 3c)
  // -------------------------------------------------------------------------
  console.log('\n--- [Negative 3a-1] open_case with weight_bp = -1 ---');
  const badCriteriaNeg1 = JSON.stringify([
    { id: 'neg_weight', text: 'Negative weight criterion', weight_bp: -1 },
    { id: 'comp_weight', text: 'Compensating weight criterion', weight_bp: 10001 },
  ]);
  let neg1Record;
  try {
    const neg1Tx = await executeOpenCase(
      client1,
      `Invalid Weight -1 Test ${Date.now()}`,
      badCriteriaNeg1,
      'A',
      'B',
      party2Account.address
    );
    const neg1Res = await waitForReceiptWithProgress(client1, neg1Tx);
    assert.equal(neg1Res.success, false, 'open_case with weight_bp -1 must NOT succeed');
    const reason1 = extractRevertReason(neg1Res.receipt);
    assert.ok(reason1 && reason1.length > 0, 'extractRevertReason must return non-empty reason');
    const leaderExec1 = (neg1Res.receipt?.consensus_data?.leader_receipt || []).map((r) => r.execution_result);
    console.log(`Tx Hash:  ${neg1Tx}`);
    console.log(`Status:   ${neg1Res.receipt?.status_name} (leader_receipt: ${JSON.stringify(leaderExec1)})`);
    console.log(`Revert:   ${reason1}`);
    neg1Record = { passed: true, txHash: neg1Tx, status: neg1Res.receipt?.status_name, leaderExecution: leaderExec1, revertReason: reason1 };
  } catch (err) {
    console.log(`Rejected at RPC call: ${err.message}`);
    neg1Record = { passed: true, txHash: null, revertReason: err.message };
  }

  console.log('\n--- [Negative 3a-2] open_case with weight_bp = 10001 ---');
  const badCriteria10001 = JSON.stringify([
    { id: 'over_weight', text: 'Over max weight criterion', weight_bp: 10001 },
  ]);
  let neg2Record;
  try {
    const neg2Tx = await executeOpenCase(
      client1,
      `Invalid Weight 10001 Test ${Date.now()}`,
      badCriteria10001,
      'A',
      'B',
      party2Account.address
    );
    const neg2Res = await waitForReceiptWithProgress(client1, neg2Tx);
    assert.equal(neg2Res.success, false, 'open_case with weight_bp 10001 must NOT succeed');
    const reason2 = extractRevertReason(neg2Res.receipt);
    assert.ok(reason2 && reason2.length > 0, 'extractRevertReason must return non-empty reason');
    const leaderExec2 = (neg2Res.receipt?.consensus_data?.leader_receipt || []).map((r) => r.execution_result);
    console.log(`Tx Hash:  ${neg2Tx}`);
    console.log(`Status:   ${neg2Res.receipt?.status_name} (leader_receipt: ${JSON.stringify(leaderExec2)})`);
    console.log(`Revert:   ${reason2}`);
    neg2Record = { passed: true, txHash: neg2Tx, status: neg2Res.receipt?.status_name, leaderExecution: leaderExec2, revertReason: reason2 };
  } catch (err) {
    console.log(`Rejected at RPC call: ${err.message}`);
    neg2Record = { passed: true, txHash: null, revertReason: err.message };
  }

  console.log('\n--- [Negative 3b] fetchCase on random nonexistent caseId ---');
  const randomNonexistentId = `nonexist${Date.now().toString(16).slice(-4)}`;
  const nonExistentRes = await fetchCase(randomNonexistentId);
  assert.deepEqual(
    nonExistentRes,
    { ok: true, data: null },
    `Expected { ok: true, data: null } for nonexistent case, got ${JSON.stringify(nonExistentRes)}`
  );
  console.log(`Input:    ${randomNonexistentId}`);
  console.log(`Result:   ${JSON.stringify(nonExistentRes)}`);

  console.log('\n--- [Negative 3c] fetchCase with unreachable RPC URL (http://127.0.0.1:9) ---');
  const unreachableClient = createClient({
    chain: {
      id: 61999,
      name: 'Unreachable Studionet',
      rpcUrls: { default: { http: ['http://127.0.0.1:9'] } },
    },
  });
  const unreachableRes = await fetchCase('0551168cd4f5', unreachableClient);
  assert.equal(unreachableRes.ok, false, 'Unreachable RPC must return ok: false');
  assert.equal('data' in unreachableRes, false, 'Unreachable RPC result must NEVER contain data: null');
  console.log(`Result:   ${JSON.stringify(unreachableRes)}`);

  const totalDurationSec = ((Date.now() - overallStart) / 1000).toFixed(2);

  // Preserve existing reference metadata in scripts/fresh_e2e_evidence.json while recording the fresh run
  const evidencePath = path.resolve('./scripts/fresh_e2e_evidence.json');
  let existingData = {};
  if (fs.existsSync(evidencePath)) {
    try {
      existingData = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    } catch {
      existingData = {};
    }
  }

  const freshE2ERun = {
    executedAt: new Date().toISOString(),
    mirrorJudgeAddress: MIRROR_JUDGE_ADDRESS,
    consumerContractAddress: CONSUMER_CONTRACT_ADDRESS,
    caseId,
    title,
    party1: party1Account.address,
    party2: party2Account.address,
    steps: {
      open_case: {
        txHash: openTx,
        status: openReceiptRes.receipt.status_name,
        leaderExecution: openLeaderExec,
        durationSec: openReceiptRes.durationSec,
        verified: openVerify.verified,
        readback: {
          case_id: openVerify.readData.case_id,
          status: openVerify.readData.status,
          title: openVerify.readData.title,
        },
      },
      add_evidence_party_1: {
        txHash: ev1Tx,
        status: ev1ReceiptRes.receipt.status_name,
        leaderExecution: ev1LeaderExec,
        durationSec: ev1ReceiptRes.durationSec,
        verified: ev1Verify.verified,
        readback: {
          evidenceCount: ev1Verify.readData.evidence.length,
          lastEntryBy: ev1Verify.readData.evidence.at(-1).by,
        },
      },
      add_evidence_party_2: {
        txHash: ev2Tx,
        status: ev2ReceiptRes.receipt.status_name,
        leaderExecution: ev2LeaderExec,
        durationSec: ev2ReceiptRes.durationSec,
        verified: ev2Verify.verified,
        readback: {
          evidenceCount: ev2Verify.readData.evidence.length,
          lastEntryBy: ev2Verify.readData.evidence.at(-1).by,
        },
      },
      judge: {
        txHash: judgeTx,
        status: judgeReceiptRes.receipt.status_name,
        leaderExecution: judgeLeaderExec,
        durationSec: judgeReceiptRes.durationSec,
        verified: judgeVerify.verified,
        readback: certRead.data,
      },
      finalize: {
        txHash: finalizeTx,
        status: finalizeReceiptRes.receipt.status_name,
        leaderExecution: finalizeLeaderExec,
        durationSec: finalizeReceiptRes.durationSec,
        verified: finalizeVerify.verified,
        readback: {
          status: finalizeVerify.readData.status,
        },
      },
      consumer_settle_dispute: {
        txHash: settleTx,
        status: settleReceiptRes.receipt.status_name,
        leaderExecution: settleLeaderExec,
        durationSec: settleReceiptRes.durationSec,
        verified: settleVerify.verified,
        readback: {
          settlement: settlementRead.data,
        },
      },
    },
    negativeChecks: {
      weightMinus1: neg1Record,
      weight10001: neg2Record,
      nonexistentCase: {
        caseId: randomNonexistentId,
        result: nonExistentRes,
      },
      unreachableRpc: {
        rpcUrl: 'http://127.0.0.1:9',
        result: unreachableRes,
      },
    },
    totalDurationSec,
  };

  const updatedEvidence = {
    ...existingData,
    contractAddress: MIRROR_JUDGE_ADDRESS,
    consumerContractAddress: CONSUMER_CONTRACT_ADDRESS,
    freshE2ERun,
  };

  fs.writeFileSync(evidencePath, JSON.stringify(updatedEvidence, null, 2), 'utf8');
  console.log(`\n=== ALL POSITIVE & NEGATIVE E2E CHECKS PASSED IN ${totalDurationSec}s ===`);
  console.log('Saved fresh run results to scripts/fresh_e2e_evidence.json');
}

main().catch((err) => {
  console.error('\nE2E EXECUTION FAILED:', err);
  process.exit(1);
});
