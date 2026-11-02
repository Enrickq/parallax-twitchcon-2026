'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const ffmpeg=process.env.FFMPEG_PATH;
if(!ffmpeg)throw new Error('Set FFMPEG_PATH.');
function wavSeconds(buffer){
 let rate=0,bytes=0;
 for(let offset=12;offset+8<=buffer.length;){
  const kind=buffer.toString('ascii',offset,offset+4),size=buffer.readUInt32LE(offset+4);
  if(kind==='fmt ')rate=buffer.readUInt32LE(offset+16);
  if(kind==='data')bytes+=size;
  offset+=8+size+(size%2);
 }
 if(!rate||!bytes)throw new Error('Invalid WAV');
 return bytes/rate;
}
const stamp=s=>{const ms=Math.round(s*1000);return [Math.floor(ms/3600000),Math.floor(ms/60000)%60,Math.floor(ms/1000)%60].map(x=>String(x).padStart(2,'0')).join(':')+','+String(ms%1000).padStart(3,'0')};
(async()=>{
 const segments=JSON.parse(await fs.readFile('scripts/narration.json','utf8'));
 const args=['-y','-hide_banner','-loglevel','error','-i','video/PARALLAX-rehearsal.mp4'];
 const filters=[],labels=[];let srt='',cue=1;
 for(let i=0;i<segments.length;i++){
  const segment=segments[i],file=path.join('video',segment.file);
  const length=wavSeconds(await fs.readFile(file));
  const available=segment.duration-.45;
  const tempo=Math.max(1,length/available);
  args.push('-i',file);
  filters.push('['+(i+1)+':a]atempo='+tempo.toFixed(5)+',adelay='+Math.round((segment.start+.18)*1000)+':all=1[a'+i+']');labels.push('[a'+i+']');
  const words=segment.text.split(/\s+/),blocks=Math.ceil(words.length/11);
  for(let j=0;j<blocks;j++){
   const first=segment.start+.18+available*j/blocks,last=segment.start+.18+available*(j+1)/blocks;
   srt+=cue+++'\n'+stamp(first)+' --> '+stamp(last)+'\n'+words.slice(j*11,(j+1)*11).join(' ')+'\n\n';
  }
 }
 const duration=segments.at(-1).start+segments.at(-1).duration;
 filters.push(labels.join('')+'amix=inputs='+segments.length+':normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,apad[mix]');
 args.push('-filter_complex',filters.join(';'),'-map','0:v','-map','[mix]','-t',String(duration),'-c:v','copy','-c:a','aac','-b:a','160k','-movflags','+faststart','video/PARALLAX-demo-rehearsal-narrated.mp4');
 const result=spawnSync(ffmpeg,args,{encoding:'utf8',maxBuffer:10*1024*1024});if(result.status!==0)throw new Error(result.stderr);
 await fs.writeFile('video/PARALLAX-English.srt',srt.trimEnd()+'\n');
 console.log('Narrated rehearsal exported: '+duration+'s. English captions written. Not yet a compliant Twitch/Codex capture.');
})().catch(e=>{console.error(e);process.exitCode=1});
