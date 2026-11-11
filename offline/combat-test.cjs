const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1100,height:720}});
 const page=await context.newPage();
 const result={checks:[],errors:[],external:[],passed:false};
 const check=(name,data)=>{result.checks.push({name,data});console.log('PASS',name,JSON.stringify(data));};
 page.on('pageerror',e=>{result.errors.push(e.stack);console.log('ERROR',e.stack);});
 page.on('dialog',d=>d.dismiss());
 await context.route('**/*',r=>{if(new URL(r.request().url()).hostname!=='127.0.0.1'){result.external.push(r.request().url());return r.abort();}return r.continue();});
 const ticks=async n=>{const f=await page.evaluate(()=>sdWorld.frame);await page.waitForFunction(t=>sdWorld.frame>=t,f+n,{timeout:120000});};
 try {
  await page.goto('http://127.0.0.1:8000/?mode=combat');
  await page.waitForFunction(()=>document.getElementById('offline_play')?.textContent==='Start combat sandbox',null,{timeout:120000});
  await page.locator('#offline_play').click();
  await page.waitForFunction(()=>sdWorld.my_entity?.hea>0,null,{timeout:120000});
  await ticks(25);
  check('startup',await page.evaluate(()=>({entities:sdEntity.entities.length,config:sdWorld.server_config.name,player:sdWorld.my_entity.GetClass(),bounds:sdWorld.world_bounds})));
  assert.equal(await page.evaluate(()=>sdWorld.my_entity.GetClass()),'sdCharacter');
  const start=await page.evaluate(()=>sdWorld.my_entity.x);
  await page.keyboard.down('KeyD');await ticks(10);await page.keyboard.up('KeyD');
  assert(await page.evaluate(x=>sdWorld.my_entity.x>x,start));check('movement');
  await page.keyboard.down('Space');await ticks(4);await page.keyboard.up('Space');
  assert(await page.evaluate(()=>sdWorld.my_entity.sy<0));check('jump');await ticks(45);
  await page.keyboard.down('KeyS');await ticks(10);await page.keyboard.up('KeyS');
  assert(await page.evaluate(()=>sdWorld.my_entity._crouch_intens>0.5));check('crouch');
  for(const kind of ['pistol','rifle','shotgun','railgun']){
   await page.locator('#combat-'+kind).click();await ticks(12);
   const before=await page.evaluate(()=>sdWorld.my_entity._inventory[sdWorld.my_entity.gun_slot].ammo_left);
   await page.mouse.move(850,220);await page.mouse.down();await ticks(4);await page.mouse.up();
   const after=await page.evaluate(()=>sdWorld.my_entity._inventory[sdWorld.my_entity.gun_slot].ammo_left);
   assert(after<before || before===-1);check('weapon '+kind,{before,after});
  }
  await page.locator('#combat-pistol').click();await ticks(12);
  await page.mouse.move(850,220);await page.mouse.down();await ticks(4);await page.mouse.up();
  await page.keyboard.down('KeyR');await ticks(2);await page.keyboard.up('KeyR');
  assert(await page.evaluate(()=>sdWorld.my_entity.reload_anim>0));await ticks(30);
  assert.equal(await page.evaluate(()=>sdWorld.my_entity._inventory[1].ammo_left),12);check('reload');
  // Real door sensor is triggered by a player from the matching AI team.
  await page.evaluate(()=>{const p=sdWorld.my_entity;p.x=208;p.y=144;p.sx=p.sy=0;sdWorld.UpdateHashPosition(p,false);});
  await ticks(35);
  check('door',await page.evaluate(()=>({open:sdCombatSandbox.door.openness,malfunction:sdCombatSandbox.door.malfunction})));
  assert(await page.evaluate(()=>sdCombatSandbox.door.openness>0));
  await page.evaluate(()=>{sdCombatSandbox.target.DamageWithEffect(100000,sdWorld.my_entity);const b=sdCombatSandbox.fixed[0];b.DamageWithEffect(100000,sdWorld.my_entity);});
  assert(await page.evaluate(()=>sdCombatSandbox.target._is_being_removed&&!sdCombatSandbox.fixed[0]._is_being_removed));check('destruction and fixed geometry');
  await page.locator('#combat-restore').click();assert(await page.evaluate(()=>!sdCombatSandbox.target._is_being_removed));check('restore objects');
  await page.locator('#combat-hostility').click();
  for(const kind of ['basic','intermediate','advanced']) await page.locator('#combat-'+kind).click();
  assert(await page.evaluate(()=>sdCombatSandbox.enemies.every(e=>!e._ai_enabled)));check('three passive enemy presets');
  await page.locator('#combat-hostility').click();
  await page.evaluate(()=>{const p=sdWorld.my_entity;p.x=112;p.y=144;p.sx=p.sy=0;p.hmax=p.hea=2000;sdWorld.UpdateHashPosition(p,false);});
  await page.waitForFunction(()=>sdWorld.my_entity.hea<2000,null,{timeout:120000});
  check('enemy AI, bullets and damage',await page.evaluate(()=>({health:sdWorld.my_entity.hea,targets:sdCombatSandbox.enemies.map(e=>!!e._ai?.target)})));
  await page.locator('#combat-hostility').click();
  await page.evaluate(()=>{globalThis.deadTest=sdCombatSandbox.spawn('basic');deadTest.DamageWithEffect(deadTest.hea+1,sdWorld.my_entity);});await ticks(5);
  assert(await page.evaluate(()=>deadTest.hea<=0&&!!deadTest._ragdoll));check('enemy death and ragdoll');
  await page.locator('#combat-respawn').click();await ticks(10);
  assert(await page.evaluate(()=>sdWorld.my_entity.hea===250&&sdWorld.my_entity.x===-560));check('respawn');
  // Open the original shop; place a selected existing block through its build gun.
  await page.keyboard.press('KeyB');assert(await page.evaluate(()=>sdShop.open));check('original build menu');
  await page.keyboard.press('Escape');
  const built=await page.evaluate(()=>{
   const p=sdWorld.my_entity;
   p._build_params=sdShop.options.find(o=>o._class==='sdBlock'&&o.width===32&&o.height===32&&o.material===sdBlock.MATERIAL_WALL);
   if(!p._build_params)throw Error('No original wall option');
   p.look_x=-512;p.look_y=144;
   const gun=sdCombatSandbox.equip(p,'build');
   p._weapon_draw_timer=0;gun.reload_time_left=0;
   const before=p.matter;
   if(!gun.Shoot())throw Error('Build shot rejected: '+sdCharacter.last_build_deny_reason);
   const b=p._last_built_entity;
   if(!b)throw Error('No built entity');
   return {type:b.GetClass(),x:b.x,y:b.y,matterSpent:before-p.matter};
  });check('original construction placement',built);
  for(let round=0;round<3;round++){
   await page.locator('#combat-reset').click();await ticks(10);
   await page.locator('#combat-basic').click();await ticks(15);
   assert(!/logic error/i.test(await page.evaluate(()=>sdRenderer.service_mesage||'')));
  }
  check('three encounter resets',await page.evaluate(()=>({entities:sdEntity.entities.length,enemies:sdCombatSandbox.enemies.length})));
  await page.screenshot({path:'offline/test-output/combat-sandbox.png'});
  assert.equal(result.errors.length,0);assert.equal(result.external.length,0);
  result.passed=true;
 }catch(e){result.failure=e.stack;throw e;}
 finally{fs.mkdirSync('offline/test-output',{recursive:true});fs.writeFileSync('offline/test-output/combat-results.json',JSON.stringify(result,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
