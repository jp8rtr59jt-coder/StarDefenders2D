/* Complete installed-game workflow. Run in an isolated network namespace if
   8001 is occupied. Node/Playwright are test tools, never game dependencies. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {execFileSync,spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),dir=path.resolve(process.env.LAUNCHER_BROWSER_OUTPUT||'docs/macos-launcher');fs.mkdirSync(dir,{recursive:true});
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'star defenders actual game ')),remote=path.join(temporary,'approved.git'),install=path.join(temporary,'Games','StarDefenders2D'),tools=path.join(temporary,'tools');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',env:{...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'}}).trim();
const python=execFileSync('python3',['-c','import sys;print(sys.executable)'],{encoding:'utf8'}).trim();
const URL='http://127.0.0.1:8001/?mode=combat&movement=1&art=1&physical=1',canonical='https://github.com/jp8rtr59jt-coder/StarDefenders2D.git';
const r={passed:false,checks:[],errors:[],external:[],badResponses:[],nativeMacOSTested:false},check=(name,data)=>{r.checks.push({name,data});console.log('PASS',name,JSON.stringify(data));};
let running,browser;
const stop=async()=>{if(!running)return;const p=running;running=null;p.kill('SIGINT');await new Promise((resolve,reject)=>{const t=setTimeout(()=>{p.kill('SIGKILL');reject(Error('Launcher did not stop'));},8000);p.once('close',code=>{clearTimeout(t);code===0?resolve():reject(Error('Launcher exit '+code));});});};
(async()=>{try{
 const tree=git('-C',repo,'write-tree');r.testedIndexTree=tree;
 const commit=git('-C',repo,'-c','user.name=Launcher fixture','-c','user.email=launcher@example.invalid','commit-tree',tree,'-p','269c784c6ca22e7bf33e51475b8bcd8d38acd1c1','-m','Private installation test fixture');
 git('init','--bare',remote);const common=path.resolve(repo,git('-C',repo,'rev-parse','--git-common-dir'));
 fs.writeFileSync(path.join(remote,'objects','info','alternates'),path.join(common,'objects')+'\n');
 git('--git-dir='+remote,'update-ref','refs/heads/playtest',commit);git('--git-dir='+remote,'symbolic-ref','HEAD','refs/heads/playtest');
 fs.mkdirSync(tools);
 const gitBin=execFileSync('which',['git'],{encoding:'utf8'}).trim();
 fs.writeFileSync(path.join(tools,'git'),`#!${python}\nimport subprocess,sys\na=sys.argv[1:]\nm=[${JSON.stringify('file://'+remote)} if x==${JSON.stringify(canonical)} else ('protocol.file.allow=always' if x=='protocol.file.allow=never' else x) for x in a]\nr=subprocess.run([${JSON.stringify(gitBin)},*m])\nif 'clone' in a and r.returncode==0:subprocess.run([${JSON.stringify(gitBin)},'-C',a[-1],'config','remote.origin.url',${JSON.stringify(canonical)}],check=True)\nsys.exit(r.returncode)\n`,{mode:0o755});
 fs.symlinkSync(python,path.join(tools,'python3'));
 const env={...process.env,PATH:tools+path.delimiter+process.env.PATH};
 execFileSync('/bin/bash',[path.join(repo,'Install StarDefenders.command'),'--destination',install,'--no-launch'],{env,stdio:'pipe'});check('Actual source installed once through the production installer',{commit,branch:git('-C',install,'branch','--show-current')});
 const start=async(expected)=>{const log=fs.openSync(path.join(temporary,'launcher-'+expected+'.log'),'w');running=spawn(python,[path.join(install,'offline/playtest.py'),'--no-browser'],{env,stdio:['ignore',log,log]});fs.closeSync(log);let failure;
  for(let i=0;i<600;i++){if(running.exitCode!==null)throw Error(fs.readFileSync(path.join(temporary,'launcher-'+expected+'.log'),'utf8'));try{const q=await fetch('http://127.0.0.1:8001/playtest-version.json');const v=await q.json();if(v.commit===expected){assert.equal(q.headers.get('cache-control'),'no-store');return;}}catch(e){failure=e;}await new Promise(r=>setTimeout(r,100));}throw Error('Readiness timeout '+failure);};
 await start(commit);
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});const context=await browser.newContext({viewport:{width:1200,height:800}}),page=await context.newPage();
 page.on('pageerror',e=>r.errors.push(e.stack));page.on('dialog',d=>d.dismiss());page.on('response',q=>{if(q.status()>=400)r.badResponses.push(q.url());});await context.route('**/*',q=>{if(new global.URL(q.request().url()).hostname!=='127.0.0.1'){r.external.push(q.request().url());return q.abort();}return q.continue();});
 const ready=async()=>{await page.goto(URL,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>globalThis.sdWorld?.my_entity?.hea>0&&globalThis.sdPhysicalCombat?.targets.length===1&&document.getElementById('physical-controls'),null,{timeout:120000});await page.waitForFunction(()=>sdRenderer.dark_tint<=0,null,{timeout:120000});};
 await ready();assert.equal(page.url(),URL);
 const game=await page.evaluate(()=>({namespace:localforage.config().name,health:sdWorld.my_entity.hea,enemyHealth:sdPhysicalCombat.targets[0].hmax,art:sdArtLab.mode,slide:!!sdMovementPrototype,jetpack:sdWorld.my_entity._jetpack_allowed,eliteReaction:sdWorld.server_config.humanoid_ai.skills.advanced.reactionMin,aligned:sdWorld.server_config.align_combat_muzzles,build:sdWorld.my_entity._inventory.some(g=>g?.class===sdGun.CLASS_BUILD_TOOL)}));
 assert.equal(game.namespace,'sd-physical-combat-lab');assert.equal(game.health,250);assert.equal(game.enemyHealth,90);assert.equal(game.art,'A');assert(game.slide&&game.jetpack&&game.aligned&&game.build);assert.equal(game.eliteReaction,250);check('Automatic native lab startup, without clicking Play',game);
 // Frame the existing player for documentation after proving native autostart;
 // change only the test camera, never the installed source or simulation.
 await page.evaluate(()=>{sdWorld.camera.x=sdWorld.my_entity.x;sdWorld.camera.y=sdWorld.my_entity.y;sdWorld.camera.scale=sdWorld.target_scale=3;sdRenderer.Render(sdWorld.frame);});
 await page.screenshot({path:path.join(dir,'game-autostart.png')});r.screenshotCameraFramedForDocumentation=true;
 await page.evaluate(async()=>{for(const name of ['localforage','sd-combat-experimental','sd-movement-experimental','sd-art-direction-lab'])await localforage.createInstance({name}).setItem('temporary_file_system',{sentinel:name});localStorage.setItem('temporary_file_system','{"legacy":"preserved"}');await localforage.setItem('launcher-probe','same-origin');sdWorld.Stop();});
 await stop();await start(commit);await ready();check('Second launch reuses the installed export and auto-starts again');
 // A private approved test commit exercises promotion; it is never pushed to GitHub.
 const next=git('-C',repo,'-c','user.name=Launcher fixture','-c','user.email=launcher@example.invalid','commit-tree',tree,'-p',commit,'-m','Private approved update fixture');
 git('--git-dir='+remote,'update-ref','refs/heads/playtest',next,commit);
 await page.evaluate(()=>sdWorld.Stop());await stop();await start(next);await ready();assert.equal(git('-C',install,'rev-parse','HEAD'),next);check('Real Git fast-forward, rebuild and native autostart after private approved update',{from:commit,to:next});
 const saves=await page.evaluate(async()=>({probe:await localforage.getItem('launcher-probe'),legacy:localStorage.getItem('temporary_file_system'),worlds:await Promise.all(['localforage','sd-combat-experimental','sd-movement-experimental','sd-art-direction-lab'].map(async name=>({name,value:await localforage.createInstance({name}).getItem('temporary_file_system')})))}));assert.equal(saves.probe,'same-origin');assert.equal(saves.legacy,'{"legacy":"preserved"}');for(const w of saves.worlds)assert.deepEqual(w.value,{sentinel:w.name});check('Stable port/hostname and all previous save namespaces preserved across update',saves);
 const module=await page.request.get('http://127.0.0.1:8001/combat/physical.js',{headers:{'If-Modified-Since':'Wed, 31 Dec 2099 23:59:59 GMT'}});assert.equal(module.status(),200);assert.equal(module.headers()['cache-control'],'no-store');assert((await module.text()).includes('health:90'));check('Fresh modules, assets and no stale conditional-cache responses');
  await page.evaluate(()=>sdWorld.Stop());await page.goto('http://127.0.0.1:8001/');await page.waitForFunction(()=>document.getElementById('server_status')?.textContent==='Offline — ready',null,{timeout:120000});assert.equal(await page.evaluate(()=>!!sdWorld.my_entity),false);check('Original sandbox menu remains available without forced autostart');
 assert.equal(r.errors.length,0);assert.equal(r.external.length,0);assert(r.badResponses.every(u=>u.endsWith('/audio/rocket_loop.wav')));r.passed=true;
 }catch(e){r.failure=e.stack;throw e;}finally{if(browser)await browser.close();await stop();fs.writeFileSync(path.join(dir,'browser-validation.json'),JSON.stringify(r,null,2));fs.rmSync(temporary,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
