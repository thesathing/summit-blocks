// World dressing: blocky trees, rocks, bushes, flowers, checkpoint flags,
// a waterfall, circling block birds, and zone particles (leaves / dust / snow).
import * as THREE from 'three';
import { mulberry32 } from './textures.js';
import { mountainRadius } from '../data/levels.js';

function box(w, h, d, mat, x, y, z, castShadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = castShadow;
  m.receiveShadow = true;
  return m;
}

export function createProps(scene, level) {
  const rand = mulberry32(777);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.95 });
  const leafMats = [0x2f7d32, 0x3d9142, 0x57a83e, 0x7fb069].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }),
  );
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.95 });
  const flowerMats = [0xff5d8f, 0xffd166, 0xc77dff, 0xff8c42].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, emissive: c, emissiveIntensity: 0.25 }),
  );

  // Trees and rocks scattered on the mountain terraces, kept clear of the
  // climb path (they sit at a different angle than the platforms).
  const pathAngles = new Set(level.platforms.map((p) => Math.round(Math.atan2(p.z, p.x) * 4)));
  for (let i = 0; i < 46; i += 1) {
    const y = 2 + rand() * 52;
    const angle = rand() * Math.PI * 2;
    if (pathAngles.has(Math.round(angle * 4))) continue;
    const r = mountainRadius(y) + 0.5 + rand() * 2.5;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    if (y < 26) {
      // Blocky pine: trunk + two stacked foliage boxes.
      const tree = new THREE.Group();
      tree.add(box(0.7, 2.2, 0.7, trunkMat, 0, 1.1, 0));
      tree.add(box(2.6, 1.8, 2.6, leafMats[i % leafMats.length], 0, 2.9, 0));
      tree.add(box(1.8, 1.5, 1.8, leafMats[(i + 1) % leafMats.length], 0, 4.4, 0));
      tree.position.set(x, y, z);
      tree.rotation.y = rand() * Math.PI;
      scene.add(tree);
    } else {
      const rock = box(1 + rand() * 2.2, 0.8 + rand() * 1.6, 1 + rand() * 2.2, rockMat, x, y + 0.5, z);
      rock.rotation.y = rand() * Math.PI;
      scene.add(rock);
    }
  }
  // Flowers and bushes near the base meadow.
  for (let i = 0; i < 60; i += 1) {
    const angle = rand() * Math.PI * 2;
    const r = 12 + rand() * 36;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    if (Math.hypot(x, z - 47) < 7) continue; // keep the start deck clear
    const flower = new THREE.Group();
    flower.add(box(0.12, 0.7, 0.12, trunkMat, 0, 0.35, 0));
    flower.add(box(0.55, 0.4, 0.55, flowerMats[i % flowerMats.length], 0, 0.85, 0));
    flower.position.set(x, 0.15, z);
    scene.add(flower);
  }

  // Checkpoint flags: pole + waving banner, one per checkpoint.
  const flags = [];
  for (const cp of level.checkpoints) {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 3.4, 8),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.4, metalness: 0.6 }),
    );
    pole.position.y = 1.7;
    pole.castShadow = true;
    group.add(pole);
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.9, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x14532d, emissiveIntensity: 0.5, roughness: 0.7 }),
    );
    banner.position.set(0.8, 2.9, 0);
    banner.castShadow = true;
    group.add(banner);
    const glowRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.07, 8, 32),
      new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x16a34a, emissiveIntensity: 1.2 }),
    );
    glowRing.rotation.x = Math.PI / 2;
    glowRing.position.y = 0.25;
    group.add(glowRing);
    group.position.set(cp.x, cp.y + 0.6, cp.z);
    scene.add(group);
    flags.push({ group, banner, glowRing, active: false });
  }
  // Golden summit flag, larger and brighter.
  const summitFlag = (() => {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 5, 8),
      new THREE.MeshStandardMaterial({ color: 0xf5c542, metalness: 0.7, roughness: 0.3 }),
    );
    pole.position.y = 2.5;
    pole.castShadow = true;
    group.add(pole);
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.4, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xf5c542, emissive: 0xa16207, emissiveIntensity: 0.8, roughness: 0.5 }),
    );
    banner.position.set(1.25, 4.2, 0);
    banner.castShadow = true;
    group.add(banner);
    const light = new THREE.PointLight(0xffd166, 50, 30, 1.6);
    light.position.set(0, 4, 0);
    group.add(light);
    group.position.set(level.summit.x, level.summit.y + 0.6, level.summit.z);
    scene.add(group);
    return { group, banner };
  })();

  // Waterfall: a translucent blue strip down the cliff face + foam at base.
  const fallMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc, transparent: true, opacity: 0.75, roughness: 0.15, metalness: 0.1,
  });
  const waterfall = new THREE.Mesh(new THREE.BoxGeometry(3, 16, 0.4), fallMat);
  const fallAngle = 2.4;
  const fallR = mountainRadius(46) + 1.2;
  waterfall.position.set(Math.cos(fallAngle) * fallR, 40, Math.sin(fallAngle) * fallR);
  waterfall.lookAt(0, 40, 0);
  scene.add(waterfall);

  // Blocky birds circling the mountain.
  const birdMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });
  const birds = [];
  for (let i = 0; i < 3; i += 1) {
    const bird = new THREE.Group();
    bird.add(box(1.1, 0.18, 0.5, birdMat, 0, 0, 0));
    const wingL = box(0.7, 0.1, 1.1, birdMat, -0.5, 0.08, 0);
    const wingR = box(0.7, 0.1, 1.1, birdMat, 0.5, 0.08, 0);
    bird.add(wingL);
    bird.add(wingR);
    scene.add(bird);
    birds.push({ group: bird, wingL, wingR, radius: 55 + i * 9, height: 55 + i * 10, speed: 0.12 + i * 0.03, phase: i * 2.1 });
  }

  // Zone particles: leaves (forest), dust (cliff), snow (summit). Points
  // systems with seeded positions, wrapping around the climber.
  function makePoints(count, color, size, area) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      pos[i * 3] = (rand() - 0.5) * area.x;
      pos[i * 3 + 1] = rand() * area.y;
      pos[i * 3 + 2] = (rand() - 0.5) * area.z;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.9, sizeAttenuation: true });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    return points;
  }
  const leaves = makePoints(220, 0x86c232, 0.35, { x: 110, y: 30, z: 110 });
  const dust = makePoints(130, 0xd6c29a, 0.3, { x: 100, y: 40, z: 100 });
  const snow = makePoints(420, 0xffffff, 0.32, { x: 110, y: 50, z: 110 });
  leaves.position.y = 2;
  dust.position.y = 26;
  snow.position.y = 58;

  return {
    flags,
    summitFlag,
    setFlagActive(id) {
      const f = flags[id];
      if (!f || f.active) return;
      f.active = true;
      f.banner.material = new THREE.MeshStandardMaterial({ color: 0xf5c542, emissive: 0xa16207, emissiveIntensity: 0.9, roughness: 0.5 });
    },
    update(dt, t, playerPos) {
      for (const f of flags) {
        f.banner.rotation.y = Math.sin(t * 3 + f.group.position.x) * 0.22;
        f.glowRing.material.emissiveIntensity = f.active ? 1.6 : 0.9 + Math.sin(t * 2.5) * 0.35;
      }
      summitFlag.banner.rotation.y = Math.sin(t * 3.4) * 0.25;
      for (const b of birds) {
        const a = t * b.speed + b.phase;
        b.group.position.set(Math.cos(a) * b.radius, b.height + Math.sin(t * 0.7 + b.phase) * 2, Math.sin(a) * b.radius);
        b.group.rotation.y = -a;
        const flap = Math.sin(t * 9 + b.phase) * 0.55;
        b.wingL.rotation.z = flap;
        b.wingR.rotation.z = -flap;
      }
      // Particles drift down and wrap, following the climber's height band.
      const drift = (points, fallSpeed, sway, topY) => {
        const attr = points.geometry.attributes.position;
        for (let i = 0; i < attr.count; i += 1) {
          let y = attr.getY(i) - fallSpeed * dt;
          if (y <= 0) y = topY;
          attr.setY(i, y);
          attr.setX(i, attr.getX(i) + Math.sin(t + i) * sway * dt);
        }
        attr.needsUpdate = true;
      };
      drift(leaves, 1.6, 0.5, 30);
      drift(dust, 0.9, 0.3, 40);
      drift(snow, 2.4, 0.7, 50);
      void playerPos;
    },
  };
}
