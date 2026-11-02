'use strict';
const {test,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {state,handleChat,openRound,vote,spark,closeRound,resetWorld,cleanUsername,safeText,simulate,projectFuture,processTwitchLine}=require('../server');
beforeEach(()=>{resetWorld();state.mode='demo';state.connected=false;});
test('usernames and public sparks cannot inject markup or control characters',()=>{
  assert.equal(cleanUsername(' <script> pLAYER_1'), 'scriptplayer_1');
  assert.equal(safeText('hi\n<script>alert(1)</script>'),'hiscriptalert(1)/script');
});
test('votes are counted once per viewer for every timeline',()=>{
  openRound(45);
  assert.equal(vote('Alice','a'),true);assert.equal(vote('Alice','b'),false);
  assert.equal(handleChat('Bob','!b'),true);assert.equal(handleChat('alice','!a'),false);
  assert.deepEqual(state.votes,{a:1,b:1});assert.equal(state.totalVotes,2);
});
test('every collapsed reality changes persistent world state',()=>{
  openRound(45);handleChat('alice','!b');handleChat('bob','!b');handleChat('carol','!a');
  closeRound();assert.equal(state.phase,'reveal');assert.equal(state.winner,'b');assert.ok(state.world.harmony<50);
  const formerHarmony=state.world.harmony;
  openRound(45);assert.equal(state.round,2);assert.equal(state.theme.a.name,'ECHO');
  handleChat('alice','!a');closeRound();assert.ok(state.world.harmony>formerHarmony);
  assert.equal(state.history.length,2);assert.equal(state.world.memory,4);
});
test('ties resolve to A and are documented',()=>{
  openRound(45);handleChat('a','!a');handleChat('b','!b');closeRound();assert.equal(state.winner,'a');
});
test('spark command allows only one word per viewer per round',()=>{
  openRound(45);assert.equal(handleChat('alice','!spark Starlight'),true);assert.equal(handleChat('alice','!spark changed'),false);
  assert.equal(state.sparks[0].word,'starlight');
});
test('demo can simulate viewers but does not count votes outside the voting window',()=>{
  assert.equal(vote('alice','a'),false);simulate(16);assert.equal(state.phase,'voting');assert.ok(state.totalVotes>0);
  closeRound();assert.equal(vote('x','a'),false);
});

test('spark words permanently alter the visual genome of the next universe',()=>{
  openRound(45);handleChat('alice','!spark HOPE');handleChat('bob','!a');closeRound();
  const dnaA=state.world.dna;assert.ok(Number.isInteger(dnaA));
  resetWorld();openRound(45);handleChat('alice','!spark FEAR');handleChat('bob','!a');closeRound();
  assert.notEqual(state.world.dna,dnaA);assert.equal(state.history[0].dna,state.world.dna);assert.equal(state.world.words,1);
});

test('both futures branch from one snapshot and only the winner becomes reality',()=>{
  openRound(45);vote('alice','b');vote('bob','b');vote('carol','a');spark('alice','hope');
  const original={...state.world};
  closeRound();
  const entry=state.history[0];
  assert.deepEqual(entry.before,original);
  assert.equal(entry.futures.a.harmony,57);assert.equal(entry.futures.b.harmony,43);
  assert.equal(state.world.harmony,entry.futures.b.harmony);
  assert.equal(state.world.dna,entry.futures.b.dna);
  assert.notEqual(entry.futures.a.dna,entry.futures.b.dna);
  assert.equal(entry.futures.a.memory,entry.futures.b.memory);
  assert.equal(entry.theme.a.name,'AURORA');assert.equal(entry.futures.b.title,'SUPERNOVA');
  assert.match(entry.gene,/^[a-f0-9]{12}$/);
  const committed=structuredClone(state.world);
  projectFuture(entry.before,'a',entry.total,entry.sparks.map(word=>({word})));
  assert.deepEqual(state.world,committed,'inspecting an alternate must not commit it');
  openRound(45);assert.equal(state.world.dna,committed.dna);
  assert.equal(state.history[0].theme.a.name,'AURORA','past labels survive theme rotation');
});

test('zero is a valid visual genome and projections are deterministic and pure',()=>{
  const before={harmony:95,entropy:5,memory:4,words:2,dna:0};
  const original=structuredClone(before);
  const a=projectFuture(before,'a',0,[]),b=projectFuture(before,'b',0,[]);
  assert.deepEqual(before,original);assert.equal(a.dna,11);assert.equal(b.dna,43);
  assert.equal(a.harmony,95);assert.equal(a.entropy,5);
  assert.deepEqual(projectFuture(before,'a',0,[]),a);
});

test('expired votes and sparks are rejected before the countdown ticker runs',()=>{
  openRound(45);state.endsAt=Date.now()-1;
  assert.equal(vote('alice','a'),false);assert.equal(spark('alice','hope'),false);
  assert.equal(state.totalVotes,0);assert.equal(state.sparks.length,0);
});

test('a viewer cannot submit a second spark after leaving the display buffer',()=>{
  openRound(45);spark('alice','first');
  for(let i=0;i<12;i++)assert.equal(spark(`viewer${i}`,'star'),true);
  assert.equal(state.sparks.length,10);assert.equal(state.sparks.some(s=>s.name==='alice'),false);
  assert.equal(spark('alice','replacement'),false);
  closeRound();openRound(45);assert.equal(spark('alice','next round'),true);
});

test('reopening an active round preserves the community votes',()=>{
  assert.equal(openRound(45),true);vote('alice','a');const endsAt=state.endsAt;
  assert.equal(openRound(90),false);assert.equal(state.totalVotes,1);assert.equal(state.endsAt,endsAt);
});

test('simulation cannot mutate a live channel even through internal helpers',()=>{
  state.mode='live';
  assert.equal(simulate(16),false);assert.equal(state.phase,'idle');
  openRound(45);
  assert.equal(vote('fake','a','demo'),false);assert.equal(spark('fake','hope','demo'),false);
  assert.equal(state.totalVotes,0);assert.equal(state.sparks.length,0);
  assert.equal(handleChat('realviewer','!a'),true);
});

test('Twitch connection is confirmed by joining the requested room, not authentication',()=>{
  const written=[];const socket={write:value=>written.push(value),end:()=>written.push('ENDED')};
  processTwitchLine(':tmi.twitch.tv 001 testbot :Welcome',socket,'testroom','testbot');
  assert.equal(state.connected,false);
  processTwitchLine(':someone!someone@someone.tmi.twitch.tv JOIN #testroom',socket,'testroom','testbot');
  assert.equal(state.connected,false);
  processTwitchLine(':testbot!testbot@testbot.tmi.twitch.tv JOIN #wrongroom',socket,'testroom','testbot');
  assert.equal(state.connected,false);
  processTwitchLine('@room-id=1 :tmi.twitch.tv ROOMSTATE #testroom',socket,'testroom','testbot');
  assert.equal(state.connected,true);
  processTwitchLine('PING :tmi.twitch.tv',socket,'testroom','testbot');
  assert.deepEqual(written,['PONG :tmi.twitch.tv\r\n']);
  openRound(45);
  processTwitchLine('@display-name=Alice :alice!alice@alice.tmi.twitch.tv PRIVMSG #testroom :!a',socket,'testroom','testbot');
  processTwitchLine(':bob!bob@bob.tmi.twitch.tv PRIVMSG #wrongroom :!b',socket,'testroom','testbot');
  assert.deepEqual(state.votes,{a:1,b:0});
  processTwitchLine(':tmi.twitch.tv NOTICE * :Login authentication failed',socket,'testroom','testbot');
  assert.equal(state.connected,false);
  processTwitchLine(':bob!bob@bob.tmi.twitch.tv PRIVMSG #testroom :!b',socket,'testroom','testbot');
  assert.equal(state.totalVotes,1);
});
