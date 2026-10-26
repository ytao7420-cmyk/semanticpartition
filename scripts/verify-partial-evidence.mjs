import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {abi} from 'genlayer-js';
import {sha256,canonicalJson,verifyBatch,verifyPair,verifyCertificate,verifyConsumerReceipt} from '../lib/evidence.js';
import {assertExecutionSucceeded,assertExpectedRollback,lifecycleStatus,consensusResult} from '../lib/receipt.js';

export function verifyPartialArchive(archive,preset,deployment) {
  assert.equal(archive.verified,false);assert.equal(archive.supportedEvidenceVerified,true);assert.equal(archive.chainId,61999);
  assert.equal(archive.providerAddress,deployment.provider.address);assert.equal(archive.consumerAddress,deployment.consumer.address);
  assert.equal(archive.presetDigest,sha256(canonicalJson(preset)));assert.deepEqual(archive.sourceSha256,{provider:deployment.provider.sourceSha256,consumer:deployment.consumer.sourceSha256});
  const batch=verifyBatch(archive.batch,preset,archive.actors.creator,deployment.provider.address);
  assert.equal(archive.pairs.length,1);verifyPair(archive.pairs[0],batch,'alpha','beta','DUPLICATE');
  const certificate=verifyCertificate(archive.certificate,batch,archive.pairs,preset.members);
  verifyConsumerReceipt(archive.consumerReceipt,certificate,deployment.provider.address,archive.actors.consumer);
  assert.equal(archive.consumerReceipt.consumer_contract,deployment.consumer.address.toLowerCase());
  for(const field of ['failedPairReadBack','unattemptedPairReadBack','negativeConsumerReadBack','invalidGroupReadBack'])assert.equal(archive[field],null);
  assert.equal(archive.transactions.length,5);assert.equal(archive.negativeTransactions.length,2);assert.equal(archive.incomplete.length,3);
  assert.deepEqual(archive.transactions.map(tx=>tx.label),['freeze-batch','compare-alpha-beta','certify-two','compare-beta-gamma','consume-exact-group']);
  assert.deepEqual(archive.negativeTransactions.map(tx=>tx.label),['missing-third-edge','wrong-consumer-scope']);
  const hashes=new Set();
  for(const tx of [...archive.transactions,...archive.negativeTransactions]) {
    assert.match(tx.hash,/^0x[0-9a-f]{64}$/i);assert.ok(!hashes.has(tx.hash));hashes.add(tx.hash);
    assert.equal(tx.spec.value,'0');assert.equal(tx.spec.leaderOnly,false);assert.equal(tx.leaderOnly,false);
    if(tx.label==='compare-beta-gamma') {assert.ok(['UNDETERMINED','FINALIZED'].includes(tx.status));assert.equal(tx.consensusResult,'MAJORITY_DISAGREE');continue;}
    assert.equal(tx.consensusResult,'MAJORITY_AGREE');assert.ok(['ACCEPTED','FINALIZED'].includes(tx.status));
    assert.equal(tx.execution,tx.expectedRollbackVerified?'ERROR':'SUCCESS');
  }
  assert.deepEqual(archive.negativeTransactions.map(tx=>tx.decodedRollback),['Missing pair evidence; transitive grouping is forbidden','Batch or scope differs from consumer intent']);
  for(const tx of archive.transactions) {const consume=tx.label==='consume-exact-group';assert.equal(tx.spec.actor,consume?archive.actors.consumer:archive.actors.creator);assert.equal(tx.spec.address,consume?deployment.consumer.address:deployment.provider.address);}
  return {supportedGroups:1,supportedPairs:1,successfulWorkflowTransactions:4,expectedRejections:2,failedSemanticComparisons:1,crossContractConsumer:true,fullWorkflowVerified:false};
}

export function verifyPartialTranscripts(transcripts,archive,deployment) {
  assert.equal(transcripts.chainId,61999);
  const references=[{label:'deploy-provider',hash:deployment.provider.transaction},{label:'deploy-consumer',hash:deployment.consumer.transaction},...archive.transactions,...archive.negativeTransactions];
  assert.equal(transcripts.receipts.length,references.length);
  for(const [i,row]of transcripts.receipts.entries()) {
    const ref=references[i];assert.equal(row.reference.label,ref.label);assert.equal(row.hash,ref.hash);
    if(ref.label==='compare-beta-gamma') {
      assert.ok(['UNDETERMINED','FINALIZED'].includes(lifecycleStatus(row)));assert.equal(consensusResult(row),'MAJORITY_DISAGREE');assert.equal(row.leader_only,false);
      assert.ok(Object.values(row.consensus_data.votes).filter(vote=>vote==='disagree').length>=3);
      const leader=row.consensus_data.leader_receipt.filter(entry=>entry.mode==='leader').at(-1);
      assert.equal(leader.execution_result,'SUCCESS');
      const returned=Object.fromEntries(abi.calldata.decode(Uint8Array.from(leader.eq_outputs['0'].payload.raw)));
      const tuple=Object.fromEntries(['scope_fit','trigger','symptom','context','consistency'].map(field=>[field,returned[field]]));
      assert.deepEqual(tuple,archive.diagnosis.leaderTuple);
      assert.equal(archive.diagnosis.failedTransaction,ref.hash);assert.equal(archive.diagnosis.failedCalldataRetried,false);
      const disagreeing=row.consensus_data.validators.filter(entry=>entry.vote==='disagree');
      assert.equal(disagreeing.length,3);
      for(const validator of disagreeing) {assert.equal(validator.execution_result,'SUCCESS');assert.equal(validator.genvm_result.stdout,'');assert.equal(validator.genvm_result.stderr,'');}
    }
    else if(ref.expectedRollbackVerified)assertExpectedRollback(row,ref.decodedRollback);else assertExecutionSucceeded(row);
    if(ref.spec) {assert.equal(row.from_address.toLowerCase(),ref.spec.actor.toLowerCase());assert.equal(row.to_address.toLowerCase(),ref.spec.address.toLowerCase());assert.deepEqual(Uint8Array.from(row.data.calldata.raw),abi.calldata.encode(abi.calldata.makeCalldataObject(ref.spec.method,ref.spec.args,undefined)));}
    else assert.equal(row.from_address.toLowerCase(),deployment.deployer.toLowerCase());
  }
  return {verifiedPublicTranscripts:references.length};
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url) {
  const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
  const [archive,preset,deployment,transcripts]=await Promise.all(['public/evidence/partial.json','scripts/demo-preset.json','public/evidence/partial-deployment.json','public/evidence/partial-transcripts.json'].map(read));
  for(const name of ['provider','consumer'])assert.equal(deployment[name].sourceSha256,sha256(await readFile(new URL(`public/evidence/sources/${deployment[name].sourceSha256}.py`,root))));
  console.log(JSON.stringify({...verifyPartialArchive(archive,preset,deployment),...verifyPartialTranscripts(transcripts,archive,deployment)},null,2));
}
