// PLACEHOLDER — replaced by the owning agent. See CONTRACTS.md.
import * as THREE from "three";

export class AudioSystem {
  constructor(){ this.name = "audio"; this.priority = 60; }
  async init(ctx){
    ctx.audio = { play(){}, play3D(){}, setListener(){}, music(){} };}
  update(dt, ctx){}
  dispose(){}
}
