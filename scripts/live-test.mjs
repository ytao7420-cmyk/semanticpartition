// Defaults to a plan: no private keys, lock files, or network broadcasts.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {ROOT,LOCAL,CHAIN_ID,RPC,EXPLORER,reader,readJson,readJsonContract,saveJson,acquireLock,testActor,Journal} from './runtime.mjs';
import {sha256,canonicalJson,verifyBatch,verifyPair,verifyCertificate,verifyConsumerReceipt} from '../lib/evidence.js';
import {verifyArchive,verifyTranscripts} from './verify-evidence.mjs';
import {assertExecutionSucceeded,assertExpectedRollback,summarizeReceipt} from '../lib/receipt.js';
const options=process.argv.slice(2),flag=name=>options.includes(name),option=name=>{const inline=options.find(arg=>arg.startsWith(name+'='));if(inline)return inline.slice(name.length+1);const i=options.indexOf(name);return i>=0?options[i+1]:undefined;};
const preset=await readJson(new URL('demo-preset.json',import.meta.url));
const files={provider:'semanticpartition.py',consumer:'partitionconsumer.py'},sources={},hashes={};for(const [name,file]of Object.entries(files)){sources[name]=await readFile(new URL('contracts/'+file,ROOT),'utf8');hashes[name]=sha256(sources[name]);}
const deploying=flag('--deploy'),running=flag('--run');
if(flag('--plan')||(!deploying&&!running)){console.log(JSON.stringify({planOnly:true,chainId:CHAIN_ID,network:'GenLayer Studionet',value:'0',leaderOnly:false,sourceSha256:hashes,deployCommand:'node scripts/live-test.mjs --deploy --source-sha=<reviewed-provider-sha> --consumer-source-sha=<reviewed-consumer-sha>',runCommand:'node scripts/live-test.mjs --run',successfulDeployments:2,successfulWorkflowWrites:6,expectedRejectionWrites:3,comparisons:preset.pairs,notice:preset.notice},null,2));process.exit(0);}
if(deploying){assert.equal(option('--source-sha'),hashes.provider,'Exact reviewed provider SHA required before creating a wallet.');assert.equal(option('--consumer-source-sha'),hashes.consumer,'Exact reviewed consumer SHA required before creating a wallet.');}
const unlock=await acquireLock();
const recovery={recoverLabel:option('--recover-label'),recoverHash:option('--recover-hash')};
try{
  let deployment=await readJson(new URL('public/deployment.json',ROOT),null);
  if(deploying){
    const deployer=await testActor('deployer'),identity={chainId:CHAIN_ID,sourceSha256:hashes,deployer:deployer.account.address};
    const journal=await Journal.load(new URL(`deployment-${hashes.provider}-${hashes.consumer}.json`,LOCAL),identity);
    const receipt=await journal.transact('deploy-provider',{kind:'deploy',actor:deployer.account.address,sourceSha256:hashes.provider,args:[],value:'0',leaderOnly:false},()=>deployer.deployContract({code:sources.provider,args:[],leaderOnly:false}),recovery);
    const providerAddress=receipt.data?.contract_address??receipt.txDataDecoded?.contractAddress??receipt.to_address;assert.match(providerAddress??'',/^0x[0-9a-f]{40}$/i);assert.equal(sha256(await reader.getContractCode(providerAddress)),hashes.provider);
    const consumerReceipt=await journal.transact('deploy-consumer',{kind:'deploy',actor:deployer.account.address,sourceSha256:hashes.consumer,args:[providerAddress],value:'0',leaderOnly:false},()=>deployer.deployContract({code:sources.consumer,args:[providerAddress],leaderOnly:false}),recovery);
    const consumerAddress=consumerReceipt.data?.contract_address??consumerReceipt.txDataDecoded?.contractAddress??consumerReceipt.to_address;assert.match(consumerAddress??'',/^0x[0-9a-f]{40}$/i);assert.equal(sha256(await reader.getContractCode(consumerAddress)),hashes.consumer);
    deployment={deployed:true,network:'GenLayer Studionet',chainId:CHAIN_ID,rpc:RPC,explorer:EXPLORER,deployer:deployer.account.address,provider:{address:providerAddress,sourceSha256:hashes.provider,transaction:journal.state.transactions[0].hash,receipt:summarizeReceipt(receipt)},consumer:{address:consumerAddress,sourceSha256:hashes.consumer,transaction:journal.state.transactions[1].hash,receipt:summarizeReceipt(consumerReceipt)},recordedAt:new Date().toISOString(),notice:preset.notice};
    assert.equal(await reader.readContract({address:consumerAddress,functionName:'get_provider',args:[]}),providerAddress.toLowerCase());await saveJson(new URL('public/deployment.json',ROOT),deployment);console.log(JSON.stringify({deployed:true,provider:providerAddress,consumer:consumerAddress}));
  }
  if(running){
    assert.ok(deployment?.deployed,'Deploy reviewed source first');assert.equal(deployment.chainId,CHAIN_ID);assert.equal(deployment.rpc,RPC);
    for(const name of Object.keys(files)){assert.equal(deployment[name].sourceSha256,hashes[name]);assert.equal(sha256(await reader.getContractCode(deployment[name].address)),hashes[name]);}
    const creator=await testActor('creator'),consumer=await testActor('consumer');assert.notEqual(creator.account.address,consumer.account.address);const owner=creator.account.address.toLowerCase();
    const identity={chainId:CHAIN_ID,provider:deployment.provider.address,consumer:deployment.consumer.address,sourceSha256:hashes,presetDigest:sha256(canonicalJson(preset)),creator:creator.account.address,consumerActor:consumer.account.address};
    const journal=await Journal.load(new URL(`workflow-${deployment.provider.address.toLowerCase()}.json`,LOCAL),identity),negative=await Journal.load(new URL(`negative-${deployment.provider.address.toLowerCase()}.json`,LOCAL),{...identity,purpose:'explicit expected rejections'});
    const provider=deployment.provider.address,consumerContract=deployment.consumer.address,read=(method,args)=>readJsonContract(provider,method,args);
    const send=(label,actor,address,method,args)=>journal.transact(label,{kind:'call',address,actor:actor.account.address,method,args,value:'0',leaderOnly:false},()=>actor.writeContract({address,functionName:method,args,value:0n,leaderOnly:false}),recovery);
    const reject=(label,actor,address,method,args,error)=>negative.transactExpectedRollback(label,{kind:'call',address,actor:actor.account.address,method,args,value:'0',leaderOnly:false},()=>actor.writeContract({address,functionName:method,args,value:0n,leaderOnly:false}),error,recovery);
    await send('freeze-batch',creator,provider,'freeze_batch',[preset.batchId,preset.scope,JSON.stringify(preset.reports)]);const batch=verifyBatch(await read('get_batch',[owner,preset.batchId]),preset,owner,provider);
    const pairs=[];for(const [i,pair]of preset.pairs.entries()){
      await send(`compare-${pair.left}-${pair.right}`,creator,provider,'compare_pair',[preset.batchId,pair.left,pair.right]);pairs.push(verifyPair(await read('get_pair',[owner,preset.batchId,pair.left,pair.right]),batch,pair.left,pair.right,pair.expected));
      if(i===0){await send('certify-two',creator,provider,'certify_group',[preset.batchId,preset.certificateId,JSON.stringify(preset.members)]);await reject('missing-third-edge',creator,provider,'certify_group',[preset.batchId,'invalid-three',JSON.stringify(preset.reports.map(row=>row.id))],'Missing pair evidence; transitive grouping is forbidden');}
    }
    await reject('nonduplicate-third-member',creator,provider,'certify_group',[preset.batchId,'invalid-three',JSON.stringify(preset.reports.map(row=>row.id))],'Every group pair must independently establish DUPLICATE');
    const certificate=verifyCertificate(await read('get_certificate',[owner,preset.batchId,preset.certificateId]),batch,pairs,preset.members);
    const args=['consume-group',owner,preset.batchId,preset.certificateId,certificate.digest,batch.digest,batch.scope_sha256,JSON.stringify(certificate.members)];await send('consume-exact-group',consumer,consumerContract,'consume',args);
    const consumerReceipt=verifyConsumerReceipt(await readJsonContract(consumerContract,'get_receipt',[consumer.account.address,'consume-group']),certificate,provider,consumer.account.address);
    const badArgs=['incorrect-scope',...args.slice(1)];badArgs[6]='0'.repeat(64);await reject('wrong-consumer-scope',consumer,consumerContract,'consume',badArgs,'Batch or scope differs from consumer intent');
    const negativeConsumerReadBack=await readJsonContract(consumerContract,'get_receipt',[consumer.account.address,'incorrect-scope']),invalidGroupReadBack=await read('get_certificate',[owner,preset.batchId,'invalid-three']);assert.equal(negativeConsumerReadBack,null);assert.equal(invalidGroupReadBack,null);
    await journal.refresh();const archive={verified:true,recordedAt:new Date().toISOString(),network:deployment.network,chainId:CHAIN_ID,providerAddress:provider,consumerAddress:consumerContract,sourceSha256:hashes,presetDigest:identity.presetDigest,actors:{creator:creator.account.address,consumer:consumer.account.address},notice:preset.notice,batch,pairs,certificate,consumerReceipt,negativeConsumerReadBack,invalidGroupReadBack,transactions:journal.state.transactions,negativeTransactions:negative.state.transactions};
    verifyArchive(archive,preset,deployment);
    const refs=[{label:'deploy-provider',hash:deployment.provider.transaction},{label:'deploy-consumer',hash:deployment.consumer.transaction},...archive.transactions,...archive.negativeTransactions];const rows=[];
    for(const ref of refs){const tx=await reader.getTransaction({hash:ref.hash});if(ref.expectedRollbackVerified)assertExpectedRollback(tx,ref.decodedRollback);else assertExecutionSucceeded(tx);const raw=tx.consensus_data?.leader_receipt,leaders=Array.isArray(raw)?raw:raw?[raw]:[];rows.push({reference:{label:ref.label,hash:ref.hash},hash:tx.hash,from_address:tx.from_address,to_address:tx.to_address,data:{calldata:tx.data?.calldata,contract_address:tx.data?.contract_address},statusName:tx.statusName??tx.status_name??tx.status,result_name:tx.result_name??tx.resultName??tx.result,leader_only:tx.leader_only,consensus_data:{votes:tx.consensus_data?.votes??{},leader_receipt:leaders.map(row=>({mode:row.mode,execution_result:row.execution_result,result:row.result}))}});}
    const transcripts={chainId:CHAIN_ID,recordedAt:new Date().toISOString(),notice:'Selected public RPC receipt fields. Test actors only; no keys. Expected rejections remain ERROR.',receipts:rows};verifyTranscripts(transcripts,archive,deployment);await saveJson(new URL('public/evidence/demo.json',ROOT),archive);await saveJson(new URL('public/evidence/transcripts.json',ROOT),transcripts);console.log(JSON.stringify({complete:true,...verifyArchive(archive,preset,deployment),...verifyTranscripts(transcripts,archive,deployment)}));
  }
}finally{await unlock();}
