// Sky, sun, fog and lighting for SUMMIT BLOCKS: a warm late-afternoon sun over a
// cold blue mountain, so the climber and the summit flag glow against the shade.
import * as THREE from 'three';
import { mulberry32 } from './textures.js';

function skyShaderMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x2b5ea7) },
      mid: { value: new THREE.Color(0x7fb2e5) },
      horizon: { value: new THREE.Color(0xffc98a) },
      sunDir: { value: new THREE.Vector3(0.55, 0.42, 0.35).normalize() },
      sunColor: { value: new THREE.Color(0xfff2c0) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 top; uniform vec3 mid; uniform vec3 horizon;
      uniform vec3 sunDir; uniform vec3 sunColor;
      void main() {
        float h = clamp(vDir.y, -0.1, 1.0);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.25, h));
        col = mix(col, top, smoothstep(0.25, 0.8, h));
        float sunAmt = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 220.0);
        float halo = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 8.0);
        col += sunColor * (sunAmt * 1.6 + halo * 0.28);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

export function createSky(scene) {
  const dome = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 20), skyShaderMaterial());
  scene.add(dome);

  const sun = new THREE.DirectionalLight(0xffe3b0, 3.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 220;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(0x9fc4ff, 0x3d5a3a, 1.2);
  scene.add(hemi);

  scene.fog = new THREE.Fog(0xb8cfe8, 95, 300);

  // Drifting blocky clouds: clusters of white boxes.
  const rand = mulberry32(101);
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const clouds = [];
  for (let i = 0; i < 14; i += 1) {
    const group = new THREE.Group();
    const puffs = 3 + Math.floor(rand() * 3);
    for (let p = 0; p < puffs; p += 1) {
      const w = 6 + rand() * 10;
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2 + rand() * 1.6, 4 + rand() * 4), cloudMat);
      box.position.set((rand() - 0.5) * 14, (rand() - 0.5) * 1.5, (rand() - 0.5) * 8);
      group.add(box);
    }
    const angle = rand() * Math.PI * 2;
    const radius = 90 + rand() * 140;
    group.position.set(Math.cos(angle) * radius, 70 + rand() * 55, Math.sin(angle) * radius);
    group.userData.speed = 0.4 + rand() * 0.7;
    scene.add(group);
    clouds.push(group);
  }

  // Golden sun disc far away, so the sky has a visible light source.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(16, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff6cf, fog: false }),
  );
  sunDisc.position.set(230, 175, 145);
  sunDisc.lookAt(0, 40, 0);
  scene.add(sunDisc);

  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(30, 32),
    new THREE.MeshBasicMaterial({ color: 0xffdf8a, transparent: true, opacity: 0.28, fog: false }),
  );
  glow.position.set(229, 174, 144);
  glow.lookAt(0, 40, 0);
  scene.add(glow);

  return {
    sun,
    update(dt, t, playerPos) {
      // The shadow camera follows the climber so shadows stay crisp nearby.
      sun.position.set(playerPos.x + 55, playerPos.y + 70, playerPos.z + 45);
      sun.target.position.copy(playerPos);
      sun.target.updateMatrixWorld();
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > 240) cloud.position.x = -240;
      }
      // Gentle sun-disc shimmer.
      const s = 1 + Math.sin(t * 0.6) * 0.015;
      sunDisc.scale.set(s, s, 1);
    },
  };
}
