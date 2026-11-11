// Experimental map/configuration only. Movement, weapons, AI and rendering are
// the original engine. This module is imported only by ?mode=combat.
import {sdServerConfigFull} from '../server/sdServerConfig.js';

const arena = {
 enemies: [], objects: [], fixed: [], hostile: true,
 add(e) { sdEntity.AddEntityToEntitiesArray(e); sdWorld.UpdateHashPosition(e, false); return e; },
 remove(e) { if(e && !e._is_being_removed) { e.remove(); e._broken=false; } },
 block(x,y,w=32,h=32,fixed=false) {
  // Use supported stock sprite sizes rather than stretching atlas placeholders.
  if(w>32 || h>32) {
   let first;
   for(let dx=0;dx<w;dx+=32) for(let dy=0;dy<h;dy+=32) {
    const b=this.block(x+dx,y+dy,Math.min(32,w-dx),Math.min(32,h-dy),fixed);
    if(!first)first=b;
   }
   return first;
  }
  const b=this.add(new sdBlock({x,y,width:w,height:h,material:sdBlock.MATERIAL_WALL}));
  if(fixed) { b.Damage=()=>{}; this.fixed.push(b); }
  else this.objects.push(b);
  return b;
 },
 geometry() {
  // Fixed shell, open range on the right; isolated construction bay on the left.
  for(let x=-960;x<960;x+=32) this.block(x,160,32,32,true);
  for(let y=-256;y<160;y+=32) {this.block(-960,y,32,32,true);this.block(928,y,32,32,true);}
  this.block(-320,96,128,16,true);
  this.block(-128,32,128,16,true);
  this.block(96,-32,128,16,true);
  // Enclosed combat room, with a working AI-team sensor door in its left wall.
  for(let x=224;x<=512;x+=32) this.block(x,-128,32,32,true);
  for(let y=-96;y<160;y+=32) {
   this.block(512,y,32,32,true);
   if(y<96) this.block(224,y,32,32,true);
  }
  // Small steps/obstacles near platforms; build bay is x < -480.
  this.block(-416,128,32,32,true);
  this.block(-384,112,32,48,true);
  this.restoreObjects();
 },
 restoreObjects() {
  for(const e of this.objects) this.remove(e);
  this.objects=[];
  this.door=this.add(new sdDoor({x:240,y:128,w:32,h:64,open_type:sdDoor.OPEN_TYPE_AI_TEAM,_ai_team:0,filter:''}));
  this.objects.push(this.door);
  this.cover=this.block(352,112,32,48);
  this.block(-160,128,64,32);
  for(const x of [32,416,704,832])
   this.objects.push(this.add(new sdStorage({x,y:144,type:sdStorage.TYPE_CARGO})));
  this.target=this.block(768,96,32,64);
 },
 equip(p,kind) {
  const classes={pistol:sdGun.CLASS_PISTOL,rifle:sdGun.CLASS_RIFLE,shotgun:sdGun.CLASS_SHOTGUN,railgun:sdGun.CLASS_RAILGUN,build:sdGun.CLASS_BUILD_TOOL};
  const cls=classes[kind];
  let gun=p._inventory.find(g=>g?.class===cls);
  if(!gun) {gun=this.add(new sdGun({x:p.x,y:p.y,class:cls}));p.onMovementInRange(gun);}
  p.gun_slot=gun.GetSlot();p.alt_gun_slot=-1;
  return gun;
 },
 supply(p) {
  p.matter_max=10000;p.matter=10000;p.build_tool_level=5;
  p._matter_regeneration=100; // Existing resource regeneration, no progression grind.
  for(const kind of ['build','pistol','rifle','shotgun','railgun']) this.equip(p,kind);
  this.equip(p,'pistol');
 },
 respawn() {
  const old=sdWorld.my_entity;
  if(old) {for(const g of old._inventory) this.remove(g);this.remove(old);}
  const settings=GetPlayerSettings();settings.entity1=true;settings.entity2=false;settings.entity3=false;settings.entity4=false;
  globalThis.socket.emit('RESPAWN',{...settings,full_reset:true});
  sdContextMenu.open=false;
 },
 spawn(kind='basic') {
  const presets={basic:[sdCharacter.AI_MODEL_FALKOK,0,'pistol',250],intermediate:[sdCharacter.AI_MODEL_AGGRESSIVE,2,'rifle',300],advanced:[sdCharacter.AI_MODEL_DISTANT,4,'railgun',400]};
  const [model,level,weapon,health]=presets[kind];
  const e=this.add(new sdCharacter({x:80+(this.enemies.filter(e=>!e._is_being_removed&&e.hea>0).length%3)*64,y:128,_ai_enabled:this.hostile?model:sdCharacter.AI_MODEL_NONE,_ai_level:level}));
  e.title=kind+' test soldier';e._ai_team=1;e.hmax=health;e.hea=health;e.matter_max=10000;e.matter=10000;
  e._combatModel=model;e._init_ai_model=model;
  const gun=this.equip(e,weapon);e._ai_gun_slot=gun.GetSlot();
  this.enemies.push(e);
  return e;
 },
 toggleHostility() {
  this.hostile=!this.hostile;
  for(const e of this.enemies) if(!e._is_being_removed) {
   e._ai_enabled=this.hostile?e._combatModel:sdCharacter.AI_MODEL_NONE;
   e._ai=null;e._key_states.Reset();e.sx=0;
  }
  document.getElementById('combat-hostility').textContent='Hostility: '+(this.hostile?'on':'off');
 },
 reset() {
  for(const e of sdEntity.entities.slice()) if(!e.IsGlobalEntity() && !this.fixed.includes(e)) this.remove(e);
  this.enemies=[];this.objects=[];
  this.restoreObjects();this.respawn();
 },
 controls() {
  const bar=document.createElement('div');bar.id='combat-controls';
  bar.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:10000;background:#171717;color:white;padding:6px;font:13px sans-serif;display:flex;gap:5px;flex-wrap:wrap';
  const label=document.createElement('span');label.textContent='Combat test · Build bay ← | Platforms | Room | Range →';bar.append(label);
  const button=(text,action,id)=>{const b=document.createElement('button');b.textContent=text;if(id)b.id=id;b.onclick=()=>{action();b.blur();};bar.append(b);};
  button('Reset',()=>this.reset(),'combat-reset');button('Respawn',()=>this.respawn(),'combat-respawn');
  for(const kind of ['basic','intermediate','advanced']) button('Spawn '+kind,()=>this.spawn(kind),'combat-'+kind);
  button('Hostility: on',()=>this.toggleHostility(),'combat-hostility');
  button('Restore objects',()=>this.restoreObjects(),'combat-restore');
  for(const kind of ['pistol','rifle','shotgun','railgun','build']) button(kind,()=>{if(sdWorld.my_entity?.hea>0)this.equip(sdWorld.my_entity,kind);},'combat-'+kind);
  button('Original sandbox',()=>{location.href=location.pathname;});
  document.body.append(bar);
  // Overlay is deliberately outside the canvas so engine input is not captured.
 },
};

class CombatConfig extends sdServerConfigFull {
 static enable_bounds_move=false;
 static aggressive_hibernation=false;
 static GetAllowedWorldEvents(){return [];}
 static onBeforeSnapshotLoad(){sdWorld.no_respawn_areas=[];}
 static InitialSnapshotLoadAttempt(){} // Combat map is disposable; never load a world.
 static InstallBackupAndServerShutdownLogic(){sdWorld.onBeforeTurnOff=()=>{};}
 static onAfterSnapshotLoad(){
  // Quests/discovery rewards are sandbox distractions in this disposable mode.
  sdTask.MakeSureCharacterHasTask=()=>{};
  sdWorld.world_bounds={x1:-960,y1:-256,x2:960,y2:256};
  arena.geometry();
 }
 static PlayerSpawnPointSeeker(p){p.x=-560;p.y=128;}
 static onRespawn(p){
  sdRenderer.service_mesage='';sdRenderer.service_mesage_until=0;
  arena.supply(p);
  if(sdWeather.only_instance) sdWeather.only_instance.onThink=()=>{};
  if(!document.getElementById('combat-controls')) arena.controls();
 }
}
arena.config=CombatConfig;
globalThis.sdCombatSandbox=arena;
