"use strict";

// Sparse decorative motion, independent of the content and stopped when inactive.
window.createAmbience = function(canvas) {
  const ctx = canvas.getContext("2d");
  const effects = Object.fromEntries(Object.entries(window.LANDSCAPES).filter(([, world]) => world.ambience === "snow").map(([id]) => [id, "snow"]));
  let frame=0, previous=0, effect="", particles=[], running=false, width=0, height=0;
  function resize() {
    width=innerWidth; height=innerHeight;
    const dpr=Math.min(devicePixelRatio||1,1.5);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function reset() {
    particles=Array.from({length:innerWidth<700?18:32},()=>({
      x:Math.random(),y:Math.random(),depth:.25+Math.random()*.75,phase:Math.random()*Math.PI*2
    }));
  }
  function render(time) {
    if(!running)return;
    frame=requestAnimationFrame(render);
    if(previous && time-previous<32)return;
    const dt=previous?Math.min((time-previous)/1000,.06):0; previous=time;
    if(width!==innerWidth||height!==innerHeight)resize();
    ctx.clearRect(0,0,width,height);
    particles.forEach(p=>{
      p.phase+=dt*.4;
      if(effect==="snow") {
        p.y=(p.y+dt*(.012+.025*p.depth))%1;
        p.x=(p.x+dt*.005+Math.sin(p.phase)*dt*.004+1)%1;
        ctx.fillStyle="rgba(228,243,255,"+(.18+p.depth*.3)+")";
        ctx.beginPath();ctx.arc(p.x*width,p.y*height,.6+p.depth*1.4,0,Math.PI*2);ctx.fill();
      }
    });
  }
  function stop() {
    running=false;cancelAnimationFrame(frame);previous=0;
    ctx.clearRect(0,0,width,height);canvas.dataset.running="false";
  }
  return {
    supports:id=>Boolean(effects[id]),
    set(id,enabled) {
      const next=effects[id]||"";
      if(effect!==next){stop();effect=next;reset();}
      canvas.dataset.effect=effect;
      if(!enabled||!effect){stop();return;}
      if(running)return;
      resize();running=true;canvas.dataset.running="true";frame=requestAnimationFrame(render);
    },
    stop
  };
};
