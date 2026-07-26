// PLACEHOLDER — replaced by the owning agent. See CONTRACTS.md.
import * as THREE from "three";

export class PostFXSystem {
  constructor(){ this.name = "postfx"; this.priority = 900; }
  async init(ctx){
    ctx.postfx = { render(dt,c){ c.renderer.render(c.scene, c.camera); }, setBloom(){}, setVignette(){}, hitFlash(){}, dispose(){} };}
  update(dt, ctx){}
  dispose(){}
}
