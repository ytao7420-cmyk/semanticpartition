// Read-only archive of the reviewed logging revision's real validator output.
import assert from 'node:assert/strict';
import {abi} from 'genlayer-js';
import {ROOT,LOCAL,CHAIN_ID,reader,readJson,saveJson} from './runtime.mjs';
import {sha256,canonicalJson} from '../lib/evidence.js';
import {summarizeReceipt} from '../lib/receipt.js';

const deployment=await readJson(new URL('public/deployment.json',ROOT));
const provider=deployment.provider.address;
assert.equal(deployment.chainId,CHAIN_ID);
assert.equal(deployment.provider.sourceSha256,'798396ef6d331453a1f6984e96314baa502f321b8550d19678667848576cf308');
assert.equal(sha256(await reader.getContractCode(provider)),deployment.provider.sourceSha256);
const journal=await readJson(new URL(`workflow-${provider.toLowerCase()}.json`,LOCAL));
const preset=await readJson(new URL('scripts/demo-preset.json',ROOT));
assert.equal(journal.identity.presetDigest,sha256(canonicalJson(preset)));
const comparisons=[];
for(const item of journal.transactions.filter(row=>row.spec?.method==='compare_pair')) {
  assert.equal(item.spec.address,provider);assert.equal(item.spec.leaderOnly,false);assert.equal(item.spec.value,'0');
  const tx=await reader.getTransaction({hash:item.hash});
  assert.equal(tx.leader_only,false);assert.equal(tx.from_address.toLowerCase(),item.spec.actor.toLowerCase());
  assert.equal(tx.to_address.toLowerCase(),provider.toLowerCase());
  assert.deepEqual(Uint8Array.from(tx.data.calldata.raw),abi.calldata.encode(abi.calldata.makeCalldataObject(item.spec.method,item.spec.args,undefined)));
  const leaders=tx.consensus_data?.leader_receipt??[];
  const leader=leaders.filter(row=>row.mode==='leader').at(-1);
  const returned=leader?.eq_outputs?.['0']?.payload?.raw;
  const decoded=returned?Object.fromEntries(abi.calldata.decode(Uint8Array.from(returned))):{};
  const leaderTuple=Object.fromEntries(['scope_fit','trigger','symptom','context','consistency'].map(field=>[field,decoded[field]??null]));
  const validators=(tx.consensus_data?.validators??[]).map(row=>{
    const prefix='SEMANTICPARTITION_DIAGNOSTIC ';
    const lines=String(row.genvm_result?.stdout??'').split('\n').map(line=>line.trim()).filter(line=>line.startsWith(prefix));
    const events=lines.map(line=>JSON.parse(line.slice(prefix.length)));
    for(const event of events)assert.ok(['independent_comparison','audit_result','validator_decision'].includes(event.event));
    return {address:row.node_config?.address??null,vote:row.vote,executionResult:row.execution_result,
      diagnosticEvents:events,diagnosticLineCount:lines.length};
  });
  const stored=JSON.parse(await reader.readContract({address:provider,functionName:'get_pair',args:[journal.identity.creator,...item.spec.args]}));
  comparisons.push({label:item.label,hash:item.hash,...summarizeReceipt(tx),leaderTuple,validators,
    storedPairPresent:stored!==null,storedRelation:stored?.relation??null});
}
const demo=await readJson(new URL('public/evidence/demo.json',ROOT),null);
const archive={recordedAt:new Date().toISOString(),chainId:CHAIN_ID,provider,consumer:deployment.consumer.address,
  sourceSha256:journal.identity.sourceSha256,presetDigest:journal.identity.presetDigest,
  completeWorkflowVerified:demo?.verified===true&&demo.providerAddress===provider,
  notice:'Selected public diagnostics from one reviewed observability revision run. Original failure evidence is preserved separately. No semantic-policy change, fixture change, original-address resubmission or published submission is implied.',
  comparisons};
const path=new URL(`public/evidence/diagnostic-run-${provider.toLowerCase()}.json`,ROOT);
await saveJson(path,archive);
console.log(JSON.stringify({archive:path.pathname,completeWorkflowVerified:archive.completeWorkflowVerified,
  comparisons:comparisons.map(({label,hash,status,consensusResult,storedRelation,validators})=>({label,hash,status,consensusResult,storedRelation,
    validatorDiagnostics:validators.map(({vote,diagnosticEvents})=>({vote,diagnosticEvents}))}))},null,2));
