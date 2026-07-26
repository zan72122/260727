// PLACEHOLDER — replaced by the owning agent. See CONTRACTS.md.
import * as THREE from "three";

export class PlayerSystem {
  constructor(){ this.name = "player"; this.priority = 20; }
  async init(ctx){
    ctx.player = { position:new THREE.Vector3(0,1.7,0), velocity:new THREE.Vector3(), yaw:0, pitch:0, grounded:true, crouching:false, sprinting:false, sliding:false, health:100, maxHealth:100, alive:true, eyeHeight:1.68, radius:0.35,
      damage(){}, heal(){}, respawn(){}, addRecoil(){}, addCameraShake(){}, getViewDirection(o){ return o.set(0,0,-1).applyQuaternion(ctx.camera.quaternion); } };}
  update(dt, ctx){}
  dispose(){}
}
