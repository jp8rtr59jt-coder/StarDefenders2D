/* Finite opt-in shields: actual native Shoot/collision plus direct-damage tests. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const out=process.env.SHIELD_TEST_OUTPUT||'docs/integrated-combat-3g/c1';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1200,height:900}}),r={passed:false,checks:[],errors:[],external:[],badResponses:[]};
page.on('pageerror',e=>r.errors.push(e.stack));page.on('dialog',d=>d.dismiss());page.on('response',q=>{if(q.status()>=400)r.badResponses.push(q.url());});
await page.route('**/*',q=>{if(new URL(q.request().url()).hostname!=='127.0.0.1'){r.external.push(q.request().url());return q.abort();}return q.continue();});
const check=(name,data)=>{r.checks.push({name,data});console.log('PASS',name,JSON.stringify(data));};
try{
 await page.goto('http://127.0.0.1:8000/?mode=combat&movement=1&art=1&physical=1',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>document.getElementById('server_status')?.textContent==='Offline — ready',null,{timeout:120000});await page.locator('#offline_play').click();
 await page.waitForFunction(()=>globalThis.sdPhysicalCombat?.targets.length&&sdRenderer.dark_tint<=0,null,{timeout:120000});
 await page.evaluate(()=>{
  sdWorld.HandleWorldLogic=()=>{};sdWorld.GSPEED=1;
  globalThis.f={
   fresh(capacity=100,profile='unarmored',extra={}){const e=sdPhysicalCombat.encounter(profile),p=sdWorld.my_entity;e._ai_enabled=sdCharacter.AI_MODEL_NONE;e._ai=null;
    for(const c of [p,e]){c._key_states.Reset();c.sx=c.sy=0;c.stability=100;c._respawn_protection=0;c._hitbox_last_update=-Infinity;c.UpdateHitbox();sdWorld.UpdateHashPosition(c,false);}
    e.matter=e.matter_max=20;this.e=e;this.s=sdPhysicalCombat.equipShield(e,{capacity,...extra});return e;
   },
   state(){return {hp:this.e.hea,armor:this.e.armor,shield:this.s.hea,matter:this.e.matter,phase:sdPhysicalCombat.state(this.e).phase,sx:this.e.sx,removed:this.s._is_being_removed};},
   fire(kind='pistol',dy=3){const p=sdWorld.my_entity,e=this.e,g=sdCombatSandbox.equip(p,kind);p.sx=p.sy=0;p.look_x=e.x;p.look_y=e.y+dy;p._weapon_draw_timer=0;p._recoil=0;p.fire_anim=p.reload_anim=0;
    const rag=p._ragdoll;rag._smooth_x=p.x;rag._smooth_y=p.y;rag._smooth_look_x=p.look_x;rag._smooth_look_y=p.look_y;for(let i=0;i<14;i++){rag.AliveUpdate();rag.Think(1);}
    g.reload_time_left=0;g.ammo_left=kind==='railgun'?-1:30;const start=sdEntity.entities.length,random=Math.random;Math.random=()=>.5;
    try{if(!g.Shoot(0,p.GetBulletSpawnOffset()))throw Error('Shoot rejected');}finally{Math.random=random;}
    const bs=sdEntity.entities.slice(start).filter(b=>b instanceof sdBullet&&b._owner===p);
    for(const b of bs)for(let i=0;i<24&&!b._is_being_removed;i++){b.UpdateHitbox();b.onThink(1);sdWorld.UpdateHashPosition(b,false);}
    return {...this.state(),bullets:bs.length,hit:sdPhysicalCombat.state(e).last};
   },
   shot({y,damage=85,penetrating=false,wave=false,x=600,owner=sdWorld.my_entity}){const b=new sdBullet({x,y});b._owner=owner;b._damage=damage;b.sx=20;b.sy=0;b.time_left=30;b.penetrating=penetrating;b._wave=wave;b._rail=penetrating;sdCombatSandbox.add(b);
    for(let i=0;i<20&&!b._is_being_removed;i++){b.UpdateHitbox();b.onThink(1);sdWorld.UpdateHashPosition(b,false);}return {...this.state(),remaining:b._damage,hit:sdPhysicalCombat.state(this.e).last};
   }
  };
 });
 const full=await page.evaluate(()=>{f.fresh();return f.fire();});assert.equal(full.hp,90);assert.equal(full.shield,82);assert.equal(full.hit?.loss??0,0);check('Native pistol completely absorbed once without biological injury',full);
 const rail=await page.evaluate(()=>{f.fresh(1);return f.fire('railgun');});assert.equal(rail.shield,0);assert(Math.abs(rail.hp-6)<.001);assert(rail.sx>0);check('1-capacity shield versus native 85-damage rail: 84 reaches body, impulse retained',rail);
 const partial=await page.evaluate(()=>{f.fresh(5);return f.fire();});assert.equal(partial.hp,77);assert.equal(partial.shield,0);check('Non-penetrating overflow continues original sweep into body exactly once',partial);
 const exact=await page.evaluate(()=>{f.fresh(18);const first=f.fire(),second=f.fire();return {first,second};});assert.equal(exact.first.hp,90);assert.equal(exact.first.shield,0);assert.equal(exact.second.hp,72);check('Exact depletion followed by exposed biological damage',exact);
 const pellets=await page.evaluate(()=>{f.fresh(100);return f.fire('shotgun');});assert.equal(pellets.bullets,5);assert.equal(pellets.hp,90);assert.equal(pellets.shield,0);check('Five native shotgun pellets deplete capacity without double charging',pellets);
 const armor=await page.evaluate(()=>{f.fresh(5,'heavy');return f.fire();});assert(armor.hp>77&&armor.hp<90);assert(armor.armor<100);assert.equal(armor.shield,0);assert(Math.abs(90-armor.hp+100-armor.armor-13)<.001);check('Residual damage enters native body armor ledger once',armor);
 const head=await page.evaluate(()=>{f.fresh(100);return f.fire('pistol',-7);});assert.equal(head.hp,90);assert.equal(head.shield,82);check('Biological head amplification does not multiply shield energy',head);
 const graze=await page.evaluate(()=>{const e=f.fresh(1);return f.shot({y:e.y-20});});assert.equal(graze.hp,90);assert.equal(graze.shield,0);check('Bubble-edge graze drains finite charge without damaging owner',graze);
 const waves=await page.evaluate(()=>{const e=f.fresh(5);const outside=f.shot({y:e.y+3,damage:20,wave:true});f.fresh(5);const inside=f.shot({x:650,y:f.e.y+3,damage:20,wave:true});return {outside,inside};});console.log("Wave measurements",JSON.stringify(waves));assert.equal(waves.outside.hp,75);assert.equal(waves.inside.hp,75);check('Exterior and interior explosion-wave projectiles use single residual transaction',waves);
 const direct=await page.evaluate(()=>{const e=f.fresh(5);e.Damage(30,null,false,false);const loss=f.state();e.Damage(-3);return {loss,healed:f.state()};});assert.equal(direct.loss.hp,65);assert.equal(direct.loss.shield,0);assert.equal(direct.healed.hp,65);check('Direct damage overflow; native NPC healing restriction preserved',direct);
 const extra=await page.evaluate(()=>{
  f.fresh(5);f.e.DamageWithEffect(20);const effect=f.state();
  f.fresh(100);f.shot({x:f.e.x+10,y:f.e.y+3,owner:f.e,damage:20});const outgoing=f.state();
  const e=f.fresh(5);const penetrating=f.shot({y:e.y+3,damage:20,penetrating:true});
  f.fresh(100);const target=f.e;const insideBody=f.shot({x:target.x,y:target.y+3,damage:20,wave:true});
  f.fresh(100);const bodyPenetrating=f.shot({x:f.e.x,y:f.e.y+3,damage:20,penetrating:true});
  let restored=false;try{sdPhysicalCombat.withoutShield(f.e,()=>{throw Error('fixture');});}catch{restored=!sdPhysicalCombat.shieldBypassed(f.e);}
  return {effect,outgoing,penetrating,insideBody,bodyPenetrating,restored};
 });assert.equal(extra.effect.hp,75);assert.equal(extra.effect.shield,0);assert.equal(extra.outgoing.shield,100);assert.equal(extra.outgoing.hp,90);assert.equal(extra.penetrating.hp,75);assert.equal(extra.insideBody.hp,90);assert.equal(extra.insideBody.shield,80);assert.equal(extra.bodyPenetrating.shield,80);assert.equal(extra.bodyPenetrating.hp,90);assert(extra.restored);check('DamageWithEffect, outgoing shots, penetrating projectiles, body-origin waves and scoped bypass cleanup',extra);
 const regen=await page.evaluate(()=>{f.fresh(20,'unarmored',{rechargePerSecond:10,rechargeDelayMs:1000,matterPerPoint:2});f.e.matter=5;f.s.AbsorbFiniteDamage(20);f.s.onThink(29);const waiting=f.state();f.s.onThink(31);const recovered=f.state();f.s.onThink(300);const empty=f.state();f.e.matter=100;f.s.onThink(300);return {waiting,recovered,empty,refilled:f.state(),regen:f.e._matter_regeneration};});assert.equal(regen.waiting.shield,0);assert.equal(regen.recovered.shield,2.5);assert.equal(regen.recovered.matter,0);assert.equal(regen.empty.shield,2.5);assert.equal(regen.refilled.shield,20);assert.equal(regen.refilled.matter,65);assert.equal(regen.regen,0);check('Delayed recharge spends finite matter and stops when empty',regen);
 const refresh=await page.evaluate(()=>{f.fresh(100);f.s.AbsorbFiniteDamage(20);sdBubbleShield.ApplyShield(f.e,sdBubbleShield.TYPE_STAR_DEFENDER_SHIELD);f.s.onThink(60);const value=f.state();let rejected=false;try{sdPhysicalCombat.equipShield(f.e,{capacity:20});}catch{rejected=true;}return {value,rejected};});assert.equal(refresh.value.shield,80);assert.equal(refresh.value.matter,20);assert(refresh.rejected);check('Native ability refresh and duplicate equip cannot grant free capacity',refresh);
 const bleed=await page.evaluate(()=>{const e=f.fresh(1000,'unarmored',{rechargePerSecond:100,rechargeDelayMs:0});const s=sdPhysicalCombat.state(e);s.phase='critical';s.deadline=100;s.bleedRate=1;e._dying=true;e.matter=5;for(let i=0;i<6&&e.hea>0;i++){sdWorld.time+=1000/30;sdWorld.frame++;e.onThink(1);f.s.onThink(1);}return {...f.state(),finite:e._ragdoll.bones.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y))};});assert(bleed.hp<=0&&bleed.removed&&bleed.finite);assert.equal(bleed.shield,0);check('Internal critical bleeding reaches finite death endpoint through a charged shield',bleed);
 const native=await page.evaluate(()=>{sdPhysicalCombat.encounter();const e=sdCombatSandbox.spawn('basic');sdBubbleShield.ApplyShield(e,sdBubbleShield.TYPE_STAR_DEFENDER_SHIELD);const s=e._shield_ent;s.hea=1;e.Damage(85);const before={hp:e.hea,shield:s.hea,finite:!!s._finite};s._regen_timeout=0;s.onThink(1);return {before,after:s.hea};});assert.equal(native.before.hp,250);assert.equal(native.before.shield,-84);assert.equal(native.after,-78);assert(!native.before.finite);check('Unattached native shields retain original full-block and free-regeneration behavior',native);
 const player=await page.evaluate(()=>{const p=sdWorld.my_entity;sdBubbleShield.ApplyShield(p,sdBubbleShield.TYPE_STAR_DEFENDER_SHIELD);const s=p._shield_ent;s.hea=1;const hp=p.hea;p._respawn_protection=0;p.Damage(85);return {hp:p.hea,before:hp,shield:s.hea,finite:!!s._finite};});assert.equal(player.hp,player.before);assert.equal(player.shield,-84);assert(!player.finite);check('Native player shield behavior preserved',player);
 for(const query of ['', '?mode=combat']){await page.goto('http://127.0.0.1:8000/'+query,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>document.getElementById('server_status')?.textContent==='Offline — ready',null,{timeout:120000});assert.equal(await page.evaluate(()=>typeof sdPhysicalCombat),'undefined');}check('Original and ordinary combat startup omit finite equipment policy');
 assert.equal(r.errors.length,0);assert.equal(r.external.length,0);assert(r.badResponses.every(u=>u.endsWith('/audio/rocket_loop.wav')));r.passed=true;
}catch(e){r.failure=e.stack;throw e;}finally{fs.writeFileSync(out+'/shield-validation.json',JSON.stringify(r,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
