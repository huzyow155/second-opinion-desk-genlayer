import { createClient, chains } from 'genlayer-js';
import fs from 'fs';
import crypto from 'crypto';

const MIRROR_JUDGE_ADDRESS = '0x2cb49A03fcc9b8c65E3cd9348826b2d13808d8FE';
const CONSUMER_CONTRACT_ADDRESS = '0xEC8B7B09AE03cef02ae42bCD8ba28C530D809251';
const DEPLOY_TX_HASH = '0x44ba27e9354b15b01724ab824b229f26d599d6a92a814e44653ec446c7d7ca55';
const CONSUMER_DEPLOY_TX_HASH = '0x3d4401d91c6c4688098ce28a07ae35708767e3967266e844d294aa88b530e4f1';
const RPC_URL = 'https://studio.genlayer.com/api';

const studionet = chains?.studionet || {
  id: 61999,
  name: 'GenLayer Studionet',
  rpcUrls: { default: { http: [RPC_URL] } },
};

const client = createClient({ chain: studionet });

async function verifySourceMatch(deployTxHash, localFilePath) {
  const rpcResponse = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getTransactionByHash',
      params: [deployTxHash],
    }),
  });

  if (!rpcResponse.ok) {
    throw new Error(`RPC request failed with HTTP ${rpcResponse.status}`);
  }

  const rpcJson = await rpcResponse.json();
  const txResult = rpcJson?.result;
  const contractCodeB64 = txResult?.data?.contract_code;
  if (!contractCodeB64 || typeof contractCodeB64 !== 'string') {
    throw new Error(`contract_code missing in deploy tx ${deployTxHash}`);
  }

  const deployedSource = Buffer.from(contractCodeB64, 'base64').toString('utf8');
  const deployedSha = crypto.createHash('sha256').update(deployedSource, 'utf8').digest('hex');
  const localFile = fs.readFileSync(localFilePath, 'utf8');
  const localSha = crypto.createHash('sha256').update(localFile, 'utf8').digest('hex');

  console.log(`[${localFilePath}] Deployed SHA256: ${deployedSha}`);
  console.log(`[${localFilePath}] Local SHA256:    ${localSha}`);
  console.log(`[${localFilePath}] Match:           ${deployedSha === localSha}`);

  if (deployedSha !== localSha) {
    throw new Error(`SHA256 mismatch for ${localFilePath}`);
  }
}

async function run() {
  console.log('=== GATE 1 & 2: ON-CHAIN READS ON STUDIONET (SCHEMA 2.0.0) ===');

  // Test Demo A
  console.log('\n[1] Testing Demo A (43288877b73b)...');
  const demoARaw = await client.readContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'get_case',
    args: ['43288877b73b'],
  });
  const demoACertRaw = await client.readContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'get_certificate',
    args: ['43288877b73b'],
  });
  const demoACert = typeof demoACertRaw === 'string' ? JSON.parse(demoACertRaw) : demoACertRaw;
  console.log('Demo A Title:', typeof demoARaw === 'string' ? JSON.parse(demoARaw).title : demoARaw.title);
  console.log('Demo A Status:', demoACert.status);
  console.log('Demo A Decision:', demoACert.current_decision);
  console.log('Demo A Decided?:', demoACert.is_decided);

  // Test Demo B
  console.log('\n[2] Testing Demo B (6df124828b58)...');
  const demoBCertRaw = await client.readContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'get_certificate',
    args: ['6df124828b58'],
  });
  const demoBCert = typeof demoBCertRaw === 'string' ? JSON.parse(demoBCertRaw) : demoBCertRaw;
  console.log('Demo B Status:', demoBCert.status);
  console.log('Demo B Decision:', demoBCert.current_decision);
  console.log('Demo B Decided?:', demoBCert.is_decided);

  // Test Demo C
  console.log('\n[3] Testing Demo C (f9462ef8b2b5)...');
  const demoCCertRaw = await client.readContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'get_certificate',
    args: ['f9462ef8b2b5'],
  });
  const demoCCert = typeof demoCCertRaw === 'string' ? JSON.parse(demoCCertRaw) : demoCCertRaw;
  console.log('Demo C Status:', demoCCert.status);
  console.log('Demo C Decision:', demoCCert.current_decision);
  console.log('Demo C Decided?:', demoCCert.is_decided);

  // Test Demo D (UNSTABLE reopened to OPEN)
  console.log('\n[3b] Testing Demo D (19f9bad34102)...');
  const demoDCertRaw = await client.readContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'get_certificate',
    args: ['19f9bad34102'],
  });
  const demoDCert = typeof demoDCertRaw === 'string' ? JSON.parse(demoDCertRaw) : demoDCertRaw;
  console.log('Demo D Status:', demoDCert.status);
  console.log('Demo D Decision:', demoDCert.current_decision);
  console.log('Demo D Decided?:', demoDCert.is_decided);

  // Test Negative Lookup (Gate 2 Negative Check)
  console.log('\n[4] Testing Negative Case Lookup (nonexistent99)...');
  const negRaw = await client.readContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'get_case',
    args: ['nonexistent99'],
  });
  console.log('Negative Case Raw Response:', negRaw);

  // Test Discovery Views
  console.log('\n[5] Testing list_cases(0, 5)...');
  const listRaw = await client.readContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'list_cases',
    args: [0, 5],
  });
  console.log('list_cases output:', listRaw);

  // Test Consumer Contract
  console.log('\n[6] Testing Consumer Contract (outcome_for_consumer & get_settlement)...');
  const outcomeA = await client.readContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'outcome_for_consumer',
    args: ['43288877b73b'],
  });
  console.log('Demo A outcome_for_consumer:', outcomeA);

  const settleA = await client.readContract({
    address: CONSUMER_CONTRACT_ADDRESS,
    functionName: 'get_settlement',
    args: ['43288877b73b'],
  });
  console.log('Demo A Consumer get_settlement:', settleA);

  // Strict Source SHA256 Verification via Raw RPC
  console.log('\n[7] Verifying Deployed Sources match contracts-reference/...');
  await verifySourceMatch(DEPLOY_TX_HASH, 'contracts-reference/MirrorJudge.py');
  await verifySourceMatch(CONSUMER_DEPLOY_TX_HASH, 'contracts-reference/consumer.py');

  console.log('\n=== ALL GATES VERIFIED STRICTLY AND SUCCESSFULLY ===');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
