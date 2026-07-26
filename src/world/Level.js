// PLACEHOLDER — replaced by the owning agent. See CONTRACTS.md.
import * as THREE from "three";

export class LevelSystem {
  constructor(){ this.name = "level"; this.priority = 5; }
  async init(ctx){
    const root = new THREE.Group(); ctx.scene.add(root);
    const g = new THREE.Mesh(new THREE.BoxGeometry(80,1,80), new THREE.MeshStandardMaterial({color:0x8a8a8a}));
    g.position.y=-0.5; g.receiveShadow=true; g.userData.surface="concrete"; root.add(g);
    ctx.level = { root, colliders:[], spawnPoints:[new THREE.Vector3(0,1.7,0)], enemySpawns:[new THREE.Vector3(10,1,10)], navMesh:null, bounds:new THREE.Box3().setFromObject(root), lights:[], sunDir:new THREE.Vector3(-0.4,-0.8,-0.2).normalize() };}
  update(dt, ctx){}
  dispose(){}
}
