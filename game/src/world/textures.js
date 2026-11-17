// Procedural canvas textures: every surface in SUMMIT BLOCKS is drawn from code,
// never a flat solid colour. Each texture carries noise, speckles and detail so
// the render stays sharp and readable when the screenshots are shrunk.
import * as THREE from 'three';

function canvasTexture(size, draw, repeat = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  return tex;
}

// Deterministic tiny PRNG so textures are identical on every run.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function speckle(ctx, size, rand, colors, count, minR, maxR) {
  for (let i = 0; i < count; i += 1) {
    const c = colors[Math.floor(rand() * colors.length)];
    ctx.fillStyle = c;
    const r = minR + rand() * (maxR - minR);
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function grassTexture() {
  return canvasTexture(256, (ctx, s) => {
    const rand = mulberry32(11);
    ctx.fillStyle = '#4d9b3a';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rand, ['#3c7f2c', '#5cb545', '#6cc653', '#2f6b22'], 900, 1, 4);
    // Grass blades: short vertical strokes.
    for (let i = 0; i < 500; i += 1) {
      ctx.strokeStyle = ['#67c24e', '#3f8a2f', '#8edb6a'][Math.floor(rand() * 3)];
      ctx.lineWidth = 1.5;
      const x = rand() * s;
      const y = rand() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 4, y - 4 - rand() * 6);
      ctx.stroke();
    }
  });
}

export function rockTexture() {
  return canvasTexture(256, (ctx, s) => {
    const rand = mulberry32(23);
    ctx.fillStyle = '#8a8378';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rand, ['#6f685e', '#a39a8a', '#5c564e', '#b5ab99'], 1100, 1, 5);
    // Cracks: dark jagged lines.
    ctx.strokeStyle = '#4e483f';
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i += 1) {
      let x = rand() * s;
      let y = rand() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 5; j += 1) {
        x += (rand() - 0.5) * 40;
        y += (rand() - 0.5) * 40;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

export function snowTexture() {
  return canvasTexture(256, (ctx, s) => {
    const rand = mulberry32(37);
    ctx.fillStyle = '#eef4fb';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rand, ['#ffffff', '#dbe9f7', '#c9dcf2', '#f7fbff'], 800, 1, 3);
    // Sparkles: tiny bright crosses.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    for (let i = 0; i < 120; i += 1) {
      const x = rand() * s;
      const y = rand() * s;
      ctx.beginPath();
      ctx.moveTo(x - 2, y);
      ctx.lineTo(x + 2, y);
      ctx.moveTo(x, y - 2);
      ctx.lineTo(x, y + 2);
      ctx.stroke();
    }
  });
}

export function woodTexture() {
  return canvasTexture(256, (ctx, s) => {
    const rand = mulberry32(51);
    ctx.fillStyle = '#9a6b3f';
    ctx.fillRect(0, 0, s, s);
    // Planks.
    for (let p = 0; p < 4; p += 1) {
      ctx.fillStyle = ['#8a5c31', '#a5713f', '#96683a', '#b07a45'][p];
      ctx.fillRect(0, p * 64, s, 62);
      ctx.fillStyle = '#5f3d1e';
      ctx.fillRect(0, p * 64 + 62, s, 2);
    }
    speckle(ctx, s, rand, ['#7a4e26', '#c08a4e'], 300, 1, 2);
    // Wood grain lines.
    ctx.strokeStyle = 'rgba(90, 55, 20, 0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 40; i += 1) {
      const y = rand() * s;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(s * 0.3, y + (rand() - 0.5) * 8, s * 0.7, y + (rand() - 0.5) * 8, s, y);
      ctx.stroke();
    }
  });
}

// Studded top plates: the base surface plus a grid of round studs drawn as
// shaded circles (bright top-left, dark bottom-right), so a platform reads
// as a block with studs without spending geometry on 700+ tiny cylinders —
// software rasterizers choke on that many small triangles.
function addStuds(ctx, s, cols = 4) {
  const cell = s / cols;
  for (let cx = 0; cx < cols; cx += 1) {
    for (let cy = 0; cy < cols; cy += 1) {
      const x = (cx + 0.5) * cell;
      const y = (cy + 0.5) * cell;
      const r = cell * 0.3;
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.85)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.25)');
      g.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function studTopTexture(baseDraw) {
  return canvasTexture(256, (ctx, s) => {
    baseDraw(ctx, s);
    addStuds(ctx, s);
  });
}

export function grassTopTexture() {
  return studTopTexture((ctx, s) => {
    const rand = mulberry32(11);
    ctx.fillStyle = '#4d9b3a';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rand, ['#3c7f2c', '#5cb545', '#6cc653', '#2f6b22'], 700, 1, 4);
  });
}

export function rockTopTexture() {
  return studTopTexture((ctx, s) => {
    const rand = mulberry32(23);
    ctx.fillStyle = '#8a8378';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rand, ['#6f685e', '#a39a8a', '#5c564e', '#b5ab99'], 800, 1, 5);
  });
}

export function snowTopTexture() {
  return studTopTexture((ctx, s) => {
    const rand = mulberry32(37);
    ctx.fillStyle = '#eef4fb';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rand, ['#ffffff', '#dbe9f7', '#c9dcf2'], 600, 1, 3);
  });
}

export function woodTopTexture() {
  return studTopTexture((ctx, s) => {
    ctx.fillStyle = '#9a6b3f';
    ctx.fillRect(0, 0, s, s);
    for (let p = 0; p < 4; p += 1) {
      ctx.fillStyle = ['#8a5c31', '#a5713f', '#96683a', '#b07a45'][p];
      ctx.fillRect(0, p * 64, s, 62);
    }
  });
}

export function dirtTexture() {
  return canvasTexture(256, (ctx, s) => {
    const rand = mulberry32(67);
    ctx.fillStyle = '#7a5a38';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rand, ['#5f4225', '#96683f', '#4e3519', '#a97c4a'], 1000, 1, 4);
  });
}

export function lavaTexture() {
  return canvasTexture(256, (ctx, s) => {
    const rand = mulberry32(83);
    ctx.fillStyle = '#ff5a00';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rand, ['#ff8c1a', '#ffc21a', '#e63e00', '#ffd94d'], 700, 2, 8);
    ctx.strokeStyle = '#ff2e00';
    ctx.lineWidth = 3;
    for (let i = 0; i < 10; i += 1) {
      let x = rand() * s;
      let y = rand() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 4; j += 1) {
        x += (rand() - 0.5) * 50;
        y += (rand() - 0.5) * 50;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

// Blocky face for the climber: two eyes and a smile on the front of the head.
export function faceTexture() {
  return canvasTexture(128, (ctx, s) => {
    ctx.fillStyle = '#f2c184';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#1c1c22';
    // Eyes.
    ctx.fillRect(28, 48, 14, 22);
    ctx.fillRect(86, 48, 14, 22);
    // Smile.
    ctx.strokeStyle = '#1c1c22';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(64, 78, 20, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    // Cheeks.
    ctx.fillStyle = 'rgba(255, 110, 110, 0.55)';
    ctx.beginPath();
    ctx.arc(26, 82, 9, 0, Math.PI * 2);
    ctx.arc(102, 82, 9, 0, Math.PI * 2);
    ctx.fill();
  });
}
