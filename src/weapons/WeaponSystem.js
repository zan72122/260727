// PLACEHOLDER — replaced by the owning agent. See CONTRACTS.md.
import * as THREE from "three";

export class WeaponSystem {
  constructor(){ this.name = "weapons"; this.priority = 30; }
  async init(ctx){
    ctx.weapons = { current:null, inventory:[], ads:0, switchTo(){}, reload(){}, fire(){}, getMuzzleWorld(o){ return o.copy(ctx.camera.position); } };}
  update(dt, ctx){}
  dispose(){}
}
