/* Native movement regression: no collider, movement or physics mocks. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const baseline=process.env.CROUCH_BASELINE==='1',out=process.env.CROUCH_OUTPUT||'docs/integrated-combat-3g';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1200,height:800}}),r={passed:false,baseline,checks:[],errors:[],external:[]};
 page.on('pageerror',e=>r.errors.push(e.stack));page.on('dialog',d=>d.dismiss());await page.route('**/*',q=>{if(new URL(q.request().url()).hostname!=='127.0.0.1'){r.external.push(q.request().url());return q.abort();}return q.continue();});
 const check=(name,data)=>{r.checks.push({name,data});console.log('PASS',name,JSON.stringify(data));};
 try {
  await page.goto((process.env.CROUCH_BASE_URL||'http://127.0.0.1:8000/')+'?mode=combat&movement=1');
  await page.waitForFunction(()=>document.getElementById('server_status')?.textContent==='Offline — ready',null,{timeout:120000});await page.locator('#offline_play').click();
  await page.waitForFunction(()=>globalThis.sdMovementPrototype&&document.getElementById('movement-traversal')&&sdWorld.my_entity&&sdRenderer.dark_tint<=0,null,{timeout:120000});
  await page.evaluate(()=>{
   sdWorld.HandleWorldLogic=()=>{};sdWorld.GSPEED=1;
   globalThis.crouchTest={
    place(x=-820,crouch=0,speed=0){const p=sdWorld.my_entity,m=sdMovementPrototype;p.x=x;p.y=-80;p.sx=speed;p.sy=0;p._crouch_intens=crouch;p.stands=true;p._stands_on=sdCombatSandbox.fixed.find(e=>e.y===-64&&e.x<=x&&e.x+e.width>x);p._key_states.Reset();p.act_x=p.act_y=0;p.stability=100;p.flying=false;p._in_air_timer=0;p._respawn_protection=0;m.attach(p);this.refresh();return p;},
    refresh(){const p=sdWorld.my_entity;p._hitbox_last_update=-Infinity;p.UpdateHitbox();sdWorld.UpdateHashPosition(p,false);},
    step(n,keys={}){const p=sdWorld.my_entity;p._key_states.Reset();for(const [k,v] of Object.entries(keys))p._key_states.SetKey(k,v,true);for(let i=0;i<n;i++){sdWorld.frame++;sdWorld.time+=1000/30;sdWorld.GSPEED=1;p.onThink(1);this.refresh();}return this.state();},
    state(){const p=sdWorld.my_entity;return {x:p.x,y:p.y,sx:p.sx,sy:p.sy,crouch:p._crouch_intens,clear:p.CanUnCrouch(),overlap:!p.CanMoveWithoutOverlap(p.x,p.y,0),ground:p.stands,slide:sdMovementPrototype.sliding(p),flying:p.flying,health:p.hea,box:[p._hitbox_y1,p._hitbox_y2]};},
    sample(x,crouch,keys,n=16){this.place(x,crouch);return this.step(n,keys);}
   };
  });
  const rows=await page.evaluate(()=>({standing:crouchTest.sample(-820,0,{KeyD:1}),held:crouchTest.sample(-660,1,{KeyD:1,KeyS:1}),released:crouchTest.sample(-660,1,{KeyD:1}),openRelease:crouchTest.sample(-820,1,{KeyD:1})}));
  assert(rows.held.crouch===1&&!rows.held.clear&&!rows.held.overlap&&rows.held.sx<rows.standing.sx*.6);assert(rows.openRelease.crouch===0&&rows.openRelease.clear);assert(!rows.released.clear&&rows.released.crouch===1&&!rows.released.overlap);
  if(baseline)assert(rows.released.sx>rows.held.sx*1.9);else assert(Math.abs(rows.released.sx-rows.held.sx)<.001);
  check(baseline?'Reproduced: release under ceiling doubles acceleration despite crouched collision box':'Effective constrained posture retains native crouch acceleration',rows);
  if(!baseline){
   const details=await page.evaluate(()=>{
    const t=crouchTest,p=sdWorld.my_entity,m=sdMovementPrototype;
    // Crouched corridor traversal into open floor, before the existing low obstacle.
    t.place(-660,1);let frames=0;while(p.x< -541&&frames++<90)t.step(1,{KeyD:1});const exit=t.state();
    t.place(-820,1);const open=t.step(12,{KeyD:1});
    // H uses its own momentum/friction law. Releasing S cannot change that law.
    const slideSample=hold=>{t.place(-695,1,6);t.step(1,{KeyH:1,...(hold?{KeyS:1}:{})});const a=t.state();const b=t.step(8,hold?{KeyS:1}:{});return {a,b};};
    const slideHeld=slideSample(true),slideReleased=slideSample(false);
    t.place(-558,1,6);t.step(1,{KeyH:1});t.step(22);const obstacle=t.state();
    t.place(-820,1);t.step(12);const jump=t.step(2,{Space:1});const flight=t.step(8,{KeyW:1});t.step(1);const release=t.state();
    let stable=true;for(let i=0;i<24;i++){t.place(i%2?-620:-820,1);t.step(2,i%3?{}:{KeyS:1});const s=t.state();stable=stable&&Number.isFinite(s.x)&&Number.isFinite(s.y)&&!s.overlap;}
    // Native characters without the optional movement adapter use the same fix.
    t.place(-820,0);const native=sdCombatSandbox.spawn('basic');native._ai_enabled=0;native._ai=null;native.x=-660;native.y=-80;native.sx=native.sy=0;native._crouch_intens=1;native.stands=true;native._stands_on=sdCombatSandbox.fixed.find(e=>e.y===-64&&e.x<=native.x&&e.x+e.width>native.x);native._key_states.Reset();native._key_states.SetKey('KeyD',1,true);native.stability=100;
    for(let i=0;i<16;i++){sdWorld.frame++;native.onThink(1);native._hitbox_last_update=-Infinity;native.UpdateHitbox();sdWorld.UpdateHashPosition(native,false);}
    const original={speed:native.sx,crouch:native._crouch_intens,clear:native.CanUnCrouch(),attached:m.has(native)};native.remove();
    return {exit,frames,open,slideHeld,slideReleased,obstacle,jump,flight,release,rapidTransitionsStable:stable,original};
   });
   r.transitions=details;console.log('Transition measurements',JSON.stringify(details));
   assert(details.exit.clear&&details.frames<90&&!details.exit.overlap);assert(details.open.crouch===0&&details.open.sx>4);assert(details.slideHeld.a.slide&&details.slideReleased.a.slide&&details.slideHeld.b.slide&&details.slideReleased.b.slide);assert(Math.abs(details.slideHeld.b.sx-details.slideReleased.b.sx)<.001);assert(details.slideReleased.b.sx>rows.held.sx);assert(!details.obstacle.slide&&!details.obstacle.overlap);assert(details.jump.sy<0&&details.flight.flying&&!details.release.flying);assert(details.rapidTransitionsStable);assert(!details.original.attached&&!details.original.clear&&details.original.crouch===1&&details.original.speed<3.3);
   check('Corridor exit, slide input independence, collision interruption, jump/jetpack, native actors and rapid transitions',details);
  }
  await page.evaluate(()=>{crouchTest.place(-625,1);crouchTest.step(8,{KeyD:1});sdWorld.camera.x=-620;sdWorld.camera.y=-85;sdWorld.camera.scale=sdWorld.target_scale=5;sdRenderer.Render(sdWorld.frame);});
  await page.screenshot({path:path.join(out,baseline?'crouch-before.png':'crouch-after.png')});assert.equal(r.errors.length,0);assert.equal(r.external.length,0);r.passed=true;
 }catch(e){r.failure=e.stack;throw e;}finally{fs.writeFileSync(path.join(out,baseline?'crouch-before.json':'crouch-validation.json'),JSON.stringify(r,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
