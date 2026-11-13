/* Native projectile/character integration fixtures; no damage or ragdoll mocks. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const dir='docs/physical-combat/stage2';fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1200,height:800}}),page=await context.newPage();
 const r={date:new Date().toISOString(),browser:browser.version(),passed:false,checks:[],errors:[],external:[],badResponses:[]};
 page.on('pageerror',e=>r.errors.push(e.stack));page.on('dialog',d=>d.dismiss());page.on('response',q=>{if(q.status()>=400)r.badResponses.push({url:q.url(),status:q.status()});});
 await context.route('**/*',q=>{if(new URL(q.request().url()).hostname!=='127.0.0.1'){r.external.push(q.request().url());return q.abort();}return q.continue();});
 const check=(name,data)=>{r.checks.push({name,data});console.log('PASS',name,JSON.stringify(data));};
 const ticks=async n=>{const f=await page.evaluate(()=>sdWorld.frame);await page.waitForFunction(f=>sdWorld.frame>=f,f+n,{timeout:120000});};
 try{
  await page.goto('http://127.0.0.1:8000/?mode=combat&movement=1&art=1&physical=1');
  await page.waitForFunction(()=>document.getElementById('server_status')?.textContent==='Offline — ready',null,{timeout:120000});
  await page.evaluate(async()=>{for(const name of ['localforage','sd-combat-experimental','sd-movement-experimental','sd-art-direction-lab'])await localforage.createInstance({name}).setItem('temporary_file_system',{sentinel:name});localStorage.setItem('temporary_file_system','{"legacy":"preserved"}');});
  assert.equal(await page.evaluate(()=>localforage.config().name),'sd-physical-combat-lab');
  await page.locator('#offline_play').click();await page.waitForFunction(()=>document.getElementById('physical-controls')&&sdPhysicalCombat.targets.length>0,null,{timeout:120000});
  await page.waitForFunction(()=>sdRenderer.dark_tint<=0,null,{timeout:120000});
  check('isolated lab launches; player unchanged',await page.evaluate(()=>({namespace:localforage.config().name,player:sdWorld.my_entity.hea,target:sdPhysicalCombat.targets[0].hea,hostile:sdCombatSandbox.hostile})));
  assert.equal(await page.evaluate(()=>sdWorld.my_entity.hea),250);
  await page.evaluate(()=>{
   globalThis.physicalResume=sdWorld.HandleWorldLogic;sdWorld.HandleWorldLogic=()=>{};sdWorld.GSPEED=1;
   const lab=sdPhysicalCombat,a=sdCombatSandbox;
   globalThis.physicalFixture={
    fresh(profile='unarmored',tier='intermediate'){
     lab.tier=tier;const e=lab.encounter(profile),p=sdWorld.my_entity;e._ai_enabled=sdCharacter.AI_MODEL_NONE;
     for(const c of [p,e]){c.stability=100;c._weapon_draw_timer=0;c._key_states.Reset();c._crouch_intens=0;c._hitbox_last_update=-Infinity;c.UpdateHitbox();sdWorld.UpdateHashPosition(c,false);c._ragdoll._smooth_x=c.x;c._ragdoll._smooth_y=c.y;c._ragdoll._smooth_look_x=c.look_x;c._ragdoll._smooth_look_y=c.look_y;}
     this.target=e;return e;
    },
    fire(kind='pistol',dy=3){
     const e=this.target,p=sdWorld.my_entity,g=a.equip(p,kind);p.sx=p.sy=0;p.look_x=e.x;p.look_y=e.y+dy;p._weapon_draw_timer=0;p._recoil=0;p.fire_anim=0;p.reload_anim=0;
     p._ragdoll._smooth_x=p.x;p._ragdoll._smooth_y=p.y;p._ragdoll._smooth_look_x=p.look_x;p._ragdoll._smooth_look_y=p.look_y;
     for(let i=0;i<14;i++){p._ragdoll.AliveUpdate();p._ragdoll.Think(1);}
     g.reload_time_left=0;g.ammo_left=kind==='railgun'?-1:30;const start=sdEntity.entities.length,random=Math.random;Math.random=()=>.5;
     try{if(!g.Shoot(0,p.GetBulletSpawnOffset()))throw Error('Native Shoot rejected');}finally{Math.random=random;}
     const bullets=sdEntity.entities.slice(start).filter(b=>b instanceof sdBullet&&b._owner===p),before=e.hea;
     for(const b of bullets)for(let i=0;i<20&&!b._is_being_removed;i++){b.UpdateHitbox();b.onThink(1);sdWorld.UpdateHashPosition(b,false);}
     if(before===e.hea)throw Error('Native projectile missed '+kind+' y '+dy);
     return {...lab.state(e).last,actualLoss:before-e.hea,phase:lab.state(e).phase,stability:e.stability,bullets:bullets.length};
    },
    step(n){const e=this.target;for(let i=0;i<n;i++){sdWorld.time+=1000/30;sdWorld.frame++;e.onThink(1);sdWorld.UpdateHashPosition(e,false);for(const fx of lab.particles)if(!fx._is_being_removed)fx.onThink(1);for(const m of lab.marks)if(!m._is_being_removed)m.onThink(1);}return {health:e.hea,phase:lab.state(e).phase,time:lab.state(e).time,stability:e.stability,mobility:e.mobility,dying:e._dying,death:e.death_anim};}
   };
  });
  r.health=await page.evaluate(()=>{const f=physicalFixture,lab=sdPhysicalCombat,old=lab.tuning.criticalChance;lab.tuning.criticalChance=0;
   try{const result=[];for(const tier of ['basic','intermediate','advanced']){const e=f.fresh('unarmored',tier);let shots=0;while(e.hea>0&&shots<10){f.fire();shots++;}result.push({tier,health:e.hmax,shots,remaining:e.hea});}return result;}finally{lab.tuning.criticalChance=old;}});
  assert(r.health.every(x=>x.health===60&&x.shots===4));check('all training tiers: four native pistol torso shots instead of fourteen',r.health);
  r.armor=await page.evaluate(()=>{const rows=[];for(const profile of ['unarmored','light','heavy'])for(const weapon of ['pistol','rifle','railgun']){physicalFixture.fresh(profile);rows.push({profile,weapon,...physicalFixture.fire(weapon)});}return rows;});
  const find=(p,w)=>r.armor.find(x=>x.profile===p&&x.weapon===w);
  assert(find('heavy','pistol').loss<find('light','pistol').loss&&find('light','pistol').loss<find('unarmored','pistol').loss);
  assert.equal(find('light','rifle').loss,find('unarmored','rifle').loss);assert(find('heavy','railgun').health<=0);check('native armor absorption and ammunition penetration measured',r.armor);
  assert.equal(find('unarmored','pistol').stability,100);check('ordinary first torso hit does not force collapse');
  const shotgun=await page.evaluate(()=>{physicalFixture.fresh();return physicalFixture.fire('shotgun');});assert.equal(shotgun.bullets,5);check('shotgun retains five native pellets',shotgun);
  const arm=await page.evaluate(()=>{const f=physicalFixture,l=sdPhysicalCombat,attempts=[];
   for(let dy=-1;dy<8;dy+=.5){const e=f.fresh();e.look_x=560;e.look_y=144;for(let i=0;i<14;i++){e._ragdoll.AliveUpdate();e._ragdoll.Think(1);}const hit=f.fire('pistol',dy);attempts.push({dy,region:hit.region,x:hit.x,y:hit.y});
    if(hit.region==='arms'){const s=l.state(e),stunned=f.step(1),timer=e.weapon_stun_timer;f.step(30);return {hit,stunned,timer,recovered:e.weapon_stun_timer,attempts};}}
   return {hit:null,attempts};});
  assert(arm.hit,'No native projectile reached an approximate arm region '+JSON.stringify(arm));assert(arm.timer>0&&arm.recovered===0);check('rig-overlap arm approximation causes finite native weapon stun',arm);
  const head=await page.evaluate(()=>{physicalFixture.fresh('heavy');return physicalFixture.fire('pistol',-7);});assert.equal(head.region,'head');assert(head.health<=0&&head.absorbed===0);check('unprotected head retains native head detection and is highly vulnerable',head);
  const degrade=await page.evaluate(()=>{const f=physicalFixture,e=f.fresh('heavy'),s=sdPhysicalCombat.state(e);e.armor=4;const h=f.fire();return {...h,broken:e.armor_max===0};});assert(degrade.broken&&degrade.absorbed===4&&degrade.loss>10);check('native armor break and overflow expose health',degrade);
  const leg=await page.evaluate(()=>{const f=physicalFixture,l=sdPhysicalCombat,old=l.tuning.criticalChance;l.tuning.criticalChance=0;try{f.fresh();const h=f.fire('rifle',12),down=f.step(1),recovered=f.step(90);return {hit:h,down,recovered};}finally{l.tuning.criticalChance=old;}});
  assert.equal(leg.hit.region,'legs');assert(leg.down.stability<50&&leg.down.mobility<33);assert.equal(leg.recovered.mobility,33);check('leg impact uses native instability and finite mobility restriction',leg);
  r.critical=await page.evaluate(()=>{
   const f=physicalFixture,l=sdPhysicalCombat,e=f.fresh(),s=l.state(e);s.seed=1; // reproducible occasional outcome, default 35% chance
   const hit=f.fire('rifle',12);if(s.phase!=='critical')throw Error('Seeded severe hit failed to become critical');
   const startHealth=e.hea,startBones=e._ragdoll.bones.map(b=>[b.x,b.y]),ammo=e._inventory[e.gun_slot].ammo_left;
   e._ai_enabled=e._combatModel;e._key_states.SetKey('Mouse1',1,true);const entityStart=sdEntity.entities.length,down=f.step(30);
   const afterAmmo=e._inventory[e.gun_slot]?.ammo_left;
   const stable=e._ragdoll.bones.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y)&&Math.hypot(b.x-e.x,b.y-e.y)<100);
   return {hit,startHealth,down,ammo,afterAmmo,enemyBullets:sdEntity.entities.slice(entityStart).filter(b=>b instanceof sdBullet&&b._owner===e).length,stable,deadline:s.deadline,bonesMoved:JSON.stringify(startBones)!==JSON.stringify(e._ragdoll.bones.map(b=>[b.x,b.y]))};
  });assert.equal(r.critical.hit.phase,'critical');assert.equal(r.critical.ammo,r.critical.afterAmmo);assert.equal(r.critical.enemyBullets,0);assert(r.critical.stable&&r.critical.bonesMoved&&r.critical.down.health<r.critical.startHealth);check('seeded native collapse, blood loss, active AI cannot fire',r.critical);
  // Actual engine captures at consecutive simulation times, not illustrations.
  const capture=async(name,label)=>{await page.evaluate(label=>{let tag=document.getElementById('physical-capture');if(!tag){tag=document.createElement('div');tag.id='physical-capture';tag.style.cssText='position:fixed;top:12px;left:12px;padding:8px;background:#182532;color:white;font:16px sans-serif;z-index:15000';document.body.append(tag);}tag.textContent=label+' · ENGINE CAPTURE · prototype';sdWorld.GSPEED=0;sdWorld.camera.x=624;sdWorld.camera.y=125;sdWorld.camera.scale=sdWorld.target_scale=4;sdRenderer.Render(sdWorld.frame);},label);await page.screenshot({path:dir+'/'+name+'.png'});await page.evaluate(()=>sdWorld.GSPEED=1);};
  await capture('01-critical-collapse','A · severe leg impact · 1 simulated second');
  const mid=await page.evaluate(()=>physicalFixture.step(60));await capture('02-bleeding','A · incapacitated · 3 simulated seconds');
  const end=await page.evaluate(()=>{const f=physicalFixture,e=f.target,s=sdPhysicalCombat.state(e);let ticks=0;while(e.hea>0&&ticks++<900)f.step(1);const endedAt=s.time;f.step(90);return {ticks,endedAt,health:e.hea,phase:s.phase,dying:e._dying,death:e.death_anim,finite:e._ragdoll.bones.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y))};});
  assert(end.health<=0&&end.phase==='dead'&&!end.dying&&end.finite&&end.endedAt<=r.critical.deadline+1000/30);check('bleeding terminates, native death and settled corpse remain finite',{mid,end});await capture('03-native-death','A · finite bleedout followed by native death');
  const endpoint=await page.evaluate(()=>{const f=physicalFixture,l=sdPhysicalCombat,e=f.fresh(),s=l.state(e);s.seed=1;f.fire('rifle',12);e.hea=1000;const end=f.step(Math.ceil((s.deadline-s.time)/1000*30)+1);return {...end,deadline:s.deadline};});assert(endpoint.health<=0);check('hard simulation-time endpoint prevents immortal critical target',endpoint);
  const outcomes=await page.evaluate(()=>{const f=physicalFixture,counts={critical:0,wounded:0};for(let i=0;i<32;i++){f.fresh();const hit=f.fire('rifle',12);counts[hit.phase]++;}return counts;});assert(outcomes.critical>0&&outcomes.wounded>0);check('default chance produces both critical and recoverable severe leg injuries',outcomes);
  const caps=await page.evaluate(()=>{const f=physicalFixture,l=sdPhysicalCombat,e=f.fresh(),s=l.state(e),bg=sdCombatSandbox.add(new sdBG({x:640,y:96,width:128,height:64}));
   // The frozen fixture loop deferred normal removal callbacks. Finish native
   // effect removal so its separate per-type budget cannot mask our cap check.
   for(const fx of sdEntity.entities.slice())if(fx instanceof sdEffect&&fx._is_being_removed){fx._remove();sdEntity.RemoveEntityFromEntitiesArray(fx);}
   const seed=s.seed;for(let i=0;i<160;i++){s.time+=500;l.blood(e,650+(i%7)*16,128,2,10,0);}const result={particles:l.particles.filter(e=>!e._is_being_removed).length,marks:l.marks.filter(e=>!e._is_being_removed).length,decisionSeedUnchanged:seed===s.seed};
   l.tuning.bloodIntensity=0;const n=l.particles.length;s.time+=1000;l.blood(e,656,128,2);result.zeroIntensityAdds=l.particles.length-n;l.tuning.bloodIntensity=1;bg.remove();return result;});
  assert(caps.particles===96&&caps.marks===24&&caps.decisionSeedUnchanged&&caps.zeroIntensityAdds===0);check('native blood droplets / background decals are capped; cosmetic RNG isolated',caps);
  for(const [id,value] of [['physical-particles','8'],['physical-marks','4']]){await page.locator('#'+id).fill(value);await page.locator('#'+id).press('Tab');}
  const trimmed=await page.evaluate(()=>({particles:sdPhysicalCombat.particles.length,marks:sdPhysicalCombat.marks.length}));assert(trimmed.particles<=8&&trimmed.marks<=4);check('cap controls immediately trim existing laboratory effects',trimmed);
  for(const [id,value] of [['physical-particles','96'],['physical-marks','24'],['physical-health','75']]){await page.locator('#'+id).fill(value);await page.locator('#'+id).press('Tab');}
  assert.equal(await page.evaluate(()=>sdPhysicalCombat.targets[0].hmax),75);assert.equal(await page.evaluate(()=>sdWorld.my_entity.hmax),250);await page.locator('#physical-health').fill('60');await page.locator('#physical-health').press('Tab');check('health control recreates target without changing player health');
  const defaults=await page.evaluate(()=>{const l=sdPhysicalCombat;const native=l.setEnabled(false);const h=physicalFixture.target=native;const hit=physicalFixture.fire();const oldHealth=h.hmax;let oldShots=1;while(h.hea>0&&oldShots<30){physicalFixture.fire();oldShots++;}const fresh=l.setEnabled(true);return {oldHealth,oldShots,hit,experimentalHealth:fresh.hmax,originalPlayer:sdWorld.my_entity.hmax};});assert.equal(defaults.oldHealth,250);assert.equal(defaults.oldShots,14);assert.equal(defaults.hit.actualLoss,18);assert.equal(defaults.hit.phase,'original');assert.equal(defaults.experimentalHealth,60);assert.equal(defaults.originalPlayer,250);check('model toggle creates fresh original / experimental encounters',defaults);
  // Resume the real offline loop for UI/AI and reset checks.
  await page.evaluate(()=>{document.getElementById('physical-capture')?.remove();sdWorld.HandleWorldLogic=physicalResume;sdWorld.GSPEED=1;});
  for(const profile of ['unarmored','light','heavy']){await page.locator('#physical-'+profile).click();await ticks(2);assert.equal(await page.evaluate(()=>sdPhysicalCombat.targets.length),1);}
  for(const tier of ['basic','intermediate','advanced']){await page.selectOption('#physical-training',tier);assert.equal(await page.evaluate(()=>sdPhysicalCombat.targets[0].hmax),60);}
  await page.locator('#combat-hostility').click();await page.evaluate(()=>{const p=sdWorld.my_entity;p.hmax=p.hea=1000;});
  await page.waitForFunction(()=>sdWorld.my_entity.hea<1000,null,{timeout:120000});check('laboratory target retains native AI and inflicts meaningful damage',await page.evaluate(()=>({health:sdWorld.my_entity.hea,phase:sdWorld.server_config.humanoid_ai.state(sdPhysicalCombat.targets[0]).phase})));
  await page.locator('#combat-hostility').click();
  const counts=[];for(let i=0;i<6;i++){await page.locator('#physical-range').click();await ticks(3);counts.push(await page.evaluate(()=>({live:sdEntity.entities.filter(e=>!e._is_being_removed).length,targets:sdPhysicalCombat.targets.length,particles:sdPhysicalCombat.particles.length,marks:sdPhysicalCombat.marks.length,history:sdPhysicalCombat.history.length,health:sdWorld.my_entity.hea})));}
  assert(counts.every(x=>x.targets===1&&x.particles===0&&x.marks===0&&x.history===0&&x.health===250));assert(Math.max(...counts.map(x=>x.live))-Math.min(...counts.map(x=>x.live))<20);check('six fresh encounters clear injury state and bound entity counts',counts);
  const boxes=await page.evaluate(()=>{const e=sdCombatSandbox.spawn('basic'),box=c=>[c.hitbox_x1,c.hitbox_x2,c.hitbox_y1,c.hitbox_y2],before=box(e),nativeHealth=e.hmax,nativePolicy=sdPhysicalCombat.has(e);sdPhysicalCombat.attach(e);return {before,after:box(e),nativeHealth,nativePolicy};});assert.deepEqual(boxes.before,boxes.after);assert.equal(boxes.nativeHealth,250);assert.equal(boxes.nativePolicy,false);check('attachment leaves hitboxes intact; standard sandbox spawns retain 250 HP',boxes);
  await page.locator('#movement-traversal').click();await ticks(8);await page.keyboard.down('KeyD');await ticks(10);await page.keyboard.down('KeyH');await ticks(1);
  assert(await page.evaluate(()=>sdMovementPrototype.sliding(sdWorld.my_entity)));await page.keyboard.up('KeyH');
  const ammo=await page.evaluate(()=>sdWorld.my_entity._inventory[1].ammo_left);await page.mouse.move(880,280);await page.mouse.down();await ticks(2);await page.mouse.up();assert(await page.evaluate(n=>sdWorld.my_entity._inventory[1].ammo_left<n,ammo));
  await page.keyboard.down('Space');await ticks(2);assert(await page.evaluate(()=>!sdMovementPrototype.sliding(sdWorld.my_entity)&&sdWorld.my_entity.sy<0));await page.keyboard.up('Space');await page.keyboard.down('KeyW');await page.waitForFunction(()=>sdWorld.my_entity.flying,null,{timeout:120000});await page.keyboard.up('KeyW');await page.keyboard.up('KeyD');check('live sliding, firing, jump and jetpack work with injury lab enabled');
  assert(!/logic error/i.test(await page.evaluate(()=>sdRenderer.service_mesage||'')));
  await page.evaluate(()=>sdWorld.Stop());
  const saves=await page.evaluate(async()=>({values:await Promise.all(['localforage','sd-combat-experimental','sd-movement-experimental','sd-art-direction-lab'].map(async name=>({name,value:await localforage.createInstance({name}).getItem('temporary_file_system')}))),legacy:localStorage.getItem('temporary_file_system')}));for(const x of saves.values)assert.deepEqual(x.value,{sentinel:x.name});assert.equal(saves.legacy,'{"legacy":"preserved"}');check('all prior namespaces and legacy save unchanged',saves);
  for(const query of ['','?mode=combat','?mode=combat&movement=1','?mode=combat&movement=1&art=1']){
   await page.goto('http://127.0.0.1:8000/'+query);await page.waitForFunction(()=>document.getElementById('server_status')?.textContent==='Offline — ready',null,{timeout:120000});assert.equal(await page.evaluate(()=>typeof sdPhysicalCombat),'undefined');assert.equal(await page.locator('#physical-controls').count(),0);
  }check('all original modes omit the optional injury policy');
  assert.equal(r.errors.length,0);assert.equal(r.external.length,0);assert(r.badResponses.every(q=>q.url.endsWith('/audio/rocket_loop.wav')));r.passed=true;
 }catch(e){r.failure=e.stack;throw e;}finally{fs.writeFileSync(dir+'/validation.json',JSON.stringify(r,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
