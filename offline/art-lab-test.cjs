/* Chromium integration, real engine captures and bounded render measurements. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir='docs/art-direction-lab';fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
 const r={date:new Date().toISOString(),browser:browser.version(),passed:false,checks:[],errors:[],external:[],badResponses:[]},stateFrames=[];
 page.on('pageerror',e=>r.errors.push(e.stack));page.on('dialog',d=>d.dismiss());
 page.on('console',m=>{if(/Image could not be drawn|allocate.*fail/i.test(m.text()))r.errors.push(m.text());});
 page.on('response',p=>{if(p.status()>=400)r.badResponses.push({url:p.url(),status:p.status()});});
 await context.route('**/*',q=>{if(new URL(q.request().url()).hostname!=='127.0.0.1'){r.external.push(q.request().url());return q.abort();}return q.continue();});
 const ticks=async n=>{const f=await page.evaluate(()=>sdWorld.frame);await page.waitForFunction(f=>sdWorld.frame>=f,f+n,{timeout:120000});};
 const check=(name,data)=>{r.checks.push({name,data});console.log('PASS',name,JSON.stringify(data));};
 const physical=()=>page.evaluate(()=>[sdWorld.my_entity,...sdCombatSandbox.enemies].filter(e=>!e._is_being_removed).map(e=>({id:e._net_id,x:e.x,y:e.y,sx:e.sx,sy:e.sy,health:e.hea,box:[e.hitbox_x1,e.hitbox_x2,e.hitbox_y1,e.hitbox_y2],bones:e._ragdoll.bones.map(b=>[b.x,b.y,b.sx,b.sy]),springs:e._ragdoll.springs.map(s=>s.radius)})));
 const release=async()=>{for(const key of ['KeyD','KeyA','KeyH','KeyS','Space','KeyW','KeyR'])await page.keyboard.up(key);await page.mouse.up();};
 const freeze=()=>page.evaluate(()=>{if(!globalThis.labNativeLogic){globalThis.labNativeLogic=sdWorld.HandleWorldLogic;globalThis.labNativeGSPEED=sdWorld.GSPEED;sdWorld.HandleWorldLogic=()=>{};sdWorld.GSPEED=0;}});
 const resume=()=>page.evaluate(()=>{if(globalThis.labNativeLogic){sdWorld.HandleWorldLogic=labNativeLogic;sdWorld.GSPEED=labNativeGSPEED;delete globalThis.labNativeLogic;delete globalThis.labNativeGSPEED;}});
 const stage=async()=>{await release();await page.locator('#art-stage').click();await page.mouse.move(640,400);await page.evaluate(()=>{for(const e of sdCombatSandbox.enemies)e._ai_enabled=sdCharacter.AI_MODEL_NONE;});await ticks(12);};
 const stateFrame=async(mode,pose)=>{
  await freeze();const camera=await page.evaluate(()=>({x:sdWorld.camera.x,y:sdWorld.camera.y,scale:sdWorld.camera.scale,target:sdWorld.target_scale}));
  await page.evaluate(()=>{const p=sdWorld.my_entity;sdWorld.camera.x=p.x+4;sdWorld.camera.y=p.y-1;sdWorld.camera.scale=sdWorld.target_scale=6;sdRenderer.Render(sdWorld.frame);});
  stateFrames.push({mode,pose,buffer:await page.screenshot({clip:{x:440,y:220,width:400,height:400}})});
  await page.evaluate(c=>{sdWorld.camera.x=c.x;sdWorld.camera.y=c.y;sdWorld.camera.scale=c.scale;sdWorld.target_scale=c.target;},camera);await resume();
 };
 try{
  await page.goto('http://127.0.0.1:8000/?mode=combat&movement=1&art=1');
  await page.waitForFunction(()=>document.getElementById('server_status')?.textContent==='Offline — ready',null,{timeout:120000});
  await page.evaluate(async()=>{
   for(const name of ['localforage','sd-combat-experimental','sd-movement-experimental'])await localforage.createInstance({name}).setItem('temporary_file_system',{sentinel:name});
   localStorage.setItem('temporary_file_system','{"legacy":"preserved"}');
  });
  assert.equal(await page.evaluate(()=>localforage.config().name),'sd-art-direction-lab');
  await page.locator('#offline_play').click();await page.waitForFunction(()=>sdArtLab.stageCount>0,null,{timeout:120000});await stage();
  check('optional lab, separate storage, native stage, one enemy',await page.evaluate(()=>({storage:localforage.config().name,enemies:sdCombatSandbox.enemies.length,art:sdArtLab.assetStats,contract:sdArtLab.contract})));
  assert.equal(await page.evaluate(()=>sdCombatSandbox.enemies.length),1);
  assert.equal(await page.evaluate(()=>sdCombatSandbox.objects.filter(e=>e instanceof sdStorage&&e.x>=544&&!e._is_being_removed).length),2);
  // Freeze and align only the harness. The playable module never controls time,
  // camera scale, actor poses or physics from a drawing hook.
  await freeze();
  await page.evaluate(()=>{
   sdWorld.GSPEED=1;const p=sdWorld.my_entity,e=sdCombatSandbox.enemies[0];
   for(const [c,x,aim] of [[p,624,784],[e,748,624]]){
    c.x=x;c.y=144;c.sx=c.sy=0;c.look_x=aim;c.look_y=c===p?112:140;c._key_states.Reset();c.act_x=c.act_y=0;
    sdWorld.UpdateHashPosition(c,false);c._ragdoll._smooth_x=x;c._ragdoll._smooth_y=144;c._ragdoll._smooth_look_x=aim;c._ragdoll._smooth_look_y=c.look_y;
    for(let i=0;i<20;i++)c.onThink(1);
   }
   sdWorld.camera.x=736;sdWorld.camera.y=100;sdWorld.camera.scale=sdWorld.target_scale=3.2;
   const label=document.createElement('div');label.id='art-capture-label';label.style.cssText='position:fixed;left:14px;top:12px;background:#15202beb;color:#fff;padding:10px 15px;font:16px sans-serif;z-index:11000;pointer-events:none';document.body.append(label);
   // Fire the existing gun and advance its actual projectile into existing cover.
   const g=p._inventory[p.gun_slot];globalThis.captureAmmo=g.ammo_left;
   if(!g.Shoot(0,p.GetBulletSpawnOffset()))throw Error('Native capture shot rejected');
   const bullets=sdEntity.entities.filter(b=>b instanceof sdBullet&&b._owner===p);
   for(let i=0;i<12;i++)for(const b of bullets)if(!b._is_being_removed){b.UpdateHitbox();b.onThink(1);sdWorld.UpdateHashPosition(b,false);}
   globalThis.captureImpacts=sdEntity.entities.filter(e=>e instanceof sdEffect&&e._type===sdEffect.TYPE_WALL_HIT&&!e._is_being_removed).length;
   sdWorld.GSPEED=0;
   if(!captureImpacts)throw Error('No native impact in capture scene '+JSON.stringify({bullets:bullets.map(b=>({x:b.x,y:b.y,sx:b.sx,sy:b.sy,removed:b._is_being_removed})),effects:sdEntity.entities.filter(e=>e instanceof sdEffect).map(e=>e._type),error:sdRenderer.service_mesage}));
  });
  check('native shot and impact form identical combat comparison',await page.evaluate(()=>({impacts:captureImpacts,ammo:sdWorld.my_entity._inventory[1].ammo_left,before:captureAmmo})));
  const originalPhysical=await physical();
  const files={original:'00-original-gameplay.png',A:'01-a-gameplay.png',B:'02-b-gameplay.png',C:'03-c-gameplay.png'};
  const capture=async(mode,file,close=false)=>{
   await page.evaluate(({mode,close})=>{
    sdArtLab.setMode(mode);sdWorld.camera.x=close?sdWorld.my_entity.x+8:736;sdWorld.camera.y=close?sdWorld.my_entity.y-4:100;
    sdWorld.camera.scale=sdWorld.target_scale=close?12:3.2;
    document.getElementById('art-capture-label').textContent=sdArtLab.titles[mode]+' · '+(close?'character + native pistol':'same combat scene')+' · ENGINE CAPTURE · PROTOTYPE';
    for(let i=0;i<3;i++)sdRenderer.Render(sdWorld.frame);
   },{mode,close});
   const visible=await page.screenshot({path:dir+'/'+file});
   if(!close){
    for(const part of ['head','weapon']){
     await page.evaluate(part=>{globalThis.labSavedDraw=sdArtLab[part];sdArtLab[part]=()=>true;sdRenderer.Render(sdWorld.frame);},part);
     const hidden=await page.screenshot();
     await page.evaluate(part=>{sdArtLab[part]=labSavedDraw;delete globalThis.labSavedDraw;sdRenderer.Render(sdWorld.frame);},part);
     const changed=await page.evaluate(async({visible,hidden})=>{
      async function pixels(data){const i=new Image();i.src='data:image/png;base64,'+data;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);return ctx.getImageData(0,0,c.width,c.height).data;}
      const [a,b]=await Promise.all([pixels(visible),pixels(hidden)]);let n=0;for(let y=450;y<600;y++)for(let x=200;x<900;x++){const i=(y*1280+x)*4;if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])n++;}return n;
     },{visible:visible.toString('base64'),hidden:hidden.toString('base64')});
     assert(changed>10,mode+' '+part+' is occluded or missing');
     check(mode+' '+part+' produces visible framebuffer pixels',{changedPixels:changed});
    }
   }
   assert.deepEqual(await physical(),originalPhysical);
  };
  for(const mode of ['original','A','B','C']){await capture(mode,files[mode]);if(mode!=='original')await capture(mode,`0${{A:5,B:6,C:7}[mode]}-${mode.toLowerCase()}-closeup.png`,true);}
  check('four directions and three close-ups captured with identical physical state, bones, springs and hitboxes');
  r.parallax=await page.evaluate(()=>{
   sdArtLab.setMode('C');sdWorld.camera.scale=sdWorld.target_scale=3.2;sdWorld.camera.y=100;
   const paint=sdArtLab.paint,positions=[];
   sdArtLab.paint=function(ctx,image,x,...args){
    for(const name of ['background0','background1','foreground'])if(image===this.images[name])positions.push({camera:sdWorld.camera.x,name,x});
    return paint.call(this,ctx,image,x,...args);
   };
   for(const x of [736,776]){sdWorld.camera.x=x;sdRenderer.Render(sdWorld.frame);}
   sdArtLab.paint=paint;sdWorld.camera.x=736;
   return positions;
  });
  const movement=Object.fromEntries(['background0','background1','foreground'].map(name=>{const p=r.parallax.filter(x=>x.name===name);return [name,Math.abs(p[1].x-p[0].x-40)];}));
  assert(movement.background0<movement.background1&&movement.background1<movement.foreground);
  check('C submitted far, near and foreground motion preserves depth order',{cameraDelta:40,relativeWorldMovement:movement});
  // A contact sheet of the unmodified gameplay captures, not a painted mock-up.
  const sheet=await context.newPage();await sheet.setViewportSize({width:1280,height:864});
  await sheet.setContent('<style>body{margin:0;background:#101923;color:white;font:16px sans-serif}main{display:grid;grid-template-columns:1fr 1fr}figure{margin:0}figcaption{height:32px;box-sizing:border-box;padding:6px 12px}img{display:block;width:640px;height:400px}</style><main>'+Object.entries(files).map(([key,file])=>`<figure><figcaption>${key} · engine-capture contact sheet</figcaption><img src="data:image/png;base64,${fs.readFileSync(dir+'/'+file).toString('base64')}"></figure>`).join('')+'</main>');
  await sheet.locator('img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));await sheet.screenshot({path:dir+'/04-combat-comparison.png'});await sheet.close();
  r.performance=await page.evaluate(async()=>{
   sdWorld.camera.x=736;sdWorld.camera.y=100;sdWorld.camera.scale=sdWorld.target_scale=3.2;
   const gl=sdRenderer.ctx.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
   const ext2=gl.getExtension('EXT_disjoint_timer_query_webgl2'),ext1=ext2?null:gl.getExtension('EXT_disjoint_timer_query');
   const samples={original:[],A:[],B:[],C:[]};
   for(let round=0;round<15;round++)for(let offset=0;offset<4;offset++){
    const mode=['original','A','B','C'][(round+offset)%4];sdArtLab.setMode(mode);gl.finish();
    const q=ext2?gl.createQuery():ext1?ext1.createQueryEXT():null;
    if(ext2)gl.beginQuery(ext2.TIME_ELAPSED_EXT,q);else if(ext1)ext1.beginQueryEXT(ext1.TIME_ELAPSED_EXT,q);
    const t=performance.now();sdRenderer.Render(sdWorld.frame);const submitted=performance.now();
    if(ext2)gl.endQuery(ext2.TIME_ELAPSED_EXT);else if(ext1)ext1.endQueryEXT(ext1.TIME_ELAPSED_EXT);
    gl.finish();const completed=performance.now();
    let gpuMs=null;
    if(q){
     await new Promise(requestAnimationFrame);
     if(!gl.getParameter((ext2||ext1).GPU_DISJOINT_EXT)){
      if(ext2&&gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))gpuMs=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;
      if(ext1&&ext1.getQueryObjectEXT(q,ext1.QUERY_RESULT_AVAILABLE_EXT))gpuMs=ext1.getQueryObjectEXT(q,ext1.QUERY_RESULT_EXT)/1e6;
     }
     if(ext2)gl.deleteQuery(q);else ext1.deleteQueryEXT(q);
    }
    if(round>=3)samples[mode].push({cpuSubmitMs:submitted-t,blockingCompletionMs:completed-t,gpuMs,calls:sdRenderer.ctx.renderer.info.render.calls});
   }
   return {renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),glVersion:gl.getParameter(gl.VERSION),gpuTimerExtension:!!(ext2||ext1),samples,
    scope:'12 samples/mode after 3 warmups, rotating order, frozen identical normal scene. CPU time around Render; blocking completion includes CPU/driver and gl.finish wait. GPU-only values require non-disjoint timer-query results. No FPS/input-latency or macOS hardware claim.'};
  });
  check('repeatable CPU submission and completion measurements recorded');
  await page.evaluate(()=>document.getElementById('art-capture-label').remove());await resume();
  for(const mode of ['A','B','C']){
   await stage();await page.selectOption('#art-direction',mode);await page.mouse.move(640,400);
   const x=await page.evaluate(()=>sdWorld.my_entity.x);await page.keyboard.down('KeyD');await ticks(6);
   assert(await page.evaluate(x=>sdWorld.my_entity.x>x,x));await page.keyboard.down('KeyH');await ticks(1);
   const slide=await page.evaluate(()=>({active:sdMovementPrototype.sliding(sdWorld.my_entity),crouch:sdWorld.my_entity._crouch_intens,box:[sdWorld.my_entity.hitbox_x1,sdWorld.my_entity.hitbox_x2,sdWorld.my_entity.hitbox_y1,sdWorld.my_entity.hitbox_y2]}));
   assert(slide.active&&slide.crouch===1);assert.deepEqual(slide.box,[-5,5,-6,16]);
   await stateFrame(mode,'slide');
   await page.keyboard.up('KeyD');await page.keyboard.up('KeyH');
   const ammo=await page.evaluate(()=>sdWorld.my_entity._inventory[1].ammo_left);await page.mouse.move(850,420);await page.mouse.down();await ticks(3);await page.mouse.up();
   assert(await page.evaluate(a=>sdWorld.my_entity._inventory[1].ammo_left<a,ammo));
   await page.keyboard.down('KeyR');await ticks(2);await page.keyboard.up('KeyR');
   await page.waitForFunction(()=>sdWorld.my_entity._inventory[1].ammo_left===12,null,{timeout:120000});
   await page.keyboard.down('KeyS');await ticks(8);assert(await page.evaluate(()=>sdWorld.my_entity._crouch_intens>.5));await stateFrame(mode,'crouch');await page.keyboard.up('KeyS');
   await stage();await page.keyboard.down('Space');await ticks(3);assert(await page.evaluate(()=>sdWorld.my_entity.sy<0));
   await page.waitForFunction(()=>sdWorld.my_entity.flying,null,{timeout:120000});await page.keyboard.up('Space');
   const before=await page.evaluate(()=>sdWorld.my_entity._ragdoll.bones.map(b=>[b.x,b.y]));
   await page.evaluate(()=>{const p=sdWorld.my_entity;p.DamageWithEffect(p.hea+1);});await ticks(8);
   const corpse=await page.evaluate(()=>{const p=sdWorld.my_entity;return {health:p.hea,death:p.death_anim,active:sdMovementPrototype.sliding(p),bones:p._ragdoll.bones.map(b=>[b.x,b.y])};});
   assert(corpse.health<=0&&corpse.death>0&&!corpse.active);assert(corpse.bones.flat().every(Number.isFinite));assert.notDeepEqual(corpse.bones,before);
   await stateFrame(mode,'ragdoll');
   check(mode+' live run, slide, crouch, firing/reload, jump/jetpack and simulated ragdoll',{slide,death:corpse.death,bones:corpse.bones.length});
  }
  const states=await context.newPage();await states.setViewportSize({width:1200,height:1296});
  await states.setContent('<style>body{margin:0;background:#101923;color:white;font:14px sans-serif}main{display:grid;grid-template-columns:repeat(3,400px)}figure{margin:0}figcaption{height:32px;box-sizing:border-box;padding:6px}img{display:block;width:400px;height:400px}</style><main>'+stateFrames.map(s=>`<figure><figcaption>${s.mode} · ${s.pose} · actual engine crop · prototype</figcaption><img src="data:image/png;base64,${s.buffer.toString('base64')}"></figure>`).join('')+'</main>');
  await states.locator('img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));await states.screenshot({path:dir+'/08-animation-compatibility.png'});await states.close();
  await stage();await stage();check('repeated comparison resets retain a single fresh enemy',await page.evaluate(()=>({count:sdArtLab.stageCount,enemies:sdCombatSandbox.enemies.length,health:sdWorld.my_entity.hea})));
  assert.equal(await page.evaluate(()=>sdCombatSandbox.enemies.length),1);
  assert(!/logic error/i.test(await page.evaluate(()=>sdRenderer.service_mesage||'')));
  await page.evaluate(()=>sdWorld.Stop());
  const storage=await page.evaluate(async()=>({names:await Promise.all(['localforage','sd-combat-experimental','sd-movement-experimental'].map(async name=>({name,value:await localforage.createInstance({name}).getItem('temporary_file_system')}))),legacy:localStorage.getItem('temporary_file_system')}));
  for(const s of storage.names)assert.deepEqual(s.value,{sentinel:s.name});assert.equal(storage.legacy,'{"legacy":"preserved"}');check('all existing world namespaces and legacy saves preserved',storage);
  for(const query of ['?mode=combat','?mode=combat&movement=1','']){
   await page.goto('http://127.0.0.1:8000/'+query);await page.waitForFunction(()=>document.getElementById('server_status')?.textContent==='Offline — ready',null,{timeout:120000});
   assert.equal(await page.evaluate(()=>typeof globalThis.sdArtLab),'undefined');
  }
  check('original, combat and movement modes omit all art-lab assets and adapters');
  assert.equal(r.errors.length,0);assert.equal(r.external.length,0);assert(r.badResponses.every(x=>x.url.endsWith('/audio/rocket_loop.wav')),JSON.stringify(r.badResponses));
  r.passed=true;
 }catch(e){r.failure=e.stack;throw e;}finally{fs.writeFileSync(dir+'/validation.json',JSON.stringify(r,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
