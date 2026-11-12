// Original procedural artwork, GPL-3.0, prototype only; no gameplay state edits.
// Cached high-resolution canvases go through the existing WebGL atlas renderer.
const images=new Map();
function art(name,w,h,scale,paint) {
 const canvas=document.createElement('canvas');canvas.width=w*scale;canvas.height=h*scale;
 const c=canvas.getContext('2d');c.scale(scale,scale);paint(c);
 images.set(name,canvas);return canvas;
}
function panel(c,x,y,w,h,color,r=1) {
 c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();
}
function gradient(c,x,y,w,h,a,b) {const g=c.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,a);g.addColorStop(1,b);return g;}
for(let index=0;index<7;index++)art('part'+index,32,32,8,c=>{
 const bounds=[[13,11,5,5],[11,10,7,8],[14.6,15,2.8,5.5],[14.7,15,2.6,7.5],[13.8,15,3.4,6],[14.7,15,2.7,5.5],[14.8,15.8,4.4,2.3]][index];
 const [x,y,w,h]=bounds,upper=index<4;
 panel(c,x-.25,y-.25,w+.5,h+.5,'#182127',.8);
 panel(c,x,y,w,h,gradient(c,x,y,w,h,upper?'#c0c4bc':'#68747b',upper?'#65736e':'#343d49'),.65);
 panel(c,x+.4,y+.35,w*.18,h*.7,'#ffffff36',.25);
 c.strokeStyle='#26343a';c.lineWidth=.2;c.beginPath();c.moveTo(x+w*.78,y+.5);c.lineTo(x+w*.78,y+h-.5);c.stroke();
 if(index===1){panel(c,11.8,11.5,5.1,.6,'#d3d6c5',.1);panel(c,13.4,12.8,2.8,2.4,'#465854',.25);c.fillStyle='#c9d0c1';c.fillRect(13.7,13.1,2.2,.2);}
 if(index===0)panel(c,13,14.6,5,1.1,'#353d40',.2);
 if(index===3)panel(c,14.9,20.1,2.3,2.3,'#c8a38c',.5);
 if(index===4)panel(c,14.2,18,2.5,1.7,'#2a3540',.5);
 if(index===6){panel(c,15,16.1,4,1.6,'#27323b',.4);panel(c,15,17.6,4,.45,'#a6b4b5',.1);}
});
art('head',32,32,8,c=>{
 panel(c,13.3,14,3.7,2.1,'#9d7e6d',.7);
 panel(c,12.8,9.1,6.1,6.4,'#1a262b',1.7);
 panel(c,13.1,9.4,5.6,5.7,gradient(c,13,10,6,5,'#e5c1a4','#a77e6c'),1.5);
 panel(c,13.1,9.2,5.5,2,'#303a3c',1.1);panel(c,13.1,10.3,1.3,3,'#303a3c',.4);
 panel(c,16.5,11.8,1.3,.35,'#24323a',.15);panel(c,18.1,12,1.2,1.4,'#d4ac91',.3);
 c.strokeStyle='#8c655b';c.lineWidth=.25;c.beginPath();c.moveTo(16.5,14);c.lineTo(18,14);c.stroke();
});
art('pistol',32,32,8,c=>{
 panel(c,13,15,3.2,7,'#18232b',.5);panel(c,13.5,15.3,2.2,6.2,gradient(c,13,16,3,5,'#786e61','#353d41'),.4);
 panel(c,11,12,11.8,3.8,'#14202a',.55);panel(c,11.4,12.4,10.9,2.9,gradient(c,11,12,11,3,'#bbc6c9','#52616e'),.3);
 panel(c,15,15.3,4,2.5,'#27353e',.8);panel(c,15.7,15.3,2.5,1.7,'#879592',.45);
 c.fillStyle='#e2e4d4';c.fillRect(12,12.6,9.6,.35);c.fillStyle='#1d2a34';c.fillRect(20.7,12.7,1.2,1.6);
 for(let x=12;x<14;x+=.5)c.fillRect(x,13,.2,1.4);
});
art('flash',24,16,8,c=>{
 const g=c.createRadialGradient(6,8,0,6,8,10);g.addColorStop(0,'#fffbe8');g.addColorStop(.25,'#ffe8b8ee');g.addColorStop(1,'#efc68b00');
 c.fillStyle=g;c.fillRect(0,0,24,16);c.fillStyle='#fff9d9';c.beginPath();c.moveTo(0,7);c.lineTo(16,5);c.lineTo(9,8);c.lineTo(19,9);c.lineTo(0,10);c.fill();
});
art('tile',32,32,8,c=>{
 c.fillStyle=gradient(c,0,0,32,32,'#727f85','#343f49');c.fillRect(0,0,32,32);
 c.fillStyle='#bac4bf';c.fillRect(0,0,32,.65);c.fillStyle='#131e29';c.fillRect(0,30.5,32,1.5);c.fillRect(30.7,0,1.3,32);
 c.strokeStyle='#293843';c.lineWidth=.4;c.strokeRect(2,3,27,25);
 c.fillStyle='#dce0d026';c.fillRect(3,4,26,.6);
 for(const x of [4,27])for(const y of [6,26]){panel(c,x,y,1.1,1.1,'#26343c',.5);c.fillStyle='#a1b0b1';c.fillRect(x,y,.6,.25);}
});
art('backdrop',512,352,1,c=>{
 c.fillStyle=gradient(c,0,0,512,352,'#273945','#141f2a');c.fillRect(0,0,512,352);
 // Three depths, broad soft illumination and recessed neutral panels, no setting cues.
 for(let x=0;x<512;x+=64){panel(c,x+5,32,54,245,'#172631',3);panel(c,x+7,34,50,239,gradient(c,x,30,50,239,'#344550','#1a2a34'),2);}
 c.fillStyle='#080f18';c.fillRect(0,278,512,74);
 const light=c.createRadialGradient(240,80,10,240,80,240);light.addColorStop(0,'#d6d9bb30');light.addColorStop(1,'#d6d9bb00');c.fillStyle=light;c.fillRect(0,0,512,352);
 for(const y of [30,275]){c.fillStyle='#7d969344';c.fillRect(0,y,512,1);}
});
const preview={
 enabled:true,
 player(c){return this.enabled&&c===sdWorld.my_entity;},
 paint(ctx,name,x,y,w,h) {
  const old=[ctx.sd_filter,ctx.filter,ctx.apply_shading,ctx.sd_color_mult_r,ctx.sd_color_mult_g,ctx.sd_color_mult_b];
  ctx.sd_filter=null;ctx.filter='none';ctx.apply_shading=false;ctx.sd_color_mult_r=ctx.sd_color_mult_g=ctx.sd_color_mult_b=1;
  ctx.drawImage(images.get(name),x,y,w,h);
  [ctx.sd_filter,ctx.filter,ctx.apply_shading,ctx.sd_color_mult_r,ctx.sd_color_mult_g,ctx.sd_color_mult_b]=old;
 },
 part(ctx,c,index){if(!this.player(c))return false;this.paint(ctx,'part'+index/32,-16,-16,32,32);return true;},
 head(ctx,c){if(!this.player(c))return false;this.paint(ctx,'head',-16,-16,32,32);return true;},
 weapon(ctx,g,attached){if(!attached||!this.player(g._held_by)||g.class!==sdGun.CLASS_PISTOL)return false;
  this.paint(ctx,'pistol',-16,-16,32,32);
  if(g.muzzle>0)this.paint(ctx,'flash',6,-12,16,16);
  return true;
 },
 block(ctx,b){if(!this.enabled||b.x< -800||b.x>=-320||b.y<96||b.width!==32||b.height!==32)return false;
  this.paint(ctx,'tile',0,0,32,32);return true;
 },
 background(ctx){if(!this.enabled)return;const old=[ctx.z_offset,ctx.z_depth,ctx.draw_offset];
  ctx.z_offset=-48*sdWorld.camera.scale;ctx.z_depth=0;ctx.draw_offset=-4;
  this.paint(ctx,'backdrop',-800+(sdWorld.camera.x+560)*.08,-192,512,352);
  [ctx.z_offset,ctx.z_depth,ctx.draw_offset]=old;
 },
 images
};
globalThis.sdVisualPreview=preview;
const timer=setInterval(()=>{
 const bar=document.getElementById('combat-controls');if(!bar)return;clearInterval(timer);
 const button=document.createElement('button');button.id='visual-toggle';button.textContent='Prototype art: on';
 button.onclick=()=>{preview.enabled=!preview.enabled;button.textContent='Prototype art: '+(preview.enabled?'on':'off');button.blur();};bar.append(button);
 const notice=document.createElement('span');notice.textContent='VISUAL PROTOTYPE · NOT FINAL ART';notice.style.cssText='color:#e6d9b5;padding:4px';bar.append(notice);
},100);
