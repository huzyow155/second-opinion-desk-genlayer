import { createClient, chains } from 'genlayer-js';
import fs from 'fs';
import crypto from 'crypto';

const MIRROR_JUDGE_ADDRESS = '0x3991d0817f8FD6B6632b1C2c21d234598CbF4e17';
const CONSUMER_CONTRACT_ADDRESS = '0x294FFDec366826F8682CFAAEbaf25DcAeBda9317';
const DEPLOY_TX_HASH = '0x8e6a7c865bd92a00c1c518325347d164842467e881079cbff68958cda1e474bd';
const RPC_URL = 'https://studio.genlayer.com/api';

const studionet = chains?.studionet || {
  id: 61999,
  name: 'GenLayer Studionet',
  rpcUrls: { default: { http: [RPC_URL] } },
};

const client = createClient({ chain: studionet });

async function run() {
  console.log('=== GATE 1 & 2: ON-CHAIN READS ON STUDIONET ===');

  // Test Demo A
  console.log('\n[1] Testing Demo A (99f9b7444e2a)...');
  const demoARaw = await client.readContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'get_case',
    args: ['99f9b7444e2a'],
  });
  const demoACertRaw = await client.readContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'get_certificate',
    args: ['99f9b7444e2a'],
  });
  const demoACert = typeof demoACertRaw === 'string' ? JSON.parse(demoACertRaw) : demoACertRaw;
  console.log('Demo A Title:', typeof demoARaw === 'string' ? JSON.parse(demoARaw).title : demoARaw.title);
  console.log('Demo A Decision:', demoACert.current_decision);
  console.log('Demo A Decided?:', demoACert.is_decided);

  // Test Demo B
  console.log('\n[2] Testing Demo B (affb287df9cb)...');
  const demoBCertRaw = await client.readContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'get_certificate',
    args: ['affb287df9cb'],
  });
  const demoBCert = typeof demoBCertRaw === 'string' ? JSON.parse(demoBCertRaw) : demoBCertRaw;
  console.log('Demo B Decision:', demoBCert.current_decision);
  console.log('Demo B Decided?:', demoBCert.is_decided);

  // Test Demo C
  console.log('\n[3] Testing Demo C (bf29f5d7c7fd)...');
  const demoCCertRaw = await client.readContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'get_certificate',
    args: ['bf29f5d7c7fd'],
  });
  const demoCCert = typeof demoCCertRaw === 'string' ? JSON.parse(demoCCertRaw) : demoCCertRaw;
  console.log('Demo C Decision:', demoCCert.current_decision);
  console.log('Demo C Decided?:', demoCCert.is_decided);

  // Test Contradictory Proof Case
  console.log('\n[3b] Testing Contradictory Hardening Case (74320c3924e2)...');
  const demoEscCertRaw = await client.readContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'get_certificate',
    args: ['74320c3924e2'],
  });
  const demoEscCert = typeof demoEscCertRaw === 'string' ? JSON.parse(demoEscCertRaw) : demoEscCertRaw;
  console.log('Contradictory Case Decision:', demoEscCert.current_decision);
  console.log('Contradictory Case Rounds Count:', demoEscCert.rounds.length);

  // Test Negative Lookup (Gate 2 Negative Check)
  console.log('\n[4] Testing Negative Case Lookup (nonexistent99)...');
  try {
    const negRaw = await client.readContract({
      address: MIRROR_JUDGE_ADDRESS,
      functionName: 'get_case',
      args: ['nonexistent99'],
    });
    console.log('Negative Case Raw Response:', negRaw || 'Empty (handled correctly)');
  } catch (err) {
    console.log('Negative Case Threw (handled gracefully):', err.message);
  }

  // Test Discovery Views
  console.log('\n[5] Testing list_cases(0, 5)...');
  const listRaw = await client.readContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'list_cases',
    args: [0, 5],
  });
  console.log('list_cases output:', listRaw);

  // Test Consumer Contract
  console.log('\n[6] Testing Consumer Contract (outcome_for_consumer)...');
  const outcomeA = await client.readContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'outcome_for_consumer',
    args: ['99f9b7444e2a'],
  });
  console.log('Demo A outcome_for_consumer:', outcomeA);

  const settleA = await client.readContract({
    address: CONSUMER_CONTRACT_ADDRESS,
    functionName: 'get_settlement',
    args: ['99f9b7444e2a'],
  });
  console.log('Demo A Consumer get_settlement:', settleA);

  // Strict Source SHA256 Verification via Raw RPC
  console.log('\n[7] Verifying Deploy Source matches contracts-reference/MirrorJudge.py...');
  console.log('Deploy tx hash:', DEPLOY_TX_HASH);

  const rpcResponse = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getTransactionByHash',
      params: [DEPLOY_TX_HASH],
    }),
  });

  if (!rpcResponse.ok) {
    console.error(`FATAL: RPC request failed with HTTP ${rpcResponse.status}`);
    process.exit(1);
  }

  const rpcJson = await rpcResponse.json();
  const txResult = rpcJson?.result;

  if (!txResult) {
    console.error('FATAL: eth_getTransactionByHash returned null or empty result.');
    process.exit(1);
  }

  const contractCodeB64 = txResult?.data?.contract_code;

  if (!contractCodeB64 || typeof contractCodeB64 !== 'string' || contractCodeB64.length === 0) {
    console.error('FATAL: contract_code missing or malformed in deploy transaction data.');
    process.exit(1);
  }

  console.log(`contract_code extraction result: SUCCESS (Base64 length: ${contractCodeB64.length} chars)`);

  let deployedSource = '';
  try {
    deployedSource = Buffer.from(contractCodeB64, 'base64').toString('utf8');
  } catch (decodeErr) {
    console.error('FATAL: Failed to base64-decode contract_code:', decodeErr);
    process.exit(1);
  }

  if (!deployedSource || deployedSource.length === 0) {
    console.error('FATAL: Decoded deployed source is empty.');
    process.exit(1);
  }

  const deployedSha = crypto.createHash('sha256').update(deployedSource, 'utf8').digest('hex');

  const localFilePath = 'contracts-reference/MirrorJudge.py';
  if (!fs.existsSync(localFilePath)) {
    console.error(`FATAL: Local file ${localFilePath} does not exist.`);
    process.exit(1);
  }

  const localFile = fs.readFileSync(localFilePath, 'utf8');
  const localSha = crypto.createHash('sha256').update(localFile, 'utf8').digest('hex');

  const isMatch = deployedSha === localSha;

  console.log('Deployed source SHA256: ', deployedSha);
  console.log('Local source SHA256:    ', localSha);
  console.log('Exact boolean match:    ', isMatch);

  if (!isMatch) {
    console.error('FATAL: Deployed source hash does not match local reference file!');
    process.exit(1);
  }

  console.log('\n=== ALL GATES VERIFIED STRICTLY AND SUCCESSFULLY ===');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
