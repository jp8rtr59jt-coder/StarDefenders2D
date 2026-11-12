/* Regression for enabling an already-dormant native test soldier. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage(),r={passed:false,checks:[],errors:[]};
 page.on('pageerror',e=>r.errors.push(e.stack));page.on('dialog',d=>d.dismiss());
 const base=process.env.CONTROL_TEST_URL||'http://127.0.0.1:8000/';
 const output=process.env.CONTROL_TEST_OUTPUT||'docs/art-direction-lab/control-validation.json';
 try{
  await page.goto(base+'?mode=combat');
  await page.waitForFunction(()=>document.getElementById('server_status')?.textContent==='Offline — ready',null,{timeout:120000});
  await page.locator('#offline_play').click();await page.waitForFunction(()=>sdWorld.my_entity?.hea>0,null,{timeout:120000});
  await page.locator('#combat-hostility').click();
  await page.evaluate(()=>{globalThis.controlSoldier=sdCombatSandbox.spawn('basic');const p=sdWorld.my_entity;p.x=112;p.y=144;p.sx=p.sy=0;sdWorld.UpdateHashPosition(p,false);});
  await page.waitForFunction(()=>controlSoldier._hiberstate===sdEntity.HIBERSTATE_HIBERNATED,null,{timeout:120000});
  r.before=await page.evaluate(()=>({hiber:controlSoldier._hiberstate,model:controlSoldier._ai_enabled,time:sdWorld.server_config.humanoid_ai.state(controlSoldier).time}));
  await page.locator('#combat-hostility').click();
  r.afterToggle=await page.evaluate(()=>({hiber:controlSoldier._hiberstate,model:controlSoldier._ai_enabled,time:sdWorld.server_config.humanoid_ai.state(controlSoldier).time}));
  assert.equal(r.afterToggle.hiber,0,'Hostility on must wake a dormant soldier');
  await page.waitForFunction(()=>sdWorld.server_config.humanoid_ai.state(controlSoldier).time>0,null,{timeout:120000});
  await page.waitForFunction(()=>sdWorld.my_entity.hea<250,null,{timeout:120000});
  r.engagement=await page.evaluate(()=>({health:sdWorld.my_entity.hea,phase:sdWorld.server_config.humanoid_ai.state(controlSoldier).phase,aiTime:sdWorld.server_config.humanoid_ai.state(controlSoldier).time}));
  r.checks.push('Previously dormant soldier wakes, runs original AI and inflicts native damage');
  assert.equal(r.errors.length,0);r.passed=true;console.log(JSON.stringify(r,null,2));
 }catch(e){r.failure=e.stack;throw e;}finally{
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(r,null,2));await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
