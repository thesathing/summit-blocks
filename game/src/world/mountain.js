// The mountain itself: terraced cone, climb platforms with block studs,
// lava gap, and the per-frame platform motion (moving / crumbling).
import * as THREE from 'three';
import { grassTexture, rockTexture, snowTexture, woodTexture, dirtTexture, lavaTexture, grassTopTexture, rockTopTexture, snowTopTexture, woodTopTexture, mulberry32 } from './textures.js';
import { mountainRadius, zoneAt } from '../data/levels.js';
import { updatePlatform } from '../engine/physics.js';

function zoneMaterials() {
  const grass = new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 0.9 });
  const rock = new THREE.MeshStandardMaterial({ map: rockTexture(), roughness: 0.95 });
  const snow = new THREE.MeshStandardMaterial({ map: snowTexture(), roughness: 0.75 });
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.85 });
  const dirt = new THREE.MeshStandardMaterial({ map: dirtTexture(), roughness: 1.0 });
  const ice = new THREE.MeshStandardMaterial({
    map: snowTexture(), color: 0x9fd4ff, roughness: 0.25, metalness: 0.1,
  });
  const lava = new THREE.MeshStandardMaterial({
    map: lavaTexture(), emissive: 0xff4400, emissiveIntensity: 1.4, roughness: 0.6,
  });
  return { grass, rock, snow, wood, dirt, ice, lava };
}

function materialFor(platform, mats) {
  if (platform.type === 'ice') return mats.ice;
  if (platform.type === 'wood') return mats.wood;
  if (platform.zone === 'forest') return mats.grass;
  if (platform.zone === 'cliff') return mats.rock;
  return mats.snow;
}

// Clone a canvas texture with a different repeat: the clone shares the
// canvas image, so no new drawing work, just its own UV tiling.
function tiledTexture(tex, rx, ry) {
  const t = tex.clone();
  t.needsUpdate = true;
  t.repeat.set(rx, ry);
  return t;
}

export function createMountain(scene, level) {
  const mats = zoneMaterials();
  const rand = mulberry32(2026);

  // Terraced cone: stacked cylinders, each ring textured by its zone, with a
  // grassy base disc and a snowy cap. Flat shading keeps the blocky read.
  const terraceCount = 12;
  for (let i = 0; i < terraceCount; i += 1) {
    const y0 = (i / terraceCount) * 88;
    const y1 = ((i + 1) / terraceCount) * 88;
    const r0 = mountainRadius(y0) + 1.5;
    const r1 = mountainRadius(y1) + 1.5;
    const zone = zoneAt((y0 + y1) / 2);
    // Tile the texture around the terrace: one shared 1x1 repeat stretched a
    // 256 px canvas around a ~250 m circumference, which smeared into flat
    // horizontal streaks. A tile every ~6 m keeps the detail crisp.
    const baseTex = zone === 'forest' ? grassTexture() : zone === 'cliff' ? rockTexture() : snowTexture();
    const circ = 2 * Math.PI * (mountainRadius((y0 + y1) / 2) + 1.5);
    const mat = new THREE.MeshStandardMaterial({
      map: tiledTexture(baseTex, Math.max(4, Math.round(circ / 6)), 1),
      roughness: 0.95,
    });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, y1 - y0 + 0.6, 24, 1), mat);
    mesh.position.y = (y0 + y1) / 2;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  // Base ground disc (safe landing at the foot of the mountain). The disc's
  // top cap maps one texture across 104 m — tile it so the dirt and grass
  // keep their speckle instead of blurring into mush.
  const ground = new THREE.Mesh(
    new THREE.CylinderGeometry(52, 54, 1.2, 32),
    new THREE.MeshStandardMaterial({ map: tiledTexture(dirtTexture(), 14, 14), roughness: 1.0 }),
  );
  ground.position.y = -0.6;
  ground.receiveShadow = true;
  scene.add(ground);
  const meadow = new THREE.Mesh(
    new THREE.CylinderGeometry(52, 52, 0.25, 32),
    new THREE.MeshStandardMaterial({ map: tiledTexture(grassTexture(), 12, 12), roughness: 0.9 }),
  );
  meadow.position.y = 0.05;
  meadow.receiveShadow = true;
  scene.add(meadow);

  // Platforms: boxes with a thin top plate whose texture carries the studs
  // (drawn, not geometry — hundreds of tiny stud cylinders stall software
  // rasterizers). See world/textures.js studTopTexture.
  const platformMeshes = new Map();
  const topMat = {
    forest: new THREE.MeshStandardMaterial({ map: grassTopTexture(), roughness: 0.85 }),
    cliff: new THREE.MeshStandardMaterial({ map: rockTopTexture(), roughness: 0.9 }),
    snow: new THREE.MeshStandardMaterial({ map: snowTopTexture(), roughness: 0.7 }),
    wood: new THREE.MeshStandardMaterial({ map: woodTopTexture(), roughness: 0.8 }),
  };
  for (const p of level.platforms) {
    p.baseX = p.x;
    p.baseZ = p.z;
    p.baseY = p.y;
    p.crumbleState = 'idle';
    p.standTime = 0;
    p.fallVel = 0;
    p.respawnAt = 0;
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), materialFor(p, mats));
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(p.w + 0.08, 0.12, p.d + 0.08),
      p.type === 'wood' ? topMat.wood : topMat[p.zone],
    );
    top.position.y = p.h / 2 + 0.02;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);
    // Moving platforms get a glowing edge so their motion reads at a glance.
    if (p.type === 'moving') {
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(p.w + 0.16, 0.1, p.d + 0.16),
        new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0e7490, emissiveIntensity: 0.9 }),
      );
      edge.position.y = -p.h / 2 + 0.05;
      group.add(edge);
    }
    if (p.type === 'crumble') {
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(p.w + 0.16, 0.1, p.d + 0.16),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0x92400e, emissiveIntensity: 0.9 }),
      );
      edge.position.y = -p.h / 2 + 0.05;
      group.add(edge);
    }
    if (p.type === 'summit') {
      const gold = new THREE.Mesh(
        new THREE.BoxGeometry(p.w + 0.2, 0.14, p.d + 0.2),
        new THREE.MeshStandardMaterial({ color: 0xf5c542, emissive: 0x8a6d00, emissiveIntensity: 0.7, metalness: 0.6, roughness: 0.3 }),
      );
      gold.position.y = p.h / 2 + 0.05;
      group.add(gold);
    }
    group.position.set(p.x, p.y, p.z);
    scene.add(group);
    platformMeshes.set(p.id, group);
  }

  // Lava hazard slabs with a flickering point light each.
  const lavaLights = [];
  for (const h of level.hazards) {
    const lava = new THREE.Mesh(new THREE.BoxGeometry(h.w, h.h, h.d), mats.lava);
    lava.position.set(h.x, h.y, h.z);
    scene.add(lava);
    const light = new THREE.PointLight(0xff5500, 60, 26, 1.8);
    light.position.set(h.x, h.y + 2.5, h.z);
    scene.add(light);
    lavaLights.push(light);
  }

  return {
    platformMeshes,
    update(dt, t, standingOn) {
      for (const p of level.platforms) {
        // Crumble platforms start shaking after the climber stands on them.
        if (p.type === 'crumble' && p.crumbleState === 'idle') {
          if (standingOn === p.id) {
            p.standTime += dt;
            if (p.standTime > 0.55) p.crumbleState = 'shaking';
          } else {
            p.standTime = 0;
          }
        }
        updatePlatform(p, t, dt);
        // Crumble shake: jitter the mesh while the platform is about to fall.
        const mesh = platformMeshes.get(p.id);
        if (!mesh) continue;
        mesh.position.set(p.x, p.y, p.z);
        if (p.type === 'crumble' && p.crumbleState === 'shaking') {
          mesh.position.x += (rand() - 0.5) * 0.12;
          mesh.position.z += (rand() - 0.5) * 0.12;
        }
      }
      for (let i = 0; i < lavaLights.length; i += 1) {
        lavaLights[i].intensity = 55 + Math.sin(t * 7 + i * 2.4) * 14;
      }
    },
  };
}
