// Optional tuning policy around sdCharacter.AILogic, not a replacement AI.
import sdWorld from '../sdWorld.js';
import sdCharacter from '../entities/sdCharacter.js';
import sdEntity from '../entities/sdEntity.js';
import sdCom from '../entities/sdCom.js';

export const skills = {
 basic: {reactionMin:450,reactionMax:650,settle:1100,initialError:12,error:3.5,turn:150,movement:1,targetSpeed:1,heat:5,memory:1100,near:100,far:220},
 intermediate: {reactionMin:320,reactionMax:500,settle:850,initialError:8,error:2,turn:230,movement:0.65,targetSpeed:0.65,heat:3.5,memory:1500,near:130,far:260},
 advanced: {reactionMin:250,reactionMax:380,settle:650,initialError:5,error:1,turn:320,movement:0.4,targetSpeed:0.4,heat:2,memory:1800,near:160,far:300}
};
const states=new WeakMap();
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const humanoidAI={
 skills,
 has:e=>states.has(e),
 state:e=>states.get(e),
 attach(e,tier) {states.set(e,{tier,cfg:skills[tier],seed:(e._net_id+1)>>>0,time:0,scan:0,target:null,visible:false,phase:'idle',lastSeen:-Infinity,x:e.x+100,y:e.y,track:0,heat:0,error:0,readyAt:Infinity,reaction:0,angle:Math.atan2(e.look_y-e.y,e.look_x-e.x),previousFire:false,moveAt:0,lastMoveX:e.x,targetSpeed:0,passive:e._ai_enabled===sdCharacter.AI_MODEL_NONE,idleSide:e.look_x<e.x?-1:1});},
 reset(e) {const s=states.get(e);if(s){this.attach(e,s.tier);if(s.passive)states.get(e).idleSide=s.idleSide;}},
 setHostile(e,hostile){
  e._ai_enabled=hostile?e._combatModel:sdCharacter.AI_MODEL_NONE;
  e._init_ai_model=e._ai_enabled;e._ai=null;e._key_states.Reset();e.act_x=e.act_y=0;
  e._ai_attack_time=0;e._ai_force_fire=false;e.auto_shoot_in=0;
  this.reset(e);
  const s=states.get(e);s.passive=!hostile;s.phase=hostile?'idle':'passive';
  if(e.hea>0){
   if(!sdWorld.server_config.physical_combat?.blocked(e))e.sx=0;
   e.SetHiberState(sdEntity.HIBERSTATE_ACTIVE);
  }
 },
 passiveTurn:180, // Degrees / simulated second; independent of active skill tiers.
 passive(e,gspeed){
  const s=states.get(e);if(!s?.passive||e.hea<=0)return;
  e._ai=null;e._key_states.Reset();e.act_x=e.act_y=0;e.auto_shoot_in=0;e._ai_force_fire=false;
  s.target=null;s.visible=false;s.readyAt=Infinity;s.previousFire=false;s.phase='passive';
  if(sdWorld.server_config.physical_combat?.blocked(e))return; // Never pose a critical body upright.
  s.time+=gspeed*1000/30;
  const delta=wrap((s.idleSide<0?Math.PI:0)-s.angle),step=this.passiveTurn*Math.PI/180*gspeed/30;
  s.angle+=clamp(delta,-step,step);
  e.look_x=e.x+Math.cos(s.angle)*160;e.look_y=e.y-3+Math.sin(s.angle)*160;
  if(Math.abs(delta)>0.001)e.PhysWakeUp(); // Finish settling before native sleep.
 },
 random(s) {s.seed=(Math.imul(1664525,s.seed)+1013904223)>>>0;return s.seed/4294967296;},
 before(e,gspeed) {
  const s=states.get(e),c=s.cfg,dt=gspeed*1000/30;
  s.time+=dt;
  const gun=e._inventory[e.gun_slot];
  s.heat=clamp(s.heat+(s.previousFire&&e.reload_anim<=0&&gun?.ammo_left!==0?dt/1300:-dt/650),0,1);
  if(s.time>=s.scan) {
   s.scan=s.time+80; // At most 12.5 extra LOS checks / simulated second / actor.
   let t=s.target || e._ai.target;
   if(!t)t=sdCharacter.GetRandomEntityNearby(e);
   const valid=t&&!t._is_being_removed&&t.hea>0&&t._ai_team!==e._ai_team&&sdWorld.Dist2D(e.x,e.y,t.x,t.y)<800;
   const seen=valid&&t.IsVisible(e)&&sdWorld.CheckLineOfSight(e.x,e.y-4,t.x,t.y-4,e,sdCom.com_visibility_ignored_classes);
   if(seen) {
    if(!s.visible||s.target!==t) {
     s.reaction=c.reactionMin+(c.reactionMax-c.reactionMin)*this.random(s);
     s.readyAt=s.time+s.reaction;s.track=0;
    }
    s.target=t;s.visible=true;s.lastSeen=s.time;
    s.x=t.x;s.y=t.y-4;s.targetSpeed=Math.hypot(t.sx||0,t.sy||0);
   } else {
    s.visible=false;s.track=0;s.readyAt=Infinity;
    // No reads of hidden coordinates or velocity after this check.
    if(!valid||s.time-s.lastSeen>c.memory)s.target=null;
   }
  }
  if(s.visible)s.track+=dt;
  s.phase=s.visible?(s.time>=s.readyAt?'engaged':'aware'):(s.target?'searching':'idle');
  e._ai.target=s.visible?s.target:null;
 },
 acquire(e) {const s=states.get(e);return s.visible?s.target:null;},
 aim(e,gspeed) {
  const s=states.get(e),c=s.cfg;
  s.error=c.error+(c.initialError-c.error)*(1-clamp(s.track/c.settle,0,1))+
   Math.hypot(e.sx,e.sy)*c.movement+s.targetSpeed*c.targetSpeed+s.heat*c.heat;
  if(s.target) {
   // Correlated seeded sway, not per-frame random allocations or projectile spread edits.
   const sway=(Math.sin(s.time/187+s.seed%127)+0.5*Math.sin(s.time/83+s.seed%53))/1.5;
   const desired=Math.atan2(s.y-e.y,s.x-e.x)+sway*s.error*Math.PI/180;
   s.angle+=clamp(wrap(desired-s.angle),-c.turn*Math.PI/180*gspeed/30,c.turn*Math.PI/180*gspeed/30);
  }
  const distance=s.target?Math.max(16,Math.hypot(s.x-e.x,s.y-e.y)):400;
  e.look_x=e.x+Math.cos(s.angle)*distance;e.look_y=e.y+Math.sin(s.angle)*distance;
 },
 finish(e,gspeed) {
  const s=states.get(e),c=s.cfg;
  const aimDistance=Math.abs(wrap(Math.atan2(s.y-e.y,s.x-e.x)-s.angle))*180/Math.PI;
  const allowed=s.phase==='engaged'&&aimDistance<Math.max(8,s.error*1.5);
  if(!allowed){e._key_states.SetKey('Mouse1',0,true);e._ai_attack_time=0;}
  s.previousFire=!!e._key_states.GetKey('Mouse1');
  // Reuse the engine's movement keys/jump and its native obstacle recovery.
  // Hidden targets are represented only by the last observed point.
  if(s.target) {
   const dx=s.x-e.x,di=Math.abs(dx);
   let direction=di>c.far?Math.sign(dx):(s.visible&&di<c.near?-Math.sign(dx):0);
   if(!direction&&s.visible&&s.phase==='engaged')direction=Math.sin(s.time/650+s.seed%17)>0?1:-1;
   if(!s.visible&&di<16)direction=0;
   e._key_states.SetKey('KeyA',direction<0?1:0,true);e._key_states.SetKey('KeyD',direction>0?1:0,true);
   if(s.time>=s.moveAt) {
    if(direction&&Math.abs(e.x-s.lastMoveX)<3) {
     if(!e.CanMoveWithoutOverlap(e.x+direction*12,e.y,0))e._key_states.SetKey('KeyW',1);
    }
    s.lastMoveX=e.x;s.moveAt=s.time+450;
   }
  }
  // Native AI may choose an obstruction as a target; do not retain a hidden live actor there.
  e._ai.target=s.visible?s.target:null;
 }
};
