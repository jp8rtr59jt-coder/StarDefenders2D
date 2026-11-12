const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const dir='docs/visual-experiments';fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1200,height:800}});
 const result={passed:false,errors:[],external:[],checks:[]};
 page.on('pageerror',e=>{result.errors.push(e.stack);console.log('ERROR',e.stack);});
 page.on('console',m=>{if(m.text().includes('Image could not be drawn'))result.errors.push(m.text());});
 await page.route('**/*',r=>{if(new URL(r.request().url()).hostname!=='127.0.0.1'){result.external.push(r.request().url());return r.abort();}return r.continue();});
 const ticks=async n=>{const f=await page.evaluate(()=>sdWorld.frame);await page.waitForFunction(t=>sdWorld.frame>=t,f+n,{timeout:120000});};
 try{
  await page.goto('http://127.0.0.1:8000/?mode=combat&visual=1');
  await page.waitForFunction(()=>document.getElementById('offline_play')?.textContent==='Start combat sandbox',null,{timeout:120000});
  await page.locator('#offline_play').click();await page.waitForFunction(()=>sdWorld.my_entity?.hea>0,null,{timeout:120000});await ticks(20);
  await page.evaluate(()=>{
   const p=sdWorld.my_entity;p.look_x=p.x+120;p.look_y=p.y-2;sdCombatSandbox.equip(p,'pistol');
   const label=document.createElement('div');label.id='comparison-label';label.style.cssText='position:fixed;top:12px;left:50%;transform:translateX(-50%);background:#101820e8;padding:10px 18px;color:white;font:16px sans-serif;z-index:11000;pointer-events:none';document.body.append(label);
  });await ticks(12);
  // Freeze only capture time so both variants use identical physics/pose/camera.
  await page.evaluate(()=>{globalThis.realDateNow=Date.now;const frozen=Date.now();Date.now=()=>frozen;sdWorld.camera.x=-540;sdWorld.camera.y=92;sdWorld.camera.scale=4;sdWorld.target_scale=4;
   const p=sdWorld.my_entity;p.look_x=p.x+120;p.look_y=p.y-2;p._ragdoll._smooth_look_x=p.look_x;p._ragdoll._smooth_look_y=p.look_y;
   sdWorld.mouse_screen_x=(p.look_x-sdWorld.camera.x)*4+sdRenderer.screen_width/2;sdWorld.mouse_screen_y=(p.look_y-sdWorld.camera.y)*4+sdRenderer.screen_height/2;
  });await ticks(2);
  const capture=async(on,name,label,zoom=4)=>{
   await page.evaluate(({on,label,zoom})=>{sdVisualPreview.enabled=on;sdWorld.camera.x=zoom>4?sdWorld.my_entity.x:-540;sdWorld.camera.y=zoom>4?sdWorld.my_entity.y-5:92;sdWorld.camera.scale=zoom;sdWorld.target_scale=zoom;
    sdWorld.mouse_screen_x=(sdWorld.my_entity.x+120-sdWorld.camera.x)*zoom+sdRenderer.screen_width/2;sdWorld.mouse_screen_y=(sdWorld.my_entity.y-2-sdWorld.camera.y)*zoom+sdRenderer.screen_height/2;
    document.getElementById('comparison-label').textContent=label;},{on,label,zoom});
   await ticks(2);await page.screenshot({path:dir+'/'+name});
  };
  const physical=()=>page.evaluate(()=>{const p=sdWorld.my_entity;return {x:p.x,y:p.y,health:p.hea,hitbox:[p.hitbox_x1,p.hitbox_x2,p.hitbox_y1,p.hitbox_y2],bones:p._ragdoll.bones.map(b=>[b.x,b.y,b.sx,b.sy])};});
  await capture(false,'01-original.png','Original presentation · same scene and camera');const before=await physical();
  await capture(true,'02-prototype.png','Experimental procedural artwork · NOT FINAL ASSETS');const after=await physical();
  assert.deepEqual(after,before);result.checks.push('Identical physical state, hitbox and bone positions across toggle');
  await capture(true,'03-character-closeup.png','Character + existing pistol · PROTOTYPE',10);
  // Same paused scene, interleaved measured CPU submission + render-call time.
  result.performance=await page.evaluate(()=>{
   const samples={original:[],prototype:[]};
   for(let round=0;round<6;round++)for(const on of [false,true]){
    sdVisualPreview.enabled=on;const t=performance.now();sdRenderer.Render(sdWorld.frame);const elapsed=performance.now()-t;
    if(round>0)samples[on?'prototype':'original'].push(elapsed);
   }
   const gl=sdRenderer.ctx.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
   return {samplesMs:samples,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),scope:'CPU time around Render; excludes asynchronous GPU completion; frozen scene, warm cache, close-up'};
  });
  await page.evaluate(()=>{Date.now=realDateNow;sdWorld.camera.scale=sdWorld.target_scale=3;document.getElementById('comparison-label').remove();sdVisualPreview.enabled=true;});
  await ticks(12);
  const x=await page.evaluate(()=>sdWorld.my_entity.x);await page.keyboard.down('KeyD');await ticks(8);await page.keyboard.up('KeyD');
  assert(await page.evaluate(x=>sdWorld.my_entity.x>x,x));
  await page.keyboard.down('Space');await ticks(3);await page.keyboard.up('Space');assert(await page.evaluate(()=>sdWorld.my_entity.sy<0));
  result.checks.push('Movement and jump with prototype enabled');
  await page.locator('#combat-pistol').click();await ticks(12);
  const ammo=await page.evaluate(()=>sdWorld.my_entity._inventory[1].ammo_left);
  await page.mouse.move(850,250);await page.mouse.down();await ticks(5);await page.mouse.up();
  assert(await page.evaluate(a=>sdWorld.my_entity._inventory[1].ammo_left<a,ammo));
  await page.keyboard.down('KeyR');await ticks(2);await page.keyboard.up('KeyR');await ticks(30);
  assert.equal(await page.evaluate(()=>sdWorld.my_entity._inventory[1].ammo_left),12);result.checks.push('Native pistol firing, muzzle timer and reload');
  await page.evaluate(()=>{const p=sdWorld.my_entity;p.DamageWithEffect(p.hea+1);});await ticks(8);
  assert(await page.evaluate(()=>sdWorld.my_entity.hea<=0&&!!sdWorld.my_entity._ragdoll));result.checks.push('Existing death and ragdoll with prototype part drawing');
  await page.locator('#combat-respawn').click();await ticks(5);assert(await page.evaluate(()=>sdWorld.my_entity.hea===250));
  assert(!/logic error/i.test(await page.evaluate(()=>sdRenderer.service_mesage||'')));
  assert.equal(result.errors.length,0);assert.equal(result.external.length,0);
  result.passed=true;console.log(JSON.stringify(result,null,2));
 }catch(e){result.failure=e.stack;throw e;}
 finally{fs.writeFileSync(dir+'/validation.json',JSON.stringify(result,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
