'use strict';
// Records the real local app in explicitly labelled simulation mode.
// The export is a rehearsal: capture Twitch and Codex UI separately before submission.
const fs=require('node:fs/promises');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.PARALLAX_URL || 'http://127.0.0.1:3000';
const fps=10;
const width=1600,height=900;
const ffmpeg=process.env.FFMPEG_PATH;
if(!ffmpeg)throw new Error('Set FFMPEG_PATH to a local FFmpeg executable.');
const escapeHtml=text=>String(text).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
(async()=>{
 await fs.mkdir('video',{recursive:true});
 const output=path.resolve('video/PARALLAX-rehearsal.mp4');
 const encoder=spawn(ffmpeg,['-y','-hide_banner','-loglevel','error','-f','image2pipe','-vcodec','mjpeg','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-r','30','-movflags','+faststart',output],{stdio:['pipe','ignore','pipe']});
 let encoderErrors='';encoder.stderr.on('data',d=>encoderErrors+=d.toString());
 const completion=new Promise((resolve,reject)=>encoder.on('close',code=>code===0?resolve():reject(new Error('FFmpeg: '+encoderErrors))));
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
 const page=await browser.newPage({viewport:{width,height}});
 const overlay=await browser.newPage({viewport:{width,height}});
 let frames=0;
 async function caption(target,headline,detail){
  await target.evaluate(({headline,detail})=>{
   let box=document.getElementById('film-caption');
   if(!box){box=document.createElement('div');box.id='film-caption';document.body.append(box)}
   box.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:99999;padding:22px 50px 24px;background:linear-gradient(0deg,#06080b 55%,#06080be8 85%,transparent);color:#f3f4ef;pointer-events:none;text-align:center;font-family:Arial,sans-serif;';
   box.replaceChildren();const title=document.createElement('div');title.style.cssText='font-size:28px;font-weight:700;letter-spacing:-.6px;';title.textContent=headline;const text=document.createElement('div');text.style.cssText='font-size:15px;color:#d3e69a;letter-spacing:1px;margin-top:9px';text.textContent=detail;box.append(title,text);
  },{headline,detail});
 }
 async function capture(target,seconds,headline,detail,step){
  await caption(target,headline,detail);
  await target.bringToFront();
  const session=await target.context().newCDPSession(target);
  // A static title card may not emit a fresh CDP frame after restarting a
  // screencast. Seed with one real screenshot, then consume live frames.
  let frame=await target.screenshot({type:'jpeg',quality:90});
  session.on('Page.screencastFrame',event=>{frame=Buffer.from(event.data,'base64');session.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});});
  await session.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:width,maxHeight:height,everyNthFrame:2});
  const start=Date.now();
  for(let i=0;i<Math.round(seconds*fps);i++){
   if(step)await step(i);
   if(!encoder.stdin.write(frame))await once(encoder.stdin,'drain');
   frames++;
   const rest=start+(i+1)*1000/fps-Date.now();if(rest>0)await new Promise(r=>setTimeout(r,rest));
  }
  await session.send('Page.stopScreencast');await session.detach();
  console.log('Recorded '+(frames/fps)+'s: '+headline);
 }
 const command=async data=>{
  const r=await page.request.post(base+'/api/director',{data});if(!r.ok())throw new Error(await r.text());return(await r.json()).state;
 };
 try{
  await page.goto(base);await overlay.goto(base+'/overlay');
  const initial=await(await page.request.get(base+'/api/state')).json();if(initial.mode!=='demo')throw new Error('This rehearsal recorder only runs in demo mode.');
  await command({action:'reset'});
  await capture(overlay,8,'Your chat scrolls away. What if its choices stayed?','PARALLAX · THE BUTTERFLY EFFECT OF TWITCH · SIMULATION REHEARSAL');
  await page.locator('#duration').selectOption('90');await page.locator('#start-btn').click();
  await capture(page,12,'Two possible futures. One community decides.','Streamers open a rift. Viewers use !a, !b and !spark hope.',async i=>{
   if(i%12===0){const n=i/12;await command({action:'vote',name:'demo_viewer_'+n,branch:n<6?'a':'b'});if(n%3===0)await command({action:'spark',name:'demo_viewer_'+n,word:['hope','wonder','together','courage'][n/3]})}
  });
  await capture(overlay,12,'Every signal changes the universe on screen.','This capture uses simulated viewers. The real Twitch connector is separate.');
  await page.locator('#collapse-btn').click();
  await capture(page,8,'One future becomes canon. Its consequences remain.','The winning branch changes harmony, memory and the visual genome.');
  await page.locator('#reveal-dismiss').click();
  await page.locator('#butterfly-lens').scrollIntoViewIfNeeded();
  await capture(page,15,'And this is the future the chat never chose.','BUTTERFLY LENS · Same starting world. Same words. A different surviving branch.');
  await page.locator('#view-other').click();
  await capture(page,13,'Step into the unlived future.','A clearly labelled read-only what-if. The canonical universe stays unchanged.');
  await page.locator('#return-live').click();
  await page.locator('#start-btn').click();
  await page.locator('#stage').scrollIntoViewIfNeeded();
  await capture(page,12,'The next round begins inside the world you made.','New choices. The same accumulated memory, harmony and DNA.');
  await page.locator('#history').scrollIntoViewIfNeeded();
  await capture(page,10,'A community can revisit the choices that made it.','Recorded outcomes survive restart. Revisit any retained worldline.');
  const build=await fs.readFile('CODEX_BUILD_LOG.md','utf8').catch(()=> 'Authentic Codex thread: '+process.env.CODEX_THREAD_ID);
  const source=await fs.readFile('server.js','utf8');
  const index=source.indexOf('function projectFuture');
  const excerpt=source.slice(Math.max(0,index),Math.max(0,index)+2300);
  await page.setContent('<html><body style="margin:0;background:#090b11;color:#edf0e7;font-family:Arial;padding:45px 60px"><div style="color:#e6f78c;font-size:14px;letter-spacing:3px">PARALLAX / ACTUAL BUILD ARTIFACTS</div><h1 style="font-size:44px;margin:18px 0">Built and verified with Codex.</h1><div style="display:grid;grid-template-columns:1fr 1fr;gap:35px"><pre style="white-space:pre-wrap;font:14px/1.6 Consolas;color:#b9daca;max-height:560px;overflow:hidden">'+escapeHtml(build.slice(0,2400))+'</pre><pre style="white-space:pre-wrap;font:14px/1.6 Consolas;color:#e0ccae;max-height:560px;overflow:hidden">'+escapeHtml(excerpt)+'</pre></div></body></html>');
  await capture(page,17,'A real Codex build: mechanics, resilience and automated checks.','Build artifacts shown here. Record the actual Codex screen for the final submission.');
  await page.setContent('<html><body style="margin:0;background:radial-gradient(ellipse at 25% 60%,#153f36,transparent 55%),radial-gradient(ellipse at 85% 40%,#431c30,transparent 55%),#080a10;color:#f2f0eb;display:grid;place-items:center;height:100vh;text-align:center;font-family:Arial"><main><div style="font-size:17px;letter-spacing:7px;color:#e6f78c">PARALLAX.</div><h1 style="font-size:78px;letter-spacing:-5px;line-height:1.08;margin:35px">The audience didn’t watch<br>this universe.<br><span style="color:#e6f78c">They made it.</span></h1><p style="font-size:16px;letter-spacing:2px;color:#a4b8ac">ONE CHAT. INFINITE FUTURES.</p></main></body></html>');
  await capture(page,9,'','Rehearsal export · Replace with real Twitch and Codex footage before submitting.');
  encoder.stdin.end();await completion;
  await fs.writeFile('video/REHEARSAL_METADATA.json',JSON.stringify({file:path.basename(output),durationSeconds:frames/fps,width,height,fps:30,content:'Actual local app in simulation; build artifact view; original text and procedural visuals. No live Twitch footage or Codex UI footage.',readyForSubmission:false},null,2));
  console.log('Exported '+output+' ('+frames/fps+' seconds).');
 } finally {await browser.close();encoder.stdin.end();}
})().catch(e=>{console.error(e);process.exitCode=1});
