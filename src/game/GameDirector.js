// PLACEHOLDER — replaced by the owning agent. See CONTRACTS.md.
import * as THREE from "three";

export class GameDirector {
  constructor(){ this.name = "game"; this.priority = 70; }
  async init(ctx){
    ctx.game = { state:"playing", score:0, wave:0 };}
  update(dt, ctx){}
  dispose(){}
}
