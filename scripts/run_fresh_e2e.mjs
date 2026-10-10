import { createClient, chains, createAccount } from 'genlayer-js';
import fs from 'fs';

const MIRROR_JUDGE_ADDRESS = '0x1343C51732FD1002986Ed3f0Bb9D5C2105A6635D';
const RPC_URL = 'https://studio.genlayer.com/api';

const studionet = chains?.studionet || {
  id: 61999,
  name: 'GenLayer Studionet',
  rpcUrls: { default: { http: [RPC_URL] } },
};

async function waitForStrictReceipt(client, txHash, label) {
  const start = Date.now();
  console.log(`Waiting for receipt of ${label} (${txHash})...`);
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      const res = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: attempt + 1,
          method: "eth_getTransactionByHash",
          params: [txHash],
        }),
      });
      const text = await res.text();
      if (text.startsWith("{")) {
        const json = JSON.parse(text);
        const receipt = json.result;
        if (receipt && (receipt.status === "FINALIZED" || receipt.status_name === "ACCEPTED" || receipt.status === 2 || receipt.status === "ACCEPTED")) {
          const elapsedSec = ((Date.now() - start) / 1000).toFixed(2);
          const statusName = receipt.status_name || (receipt.status === "FINALIZED" ? "ACCEPTED" : String(receipt.status));
          const leaderReceipt = receipt.consensus_data?.leader_receipt?.[0];
          const executionResult = leaderReceipt?.execution_result || receipt.result_name || "UNKNOWN";
          console.log(`[${label}] Status: ${statusName}, Leader Execution: ${executionResult}, Elapsed: ${elapsedSec}s`);
          if (statusName !== 'ACCEPTED') {
            throw new Error(`[${label}] Failed: status_name is ${statusName}, expected ACCEPTED`);
          }
          if (executionResult !== 'SUCCESS') {
            throw new Error(`[${label}] Failed: execution_result is ${executionResult}, expected SUCCESS`);
          }
          return { receipt, elapsedSec, statusName, executionResult };
        }
      }
    } catch (err) {
      if (err.message.includes('expected ACCEPTED') || err.message.includes('expected SUCCESS')) {
        throw err;
      }
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Timed out waiting for receipt of ${label}: ${txHash}`);
}

async function main() {
  console.log('====================================================');
  console.log('FRESH E2E DISPUTE WORKFLOW ON GENLAYER STUDIONET');
  console.log('Contract:', MIRROR_JUDGE_ADDRESS);
  console.log('====================================================\n');

  const overallStart = Date.now();

  // 1. Setup Party 1 and Party 2 accounts
  const party1Account = createAccount();
  const party2Account = createAccount();

  console.log('Party 1 (Opener):', party1Account.address);
  console.log('Party 2 (Opposing):', party2Account.address);

  const client1 = createClient({
    chain: studionet,
    account: party1Account,
  });

  const client2 = createClient({
    chain: studionet,
    account: party2Account,
  });

  // 2. Open Case
  const title = `E2E Milestone Acceptance Verification ${Date.now().toString().slice(-4)}`;
  const criteria = [
    {
      id: 'milestone_deliverable',
      text: 'Which party substantiated full delivery of agreed software milestone deliverables: PARTY_1 or PARTY_2?',
      weight_bp: 6000,
    },
    {
      id: 'spec_compliance',
      text: 'Which party adhered to technical specifications and contract requirements: PARTY_1 or PARTY_2?',
      weight_bp: 4000,
    },
  ];
  const criteriaJson = JSON.stringify(criteria);
  const aliases1 = 'Contractor Alpha, Lead Dev';
  const aliases2 = 'Client Beta, Project Sponsor';

  console.log('\n--- Step 1: Open Dispute Case ---');
  const openTx = await client1.writeContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'open_case',
    args: [title, criteriaJson, aliases1, aliases2, party2Account.address],
  });
  console.log('Open Case Tx Hash:', openTx);
  const openRes = await waitForStrictReceipt(client1, openTx, 'open_case');

  // 3. Discover Case ID via contract discovery view (NO client-side hashing!)
  console.log('\n--- Step 2: Discover Case ID via get_latest_case_for_pair ---');
  const discoveredCaseIdRaw = await client1.readContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'get_latest_case_for_pair',
    args: [party1Account.address, party2Account.address],
  });
  const caseId = String(discoveredCaseIdRaw).replace(/^"|"$/g, '').trim();
  console.log('Discovered On-Chain Case ID:', caseId);
  if (!caseId || caseId.length !== 12) {
    throw new Error(`Invalid discovered case ID: ${caseId}`);
  }

  // 4. Submit Party 1 Evidence
  console.log('\n--- Step 3: Submit Party 1 Evidence ---');
  const ev1 = 'Contractor Alpha completed and verified all milestone 1 software deliverables, submitted full audit test suites with 100% pass rates, and delivered production artifacts on schedule.';
  const ev1Tx = await client1.writeContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'add_evidence',
    args: [caseId, ev1],
  });
  console.log('Party 1 Evidence Tx Hash:', ev1Tx);
  const ev1Res = await waitForStrictReceipt(client1, ev1Tx, 'add_evidence_party_1');

  // 5. Submit Party 2 Evidence (Switch Wallet to Client 2)
  console.log('\n--- Step 4: Submit Party 2 Evidence (Switched to Party 2) ---');
  const ev2 = 'Client Beta acknowledges receipt of milestone artifacts and agrees in correspondence that specifications were satisfied without critical defects.';
  const ev2Tx = await client2.writeContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'add_evidence',
    args: [caseId, ev2],
  });
  console.log('Party 2 Evidence Tx Hash:', ev2Tx);
  const ev2Res = await waitForStrictReceipt(client2, ev2Tx, 'add_evidence_party_2');

  // 6. Trigger Judge
  console.log('\n--- Step 5: Execute judge() Adjudication ---');
  const judgeStart = Date.now();
  const judgeTx = await client1.writeContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'judge',
    args: [caseId],
  });
  console.log('Judge Tx Hash:', judgeTx);
  const judgeRes = await waitForStrictReceipt(client1, judgeTx, 'judge');
  const judgeLatencySec = ((Date.now() - judgeStart) / 1000).toFixed(2);
  console.log(`Judge consensus concluded in ${judgeLatencySec}s`);

  // 7. Read Authoritative State Back
  console.log('\n--- Step 6: Read-Back Authoritative Certificate ---');
  const certRaw = await client1.readContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'get_certificate',
    args: [caseId],
  });
  const cert = typeof certRaw === 'string' ? JSON.parse(certRaw) : certRaw;
  console.log('Certificate Decision:', cert.current_decision);
  console.log('Certificate Decided?:', cert.is_decided);
  console.log('Rounds Recorded:', cert.rounds?.length);

  const outcomeRaw = await client1.readContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'outcome_for_consumer',
    args: [caseId],
  });
  const consumerOutcome = String(outcomeRaw).replace(/^"|"$/g, '').trim();
  console.log('Outcome for Consumer:', consumerOutcome);

  const totalDurationSec = ((Date.now() - overallStart) / 1000).toFixed(2);

  const resultData = {
    caseId,
    title,
    party1: party1Account.address,
    party2: party2Account.address,
    openTx: {
      hash: openTx,
      status: openRes.statusName,
      leaderExecution: openRes.executionResult,
      elapsedSec: openRes.elapsedSec,
    },
    ev1Tx: {
      hash: ev1Tx,
      status: ev1Res.statusName,
      leaderExecution: ev1Res.executionResult,
      elapsedSec: ev1Res.elapsedSec,
    },
    ev2Tx: {
      hash: ev2Tx,
      status: ev2Res.statusName,
      leaderExecution: ev2Res.executionResult,
      elapsedSec: ev2Res.elapsedSec,
    },
    judgeTx: {
      hash: judgeTx,
      status: judgeRes.statusName,
      leaderExecution: judgeRes.executionResult,
      latencySec: judgeLatencySec,
    },
    totalDurationSec,
    certificate: cert,
    consumerOutcome,
  };

  fs.writeFileSync('scripts/fresh_e2e_evidence.json', JSON.stringify(resultData, null, 2));
  console.log('\n=== FRESH E2E COMPLETE AND RECORDED TO scripts/fresh_e2e_evidence.json ===');
}

main().catch((err) => {
  console.error('\nE2E EXECUTION FAILED:', err);
  process.exit(1);
});
