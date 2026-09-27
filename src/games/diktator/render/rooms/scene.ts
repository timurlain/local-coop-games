// One palace room as a stage (spec §5.1): wall, windows, floor and furniture from the room's style, Zog's
// portrait reacting to the mood, the room's special object (the rebels' map, the gold, the seal, the plane),
// the room's people on the right (count = strength, pose = mood; unknown mood = grey figures and a "?"),
// and the visiting heroes on the left. Stage units 480 × 200, y down; the caller scales the context.

import { FIGURE_HEIGHT, solvePuppet } from '../puppet/skeleton';
import { drawPuppet } from '../puppet/draw';
import { LOOKS } from '../puppet/looks';
import { POSES, faceForMood, poseForMood } from '../puppet/poses';
import type { CrowdView, RoomView } from '../../ui/palace-view';
import { crowdSlots, FLOOR_Y, STAGE_H, STAGE_W } from './crowd';
import { portraitFor } from './portrait';
import { ROOM_STYLES, type Furniture, type RoomStyle } from './styles';

/** Puppet world units → stage units: a standing figure is ~95 stage units tall. */
const PUPPET_SCALE = 95 / FIGURE_HEIGHT;
const INK = '#120c07';

function puppetAt(ctx: CanvasRenderingContext2D, x: number, ground: number, scale: number, facing: 1 | -1, draw: () => void): void {
  ctx.save();
  ctx.transform(PUPPET_SCALE * scale * facing, 0, 0, -PUPPET_SCALE * scale, x, ground);
  draw();
  ctx.restore();
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x, y, w, h);
}

function drawBackground(ctx: CanvasRenderingContext2D, st: RoomStyle): void {
  ctx.fillStyle = st.wall;
  ctx.fillRect(0, 0, STAGE_W, FLOOR_Y);
  ctx.fillStyle = st.wainscot;
  ctx.fillRect(0, FLOOR_Y - 34, STAGE_W, 34);
  ctx.fillStyle = st.accent;
  ctx.fillRect(0, FLOOR_Y - 35, STAGE_W, 1.5);
  ctx.fillRect(0, 14, STAGE_W, 1.5);
  ctx.fillStyle = st.floor;
  ctx.fillRect(0, FLOOR_Y, STAGE_W, STAGE_H - FLOOR_Y);
  for (let x = 0; x < STAGE_W; x += 30) {
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, FLOOR_Y); ctx.lineTo(x - 16, STAGE_H); ctx.stroke();
  }
  for (let i = 0; i < st.windows; i++) {
    const x = 60 + i * 150;
    ctx.fillStyle = '#9fb4c6';
    ctx.beginPath(); ctx.moveTo(x, 110); ctx.lineTo(x, 50); ctx.arc(x + 20, 50, 20, Math.PI, 0); ctx.lineTo(x + 40, 110); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = st.accent; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 20, 30); ctx.lineTo(x + 20, 110); ctx.moveTo(x, 75); ctx.lineTo(x + 40, 75);
    ctx.strokeStyle = st.accent; ctx.lineWidth = 2; ctx.stroke();
  }
}

function drawFurniture(ctx: CanvasRenderingContext2D, f: Furniture, st: RoomStyle, t: number): void {
  const x = f.x;
  const y = FLOOR_Y;
  switch (f.kind) {
    case 'throne':
      box(ctx, x - 22, y - 70, 44, 70, '#7a1f24');
      box(ctx, x - 26, y - 30, 52, 8, st.accent);
      ctx.fillStyle = st.accent; ctx.beginPath(); ctx.moveTo(x - 22, y - 70); ctx.lineTo(x, y - 86); ctx.lineTo(x + 22, y - 70); ctx.fill();
      break;
    case 'desk': box(ctx, x - 40, y - 34, 80, 8, '#6a4a2a'); box(ctx, x - 36, y - 26, 10, 26, '#5a3e22'); box(ctx, x + 26, y - 26, 10, 26, '#5a3e22'); break;
    case 'armchair': box(ctx, x - 16, y - 40, 32, 24, '#6e4a6e'); box(ctx, x - 20, y - 18, 40, 18, '#5d3d5d'); break;
    case 'teaTable': box(ctx, x - 14, y - 22, 28, 4, '#6a4a2a'); box(ctx, x - 2, y - 18, 4, 18, '#5a3e22'); break;
    case 'mapTable':
      box(ctx, x - 45, y - 30, 90, 6, '#6a4a2a'); box(ctx, x - 40, y - 24, 6, 24, '#5a3e22'); box(ctx, x + 34, y - 24, 6, 24, '#5a3e22');
      ctx.fillStyle = '#d8c9a0'; ctx.fillRect(x - 38, y - 33, 76, 3);
      break;
    case 'bench': box(ctx, x - 50, y - 20, 100, 6, '#6e5234'); box(ctx, x - 46, y - 14, 5, 14, '#5a4028'); box(ctx, x + 41, y - 14, 5, 14, '#5a4028'); break;
    case 'stove': box(ctx, x - 18, y - 50, 36, 50, '#8a4a36'); ctx.fillStyle = `rgba(255,160,60,${0.5 + 0.3 * Math.sin(t * 6)})`; ctx.fillRect(x - 8, y - 20, 16, 10); break;
    case 'sofa': box(ctx, x - 45, y - 34, 90, 16, '#7a2430'); box(ctx, x - 48, y - 18, 96, 18, '#6a1f28'); break;
    case 'fireplace':
      box(ctx, x - 28, y - 62, 56, 62, '#6a5a4a'); ctx.fillStyle = '#1a120c'; ctx.fillRect(x - 16, y - 34, 32, 34);
      ctx.fillStyle = `rgba(255,150,50,${0.55 + 0.35 * Math.sin(t * 7)})`; ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.quadraticCurveTo(x, y - 26, x + 10, y); ctx.fill();
      break;
    case 'rifleRack':
      box(ctx, x - 30, y - 80, 60, 6, '#5a3e22');
      for (let i = 0; i < 5; i++) { ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 22 + i * 11, y - 76); ctx.lineTo(x - 22 + i * 11, y - 10); ctx.stroke(); }
      break;
    case 'roundTable':
      ctx.fillStyle = '#6a4a2a'; ctx.beginPath(); ctx.ellipse(x, y - 26, 40, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
      box(ctx, x - 3, y - 26, 6, 26, '#5a3e22');
      break;
    case 'safe': box(ctx, x - 24, y - 56, 48, 56, '#3a3a40'); ctx.fillStyle = st.accent; ctx.beginPath(); ctx.arc(x, y - 30, 7, 0, Math.PI * 2); ctx.fill(); break;
    case 'bookshelf':
      box(ctx, x - 28, y - 110, 56, 110, '#4a3020');
      for (let r = 0; r < 4; r++) for (let b = 0; b < 7; b++) { ctx.fillStyle = ['#7a2430', '#2f4a6a', '#6a5a2a', '#3a5a3a'][(r + b) % 4]; ctx.fillRect(x - 24 + b * 7, y - 104 + r * 26, 5, 20); }
      break;
    case 'familyPhotos':
      // Oval portraits and one family group in gold frames, sepia prints (Zog's mother keeps the family on her wall).
      for (const [dx, dy, w, h, oval, heads] of [
        [-34, 44, 18, 24, true, 1], [-10, 36, 24, 30, false, 1], [20, 46, 18, 22, true, 1], [-20, 82, 44, 24, false, 3],
      ] as const) {
        const cx = x + dx + w / 2;
        const cy = dy + h / 2;
        ctx.fillStyle = st.accent;
        ctx.beginPath();
        if (oval) ctx.ellipse(cx, cy, w / 2 + 2, h / 2 + 2, 0, 0, Math.PI * 2); else ctx.rect(x + dx - 2, dy - 2, w + 4, h + 4);
        ctx.fill();
        ctx.fillStyle = '#c8b48a';
        ctx.beginPath();
        if (oval) ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2); else ctx.rect(x + dx, dy, w, h);
        ctx.fill();
        ctx.fillStyle = '#5a4632';
        for (let i = 0; i < heads; i++) {
          const hx = x + dx + (w * (i + 1)) / (heads + 1);
          const r = Math.min(w / (heads * 4), h / 6);
          ctx.beginPath(); ctx.arc(hx, dy + h * 0.42, r, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(hx, dy + h, r * 1.9, r * 1.6, 0, Math.PI, 0); ctx.fill();
        }
      }
      break;
    case 'toyChest': box(ctx, x - 22, y - 26, 44, 26, '#8a5a2a'); ctx.fillStyle = st.accent; ctx.fillRect(x - 22, y - 16, 44, 3); break;
    case 'rockingHorse':
      ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 4, 26, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      box(ctx, x - 18, y - 36, 36, 12, '#c0a070'); box(ctx, x + 14, y - 50, 10, 16, '#c0a070');
      break;
    case 'column': box(ctx, x - 10, 20, 20, FLOOR_Y - 20, '#d8ccb0'); box(ctx, x - 14, 14, 28, 8, '#cfc2a4'); break;
    case 'fountain':
      ctx.fillStyle = '#b9ad90'; ctx.beginPath(); ctx.ellipse(x, y - 8, 46, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.strokeStyle = `rgba(160,200,230,${0.6 + 0.3 * Math.sin(t * 5)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.quadraticCurveTo(x, y - 48, x + 20, y - 14); ctx.moveTo(x, y - 12); ctx.quadraticCurveTo(x, y - 48, x - 20, y - 14); ctx.stroke();
      break;
  }
}

function drawPortrait(ctx: CanvasRenderingContext2D, st: RoomStyle, mood: number | null): void {
  const p = portraitFor(mood);
  const x = 200, y = 58;
  ctx.save();
  ctx.translate(x, p.fallen ? y + 60 : y);
  ctx.rotate((p.tilt * Math.PI) / 180);
  if (p.turned) {
    box(ctx, -18, -24, 36, 48, '#6a5a44');
    ctx.strokeStyle = '#4a3c2c'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-18, -24); ctx.lineTo(18, 24); ctx.moveTo(18, -24); ctx.lineTo(-18, 24); ctx.stroke();
  } else {
    box(ctx, -18, -24, 36, 48, st.accent);
    box(ctx, -14, -20, 28, 40, '#3b3f33');
    ctx.fillStyle = '#e2b98f'; ctx.beginPath(); ctx.arc(0, -4, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5d6b4c'; ctx.fillRect(-7, -15, 14, 5); ctx.fillRect(-10, 6, 20, 14);
    ctx.fillStyle = '#2a1b12'; ctx.fillRect(-4, 0, 8, 2);
    if (p.defaced) { ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-14, -20); ctx.lineTo(14, 20); ctx.moveTo(14, -20); ctx.lineTo(-14, 20); ctx.stroke(); }
  }
  ctx.restore();
  if (p.laurel) {
    ctx.strokeStyle = '#6a9a3a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y + 2, 26, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke();
    ctx.strokeStyle = '#6a9a3a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y + 2, 26, Math.PI * 1.6, Math.PI * 0.4); ctx.stroke();
  }
  if (p.bunting) {
    const cols = ['#c8102e', '#111111'];
    for (let i = 0; i < 16; i++) { ctx.fillStyle = cols[i % 2]; ctx.beginPath(); ctx.moveTo(i * 30, 16); ctx.lineTo(i * 30 + 30, 16); ctx.lineTo(i * 30 + 15, 30); ctx.fill(); }
  }
  if (p.brokenChair) {
    ctx.save(); ctx.translate(360, FLOOR_Y - 6); ctx.rotate(1.2); box(ctx, -12, -3, 24, 5, '#6a4a2a'); ctx.restore();
    box(ctx, 380, FLOOR_Y - 10, 18, 4, '#6a4a2a');
  }
  if (p.barricade) {
    for (let i = 0; i < 3; i++) box(ctx, 420 + i * 12, FLOOR_Y - 40 + i * 6, 40, 8, '#5a3e22');
  }
}

function drawSpecial(ctx: CanvasRenderingContext2D, v: RoomView, st: RoomStyle, t: number): void {
  if (v.rebelFires !== null) {
    // the guardroom's wall map of the mountains, one campfire per point of rebel strength
    box(ctx, 300, 28, 150, 84, '#d8c9a0');
    ctx.fillStyle = '#8a6a4a';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(305 + i * 24, 108); ctx.lineTo(317 + i * 24, 60 + (i % 2) * 12); ctx.lineTo(329 + i * 24, 108); ctx.fill(); }
    for (let i = 0; i < v.rebelFires; i++) {
      const fx = 312 + (i % 5) * 28, fy = 100 - Math.floor(i / 5) * 30;
      ctx.fillStyle = `rgba(230,90,30,${0.7 + 0.3 * Math.sin(t * 8 + i)})`;
      ctx.beginPath(); ctx.moveTo(fx - 4, fy); ctx.quadraticCurveTo(fx, fy - 12 - Math.sin(t * 9 + i) * 2, fx + 4, fy); ctx.fill();
    }
    ctx.fillStyle = INK; ctx.font = '9px Georgia, serif'; ctx.fillText('Hory', 306, 40);
  }
  if (v.treasury !== null) {
    const h = Math.max(2, Math.min(70, v.treasury / 10));
    ctx.fillStyle = st.accent;
    ctx.beginPath(); ctx.moveTo(250, FLOOR_Y); ctx.quadraticCurveTo(300, FLOOR_Y - h * 2, 350, FLOOR_Y); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#f7e9b0'; ctx.font = '11px Georgia, serif';
    ctx.fillText(`${v.treasury.toLocaleString('cs-CZ')} tis.`, 262, FLOOR_Y - h - 6);
  }
  if (v.sealLying) {
    box(ctx, 290, FLOOR_Y - 46, 20, 12, '#6a4a2a');
    ctx.fillStyle = '#b01e24'; ctx.beginPath(); ctx.arc(300, FLOOR_Y - 50, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
  }
  if (v.plane) {
    ctx.fillStyle = '#cfd6dc'; ctx.fillRect(320, 60, 100, 14); ctx.fillRect(360, 44, 14, 46); ctx.fillRect(412, 54, 8, 26);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.strokeRect(320, 60, 100, 14);
  }
}

function drawCrowd(ctx: CanvasRenderingContext2D, crowd: CrowdView, t: number, xShift: number): void {
  const known = crowd.mood !== null;
  const mood = crowd.mood ?? 6;
  for (const slot of crowdSlots(crowd.count)) {
    const pose = poseForMood(mood)(t + slot.phase);
    puppetAt(ctx, slot.x + xShift, slot.ground, slot.scale, -1, () => drawPuppet(ctx, solvePuppet(pose), LOOKS[crowd.look], faceForMood(mood), { grey: !known }));
  }
  if (!known && crowd.count > 0) {
    ctx.fillStyle = 'rgba(21,16,10,0.35)'; ctx.fillRect(240, 20, 235, FLOOR_Y - 20);
    ctx.fillStyle = '#efe4c4'; ctx.font = '28px Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillText('?', 360, 60); ctx.textAlign = 'left';
  }
}

/** The envoys' salon: one foreign delegate per power, each with its own known/unknown mood — a lone unseen
 * power gets its own '?' overlay, unlike the home crowds which share one. */
function drawEnvoys(ctx: CanvasRenderingContext2D, crowds: readonly CrowdView[], t: number): void {
  crowds.forEach((c, i) => {
    const known = c.mood !== null;
    const mood = c.mood ?? 6;
    const x = 300 + i * 60;
    const pose = poseForMood(mood)(t + i * 0.7);
    puppetAt(ctx, x, FLOOR_Y, 1, -1, () => drawPuppet(ctx, solvePuppet(pose), LOOKS[c.look], faceForMood(mood), { grey: !known }));
    if (!known) {
      ctx.fillStyle = 'rgba(21,16,10,0.35)'; ctx.fillRect(x - 25, 20, 50, FLOOR_Y - 20);
      ctx.fillStyle = '#efe4c4'; ctx.font = '20px Georgia, serif'; ctx.textAlign = 'center';
      ctx.fillText('?', x, 60); ctx.textAlign = 'left';
    }
  });
}

/** Draws the room; heroes present stand on the left facing right. `t` is seconds (animation).
 * Owns its canvas state (save/restore, and the defaults below) so one room never leaks style into the next. */
export function drawRoom(ctx: CanvasRenderingContext2D, v: RoomView, t: number): void {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  const st = ROOM_STYLES[v.id];
  drawBackground(ctx, st);
  if (st.portrait) drawPortrait(ctx, st, v.portraitMood);
  for (const f of st.furniture) drawFurniture(ctx, f, st, t);
  drawSpecial(ctx, v, st, t);
  if (v.layout === 'envoys') drawEnvoys(ctx, v.crowds, t);
  else v.crowds.forEach((c, i) => drawCrowd(ctx, c, t, i * 12));
  if (v.resident) {
    puppetAt(ctx, 380, FLOOR_Y, 1, -1, () => drawPuppet(ctx, solvePuppet(POSES.stand(t)), LOOKS[v.resident!], 'neutral'));
  }
  v.heroes.forEach((h, i) => {
    const pose = POSES.stand(t);
    puppetAt(ctx, 90 + i * 55, FLOOR_Y, 1, 1, () => drawPuppet(ctx, solvePuppet(pose), LOOKS[h], 'neutral'));
  });
  ctx.fillStyle = '#efe4c4';
  ctx.font = '13px Georgia, serif';
  ctx.fillText(v.name, 10, 11);
  ctx.restore();
}
