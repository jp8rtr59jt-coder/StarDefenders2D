// Shared offline combat weapon coordinates. No weapon stats or rig constraints.
import sdWorld from '../sdWorld.js';
import sdEntity from '../entities/sdEntity.js';
const origins=new WeakMap(),shots=new WeakMap();
const pose={
 origins,shots,
 solve(c,local){
  const a=c._ragdoll.elbow2,b=c._ragdoll.hand2;
  const scale=c.s/100,side=c._side,arm=Math.atan2(a.y-b.y,a.x-b.x);
  // The existing lower-arm attachment is T(elbow) R(arm) S(scale,side)
  // T(-7,3). Reuse it, rather than inventing a muzzle offset from the torso.
  const x=a.x+Math.cos(arm)*(-7*scale)-Math.sin(arm)*(3*side*scale);
  const y=a.y+Math.sin(arm)*(-7*scale)+Math.cos(arm)*(3*side*scale);
  const dx=c.look_x-x,dy=c.look_y-y,distance=Math.hypot(dx,dy);
  const aim=Math.atan2(dy,dx)-Math.asin(Math.max(-1,Math.min(1,local.y*side*scale/Math.max(.001,distance))));
  const activation=Math.pow(c._weapon_draw_timer/sdWorld.entity_classes.sdCharacter.default_weapon_draw_time,2);
  const angle=aim+side*activation*Math.PI/2;
  return {x,y,angle,fireAngle:Math.PI/2-aim,arm,scale,side,
   muzzleX:x+Math.cos(angle)*local.x*scale-Math.sin(angle)*local.y*side*scale,
   muzzleY:y+Math.sin(angle)*local.x*scale+Math.cos(angle)*local.y*side*scale};
 },
 place(b,c,p){
  const start=c.GetBulletSpawnOffset(),x=c.x+start.x,y=c.y+start.y;
  const dx=p.muzzleX-x,dy=p.muzzleY-y;
  const cells=sdWorld.GetCellsInRect(Math.min(x,p.muzzleX)+b.hitbox_x1,Math.min(y,p.muzzleY)+b.hitbox_y1,
   Math.max(x,p.muzzleX)+b.hitbox_x2,Math.max(y,p.muzzleY)+b.hitbox_y2);
  const visited=new Set();let t=1;
  for(const cell of cells)for(const e of cell.arr){
   if(visited.has(e))continue;visited.add(e);
   if(e===c||e===b||e===b._gun||e._held_by||e._is_being_removed||e.IsBGEntity()!==0)continue;
   if(!e.hard_collision&&typeof e.hea!=='number'&&typeof e._hea!=='number')continue;
   if(!b.RegularCollisionFiltering(e))continue;
   t=Math.min(t,sdEntity.MovingRectIntersectionCheck(x+b.hitbox_x1,y+b.hitbox_y1,x+b.hitbox_x2,y+b.hitbox_y2,
    dx,dy,e.x+e._hitbox_x1,e.y+e._hitbox_y1,e.x+e._hitbox_x2,e.y+e._hitbox_y2));
  }
  const clipped=t<1;t=clipped?Math.max(0,t-.002/Math.max(.001,Math.hypot(dx,dy))):1;
  b.x=x+dx*t;b.y=y+dy*t;
  // Keep _start_x/y as the original anchor: native point-blank damage ranges
  // retain their reference. Only rail's drawn beam reads the physical origin.
  origins.set(b,{x:b.x,y:b.y});shots.set(b._gun,{clipped,x:b.x,y:b.y});
 },
 blocked(g){return shots.get(g)?.clipped===true;}
};
export default pose;
