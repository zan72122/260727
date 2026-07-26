// PLACEHOLDER — replaced by the owning agent. See CONTRACTS.md.
import * as THREE from "three";

export class FXSystem {
  constructor(){ this.name = "fx"; this.priority = 50; }
  async init(ctx){
    ctx.fx = { impact(){}, muzzleFlash(){}, tracer(){}, blood(){}, explosion(){}, shell(){}, smoke(){}, spark(){} };}
  update(dt, ctx){}
  dispose(){}
}
