'use strict';
const {test,before,after,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {server,state,resetWorld}=require('../server');
let base;
before(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${server.address().port}`;
});
beforeEach(()=>{resetWorld();state.mode='demo';});
after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
const director=(body,headers={})=>fetch(`${base}/api/director`,{
  method:'POST',headers:{'Content-Type':'application/json',...headers},
  body:typeof body==='string'?body:JSON.stringify(body)
});

test('same-origin controls drive a complete round and expose both archived futures',async()=>{
  let response=await director({action:'open',duration:20},{Origin:base});assert.equal(response.status,200);
  response=await director({action:'vote',name:'alice',branch:'b'});assert.equal(response.status,200);
  response=await director({action:'spark',name:'alice',word:'hope'});assert.equal(response.status,200);
  response=await director({action:'collapse'});assert.equal(response.status,200);
  const {state:result}=await response.json();
  assert.equal(result.winner,'b');assert.equal(result.history[0].before.harmony,50);
  assert.equal(result.history[0].futures.a.harmony,56);assert.equal(result.world.harmony,44);
  response=await fetch(`${base}/api/state`);assert.equal(response.status,200);
  assert.equal((await response.json()).history[0].gene,result.history[0].gene);
});

test('cross-site, malformed and oversized requests cannot change the universe',async()=>{
  let response=await director({action:'open'},{Origin:'https://attacker.example'});assert.equal(response.status,403);
  response=await director({action:'open'},{'Sec-Fetch-Site':'cross-site'});assert.equal(response.status,403);
  response=await director({action:'open'},{'Content-Type':'text/plain'});assert.equal(response.status,415);
  response=await director('{ broken');assert.equal(response.status,400);
  response=await director('null');assert.equal(response.status,400);
  response=await director({action:'open',padding:'x'.repeat(5000)});assert.equal(response.status,413);
  assert.equal(state.phase,'idle');
});

test('live mode blocks simulated viewers through the HTTP API',async()=>{
  state.mode='live';
  for(const action of ['simulate','vote','spark']){
    const response=await director({action,name:'fake',branch:'a',word:'hope'});
    assert.equal(response.status,400);
  }
  assert.equal(state.totalVotes,0);assert.equal(state.sparks.length,0);
});

test('directors cannot discard active votes by opening another round',async()=>{
  await director({action:'open'});await director({action:'vote',name:'alice',branch:'a'});
  const response=await director({action:'open',duration:90});assert.equal(response.status,409);
  assert.equal(state.totalVotes,1);
});
