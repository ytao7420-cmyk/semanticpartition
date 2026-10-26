import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const PROTOCOL='semanticpartition-complete-edge-v1';
export const canonicalJson=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a<b?-1:a>b?1:0)):item);
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export function checkDigest(value){assert.ok(value&&typeof value==='object'&&!Array.isArray(value));const {digest,...body}=value;assert.equal(digest,sha256(canonicalJson(body)),'Canonical digest differs');return body;}
const hashPattern=/^[a-f0-9]{64}$/;
const fields=['scope_fit','trigger','symptom','context','consistency'];
const enums={scope_fit:['BOTH','NOT_BOTH','UNKNOWN'],trigger:['SAME','DISJOINT','OVERLAP','UNKNOWN'],symptom:['SAME','DIFFERENT','OVERLAP','UNKNOWN'],context:['SAME','DISJOINT','OVERLAP','UNKNOWN'],consistency:['CONSISTENT','CONTRADICTORY','UNKNOWN']};
export function deriveRelation(s){for(const field of fields)assert.ok(enums[field].includes(s[field]),'Unsupported semantic tuple');if(s.scope_fit!=='BOTH'||fields.some(field=>s[field]==='UNKNOWN'))return'UNKNOWN';if(s.consistency==='CONTRADICTORY'||s.trigger==='DISJOINT'||s.symptom==='DIFFERENT'||s.context==='DISJOINT')return'DISTINCT';return ['trigger','symptom','context'].every(field=>s[field]==='SAME')?'DUPLICATE':'OVERLAP';}
export function verifyBatch(batch,preset,owner,provider){
  checkDigest(batch);assert.equal(batch.protocol,PROTOCOL);assert.equal(batch.chain_id,61999);assert.match(batch.provider,/^0x[0-9a-f]{40}$/);if(provider)assert.equal(batch.provider,provider.toLowerCase());assert.equal(batch.owner,owner.toLowerCase());assert.equal(batch.id,preset.batchId);assert.equal(batch.scope,preset.scope);assert.equal(batch.scope_sha256,sha256(preset.scope));
  assert.deepEqual(batch.reports.map(({id,text})=>({id,text})),[...preset.reports].sort((a,b)=>a.id<b.id?-1:1));
  for(const report of batch.reports){assert.equal(report.text_sha256,sha256(report.text));assert.deepEqual(report.lines,report.text.split('\n'));}return batch;
}
export function verifyPair(pair,batch,left,right,expected){
  checkDigest(pair);const ids=[left,right].sort();const reports=ids.map(id=>batch.reports.find(report=>report.id===id));assert.ok(reports.every(Boolean));
  assert.equal(pair.protocol,PROTOCOL);assert.equal(pair.provider,batch.provider);assert.equal(pair.chain_id,batch.chain_id);assert.equal(pair.batch_digest,batch.digest);assert.equal(pair.scope_sha256,batch.scope_sha256);assert.deepEqual(pair.members,reports.map(({id,text_sha256})=>({id,text_sha256})));assert.equal(pair.relation,deriveRelation(pair.semantics));if(expected)assert.equal(pair.relation,expected);
  for(const [i,field] of ['left_spans','right_spans'].entries()){
    const spans=pair.semantics[field];assert.ok(Array.isArray(spans)&&spans.length<=4);if(pair.relation!=='UNKNOWN')assert.ok(spans.length>0);
    for(const span of spans){assert.ok(Number.isInteger(span.start)&&Number.isInteger(span.end)&&span.start>=1&&span.end>=span.start&&span.end<=reports[i].lines.length&&span.end-span.start<6);assert.equal(span.quote,reports[i].lines.slice(span.start-1,span.end).join('\n'));}
  }return pair;
}
export function verifyCertificate(certificate,batch,pairs,members){
  checkDigest(certificate);assert.equal(certificate.protocol,PROTOCOL);assert.equal(certificate.provider,batch.provider);assert.equal(certificate.chain_id,batch.chain_id);assert.equal(certificate.owner,batch.owner);assert.equal(certificate.batch_id,batch.id);assert.equal(certificate.batch_digest,batch.digest);assert.equal(certificate.scope_sha256,batch.scope_sha256);assert.equal(certificate.relation,'COMPLETE_DUPLICATE_CLIQUE');
  const ids=[...members].sort();assert.equal(new Set(ids).size,ids.length);assert.ok(ids.length>=2);const expected=ids.map(id=>{const report=batch.reports.find(row=>row.id===id);assert.ok(report);return{id,text_sha256:report.text_sha256};});assert.deepEqual(certificate.members,expected);assert.equal(certificate.members_sha256,sha256(canonicalJson(expected)));
  const digests=[];for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const pair=pairs.find(row=>row.members[0].id===ids[i]&&row.members[1].id===ids[j]);assert.ok(pair,'Certificate has a missing edge');verifyPair(pair,batch,ids[i],ids[j],'DUPLICATE');digests.push(pair.digest);}
  assert.equal(certificate.pair_count,ids.length*(ids.length-1)/2);assert.deepEqual(certificate.pair_digests,digests);assert.ok(digests.every(value=>hashPattern.test(value)));return certificate;
}
export function verifyConsumerReceipt(receipt,certificate,provider,consumer){
  checkDigest(receipt);assert.equal(receipt.provider,provider.toLowerCase());assert.equal(receipt.chain_id,61999);assert.equal(receipt.consumer,consumer.toLowerCase());for(const [target,source]of [['owner','owner'],['batch_id','batch_id'],['certificate_id','id'],['certificate_digest','digest'],['batch_digest','batch_digest'],['scope_sha256','scope_sha256'],['members_sha256','members_sha256'],['pair_count','pair_count'],['members','members']])assert.deepEqual(receipt[target],certificate[source]);return receipt;
}
