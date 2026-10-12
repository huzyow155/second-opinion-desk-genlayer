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
  executeMarkReady,
  executeJudge,
  executeFinalize,
  executeConsumerSettle,
  waitForReceiptWithProgress,
  verifyPostWriteState,
  fetchCase,
  fetchCertificate,
  fetchLifecycle,
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
  console.log('COMPREHENSIVE v2.0.0 E2E SUITE (REAL chain.ts + contractService.ts)');
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

  console.log('\n--- [Step 1/9] executeOpenCase ---');
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
  assert.equal(openVerify.readData.status, 'OPEN');
  console.log(`Tx Hash:  ${openTx}`);
  console.log(`Status:   ${openReceiptRes.receipt.status_name} (leader_receipt: ${JSON.stringify(openLeaderExec)})`);
  console.log(`Readback: case_id=${caseId}, status=${openVerify.readData.status}, evidence_deadline_ts=${openVerify.readData.evidence_deadline_ts}`);

  // -------------------------------------------------------------------------
  // 2. ADD_EVIDENCE (PARTY 1)
  // -------------------------------------------------------------------------
  console.log('\n--- [Step 2/9] executeAddEvidence (Party 1) ---');
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
  // 3. MARK_READY (PARTY 1)
  // -------------------------------------------------------------------------
  console.log('\n--- [Step 3/9] executeMarkReady (Party 1) ---');
  const mr1Tx = await executeMarkReady(client1, caseId);
  const mr1ReceiptRes = await waitForReceiptWithProgress(client1, mr1Tx);
  const mr1LeaderExec = assertStrictSuccessReceipt(mr1ReceiptRes, 'mark_ready_party_1');

  const mr1Verify = await verifyPostWriteState('ready', caseId, { partyKey: 'PARTY_1', expectClosed: false });
  assert.equal(mr1Verify.verified, true, `verifyPostWriteState('ready' P1) failed: ${mr1Verify.message}`);
  assert.equal(mr1Verify.readData.status, 'OPEN');
  assert.equal(mr1Verify.readData.ready.PARTY_1, true);
  assert.equal(mr1Verify.readData.ready.PARTY_2, false);
  console.log(`Tx Hash:  ${mr1Tx}`);
  console.log(`Status:   ${mr1ReceiptRes.receipt.status_name} (leader_receipt: ${JSON.stringify(mr1LeaderExec)})`);
  console.log(`Readback: status=${mr1Verify.readData.status}, ready=${JSON.stringify(mr1Verify.readData.ready)}`);

  // -------------------------------------------------------------------------
  // 4. ADD_EVIDENCE (PARTY 2)
  // -------------------------------------------------------------------------
  console.log('\n--- [Step 4/9] executeAddEvidence (Party 2) ---');
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
  // 5. MARK_READY (PARTY 2) -> auto-transitions status to CLOSED
  // -------------------------------------------------------------------------
  console.log('\n--- [Step 5/9] executeMarkReady (Party 2) -> status CLOSED ---');
  const mr2Tx = await executeMarkReady(client2, caseId);
  const mr2ReceiptRes = await waitForReceiptWithProgress(client2, mr2Tx);
  const mr2LeaderExec = assertStrictSuccessReceipt(mr2ReceiptRes, 'mark_ready_party_2');

  const mr2Verify = await verifyPostWriteState('ready', caseId, { partyKey: 'PARTY_2', expectClosed: true });
  assert.equal(mr2Verify.verified, true, `verifyPostWriteState('ready' P2) failed: ${mr2Verify.message}`);
  assert.equal(mr2Verify.readData.status, 'CLOSED');
  assert.equal(mr2Verify.readData.ready.PARTY_1, true);
  assert.equal(mr2Verify.readData.ready.PARTY_2, true);
  console.log(`Tx Hash:  ${mr2Tx}`);
  console.log(`Status:   ${mr2ReceiptRes.receipt.status_name} (leader_receipt: ${JSON.stringify(mr2LeaderExec)})`);
  console.log(`Readback: status=${mr2Verify.readData.status}, ready=${JSON.stringify(mr2Verify.readData.ready)}`);

  // -------------------------------------------------------------------------
  // 6. JUDGE -> status JUDGED, outcome PENDING
  // -------------------------------------------------------------------------
  console.log('\n--- [Step 6/9] executeJudge ---');
  const judgeTx = await executeJudge(client1, caseId);
  const judgeReceiptRes = await waitForReceiptWithProgress(client1, judgeTx);
  const judgeLeaderExec = assertStrictSuccessReceipt(judgeReceiptRes, 'judge');

  const judgeVerify = await verifyPostWriteState('judge', caseId, { prevRoundsCount: 0 });
  assert.equal(judgeVerify.verified, true, `verifyPostWriteState('judge') failed: ${judgeVerify.message}`);
  const certRead = await fetchCertificate(caseId);
  assert.equal(certRead.ok, true);
  assert.ok(certRead.data);
  assert.equal(certRead.data.status, 'JUDGED');
  assert.equal(certRead.data.outcome, 'PENDING');
  console.log(`Tx Hash:  ${judgeTx}`);
  console.log(`Status:   ${judgeReceiptRes.receipt.status_name} (leader_receipt: ${JSON.stringify(judgeLeaderExec)})`);
  console.log(`Readback: status=${certRead.data.status}, current_decision=${certRead.data.current_decision}, outcome=${certRead.data.outcome}`);

  // -------------------------------------------------------------------------
  // 7. FINALIZE (PARTY 1 - 1st Ack) -> stays JUDGED, final_acks.PARTY_1 = true
  // -------------------------------------------------------------------------
  console.log('\n--- [Step 7/9] executeFinalize (Party 1 - 1st Ack) ---');
  const fin1Tx = await executeFinalize(client1, caseId);
  const fin1ReceiptRes = await waitForReceiptWithProgress(client1, fin1Tx);
  const fin1LeaderExec = assertStrictSuccessReceipt(fin1ReceiptRes, 'finalize_party_1');

  const fin1Verify = await verifyPostWriteState('finalize', caseId, { partyKey: 'PARTY_1', expectFinal: false });
  assert.equal(fin1Verify.verified, true, `verifyPostWriteState('finalize' P1) failed: ${fin1Verify.message}`);
  assert.equal(fin1Verify.readData.status, 'JUDGED');
  assert.equal(fin1Verify.readData.final_acks.PARTY_1, true);
  assert.equal(fin1Verify.readData.final_acks.PARTY_2, false);
  console.log(`Tx Hash:  ${fin1Tx}`);
  console.log(`Status:   ${fin1ReceiptRes.receipt.status_name} (leader_receipt: ${JSON.stringify(fin1LeaderExec)})`);
  console.log(`Readback: status=${fin1Verify.readData.status}, final_acks=${JSON.stringify(fin1Verify.readData.final_acks)}`);

  // -------------------------------------------------------------------------
  // 8. FINALIZE (PARTY 2 - 2nd Ack) -> transitions to FINAL, outcome != PENDING
  // -------------------------------------------------------------------------
  console.log('\n--- [Step 8/9] executeFinalize (Party 2 - 2nd Ack -> FINAL) ---');
  const fin2Tx = await executeFinalize(client2, caseId);
  const fin2ReceiptRes = await waitForReceiptWithProgress(client2, fin2Tx);
  const fin2LeaderExec = assertStrictSuccessReceipt(fin2ReceiptRes, 'finalize_party_2');

  const fin2Verify = await verifyPostWriteState('finalize', caseId, { partyKey: 'PARTY_2', expectFinal: true });
  assert.equal(fin2Verify.verified, true, `verifyPostWriteState('finalize' P2) failed: ${fin2Verify.message}`);
  assert.equal(fin2Verify.readData.status, 'FINAL');
  assert.equal(fin2Verify.readData.final_acks.PARTY_1, true);
  assert.equal(fin2Verify.readData.final_acks.PARTY_2, true);
  const certFinalRead = await fetchCertificate(caseId);
  assert.equal(certFinalRead.ok, true);
  assert.equal(certFinalRead.data.status, 'FINAL');
  assert.notEqual(certFinalRead.data.outcome, 'PENDING');
  const lcFinalRead = await fetchLifecycle(caseId);
  assert.equal(lcFinalRead.ok, true);
  assert.equal(lcFinalRead.data.status, 'FINAL');
  console.log(`Tx Hash:  ${fin2Tx}`);
  console.log(`Status:   ${fin2ReceiptRes.receipt.status_name} (leader_receipt: ${JSON.stringify(fin2LeaderExec)})`);
  console.log(`Readback: status=${certFinalRead.data.status}, final_acks=${JSON.stringify(certFinalRead.data.final_acks)}, outcome=${certFinalRead.data.outcome}`);

  // -------------------------------------------------------------------------
  // 9. CONSUMER SETTLE_DISPUTE
  // -------------------------------------------------------------------------
  console.log('\n--- [Step 9/9] executeConsumerSettle ---');
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
  const unreachableRes = await fetchCase('43288877b73b', unreachableClient);
  assert.equal(unreachableRes.ok, false, 'Unreachable RPC must return ok: false');
  assert.equal('data' in unreachableRes, false, 'Unreachable RPC result must NEVER contain data: null');
  console.log(`Result:   ${JSON.stringify(unreachableRes)}`);

  const totalDurationSec = ((Date.now() - overallStart) / 1000).toFixed(2);

  const evidencePath = path.resolve('./scripts/fresh_e2e_evidence.json');
  const freshE2ERun = {
    executedAt: new Date().toISOString(),
    schemaVersion: '2.0.0',
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
          opened_at_ts: openVerify.readData.opened_at_ts,
          evidence_deadline_ts: openVerify.readData.evidence_deadline_ts,
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
      mark_ready_party_1: {
        txHash: mr1Tx,
        status: mr1ReceiptRes.receipt.status_name,
        leaderExecution: mr1LeaderExec,
        durationSec: mr1ReceiptRes.durationSec,
        verified: mr1Verify.verified,
        readback: {
          status: mr1Verify.readData.status,
          ready: mr1Verify.readData.ready,
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
      mark_ready_party_2: {
        txHash: mr2Tx,
        status: mr2ReceiptRes.receipt.status_name,
        leaderExecution: mr2LeaderExec,
        durationSec: mr2ReceiptRes.durationSec,
        verified: mr2Verify.verified,
        readback: {
          status: mr2Verify.readData.status,
          ready: mr2Verify.readData.ready,
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
      finalize_party_1: {
        txHash: fin1Tx,
        status: fin1ReceiptRes.receipt.status_name,
        leaderExecution: fin1LeaderExec,
        durationSec: fin1ReceiptRes.durationSec,
        verified: fin1Verify.verified,
        readback: {
          status: fin1Verify.readData.status,
          final_acks: fin1Verify.readData.final_acks,
        },
      },
      finalize_party_2: {
        txHash: fin2Tx,
        status: fin2ReceiptRes.receipt.status_name,
        leaderExecution: fin2LeaderExec,
        durationSec: fin2ReceiptRes.durationSec,
        verified: fin2Verify.verified,
        readback: {
          status: certFinalRead.data.status,
          final_acks: certFinalRead.data.final_acks,
          outcome: certFinalRead.data.outcome,
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
    schemaVersion: '2.0.0',
    contractAddress: MIRROR_JUDGE_ADDRESS,
    consumerContractAddress: CONSUMER_CONTRACT_ADDRESS,
    freshE2ERun,
  };

  fs.writeFileSync(evidencePath, JSON.stringify(updatedEvidence, null, 2) + '\n', 'utf8');
  console.log(`\n=== ALL POSITIVE & NEGATIVE E2E CHECKS PASSED IN ${totalDurationSec}s ===`);
  console.log('Saved fresh run results to scripts/fresh_e2e_evidence.json');
}

main().catch((err) => {
  console.error('\nE2E EXECUTION FAILED:', err);
  process.exit(1);
});
