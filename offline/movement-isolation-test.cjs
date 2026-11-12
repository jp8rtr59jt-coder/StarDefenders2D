/* Verify that the movement module/input/geometry stay out of existing modes. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage(),result={passed:false,modes:[],errors:[],external:[]};
 page.on('pageerror',e=>result.errors.push(e.stack));
 page.on('dialog',d=>d.dismiss());
 await page.route('**/*',r=>{
  if(new URL(r.request().url()).hostname!=='127.0.0.1'){result.external.push(r.request().url());return r.abort();}
  return r.continue();
 });
 try {
  for(const mode of ['combat','original']){
   await page.goto('http://127.0.0.1:8000/'+(mode==='combat'?'?mode=combat':''));
   await page.waitForFunction(()=>document.getElementById('server_status')?.textContent==='Offline — ready',null,{timeout:120000});
   const state=await page.evaluate(()=>({
    prototype:typeof globalThis.sdMovementPrototype,movement:SD_MOVEMENT,
    storage:localforage.config().name,hRegistered:Object.hasOwn(sdWorld.my_key_states.key_states,'KeyH')
   }));
   assert.equal(state.prototype,'undefined');assert.equal(state.movement,false);assert.equal(state.hRegistered,false);
   assert.equal(state.storage,mode==='combat'?'sd-combat-experimental':'localforage');
   if(mode==='combat'){
    await page.locator('#offline_play').click();
    await page.waitForFunction(()=>sdWorld.my_entity?.hea>0,null,{timeout:120000});
    state.traversalBlocks=await page.evaluate(()=>sdCombatSandbox.fixed.filter(e=>e.y===-64&&e.x>=-896&&e.x< -352).length);
    assert.equal(state.traversalBlocks,0);
    assert.equal(await page.locator('#movement-traversal').count(),0);
   }
   result.modes.push({mode,...state});console.log('PASS mode isolation',mode,state);
  }
  assert.equal(result.errors.length,0);assert.equal(result.external.length,0);result.passed=true;
 }catch(e){result.failure=e.stack;throw e;}finally{
  fs.mkdirSync('docs/advanced-movement',{recursive:true});
  fs.writeFileSync('docs/advanced-movement/isolation-validation.json',JSON.stringify(result,null,2));await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
