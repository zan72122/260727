// PLACEHOLDER — replaced by the owning agent. See CONTRACTS.md.
import * as THREE from "three";

export class PhysicsSystem {
  constructor(){ this.name = "physics"; this.priority = 10; }
  async init(ctx){
    ctx.physics = { raycast:()=>null, sphereCast:()=>null, overlapSphere:()=>[], addBody(){}, removeBody(){}, addCollider(){}, rebuild(){},
      moveCapsule(pos,vel,r,h,dt){ const p=pos.clone().addScaledVector(vel,dt); const grounded=p.y<=h*0.5; if(grounded){p.y=h*0.5; vel.y=Math.max(0,vel.y);} return {position:p, velocity:vel, grounded, groundNormal:new THREE.Vector3(0,1,0), hits:[]}; } };}
  update(dt, ctx){}
  dispose(){}
}
