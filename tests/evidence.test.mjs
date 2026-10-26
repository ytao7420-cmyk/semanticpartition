import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {canonicalJson,sha256,verifyBatch,verifyPair,verifyCertificate,verifyConsumerReceipt,deriveRelation,checkDigest} from '../lib/evidence.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const fixture=()=>JSON.parse(execFileSync('python3',['-c',`import sys,json
sys.path.insert(0,'tests')
import test_contract as t
case=t.SemanticPartitionTests();case.setUp()
certificate=case.certificate();receipt=case.consume(certificate)
print(json.dumps({'batch':json.loads(case.provider.get_batch(t.OWNER,'batch')),'pair':json.loads(case.provider.get_pair(t.OWNER,'batch','alpha','beta')),'certificate':certificate,'receipt':receipt,'preset':{'batchId':'batch','scope':t.SCOPE,'reports':t.REPORTS},'owner':t.OWNER,'provider':t.PROVIDER,'consumer':t.OTHER}))
`],{cwd:root,encoding:'utf8'}));
test('independent JS verifier accepts Python-produced complete-edge certificate and consumer receipt',()=>{
  const f=fixture();verifyBatch(f.batch,f.preset,f.owner,f.provider);verifyPair(f.pair,f.batch,'alpha','beta','DUPLICATE');verifyCertificate(f.certificate,f.batch,[f.pair],['beta','alpha']);verifyConsumerReceipt(f.receipt,f.certificate,f.provider,f.consumer);
});
test('verification binds frozen input bytes, scope, provider and membership',()=>{
  const f=fixture();const bad=structuredClone(f.batch);bad.reports[0].text+=' invented';assert.throws(()=>verifyBatch(bad,f.preset,f.owner,f.provider));assert.throws(()=>verifyBatch(f.batch,{...f.preset,scope:'replacement'},f.owner,f.provider));assert.throws(()=>verifyBatch(f.batch,f.preset,f.owner,'0x'+'a'.repeat(40)));assert.throws(()=>verifyCertificate(f.certificate,f.batch,[f.pair],['alpha','gamma']));
});
test('valid citation syntax cannot conceal changed quoted source bytes',()=>{
  const f=fixture();f.pair.semantics.left_spans[0].quote='A fabricated quotation';delete f.pair.digest;f.pair.digest=sha256(canonicalJson(f.pair));assert.throws(()=>verifyPair(f.pair,f.batch,'alpha','beta','DUPLICATE'));
});
test('missing, partial and unknown edges are never complete duplicate proofs',()=>{
  const f=fixture();assert.throws(()=>verifyCertificate(f.certificate,f.batch,[],['alpha','beta']),/missing edge/);for(const changes of [{trigger:'OVERLAP'},{symptom:'DIFFERENT'},{context:'UNKNOWN'}]){const pair=structuredClone(f.pair);Object.assign(pair.semantics,changes);pair.relation=deriveRelation(pair.semantics);delete pair.digest;pair.digest=sha256(canonicalJson(pair));assert.throws(()=>verifyCertificate(f.certificate,f.batch,[pair],['alpha','beta']));}
});
test('consumer proof verifies provider, actor and digest rather than a UI label',()=>{
  const f=fixture();assert.throws(()=>verifyConsumerReceipt(f.receipt,f.certificate,'0x'+'f'.repeat(40),f.consumer));const changed=structuredClone(f.receipt);changed.certificate_digest='0'.repeat(64);delete changed.digest;changed.digest=sha256(canonicalJson(changed));assert.throws(()=>verifyConsumerReceipt(changed,f.certificate,f.provider,f.consumer));
});
test('canonicalization is ordered and Unicode preserving',()=>{
  assert.equal(canonicalJson({z:'中文',a:{z:2,a:1}}),'{"a":{"a":1,"z":2},"z":"中文"}');const value={x:'中文'};value.digest=sha256(canonicalJson(value));checkDigest(value);
});
test('default harness is plan-only and creates no wallet files',()=>{
  const local=new URL('../.local/',import.meta.url),before=existsSync(local)?readdirSync(local).sort():[];const output=JSON.parse(execFileSync(process.execPath,['scripts/live-test.mjs'],{cwd:root,encoding:'utf8'}));assert.equal(output.planOnly,true);assert.equal(output.chainId,61999);assert.equal(output.value,'0');assert.equal(output.leaderOnly,false);const after=existsSync(local)?readdirSync(local).sort():[];assert.deepEqual(after,before);
});
test('deployment with an unreviewed source hash fails before wallet creation',()=>{
  const local=new URL('../.local/',import.meta.url),before=existsSync(local)?readdirSync(local).sort():[];assert.throws(()=>execFileSync(process.execPath,['scripts/live-test.mjs','--deploy','--source-sha=wrong','--consumer-source-sha=wrong'],{cwd:root,stdio:'pipe'}));assert.deepEqual(existsSync(local)?readdirSync(local).sort():[],before);
});
