// Opt-in player-only movement experiment. Native collisions, jump, jetpack,
// weapon handling and articulated crouch rendering remain authoritative.
import sdWorld from '../sdWorld.js';
import sdKeyStates from '../sdKeyStates.js';

export const tuning={minStartSpeed:3,minEndSpeed:1.2,maxSpeed:8,durationMs:1100,deceleration:0.18,recoveryMs:300};
const states=new WeakMap();
// Append, rather than reindex, key IDs. This module is never imported by servers
// or original modes; the already-created local input object also needs this key.
sdKeyStates.default_state.KeyH=0;
sdKeyStates.default_state_keys.push('KeyH');
sdWorld.my_key_states.key_states.KeyH=0;sdWorld.my_key_states.one_taps.KeyH=sdWorld.frame-1;

const slide={
 tuning,
 has:e=>states.has(e),
 state:e=>states.get(e),
 sliding:e=>states.get(e)?.active===true,
 attach(p){states.set(p,{active:false,time:0,remaining:0,recovery:0,held:false,direction:0,reason:'ready'});p._jetpack_allowed=true;},
 end(e,reason){const s=states.get(e);if(s.active){s.active=false;s.recovery=tuning.recoveryMs;s.reason=reason;}},
 refresh(e){if(e._hitbox_y1!==e.hitbox_y1){e._hitbox_last_update=-Infinity;e.UpdateHitbox();sdWorld.UpdateHashPosition(e,false);}},
 before(e,gspeed){
  const s=states.get(e),dt=gspeed*1000/30,keys=e._key_states;
  s.time+=dt;s.recovery=Math.max(0,s.recovery-dt);
  const pressed=!!keys.GetKey('KeyH'),edge=pressed&&!s.held;s.held=pressed;
  const jump=keys.GetKey('Space')||keys.GetKey('KeyW');
  const safe=e.hea>0&&!e.driver_of&&!e._in_water&&e._frozen<=0&&e.stability>=50;
  if(s.active&&(!safe||jump||!e.stands||s.remaining<=0||Math.abs(e.sx)<tuning.minEndSpeed||Math.sign(e.sx)!==s.direction))
   this.end(e,!safe?'interrupted':jump?'jump':!e.stands?'airborne':'momentum exhausted');
  if(edge&&!s.active&&s.recovery===0&&safe&&e.stands&&!jump&&Math.abs(e.sx)>=tuning.minStartSpeed){
   s.active=true;s.remaining=tuning.durationMs;s.direction=Math.sign(e.sx);s.reason='sliding';
   e.sx=s.direction*Math.min(tuning.maxSpeed,Math.abs(e.sx)); // No launch boost.
  }
  if(s.active){e._crouch_intens=Math.max(1,e._crouch_intens);e.PhysWakeUp();this.refresh(e);}
 },
 ground(e,gspeed){
  const s=states.get(e);if(!s.active)return false;
  e.sx=Math.sign(e.sx)*Math.max(0,Math.abs(e.sx)-tuning.deceleration*gspeed);
  s.remaining-=gspeed*1000/30;
  return true;
 },
 after(e){
  const s=states.get(e);
  if(s.active&&(e.hea<=0||Math.abs(e.sx)<tuning.minEndSpeed))this.end(e,e.hea<=0?'death':'collision / exhausted');
  this.refresh(e); // Update native cached box/hash after posture changes.
 },
 buildArea(a){
  for(let x=-896;x< -352;x+=32)a.block(x,-64,32,32,true);
  // 24-unit clearance: native crouch fits, native standing does not.
  for(let x=-672;x< -544;x+=32)a.block(x,-96,32,8,true);
  a.block(-480,-128,64,16,true);a.block(-384,-128,32,64,true);
  a.block(-528,-72,16,8,true); // Low obstacle; normal crouch step rules apply.
  const wait=setInterval(()=>{
   const bar=document.getElementById('combat-controls');if(!bar)return;clearInterval(wait);
   if(document.getElementById('movement-traversal'))return;
   const button=document.createElement('button');button.id='movement-traversal';button.textContent='Traversal lane';
   button.onclick=()=>{const p=sdWorld.my_entity;if(!p||p.hea<=0)return;
    this.attach(p);p._crouch_intens=0;p.x=-848;p.y=-80;p.sx=p.sy=0;p.stands=false;p._stands_on=null;
    sdWorld.camera.x=p.x;sdWorld.camera.y=p.y;
    this.refresh(p);sdWorld.UpdateHashPosition(p,false);button.blur();};bar.append(button);
   const info=document.createElement('span');info.textContent='H: slide · Native jetpack supplied · No invulnerability';bar.append(info);
   const out=document.createElement('pre');out.hidden=true;out.style.cssText='position:fixed;left:8px;top:65px;background:#111d;color:white;font:13px monospace;pointer-events:none;z-index:10002';document.body.append(out);
   const debug=document.createElement('button');debug.textContent='Movement diagnostics';debug.onclick=()=>{out.hidden=!out.hidden;debug.blur();};bar.append(debug);
   setInterval(()=>{if(out.hidden)return;const p=sdWorld.my_entity,s=states.get(p);if(!s)return;
    out.textContent=`Movement prototype · ${s.active?'SLIDING':s.reason}\nspeed ${p.sx.toFixed(2)} / vy ${p.sy.toFixed(2)}\nground ${p.stands} · jetpack ${p.flying}\nbox ${p._hitbox_y1.toFixed(1)}..${p._hitbox_y2.toFixed(1)} · clear to stand ${p.CanUnCrouch()}\nremaining ${Math.max(0,s.remaining).toFixed(0)} ms · recovery ${s.recovery.toFixed(0)} ms`;
   },150);
  },100);
 }
};
globalThis.sdMovementPrototype=slide;
