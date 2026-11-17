// The blocky climber: a voxel avatar built from boxes (head with a face,
// torso, arms, legs, backpack). Walk swing, jump tuck, land squash and a
// dust puff on landing give every action visible feedback.
import * as THREE from 'three';
import { faceTexture, mulberry32 } from '../world/textures.js';
import {
  createBody, GRAVITY, JUMP_VELOCITY, WALK_SPEED, SPRINT_SPEED,
  PLAYER_HALF, resolveCollisions,
} from '../engine/physics.js';

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export function createPlayer(scene) {
  const skin = new THREE.MeshStandardMaterial({ color: 0xf2c184, roughness: 0.7 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xe23b3b, roughness: 0.7 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x27408b, roughness: 0.8 });
  const pack = new THREE.MeshStandardMaterial({ color: 0xf5c542, roughness: 0.7 });
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture(), roughness: 0.7 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x2f7d32, roughness: 0.8 });

  const group = new THREE.Group();
  const legL = box(0.26, 0.62, 0.3, pants, -0.17, 0.31, 0);
  const legR = box(0.26, 0.62, 0.3, pants, 0.17, 0.31, 0);
  const torso = box(0.72, 0.62, 0.4, shirt, 0, 0.93, 0);
  const armL = box(0.2, 0.58, 0.24, skin, -0.48, 0.95, 0);
  const armR = box(0.2, 0.58, 0.24, skin, 0.48, 0.95, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.52, 0.52), [
    skin, skin, capMat, skin, skin, faceMat,
  ]);
  head.position.set(0, 1.52, 0);
  head.castShadow = true;
  const backpack = box(0.5, 0.5, 0.2, pack, 0, 0.95, -0.3);
  group.add(legL, legR, torso, armL, armR, head, backpack);

  // Hat slot: blocky hats from the market sit on top of the head.
  const hatGroup = new THREE.Group();
  group.add(hatGroup);
  let currentHat = 'hat-none';
  function applyHat(id) {
    currentHat = id;
    while (hatGroup.children.length) hatGroup.remove(hatGroup.children[0]);
    const y = 1.52; // head centre
    if (id === 'hat-cap') {
      const green = new THREE.MeshStandardMaterial({ color: 0x2f7d32, roughness: 0.8 });
      hatGroup.add(box(0.6, 0.12, 0.56, green, 0, y + 0.3, 0));
      hatGroup.add(box(0.6, 0.05, 0.28, green, 0, y + 0.26, 0.38));
    } else if (id === 'hat-crown') {
      const gold = new THREE.MeshStandardMaterial({ color: 0xf5c542, metalness: 0.6, roughness: 0.3 });
      hatGroup.add(box(0.5, 0.2, 0.5, gold, 0, y + 0.34, 0));
      for (const dx of [-0.18, 0, 0.18]) hatGroup.add(box(0.1, 0.14, 0.1, gold, dx, y + 0.5, 0));
    } else if (id === 'hat-helmet') {
      const steel = new THREE.MeshStandardMaterial({ color: 0x9aa5b1, metalness: 0.7, roughness: 0.35 });
      hatGroup.add(box(0.66, 0.3, 0.62, steel, 0, y + 0.32, 0));
      hatGroup.add(box(0.66, 0.08, 0.2, steel, 0, y + 0.2, 0.36));
    } else if (id === 'hat-party') {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.3, 0.55, 4),
        new THREE.MeshStandardMaterial({ color: 0xe23bb0, roughness: 0.7 }),
      );
      cone.position.set(0, y + 0.55, 0);
      cone.rotation.y = Math.PI / 4;
      cone.castShadow = true;
      hatGroup.add(cone);
    }
  }

  // Pivot the limbs at the shoulder/hip so the swing reads as walking.
  legL.geometry.translate(0, -0.31, 0);
  legL.position.y = 0.62;
  legR.geometry.translate(0, -0.31, 0);
  legR.position.y = 0.62;
  armL.geometry.translate(0, -0.29, 0);
  armL.position.y = 1.24;
  armR.geometry.translate(0, -0.29, 0);
  armR.position.y = 1.24;

  scene.add(group);

  // Landing dust: a small pool of fading puffs. Seeded, never Math.random:
  // a landing during the fixed shot frames must puff identically every run.
  const dustRand = mulberry32(777);
  const puffMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
  const puffs = [];
  for (let i = 0; i < 10; i += 1) {
    const puff = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.22), puffMat.clone());
    puff.visible = false;
    scene.add(puff);
    puffs.push({ mesh: puff, life: 0, vx: 0, vy: 0, vz: 0 });
  }

  const body = createBody(0, 1.2, 47);
  let facing = 0;
  let walkPhase = 0;
  let squash = 0;
  let stepTimer = 0;
  let wasGround = false;
  let jumpHeld = false;
  let airJumps = 0;
  let doubleJump = false;

  function burstDust(x, y, z) {
    for (const p of puffs) {
      if (p.life > 0) continue;
      p.life = 0.5;
      p.mesh.visible = true;
      p.mesh.position.set(x + (dustRand() - 0.5) * 0.6, y + 0.1, z + (dustRand() - 0.5) * 0.6);
      p.vx = (dustRand() - 0.5) * 1.6;
      p.vy = 0.5 + dustRand() * 0.8;
      p.vz = (dustRand() - 0.5) * 1.6;
      p.mesh.material.opacity = 0.7;
    }
  }

  return {
    group,
    body,
    get pos() {
      return body.pos;
    },
    get height() {
      return Math.max(0, body.pos.y);
    },
    get onGround() {
      return body.onGround;
    },
    get ground() {
      return body.ground;
    },
    respawn(x, y, z) {
      body.pos.x = x;
      body.pos.y = y;
      body.pos.z = z;
      body.vel.x = 0;
      body.vel.y = 0;
      body.vel.z = 0;
      body.onGround = true;
      body.ground = null;
      body.groundType = 'static';
    },
    teleport(x, y, z) {
      this.respawn(x, y, z);
    },
    // Move with camera-relative WASD, jump, sprint, ice slide and wind push.
    // Returns { landed, fell } events for the main loop.
    update(dt, input, cameraYaw, platforms, wind) {
      // Carried by a moving platform the climber stood on last frame.
      if (body.ground && body.ground.type === 'moving') {
        body.pos.x += body.ground.deltaX || 0;
        body.pos.z += body.ground.deltaZ || 0;
      }
      const speed = input.sprint ? SPRINT_SPEED : WALK_SPEED;
      let mx = 0;
      let mz = 0;
      if (input.forward) { mx += -Math.sin(cameraYaw); mz += -Math.cos(cameraYaw); }
      if (input.back) { mx += Math.sin(cameraYaw); mz += Math.cos(cameraYaw); }
      if (input.left) { mx += -Math.cos(cameraYaw); mz += Math.sin(cameraYaw); }
      if (input.right) { mx += Math.cos(cameraYaw); mz += -Math.sin(cameraYaw); }
      const len = Math.hypot(mx, mz);
      if (len > 0) { mx /= len; mz /= len; }

      const ice = body.onGround && body.groundType === 'ice';
      const accel = body.onGround ? (ice ? 14 : 55) : 22;
      body.vel.x += mx * accel * dt;
      body.vel.z += mz * accel * dt;
      // Wind pushes the climber sideways in the snow zone.
      body.vel.x += wind.x * dt;
      body.vel.z += wind.z * dt;
      // Friction: high on rock/grass, almost none on ice.
      const damp = body.onGround ? (ice ? 0.4 : 11) : 0.12;
      const dampF = Math.max(0, 1 - damp * dt);
      if (len === 0) {
        body.vel.x *= dampF;
        body.vel.z *= dampF;
      }
      // Clamp horizontal speed.
      const hs = Math.hypot(body.vel.x, body.vel.z);
      const max = speed + (ice ? 1.5 : 0);
      if (hs > max) {
        body.vel.x *= max / hs;
        body.vel.z *= max / hs;
      }

      // Jump (edge-triggered, so holding Space does not bunny-hop). With the
      // Double Jump gear, a second jump is allowed mid-air.
      if (input.jump && !jumpHeld) {
        if (body.onGround) {
          body.vel.y = JUMP_VELOCITY;
          body.onGround = false;
          airJumps = 1;
        } else if (doubleJump && airJumps < 2) {
          body.vel.y = JUMP_VELOCITY * 0.92;
          airJumps = 2;
          burstDust(body.pos.x, body.pos.y + 0.4, body.pos.z);
        }
      }
      jumpHeld = input.jump;

      const prevFeetY = body.pos.y;
      body.vel.y -= GRAVITY * dt;
      body.pos.x += body.vel.x * dt;
      body.pos.y += body.vel.y * dt;
      body.pos.z += body.vel.z * dt;

      resolveCollisions(body, platforms, prevFeetY);
      if (body.onGround) airJumps = 0;

      const landed = body.onGround && !wasGround && body.vel.y === 0;
      if (landed) {
        squash = 0.14;
        burstDust(body.pos.x, body.pos.y, body.pos.z);
      }
      wasGround = body.onGround;

      // Face the movement direction.
      if (hs > 0.5) {
        const target = Math.atan2(body.vel.x, body.vel.z);
        let diff = target - facing;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        facing += diff * Math.min(1, dt * 12);
      }

      // Animate: walk swing, jump tuck, land squash.
      const moving = hs > 0.5 && body.onGround;
      let stepped = false;
      if (moving) {
        walkPhase += dt * hs * 1.6;
        stepTimer += dt;
        if (stepTimer > 0.34) {
          stepTimer = 0;
          stepped = true;
        }
      }
      const swing = moving ? Math.sin(walkPhase) * 0.7 : 0;
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
      armL.rotation.x = body.onGround ? -swing * 0.8 : -2.4;
      armR.rotation.x = body.onGround ? swing * 0.8 : -2.4;
      if (!body.onGround) {
        legL.rotation.x = 0.5;
        legR.rotation.x = -0.35;
      }
      if (squash > 0) {
        squash -= dt;
        const s = 1 - Math.max(0, squash) * 1.2;
        group.scale.set(1 + (1 - s) * 0.6, s, 1 + (1 - s) * 0.6);
      } else {
        group.scale.set(1, 1, 1);
      }
      group.position.set(body.pos.x, body.pos.y, body.pos.z);
      group.rotation.y = facing;

      // Dust puffs drift and fade.
      for (const p of puffs) {
        if (p.life <= 0) continue;
        p.life -= dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.mesh.material.opacity = Math.max(0, p.life * 1.4);
        p.mesh.scale.setScalar(1 + (0.5 - p.life) * 2);
        if (p.life <= 0) p.mesh.visible = false;
      }

      return { landed, stepped, fell: false };
    },
    get halfWidth() {
      return PLAYER_HALF;
    },
    get speed2d() {
      return Math.hypot(body.vel.x, body.vel.z);
    },
    // Market customisation: repaint the shirt, swap the hat, enable the
    // Double Jump gear.
    setSkin(hex) {
      shirt.color.set(hex);
    },
    getShirtColor() {
      return `#${shirt.color.getHexString()}`;
    },
    setHat(id) {
      applyHat(id);
    },
    getHat() {
      return currentHat;
    },
    getHatMeshCount() {
      return hatGroup.children.length;
    },
    setDoubleJump(v) {
      doubleJump = !!v;
    },
  };
}
