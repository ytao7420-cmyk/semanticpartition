import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {abi} from 'genlayer-js';
import {sha256,canonicalJson,verifyBatch,verifyPair,verifyCertificate,verifyConsumerReceipt} from '../lib/evidence.js';
import {assertExecutionSucceeded,assertExpectedRollback} from '../lib/receipt.js';
export function verifyArchive(archive,preset,deployment){
  assert.equal(archive.verified,true);assert.equal(archive.chainId,61999);assert.equal(archive.providerAddress,deployment.provider.address);assert.equal(archive.consumerAddress,deployment.consumer.address);assert.equal(archive.presetDigest,sha256(canonicalJson(preset)));
  const batch=verifyBatch(archive.batch,preset,archive.actors.creator,deployment.provider.address);assert.equal(archive.pairs.length,preset.pairs.length);for(const [i,pair]of archive.pairs.entries()){const fixture=preset.pairs[i];verifyPair(pair,batch,fixture.left,fixture.right,fixture.expected);}
  const certificate=verifyCertificate(archive.certificate,batch,archive.pairs,preset.members);verifyConsumerReceipt(archive.consumerReceipt,certificate,deployment.provider.address,archive.actors.consumer);assert.equal(archive.consumerReceipt.consumer_contract,deployment.consumer.address.toLowerCase());
  assert.equal(archive.certificate.id,preset.certificateId);assert.equal(archive.transactions.length,6);assert.equal(archive.negativeTransactions.length,3);assert.equal(archive.negativeConsumerReadBack,null);assert.equal(archive.invalidGroupReadBack,null);
  const hashes=new Set();for(const tx of [...archive.transactions,...archive.negativeTransactions]){assert.match(tx.hash,/^0x[0-9a-f]{64}$/i);assert.ok(!hashes.has(tx.hash));hashes.add(tx.hash);assert.equal(tx.spec.value,'0');assert.equal(tx.spec.leaderOnly,false);assert.equal(tx.leaderOnly,false);assert.equal(tx.consensusResult,'MAJORITY_AGREE');assert.ok(['ACCEPTED','FINALIZED'].includes(tx.status));if(tx.expectedRollbackVerified){assert.equal(tx.execution,'ERROR');assert.equal(tx.expectedFailure,true);}else assert.equal(tx.execution,'SUCCESS');}
  assert.deepEqual(archive.transactions.map(tx=>tx.spec.method),['freeze_batch','compare_pair','certify_group','compare_pair','compare_pair','consume']);
  assert.deepEqual(archive.negativeTransactions.map(tx=>tx.decodedRollback),['Missing pair evidence; transitive grouping is forbidden','Every group pair must independently establish DUPLICATE','Batch or scope differs from consumer intent']);
  for(const tx of archive.transactions){const isConsume=tx.spec.method==='consume';assert.equal(tx.spec.address,isConsume?deployment.consumer.address:deployment.provider.address);assert.equal(tx.spec.actor,isConsume?archive.actors.consumer:archive.actors.creator);}
  return{groups:1,pairs:3,successfulWorkflowTransactions:6,expectedRejections:3,crossContractConsumer:true};
}
export function verifyTranscripts(transcripts,archive,deployment){
  assert.equal(transcripts.chainId,61999);const references=[{label:'deploy-provider',hash:deployment.provider.transaction,source:deployment.provider},{label:'deploy-consumer',hash:deployment.consumer.transaction,source:deployment.consumer},...archive.transactions,...archive.negativeTransactions];assert.equal(transcripts.receipts.length,references.length);
  for(const [index,row]of transcripts.receipts.entries()){
    const ref=references[index];assert.equal(row.reference.label,ref.label);assert.equal(row.hash,ref.hash);if(ref.expectedRollbackVerified)assertExpectedRollback(row,ref.decodedRollback);else assertExecutionSucceeded(row);
    if(ref.spec){assert.equal(row.from_address.toLowerCase(),ref.spec.actor.toLowerCase());assert.equal(row.to_address.toLowerCase(),ref.spec.address.toLowerCase());assert.deepEqual(Uint8Array.from(row.data.calldata.raw),abi.calldata.encode(abi.calldata.makeCalldataObject(ref.spec.method,ref.spec.args,undefined)));}
    else assert.equal(row.from_address.toLowerCase(),deployment.deployer.toLowerCase());
  }return{verifiedPublicTranscripts:references.length};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
  const archive=await read('public/evidence/demo.json');assert.equal(archive.verified,true,'Live evidence has not been recorded; offline tests are not live evidence.');const deployment=await read('public/deployment.json'),preset=await read('scripts/demo-preset.json'),transcripts=await read('public/evidence/transcripts.json');
  for(const [name,file]of [['provider','semanticpartition.py'],['consumer','partitionconsumer.py']])assert.equal(deployment[name].sourceSha256,sha256(await readFile(new URL('contracts/'+file,root))));
  console.log(JSON.stringify({...verifyArchive(archive,preset,deployment),...verifyTranscripts(transcripts,archive,deployment)},null,2));
}
