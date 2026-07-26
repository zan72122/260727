// PLACEHOLDER — replaced by the owning agent. See CONTRACTS.md.
import * as THREE from "three";

export class AISystem {
  constructor(){ this.name = "ai"; this.priority = 40; }
  async init(ctx){
    ctx.ai = { enemies:[], spawn(){}, damageEnemy(){}, alive:()=>0 };}
  update(dt, ctx){}
  dispose(){}
}
