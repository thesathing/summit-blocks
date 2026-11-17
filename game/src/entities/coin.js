// Floating gold coins: spinning, bobbing, glowing. A coin is collected when
// the climber comes within 1.2 m; collection plays a chime and a sparkle.
import * as THREE from 'three';

export function createCoins(scene, coinData) {
  const gold = new THREE.MeshStandardMaterial({
    color: 0xffc21a, metalness: 0.75, roughness: 0.25,
    emissive: 0xa16207, emissiveIntensity: 0.55,
  });
  const geo = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 20);
  const starGeo = new THREE.BoxGeometry(0.5, 0.5, 0.1);
  const coins = coinData.map((c, i) => {
    const group = new THREE.Group();
    const disc = new THREE.Mesh(geo, gold);
    disc.rotation.x = Math.PI / 2;
    disc.castShadow = true;
    const star = new THREE.Mesh(starGeo, gold);
    star.position.z = 0.1;
    group.add(disc, star);
    group.position.set(c.x, c.y, c.z);
    scene.add(group);
    // Fixed phase per coin (golden-angle spacing): a random phase would make
    // every coin bob/spin differently on each load, breaking shot determinism.
    return { ...c, group, taken: false, phase: (i * 2.399963) % (Math.PI * 2) };
  });

  return {
    list: coins,
    get remaining() {
      return coins.filter((c) => !c.taken).length;
    },
    update(dt, t) {
      for (const c of coins) {
        if (c.taken) continue;
        c.group.rotation.y = t * 2.2 + c.phase;
        c.group.position.y = c.y + Math.sin(t * 2 + c.phase) * 0.25;
      }
    },
    // Returns the newly collected coin, or null. radius grows with the Coin
    // Magnet gear, so coins are pulled in from farther away.
    tryCollect(px, py, pz, radius = 1.2) {
      for (const c of coins) {
        if (c.taken) continue;
        const dx = c.group.position.x - px;
        const dy = c.group.position.y - (py + 0.9);
        const dz = c.group.position.z - pz;
        if (dx * dx + dy * dy + dz * dz < radius * radius) {
          c.taken = true;
          c.group.visible = false;
          return c;
        }
      }
      return null;
    },
    reset() {
      for (const c of coins) {
        c.taken = false;
        c.group.visible = true;
      }
    },
  };
}
