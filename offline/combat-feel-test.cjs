/* Focused 3E integration and comparison, using native guns/contacts/rig/geometry. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const baseline=process.env.FEEL_BASELINE==='1',dir=process.env.FEEL_OUTPUT||'docs/combat-feel-refinement';fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});const context=await b.newContext({viewport:{width:1200,height:800}}),page=await context.newPage(),r={baseline,date:new Date().toISOString(),browser:b.version(),passed:false,checks:[],errors:[],external:[],badResponses:[]};
 page.on('pageerror',e=>r.errors.push(e.stack));page.on('dialog',d=>d.dismiss());page.on('response',q=>{if(q.status()>=400)r.badResponses.push(q.url());});await context.route('**/*',q=>{if(new URL(q.request().url()).hostname!=='127.0.0.1'){r.external.push(q.request().url());return q.abort();}return q.continue();});
 const check=(name,data)=>{r.checks.push({name,data});console.log('PASS',name,JSON.stringify(data));};
 try{
  await page.goto((process.env.FEEL_BASE_URL||'http://127.0.0.1:8000/')+'?mode=combat&movement=1&art=1&physical=1');await page.waitForFunction(()=>document.getElementById('server_status')?.textContent==='Offline — ready',null,{timeout:120000});await page.locator('#offline_play').click();await page.waitForFunction(()=>globalThis.sdPhysicalCombat?.targets.length>0&&sdRenderer.dark_tint<=0,null,{timeout:120000});
  await page.evaluate(()=>{
   sdWorld.HandleWorldLogic=()=>{};sdWorld.GSPEED=1;
   const l=sdPhysicalCombat,a=sdCombatSandbox;
   globalThis.feel={
    fresh(hp=l.tuning.health,profile='unarmored',tier='intermediate'){
     l.tuning.health=hp;l.tier=tier;const e=l.encounter(profile),p=sdWorld.my_entity;
     for(const c of [p,e]){c._respawn_protection=0;c._weapon_draw_timer=0;c._key_states.Reset();c._crouch_intens=0;c._hitbox_last_update=-Infinity;c.UpdateHitbox();sdWorld.UpdateHashPosition(c,false);const r=c._ragdoll;r._smooth_x=c.x;r._smooth_y=c.y;r._smooth_look_x=c.look_x;r._smooth_look_y=c.look_y;for(let i=0;i<16;i++){r.AliveUpdate();r.Think(1);}}
     this.e=e;return e;
    },
    fire(kind='pistol',dy=3){
     const e=this.e,p=sdWorld.my_entity,g=a.equip(p,kind);p.look_x=e.x;p.look_y=e.y+dy;p.sx=p.sy=0;p._recoil=0;p._weapon_draw_timer=0;p.reload_anim=0;const r=p._ragdoll;r._smooth_look_x=p.look_x;r._smooth_look_y=p.look_y;for(let i=0;i<14;i++){r.AliveUpdate();r.Think(1);}g.reload_time_left=0;g.ammo_left=30;
     const start=sdEntity.entities.length,random=Math.random;Math.random=()=>.5;try{if(!g.Shoot(0,p.GetBulletSpawnOffset()))throw Error('Native Shoot rejected');}finally{Math.random=random;}
     const bullets=sdEntity.entities.slice(start).filter(b=>b instanceof sdBullet&&b._owner===p),old=e.hea;
     for(const b of bullets)for(let i=0;i<20&&!b._is_being_removed;i++){b.UpdateHitbox();b.onThink(1);sdWorld.UpdateHashPosition(b,false);}
     if(e.hea===old)throw Error('Native shot missed');return {...l.state(e).last};
    },
    step(n,render=false){const e=this.e;let maxDistance=0,maxSpeed=0;for(let i=0;i<n;i++){
     sdWorld.time+=1000/30;sdWorld.frame++;sdWorld.GSPEED=1;
     // Drawing updates the native articulated pose targets; no pose solver is mocked.
     const ctx=document.createElement('canvas').getContext('2d');ctx.drawImage=ctx.drawImageFilterCache=()=>{};e._ragdoll.DrawRagdoll(ctx,false);
     e.onThink(1);sdWorld.UpdateHashPosition(e,false);
     for(const fx of [...l.particles,...l.marks])if(!fx._is_being_removed){fx.onThink(1);if(!fx._is_being_removed)sdWorld.UpdateHashPosition(fx,false);}
     for(const fx of sdEntity.entities.slice())if(fx instanceof sdEffect&&fx._is_being_removed){fx._remove();sdEntity.RemoveEntityFromEntitiesArray(fx);}
     for(const bone of e._ragdoll.bones){maxDistance=Math.max(maxDistance,Math.hypot(bone.x-e.x,bone.y-e.y));maxSpeed=Math.max(maxSpeed,Math.hypot(bone.sx,bone.sy));}
     if(render)sdRenderer.Render(sdWorld.frame);
    }return {health:e.hea,time:l.state(e).time,phase:l.state(e).phase,motion:l.state(e).motionCount||0,maxDistance,maxSpeed};},
    captureScene(){sdWorld.camera.x=624;sdWorld.camera.y=125;sdWorld.camera.scale=sdWorld.target_scale=4;sdWorld.GSPEED=0;sdRenderer.Render(sdWorld.frame);sdWorld.GSPEED=1;}
   };
  });
  const defaultHP=await page.evaluate(()=>sdPhysicalCombat.tuning.health);if(!baseline)assert.equal(defaultHP,90);check('provisional default',defaultHP);
  r.durability=await page.evaluate(()=>{const f=feel,l=sdPhysicalCombat,chance=l.tuning.criticalChance,rows=[];l.tuning.criticalChance=0;try{for(const hp of [80,90,100])for(const tier of ['basic','intermediate','advanced']){const e=f.fresh(hp,'unarmored',tier);let torso=0;while(e.hea>0&&torso<10){f.fire();torso++;}f.fresh(hp,'heavy',tier);let head=0;while(f.e.hea>0&&head<4){f.fire('pistol',-7);head++;}rows.push({hp,tier,torso,head});}return rows;}finally{l.tuning.criticalChance=chance;}});
  assert(r.durability.every(x=>x.torso===Math.ceil(x.hp/18)));if(!baseline)assert(r.durability.every(x=>x.head===1));check('80/90/100 HP: real torso and unprotected head shot counts',r.durability);
  r.armor=await page.evaluate(()=>{const rows=[];for(const profile of ['unarmored','light','heavy'])for(const gun of ['pistol','rifle','railgun']){feel.fresh(90,profile);rows.push({profile,gun,...feel.fire(gun)});}return rows;});check('armor damage remains independent of biological health',r.armor);
  const critical=await page.evaluate(hp=>{const f=feel,l=sdPhysicalCombat,e=f.fresh(hp),s=l.state(e);s.seed=1;s.fxSeed=12345;s.motionSeed=41;
   for(let x=624;x<720;x+=32)for(let y=112;y<176;y+=32){const bg=sdCombatSandbox.add(new sdBG({x,y,width:32,height:32}));bg._hitbox_last_update=-Infinity;bg.UpdateHitbox();sdWorld.UpdateHashPosition(bg,false);}
   const hit=f.fire('rifle',12);if(s.phase!=='critical')throw Error('Seeded leg injury did not become critical');
   const emit=l.effect;globalThis.feelEmit=emit;globalThis.emitted=0;l.effect=function(v){const e=emit.call(this,v);if(e&&!e._is_being_removed&&(v.type===sdEffect.TYPE_BLOOD_DROP||v.type===sdEffect.TYPE_BLOOD_DROP_GREEN))emitted++;return e;};
   return {hit,deadline:s.deadline,health:e.hea};},defaultHP);r.critical=critical;
  const capture=async(name,label)=>{await page.evaluate(label=>{let el=document.getElementById('feel-label');if(!el){el=document.createElement('div');el.id='feel-label';el.style.cssText='position:fixed;top:10px;left:10px;padding:8px;background:#182532;color:white;font:16px sans-serif;z-index:20000';document.body.append(el);}el.textContent=label+' · ACTUAL ENGINE CAPTURE · prototype';feel.captureScene();},label);await page.screenshot({path:dir+'/'+(baseline?'before-':'after-')+name+'.png'});};
  const samples=[];for(const [ticks,name] of [[30,'critical-1s'],[60,'critical-3s'],[90,'critical-6s']]){samples.push(await page.evaluate(n=>feel.step(n),ticks));await capture(name,(baseline?'3D · 60 HP':'3E · 90 HP')+' · '+name+' · native background fixture');}
  const end=await page.evaluate(()=>{const f=feel,l=sdPhysicalCombat,s=l.state(f.e),events=[];let old=s.motionCount||0;let steps=0,maxDistance=0,maxSpeed=0;while(f.e.hea>0&&steps++<600){const v=f.step(1);maxDistance=Math.max(maxDistance,v.maxDistance);maxSpeed=Math.max(maxSpeed,v.maxSpeed);if((s.motionCount||0)!==old){events.push({...s.lastMotion});old=s.motionCount;}}
   const atDeath=s.time,motion=s.motionCount||0;f.step(90);l.effect=feelEmit;return {atDeath,health:f.e.hea,phase:s.phase,motion,events,maxDistance,maxSpeed,emitted,marks:l.marks.filter(x=>!x._is_being_removed).length,afterDeathMotion:(s.motionCount||0)-motion,finite:f.e._ragdoll.bones.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y))};});
  assert(end.health<=0&&end.finite&&end.atDeath<=critical.deadline+34);if(!baseline){assert(end.motion>0&&end.motion<=5&&end.afterDeathMotion===0&&end.marks>0);assert(end.maxDistance<64&&samples.every(x=>x.maxDistance<64));}check('critical presentation, supported blood marks and finite death',{samples,end});
  if(!baseline){
   r.motion=await page.evaluate(()=>{const l=sdPhysicalCombat,f=feel,rows=[];for(const [value,motionSeed] of [[0,41],[1,41],[2,41],[1,777]]){const e=f.fresh(90),s=l.state(e);s.seed=1;s.motionSeed=motionSeed;l.tuning.motionIntensity=value;f.fire('rifle',12);const events=[];let last=0,maxDistance=0;for(let i=0;i<500&&e.hea>0;i++){const v=f.step(1);maxDistance=Math.max(maxDistance,v.maxDistance);if(s.motionCount!==last){events.push({...s.lastMotion});last=s.motionCount;}}rows.push({intensity:value,motionSeed,count:s.motionCount,events,maxDistance,phase:s.phase});}l.tuning.motionIntensity=1;return rows;});
   assert.equal(r.motion[0].count,0);for(const row of r.motion.slice(1)){assert(row.count>1&&row.count<=5&&row.maxDistance<64);assert(row.events.every((e,i)=>!i||e.ceiling<row.events[i-1].ceiling));assert(new Set(row.events.map(e=>e.bone)).size>1);}assert.notDeepEqual(r.motion[1].events.map(e=>[e.time,e.bone]),r.motion[3].events.map(e=>[e.time,e.bone]));check('irregular, diminishing bounded motion; zero disables it',r.motion);
  }
  r.outcomes=await page.evaluate(hp=>{const l=sdPhysicalCombat,f=feel,counts={critical:0,wounded:0};for(let i=0;i<128;i++){const e=f.fresh(hp),s=l.state(e);s.seed=Math.imul(i+17,0x9e3779b1)>>>0;f.fire('rifle',12);counts[s.phase]++;}return counts;},defaultHP);check('critical frequency sample without converting fatal hits',r.outcomes);assert(r.outcomes.critical>0&&r.outcomes.wounded>0);
  if(!baseline){await page.evaluate(()=>{sdPhysicalCombat.tuning.health=90;document.getElementById('feel-label').remove();});for(const hp of [80,90,100]){await page.locator('#physical-hp-'+hp).click();assert.equal(await page.evaluate(()=>sdPhysicalCombat.targets[0].hmax),hp);}await page.locator('#physical-hp-90').click();check('HP preset controls independent of player and armor');}
  assert.equal(r.errors.length,0);assert.equal(r.external.length,0);assert(r.badResponses.every(u=>u.endsWith('/audio/rocket_loop.wav')));assert(!/logic error/i.test(await page.evaluate(()=>sdRenderer.service_mesage||'')));r.passed=true;
 }catch(e){r.failure=e.stack;throw e;}finally{fs.writeFileSync(dir+'/'+(baseline?'baseline-feel':'validation')+'.json',JSON.stringify(r,null,2));await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
