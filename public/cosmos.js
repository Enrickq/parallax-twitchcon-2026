/** PARALLAX procedural cosmic stage. No textures, APIs, audio, or paid assets. */
(function(global){
  'use strict';
  const TAU=Math.PI*2;
  function seeded(n){let x=Math.sin(n*127.1+43.29)*43758.5453;return x-Math.floor(x)}
  function startCosmos(canvas,{overlay=false,mini=false}={}){
    if(!canvas)return {setState(){},destroy(){}};
    const ctx=canvas.getContext('2d',{alpha:true});
    if(!ctx)return {setState(){},destroy(){}};
    const reduced=global.matchMedia&&global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const particles=Array.from({length:mini?110:240},(_,i)=>({group:i%2,angle:seeded(i+10)*TAU,rad:Math.pow(seeded(i+234),.73),size:.6+seeded(i+345)*2.3,speed:.12+seeded(i+655)*.5,phase:seeded(i+718)*TAU,glow:seeded(i+857),twist:seeded(i+165)*.8}));
    const stars=Array.from({length:180},(_,i)=>({x:seeded(i+456),y:seeded(i+1253),size:.2+seeded(i+592)*1.2,phase:seeded(i+1254)*TAU}));
    const sprites=Array.from({length:26},(_,i)=>({angle:seeded(i+119)*TAU,rad:seeded(i+129),speed:.12+seeded(i+130)*.2,size:2+seeded(i+190)*3}));
    let width=0,height=0,dpr=1,animationId=0,epoch=performance.now();
    let latest={phase:'idle',votes:{a:0,b:0},world:{harmony:50},winner:null,totalVotes:0,participants:[]};
    let prevImpact=0;
    function setSize(){
      const r=canvas.getBoundingClientRect();
      width=Math.max(1,Math.floor(r.width));height=Math.max(1,Math.floor(r.height));
      dpr=Math.min(2,global.devicePixelRatio||1);
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    function glow(x,y,r,red,green,blue,intensity){
      const gr=ctx.createRadialGradient(x,y,0,x,y,Math.max(1,r));
      gr.addColorStop(0,`rgba(${red},${green},${blue},${.28*intensity})`);
      gr.addColorStop(.28,`rgba(${red},${green},${blue},${.085*intensity})`);
      gr.addColorStop(1,`rgba(${red},${green},${blue},0)`);
      ctx.fillStyle=gr;ctx.fillRect(x-r,y-r,r*2,r*2);
    }
    function paint(now){
      if(!width||!height)setSize();
      const t=reduced?7:(now-epoch)/1000;
      const total=latest.votes?.a+latest.votes?.b||0;
      const percA=total?latest.votes.a/total:.5;
      const percB=1-percA;
      const harmony=latest.world?.harmony??50;
      const dna=(latest.world?.dna??137)/997;
      const resolved=latest.phase==='reveal';
      const scale=overlay?1.4:1;
      const centerY=mini?height*.49:overlay?height*.53:height*.43;
      const rbase=mini?Math.min(width*.37,height*.39):Math.min(width*(overlay?.24:.23),height*(overlay?.28:.24));
      const worlds=[{x:width*.245,y:centerY,p:percA,red:125,green:255,blue:208,dim:resolved&&latest.winner==='b'},
                    {x:width*.755,y:centerY,p:percB,red:255,green:132,blue:122,dim:resolved&&latest.winner==='a'}];
      if(mini){for(const w of worlds){w.x=width*.5;w.dim=false;w.p=.6}const chosen=worlds[latest.winner==='b'?1:0];for(const w of worlds){w.red=chosen.red;w.green=chosen.green;w.blue=chosen.blue}}
      ctx.clearRect(0,0,width,height);
      if(overlay){
        const gradient=ctx.createRadialGradient(width*.5,height*.55,15,width*.5,height*.55,width*.68);
        gradient.addColorStop(0,'rgba(7,8,18,.78)');gradient.addColorStop(.7,'rgba(7,9,16,.35)');gradient.addColorStop(1,'rgba(7,8,12,0)');
        ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
      }
      for(const s of stars){
        const twinkle=.32+.45*Math.sin(t*(.25+s.size*.18)+s.phase)**2;
        ctx.fillStyle=`rgba(204,225,231,${twinkle*.58})`;
        ctx.fillRect(((s.x+dna*.17)%1)*width,((s.y+dna*.09)%1)*height,s.size*scale,s.size*scale);
      }
      glow(width*.5,centerY,rbase*1.95,147,130,255,.23);
      for(let j=0;j<worlds.length;j++){
        const w=worlds[j], prominence=(.7+w.p*.7)*(w.dim?.32:1),r=rbase*(1+w.p*.28)*scale;
        glow(w.x,w.y,r*2.3,w.red,w.green,w.blue,.85*prominence);
        glow(w.x,w.y,r*.57,w.red,w.green,w.blue,.45*prominence);
        // Fine orbital rings react to votes. Offset rotations produce butterfly wings.
        ctx.save();ctx.translate(w.x,w.y);ctx.rotate(j===0?-.25:.25);
        for(let ring=0;ring<5;ring++){
          const rad=r*(.52+ring*.15);
          ctx.beginPath();ctx.ellipse(0,0,rad,rad*(.32+ring*.04+dna*.25),t*(ring%2?-.05:.07)+ring+dna*TAU,0,TAU);
          ctx.strokeStyle=`rgba(${w.red},${w.green},${w.blue},${(.06+(ring===2?.06:0))*prominence})`;
          ctx.lineWidth=.7;ctx.stroke();
        }
        ctx.restore();
        // Slow swirling prismatic filament curves.
        for(let arm=0;arm<5;arm++){
          ctx.beginPath();
          for(let k=0;k<65;k++){
            const f=k/64,ang=t*(j===0?.08:-.075)+arm*TAU/5+f*5.4*(j===0?1:-1);
            const rr=r*(.11+f*.94);const x=w.x+Math.cos(ang)*rr;const y=w.y+Math.sin(ang)*rr*.63;
            if(!k)ctx.moveTo(x,y);else ctx.lineTo(x,y);
          }
          ctx.strokeStyle=`rgba(${w.red},${w.green},${w.blue},${(.065+arm*.007)*prominence})`;
          ctx.lineWidth=1.15;ctx.stroke();
        }
      }
      // Filaments between futures: shared history makes worlds entangled.
      const x1=worlds[0].x,x2=worlds[1].x;
      for(let i=0;i<(mini?0:9);i++){
        const sine=Math.sin(t*.32+i*.97);
        ctx.beginPath();ctx.moveTo(x1+15,centerY+(i-4)*4);
        ctx.bezierCurveTo(width*.43,centerY+(i-4)*22+sine*21,width*.58,centerY-(i-4)*14-sine*18,x2-15,centerY+(i-4)*5);
        ctx.lineWidth=.35+(i%3)*.2;
        ctx.strokeStyle=`rgba(${i%2?'255,163,146':'149,255,219'},${.03+(total>0?.025:0)})`;ctx.stroke();
      }
      for(const p of particles){
        const w=worlds[p.group],dir=p.group===0?1:-1;
        const rad=rbase*(.10+p.rad*1.09)*(1+w.p*.22)*scale;
        const a=p.angle+dir*t*p.speed*.26+p.rad*dir*(2.9+dna*2.8)+dna*TAU*.65;
        const jitter=Math.sin(t*.55+p.phase)*3.5;
        const x=w.x+Math.cos(a)*(rad+jitter);
        const y=w.y+Math.sin(a)*(rad*(.43+dna*.26)+jitter)+Math.sin(a*(1.5+dna)+t*.2+p.phase)*rbase*(.05+dna*.07);
        const alpha=(.11+.62*p.glow)*(.58+w.p*.7)*(w.dim?.22:1)*(.75+.25*Math.sin(t*1.2+p.phase));
        ctx.beginPath();ctx.arc(x,y,p.size*(overlay?1.25:1),0,TAU);
        ctx.fillStyle=`rgba(${w.red},${w.green},${w.blue},${alpha})`;ctx.fill();
        if(p.glow>.96){glow(x,y,7,w.red,w.green,w.blue,.18)}
      }
      for(let i=0;i<sprites.length;i++){
        const s=sprites[i],w=worlds[i%2],a=s.angle+t*s.speed*(i%2?-1:1);
        const rr=rbase*(.24+s.rad*.75),x=w.x+Math.cos(a)*rr,y=w.y+Math.sin(a)*rr*.62;
        ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle=`rgba(${w.red},${w.green},${w.blue},${.2+.22*Math.sin(t*.65+s.angle)**2})`;
        ctx.fillRect(-s.size/2,-.45,s.size,.9);ctx.restore();
      }
      // A singularity at the point where the multiverse touches.
      const cx=width*.5;
      glow(cx,centerY,35,224,249,216,.37);
      ctx.beginPath();ctx.arc(cx,centerY,3+Math.sin(t*2)*1,0,TAU);
      ctx.fillStyle='#e9ffd6';ctx.fill();
      if(total>0){
        const count=Math.min(60,total);
        for(let i=0;i<count;i++){
          const p=particles[(i+50)%particles.length],w=worlds[p.group],a=t*.2+p.angle+i*.2;
          const x=w.x+Math.cos(a)*rbase*(.5+p.rad*.5),y=w.y+Math.sin(a)*rbase*.54;
          ctx.beginPath();ctx.arc(x,y,1.5+(i%4)*.28,0,TAU);
          ctx.fillStyle=`rgba(255,255,243,${.18+.35*Math.sin(t+i)**2})`;ctx.fill();
        }
      }
      if(!reduced)animationId=global.requestAnimationFrame(paint);
    }
    setSize();
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(setSize):null;
    if(observer)observer.observe(canvas);
    global.addEventListener('resize',setSize);
    animationId=global.requestAnimationFrame(paint);
    return {setState(s){latest=s||latest;if(reduced)paint(performance.now())},destroy(){global.cancelAnimationFrame(animationId);global.removeEventListener('resize',setSize);if(observer)observer.disconnect()}};
  }
  global.ParallaxCosmos={startCosmos};
})(window);
