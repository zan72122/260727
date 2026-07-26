// PLACEHOLDER — replaced by the owning agent. See CONTRACTS.md.
import * as THREE from "three";

export class SkySystem {
  constructor(){ this.name = "sky"; this.priority = 6; }
  async init(ctx){
    ctx.scene.background = new THREE.Color(0x223344);
    const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x2b2a26, 1.2); ctx.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffeedd, 2.4); sun.position.set(40,70,20); sun.castShadow=true; ctx.scene.add(sun);
    ctx.sky = { sunDir: new THREE.Vector3(-0.4,-0.8,-0.2).normalize(), envMap:null, setTimeOfDay(){} };}
  update(dt, ctx){}
  dispose(){}
}
