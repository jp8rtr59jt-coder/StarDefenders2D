const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
fs.mkdirSync('docs/advanced-movement',{recursive:true});
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await b.newPage({viewport:{width:1100,height:720}}),r={passed:false,errors:[],external:[],checks:[]};
 page.on('pageerror',e=>r.errors.push(e.stack));page.on('dialog',d=>d.dismiss());
 await page.route('**/*',q=>{if(new URL(q.request().url()).hostname!=='127.0.0.1'){r.external.push(q.request().url());return q.abort();}return q.continue();});
 const ticks=async n=>{const f=await page.evaluate(()=>sdWorld.frame);await page.waitForFunction(f=>sdWorld.frame>=f, f+n,{timeout:120000});};
 const state=()=>page.evaluate(()=>{const p=sdWorld.my_entity,s=sdMovementPrototype.state(p);return {x:p.x,y:p.y,sx:p.sx,sy:p.sy,ground:p.stands,crouch:p._crouch_intens,active:s.active,recovery:s.recovery,remaining:s.remaining,clear:p.CanUnCrouch(),box:[p._hitbox_y1,p._hitbox_y2],flying:p.flying,health:p.hea};});
 const check=(name,data)=>{r.checks.push({name,data});console.log('PASS',name,JSON.stringify(data));};
 const lane=async()=>{await page.keyboard.up('KeyD');await page.keyboard.up('KeyA');await page.keyboard.up('KeyH');await page.keyboard.up('Space');await page.keyboard.up('KeyW');await page.locator('#movement-traversal').click();await page.mouse.move(550,360);await ticks(8);};
 try{
  await page.goto('http://127.0.0.1:8000/?mode=combat&movement=1');
  await page.waitForFunction(()=>document.getElementById('offline_play')?.textContent==='Start combat sandbox',null,{timeout:120000});
  await page.evaluate(async()=>{
   await localforage.createInstance({name:'localforage'}).setItem('temporary_file_system',{sentinel:'original-world'});
   await localforage.createInstance({name:'sd-combat-experimental'}).setItem('temporary_file_system',{sentinel:'combat-world'});
   localStorage.setItem('temporary_file_system','{"legacy":"untouched"}');
  });
  await page.reload();await page.waitForFunction(()=>document.getElementById('offline_play')?.textContent==='Start combat sandbox',null,{timeout:120000});
  assert.equal(await page.evaluate(()=>localforage.config().name),'sd-movement-experimental');
  await page.locator('#offline_play').click();await page.waitForFunction(()=>!!document.getElementById('movement-traversal'),null,{timeout:120000});
  await lane();check('startup and traversal lane',await state());
  await page.keyboard.press('KeyH');await ticks(2);assert(!(await state()).active);check('stationary slide rejected');
  await page.keyboard.down('KeyD');await ticks(10);const run=await state();assert(run.sx>=3);check('native run',run);
  await page.keyboard.down('KeyH');await ticks(1);const start=await state();assert(start.active&&start.crouch===1&&start.box[0]===-6);assert(start.sx<=run.sx+.5);check('slide initiation, no boost, native reduced box',start);
  await page.keyboard.up('KeyD');
  await ticks(5);const middle=await state();assert(middle.active&&middle.sx<start.sx&&middle.x>start.x);check('momentum deceleration',middle);
  await page.waitForFunction(()=>!sdMovementPrototype.sliding(sdWorld.my_entity),null,{timeout:120000});const end=await state();check('natural termination',end);
  await ticks(20);assert(!(await state()).active);check('held key does not retrigger');await page.keyboard.up('KeyH');
  // Deterministic physics-step checks on the actual native character, not a mock collider.
  const measured=await page.evaluate(()=>{
   const p=sdWorld.my_entity,m=sdMovementPrototype;
   function place(x,y,sx){p.x=x;p.y=y;p.sx=sx;p.sy=0;p.stands=true;p._stands_on=sdCombatSandbox.fixed.find(e=>!e._is_being_removed&&e.x<=x&&e.x+e.width>x&&e.y===-64);p._crouch_intens=0;p._hitbox_last_update=-Infinity;p.UpdateHitbox();sdWorld.UpdateHashPosition(p,false);p._key_states.Reset();p.act_x=p.act_y=0;p.flying=false;p._in_air_timer=0;m.attach(p);}
   const step=(h=0)=>{p._key_states.SetKey('KeyH',h,true);p.onThink(1);};
   place(-820,-80,6);step(1);const initial=p.sx;let max=p.sx;let ticks=0;
   while(m.sliding(p)&&ticks++<80){step(0);max=Math.max(max,Math.abs(p.sx));}
   const distance=p.x+820;
   if(m.sliding(p)||max>6.001||distance<=0)throw Error('Unbounded slide');
   // Place beneath the native 24-unit ceiling, already crouched. Native stand
   // checks must retain the low box even after the movement state has ended.
   place(-624,-80,0);p._crouch_intens=1;p._hitbox_last_update=-Infinity;p.UpdateHitbox();sdWorld.UpdateHashPosition(p,false);
   for(let i=0;i<20;i++)step(0);
   const ceiling={crouch:p._crouch_intens,clear:p.CanUnCrouch(),top:p.y+p.hitbox_y1};
   if(ceiling.clear||p._crouch_intens<1||ceiling.top< -88)throw Error('Expanded into ceiling');
   place(-820,-80,-6);step(1);for(let i=0;i<8;i++)step(0);
   const left={x:p.x,sx:p.sx,active:m.sliding(p)};if(!left.active||left.x>=-820)throw Error('Left slide failed');
   const duration=m.tuning.durationMs;m.tuning.durationMs=100;
   place(-820,-80,6);step(1);for(let i=0;i<4;i++)step(0);
   const recovery={active:m.sliding(p),remaining:m.state(p).recovery};
   p.sx=6;step(1);if(m.sliding(p)||recovery.active||recovery.remaining<=0)throw Error('Recovery bypassed');
   for(let i=0;i<12;i++)step(0);p.sx=6;step(1);if(!m.sliding(p))throw Error('Recovery stuck');
   m.tuning.durationMs=duration;
   place(-679,-80,6);p._crouch_intens=1;m.refresh(p);step(0);
   const entrance={x:p.x,crouch:p._crouch_intens,clearOfGeometry:p.CanMoveWithoutOverlap(p.x,p.y,0)};
   if(!entrance.clearOfGeometry)throw Error('Recovery expanded into corridor entrance');
   place(-820,-80,40);step(1);const capped=p.sx;if(capped>m.tuning.maxSpeed)throw Error('Entry speed cap failed');
   place(-554,-80,6);step(1);for(let i=0;i<15;i++)step(0);
   const obstacle={x:p.x,active:m.sliding(p)};if(obstacle.x> -533||obstacle.active)throw Error('Low obstacle penetration');
   place(-690,-80,6);step(1);for(let i=0;i<32;i++)step(0);
   const corridor={x:p.x,active:m.sliding(p),crouch:p._crouch_intens,clear:p.CanUnCrouch(),top:p.y+p.hitbox_y1};
   if(corridor.active||corridor.clear||p.x<=-672||corridor.top< -88)throw Error('Corridor entry or recovery failed');
   p._key_states.SetKey('Space',1);for(let i=0;i<5;i++)step(0);
   if(p.y+p.hitbox_y1< -88.01)throw Error('Jump penetrated ceiling');
   place(-466,-144,-6);p._stands_on=sdCombatSandbox.fixed.find(e=>e.y===-128&&e.x<=p.x&&e.x+e.width>p.x);step(1);for(let i=0;i<10;i++)step(0);
   const ledge={active:m.sliding(p),ground:p.stands,y:p.y,sy:p.sy};if(ledge.active||ledge.ground)throw Error('Slide persisted in air '+JSON.stringify(ledge));
   place(-416,-80,6);step(1);for(let i=0;i<20;i++)step(0);
   const wall={x:p.x,sx:p.sx,active:m.sliding(p)};if(p.x> -389||wall.active)throw Error('Wall penetration');
   return {initialSpeed:initial,maxSpeed:max,steps:ticks,distance,left,recovery,entrance,capped,obstacle,ceiling,corridor,ledge,wall};
  });check('bounded simulation, corridor, ceiling, ledge and wall collision',measured);
  await lane();await page.keyboard.down('KeyD');await ticks(10);await page.keyboard.down('KeyH');await ticks(1);await page.keyboard.up('KeyH');
  const beforeAmmo=await page.evaluate(()=>sdWorld.my_entity._inventory[1].ammo_left);
  await page.mouse.move(880,260);await page.mouse.down();await ticks(3);await page.mouse.up();
  assert(await page.evaluate(n=>sdWorld.my_entity._inventory[1].ammo_left<n,beforeAmmo));check('pistol firing while sliding',await state());
  await page.keyboard.down('Space');await ticks(2);assert(!(await state()).active&&(await state()).sy<0);check('jump cancels slide',await state());
  await page.keyboard.up('Space');await page.keyboard.down('KeyW');
  await page.waitForFunction(()=>sdWorld.my_entity.flying,null,{timeout:120000});check('native jetpack after slide jump',await state());
  await page.keyboard.up('KeyW');await page.keyboard.up('KeyD');await ticks(8);
  assert(!(await state()).flying);check('jetpack release');
  await lane();await page.keyboard.down('KeyD');await ticks(10);await page.keyboard.down('KeyH');await ticks(1);await page.keyboard.up('KeyH');await page.keyboard.up('KeyD');
  const hit=await page.evaluate(()=>{
   const p=sdWorld.my_entity,e=sdCombatSandbox.spawn('basic');
   e.x=p.x+48;e.y=p.y;e.look_x=p.x;e.look_y=p.y;p.look_x=e.x;p.look_y=e.y;sdWorld.UpdateHashPosition(e,false);
   const gun=e._inventory[e.gun_slot];gun.ammo_left=12;gun.Shoot(0,e.GetBulletSpawnOffset());
   return {health:p.hea,sliding:sdMovementPrototype.sliding(p)};
  });
  assert(hit.sliding);await page.waitForFunction(h=>sdWorld.my_entity.hea<h,hit.health,{timeout:120000});const damaged=await state();assert(damaged.active);check('enemy projectile damages sliding actor',damaged);
  await page.evaluate(()=>{const p=sdWorld.my_entity;p.DamageWithEffect(p.hea+1);});await ticks(4);assert((await state()).health<=0&&!(await state()).active);assert(await page.evaluate(()=>!!sdWorld.my_entity._ragdoll));check('death cancels slide, native ragdoll');
  for(let i=0;i<3;i++){await page.locator('#combat-reset').click();await ticks(6);assert(!(await state()).active&&(await state()).health===250);}
  check('three resets clear movement state');
  await lane();
  await page.evaluate(()=>{
   globalThis.captureLogic=sdWorld.HandleWorldLogic;sdWorld.HandleWorldLogic=()=>{};
   const p=sdWorld.my_entity;p.look_x=p.x+200;p.look_y=p.y;p._side=1;
   p.sx=6;p.stands=true;p._key_states.Reset();
   sdWorld.camera.x=-730;sdWorld.camera.y=-90;sdWorld.camera.scale=3;
   for(let i=0;i<10;i++)p.onThink(1);
  });
  // Explicitly set the same framing for each frame and let unmodified WebGL render it.
  const shot=async(name,steps,h)=>{
   await page.evaluate(({steps,h})=>{
    const p=sdWorld.my_entity;p._key_states.SetKey('KeyH',h,true);
    for(let i=0;i<steps;i++)p.onThink(1);
    sdRenderer.Render(0);
   },{steps,h});
   await page.screenshot({path:'docs/advanced-movement/'+name+'.png'});
  };
  // Running speed is restored after the standing-pose warmup, with no teleport.
  await page.evaluate(()=>{sdWorld.my_entity.sx=6;});
  await shot('00-standing',0,0);await shot('01-slide-start',1,1);
  await shot('02-slide-motion',7,0);await shot('03-slide-recovery',32,0);
  await page.evaluate(()=>{sdWorld.HandleWorldLogic=captureLogic;delete globalThis.captureLogic;});
  check('native rendered standing, sliding and recovery sequence');
  await page.evaluate(()=>sdWorld.Stop());
  const saves=await page.evaluate(async()=>({
   original:await localforage.createInstance({name:'localforage'}).getItem('temporary_file_system'),
   combat:await localforage.createInstance({name:'sd-combat-experimental'}).getItem('temporary_file_system'),
   legacy:localStorage.getItem('temporary_file_system')
  }));
  assert.deepEqual(saves,{original:{sentinel:'original-world'},combat:{sentinel:'combat-world'},legacy:'{"legacy":"untouched"}'});check('original, combat and legacy saves unchanged',saves);
  assert(!/logic error/i.test(await page.evaluate(()=>sdRenderer.service_mesage||'')));assert.equal(r.errors.length,0);assert.equal(r.external.length,0);r.passed=true;
 }catch(e){r.failure=e.stack;throw e;}finally{fs.writeFileSync('docs/advanced-movement/validation.json',JSON.stringify(r,null,2));await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
