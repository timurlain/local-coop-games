// Draws "Najdi střelce" (spec 2026-09-27-diktator-atentat-design §6), 960 × 540, y down. Owns its canvas state
// (save/restore). Puppets reuse the render/puppet rig; only the accessories and colours are built here, from the
// scene's people.

import { cs } from '../../../../shared/i18n/cs';
import { BONES, FIGURE_HEIGHT, solvePuppet, type Face, type PuppetPose } from '../../render/puppet/skeleton';
import { drawPuppet } from '../../render/puppet/draw';
import { POSES } from '../../render/puppet/poses';
import { LOOKS, type Look } from '../../render/puppet/looks';
import {
  depthScale, GROUND_FAR, PLATFORM, personUnderGlass, SPOT_H, SPOT_W,
  type SpotPerson, type SpotScarf, type SpotState, type SpotWeapon,
} from './logic';

const RAD = Math.PI / 180;
const LINE = '#120c07';
/** Puppet world units → scene units: a standing figure is ~95 units tall (same convention as the palace stage). */
const PUPPET_SCALE = 95 / FIGURE_HEIGHT;

const T = cs.diktator.atentat;

function puppetAt(ctx: CanvasRenderingContext2D, x: number, ground: number, scale: number, facing: 1 | -1, draw: () => void): void {
  ctx.save();
  ctx.transform(PUPPET_SCALE * scale * facing, 0, 0, -PUPPET_SCALE * scale, x, ground);
  draw();
  ctx.restore();
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

const MARKET_COATS: readonly string[] = ['#7b5a3a', '#6e6e64', '#2c3a55', '#5d6b4c', '#7a2430'];
const MESS_COATS: readonly string[] = ['#4a5a3a', '#56613f', '#3f4a30', '#5f6a45', '#465235'];
const SCARF_COLOR: Record<Exclude<SpotScarf, 'none'>, string> = { red: '#a8202a', blue: '#2c4a7a', green: '#2f6a3a', yellow: '#c9a44a' };
const BAG_COLOR = '#6b4a2a';

/** Builds the puppet look for one person from the place's coat palette plus their clue accessories. */
function personLook(p: SpotPerson, place: SpotState['place']): Look {
  const palette = place === 'dustojnici' ? MESS_COATS : MARKET_COATS;
  const coat = palette[p.coat % palette.length];
  const look: Look = {
    coat,
    trim: place === 'dustojnici' ? '#b8963f' : '#cfc2a4',
    legs: place === 'dustojnici' ? '#3a4530' : '#4a3c2c',
    boots: '#231a12',
    hat: p.hat,
    hatColor: coat,
    scarf: p.scarf === 'none' ? undefined : SCARF_COLOR[p.scarf],
    glasses: p.glasses || undefined,
    bag: p.bag ? BAG_COLOR : undefined,
    prop: !p.handInCoat && p.carry !== 'none' ? p.carry : undefined,
  };
  return look;
}

/** The pose for a walking/standing person (not the ending overrides), before the glance head-turn is added. */
function basePose(p: SpotPerson, t: number): PuppetPose {
  if (p.handInCoat) return p.standing ? POSES.handInCoat(t) : POSES.handInCoatWalk(t);
  if (p.standing) return p.id % 3 === 0 ? POSES.talk(t) : POSES.stand(t);
  return POSES.walk(t);
}

function poseFor(p: SpotPerson, t: number): PuppetPose {
  const pose = basePose(p, t);
  return p.glancing ? { ...pose, head: (pose.head ?? 0) + 24 } : pose;
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, big: boolean): void {
  ctx.save();
  ctx.font = `${big ? 'bold 15px' : '10px'} Georgia, serif`;
  const w = Math.max(30, text.length * (big ? 7.4 : 5) + 14);
  const h = big ? 30 : 18;
  const by = y - h - 12;
  ctx.fillStyle = '#f7f3e6';
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(x, by + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 4, by + h - 2);
  ctx.lineTo(x, by + h + 9);
  ctx.lineTo(x + 7, by + h - 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = LINE;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, by + h / 2 + 4);
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D, place: SpotState['place']): void {
  if (place === 'trziste') {
    ctx.fillStyle = '#e8c98a';
    ctx.fillRect(0, 0, SPOT_W, GROUND_FAR);
    // Tirana roofline: low box silhouettes and a minaret.
    ctx.fillStyle = '#8a6a55';
    for (let x = 0; x < SPOT_W; x += 90) ctx.fillRect(x, GROUND_FAR - 60 - (x % 3) * 8, 70, 60 + (x % 3) * 8);
    ctx.fillStyle = '#7a5a48';
    const mx = 470;
    ctx.fillRect(mx - 5, GROUND_FAR - 130, 10, 130);
    ctx.beginPath();
    ctx.arc(mx, GROUND_FAR - 130, 6, Math.PI, 0);
    ctx.fill();
    // Market stalls with striped awnings along the back.
    for (let x = 40; x < SPOT_W - 40; x += 140) {
      ctx.fillStyle = '#5a3e22';
      ctx.fillRect(x, GROUND_FAR - 40, 100, 40);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#a8202a' : '#e9e4d2';
        ctx.fillRect(x + i * 20, GROUND_FAR - 52, 20, 12);
      }
    }
    ctx.fillStyle = '#8a8272';
    ctx.fillRect(0, GROUND_FAR, SPOT_W, SPOT_H - GROUND_FAR);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    for (let x = -20; x < SPOT_W; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_FAR);
      ctx.lineTo(x + 30, SPOT_H);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#4a4438';
    ctx.fillRect(0, 0, SPOT_W, GROUND_FAR);
    ctx.strokeStyle = '#3a352a';
    ctx.lineWidth = 1;
    for (let x = 40; x < SPOT_W; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, GROUND_FAR);
      ctx.stroke();
    }
    // Flags.
    for (const x of [90, 300, 660, 870]) {
      ctx.strokeStyle = '#2a2018';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x, 90);
      ctx.stroke();
      ctx.fillStyle = '#8c2f2a';
      ctx.fillRect(x, 10, 26, 18);
    }
    // Long tables at the back.
    ctx.fillStyle = '#5a4028';
    ctx.fillRect(60, GROUND_FAR - 26, SPOT_W - 120, 10);
    ctx.fillStyle = '#efe4c4';
    ctx.fillRect(60, GROUND_FAR - 30, SPOT_W - 120, 4);
    ctx.fillStyle = '#6a5a3a';
    ctx.fillRect(0, GROUND_FAR, SPOT_W, SPOT_H - GROUND_FAR);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    for (let x = 0; x < SPOT_W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_FAR);
      ctx.lineTo(x, SPOT_H);
      ctx.stroke();
    }
  }
}

function drawPlatformAndZogu(ctx: CanvasRenderingContext2D, s: SpotState, t: number): void {
  ctx.fillStyle = '#6a5a44';
  ctx.fillRect(PLATFORM.left, 300, PLATFORM.right - PLATFORM.left, 30);
  ctx.fillStyle = '#8c2f2a';
  ctx.fillRect(PLATFORM.left, 300, PLATFORM.right - PLATFORM.left, 5);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(PLATFORM.left, 300, PLATFORM.right - PLATFORM.left, 30);
  const pose = Math.floor(t / 3) % 2 === 0 ? POSES.talk(t) : POSES.salute(t);
  puppetAt(ctx, s.zoguX, 300, 1.3, 1, () => drawPuppet(ctx, solvePuppet(pose), LOOKS.zogu, 'happy'));
}

const VLCEK_X0 = PLATFORM.left - 60;
const VLCEK_Y0 = 460;
const RUSH_SECONDS = 0.6;

/** How far into the 0.6 s rush/tackle the found ending is, clamped to [0, 1]; 1 means Vlček has landed on the
 * gunman — the moment both puppets drop low together. */
function rushProgress(s: SpotState): number {
  return Math.min(1, (s.t - s.endAt) / RUSH_SECONDS);
}

/** Vlček's ground y this frame: fixed at rest, sliding toward the gunman's own y during the rush/tackle. */
function vlcekY(s: SpotState): number {
  if (s.outcome === 'found') {
    const gunman = s.people.find((p) => p.gunman)!;
    return VLCEK_Y0 + (gunman.y - VLCEK_Y0) * rushProgress(s);
  }
  return VLCEK_Y0;
}

function drawVlcek(ctx: CanvasRenderingContext2D, s: SpotState, t: number): void {
  if (s.outcome === 'found') {
    const gunman = s.people.find((p) => p.gunman)!;
    const progress = rushProgress(s);
    const x = VLCEK_X0 + (gunman.x - VLCEK_X0) * progress;
    const y = vlcekY(s);
    const scale = depthScale(y) * 1.3;
    if (progress >= 1) {
      puppetAt(ctx, x, y, scale, gunman.x >= x ? 1 : -1, () => {
        ctx.save();
        ctx.rotate(-90 * RAD);
        drawPuppet(ctx, solvePuppet(POSES.bow(t)), LOOKS.velitel, 'furious');
        ctx.restore();
      });
    } else {
      puppetAt(ctx, x, y, scale, gunman.x >= x ? 1 : -1, () => drawPuppet(ctx, solvePuppet(POSES.walk(t)), LOOKS.velitel, 'furious'));
    }
    return;
  }
  puppetAt(ctx, VLCEK_X0, VLCEK_Y0, 1.3, 1, () => drawPuppet(ctx, solvePuppet(POSES.stand(t)), LOOKS.velitel, 'neutral'));
}

function drawCrowd(ctx: CanvasRenderingContext2D, s: SpotState, t: number): void {
  // Vlček is drawn inside this same y-sorted pass (fix wave item 10) so a nearer crowd member correctly overlaps him.
  const items: { y: number; draw: () => void }[] = s.people.map((p) => ({
    y: p.y,
    draw: () => {
      const look = personLook(p, s.place);
      if (s.outcome === 'found' && p.gunman) {
        const scale = depthScale(p.y) * 1.2;
        const fallen = rushProgress(s) >= 1;
        puppetAt(ctx, p.x, p.y, scale, p.dir, () => {
          if (fallen) {
            // Only once Vlček has landed on him does he go down — in sync with Vlček's own tackle.
            ctx.save();
            ctx.rotate(-90 * RAD);
            drawPuppet(ctx, solvePuppet(POSES.shocked(t)), look, 'shocked');
            ctx.restore();
          } else {
            drawPuppet(ctx, solvePuppet(POSES.shocked(t)), look, 'shocked');
          }
        });
        return;
      }
      const pose = s.outcome === 'missed' ? POSES.shocked(t) : poseFor(p, t);
      const scale = depthScale(p.y) * 1.2;
      puppetAt(ctx, p.x, p.y, scale, p.dir, () => drawPuppet(ctx, solvePuppet(pose), look, 'neutral'));
      if (p.protestUntil > s.t) {
        const lines = T.protests[s.place];
        drawBubble(ctx, p.x, p.y - 95 * scale, lines[p.id % lines.length], false);
      }
    },
  }));
  items.push({ y: vlcekY(s), draw: () => drawVlcek(ctx, s, t) });
  items.sort((a, b) => a.y - b.y);
  for (const item of items) item.draw();
}

function drawFuse(ctx: CanvasRenderingContext2D, s: SpotState): void {
  const x0 = 40, x1 = 920, y = 24;
  const frac = Math.max(0, Math.min(1, s.fuse / s.difficulty.seconds));
  const endX = x0 + (x1 - x0) * frac;
  ctx.strokeStyle = '#3a2a1a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(endX, y);
  ctx.stroke();
  const flick = 1.4 + 0.6 * Math.sin(s.t * 20);
  ctx.fillStyle = 'rgba(255,180,60,0.9)';
  circle(ctx, endX, y, 4 * flick, 'rgba(255,180,60,0.9)');
  circle(ctx, endX, y, 2, '#fff4d0');
  // A dark ink with a light outline (fix wave item 10): the previous cream-on-cream label was unreadable at the
  // market, whose sky is a similarly light colour.
  ctx.font = '11px Georgia, serif';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#fff4d0';
  ctx.strokeText(T.fuse, x0, y - 9);
  ctx.fillStyle = '#1a1410';
  ctx.fillText(T.fuse, x0, y - 9);
}

function drawGlass(ctx: CanvasRenderingContext2D, s: SpotState): void {
  const { x, y } = s.glass;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 34, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#c9a44a';
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#5a4020';
  ctx.beginPath();
  ctx.moveTo(x + 22, y + 22);
  ctx.lineTo(x + 44, y + 44);
  ctx.stroke();
  ctx.restore();
}

/** The hidden weapon's tell, drawn only in the close-up. `h` is roughly the front hand's position, in the
 * close-up's local (already scaled) space. */
function drawWeaponTell(ctx: CanvasRenderingContext2D, hx: number, hy: number, weapon: SpotWeapon): void {
  switch (weapon) {
    case 'newspaperPistol':
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(hx + 1, hy - 9);
      ctx.lineTo(hx + 9, hy - 9);
      ctx.stroke();
      break;
    case 'appleGrenade':
      circle(ctx, hx, hy - 6, 4.4, '#2f2f2f');
      ctx.strokeStyle = '#c9a44a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(hx, hy - 11, 2, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'bouquetBomb':
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + 5, hy - 9);
      ctx.stroke();
      circle(ctx, hx + 5, hy - 10, 1.4, '#e88a3a');
      break;
    case 'coatRevolver':
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(hx - 4, hy - 2, 8, 4);
      ctx.fillRect(hx + 2, hy - 5, 3, 5);
      break;
  }
}

export const CLOSEUP: Readonly<{ x: number; y: number; r: number }> = { x: 850, y: 150, r: 90 };
/** Local y (world units, feet at 0) of the base of the head / top of the neck — everything below is torso and
 * legs, everything above is the head. Puts the chin at the window's centre so the close-up frames the face and
 * shoulders together (spec §6, review round 1: previously the ground point put the whole head above the window). */
const CHEST_LOCAL_Y = BONES.thigh + BONES.shin + BONES.torso + BONES.neck;

/** The `ground` argument for `puppetAt` that centres the close-up window on the chin/collar at the given puppet
 * `scale`, so the head and chest both sit inside the circular clip. Pure — exported for the geometry test. */
export function closeupGround(scale: number): number {
  return CLOSEUP.y + PUPPET_SCALE * scale * CHEST_LOCAL_Y;
}

function drawCloseup(ctx: CanvasRenderingContext2D, s: SpotState, t: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(CLOSEUP.x, CLOSEUP.y, CLOSEUP.r, 0, Math.PI * 2);
  ctx.save();
  ctx.clip();
  const p = personUnderGlass(s);
  if (p) {
    ctx.fillStyle = '#f7f0d8';
    ctx.fillRect(CLOSEUP.x - CLOSEUP.r, CLOSEUP.y - CLOSEUP.r, CLOSEUP.r * 2, CLOSEUP.r * 2);
    const look = personLook(p, s.place);
    const face: Face = p.gunman ? (p.glancing ? 'grumpy' : 'neutral') : p.id % 2 === 0 ? 'neutral' : 'happy';
    const scale = 2.6;
    const ground = closeupGround(scale);
    puppetAt(ctx, CLOSEUP.x, ground, scale, 1, () => {
      const joints = solvePuppet(poseFor(p, t));
      drawPuppet(ctx, joints, look, face);
      if (p.gunman) drawWeaponTell(ctx, joints.armF.hand[0], joints.armF.hand[1], p.weapon!);
    });
  } else {
    ctx.fillStyle = 'rgba(20,15,10,0.55)';
    ctx.fillRect(CLOSEUP.x - CLOSEUP.r, CLOSEUP.y - CLOSEUP.r, CLOSEUP.r * 2, CLOSEUP.r * 2);
  }
  ctx.restore();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#c9a44a';
  ctx.stroke();
  ctx.restore();
}

function drawDroppedWeapon(ctx: CanvasRenderingContext2D, x: number, y: number, weapon: SpotWeapon, scale: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  switch (weapon) {
    case 'newspaperPistol':
      ctx.fillStyle = '#e9e4d2';
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(-11, -8, 22, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(-2, -12, 10, 4);
      break;
    case 'appleGrenade':
      circle(ctx, 10, -3, 5, '#2f2f2f');
      ctx.strokeStyle = '#c9a44a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(10, -9, 2.2, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'bouquetBomb': {
      const petals = ['#c8102e', '#f4f1e8', '#e6c94a'] as const;
      for (let i = 0; i < 3; i++) circle(ctx, -4 + i * 4, -8, 3, petals[i]);
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(6, 2);
      ctx.stroke();
      break;
    }
    case 'coatRevolver':
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(-6, -5, 12, 5);
      ctx.fillRect(2, -9, 3, 5);
      break;
  }
  ctx.restore();
}

function drawFoundEnding(ctx: CanvasRenderingContext2D, s: SpotState): void {
  const gunman = s.people.find((p) => p.gunman)!;
  if (s.t - s.endAt < RUSH_SECONDS) return;
  const k = depthScale(gunman.y);
  drawDroppedWeapon(ctx, gunman.x + 14 * k, gunman.y, gunman.weapon!, k);
  drawBubble(ctx, (gunman.x + VLCEK_X0) / 2, gunman.y - 60, T.thatsHim, true);
}

function drawMissedEnding(ctx: CanvasRenderingContext2D, s: SpotState): void {
  const gunman = s.people.find((p) => p.gunman)!;
  const k = depthScale(gunman.y);
  const progress = Math.min(1, (s.t - s.endAt) / 1.5);
  const gx = gunman.x, gy = gunman.y - 45 * k;
  ctx.save();
  for (const [dx, dy] of [[-9, -3], [11, 3]] as const) {
    ctx.fillStyle = `rgba(255,250,230,${0.85 * (1 - progress)})`;
    circle(ctx, gx + dx, gy + dy, 6 + 5 * progress, `rgba(255,250,230,${0.85 * (1 - progress)})`);
  }
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = `rgba(130,130,130,${0.45 * (1 - progress * 0.6)})`;
    circle(ctx, gx + i * 7 - 7, gy - 12 - i * 5, 6 + 12 * progress, `rgba(130,130,130,${0.45 * (1 - progress * 0.6)})`);
  }
  ctx.restore();
}

/** Draws the whole scene in its 960 × 540 logical space. Owns its canvas state. */
export function drawSpot(ctx: CanvasRenderingContext2D, s: SpotState, t: number): void {
  ctx.save();
  drawBackground(ctx, s.place);
  drawPlatformAndZogu(ctx, s, t);
  drawCrowd(ctx, s, t);
  drawFuse(ctx, s);
  drawGlass(ctx, s);
  drawCloseup(ctx, s, t);
  if (s.outcome === 'found') drawFoundEnding(ctx, s);
  if (s.outcome === 'missed') drawMissedEnding(ctx, s);
  ctx.restore();
}
