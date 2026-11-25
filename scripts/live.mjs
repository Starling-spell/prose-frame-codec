import assert from 'node:assert/strict';
import fs from 'node:fs';
import {abi, createAccount, createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {digest, sha, jsonSafe, rpc, receipt, source, read, denied} from './check.mjs';

const journal = 'PROOFS.json';
const code = 'contracts/ProseFrameCodec.py';
const verifyOnly = process.argv.includes('--verify-only');
const proof = fs.existsSync(journal)
  ? JSON.parse(fs.readFileSync(journal, 'utf8'))
  : {network: 'StudioNet', source_commit: process.env.SOURCE_COMMIT ?? process.env.GITHUB_SHA ?? null,
    transactions: [], formats: {}};
const save = () => fs.writeFileSync(journal, JSON.stringify(proof, null, 2) + '\n');
assert.match(proof.source_commit ?? '', /^[a-f0-9]{40}$/);
assert.equal(await rpc('eth_chainId', []), '0xf22f');
assert.equal(studionet.id, 61999);

// Persist acknowledged sends before an SDK error or process interruption.
const originalFetch = globalThis.fetch;
const sent = new Map();
let currentEntry;
globalThis.fetch = async (input, options) => {
  const url = String(input);
  const request = JSON.parse(options?.body ?? '{}');
  if (url !== 'https://studio.genlayer.com/api' || request.method !== 'eth_sendRawTransaction') {
    return originalFetch(input, options);
  }
  assert(currentEntry && !currentEntry.hash, 'Inspect the journal before another send');
  const payload = request.params[0];
  assert.match(payload, /^0x[a-f0-9]+$/i);
  if (!sent.has(payload)) {
    sent.set(payload, (async () => {
      const response = await originalFetch(input, options);
      const body = await response.text();
      const data = JSON.parse(body);
      if (data.result) {
        assert.match(data.result, /^0x[a-f0-9]{64}$/i);
        currentEntry.hash = data.result;
        save();
        console.log(currentEntry.step, data.result);
      }
      return {body, status: response.status};
    })());
  }
  const response = await sent.get(payload);
  return new Response(response.body, {status: response.status, headers: {'content-type': 'application/json'}});
};

async function transaction(step, account, functionName, args, error) {
  let entry = proof.transactions.find(tx => tx.step === step);
  if (!entry) {
    assert(!verifyOnly && account, 'Missing broadcast journal');
    const nonce = await rpc('eth_getTransactionCount', [account.address, 'latest']);
    assert.equal(await rpc('eth_getTransactionCount', [account.address, 'pending']), nonce);
    const {defaultFees: fees} = await rpc('sim_getFeeConfig', []);
    assert(fees?.distribution);
    const feeValue = BigInt(fees.feeValue);
    assert(feeValue >= 0n && feeValue <= 1_000_000_000_000_000n, 'Studio quote exceeds demo budget');
    assert(BigInt(await rpc('eth_getBalance', [account.address, 'latest'])) >= feeValue);
    entry = {step, signer: account.address, nonce, functionName, args, fee_wei: String(feeValue),
      ...(error ? {error} : {})};
    proof.transactions.push(entry);
    save();
    currentEntry = entry;
    const client = createClient({chain: studionet, account});
    const hash = functionName === 'deploy'
      ? await client.deployContract({code: fs.readFileSync(code), args: [], fees, leaderOnly: false})
      : await client.writeContract({
        address: proof.address, functionName, args, value: 0n, fees, leaderOnly: false,
      });
    assert.equal(hash, entry.hash);
    currentEntry = undefined;
  }
  assert.deepEqual(entry.args, args);
  assert.equal(entry.functionName, functionName);
  assert.equal(entry.error, error);
  assert(entry.hash, 'Broadcast status unknown. Inspect the recorded nonce before resuming.');
  entry.receipt = await receipt(entry.hash, error ? 'ERROR' : 'SUCCESS', error, entry.consensus ?? 'MAJORITY_AGREE');
  save();
  assert.equal(entry.receipt.committed, !error);
  const native = await rpc('eth_getTransactionByHash', [entry.hash]);
  assert.equal(native.from_address.toLowerCase(), entry.signer.toLowerCase());
  assert.equal(BigInt(native.nonce), BigInt(entry.nonce));
  assert.equal(BigInt(native.value), 0n);
  const envelope = await rpc('eth_getTransactionReceipt', [entry.hash]);
  assert.equal(envelope.status, '0x1');
  assert.equal(envelope.from.toLowerCase(), entry.signer.toLowerCase());
  console.log(step, entry.receipt.status, entry.receipt.execution);
  if (error) return;
  if (functionName === 'deploy') return {address: entry.receipt.address};
  const leader = native.consensus_data.leader_receipt.find(item => item.mode === 'leader');
  const bytes = Buffer.from(leader.result, 'base64');
  assert.equal(bytes[0], 0);
  return {address: entry.receipt.address, result: jsonSafe(abi.calldata.decode(bytes.subarray(1)))};
}

async function checkFormat(account, kind, delta) {
  const body = fs.readFileSync('fixtures/' + kind + '.txt');
  const coordinate = 'Starling-spell/prose-frame-codec/' + proof.source_commit + '/fixtures/' + kind + '.txt';
  const sha256 = sha(body);
  const url = 'https://raw.githubusercontent.com/' + coordinate;
  const {result: key} = await transaction(kind, account, 'compile_format', [coordinate, sha256]);
  assert.equal(key, digest({url, sha256}));
  const record = await read(proof.address, 'get_format', [key]);
  proof.formats[kind] = {key, record};
  save();
  assert.deepEqual(record, {
    url, sha256, text: body.toString('utf8'),
    layout: {status: 'READY', length_bytes: 2, fields: [
      {name: 'sync', width: 3, kind: 'constant', value: 5, offset: 0},
      {name: 'delta', width: 5, kind, value: null, offset: 3},
      {name: 'reading', width: 6, kind: 'unsigned', value: null, offset: 8},
      {name: 'trailer', width: 2, kind: 'constant', value: 2, offset: 14},
    ]},
  });
  const decoded = await read(proof.address, 'decode', [key, 'bd96']);
  assert.deepEqual(decoded, {delta, reading: 37});
  const encoded = await read(proof.address, 'encode', [key, JSON.stringify(decoded)]);
  assert.equal(encoded, 'bd96');
  const invalidTrailer = await denied(proof.address, 'decode', [key, 'bd97']);
  assert(invalidTrailer);
  proof.formats[kind].readbacks = {decoded, encoded, invalidTrailer};
  save();
}

if (!verifyOnly) {
  assert(!proof.transactions.length || process.argv.includes('--resume'),
    'Inspect the existing journal before resuming');
}
const account = verifyOnly ? null : createAccount();
save();
if (account) {
  const config = await rpc('sim_getFeeConfig', []);
  if (config.enabled) {
    // Studio's built-in faucet credits only the temporary demo account with test GEN.
    const amount = 10_000_000_000_000_000;
    const response = await fetch('https://studio.genlayer.com/api', {
      method: 'POST', headers: {'content-type': 'application/json'},
      body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'sim_fundAccount', params: [account.address, amount]}),
      signal: AbortSignal.timeout(20000),
    });
    const funded = await response.json();
    assert(response.ok && !funded.error, 'Studio faucet request failed');
    const balance = BigInt(await rpc('eth_getBalance', [account.address, 'latest']));
    assert(balance >= BigInt(amount), 'Studio faucet did not credit the demo account');
    proof.test_faucet = {address: account.address, requested_wei: String(amount)};
    save();
  }
}
const deployment = await transaction('deploy', account, 'deploy', []);
proof.address = deployment.address;
proof.source = await source(proof.address);
save();
await checkFormat(account, 'signed', -3);
await checkFormat(account, 'unsigned', 29);
proof.verified = true;
save();
console.log('Verified all receipts, exact field layouts, signedness and frame checks');
