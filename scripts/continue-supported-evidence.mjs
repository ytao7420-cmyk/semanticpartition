// Continue only the already-certified two-member group after a failed third pair.
// The failed comparison is retained and is never resubmitted by this script.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {ROOT,LOCAL,CHAIN_ID,RPC,reader,readJson,readJsonContract,saveJson,acquireLock,testActor,Journal} from './runtime.mjs';
import {sha256,canonicalJson,verifyBatch,verifyPair,verifyCertificate,verifyConsumerReceipt} from '../lib/evidence.js';
import {assertExecutionSucceeded,assertExpectedRollback,summarizeReceipt,lifecycleStatus,consensusResult} from '../lib/receipt.js';
import {verifyPartialArchive,verifyPartialTranscripts} from './verify-partial-evidence.mjs';

if(!process.argv.includes('--run')) {
  console.log(JSON.stringify({planOnly:true,chainId:CHAIN_ID,value:'0',leaderOnly:false,
    successfulWrites:['consume-exact-group'],expectedRejections:['wrong-consumer-scope'],
    skipped:['compare-beta-gamma','compare-alpha-gamma','nonduplicate-third-member'],
    notice:'Resume existing source-bound journals; preserve the failed pair; archive remains verified:false.'},null,2));
  process.exit(0);
}

const unlock=await acquireLock();
try {
  const deployment=await readJson(new URL('public/deployment.json',ROOT));
  assert.equal(deployment.deployed,true);assert.equal(deployment.chainId,CHAIN_ID);assert.equal(deployment.rpc,RPC);
  const hashes={},sources={};
  for(const [name,file]of [['provider','semanticpartition.py'],['consumer','partitionconsumer.py']]) {
    sources[name]=await readFile(new URL('contracts/'+file,ROOT),'utf8');hashes[name]=sha256(sources[name]);
    assert.equal(deployment[name].sourceSha256,hashes[name]);
    assert.equal(sha256(await reader.getContractCode(deployment[name].address)),hashes[name]);
  }
  const preset=await readJson(new URL('scripts/demo-preset.json',ROOT));
  const provider=deployment.provider.address,consumerContract=deployment.consumer.address;
  const state=await readJson(new URL(`workflow-${provider.toLowerCase()}.json`,LOCAL));
  const identity=state.identity;
  assert.equal(identity.chainId,CHAIN_ID);assert.equal(identity.provider,provider);assert.equal(identity.consumer,consumerContract);
  assert.deepEqual(identity.sourceSha256,hashes);assert.equal(identity.presetDigest,sha256(canonicalJson(preset)));
  const consumer=await testActor('consumer');assert.equal(consumer.account.address,identity.consumerActor);
  const journal=await Journal.load(new URL(`workflow-${provider.toLowerCase()}.json`,LOCAL),identity);
  const negative=await Journal.load(new URL(`negative-${provider.toLowerCase()}.json`,LOCAL),{...identity,purpose:'explicit expected rejections'});
  const owner=identity.creator.toLowerCase(),read=(method,args)=>readJsonContract(provider,method,args);
  const failure=journal.state.transactions.find(tx=>tx.label==='compare-beta-gamma');
  assert.ok(failure?.hash,'An identified failed comparison must already be recorded.');
  const failedReceipt=await reader.getTransaction({hash:failure.hash});
  assert.ok(['UNDETERMINED','FINALIZED'].includes(lifecycleStatus(failedReceipt)));assert.equal(consensusResult(failedReceipt),'MAJORITY_DISAGREE');
  Object.assign(failure,summarizeReceipt(failedReceipt),{failure:'Validator majority disagreed; no committed pair state.'});await journal.save();
  const batch=verifyBatch(await read('get_batch',[owner,preset.batchId]),preset,owner,provider);
  const pair=verifyPair(await read('get_pair',[owner,preset.batchId,'alpha','beta']),batch,'alpha','beta','DUPLICATE');
  assert.equal(await read('get_pair',[owner,preset.batchId,'beta','gamma']),null,'Failed pair unexpectedly has committed state.');
  assert.equal(await read('get_pair',[owner,preset.batchId,'alpha','gamma']),null,'Unattempted pair unexpectedly has committed state.');
  const certificate=verifyCertificate(await read('get_certificate',[owner,preset.batchId,preset.certificateId]),batch,[pair],preset.members);
  const args=['consume-group',owner,preset.batchId,preset.certificateId,certificate.digest,batch.digest,batch.scope_sha256,JSON.stringify(certificate.members)];
  const spec={kind:'call',address:consumerContract,actor:consumer.account.address,method:'consume',args,value:'0',leaderOnly:false};
  await journal.transact('consume-exact-group',spec,()=>consumer.writeContract({address:consumerContract,functionName:'consume',args,value:0n,leaderOnly:false}));
  const consumerReceipt=verifyConsumerReceipt(await readJsonContract(consumerContract,'get_receipt',[consumer.account.address,'consume-group']),certificate,provider,consumer.account.address);
  assert.equal(consumerReceipt.consumer_contract,consumerContract.toLowerCase());
  const badArgs=['incorrect-scope',...args.slice(1)];badArgs[6]='0'.repeat(64);
  await negative.transactExpectedRollback('wrong-consumer-scope',{...spec,args:badArgs},()=>consumer.writeContract({address:consumerContract,functionName:'consume',args:badArgs,value:0n,leaderOnly:false}),'Batch or scope differs from consumer intent');
  const negativeConsumerReadBack=await readJsonContract(consumerContract,'get_receipt',[consumer.account.address,'incorrect-scope']);
  const invalidGroupReadBack=await read('get_certificate',[owner,preset.batchId,'invalid-three']);
  assert.equal(negativeConsumerReadBack,null);assert.equal(invalidGroupReadBack,null);
  assert.deepEqual(await read('get_certificate',[owner,preset.batchId,preset.certificateId]),certificate);
  const archive={verified:false,supportedEvidenceVerified:true,recordedAt:new Date().toISOString(),network:deployment.network,
    chainId:CHAIN_ID,providerAddress:provider,consumerAddress:consumerContract,sourceSha256:hashes,presetDigest:identity.presetDigest,
    actors:{creator:identity.creator,consumer:consumer.account.address},notice:preset.notice,batch,pairs:[pair],certificate,consumerReceipt,
    failedPairReadBack:null,unattemptedPairReadBack:null,negativeConsumerReadBack,invalidGroupReadBack,
    transactions:journal.state.transactions,negativeTransactions:negative.state.transactions,
    incomplete:[`compare-beta-gamma: ${lifecycleStatus(failedReceipt)} / MAJORITY_DISAGREE; no stored pair`,
      'compare-alpha-gamma: not attempted after the disagreement','nonduplicate-third-member: not attempted without complete pair coverage'],
    diagnosis:{failedTransaction:failure.hash,leaderTuple:{scope_fit:'BOTH',trigger:'DISJOINT',symptom:'DIFFERENT',context:'SAME',consistency:'CONSISTENT'},
      exactRejectionCause:'Not recoverable: validator tuples and audit booleans were not logged; stdout/stderr are empty for all three disagreeing validators.',
      candidates:['Independent semantic dimension mismatch','Citation or dimension audit rejection','Caught parser/model exception'],
      sourceUnchanged:true,fixtureUnchanged:true,failedCalldataRetried:false}};
  const references=[{label:'deploy-provider',hash:deployment.provider.transaction},{label:'deploy-consumer',hash:deployment.consumer.transaction},...archive.transactions,...archive.negativeTransactions];
  const rows=[];
  for(const ref of references) {
    const tx=ref.hash===failure.hash?failedReceipt:await reader.getTransaction({hash:ref.hash});
    if(ref.hash!==failure.hash){if(ref.expectedRollbackVerified)assertExpectedRollback(tx,ref.decodedRollback);else assertExecutionSucceeded(tx);}
    const leaders=tx.consensus_data?.leader_receipt??[],validators=tx.consensus_data?.validators??[];
    rows.push({reference:{label:ref.label,hash:ref.hash},hash:tx.hash,from_address:tx.from_address,to_address:tx.to_address,
      data:{calldata:tx.data?.calldata,contract_address:tx.data?.contract_address},statusName:lifecycleStatus(tx),result_name:consensusResult(tx),leader_only:tx.leader_only,
      consensus_data:{votes:tx.consensus_data?.votes??{},leader_receipt:(Array.isArray(leaders)?leaders:[leaders]).map(row=>({mode:row.mode,execution_result:row.execution_result,result:row.result,eq_outputs:row.eq_outputs})),
        validators:validators.map(row=>({mode:row.mode,vote:row.vote,execution_result:row.execution_result,nondet_disagree:row.nondet_disagree,
          genvm_result:{stdout:row.genvm_result?.stdout,stderr:row.genvm_result?.stderr}}))}});
    if(ref.spec&&ref.hash!==failure.hash)Object.assign(ref,summarizeReceipt(tx),ref.expectedRollbackVerified?{execution:'ERROR'}:{});
  }
  const transcripts={chainId:CHAIN_ID,recordedAt:new Date().toISOString(),notice:'Selected public RPC fields only. One semantic comparison has MAJORITY_DISAGREE and no committed pair state. No private keys.',receipts:rows};
  const results={...verifyPartialArchive(archive,preset,deployment),...verifyPartialTranscripts(transcripts,archive,deployment)};
  await mkdir(new URL('public/evidence/sources/',ROOT),{recursive:true});
  for(const name of Object.keys(sources))await writeFile(new URL(`public/evidence/sources/${hashes[name]}.py`,ROOT),sources[name]);
  await saveJson(new URL('public/evidence/partial-deployment.json',ROOT),deployment);
  await saveJson(new URL('public/evidence/partial.json',ROOT),archive);
  await saveJson(new URL('public/evidence/partial-transcripts.json',ROOT),transcripts);
  console.log(JSON.stringify({complete:false,...results},null,2));
} finally {await unlock();}
