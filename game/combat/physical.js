// Optional injury policy for disposable laboratory targets. Native Damage,
// armor accounting, projectile impulses, animation and ragdoll remain in charge.
import sdWorld from '../sdWorld.js';
import sdEntity from '../entities/sdEntity.js';
import sdCharacter from '../entities/sdCharacter.js';
import sdGun from '../entities/sdGun.js';
import sdEffect from '../entities/sdEffect.js';
import sdBloodDecal from '../entities/sdBloodDecal.js';
import sdBG from '../entities/sdBG.js';
import sdSound from '../sdSound.js';
import {humanoidAI} from './humanoid-ai.js';

export const tuning={health:90,headVulnerability:3.4,criticalChance:.45,injuryReferenceHealth:60,
 severeFraction:.45,legSevereFraction:.30,criticalRemaining:.55,knockdownMs:1400,armStunMs:500,
 legSlowMs:2200,legMobility:.55,bleedMinMs:8000,bleedMaxMs:16000,
 extraBleedPerSecond:.25,regenDelayTicks:18000,bloodIntensity:1,
 maxParticles:96,maxMarks:24,maxTargets:6,
 criticalBloodIntervalMs:320,criticalBloodScale:1.7,dropletScale:1.35,markIntensity:45,
 motionIntensity:1,motionMaxEvents:5,motionMinMs:1100,motionMaxMs:2400,motionSpeed:.85};
export const armorProfiles={
 unarmored:{integrity:0,absorb:0,resistance:0,coverage:['torso']},
 light:{integrity:60,absorb:.70,resistance:.40,coverage:['torso']},
 heavy:{integrity:100,absorb:.95,resistance:.85,coverage:['torso']}
};
// Prototype ammunition classes, not real caliber claims. Native damage, speed,
// spread, critical range, knockback and block penetration are never rewritten.
export const ammunition={pistol:{penetration:.10},rifle:{penetration:.60},
 shotgun:{penetration:.08},railgun:{penetration:1},other:{penetration:.25}};
const states=new WeakMap(),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const weaponKinds=new Map([[sdGun.CLASS_PISTOL,'pistol'],[sdGun.CLASS_RIFLE,'rifle'],[sdGun.CLASS_SHOTGUN,'shotgun'],[sdGun.CLASS_RAILGUN,'railgun']]);
const compact=a=>{let n=0;for(const e of a)if(!e._is_being_removed)a[n++]=e;a.length=n;};
const segmentDistance=(x,y,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y;
 const t=clamp(((x-a.x)*dx+(y-a.y)*dy)/Math.max(.001,dx*dx+dy*dy),0,1);
 return Math.hypot(x-a.x-t*dx,y-a.y-t*dy);};

const lab={
 tuning,armorProfiles,ammunition,enabled:true,tier:'intermediate',profile:'unarmored',
 targets:[],particles:[],marks:[],history:[],
 has:e=>lab.enabled&&states.has(e),state:e=>states.get(e),
 random(s,visual=false){const key=visual?'fxSeed':'seed';s[key]=(Math.imul(1664525,s[key])+1013904223)>>>0;return s[key]/4294967296;},
 attach(e,profile='unarmored'){
  const a=armorProfiles[profile];if(!a)throw Error('Unknown armor profile');
  e.hmax=e.hea=this.enabled?tuning.health:250;
  e.armor=e.armor_max=a.integrity;e._armor_absorb_perc=a.absorb;
  e.armor_speed_reduction=0;e._armor_repair_amount=0;e._respawn_protection=0;
  if(this.enabled)e._regen_timeout=tuning.regenDelayTicks;
  states.set(e,{profile,time:0,phase:this.enabled?'ready':'original',seed:Math.imul(e._net_id+17,0x9e3779b1)>>>0,fxSeed:Math.imul(e._net_id+101,0x85ebca6b)>>>0,
   downUntil:0,armUntil:0,legUntil:0,deadline:0,bleedRate:0,baseMobility:e._ai_team!==0?33:e.mobility,
   totalLoss:0,last:null,initiator:null,wasBlocked:false,lastBlood:-Infinity,lastMark:-Infinity,
   criticalAt:0,nextBlood:0,motionAt:Infinity,motionCount:0,lastMotion:null,motionSeed:Math.imul(e._net_id+201,0xc2b2ae35)>>>0});
  return e;
 },
 region(e,x,y,mult){
  // Preserve native head detection. Legs use the lower quarter of the same
  // character box. No limb extends or changes that authoritative collision box.
  if(mult>1)return 'head';
  if(y>=e.y+e.hitbox_y2-(e.hitbox_y2-e.hitbox_y1)*.28)return 'legs';
  const r=e._ragdoll,scale=e.s/100;
  // Arms are only an approximation where a real rig segment intersects the
  // existing body box. Extended hands have no independent projectile hitboxes.
  if(r&&Math.abs(x-e.x)>3*scale&&Math.hypot(r.chest.x-e.x,r.chest.y-e.y)<24*scale)
   for(let i=1;i<=2;i++)if(segmentDistance(x,y,r.chest,r['elbow'+i])<2*scale||segmentDistance(x,y,r['elbow'+i],r['hand'+i])<2*scale)return 'arms';
  return 'torso';
 },
 context(b,e,damage,mult){
  if(!this.has(e)||e.hea<=0||damage<=0||b._hook)return null;
  const region=this.region(e,b.x,b.y,mult),a=armorProfiles[states.get(e).profile];
  const ammo=weaponKinds.get(b._gun?.class)||(b._rail?'railgun':'other');
  const penetration=clamp(ammunition[ammo].penetration+Math.max(0,(b._armor_penetration_level??3)-3)*.04,0,1);
  const covered=e.armor>0&&a.coverage.includes(region),absorb=covered?a.absorb*clamp(1-penetration/Math.max(.001,a.resistance),0,1):0;
  return {b,e,region,ammo,penetration,covered,absorb,damage:damage*(region==='head'?tuning.headVulnerability:1),mult};
 },
 damage(hit){
  const {e,b,region}=hit,s=states.get(e),hp=e.hea,armor=e.armor,perc=e._armor_absorb_perc;
  let result;
  // Native DamageWithEffect/Character.Damage owns health, damage text, armor
  // depletion/break, head feedback, death, drops and stability. Restore handling
  // after this one hit; there is no persistent projectile-stat mutation.
  e._armor_absorb_perc=hit.absorb;
  try{result=e.DamageWithEffect(hit.damage,b._owner,hit.mult>1,hit.covered&&hit.absorb>0);}
  finally{e._armor_absorb_perc=perc;}
  const loss=Math.max(0,Math.max(0,hp)-Math.max(0,e.hea)),absorbed=Math.max(0,armor-e.armor);
  s.last={region,ammo:hit.ammo,x:b.x,y:b.y,damage:hit.damage,loss,absorbed,penetration:hit.penetration,health:e.hea,armor:e.armor,time:s.time};
  if(loss>0){
   s.totalLoss+=loss;s.initiator=b._owner;e._regen_timeout=tuning.regenDelayTicks;
   // Biological HP can change without weakening the established leg/arm response.
   const severity=loss/tuning.injuryReferenceHealth;
   if(e.hea<=0){s.phase='dead';e._dying=false;}
   else if(s.phase!=='critical'){
    s.phase='wounded';
    if(region==='arms'&&severity>=.12){s.armUntil=s.time+tuning.armStunMs;e._recoil=Math.max(e._recoil,.35);}
    if(region==='legs')s.legUntil=s.time+tuning.legSlowMs;
    const severe=severity>=tuning.severeFraction||s.totalLoss/tuning.injuryReferenceHealth>=.5||(region==='legs'&&severity>=tuning.legSevereFraction);
    if(severe){
     s.downUntil=s.time+tuning.knockdownMs;e.stability=Math.min(e.stability,-60);
     if(region==='legs'||region==='head'||e.hea/e.hmax<=tuning.criticalRemaining){
      if(this.random(s)<clamp(tuning.criticalChance,0,1)){
       s.phase='critical';e._dying=true;e._dying_bleed_tim=0;
       s.deadline=s.time+tuning.bleedMinMs+(tuning.bleedMaxMs-tuning.bleedMinMs)*this.random(s);
       s.bleedRate=Math.max(tuning.extraBleedPerSecond*(.5+this.random(s)),e.hea/((s.deadline-s.time)/1000)-3);
       s.criticalAt=s.time;s.nextBlood=s.time+tuning.criticalBloodIntervalMs;
       s.motionAt=s.time+700+this.motionRandom(s)*700;
      }
     }
    }
   }
   this.blood(e,b.x,b.y,clamp(loss/18,.3,2),b.sx,b.sy);
  }else if(absorbed>0)e.DamageStability(absorbed*.15);
  if(absorbed>0){this.effect({x:b.x,y:b.y,type:sdEffect.TYPE_WALL_HIT});sdSound.PlaySound({name:'world_hit2',x:b.x,y:b.y,volume:.35,pitch:1.4});}
  this.history.push({...s.last,phase:s.phase});if(this.history.length>32)this.history.shift();
  return result;
 },
 blocked(e){const s=states.get(e);return this.has(e)&&e.hea>0&&(s.phase==='critical'||s.time<s.downUntil);},
 tick(e,gspeed){
  const s=states.get(e);s.time+=gspeed*1000/30;
  if(e.hea<=0){s.phase='dead';e._dying=false;return;}
  if(s.phase==='critical'){
   e._dying=true;e.stability=-100;
   // Native _dying already loses 3 HP/s and bleeds every ~0.5 simulated second.
   // A small extra loss plus a hard game-time endpoint guarantee termination.
   e.Damage(s.time>=s.deadline?e.hea+1:s.bleedRate*gspeed/30,s.initiator,false,false);
   if(e.hea<=0){s.phase='dead';e._dying=false;return;}
   if(s.time>=s.nextBlood){
    s.nextBlood=s.time+tuning.criticalBloodIntervalMs;
    const r=e._ragdoll,body=r?.torso;
    const x=body&&Math.hypot(body.x-e.x,body.y-e.y)<48?body.x:e.x,y=body&&Math.hypot(body.x-e.x,body.y-e.y)<48?body.y:e.y;
    this.blood(e,x,y,tuning.criticalBloodScale);
   }
   this.criticalMotion(e,s);
  }
  const blocked=this.blocked(e);
  if(blocked){
   e.stability=Math.min(e.stability,-60);e._key_states.Reset();e.act_x=e.act_y=0;
   e.weapon_stun_timer=Math.max(e.weapon_stun_timer,gspeed+1);e.auto_shoot_in=0;e.flying=false;e.PhysWakeUp();
   if(!s.wasBlocked)humanoidAI.reset(e);
  }else if(s.wasBlocked)humanoidAI.reset(e);
  s.wasBlocked=blocked;
  if(s.time<s.armUntil)e.weapon_stun_timer=Math.max(e.weapon_stun_timer,gspeed+1);
  e.mobility=s.baseMobility*(s.time<s.legUntil?tuning.legMobility:1);
  // Keep passive timed reactions scheduled until their temporary state expires.
  if(blocked||s.time<s.armUntil||s.time<s.legUntil)e.pain_anim=Math.max(e.pain_anim,2);
 },
 motionRandom(s){s.motionSeed=(Math.imul(1664525,s.motionSeed)+1013904223)>>>0;return s.motionSeed/4294967296;},
 criticalMotion(e,s){
  if(tuning.motionIntensity<=0||s.motionCount>=tuning.motionMaxEvents||s.time<s.motionAt)return;
  s.motionAt=s.time+tuning.motionMinMs+(tuning.motionMaxMs-tuning.motionMinMs)*this.motionRandom(s);
  const r=e._ragdoll;if(!r||e.driver_of||e._frozen>0)return;
  const remaining=clamp((s.deadline-s.time)/(s.deadline-s.criticalAt),0,1);
  if(remaining<.18)return;
  const names=['hand1','hand2','ankle1','ankle2'],name=names[Math.floor(this.motionRandom(s)*names.length)],bone=r[name];
  // A single bounded velocity impulse, solved by the unchanged native constraints.
  // No teleports, pose sequence, collider changes or impulses on a dead body.
  if(!bone||Math.hypot(bone.x-e.x,bone.y-e.y)>48||Math.hypot(bone.sx,bone.sy)>2)return;
  const ceiling=tuning.motionSpeed*clamp(tuning.motionIntensity,0,2)*remaining*remaining;
  const dx=(this.motionRandom(s)-.5)*ceiling,dy=-ceiling;
  bone.sx+=dx;bone.sy+=dy;bone.PhysWakeUp();
  s.motionCount++;s.lastMotion={time:s.time,bone:name,dx,dy,ceiling};
 },
 effect(params){compact(this.particles);if(this.particles.length>=tuning.maxParticles)return;
  const e=new sdEffect(params);sdEntity.AddEntityToEntitiesArray(e);this.particles.push(e);return e;},
 trimEffects(){for(const [items,limit] of [[this.particles,tuning.maxParticles],[this.marks,tuning.maxMarks]]){compact(items);while(items.length>limit)items.shift().remove();}},
 blood(e,x,y,severity=1,sx=0,sy=0){
  const s=states.get(e);if(!s||tuning.bloodIntensity<=0||s.time-s.lastBlood<80)return;
  if(s.phase==='critical'&&sx===0&&sy===0){
   const r=e._ragdoll,anchor=s.last?.region==='legs'?r?.knee1:r?.torso;
   if(anchor&&Math.hypot(anchor.x-e.x,anchor.y-e.y)<48){x=anchor.x;y=anchor.y;}
  }
  s.lastBlood=s.time;
  const n=Math.min(12,Math.ceil(3*clamp(severity,.25,2)*clamp(tuning.bloodIntensity,0,2))),speed=Math.max(1,Math.hypot(sx,sy));
  const green=e.GetBleedEffect(false)===sdEffect.TYPE_BLOOD_GREEN,type=green?sdEffect.TYPE_BLOOD_DROP_GREEN:sdEffect.TYPE_BLOOD_DROP;
  for(let i=0;i<n;i++){const spread=(this.random(s,true)-.5)*1.6;
   this.effect({x,y,type,scale:tuning.dropletScale,sx:sx/speed*.9+spread,sy:sy/speed*.9-.8-this.random(s,true),hue:e.GetBleedEffectHue(),filter:e.GetBleedEffectFilter()});}
  // Native decals require real background geometry; droplets alone do not
  // create floor stains. Never invent an invisible colliding surface for this.
  compact(this.marks);
  if(s.time-s.lastMark>=400&&this.marks.length<tuning.maxMarks&&sdWorld.CheckWallExists(x,y,null,null,sdBG.as_class_list)){
   s.lastMark=s.time;const bg=sdWorld.last_hit_entity;
   const mark=new sdBloodDecal({x:clamp(Math.floor(x/16)*16,bg.x,bg.x+bg.width-16),y:clamp(Math.floor(y/16)*16,bg.y,bg.y+bg.height-16),effect_type:green?sdEffect.TYPE_BLOOD_GREEN:sdEffect.TYPE_BLOOD,intensity:tuning.markIntensity});
   // Like native SendEffect, let the world index a decal AFTER its first Think.
   // Early indexing makes native decal merging find itself and remove itself.
   sdEntity.AddEntityToEntitiesArray(mark);this.marks.push(mark);
  }
 },
 clear(){for(const e of [...this.particles,...this.marks])if(!e._is_being_removed)e.remove();this.particles=[];this.marks=[];this.targets=[];this.history=[];},
 spawn(profile=this.profile){
  this.profile=profile;compact(this.targets);
  while(this.targets.length>=tuning.maxTargets){const old=this.targets.shift();for(const g of old._inventory)sdCombatSandbox.remove(g);sdCombatSandbox.remove(old);}
  const e=sdCombatSandbox.spawn(this.tier);this.attach(e,profile);
  const g=sdCombatSandbox.equip(e,'rifle');e._ai_gun_slot=g.GetSlot();
  e.title=profile+' · '+this.tier+' · '+e.hmax+' HP';
  e.x=656+this.targets.length*36;e.y=144;e.sx=e.sy=0;e.look_x=560;e.look_y=140;
  e._hitbox_last_update=-Infinity;e.UpdateHitbox();sdWorld.UpdateHashPosition(e,false);this.targets.push(e);
  humanoidAI.reset(e); // Native spawn coordinates/aim preceded the range relocation.
  // Only the laboratory's discarded records are pruned; native actors remain.
  sdCombatSandbox.enemies=sdCombatSandbox.enemies.filter(v=>!v._is_being_removed);
  return e;
 },
 encounter(profile=this.profile){
  const a=sdCombatSandbox;a.reset();
  for(const prop of a.objects)if(prop instanceof sdWorld.entity_classes.sdStorage&&prop.x>=544)prop.onBuilt();
  const p=sdWorld.my_entity;p.x=560;p.y=144;p.sx=p.sy=0;p.look_x=656;p.look_y=144;sdWorld.UpdateHashPosition(p,false);
  sdWorld.camera.x=624;sdWorld.camera.y=100;return this.spawn(profile);
 },
 setEnabled(value){this.enabled=!!value;return this.encounter();}
};
globalThis.sdPhysicalCombat=lab;sdCombatSandbox.config.physical_combat=lab;
const wait=setInterval(()=>{
 const bar=document.getElementById('combat-controls');if(!bar)return;
 // Let the art lab finish its one automatic scene reset before creating ours.
 if(globalThis.SD_ART_LAB&&!globalThis.sdArtLab?.stageCount)return;
 clearInterval(wait);
 const row=document.createElement('div');row.id='physical-controls';row.style.cssText='width:100%;display:flex;gap:5px;flex-wrap:wrap';bar.append(row);
 const button=(id,text,fn)=>{const b=document.createElement('button');b.id=id;b.textContent=text;b.onclick=()=>{fn();b.blur();};row.append(b);return b;};
 const model=document.createElement('input');model.type='checkbox';model.id='physical-enabled';model.checked=true;
 const label=document.createElement('label');label.textContent='Injury model (new encounter) ';label.append(model);row.append(label);model.onchange=()=>lab.setEnabled(model.checked);
 const skill=document.createElement('select');skill.id='physical-training';skill.setAttribute('aria-label','Target AI training');
 for(const tier of ['basic','intermediate','advanced']){const o=document.createElement('option');o.value=tier;o.textContent=tier;skill.append(o);}skill.value=lab.tier;skill.onchange=()=>{lab.tier=skill.value;lab.encounter();skill.blur();};row.append(skill);
 for(const profile of Object.keys(armorProfiles))button('physical-'+profile,profile+' encounter',()=>lab.encounter(profile));
 button('physical-range','New target / range',()=>lab.encounter());
 const intensity=document.createElement('input');intensity.type='range';intensity.min=0;intensity.max=2;intensity.step=.25;intensity.value=tuning.bloodIntensity;intensity.id='physical-blood';
 const blood=document.createElement('label');blood.textContent='Blood ';blood.append(intensity);row.append(blood);intensity.oninput=()=>{tuning.bloodIntensity=+intensity.value;};
 const number=(text,id,key,min,max,changed)=>{const label=document.createElement('label');label.textContent=text+' ';const input=document.createElement('input');input.id=id;input.type='number';input.min=min;input.max=max;input.value=tuning[key];input.style.width='52px';input.setAttribute('aria-label',text);input.onchange=()=>{const value=Number(input.value);if(Number.isFinite(value))tuning[key]=clamp(Math.round(value),min,max);input.value=tuning[key];changed();input.blur();};label.append(input);row.append(label);};
 number('HP','physical-health','health',20,200,()=>lab.encounter());
 for(const hp of [80,90,100])button('physical-hp-'+hp,hp+' HP',()=>{tuning.health=hp;document.getElementById('physical-health').value=hp;lab.encounter();});
 number('Critical motion','physical-motion','motionIntensity',0,2,()=>{});
 number('Particles','physical-particles','maxParticles',0,256,()=>lab.trimEffects());
 number('Marks','physical-marks','maxMarks',0,64,()=>lab.trimEffects());
 const out=document.createElement('pre');out.id='physical-diagnostics';out.hidden=true;out.style.cssText='position:fixed;top:65px;left:8px;background:#111e;color:white;font:12px monospace;pointer-events:none;z-index:10003';document.body.append(out);
 button('physical-debug','Injury diagnostics',()=>{out.hidden=!out.hidden;});
 setInterval(()=>{if(out.hidden)return;compact(lab.particles);compact(lab.marks);
  out.textContent=`Injury laboratory · ${lab.enabled?'EXPERIMENTAL':'original 250 HP model'}\nBlood particles ${lab.particles.length}/${tuning.maxParticles}; marks ${lab.marks.length}/${tuning.maxMarks}\n`+lab.targets.filter(e=>!e._is_being_removed).map(e=>{const s=states.get(e),h=s.last;
   return `#${e._net_id} ${s.profile}: ${s.phase}${lab.blocked(e)?' / DOWN':''} HP ${e.hea.toFixed(1)} armor ${e.armor.toFixed(1)}\n${h?`${h.region} · ${h.ammo} · loss ${h.loss.toFixed(1)} · absorbed ${h.absorbed.toFixed(1)}`:'No hit'}\ncritical endpoint ${Math.max(0,s.deadline-s.time).toFixed(0)}ms; weapon stun ${e.weapon_stun_timer.toFixed(1)}`;}).join('\n');
 },200);
 // A passive, repeatable initial comparison. Existing Hostility control enables
 // the unchanged native AI and its existing competence policy when desired.
 if(sdCombatSandbox.hostile)sdCombatSandbox.toggleHostility();lab.encounter();
},100);
export default lab;
