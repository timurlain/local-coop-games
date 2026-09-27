// Draws a puppet on a canvas in world units (y up). The caller sets the transform: origin at the figure's
// ground point, scale s, and y flipped (setTransform(s·facing, 0, 0, −s, x, groundY)). Because y is flipped,
// every ctx.rotate of a world angle uses the NEGATIVE angle.

import { BONES, type Face, type PuppetJoints } from './skeleton';
import type { Look } from './looks';
import type { Vec } from '../../../../shared/rig/kinematics';

const RAD = Math.PI / 180;
const SKIN = '#e2b98f';
const LINE = '#120c07';
const GREY: Partial<Look> & { shirt: string } = { coat: '#8d8d8d', trim: '#a6a6a6', legs: '#7a7a7a', boots: '#5c5c5c', hatColor: '#9a9a9a', shirt: '#b3b3b3' };

export interface DrawOptions {
  /** Plain grey puppet (the model without its colours). */
  readonly grey?: boolean;
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function capsule(ctx: CanvasRenderingContext2D, a: Vec, b: Vec, r: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

function limb(ctx: CanvasRenderingContext2D, a: Vec, b: Vec, r: number, color: string): void {
  capsule(ctx, a, b, r + 1.4, LINE);
  capsule(ctx, a, b, r, color);
}

function circle(ctx: CanvasRenderingContext2D, c: Vec, r: number, fill: string, line = true): void {
  ctx.beginPath();
  ctx.arc(c[0], c[1], r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (line) {
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = LINE;
    ctx.stroke();
  }
}

function inHeadFrame(ctx: CanvasRenderingContext2D, J: PuppetJoints, draw: () => void): void {
  ctx.save();
  ctx.translate(J.head[0], J.head[1]);
  ctx.rotate(-J.headTilt * RAD);
  draw();
  ctx.restore();
}

function drawHat(ctx: CanvasRenderingContext2D, J: PuppetJoints, L: Look): void {
  if (L.hat === 'none') return;
  const r = BONES.head;
  inHeadFrame(ctx, J, () => {
    ctx.fillStyle = L.hatColor;
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1.4;
    const path = new Path2D();
    switch (L.hat) {
      case 'kepi': path.rect(-r * 0.8, r * 0.55, r * 1.55, r * 0.75); break;
      case 'cap': path.ellipse(0, r * 0.85, r * 1.15, r * 0.45, 0, 0, Math.PI * 2); break;
      case 'plis': path.ellipse(0, r * 0.62, r * 0.95, r * 0.55, 0, 0, Math.PI); break;
      case 'fez':
        path.moveTo(-r * 0.7, r * 0.55); path.lineTo(-r * 0.55, r * 1.45); path.lineTo(r * 0.55, r * 1.45); path.lineTo(r * 0.7, r * 0.55); path.closePath();
        break;
      case 'borsalino':
        path.moveTo(-r * 1.15, r * 0.62); path.lineTo(r * 1.2, r * 0.62); path.lineTo(r * 0.7, r * 0.78);
        path.quadraticCurveTo(r * 0.75, r * 1.45, 0, r * 1.35); path.quadraticCurveTo(-r * 0.8, r * 1.45, -r * 0.7, r * 0.78); path.closePath();
        break;
      case 'tophat': path.rect(-r * 0.7, r * 0.6, r * 1.4, r * 1.3); path.rect(-r * 1.1, r * 0.55, r * 2.2, r * 0.18); break;
      case 'sajkaca': path.moveTo(-r * 0.95, r * 0.55); path.quadraticCurveTo(0, r * 1.5, r * 0.95, r * 0.55); path.closePath(); break;
      case 'bun': path.ellipse(-r * 0.05, r * 0.45, r * 0.95, r * 0.6, 0, 0, Math.PI); path.ellipse(-r * 0.85, r * 0.35, r * 0.42, r * 0.42, 0, 0, Math.PI * 2); break;
    }
    ctx.fill(path);
    ctx.stroke(path);
    if (L.hat === 'kepi' || L.hat === 'cap') {
      ctx.fillStyle = '#1a140d';
      ctx.fillRect(r * 0.1, r * 0.42, r * 1.05, r * 0.16);
      ctx.fillStyle = L.trim;
      ctx.fillRect(-r * 0.7, r * 0.6, r * 1.4, r * 0.12);
    }
    if (L.hat === 'fez') {
      ctx.strokeStyle = '#1a140d';
      ctx.beginPath(); ctx.moveTo(0, r * 1.45); ctx.quadraticCurveTo(-r * 0.7, r * 1.3, -r * 0.6, r * 0.8); ctx.stroke();
    }
  });
}

function drawFace(ctx: CanvasRenderingContext2D, J: PuppetJoints, L: Look, face: Face): void {
  const r = BONES.head;
  inHeadFrame(ctx, J, () => {
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.fillStyle = shade(SKIN, 0.9);
    ctx.beginPath(); ctx.ellipse(r * 0.98, -r * 0.05, r * 0.2, r * 0.17, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    for (const [ex, ey, s] of [[r * 0.55, r * 0.22, 1], [r * 0.05, r * 0.2, 0.8]] as const) {
      ctx.fillStyle = LINE;
      if (face === 'ecstatic') {
        ctx.beginPath(); ctx.arc(ex, ey - 1, 2.6 * s, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      } else if (face === 'shocked') {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 3.2 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = LINE; ctx.beginPath(); ctx.arc(ex + 0.5, ey, 1.2 * s, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(ex, ey, 1.8 * s, 0, Math.PI * 2); ctx.fill();
      }
      const tilt = face === 'furious' ? -0.55 : face === 'grumpy' ? -0.3 : face === 'ecstatic' ? 0.25 : face === 'happy' ? 0.12 : face === 'shocked' ? 0.35 : 0;
      const by = ey + 5 + (face === 'ecstatic' ? 1.5 : face === 'shocked' ? 2.5 : 0);
      ctx.beginPath(); ctx.moveTo(ex - 3.2 * s, by - tilt * 3); ctx.lineTo(ex + 3.2 * s, by + tilt * 3); ctx.stroke();
    }
    const mx = r * 0.45, my = -r * 0.5;
    ctx.beginPath();
    if (face === 'shocked') {
      ctx.fillStyle = '#5a1f1a'; ctx.ellipse(mx, my - 1, 2.2, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (J.mouthOpen || face === 'furious') {
      ctx.fillStyle = '#5a1f1a'; ctx.ellipse(mx, my, 3.4, face === 'furious' ? 4 : 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (face === 'ecstatic' || face === 'happy') {
      ctx.arc(mx, my + 3.5, face === 'ecstatic' ? 5 : 4, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    } else if (face === 'grumpy') {
      ctx.arc(mx, my - 4, 4, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
    } else {
      ctx.moveTo(mx - 3.5, my); ctx.lineTo(mx + 3.5, my); ctx.stroke();
    }
    if (L.moustache) { ctx.fillStyle = '#2a1b12'; ctx.beginPath(); ctx.ellipse(r * 0.62, -r * 0.3, r * 0.42, r * 0.13, -0.1, 0, Math.PI * 2); ctx.fill(); }
    if (L.thinMoustache) { ctx.fillStyle = '#1a120c'; ctx.fillRect(r * 0.32, -r * 0.33, r * 0.6, 1.4); }
    if (L.monocle) {
      ctx.strokeStyle = '#c9a44a'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(r * 0.55, r * 0.22, 4.2, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.55, r * 0.22 - 4.2); ctx.quadraticCurveTo(r * 0.2, -r * 0.8, -r * 0.1, -r * 1.05); ctx.stroke();
    }
    if (face === 'furious') { ctx.fillStyle = 'rgba(200,40,30,0.18)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); }
  });
}

function drawProp(ctx: CanvasRenderingContext2D, J: PuppetJoints): void {
  const h = J.armF.hand;
  switch (J.prop) {
    case 'glass':
      ctx.fillStyle = 'rgba(230,220,180,0.85)'; ctx.strokeStyle = LINE; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(h[0] - 3, h[1] + 9); ctx.lineTo(h[0] + 3, h[1] + 9); ctx.lineTo(h[0] + 1, h[1] + 2); ctx.lineTo(h[0] - 1, h[1] + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    case 'thumb': {
      limb(ctx, [h[0], h[1] + 1], [h[0] - 0.5, h[1] + 5.5], 1.3, SKIN);
      break;
    }
    case 'finger': {
      // the index finger continues the forearm's direction
      const dx = h[0] - J.armF.el[0], dy = h[1] - J.armF.el[1];
      const len = Math.hypot(dx, dy) || 1;
      limb(ctx, h, [h[0] + (dx / len) * 7, h[1] + (dy / len) * 7], 1.2, SKIN);
      break;
    }
    case 'flagIT':
    case 'flagYU': {
      const top: Vec = [h[0] + 1, h[1] + 26];
      limb(ctx, [h[0], h[1] - 4], top, 0.9, '#6b4a2a');
      const fw = 13, fh = 9, fx = top[0], fy = top[1] - fh;
      const cols = J.prop === 'flagIT' ? ['#1f8a3b', '#f4f1e8', '#c8102e'] : ['#1d3f8f', '#f4f1e8', '#c8102e'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = cols[i];
        if (J.prop === 'flagIT') ctx.fillRect(fx + (fw / 3) * i, fy, fw / 3 + 0.2, fh);
        else ctx.fillRect(fx, fy + fh - (fh / 3) * (i + 1), fw, fh / 3 + 0.2);
      }
      ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.strokeRect(fx, fy, fw, fh);
      break;
    }
    case 'club': {
      const a = Math.atan2(h[0] - J.armF.el[0], h[1] - J.armF.el[1]);
      limb(ctx, h, [h[0] + Math.sin(a) * 18, h[1] + Math.cos(a) * 18], 2.4, '#6b4a2a');
      break;
    }
    case null:
      break;
  }
}

/** Draws one puppet. `face` is the mood's face; a pose's own `face` (e.g. startled) wins. */
export function drawPuppet(ctx: CanvasRenderingContext2D, joints: PuppetJoints, look: Look, face: Face, opts: DrawOptions = {}): void {
  const L: Look = opts.grey ? { ...look, ...GREY } : look;
  const J: PuppetJoints = !joints.prop && look.prop ? { ...joints, prop: look.prop } : joints;
  const skin = opts.grey ? '#c9c9c9' : SKIN;
  const back = (c: string) => shade(c, 0.78);

  if (!L.dress) {
    limb(ctx, J.hip, J.legB.kn, 4.6, back(L.legs)); limb(ctx, J.legB.kn, J.legB.foot, 4.2, back(L.legs));
    ctx.fillStyle = back(L.boots); ctx.beginPath(); ctx.ellipse(J.legB.foot[0] + 2.5, J.legB.foot[1] + 1.5, 5.5, 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  limb(ctx, J.shoulder, J.armB.el, 3.8, back(L.coat)); limb(ctx, J.armB.el, J.armB.hand, 3.4, back(L.coat));
  circle(ctx, J.armB.hand, 3.6, back(opts.grey ? '#bdbdbd' : SKIN));

  // torso: a rounded coat from hip to shoulders, rotated with the lean (negative angle, y is flipped)
  ctx.save();
  ctx.translate(J.hip[0], J.hip[1]);
  ctx.rotate(-J.lean * RAD);
  const w = L.belly ? 13 : L.dress ? 9 : 11;
  const T = BONES.torso;
  const body = new Path2D();
  body.moveTo(-w, -4); body.lineTo(w + (L.belly ? 3 : 0), -4);
  body.quadraticCurveTo(w + (L.belly ? 7 : 2), T * 0.45, w - 1, T * 0.92);
  body.quadraticCurveTo(0, T * 1.02, -w + 1, T * 0.92);
  body.quadraticCurveTo(-w - 2, T * 0.45, -w, -4);
  ctx.fillStyle = L.coat; ctx.fill(body); ctx.lineWidth = 1.4; ctx.strokeStyle = LINE; ctx.stroke(body);
  if (L.shirt) { ctx.fillStyle = L.shirt; ctx.fillRect(1, T * 0.35, 5, T * 0.55); }
  if (L.sash && !opts.grey) {
    ctx.save(); ctx.translate(0, T * 0.55); ctx.rotate(0.75);
    L.sash.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(-16, -3 + i * 2, 32, 2); });
    ctx.restore();
  }
  if (L.dress) { ctx.fillStyle = L.trim; ctx.beginPath(); ctx.ellipse(0, T * 0.93, 8, 3.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.stroke(); }
  else { ctx.fillStyle = L.trim; ctx.fillRect(-w + 1, T * 0.28, w * 2 - 2, 2.2); }
  if (L.hat === 'kepi' || L.hat === 'cap') { ctx.fillStyle = L.trim; ctx.fillRect(w - 5, T * 0.86, 4, 2); ctx.fillRect(-w + 1, T * 0.86, 4, 2); }
  ctx.restore();

  if (L.dress) {
    const g = Math.min(J.legF.foot[1], J.legB.foot[1]);
    const x = J.hip[0], y = J.hip[1];
    const skirt = new Path2D();
    skirt.moveTo(x - 10, y + 3); skirt.lineTo(x + 10, y + 3);
    skirt.quadraticCurveTo(x + 15, y - 12, x + 20, g); skirt.quadraticCurveTo(x, g - 2, x - 20, g); skirt.quadraticCurveTo(x - 15, y - 12, x - 10, y + 3);
    ctx.fillStyle = L.coat; ctx.fill(skirt); ctx.lineWidth = 1.4; ctx.strokeStyle = LINE; ctx.stroke(skirt);
    ctx.strokeStyle = shade(L.coat, 1.5); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x - 8, g + 1); ctx.moveTo(x + 5, y); ctx.lineTo(x + 10, g + 1); ctx.stroke();
  } else {
    limb(ctx, J.hip, J.legF.kn, 4.8, L.legs); limb(ctx, J.legF.kn, J.legF.foot, 4.4, L.legs);
    ctx.fillStyle = L.boots; ctx.beginPath(); ctx.ellipse(J.legF.foot[0] + 2.5, J.legF.foot[1] + 1.5, 5.8, 3.2, 0, 0, Math.PI * 2); ctx.fill();
  }

  circle(ctx, J.neck, 4, skin);
  circle(ctx, J.head, BONES.head, skin);
  inHeadFrame(ctx, J, () => circle(ctx, [-BONES.head * 0.62, -BONES.head * 0.12], 2.6, shade(opts.grey ? '#c9c9c9' : SKIN, 0.9)));
  drawFace(ctx, J, L, J.face ?? face);
  drawHat(ctx, J, L);

  limb(ctx, J.shoulder, J.armF.el, 4, L.coat); limb(ctx, J.armF.el, J.armF.hand, 3.6, L.coat);
  drawProp(ctx, J);
  circle(ctx, J.armF.hand, 3.8, skin);
}
