import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyPartialArchive,verifyPartialTranscripts} from '../scripts/verify-partial-evidence.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const fixture=()=>({archive:read('public/evidence/partial.json'),preset:read('scripts/demo-preset.json'),deployment:read('public/evidence/partial-deployment.json'),transcripts:read('public/evidence/partial-transcripts.json')});

test('partial public archive verifies supported evidence while preserving full-workflow failure',()=>{
  const f=fixture();assert.equal(verifyPartialArchive(f.archive,f.preset,f.deployment).fullWorkflowVerified,false);
  assert.equal(verifyPartialTranscripts(f.transcripts,f.archive,f.deployment).verifiedPublicTranscripts,9);
});

test('partial archive cannot promote majority disagreement or null pair state to success',()=>{
  for(const mutate of [f=>{f.archive.verified=true;},f=>{f.archive.failedPairReadBack={relation:'DISTINCT'};},f=>{f.archive.transactions.find(tx=>tx.label==='compare-beta-gamma').consensusResult='MAJORITY_AGREE';}]) {
    const f=fixture();mutate(f);assert.throws(()=>verifyPartialArchive(f.archive,f.preset,f.deployment));
  }
});

test('partial transcript checks failed calldata and leader tuple against the actual recorded bytes',()=>{
  for(const mutate of [f=>{f.transcripts.receipts.find(tx=>tx.reference.label==='compare-beta-gamma').data.calldata.raw[2]^=1;},f=>{f.archive.diagnosis.leaderTuple.trigger='SAME';},f=>{f.transcripts.receipts.find(tx=>tx.reference.label==='compare-beta-gamma').result_name='MAJORITY_AGREE';}]) {
    const f=fixture();mutate(f);assert.throws(()=>verifyPartialTranscripts(f.transcripts,f.archive,f.deployment));
  }
});

test('partial transcript requires exact wrong-scope rollback rather than an arbitrary VM error',()=>{
  const f=fixture();const row=f.transcripts.receipts.find(tx=>tx.reference.label==='wrong-consumer-scope');
  row.consensus_data.leader_receipt.find(entry=>entry.mode==='leader').result.payload='Another error';
  assert.throws(()=>verifyPartialTranscripts(f.transcripts,f.archive,f.deployment));
});

test('continuation defaults to a plan and does not change the journal directory',()=>{
  const local=new URL('../.local/',import.meta.url),before=existsSync(local)?readdirSync(local).sort():[];
  const result=JSON.parse(execFileSync(process.execPath,['scripts/continue-supported-evidence.mjs'],{cwd:root,encoding:'utf8'}));
  assert.equal(result.planOnly,true);assert.equal(result.chainId,61999);assert.equal(result.value,'0');assert.equal(result.leaderOnly,false);
  assert.ok(result.skipped.includes('compare-beta-gamma'));assert.deepEqual(existsSync(local)?readdirSync(local).sort():[],before);
});
