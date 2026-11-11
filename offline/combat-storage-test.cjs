const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const p=await b.newPage();
try {
await p.goto('http://127.0.0.1:8000/?mode=combat');
await p.waitForFunction(()=>document.getElementById('offline_play')?.textContent==='Start combat sandbox',null,{timeout:120000});
await p.evaluate(async()=>{await localforage.createInstance({name:'localforage'}).setItem('temporary_file_system',{sentinel:'original-world'});localStorage.setItem('temporary_file_system','{"legacy":"untouched"}');});
await p.reload();await p.waitForFunction(()=>document.getElementById('offline_play')?.textContent==='Start combat sandbox',null,{timeout:120000});
await p.locator('#offline_play').click();await p.waitForFunction(()=>sdWorld.my_entity?.hea>0,null,{timeout:120000});
const initial=await p.evaluate(async()=>({namespace:localforage.config().name,original:await localforage.createInstance({name:'localforage'}).getItem('temporary_file_system'),legacy:localStorage.getItem('temporary_file_system'),loadedLegacy:temporary_file_system.legacy}));
const assert=require('node:assert/strict');assert.equal(initial.namespace,'sd-combat-experimental');assert.deepEqual(initial.original,{sentinel:'original-world'});assert.equal(initial.loadedLegacy,undefined);console.log('PASS storage isolation',initial);
await p.locator('#combat-railgun').click();
await p.evaluate(()=>{globalThis.railBullets=0;const add=sdEntity.AddEntityToEntitiesArray;sdEntity.AddEntityToEntitiesArray=function(e){if(e instanceof sdBullet&&e._owner===sdWorld.my_entity)railBullets++;return add.call(this,e);};});
const oldAim=await p.evaluate(()=>[sdWorld.my_entity.look_x,sdWorld.my_entity.look_y]);
await p.mouse.move(900,250);await p.mouse.down();
await p.waitForFunction(()=>railBullets>0,null,{timeout:120000});await p.mouse.up();
assert.notDeepEqual(await p.evaluate(()=>[sdWorld.my_entity.look_x,sdWorld.my_entity.look_y]),oldAim);
console.log('PASS aiming and native railgun projectile creation');
const counts=[];
for(let round=0;round<3;round++) {
 await p.locator('#combat-reset').click();
 await p.evaluate(()=>{if(!sdCombatSandbox.hostile)sdCombatSandbox.toggleHostility();const c=sdWorld.my_entity;c.x=112;c.y=144;c.sx=c.sy=0;c.hmax=c.hea=2000;sdWorld.UpdateHashPosition(c,false);sdCombatSandbox.spawn('basic');});
 await p.waitForFunction(()=>sdWorld.my_entity.hea<2000,null,{timeout:120000});
 await p.evaluate(()=>{const e=sdCombatSandbox.enemies[0];e.DamageWithEffect(e.hea+1,sdWorld.my_entity);});
 counts.push(await p.evaluate(()=>({entities:sdEntity.entities.length,health:sdWorld.my_entity.hea,error:sdRenderer.service_mesage||''})));
 assert(!/logic error/i.test(counts.at(-1).error));
 console.log('PASS repeated combat encounter',round+1,counts.at(-1));
}
assert(counts.at(-1).entities<counts[0].entities+30);
await p.evaluate(()=>{sdWorld.Stop();});
const after=await p.evaluate(async()=>({original:await localforage.createInstance({name:'localforage'}).getItem('temporary_file_system'),legacy:localStorage.getItem('temporary_file_system')}));
assert.deepEqual(after.original,{sentinel:'original-world'});assert.equal(after.legacy,'{"legacy":"untouched"}');console.log('PASS original saves preserved after quit');
} finally { await b.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
