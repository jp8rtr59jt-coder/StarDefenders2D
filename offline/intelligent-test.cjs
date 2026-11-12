const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:960,height:640}});
 const result={passed:false,errors:[],external:[],checks:[]};
 page.on('pageerror',e=>result.errors.push(e.stack));
 await page.route('**/*',r=>{if(new URL(r.request().url()).hostname!=='127.0.0.1'){result.external.push(r.request().url());return r.abort();}return r.continue();});
 try {
  await page.goto('http://127.0.0.1:8000/?mode=combat');
  await page.waitForFunction(()=>document.getElementById('offline_play')?.textContent==='Start combat sandbox',null,{timeout:120000});
  await page.locator('#offline_play').click();
  await page.waitForFunction(()=>sdWorld.my_entity?.hea>0,null,{timeout:120000});
  const measurements=await page.evaluate(()=>{
   const a=sdCombatSandbox,policy=sdWorld.server_config.humanoid_ai,p=sdWorld.my_entity;
   const report=[];
   const ensure=(v,m)=>{if(!v)throw Error(m);};
   p.x=-640;p.y=144;p.sx=p.sy=0;p.hmax=p.hea=100000;sdWorld.UpdateHashPosition(p,false);
   for(const tier of ['basic','intermediate','advanced']) {
    const e=a.spawn(tier);e.x=-800;e.y=144;e.sx=e.sy=0;e.look_x=-640;e.look_y=140;e._ai={target:p};
    sdWorld.UpdateHashPosition(e,false);policy.attach(e,tier);
    const s=policy.state(e),c=s.cfg;
    policy.before(e,1);const detected=s.time;
    ensure(s.phase==='aware','No initial awareness '+tier);
    let firstFire=null;
    for(let step=0;step<60;step++) {
     policy.aim(e,1);e._key_states.SetKey('Mouse1',1);policy.finish(e,1);
     if(e._key_states.GetKey('Mouse1')){firstFire=s.time-detected;break;}
     policy.before(e,1);
    }
    ensure(firstFire!==null&&firstFire>=s.reaction,'Reaction gate failed '+tier+JSON.stringify({firstFire,time:s.time,phase:s.phase,reaction:s.reaction,visible:s.visible,angle:s.angle,aimX:e.look_x,known:s.x}));
    ensure(s.reaction>=c.reactionMin&&s.reaction<=c.reactionMax,'Reaction range '+tier);
    // Angle slew is bounded in simulated time, independent of wall-clock FPS.
    s.angle=Math.PI;policy.aim(e,1);const turn=Math.abs(s.angle-Math.PI)*180/Math.PI;
    ensure(turn<=c.turn/30+0.001,'Unbounded turn '+tier);
    s.track=0;s.heat=0;s.targetSpeed=0;policy.aim(e,1);const initial=s.error;
    s.track=c.settle+1;policy.aim(e,1);const settled=s.error;
    e.sx=5;policy.aim(e,1);const moving=s.error;e.sx=0;
    s.targetSpeed=6;policy.aim(e,1);const fastTarget=s.error;s.targetSpeed=0;
    // Exercise effort accumulation using the same trigger/reload inputs as native combat.
    for(let i=0;i<30;i++){s.previousFire=true;policy.before(e,1);}
    s.track=c.settle+1;s.targetSpeed=0;policy.aim(e,1);const continuous=s.error;
    ensure(initial>settled&&moving>settled&&fastTarget>settled&&continuous>settled,'Aim penalties '+tier);
    const walls=[];for(let y=64;y<160;y+=32)walls.push(a.block(-736,y,32,32));
    policy.before(e,3);policy.aim(e,3);e._key_states.SetKey('Mouse1',1);policy.finish(e,3);
    ensure(s.phase==='searching'&&!e._key_states.GetKey('Mouse1'),'LOS did not stop firing '+tier);
    const known=[s.x,s.y];p.x=-600;p.y=144;p.sx=8;sdWorld.UpdateHashPosition(p,false);
    for(let i=0;i<8;i++) {policy.before(e,1);policy.aim(e,1);policy.finish(e,1);}
    ensure(s.x===known[0]&&s.y===known[1]&&e._ai.target===null,'Hidden coordinates leaked '+tier);
    for(let i=0;i<65;i++)policy.before(e,1);
    ensure(s.target===null&&s.phase==='idle','Memory did not expire '+tier);
    for(const w of walls){w.x=900;w.y=-240;sdWorld.UpdateHashPosition(w,false);a.remove(w);}
    policy.before(e,3); // Actor may reacquire only through the native ray search.
    e._ai.target=p;policy.before(e,3);
    if(s.visible)ensure(s.phase==='aware','Reacquisition skipped reaction');
    policy.reset(e);ensure(policy.state(e).target===null&&policy.state(e).heat===0,'Stale reset');
    report.push({tier,health:e.hmax,reactionMs:s.reaction,firstAllowedFireMs:firstFire,turnDegreesPerTick:turn,initialError:initial,settledError:settled,movingError:moving,fastTargetError:fastTarget,sustainedError:continuous,memoryMs:c.memory,hiddenPoint:known});
    a.remove(e);p.x=-640;p.sx=0;sdWorld.UpdateHashPosition(p,false);
   }
   return report;
  });
  assert(measurements[0].settledError>measurements[1].settledError&&measurements[1].settledError>measurements[2].settledError);
  assert(measurements[0].reactionMs>measurements[2].reactionMs);
  result.checks=measurements;
  // Native onThink/AILogic, weapons and damage still run in real browser frames.
  // Hide only the WebGL canvas during this timing test to avoid software-GPU stalls.
  await page.evaluate(()=>{sdRenderer.canvas.style.display='none';});
  result.engagements=[];
  for(const tier of ['basic','intermediate','advanced']) {
   await page.evaluate(tier=>{
    sdCombatSandbox.reset();sdCombatSandbox.hostile=true;
    const p=sdWorld.my_entity;p.x=112;p.y=144;p.sx=p.sy=0;p.hmax=p.hea=100000;
    sdWorld.UpdateHashPosition(p,false);
    globalThis.liveEnemy=sdCombatSandbox.spawn(tier);
   },tier);
   await page.waitForFunction(()=>sdWorld.my_entity.hea<100000,null,{timeout:120000});
   const observation=await page.evaluate(()=>{const e=liveEnemy,s=sdWorld.server_config.humanoid_ai.state(e);return {health:sdWorld.my_entity.hea,enemyHealth:e.hmax,state:s.phase,reaction:s.reaction,time:s.time,error:s.error};});
   result.engagements.push({tier,...observation});
  }
  await page.locator('#combat-hostility').click();await page.locator('#combat-hostility').click();
  await page.locator('#combat-reset').click();
  await page.locator('#combat-advanced').click();
  await page.locator('button',{hasText:'AI diagnostics'}).click();
  await page.waitForTimeout(500);
  assert.equal(result.errors.length,0);assert.equal(result.external.length,0);
  result.passed=true;console.log(JSON.stringify(result,null,2));
 }catch(e){result.failure=e.stack;throw e;}
 finally{fs.writeFileSync('offline/test-output/intelligent-results.json',JSON.stringify(result,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
