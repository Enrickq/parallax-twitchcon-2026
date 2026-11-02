(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const cosmos=window.ParallaxCosmos.startCosmos($('cosmos'),{overlay:true});
  let latest=null,shownReveal='',hiddenTimer;
  function draw(s){
    latest=s;cosmos.setState(s);
    $('overlay-status').textContent=s.mode==='demo'?'◌ DEMO PREVIEW · NOT CONNECTED TO TWITCH':s.connected?'● TWITCH CHAT CONNECTED':'◌ TWITCH DISCONNECTED';
    $('overlay-genome').textContent=`WORLD DNA / ${String(s.world.dna??137).padStart(4,'0')} · HARMONY / ${s.world.harmony}% · ${s.history.length} WORLDLINES`;
    const total=s.votes.a+s.votes.b;
    const a=total?s.votes.a/total*100:50;
    $('overlay-name-a').textContent=s.theme.a.name;
    $('overlay-name-b').textContent=s.theme.b.name;
    $('overlay-bar-a').style.width=a+'%';$('overlay-bar-b').style.width=(100-a)+'%';
    $('overlay-title').innerHTML=s.phase==='voting'?'Your chat.<br><em>Your universe.</em>':s.phase==='reveal'?'One choice.<br><em>Forever changed.</em>':'Two futures.<br><em>One reality.</em>';
    $('overlay-spark').textContent=s.sparks.length?`✳ ${s.sparks[0].name.toUpperCase()} PLANTED ${s.sparks[0].word.toUpperCase()}`:'PLANT A WORD: !SPARK HOPE';
    $('overlay-clock').textContent=s.phase==='voting'?`${Math.max(0,Math.ceil((s.endsAt-Date.now())/1000))} SECONDS LEFT · ${total} VOTES`:'AWAITING THE NEXT WORLDLINE';
    if(s.phase==='reveal'){
      const key=`${s.round}:${s.winner}`;
      if(shownReveal!==key){
        shownReveal=key;$('overlay-winner-name').textContent=s.theme[s.winner].name;
        $('overlay-winner').hidden=false;clearTimeout(hiddenTimer);
        hiddenTimer=setTimeout(()=>{$('overlay-winner').hidden=true},8000);
      }
    } else {$('overlay-winner').hidden=true;shownReveal='';clearTimeout(hiddenTimer)}
  }
  const events=new EventSource('/events');events.addEventListener('state',e=>{try{draw(JSON.parse(e.data))}catch{}});
  events.onerror=()=>{$('overlay-status').textContent='◌ WORLD ENGINE DISCONNECTED · STATE MAY BE STALE'};
  setInterval(()=>{if(latest?.phase==='voting')$('overlay-clock').textContent=`${Math.max(0,Math.ceil((latest.endsAt-Date.now())/1000))} SECONDS LEFT · ${latest.totalVotes} VOTES`},200);
  fetch('/api/state').then(r=>r.json()).then(draw).catch(()=>{});
})();
