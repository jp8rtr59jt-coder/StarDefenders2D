/* Browser integration checks. Install Playwright separately; it is not a game dependency. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = path.resolve(process.env.TEST_OUTPUT || 'offline/test-output');
fs.mkdirSync(output, { recursive: true });

(async () => {
 const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage']
 });
 const context = await browser.newContext({ viewport: { width: 960, height: 640 } });
 const page = await context.newPage();
 const results = { date:new Date().toISOString(), browser:browser.version(), platform:process.platform,
  passed:false, checks: [], errors: [], externalRequests: [], failedRequests: [], badResponses: [] };
 page.on('pageerror', e => { results.errors.push(e.stack); console.log('ERROR', e.stack); });
 page.on('requestfailed', r => results.failedRequests.push({url:r.url(), error:r.failure()?.errorText}));
 page.on('response', r => { if(r.status() >= 400) results.badResponses.push({url:r.url(),status:r.status()}); });
 page.on('dialog', async d => { console.log('DIALOG', d.message()); await d.dismiss(); });
 await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
   results.externalRequests.push(url.href);
   return route.abort();
  }
  return route.continue();
 });
 const check = (name, evidence) => { results.checks.push({name,evidence}); console.log('PASS',name,JSON.stringify(evidence)); };
 try {
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8000/', {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => document.getElementById('server_status')?.textContent === 'Offline — ready', null, {timeout:120000});
  check('static startup', await page.evaluate(() => ({ready:document.getElementById('server_status').textContent, connected:socket.connected, music:sdMusic.enabled})));
  await page.locator('#offline_play').click();
  await page.waitForFunction(() => sdWorld.is_singleplayer && sdWorld.my_entity?.hea > 0, null, {timeout:120000});
  check('original offline sandbox launched', await page.evaluate(() => ({entities:sdEntity.entities.length,health:sdWorld.my_entity.hea,server:sdWorld.is_server,singleplayer:sdWorld.is_singleplayer})));
  await page.screenshot({path:path.join(output,'sandbox.png')});
  const ticks = async n => {
   const frame = await page.evaluate(() => sdWorld.frame);
   await page.waitForFunction(target => sdWorld.frame >= target, frame+n, {timeout:120000});
  };
  const state = () => page.evaluate(() => {
   const p=sdWorld.my_entity, g=p._inventory[p.gun_slot];
   return {x:p.x,y:p.y,sx:p.sx,sy:p.sy,stands:p.stands,health:p.hea,
    ammo:g?.ammo_left,capacity:g?.GetAmmoCapacity(),reload:p.reload_anim,
    look_x:p.look_x,look_y:p.look_y,crouch:p._crouch_intens,ragdoll:!!p._ragdoll,
    service:sdRenderer.service_mesage, frame:sdWorld.frame};
  });
  // Ephemeral test fixture: existing blocks and actors in the generated sandbox.
  // Nothing here is shipped as a level or changes production mechanics.
  await page.evaluate(() => {
   const p=sdWorld.my_entity;
   const x=Math.round(p.x/32)*32, y=Math.round(p.y/32)*32;
   globalThis.fixture={x,y,floor:y+64,wall:x+192,walls:[],bullets:[]};
   sdWorld.server_config.enable_bounds_move=false;
   sdWorld.server_config.GetAllowedWorldEvents=()=>[];
   sdWeather.only_instance._daily_events=[];
   if(p.driver_of) p.driver_of.ExcludeDriver(p,true);
   for(const e of sdEntity.entities.slice()) {
    if(e!==p && e._held_by!==p && e._ragdoll?.character!==p && Math.abs(e.x-x)<600 && Math.abs(e.y-y)<450 && !e.IsGlobalEntity()) {
     e.remove();e._broken=false;
    }
   }
   for(let dx=-160;dx<=512;dx+=32) {
    const b=new sdBlock({x:x+dx,y:y+64,width:32,height:32,material:sdBlock.MATERIAL_WALL});
    sdEntity.AddEntityToEntitiesArray(b);sdWorld.UpdateHashPosition(b,false);
   }
   for(let dy=-128;dy<64;dy+=32) {
    const b=new sdBlock({x:x+192,y:y+dy,width:32,height:32,material:sdBlock.MATERIAL_WALL});
    sdEntity.AddEntityToEntitiesArray(b);sdWorld.UpdateHashPosition(b,false);fixture.walls.push(b);
   }
   p.x=x;p.y=y;p.sx=0;p.sy=0;p._stands_on=null;p.stands=false;
   p.driver_of=null;p._frozen=0;p._in_air_timer=0;p.matter=1000;
   if(!p._inventory.some(g=>g?.class===sdGun.CLASS_PISTOL)) {
    const gun=new sdGun({x:p.x,y:p.y,class:sdGun.CLASS_PISTOL});
    sdEntity.AddEntityToEntitiesArray(gun);p.onMovementInRange(gun);
   }
   p.gun_slot=p._inventory.findIndex(g=>g?.class===sdGun.CLASS_PISTOL);
   p.alt_gun_slot=-1;
   sdWorld.UpdateHashPosition(p,false);
   sdWorld.camera.x=p.x;sdWorld.camera.y=p.y;
   const add=sdEntity.AddEntityToEntitiesArray;
   sdEntity.AddEntityToEntitiesArray=function(e) {
    if(e instanceof sdBullet) fixture.bullets.push({owner:e._owner?._net_id,sx:e.sx,sy:e.sy});
    return add.call(this,e);
   };
  });
  await ticks(30);
  const standing=await state();
  assert(standing.stands,JSON.stringify(standing));
  const floor=await page.evaluate(()=>fixture.floor);
  assert(standing.y < floor && Math.abs(standing.sy)<0.1);
  check('gravity and floor collision',standing);
  await page.keyboard.down('KeyD'); await ticks(18); await page.keyboard.up('KeyD');
  const moved=await state();
  assert(moved.x>standing.x+15,JSON.stringify(moved));
  check('keyboard movement',{from:standing.x,to:moved.x});
  await ticks(15);
  const beforeJump=await state();
  await page.keyboard.down('Space'); await ticks(5); await page.keyboard.up('Space');
  const jumped=await state();
  assert(jumped.y<beforeJump.y-5,JSON.stringify(jumped));
  check('jump',{beforeY:beforeJump.y,afterY:jumped.y,sy:jumped.sy});
  await ticks(50);
  await page.keyboard.down('KeyS');await ticks(12);
  const crouched=await state();
  await page.keyboard.up('KeyS');
  assert(crouched.crouch>0.5 && crouched.ragdoll,JSON.stringify(crouched));
  check('crouch and animation state',{crouch:crouched.crouch,ragdoll:crouched.ragdoll});
  await page.keyboard.down('KeyD');await ticks(90);await page.keyboard.up('KeyD');
  const blocked=await state();
  const wall=await page.evaluate(()=>fixture.wall);
  assert(blocked.x<wall && blocked.x>wall-20,JSON.stringify(blocked));
  check('wall collision',{playerX:blocked.x,wallX:wall});
  await page.evaluate(()=>{
   for(const b of fixture.walls){b.remove();b._broken=false;}
   const p=sdWorld.my_entity;p.x=fixture.x;p.y=fixture.floor-p.hitbox_y2-0.01;p.sx=0;p.sy=0;
   sdWorld.UpdateHashPosition(p,false);sdWorld.camera.x=p.x;sdWorld.camera.y=p.y;
  });
  await ticks(12);
  await page.mouse.move(700,220);await ticks(3);
  const aimed=await state();
  assert(aimed.look_x>aimed.x && aimed.look_y<aimed.y);
  check('mouse aiming',{x:aimed.x,y:aimed.y,lookX:aimed.look_x,lookY:aimed.look_y});
  const ammoBefore=aimed.ammo;
  await page.mouse.down();await ticks(3);await page.mouse.up();
  const shot=await state();
  const shots=await page.evaluate(()=>fixture.bullets.filter(b=>b.owner===sdWorld.my_entity._net_id));
  assert(shot.ammo<ammoBefore && shots.length>0,JSON.stringify({shot,shots}));
  check('shooting and projectile creation',{before:ammoBefore,after:shot.ammo,projectiles:shots.length});
  await page.keyboard.down('KeyR');await ticks(2);
  const reloading=await state();
  await page.keyboard.up('KeyR');await ticks(30);
  const reloaded=await state();
  assert(reloading.reload>0 && reloaded.ammo===reloaded.capacity,JSON.stringify({reloading,reloaded}));
  check('reload',{animation:reloading.reload,ammo:reloaded.ammo,capacity:reloaded.capacity});
  await page.evaluate(()=>{
   const p=sdWorld.my_entity;
   const enemy=new sdCharacter({x:p.x+140,y:p.y,_ai_enabled:sdCharacter.AI_MODEL_FALKOK,_ai_level:4});
   enemy._ai_team=1;enemy.title='Integration test enemy';enemy.matter=1000;
   sdEntity.AddEntityToEntitiesArray(enemy);sdWorld.UpdateHashPosition(enemy,false);
   const gun=new sdGun({x:enemy.x,y:enemy.y,class:sdGun.CLASS_PISTOL});
   sdEntity.AddEntityToEntitiesArray(gun);enemy.onMovementInRange(gun);
   enemy._ai_gun_slot=gun.GetSlot();enemy.gun_slot=gun.GetSlot();
   fixture.enemy=enemy;fixture.playerHealth=p.hea;fixture.playerArmor=p.armor;
  });
  // Let the unchanged AI acquire its target, move, aim and shoot.
  await page.waitForFunction(()=>fixture.bullets.some(b=>b.owner===fixture.enemy._net_id),null,{timeout:120000});
  const enemyAI=await page.evaluate(()=>({target:fixture.enemy._ai?.target?._net_id,player:sdWorld.my_entity._net_id,
   bullets:fixture.bullets.filter(b=>b.owner===fixture.enemy._net_id).length,
   x:fixture.enemy.x,health:sdWorld.my_entity.hea,armor:sdWorld.my_entity.armor}));
  assert.equal(enemyAI.target,enemyAI.player);
  check('enemy AI targeting and firing',enemyAI);
  await page.waitForFunction(()=>sdWorld.my_entity.hea<fixture.playerHealth || sdWorld.my_entity.armor<fixture.playerArmor,null,{timeout:120000});
  check('enemy projectile hits player',await page.evaluate(()=>({health:sdWorld.my_entity.hea,armor:sdWorld.my_entity.armor})));
  // Give only the disposable test actor more health so timing/AI randomness on a
  // software-rendered CI browser cannot end the fixture before the save check.
  await page.evaluate(()=>{sdWorld.my_entity.hmax=2000;sdWorld.my_entity.hea=2000;});
  // Aim at the moving enemy through the original mouse-input path.
  const enemyHealth=await page.evaluate(()=>fixture.enemy.hea);
  await page.mouse.down();
  for(let i=0;i<30;i++) {
   const pos=await page.evaluate(()=>{
    const e=fixture.enemy;
    return {x:((e.x-sdWorld.camera.x)*sdWorld.camera.scale+sdRenderer.screen_width/2)/sdRenderer.resolution_quality,
     y:((e.y-4-sdWorld.camera.y)*sdWorld.camera.scale+sdRenderer.screen_height/2)/sdRenderer.resolution_quality};
   });
   await page.mouse.move(pos.x,pos.y);await ticks(6);
   if(await page.evaluate(()=>fixture.enemy.hea<=0)) break;
  }
  await page.mouse.up();
  const hurtEnemy=await page.evaluate(()=>({health:fixture.enemy.hea,ragdoll:!!fixture.enemy._ragdoll}));
  assert(hurtEnemy.health<=0 && hurtEnemy.ragdoll,JSON.stringify(hurtEnemy));
  check('player projectiles damage enemy',{before:enemyHealth,...hurtEnemy});
  await page.screenshot({path:path.join(output,'combat.png')});
  assert(!/logic error/i.test((await state()).service || ''),(await state()).service);
  // Exercise the original Save & quit action and verify IndexedDB on a reload.
  await page.evaluate(()=>{
   fixture.enemy.remove();fixture.enemy._broken=false;
   const p=sdWorld.my_entity;
   const marker=new sdBlock({x:fixture.x-96,y:fixture.floor-32,width:32,height:32,material:sdBlock.MATERIAL_WALL,hue:17});
   sdEntity.AddEntityToEntitiesArray(marker);sdWorld.UpdateHashPosition(marker,false);
   fixture.marker=marker;
  });
  const expectedSave=await page.evaluate(()=>({player:sdWorld.my_entity._net_id,
   marker:fixture.marker._net_id,x:fixture.marker.x,y:fixture.marker.y}));
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{
   const option=sdContextMenu.options.find(o=>/Save & quit/.test(o.title));
   if(!option) throw new Error('Save & quit action not found: '+JSON.stringify(sdContextMenu.options.map(o=>o.title)));
   option.action();
  });
  await page.waitForFunction(()=>sdWorld.paused,null,{timeout:120000});
  const stored=await page.evaluate(async()=>{
   await new Promise(resolve=>setTimeout(resolve,1000));
   return await localforage.getItem('temporary_file_system');
  });
  assert(stored && Object.keys(stored).some(k=>k.includes('snapshot')), 'No persisted snapshot in IndexedDB');
  check('save to IndexedDB',{files:Object.keys(stored)});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('server_status')?.textContent==='Offline — ready',null,{timeout:120000});
  await page.locator('#offline_play').click();
  await page.waitForFunction(()=>sdWorld.my_entity?.hea>0,null,{timeout:120000});
  const restored=await page.evaluate(id=>{
   const marker=sdEntity.entities_by_net_id_cache_map.get(id);
   return {player:sdWorld.my_entity._net_id,health:sdWorld.my_entity.hea,entities:sdEntity.entities.length,
    marker:marker&&{id:marker._net_id,x:marker.x,y:marker.y,hue:marker.hue}};
  },expectedSave.marker);
  assert.equal(restored.player,expectedSave.player);
  assert.deepEqual(restored.marker,{id:expectedSave.marker,x:expectedSave.x,y:expectedSave.y,hue:17});
  check('save reload',restored);
  assert.equal(results.errors.length,0);
  assert.equal(results.externalRequests.length,0);
  assert(results.badResponses.every(r=>r.url.endsWith('/audio/rocket_loop.wav')),JSON.stringify(results.badResponses));
  results.passed=true;
 } catch (error) {
  results.failure=error.stack;
  throw error;
 } finally {
  fs.writeFileSync(path.join(output,'results.json'), JSON.stringify(results,null,2));
  await browser.close();
 }
})().catch(e => { console.error(e); process.exitCode=1; });
