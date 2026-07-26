// PLACEHOLDER — replaced by the owning agent. See CONTRACTS.md.
import * as THREE from "three";

export class UISystem {
  constructor(){ this.name = "ui"; this.priority = 80; }
  async init(ctx){
    ctx.ui = { setState(){}, notify(){}, showHitmarker(){}, setCrosshairSpread(){} };}
  update(dt, ctx){}
  dispose(){}
}
