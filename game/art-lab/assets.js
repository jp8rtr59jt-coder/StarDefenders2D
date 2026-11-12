// Original, code-authored prototype artwork, GPL-3.0. No downloaded assets.
// Each family has different contours and surface construction, not a palette LUT.
export const contract=Object.freeze({
 logicalSize:32,pivot:[16,16],sourceScale:8,
 parts:['pelvis','torso','upper arm','forearm','thigh','calf','foot','head'],
 note:'Native spring transforms and logical sizes; artwork never sets bone positions or collision bounds.'
});
export const titles={original:'Original engine',A:'A · Cinematic Realism',B:'B · Graphic Novel',C:'C · Modern 2.5D'};
export const assets=new Map();
const started=performance.now();
function canvas(key,w,h,scale,paint){
 const image=document.createElement('canvas');image.width=w*scale;image.height=h*scale;
 const c=image.getContext('2d');c.scale(scale,scale);c.lineJoin='round';c.lineCap='round';paint(c);
 assets.set(key,image);return image;
}
function shape(c,d,color,stroke=null,width=.16){
 const p=new Path2D(d);c.fillStyle=color;c.fill(p);
 if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke(p);}return p;
}
function line(c,d,color,width=.15){c.strokeStyle=color;c.lineWidth=width;c.stroke(new Path2D(d));}
function grad(c,x,y,w,h,a,b){const g=c.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,a);g.addColorStop(1,b);return g;}
function box(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
function grain(c,seed,n,w,h,alpha=.08){
 c.save();c.globalAlpha=alpha;
 for(let i=0;i<n;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed/4294967296*w;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed/4294967296*h;c.fillStyle=i%2?'#fff':'#10100c';c.fillRect(x,y,.12+i%3*.07,.1);}
 c.restore();
}
function hatch(c,path,spacing=.5,color='#181b20',width=.10,extent=32){
 c.save();c.clip(path);for(let y=-extent;y<extent*2;y+=spacing)line(c,`M ${-extent} ${y} l ${extent*3} ${-extent*1.5}`,color,width);c.restore();
}

// A: organic profile, tapered cloth and a smaller head. Gradients, seam work,
// cloth folds and restrained highlights model surfaces without changing the rig.
function realistic(c,index,enemy){
 const cloth=enemy?'#977461':'#7e8479',dark=enemy?'#4f3d37':'#414e50',skin='#cca58b',ink='#303c3d';
 if(index===7){
  shape(c,'M14.4 14.1 L14.2 16.5 Q16 17.2 17.3 15.7 L16.8 13.6Z',grad(c,14,14,3,2,skin,'#785e52'));
  shape(c,'M13.5 10.6 Q13.7 8.6 16.1 8.9 Q18 9.1 18.1 11.2 L18 11.9 L18.9 12.8 L18 13.1 Q18.3 14.9 16.8 15.1 L15 14.7 Q13 13.5 13.5 10.6Z',grad(c,14,9,4,6,'#eed1b2','#a07764'),ink,.10);
  shape(c,'M13.2 12.1 Q12.8 10 13.8 9 Q15.8 7.7 17.9 9.3 L18.4 10.3 Q16.3 9.9 15.2 10.8 L14.7 12.6 L14 12.7Z','#343c3c');
  shape(c,'M14 12 Q13.3 11.9 13.4 13 Q13.6 13.8 14.3 13.3Z',skin);
  line(c,'M16.8 11.6 L17.8 11.8 M17.1 12.1 L17.5 12.1',ink,.14);
  line(c,'M17.2 13.7 L18 13.65 M15.9 14.4 L17.2 14.6','#8a6558',.11);
  line(c,'M14.2 10.3 Q15.4 9.4 17 9.5','#74766c',.13);return;
 }
 const paths=[
  'M13.1 11.5 Q15.2 10.7 17.8 11.7 L18 15 Q15.6 17.2 12.8 15.2Z',
  'M14.2 10.1 Q15 9.4 16.5 10.3 L18.6 12.2 L18 15.8 Q17.2 18.2 13 18 L12 15.3 L12.7 12Z',
  'M15 15 Q16.2 14.4 17.1 15.4 L17.7 18.6 Q17.6 20 16.5 20.6 L15 19.9 L14.6 17Z',
  'M15.2 15 Q16.4 14.7 17.3 15.5 L17.1 18.7 L16.8 21.6 Q16 22.7 15.1 21.7 L14.7 19Z',
  'M14.1 15.2 Q16 14.2 17.5 15.5 L17.4 18.2 L16.7 21 Q15.4 22 14.2 20.6 L13.6 17.4Z',
  'M14.9 15 Q16 14.8 17.1 15.7 L17.2 18.2 L16.5 21.4 L15 21.6 L14.5 19.2Z',
  'M14.7 15.5 L17 15.6 L17.4 16.4 Q18.5 16.4 19.2 17 L19.3 18 L14.5 18 L14.3 16.7Z'
 ];
 const pants=index===0||index>=4;
 const p=shape(c,paths[index],grad(c,13,14,5,8,pants?'#7a8384':cloth,pants?'#323e49':dark),ink,.13);
 c.save();c.clip(p);
 if(index===1){
  shape(c,'M14.5 10 L15.8 12.4 L17 10 L16.9 16.5 L14.6 16.5Z','#b8b2a0');
  line(c,'M13.1 12 L14.7 13 L14.2 14 M17.2 12 L16.5 13 L16.9 14','#d8d5c2',.2);
  line(c,'M15.8 12.4 L15.8 17.8','#4c5351',.16);
  shape(c,'M12.8 14.8 L14.6 14.6 L14.7 16.6 L12.9 16.5Z',dark);
  line(c,'M12.9 14.9 L14.5 14.8 M16.6 15 L17.7 14.5','#b9bba9',.14);
 }else if(index===0){box(c,12,11.9,7,.6,'#292f31');box(c,15,11.9,1,.7,'#aaa79a');}
 else if(index===3){shape(c,'M14.9 20 L16.9 20 L17.2 22 L16.5 23 L15.2 22.4Z',grad(c,15,20,2,3,'#d9b79b','#9b7261'));line(c,'M15.6 21 L16.5 21.3 M15.5 21.6 L16.5 21.8','#7d6259',.09);}
 else if(index===6){box(c,14,17.55,6,.4,'#1e292f');line(c,'M16.7 16.3 L17.6 16.6 M16.4 16.6 L17.7 16.9','#bbb5a1',.12);}
 else {line(c,'M15 16 Q15.2 17.2 16.2 17.4 M15.1 19 Q15.9 18.4 16.9 19.4','#b3b9ad',.13);line(c,'M16.7 15.4 L16.3 18.2 L16.5 20.6',dark,.12);}
 grain(c,index+20,150,32,32,.13);c.restore();
}

// B: deliberately cut contours, strong contour hierarchy, large ink shadow
// masses and clipped cross-hatching. Different silhouette construction from A.
function graphic(c,index,enemy){
 const ink='#17232b',paper='#eadcc2',coat=enemy?'#bd7255':'#b8b2a2';
 if(index===7){
  shape(c,'M14 13.8 L14 16.6 L17.8 16 L17.2 13Z','#c1a083',ink,.26);
  const p=shape(c,'M13 10.5 L14.6 8.8 L17.5 9 L18.1 10.7 L17.8 11.7 L19.1 12.8 L18 13.3 L17.5 15.3 L15.3 15 L13.6 13.6Z',paper,ink,.3);
  shape(c,'M13 10.6 L13.8 9 L17.5 8.7 L18.7 10.5 L16 10.2 L14.6 12.7 L14 13.8 L13 13Z',ink);
  shape(c,'M15.8 12.7 L16.5 14.9 L17.4 15.1 L18 13.2Z','#9b7c67');
  line(c,'M16.6 11.9 L17.8 11.9 M17.2 13.7 L18 13.7',ink,.24);hatch(c,p,.6,'#5e4f45',.07);return;
 }
 const paths=[
  'M12.8 11.2 L17.8 11.2 L18.5 14.3 L16.8 16.2 L12.3 15.8Z',
  'M13 10 L16.5 9.7 L19.2 12 L18 17.8 L12 18.5 L11.2 14Z',
  'M14.4 14.9 L17.5 15 L18.2 18.3 L16.9 21 L14.6 20.3Z',
  'M14.9 15 L17.6 15.1 L17 20.4 L17.6 22 L15 23 L14.2 20.7Z',
  'M13.7 14.8 L17.8 15 L18.2 17.2 L16.7 21.5 L14 21.2 L13.2 18.2Z',
  'M14.5 15 L17.4 15.3 L17.7 17.8 L16.6 21.8 L14.6 21.8 L14.1 19Z',
  'M14.4 15.2 L17.1 15.2 L17.6 16.4 L19.6 17 L19.6 18.2 L14 18.2Z'
 ];
 const p=shape(c,paths[index],index>=4||index===0?'#646d76':coat,ink,.34);
 c.save();c.clip(p);
 shape(c,'M16 9 L21 9 L21 25 L16.3 24 L15.7 19 L17 15 L15.8 13Z',ink);
 if(index===1){shape(c,'M14.4 10 L16 12.5 L16.9 10 L16.6 16.5 L14.8 16Z',paper);shape(c,'M11.7 13.2 L14.1 14.8 L12.3 15.5Z',paper);line(c,'M13 15.3 L14.6 15.2 L14.6 16.7 L13 16.7',ink,.2);}
 if(index===3)shape(c,'M14.6 20.3 L16.9 20 L17.2 22 L15 22.9Z',paper,ink,.22);
 if(index===0)box(c,12,11.7,7,.8,ink);
 if(index===6)box(c,13.8,17.6,6,.6,ink);
 hatch(c,p,.55,ink,.10);line(c,'M14.5 16 L15.2 18.4 L14.7 20',paper,.23);c.restore();
}

// C: a low-poly, sculpted cloth study. No mesh or skeletal gameplay replacement:
// hand-authored facets, broad planes and bevel highlights still map to the rig.
function faceted(c,index,enemy){
 const base=enemy?'#a57862':'#658a94',lit=enemy?'#e1b38b':'#acd1d1',shade='#334b59';
 if(index===7){
  shape(c,'M14 13 L17.2 13 L17.6 16.2 L14 16.7Z','#a78b75');
  shape(c,'M13 10.3 L14.3 8.8 L16.7 8.5 L18 10.1 L18 11.8 L19 12.8 L17.9 13.2 L17.2 15.3 L14.6 14.7 L13.1 12.7Z','#d1b79b','#435461',.12);
  shape(c,'M14.3 8.8 L16.7 8.5 L18 10.1 L15.7 10.5 L13 10.3Z','#424e55');
  shape(c,'M13 10.3 L15.7 10.5 L14.9 13.6 L14.6 14.7 L13.1 12.7Z','#6e746f');
  shape(c,'M15.7 10.5 L18 10.1 L18 11.8 L17 12.7 L14.9 13.6Z','#ecd0ac');
  shape(c,'M17 12.7 L17.9 13.2 L17.2 15.3 L14.9 13.6Z','#9b8170');
  line(c,'M16.7 11.8 L17.8 11.9 M17 13.7 L17.7 13.7','#344954',.14);return;
 }
 const paths=[
  'M13 11.3 L17 11 L18.1 12.4 L18 15 L16 16.4 L12.6 15Z',
  'M13.4 10.2 L16.5 9.9 L18.8 12.2 L18.1 16.6 L16.5 18 L12.7 17.7 L11.6 14Z',
  'M15 14.8 L17 15 L18 16.5 L17.7 18.8 L16.3 20.7 L14.7 19.6 L14.4 16.3Z',
  'M15 15 L17.3 15.2 L17.4 17.7 L16.8 20.5 L17.3 22.1 L15.5 22.8 L14.5 20.6Z',
  'M14.4 14.9 L17.2 15.1 L18 17 L16.7 21.5 L14.5 21.1 L13.7 18Z',
  'M14.8 15 L17 15.4 L17.6 18 L16.5 21.7 L14.8 21.5 L14.3 19Z',
  'M14.7 15.4 L16.9 15.4 L17.7 16.4 L19.3 16.9 L19.5 17.8 L14.3 18Z'
 ];
 const p=shape(c,paths[index],index===0||index>=4?'#596a7c':base,'#354b57',.13);
 c.save();c.clip(p);
 shape(c,'M12 10 L16 10 L15.4 16.5 L13 20 L12 25Z',lit);
 shape(c,'M16 10 L19.7 13.7 L15.4 16.5Z',base);
 shape(c,'M19.7 13.7 L19.7 24 L15.4 16.5Z',shade);
 shape(c,'M15.4 16.5 L19 23 L12 23Z',index>=4?'#70818b':base);
 if(index===1){shape(c,'M14.3 10 L16 12 L16.7 10 L16.6 16.2 L15.2 16.5Z','#c4cac2');line(c,'M16 12 L16 17.6','#415965',.15);}
 if(index===3)shape(c,'M14.8 20 L16.9 20 L17.3 22.1 L15.5 22.8Z','#ccb194');
 if(index===6)shape(c,'M14 17.3 L19.7 17 L19.7 18.4 L14 18.4Z','#263f4b');
 line(c,'M14.5 15.5 L15.5 16.2 L15 19',lit,.17);c.restore();
}

function weapon(c,style){
 c.save();c.translate(16,16);c.scale(.6,.6);c.translate(-16,-16);
 const ink=style==='B'?'#15212a':'#34434a';
 const slide='M10.4 12.4 L12 11.8 L22.6 11.8 L23.2 12.7 L23.1 15 L17 15 L16.5 16 L12 15.5 L11 15Z';
 const grip='M13.2 15 L16.1 15 L16.8 20.5 L15.9 21.5 L13.5 20.8 L12.8 16Z';
 shape(c,grip,style==='A'?grad(c,13,15,4,6,'#8c8170','#383b3b'):style==='B'?'#8b765f':'#3e6574',ink,style==='B'?.35:.15);
 shape(c,slide,style==='A'?grad(c,11,12,12,3,'#d0d0c3','#565e64'):style==='B'?'#ded4b9':'#a7c1c4',ink,style==='B'?.35:.15);
 shape(c,'M16 15 L19.7 15 L19.2 17.2 L17 17.2Z',ink);shape(c,'M16.8 15.2 L18.9 15.2 L18.6 16.5 L17.2 16.5Z','#a4a59b');
 box(c,21.9,12.4,.9,1.7,ink);box(c,12.1,11.4,.8,.7,ink);box(c,20.6,11.4,.7,.6,ink);
 if(style==='C'){shape(c,'M11 12.5 L22.7 12.5 L20.5 13.4 L11 13.4Z','#e4e5d1');shape(c,'M20.5 13.4 L23.1 12.8 L23 15 L20.5 15Z','#587684');}
 for(let x=12;x<14.7;x+=.45)line(c,`M${x} 12.8 l-.1 1.2`,ink,style==='B'?.16:.10);
 line(c,'M14 16.1 L15.6 17 M14 17 L15.8 17.8 M14.1 18 L15.9 18.8',style==='B'?'#eadbc2':'#b2a58a',.13);
 c.restore();
}
function flash(c,style){
 if(style==='A'){
  const g=c.createRadialGradient(7,8,0,7,8,11);g.addColorStop(0,'#fff8dc');g.addColorStop(.3,'#ffce78bb');g.addColorStop(1,'#eeb35400');c.fillStyle=g;c.fillRect(0,0,24,16);
  shape(c,'M1 8 L17 5 L12 7 L21 8 L11 9 L15 11Z','#fff7cd');
 }else if(style==='B'){
  shape(c,'M0 7 L6 6 L7 2 L10 5 L20 1 L16 6 L24 7 L17 9 L22 14 L12 11 L8 15 L6 10 L0 10Z','#17232b');
  shape(c,'M1 8 L8 7 L8 4 L11 7 L19 4 L15 8 L21 8 L13 9 L17 12 L10 10 L8 12 L7 9Z','#fff2b7');
 }else{
  shape(c,'M0 7 L18 4 L23 8 L16 12 L0 10Z','#d1e2c866');shape(c,'M0 7 L18 5 L12 8Z','#fff7cc');shape(c,'M0 10 L12 8 L18 11Z','#c0cab5');shape(c,'M0 7 L12 8 L0 10Z','#ffffff');
 }
}
function material(c,style,crate=false){
 if(style==='A'){
  box(c,0,0,32,32,grad(c,0,0,32,32,crate?'#8d8270':'#8f948b',crate?'#514f48':'#505e62'));
  grain(c,crate?47:12,2400,32,32,.22);box(c,0,0,32,.6,'#d0ccae');box(c,0,30.8,32,1.2,'#293a40');
  if(crate){for(const x of [3,27]){box(c,x,1,1.7,30,'#484e4d');box(c,x,1,.4,30,'#b5b1a0');}line(c,'M6 4 L25 27 M25 4 L6 27','#bbb29a',.7);}
  else{line(c,'M2 5 L14 5 L15 6 M29 11 L28 14 L25 15 M4 27 L12 27','#49575b',.15);line(c,'M0 2 L32 2','#adb0a1',.13);}
 }else if(style==='B'){
  box(c,0,0,32,32,crate?'#ac8c67':'#b7b0a0');shape(c,'M0 0 L32 0 L32 32 L27 32 L27 5 L0 5Z','#f0dfba');shape(c,'M0 24 L27 24 L27 5 L32 0 L32 32 L0 32Z','#293b44');
  line(c,'M.5 .5 L31.5 .5 L31.5 31.5 L.5 31.5Z','#15242c',.9);
  const p=new Path2D('M2 8 H25 V23 H2Z');hatch(c,p,1.5,'#53616a',.14);
  if(crate){line(c,'M5 3 L5 29 M26 3 L26 29 M5 6 L26 26 M26 6 L5 26','#172831',1.2);}
 }else{
  box(c,0,0,32,32,crate?'#738b8b':'#6f8995');shape(c,'M0 0 L32 0 L27 5 L5 5Z','#c1cfc6');shape(c,'M0 0 L5 5 L5 26 L0 32Z','#8fadb1');shape(c,'M32 0 L32 32 L27 26 L27 5Z','#334f63');shape(c,'M0 32 L5 26 L27 26 L32 32Z','#2b465b');
  shape(c,'M5 5 L27 5 L23 20 L5 26Z','#8ca5aa');shape(c,'M27 5 L27 26 L5 26 L23 20Z','#596f83');line(c,'M5 5 L27 5 L27 26','#d9ddca',.25);
  if(crate){shape(c,'M4 4 L8 4 L8 25 L4 28Z','#d1d6c5');shape(c,'M24 4 L28 4 L28 28 L24 25Z','#40596b');line(c,'M9 8 L23 22 M23 8 L9 22','#374e61',1);}
 }
}
function backdrop(c,style,layer){
 // Shared neutral architectural bays: no signs, technology, landscape or era.
 if(layer===0){
  box(c,0,0,512,256,style==='A'?grad(c,0,0,0,256,'#515c61','#92958a'):style==='B'?'#c8bba1':grad(c,0,0,0,256,'#334b62','#8ca3aa'));
  for(let x=-40;x<540;x+=96){
   if(style==='A'){
    box(c,x,12,65,211,grad(c,x,12,65,211,'#36434c','#697875'));box(c,x+3,12,2,211,'#a1a598');box(c,x+61,12,3,211,'#2a3944');
    line(c,`M${x+7} 218 L${x+53} 218`,'#adb0a0',.5);
   }else if(style==='B'){
    shape(c,`M${x} 12 H${x+65} V223 H${x}Z`,'#5a6267','#1b303c',1.8);
    shape(c,`M${x} 12 H${x+65} V25 L${x+25} 90 L${x} 90Z`,'#ecddbb');
    const p=new Path2D(`M${x+2} 100 H${x+62} V221 H${x+2}Z`);hatch(c,p,4,'#a39c8d',.45,512);
   }else{
    shape(c,`M${x} 12 L${x+65} 12 L${x+58} 223 L${x+5} 223Z`,'#486278');
    shape(c,`M${x} 12 L${x+12} 28 L${x+12} 210 L${x+5} 223Z`,'#7595a4');
    shape(c,`M${x+12} 28 L${x+65} 12 L${x+58} 223 L${x+12} 210Z`,'#304c65');
   }
  }
  if(style==='A'){grain(c,938,7000,512,256,.09);const g=c.createRadialGradient(180,80,4,180,80,240);g.addColorStop(0,'#f1e9cb55');g.addColorStop(1,'#ede0b900');c.fillStyle=g;c.fillRect(0,0,512,256);}
  if(style==='B')shape(c,'M340 0 L420 0 L250 256 L180 256Z','#e4d6b022');
 }else{
  for(let x=-10;x<540;x+=128){
   if(style==='A'){
    box(c,x,0,9,256,'#3d4a4e99');box(c,x+1,0,1.5,256,'#c6c3a84a');
   }else if(style==='B'){
    shape(c,`M${x} 0 H${x+10} V256 H${x}Z`,'#21323a');line(c,`M${x+1} 0 V256`,'#f0dfbc',1);
   }else{
    shape(c,`M${x} 0 L${x+14} 0 L${x+14} 256 L${x} 256Z`,'#30485a');
    shape(c,`M${x+3} 0 L${x+8} 0 L${x+8} 256 L${x+3} 256Z`,'#b3c4ba');
    shape(c,`M${x+14} 0 L${x+34} 20 L${x+34} 256 L${x+14} 256Z`,'#415c70');
   }
  }
 }
}

for(const style of ['A','B','C']){
 for(const role of ['player','enemy'])for(let i=0;i<8;i++)canvas(`${style}/${role}/${i}`,32,32,8,c=>({A:realistic,B:graphic,C:faceted})[style](c,i,role==='enemy'));
 canvas(`${style}/pistol`,32,32,8,c=>weapon(c,style));
 canvas(`${style}/flash`,24,16,8,c=>flash(c,style));
 canvas(`${style}/impact`,24,16,8,c=>{c.translate(12,8);c.scale(.65,.65);c.translate(-3,-8);flash(c,style);});
 canvas(`${style}/tile`,32,32,8,c=>material(c,style));
 canvas(`${style}/crate`,32,32,8,c=>material(c,style,true));
 for(let i=0;i<2;i++)canvas(`${style}/background${i}`,512,256,1,c=>backdrop(c,style,i));
 canvas(`${style}/foreground`,512,64,1,c=>{
  box(c,0,0,512,64,grad(c,0,0,0,64,'#15283800',style==='B'?'#172c39':'#152838ee'));
  if(style==='C')for(let x=0;x<512;x+=120)shape(c,`M${x} 62 L${x+25} 22 L${x+40} 32 L${x+48} 64Z`,'#213849');
 });
 canvas(`${style}/shadow`,64,16,2,c=>{
  if(style==='B'){shape(c,'M4 8 L22 3 L60 6 L45 11 L8 12Z','#192b37aa');}
  else{const g=c.createRadialGradient(32,8,0,32,8,31);g.addColorStop(0,'#14263199');g.addColorStop(1,'#14263100');c.save();c.translate(0,6);c.scale(1,.22);c.fillStyle=g;c.fillRect(0,-24,64,64);c.restore();}
 });
}
export const assetStats={generationMs:performance.now()-started,canvases:assets.size,rgbaCanvasBytes:[...assets.values()].reduce((n,c)=>n+c.width*c.height*4,0),maxWidth:512};
