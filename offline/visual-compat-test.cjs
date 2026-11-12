const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const context=await b.newContext();const r={passed:false,errors:[],external:[],modes:[]};
 await context.route('**/*',q=>{if(new URL(q.request().url()).hostname!=='127.0.0.1'){r.external.push(q.request().url());return q.abort();}return q.continue();});
 try{
  for(const mode of ['?mode=combat&visual=1','?mode=combat','']) {
   const p=await context.newPage();p.on('pageerror',e=>r.errors.push(e.stack));p.on('dialog',d=>d.dismiss());
   await p.goto('http://127.0.0.1:8000/'+mode);
   await p.waitForFunction(()=>document.getElementById('server_status')?.textContent==='Offline — ready',null,{timeout:120000});
   await p.locator('#offline_play').click();await p.waitForFunction(()=>sdWorld.my_entity?.hea>0,null,{timeout:120000});
   const visual=await p.evaluate(()=>!!globalThis.sdVisualPreview);
   assert.equal(visual,mode.includes('visual'));
   if(visual){
    const frame=await p.evaluate(()=>sdWorld.frame);await p.waitForFunction(f=>sdWorld.frame>f+20,frame,{timeout:120000});
    await p.evaluate(()=>{
     const a=sdWorld.my_entity;sdCombatSandbox.equip(a,'pistol');
     globalThis.hitBlock=new sdBlock({x:a.x+64,y:128,width:32,height:32,material:sdBlock.MATERIAL_WALL});sdEntity.AddEntityToEntitiesArray(hitBlock);sdWorld.UpdateHashPosition(hitBlock,false);
     globalThis.hitBefore=hitBlock._hea;globalThis.impactEffects=0;
     const add=sdEntity.AddEntityToEntitiesArray;sdEntity.AddEntityToEntitiesArray=function(e){if(e instanceof sdEffect)impactEffects++;return add.call(this,e);};
     a.look_x=hitBlock.x+16;a.look_y=140;
     const gun=a._inventory[a.gun_slot];if(!gun.Shoot(0,a.GetBulletSpawnOffset()))throw Error('Native test shot rejected');
    });
    await p.waitForFunction(()=>hitBlock._hea<hitBefore,null,{timeout:120000});
    const impact=await p.evaluate(()=>({damage:hitBefore-hitBlock._hea,effects:impactEffects,muzzle:sdWorld.my_entity._inventory[1].muzzle}));
    assert(impact.damage>0&&impact.effects>0);r.impact=impact;
   }
   r.modes.push({url:mode||'original offline',visual,alive:await p.evaluate(()=>sdWorld.my_entity.hea>0)});
   await p.close();
  }
  assert.equal(r.errors.length,0);assert.equal(r.external.length,0);r.passed=true;console.log(JSON.stringify(r,null,2));
 }catch(e){r.failure=e.stack;throw e;}finally{fs.writeFileSync('docs/visual-experiments/compatibility.json',JSON.stringify(r,null,2));await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
