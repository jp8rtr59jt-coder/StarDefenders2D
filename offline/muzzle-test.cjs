/* Stage 1: independent Canvas transforms, native projectile births and cover. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const dir='docs/physical-combat/stage1';fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1200,height:800}}),r={passed:false,errors:[],external:[],checks:[]};
 page.on('pageerror',e=>r.errors.push(e.stack));page.on('dialog',d=>d.dismiss());
 page.on('console',m=>{if(m.text().includes('Image could not be drawn'))r.errors.push(m.text());});
 await page.route('**/*',q=>{if(new URL(q.request().url()).hostname!=='127.0.0.1'){r.external.push(q.request().url());return q.abort();}return q.continue();});
 const check=(name,data)=>{r.checks.push({name,data});console.log('PASS',name,JSON.stringify(data));};
 try{
  await page.goto('http://127.0.0.1:8000/?mode=combat&movement=1&art=1');
  await page.waitForFunction(()=>document.getElementById('server_status')?.textContent==='Offline — ready',null,{timeout:120000});
  await page.locator('#offline_play').click();await page.waitForFunction(()=>sdArtLab.stageCount>0,null,{timeout:120000});
  await page.waitForFunction(()=>sdRenderer.dark_tint<=0,null,{timeout:120000});
  const measurements=await page.evaluate(()=>{
   const p=sdWorld.my_entity,a=sdCombatSandbox,logic=sdWorld.HandleWorldLogic;
   globalThis.muzzleResume=logic;sdWorld.HandleWorldLogic=()=>{};sdWorld.GSPEED=0;
   for(const e of a.enemies)e._ai_enabled=sdCharacter.AI_MODEL_NONE;
   const ctx=document.createElement('canvas').getContext('2d');ctx.drawImageFilterCache=()=>{};ctx.drawImage=()=>{};
   let current=null,drawn=null;const draw=sdGun.prototype.Draw;
   sdGun.prototype.Draw=function(c,attached){if(this===current&&attached){const point=c.getTransform().transformPoint(this.GetMuzzleLocal());drawn={x:point.x,y:point.y};}return draw.call(this,c,attached);};
   const paint=()=>{ctx.setTransform(1,0,0,1,p.x,p.y);p._ragdoll.DrawRagdoll(ctx,false);if(!drawn)throw Error('Weapon was not rendered');return drawn;};
   const fire=g=>{const before=p._recoil;p.sx=p.sy=0;p._recoil=0;g.reload_time_left=0;g.ammo_left=30;const random=Math.random;Math.random=()=>.5;
    const start=sdEntity.entities.length;let ok;try{ok=g.Shoot(0,p.GetBulletSpawnOffset());}finally{Math.random=random;}
    if(!ok)throw Error('Shot rejected');const bullets=sdEntity.entities.slice(start).filter(e=>e instanceof sdBullet&&e._owner===p);
    p._recoil=before;return bullets;};
   const rows=[];let maxError=0,beforeError=0;
   try{
    for(const mode of ['original','A','B','C'])for(const kind of ['pistol','rifle','shotgun','railgun'])for(const state of ['standing','crouching','sliding','jetpack'])for(const degrees of [0,45,90,135,180,225,270,315]){
     sdArtLab.setMode(mode);current=a.equip(p,kind);p.x=-720;p.y=-144;p.sx=p.sy=0;p.stability=100;p._weapon_draw_timer=0;p.fire_anim=0;p.reload_anim=0;p._recoil=0;
     p._crouch_intens=state==='crouching'||state==='sliding'?1:0;p.flying=state==='jetpack';p.act_x=state==='sliding'?1:0;p.act_y=p._crouch_intens;
     const angle=degrees*Math.PI/180;p.look_x=p.x+Math.cos(angle)*180;p.look_y=p.y+Math.sin(angle)*180;p._side=Math.cos(angle)>=0?1:-1;
     p._hitbox_last_update=-Infinity;p.UpdateHitbox();sdWorld.UpdateHashPosition(p,false);
     const rag=p._ragdoll;rag._smooth_x=p.x;rag._smooth_y=p.y;rag._smooth_look_x=p.look_x;rag._smooth_look_y=p.look_y;
     sdWorld.GSPEED=1;for(let i=0;i<14;i++){rag.AliveUpdate();rag.Think(1);}sdWorld.GSPEED=0;
     sdWorld.server_config.align_combat_muzzles=false;const old=paint(),offset=p.GetBulletSpawnOffset();beforeError=Math.max(beforeError,Math.hypot(old.x-p.x-offset.x,old.y-p.y-offset.y));
     const baseline=fire(current).map(b=>{const stats={damage:b._damage,speed:Math.hypot(b.sx,b.sy),life:b.time_left,penetration:b._armor_penetration_level};b.remove();return stats;});
     sdWorld.server_config.align_combat_muzzles=true;const tip=paint(),pose=current.GetAlignedPose();
     const error=Math.hypot(tip.x-pose.muzzleX,tip.y-pose.muzzleY);maxError=Math.max(maxError,error);
     if(error>1e-6)throw Error('Render/pose mismatch '+JSON.stringify({mode,kind,state,degrees,tip,pose,error}));
     const bullets=fire(current);if(bullets.length!==baseline.length)throw Error('Pellet count changed');
     for(let i=0;i<bullets.length;i++){
      const b=bullets[i],stats=baseline[i],distance=Math.hypot(b.x-tip.x,b.y-tip.y);
      if(distance>1e-6)throw Error('Birth not at muzzle '+JSON.stringify({kind,state,degrees,tip,birth:[b.x,b.y],distance}));
      if(Math.abs(stats.damage-b._damage)>1e-8||Math.abs(stats.speed-Math.hypot(b.sx,b.sy))>1e-7||stats.life!==b.time_left||stats.penetration!==b._armor_penetration_level)throw Error('Weapon properties changed');
      b.remove();
     }
     rows.push({mode,kind,state,degrees,error});
    }
   }finally{sdGun.prototype.Draw=draw;sdWorld.server_config.align_combat_muzzles=true;}
   return {cases:rows.length,maxRenderError:maxError,oldMaxOriginError:beforeError,rows};
  });r.alignment=measurements;check('all four styles / weapons / poses / eight aim directions align',{cases:measurements.cases,maxRenderError:measurements.maxRenderError,oldMaxOriginError:measurements.oldMaxOriginError});
  check('native circled rail beam starts at its physical muzzle',await page.evaluate(()=>{
   const p=sdWorld.my_entity,g=sdCombatSandbox.equip(p,'railgun');g.reload_time_left=0;g.ammo_left=-1;
   const start=sdEntity.entities.length;g.Shoot(0,p.GetBulletSpawnOffset());const b=sdEntity.entities.slice(start).find(v=>v instanceof sdBullet&&v._owner===p);
   let origin;const send=sdWorld.SendEffect;sdWorld.SendEffect=function(v,...args){if(v.type===sdEffect.TYPE_BEAM_CIRCLED)origin={x:v.x,y:v.y};return send.call(this,v,...args);};
   try{b.onRemove();}finally{sdWorld.SendEffect=send;}
   if(!origin||Math.hypot(origin.x-b.x,origin.y-b.y)>1e-6)throw Error('Rail effect origin differs from projectile');b.remove();return origin;
  }));
  check('fresh / teleported rigs retain native firing origin',await page.evaluate(()=>{
   const e=sdCombatSandbox.spawn('basic');e._ai_enabled=sdCharacter.AI_MODEL_NONE;
   e.x=-700;e.y=-144;e.look_x=-800;e.look_y=-144;sdWorld.UpdateHashPosition(e,false);
   const g=e._inventory[e.gun_slot];if(g.GetAlignedPose())throw Error('Unprepared rig used for firing');
   const start=sdEntity.entities.length;g.reload_time_left=0;g.ammo_left=12;g.Shoot(0,e.GetBulletSpawnOffset());
   const b=sdEntity.entities.slice(start).find(v=>v instanceof sdBullet&&v._owner===e),off=e.GetBulletSpawnOffset();
   if(!b||Math.hypot(b.x-e.x-off.x,b.y-e.y-off.y)>1e-6)throw Error('Native fallback origin changed');
   b.remove();for(const item of e._inventory)sdCombatSandbox.remove(item);sdCombatSandbox.remove(e);return {nativeFallback:true};
  }));
  r.cover=await page.evaluate(()=>{
   const p=sdWorld.my_entity,a=sdCombatSandbox,report=[];
   for(const kind of ['pistol','rifle','shotgun','railgun'])for(const state of ['standing','crouching','sliding','jetpack'])for(const degrees of [0,45,90,135,180,225,270,315]){
    const angle=degrees*Math.PI/180,dx=Math.cos(angle),dy=Math.sin(angle),direction=dx>=0?1:-1;
    p.x=-720;p.y=-144;p.sx=p.sy=0;p._crouch_intens=state==='crouching'||state==='sliding'?1:0;p.flying=state==='jetpack';p.act_x=p.act_y=0;p._side=direction;p.look_x=p.x+dx*160;p.look_y=p.y+dy*160;p._weapon_draw_timer=0;p.fire_anim=0;
    p._hitbox_last_update=-Infinity;p.UpdateHitbox();sdWorld.UpdateHashPosition(p,false);
    const g=a.equip(p,kind);sdWorld.GSPEED=1;for(let i=0;i<14;i++){p._ragdoll.AliveUpdate();p._ragdoll.Think(1);}sdWorld.GSPEED=0;
    const vertical=Math.abs(dx)>=Math.abs(dy);
    const wx=vertical?p.x+(dx>0?p.hitbox_x2+.8:p.hitbox_x1-1.8):p.x-40;
    const wy=vertical?p.y-40:p.y+(dy>0?p.hitbox_y2+.8:p.hitbox_y1-1.8);
    const wall=a.add(new sdBlock({x:wx,y:wy,width:vertical?1:80,height:vertical?80:1,material:sdBlock.MATERIAL_WALL}));wall._armor_protection_level=99;wall.Damage=()=>{};
    const target=a.spawn('basic');target._ai_enabled=sdCharacter.AI_MODEL_NONE;target.x=p.x+dx*80;target.y=p.y+dy*80;target.hea=target.hmax=1000;target._hitbox_last_update=-Infinity;target.UpdateHitbox();sdWorld.UpdateHashPosition(target,false);
    const start=sdEntity.entities.length;g.reload_time_left=0;g.ammo_left=30;p._recoil=0;g.Shoot(0,p.GetBulletSpawnOffset());const bullets=sdEntity.entities.slice(start).filter(e=>e instanceof sdBullet&&e._owner===p);
    const births=bullets.map(b=>({x:b.x,y:b.y}));
    for(const b of bullets){if(vertical?(dx>0?b.x+b.hitbox_x2>wall.x:b.x+b.hitbox_x1<wall.x+1):(dy>0?b.y+b.hitbox_y2>wall.y:b.y+b.hitbox_y1<wall.y+1))throw Error('Spawn passed thin wall');
     for(let i=0;i<15&&!b._is_being_removed;i++){b.UpdateHitbox();b.onThink(1);sdWorld.UpdateHashPosition(b,false);}}
    if(target.hea!==1000)throw Error('Shot bypassed cover');
    const impacts=sdEntity.entities.slice(start).filter(e=>e instanceof sdEffect&&e._type===sdEffect.TYPE_WALL_HIT).length;
    if(!impacts)throw Error('No native wall impact '+JSON.stringify({kind,state,degrees,births}));
    report.push({kind,state,degrees,births,impacts,protectedHealth:target.hea,flashSuppressed:g.MuzzleBlocked()});
    wall.remove();target.remove();for(const b of bullets)b.remove();
   }
   return report;
  });check('one-unit walls and ceilings prevent cover bypass in all poses and aim directions',{cases:r.cover.length});
  await page.evaluate(()=>{sdWorld.HandleWorldLogic=muzzleResume;sdWorld.GSPEED=1;sdArtLab.stage();for(const e of sdCombatSandbox.enemies)e._ai_enabled=sdCharacter.AI_MODEL_NONE;});
  await page.waitForFunction(()=>sdWorld.my_entity.stands,null,{timeout:120000});
  await page.evaluate(()=>{sdWorld.HandleWorldLogic=()=>{};sdWorld.GSPEED=0;sdWorld.camera.x=736;sdWorld.camera.y=100;sdWorld.camera.scale=sdWorld.target_scale=3.2;
   const label=document.createElement('div');label.id='muzzle-label';label.style.cssText='position:fixed;left:12px;top:12px;background:#182532;color:white;padding:8px;font:16px sans-serif;z-index:12000';document.body.append(label);});
  for(const mode of ['original','A','B','C']){
   await page.evaluate(mode=>{sdArtLab.setMode(mode);const p=sdWorld.my_entity;p.look_x=784;p.look_y=112;p._weapon_draw_timer=0;p._recoil=0;sdWorld.GSPEED=1;for(let i=0;i<12;i++){p._ragdoll.AliveUpdate();p._ragdoll.Think(1);}sdWorld.GSPEED=0;
    const gun=p._inventory[p.gun_slot];gun.reload_time_left=0;gun.ammo_left=12;gun.Shoot(0,p.GetBulletSpawnOffset());document.getElementById('muzzle-label').textContent=mode+' · aligned native firing pose · ENGINE CAPTURE · Stage 1';sdRenderer.Render(sdWorld.frame);},mode);
   await page.screenshot({path:dir+'/'+mode.toLowerCase()+'-aligned.png'});
  }
  const crates=await page.evaluate(()=>{sdArtLab.setMode('A');const e=sdCombatSandbox.objects.find(e=>e instanceof sdStorage&&e.x===704&&!e._is_being_removed);return {native:sdArtLab.storage(sdRenderer.ctx,e)===false,props:sdCombatSandbox.objects.filter(e=>e instanceof sdStorage&&!e._is_being_removed).length};});assert(crates.native);check('A uses original cargo artwork',crates);
  assert.equal(r.errors.length,0);assert.equal(r.external.length,0);assert(!/logic error/i.test(await page.evaluate(()=>sdRenderer.service_mesage||'')));r.passed=true;
 }catch(e){r.failure=e.stack;throw e;}finally{fs.writeFileSync(dir+'/validation.json',JSON.stringify(r,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
