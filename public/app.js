(function(){
'use strict';
const $=id=>document.getElementById(id);
const cosmos=window.ParallaxCosmos.startCosmos($('cosmos'));
const lensCanvases={canon:window.ParallaxCosmos.startCosmos($('lens-canon-cosmos'),{mini:true}),other:window.ParallaxCosmos.startCosmos($('lens-other-cosmos'),{mini:true})};
let last=null,lastRevealId=null,toastTimer=0,selectedEntry=null,preview=null,streamReady=false;
const fmt=n=>String(n).padStart(3,'0'),dna=n=>String(n??137).padStart(4,'0');
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
function toast(msg){const e=$('toast');e.textContent=msg;e.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('show'),3500)}
const elapsed=iso=>{const d=Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/1000));return d<60?d+'s AGO':Math.floor(d/60)+'m AGO'};
function renderFeed(events){
 const holder=$('feed');holder.replaceChildren();
 for(const f of events.slice(0,7)){const row=el('div','feed-row '+f.kind),glyph=el('span','feed-glyph',f.kind==='vote'?'✧':f.kind==='spark'?'✳':f.kind==='reveal'?'◈':'↗'),body=el('div','feed-body');body.append(el('div','feed-headline',f.headline));if(f.detail)body.append(el('div','feed-detail',f.detail));body.append(el('div','feed-time',elapsed(f.at)));row.append(glyph,body);holder.append(row)}
}
function renderHistory(history){
 const holder=$('history');holder.replaceChildren();
 if(!history.length){holder.append(el('div','history-empty','NOTHING HAS HAPPENED YET  ✳  BE THE FIRST TO CHANGE EVERYTHING.'));return}
 for(const h of history){
 const row=el('div','history-row'),main=el('div','history-main'),name=el('strong','',h.title),stats=el('div','history-stats');
 name.style.color=h.winner==='a'?'var(--a)':'var(--b)';
 main.append(name,el('small','',(h.sparks?.length?h.sparks.join(' / '):'UNWRITTEN WORDS')+' · '+new Date(h.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})));
 stats.append(el('strong','',h.total+' SIGNALS'),el('div','','DNA '+dna(h.dna)+' · HARMONY '+h.harmony+'%'));
 row.append(el('div','history-index','#'+fmt(h.round)),main,stats);
 if(h.futures?.a&&h.futures?.b){const button=el('button','history-revisit','EXPLORE BOTH FUTURES ↗');button.type='button';button.setAttribute('aria-label','Explore both futures from round '+h.round);button.addEventListener('click',()=>{selectEntry(h);$('butterfly-lens').scrollIntoView({behavior:'smooth',block:'center'})});row.append(button)}
 holder.append(row);
 }
}
function futureState(entry,branch){return {...last,phase:'reveal',round:entry.round,world:entry.futures[branch],theme:entry.theme||last.theme,votes:entry.votes,totalVotes:entry.total,winner:branch,sparks:(entry.sparks||[]).map(word=>({name:'community',word})),participants:[]}}
function selectEntry(entry){
 if(!entry?.futures?.a||!entry?.futures?.b)return;
 selectedEntry=entry;$('butterfly-lens').hidden=false;
 const canonical=entry.futures[entry.winner],otherBranch=entry.winner==='a'?'b':'a',other=entry.futures[otherBranch];
 $('lens-round').textContent='WORLDLINE '+fmt(entry.round);
 $('lens-origin').textContent=entry.before.harmony+'% HARMONY · DNA '+dna(entry.before.dna);
 $('lens-gene').textContent=entry.gene?'GENE / '+entry.gene:'';
 for(const [prefix,future,branch] of [['canon',canonical,entry.winner],['other',other,otherBranch]]){
 $('lens-'+prefix+'-name').textContent=future.title;$('lens-'+prefix+'-name').closest('.lens-future').dataset.branch=branch;$('lens-'+prefix+'-harmony').textContent=future.harmony+'%';$('lens-'+prefix+'-meter').style.width=future.harmony+'%';
 $('lens-'+prefix+'-dna').textContent='DNA '+dna(future.dna)+' · '+future.memory+' REMEMBERED VOTES';
 lensCanvases[prefix].setState(futureState(entry,branch));
 }
 $('lens-difference').textContent='A '+Math.abs(canonical.harmony-other.harmony)+'-point difference in harmony. The same votes and words, a different surviving branch. Only the chosen future changes the world.';
}
function enterPreview(branch){if(!selectedEntry||!last)return;preview={entry:selectedEntry,branch};$('reveal').hidden=true;renderStage(futureState(selectedEntry,branch));$('stage').scrollIntoView({behavior:'smooth',block:'start'});$('return-live').focus({preventScroll:true})}
function renderConnection(s){
 const live=s.mode==='live',connected=live&&s.connected&&streamReady;
 $('live-pill').classList.toggle('is-live',connected);
 $('connection-text').textContent=!streamReady?'WORLD ENGINE RECONNECTING':live?(connected?'CONNECTED TO TWITCH':'TWITCH DISCONNECTED'):'SIMULATION MODE';
 $('status-dot').classList.toggle('active',connected);
 $('status-text').textContent=!streamReady?'World engine reconnecting':live?(connected?'Twitch is listening':'Twitch disconnected'):'Offline simulation';
 $('status-helper').textContent=!streamReady?'Displayed state may be out of date.':live?(connected?'Chat drives every choice.':'Check your credentials and network.'):'No account needed to explore.';
 $('channel-text').textContent=live?'#'+s.channel.toUpperCase():'DEMO UNIVERSE';
}
function updateCountdown(s=last){if(!s||preview)return;$('reality-time').textContent=s.phase==='voting'?Math.max(0,Math.ceil((s.endsAt-Date.now())/1000))+'s UNTIL REALITY COLLAPSES':s.phase==='reveal'?'NEW TIMELINE COMMITTED':'AWAITING ACTIVATION'}
function renderStage(s){
 cosmos.setState(s);
 const a=s.votes.a,b=s.votes.b,total=a+b,pA=total?Math.round(a/total*100):50;
 $('name-a').textContent=s.theme.a.name;$('name-b').textContent=s.theme.b.name;$('desc-a').textContent=s.theme.a.tagline;$('desc-b').textContent=s.theme.b.tagline;
 $('percent-a').textContent=pA+'%';$('percent-b').textContent=(100-pA)+'%';$('bar-a').style.width=pA+'%';$('bar-b').style.width=(100-pA)+'%';
 $('votes-a').textContent=a+' '+(a===1?'SIGNAL':'SIGNALS');$('votes-b').textContent=b+' '+(b===1?'SIGNAL':'SIGNALS');$('world-dna').textContent=dna(s.world.dna);
 $('preview-banner').hidden=!preview;$('stage').classList.toggle('is-preview',Boolean(preview));
 if(preview){
 const canon=preview.branch===preview.entry.winner;
 $('preview-caption').textContent='WORLDLINE '+fmt(preview.entry.round)+' · '+(canon?'RECORDED CANON':'UNCHOSEN BRANCH');
 $('hero-heading').replaceChildren(el('span','',canon?'A moment remembered.':'A future never lived.'),el('em','',s.theme[preview.branch].name));
 $('hero-subtitle').textContent=s.world.harmony+'% harmony · Genome '+dna(s.world.dna)+'. This is a read-only '+(canon?'replay':'what-if')+'; the live universe continues unchanged.';
 $('reality-time').textContent='READ-ONLY PREVIEW · LIVE CONTROLS BELOW';
 }else{
 $('hero-heading').innerHTML=s.phase==='voting'?'The future is<br><em>unwritten.</em>':s.phase==='reveal'?'Your chat changed<br><em>everything.</em>':'One chat.<br><em>Infinite futures.</em>';
 $('hero-subtitle').textContent=s.phase==='voting'?'Two possible worlds. A single choice. Every vote bends the fabric of what comes next.':s.phase==='reveal'?'One timeline survived. Explore the unchosen future below — then carry your world into the next round.':'Every voice becomes a star. Every decision changes the world. Two realities await — your community makes one real.';
 updateCountdown(s);
 }
 $('spark-text').textContent=s.sparks.length?'✳ '+s.sparks[0].name.toUpperCase()+' PLANTED "'+s.sparks[0].word.toUpperCase()+'"':'SEND !SPARK HOPE TO LEAVE A MARK';
 $('realm-a').classList.toggle('winner-card',s.phase==='reveal'&&s.winner==='a');$('realm-b').classList.toggle('winner-card',s.phase==='reveal'&&s.winner==='b');
}
function render(s){
 if(!s)return;
 const historyChanged=!last||last.history[0]?.round!==s.history[0]?.round||last.history.length!==s.history.length;last=s;
 renderStage(preview?futureState(preview.entry,preview.branch):s);
 $('cmd-a').textContent=s.theme.a.name;$('cmd-b').textContent=s.theme.b.name;$('metric-viewers').textContent=fmt(s.uniqueViewers);$('metric-memory').textContent=fmt(s.world.words||0);$('metric-harmony').textContent=s.world.harmony;$('metric-worlds').textContent=String(s.history.length).padStart(2,'0');$('session-no').textContent=fmt(s.round);$('phase-label').textContent=s.phase.toUpperCase();
 $('start-btn').disabled=s.phase==='voting';$('collapse-btn').disabled=s.phase!=='voting';$('simulate-btn').disabled=s.mode==='live';$('simulate-btn').title=s.mode==='live'?'Demo injection is disabled in live mode':'';
 renderConnection(s);renderFeed(s.feed);
 if(historyChanged){renderHistory(s.history);if(s.history[0]?.futures)selectEntry(s.history[0]);else{$('butterfly-lens').hidden=true;selectedEntry=null}}
 const revealId=s.phase==='reveal'?s.round+':'+s.winner:null;
 if(revealId!==lastRevealId){$('reveal').hidden=!revealId||Boolean(preview);if(revealId){$('reveal-title').textContent=s.theme[s.winner].name;$('reveal-detail').textContent=s.totalVotes+' VOICES CHOSE THIS FUTURE · HARMONY '+s.world.harmony+'%'}lastRevealId=revealId}
}
const events=new EventSource('/events');
events.addEventListener('state',e=>{try{streamReady=true;render(JSON.parse(e.data))}catch(err){console.warn('Could not render state',err)}});
events.onerror=()=>{streamReady=false;$('director-feedback').textContent='RECONNECTING…';if(last)renderConnection(last)};
events.onopen=()=>{$('director-feedback').textContent='READY FOR INPUT'};
setInterval(()=>updateCountdown(),200);
async function action(name,params={}){
 const buttons=[$('start-btn'),$('simulate-btn'),$('collapse-btn'),$('reset-btn')];buttons.forEach(b=>b.dataset.busy='1');
 try{const response=await fetch('/api/director',{method:'POST',headers:{'Content-Type':'application/json','X-Control-Key':$('control-key').value},body:JSON.stringify({action:name,...params})});const json=await response.json();if(!response.ok)throw new Error(json.error||'HTTP '+response.status);render(json.state);return true}
 catch(err){toast(err.message);return false}finally{buttons.forEach(b=>delete b.dataset.busy)}
}
$('start-btn').addEventListener('click',()=>action('open',{duration:Number($('duration').value)}));
$('simulate-btn').addEventListener('click',()=>action('simulate',{count:16}));
$('collapse-btn').addEventListener('click',()=>action('collapse'));
$('reset-btn').addEventListener('click',()=>{if(confirm('Start a new universe? All prior decisions will be cleared.')){preview=null;action('reset')}});
$('reveal-dismiss').addEventListener('click',()=>{$('reveal').hidden=true;if(selectedEntry)$('butterfly-lens').scrollIntoView({behavior:'smooth',block:'center'})});
$('view-canon').addEventListener('click',()=>enterPreview(selectedEntry?.winner));
$('view-other').addEventListener('click',()=>enterPreview(selectedEntry?.winner==='a'?'b':'a'));
$('return-live').addEventListener('click',()=>{preview=null;if(last)renderStage(last);$('view-other').focus({preventScroll:true})});
fetch('/api/state').then(r=>r.json()).then(render).catch(()=>toast('Could not reach PARALLAX server.'));
})();
