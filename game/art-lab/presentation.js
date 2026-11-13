// Draw-only adapters reviewed from visual-experiments at f853cf47.
// Only ?mode=combat&art=1 imports this module; original modes fall through.
import {assets,contract,titles,assetStats} from './assets.js';
const roles=new WeakMap();
const families={};
for(const key of ['A','B','C']){
 const images={player:[],enemy:[]};
 for(let i=0;i<8;i++)for(const role of ['player','enemy'])images[role].push(assets.get(`${key}/${role}/${i}`));
 for(const name of ['pistol','flash','impact','tile','crate','background0','background1','foreground','shadow'])images[name]=assets.get(`${key}/${name}`);
 families[key]=images;
}
const lab={
 mode:'A',images:families.A,contract,titles,assetStats,
 // Camera-follow fractions: far scenery moves less across the screen than
 // near scenery; the foreground moves faster than the gameplay plane.
 cameraFollow:{far:.85,near:.55,foreground:-.2},
 setMode(key){if(!Object.hasOwn(titles,key))throw Error('Unknown art direction');this.mode=key;this.images=families[key]||null;
  const select=document.getElementById('art-direction');if(select)select.value=key;},
 role(c){
  if(c===sdWorld.my_entity)roles.set(c,'player');
  else if(globalThis.sdCombatSandbox?.enemies.includes(c))roles.set(c,'enemy');
  return roles.get(c);
 },
 paint(ctx,image,x,y,w,h){
  const filter=ctx.filter,sd=ctx.sd_filter,shade=ctx.apply_shading,hue=ctx.sd_hue_rotation;
  const r=ctx.sd_color_mult_r,g=ctx.sd_color_mult_g,b=ctx.sd_color_mult_b;
  try{
   ctx.filter='none';ctx.sd_filter=null;ctx.apply_shading=false;ctx.sd_hue_rotation=0;
   ctx.sd_color_mult_r=ctx.sd_color_mult_g=ctx.sd_color_mult_b=1;
   ctx.drawImage(image,x,y,w,h);
  }finally{
   ctx.filter=filter;ctx.sd_filter=sd;ctx.apply_shading=shade;ctx.sd_hue_rotation=hue;
   ctx.sd_color_mult_r=r;ctx.sd_color_mult_g=g;ctx.sd_color_mult_b=b;
  }
 },
 part(ctx,c,index){const role=this.images&&this.role(c);if(!role)return false;
  this.paint(ctx,this.images[role][index/32],-16,-16,32,32);return true;},
 head(ctx,c){const role=this.images&&this.role(c);if(!role)return false;
  this.paint(ctx,this.images[role][7],-16,-16,32,32);return true;},
 weapon(ctx,g,attached){
  if(!this.images||!attached||!g._held_by||!this.role(g._held_by)||g.class!==sdGun.CLASS_PISTOL)return false;
  const muzzle=g.GetMuzzleLocal();
  // The code-authored barrel ends at (23.1,13.5), scaled around (16,16)
  // by .6 in assets.js. Map that declared artwork anchor to native metadata.
  const x=muzzle.x-contract.pistolMuzzle[0],y=muzzle.y-contract.pistolMuzzle[1];
  this.paint(ctx,this.images.pistol,-16+x,-16+y,32,32);
  if(g.muzzle>0&&!g.MuzzleBlocked())this.paint(ctx,this.images.flash,muzzle.x,muzzle.y-5,14,10);
  return true;
 },
 block(ctx,b){
  if(!this.images||b.x<512||b.x>928||b.material!==sdBlock.MATERIAL_WALL)return false;
  this.paint(ctx,this.images.tile,0,0,b.width,b.height);return true;
 },
 storage(ctx,e){
  if(!this.images||this.mode==='A'||e.x<544||e.x>928||e.type!==sdStorage.TYPE_CARGO||e.held_by)return false;
  this.paint(ctx,this.images.crate,-13,-11,26,24);return true;
 },
 effect(ctx,e){
  if(!this.images||e.x<544||e.x>928||e._type!==sdEffect.TYPE_WALL_HIT)return false;
  const alpha=ctx.globalAlpha;
  ctx.globalAlpha*=Math.max(0,1-e._ani/e._duration);
  this.paint(ctx,this.images.impact,-10,-8,20,16);ctx.globalAlpha=alpha;return true;
 },
 background(ctx){
  if(!this.images)return;
  const z=ctx.z_offset,depth=ctx.z_depth,offset=ctx.draw_offset,alpha=ctx.globalAlpha,volume=ctx.volumetric_mode,object=ctx.object_offset;
  // Native actors occupy the -16 * scale plane. Stay behind that plane and
  // explicitly select a flat primitive instead of inheriting the previous pass.
  ctx.z_offset=-24*sdWorld.camera.scale;ctx.z_depth=0;ctx.draw_offset=-4;
  ctx.volumetric_mode=FakeCanvasContext.DRAW_IN_3D_FLAT;ctx.object_offset=null;
  const drift=sdWorld.camera.x-736;
  this.paint(ctx,this.images.background0,432+drift*(this.mode==='C'?this.cameraFollow.far:.02),-256,768,512);
  ctx.globalAlpha=this.mode==='A'?.45:1;
  this.paint(ctx,this.images.background1,432+drift*(this.mode==='C'?this.cameraFollow.near:.02),-256,768,512);
  ctx.globalAlpha=alpha;
  ctx.draw_offset=-.5;ctx.z_offset=-sdWorld.camera.scale;
  const shadow=c=>{
   if(!c||c.x<544||c.x>928)return;
   ctx.globalAlpha=alpha*.65*Math.max(0,1-Math.abs(160-c.y-c.hitbox_y2)/120);
   this.paint(ctx,this.images.shadow,c.x-8,159,16,3);
  };
  shadow(sdWorld.my_entity);for(const e of sdCombatSandbox.enemies)if(!e._is_being_removed)shadow(e);
  ctx.globalAlpha=alpha;ctx.z_offset=z;ctx.z_depth=depth;ctx.draw_offset=offset;ctx.volumetric_mode=volume;ctx.object_offset=object;
 },
 foreground(ctx){
  if(!this.images||this.mode!=='C')return;
  const z=ctx.z_offset,depth=ctx.z_depth,offset=ctx.draw_offset;
  ctx.z_offset=2*sdWorld.camera.scale;ctx.z_depth=0;ctx.draw_offset=1;
  this.paint(ctx,this.images.foreground,432+(sdWorld.camera.x-736)*this.cameraFollow.foreground,192,768,96);
  ctx.z_offset=z;ctx.z_depth=depth;ctx.draw_offset=offset;
 },
 // Explicit test-scene action, never called from a draw hook. Reuses the existing
 // combat range, native spawner/equipment and reset; no new map or mechanics.
 stage(){
  sdCombatSandbox.reset();
  // The sandbox creates these with the raw constructor. Complete the native
  // construction lifecycle for the lab's two range props so they persist.
  for(const prop of sdCombatSandbox.objects)if(prop instanceof sdStorage&&prop.x>=544)prop.onBuilt();
  const p=sdWorld.my_entity;
  p.x=624;p.y=144;p.sx=p.sy=0;p.look_x=748;p.look_y=140;
  sdCombatSandbox.equip(p,'pistol');sdWorld.UpdateHashPosition(p,false);
  const e=sdCombatSandbox.spawn('basic');e.x=748;e.y=144;e.sx=e.sy=0;e.look_x=p.x;e.look_y=140;
  sdWorld.UpdateHashPosition(e,false);roles.set(p,'player');roles.set(e,'enemy');
  sdWorld.camera.x=704;sdWorld.camera.y=100;
  this.stageCount=(this.stageCount||0)+1;
 }
};
globalThis.sdArtLab=lab;
const wait=setInterval(()=>{
 const bar=document.getElementById('combat-controls');if(!bar)return;clearInterval(wait);
 if(document.getElementById('art-direction'))return;
 const label=document.createElement('label');label.textContent='Art laboratory · PROTOTYPE ';
 const select=document.createElement('select');select.id='art-direction';select.setAttribute('aria-label','Art direction');
 for(const [key,title] of Object.entries(titles)){const o=document.createElement('option');o.value=key;o.textContent=title;select.append(o);}
 select.value=lab.mode;select.onchange=()=>{lab.setMode(select.value);select.blur();};label.append(select);bar.append(label);
 const stage=document.createElement('button');stage.id='art-stage';stage.textContent='Comparison range';stage.onclick=()=>{lab.stage();stage.blur();};bar.append(stage);
 const tip=document.createElement('span');tip.textContent='Same rig, weapons and collisions · Optional A/B/C studies';bar.append(tip);
 lab.stage();
},100);
