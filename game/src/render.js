// SHADOW LANTERN — all canvas drawing: the level, the vision cones, the
// player and guards, the HUD, the minimap, and the title / pause /
// win / lose screens. Nothing here touches game logic; it only reads it.
import {
  CANVAS_W, CANVAS_H, TILE, COLS, ROWS, ORIGIN_X, ORIGIN_Y, HUD_H,
  COLORS, VISION_RANGE,
} from './config.js';
import { tileAt, isShadowTile, isBushTile } from './levels.js';
import { visionConePolygon, pixelToTile } from './guards.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// --- The level ------------------------------------------------------------

export function drawWorld(ctx, game) {
  const level = game.level;
  // Floor: a faint checker so movement reads at a glance.
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const ch = tileAt(level, col, row);
      const x = ORIGIN_X + col * TILE;
      const y = ORIGIN_Y + row * TILE;
      const checker = (col + row) % 2 === 0;
      ctx.fillStyle = isShadowTile(ch) ? COLORS.shadow : (checker ? COLORS.floorA : COLORS.floorB);
      ctx.fillRect(x, y, TILE, TILE);
      if (isShadowTile(ch)) {
        ctx.strokeStyle = COLORS.shadowEdge;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);
        ctx.setLineDash([]);
      }
    }
  }

  // Walls with a lit top edge; crates; bushes; loot; exit.
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const ch = tileAt(level, col, row);
      const x = ORIGIN_X + col * TILE;
      const y = ORIGIN_Y + row * TILE;
      if (ch === '#') {
        ctx.fillStyle = COLORS.wall;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = COLORS.wallTop;
        ctx.fillRect(x, y, TILE, 5);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(x, y + 5, TILE, 2);
      } else if (ch === 'C') {
        ctx.fillStyle = COLORS.crate;
        ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
        ctx.strokeStyle = COLORS.crateEdge;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8);
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 4);
        ctx.lineTo(x + TILE - 4, y + TILE - 4);
        ctx.moveTo(x + TILE - 4, y + 4);
        ctx.lineTo(x + 4, y + TILE - 4);
        ctx.stroke();
      } else if (isBushTile(ch)) {
        ctx.fillStyle = COLORS.bush;
        ctx.beginPath();
        ctx.arc(x + TILE / 2, y + TILE / 2, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.bushLeaf;
        ctx.beginPath();
        ctx.arc(x + TILE / 2 - 8, y + TILE / 2 - 6, 9, 0, Math.PI * 2);
        ctx.arc(x + TILE / 2 + 8, y + TILE / 2 - 5, 8, 0, Math.PI * 2);
        ctx.arc(x + TILE / 2, y + TILE / 2 + 8, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawExit(ctx, game);
  drawLoot(ctx, game);
  drawFireflies(ctx, game);
}

function drawExit(ctx, game) {
  const ex = game.exitPos;
  const pulse = 0.55 + 0.45 * Math.sin(game.animTime * 3);
  const glow = ctx.createRadialGradient(ex.x, ex.y, 4, ex.x, ex.y, 52);
  glow.addColorStop(0, `rgba(57, 217, 138, ${0.5 * pulse})`);
  glow.addColorStop(1, 'rgba(57, 217, 138, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(ex.x - 52, ex.y - 52, 104, 104);
  ctx.fillStyle = COLORS.exit;
  roundRect(ctx, ex.x - 17, ex.y - 17, 34, 34, 6);
  ctx.fill();
  ctx.fillStyle = '#0b2e1c';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT', ex.x, ex.y + 1);
  ctx.fillStyle = COLORS.exit;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('▼ EXIT ▼', ex.x, ex.y - 30);
}

function drawLoot(ctx, game) {
  for (const loot of game.loot) {
    if (loot.taken) continue;
    const bob = Math.sin(game.animTime * 2.4 + loot.col) * 2;
    const sparkle = 0.6 + 0.4 * Math.sin(game.animTime * 4 + loot.row * 2);
    ctx.save();
    ctx.translate(loot.x, loot.y + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = COLORS.loot;
    ctx.fillRect(-8, -8, 16, 16);
    ctx.fillStyle = COLORS.lootCore;
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
    ctx.strokeStyle = `rgba(255, 217, 74, ${sparkle})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(loot.x - 13, loot.y + bob);
    ctx.lineTo(loot.x + 13, loot.y + bob);
    ctx.moveTo(loot.x, loot.y + bob - 13);
    ctx.lineTo(loot.x, loot.y + bob + 13);
    ctx.stroke();
  }
}

// Deterministic drifting motes, seeded per level, for a living night.
function drawFireflies(ctx, game) {
  ctx.save();
  for (const mote of game.motes) {
    const x = mote.x + Math.sin(game.animTime * mote.speed + mote.phase) * 8;
    const y = mote.y + Math.cos(game.animTime * mote.speed * 0.8 + mote.phase) * 6;
    const alpha = 0.25 + 0.35 * Math.abs(Math.sin(game.animTime * 0.7 + mote.phase));
    ctx.fillStyle = `rgba(255, 220, 130, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// --- Actors ---------------------------------------------------------------

export function drawVisionCones(ctx, game) {
  for (const guard of game.guards) {
    const poly = visionConePolygon(guard, game.level);
    const alerted = guard.alerted;
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i += 1) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.fillStyle = alerted ? COLORS.coneAlert : COLORS.cone;
    ctx.fill();
    ctx.strokeStyle = alerted ? COLORS.coneAlertEdge : COLORS.coneEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // A "?" over a suspicious guard, "!" over a chasing one.
    if (guard.state === 'suspicious' || guard.state === 'search') {
      drawMark(ctx, guard, '?', '#ffd94a');
    } else if (guard.state === 'chase') {
      drawMark(ctx, guard, '!', '#ff4030');
    }
  }
}

function drawMark(ctx, guard, text, color) {
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, guard.x, guard.y - 26);
}

export function drawGuards(ctx, game) {
  for (const guard of game.guards) {
    // Shadow under the guard, then body, helmet and facing lamp.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(guard.x, guard.y + 10, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = guard.alerted ? '#e0483a' : COLORS.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.guardArmor;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y - 3, 9, Math.PI, 0);
    ctx.fill();
    // Eyes look where the guard looks.
    const ex = Math.cos(guard.facing) * 5;
    const ey = Math.sin(guard.facing) * 5;
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(guard.x + ex - 3, guard.y + ey, 2.2, 0, Math.PI * 2);
    ctx.arc(guard.x + ex + 3, guard.y + ey, 2.2, 0, Math.PI * 2);
    ctx.fill();
    // A small patrol-direction tick.
    ctx.strokeStyle = 'rgba(255,233,168,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(guard.x + Math.cos(guard.facing) * 13, guard.y + Math.sin(guard.facing) * 13);
    ctx.lineTo(guard.x + Math.cos(guard.facing) * 19, guard.y + Math.sin(guard.facing) * 19);
    ctx.stroke();
  }
}

export function drawPlayer(ctx, game) {
  const p = game.player;
  const sneaking = game.sneaking;
  // The lantern's warm pool of light — the game's namesake.
  const glowR = sneaking ? 46 : 62;
  const glow = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, glowR);
  glow.addColorStop(0, 'rgba(255, 184, 77, 0.28)');
  glow.addColorStop(1, 'rgba(255, 184, 77, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(p.x - glowR, p.y - glowR, glowR * 2, glowR * 2);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 10, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hooded cloak: a triangle pointing where the player moves.
  const angle = game.playerFacing;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.fillStyle = COLORS.playerCloak;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-10, -10);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Head + hood.
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.playerCloak;
  ctx.beginPath();
  ctx.arc(p.x, p.y - 2, 7, Math.PI, 0);
  ctx.fill();
  // The lantern itself, swinging at the player's side.
  const swing = Math.sin(game.animTime * 5) * 2;
  ctx.fillStyle = COLORS.lantern;
  ctx.beginPath();
  ctx.arc(p.x + 12, p.y + 6 + swing, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath();
  ctx.arc(p.x + 12, p.y + 6 + swing, 2, 0, Math.PI * 2);
  ctx.fill();

  // Sneak = crouched ring; hidden in a bush = leafy ring.
  const tile = pixelToTile(p.x, p.y);
  const ch = tileAt(game.level, tile.col, tile.row);
  if (sneaking) {
    ctx.strokeStyle = 'rgba(232, 236, 244, 0.6)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 17, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (isBushTile(ch)) {
    ctx.strokeStyle = 'rgba(63, 145, 80, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 17, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#b8f0c0';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HIDDEN', p.x, p.y - 24);
  }
}

export function drawCoin(ctx, game) {
  const coin = game.coin;
  if (!coin) return;
  const t = coin.t / coin.dur;
  const x = coin.x0 + (coin.x1 - coin.x0) * t;
  const arc = Math.sin(t * Math.PI) * 26;
  const y = coin.y0 + (coin.y1 - coin.y0) * t - arc;
  ctx.fillStyle = COLORS.loot;
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8a6d1f';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Landing marker while the coin is in the air.
  ctx.strokeStyle = 'rgba(255, 217, 74, 0.6)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(coin.x1, coin.y1, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

// --- HUD ------------------------------------------------------------------

export function drawHUD(ctx, game) {
  ctx.fillStyle = COLORS.hud;
  ctx.fillRect(0, 0, CANVAS_W, HUD_H);
  ctx.fillStyle = COLORS.hudLine;
  ctx.fillRect(0, HUD_H - 2, CANVAS_W, 2);

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(`SHADOW LANTERN · ${game.level.name}`, 16, 20);
  ctx.fillStyle = COLORS.muted;
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('Reach the EXIT unseen', 16, 42);

  // Detection meter — the heart of the stealth read.
  const mx = 470;
  const mw = 220;
  ctx.fillStyle = COLORS.muted;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  const label = game.spottedFlash > 0 ? 'SPOTTED!' : game.detection >= 100 ? 'SPOTTED!' : game.detection > 40 ? 'SUSPICIOUS' : 'DETECTION';
  ctx.fillStyle = game.spottedFlash > 0 || game.detection >= 100 ? '#ff5040' : game.detection > 40 ? COLORS.gold : COLORS.muted;
  ctx.fillText(label, mx, 20);
  ctx.fillStyle = '#0a0d14';
  roundRect(ctx, mx, 30, mw, 14, 7);
  ctx.fill();
  const frac = Math.min(1, game.detection / 100);
  const grad = ctx.createLinearGradient(mx, 0, mx + mw, 0);
  grad.addColorStop(0, '#39d98a');
  grad.addColorStop(0.55, '#ffd94a');
  grad.addColorStop(1, '#ff4030');
  ctx.fillStyle = grad;
  if (frac > 0) {
    roundRect(ctx, mx, 30, Math.max(8, mw * frac), 14, 7);
    ctx.fill();
  }
  ctx.strokeStyle = COLORS.hudLine;
  ctx.lineWidth = 1;
  roundRect(ctx, mx, 30, mw, 14, 7);
  ctx.stroke();

  // Right-hand stats.
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 15px system-ui, sans-serif';
  const lootText = `◆ LOOT ${game.lootCollected}/${game.lootTotal}`;
  const coinText = `◉ COINS ${game.coinsLeft}`;
  const timeText = `⏱ ${formatTime(game.timeLeft)}`;
  const scoreText = `SCORE ${game.score}`;
  ctx.fillText(lootText, 790, 20);
  ctx.fillText(coinText, 930, 20);
  ctx.fillText(timeText, 1060, 20);
  ctx.fillText(scoreText, 1264, 20);
  ctx.fillStyle = game.sneaking ? COLORS.gold : COLORS.muted;
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(game.sneaking ? 'SNEAKING — slow, quiet, hard to see' : 'WASD move · SHIFT sneak · CLICK throw coin · P pause', 1264, 42);

  // SPOTTED banner across the playfield.
  if (game.spottedFlash > 0) {
    const alpha = Math.min(1, game.spottedFlash);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(180, 20, 10, 0.85)';
    roundRect(ctx, CANVAS_W / 2 - 190, ORIGIN_Y + 8, 380, 44, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠ SPOTTED! ⚠', CANVAS_W / 2, ORIGIN_Y + 31);
    ctx.restore();
  }

  drawMinimap(ctx, game);
  drawToast(ctx, game);
}

function drawMinimap(ctx, game) {
  const w = 176;
  const h = 88;
  const x = CANVAS_W - w - 12;
  const y = CANVAS_H - h - 12;
  const sx = w / COLS;
  const sy = h / ROWS;
  ctx.fillStyle = 'rgba(10, 13, 20, 0.85)';
  roundRect(ctx, x - 4, y - 4, w + 8, h + 8, 6);
  ctx.fill();
  ctx.strokeStyle = COLORS.hudLine;
  ctx.stroke();
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const ch = tileAt(game.level, col, row);
      if (ch === '#') ctx.fillStyle = '#5a6a86';
      else if (ch === 'C') ctx.fillStyle = '#7a5a33';
      else if (isShadowTile(ch)) ctx.fillStyle = '#161d2e';
      else if (isBushTile(ch)) ctx.fillStyle = '#2f6b3a';
      else continue;
      ctx.fillRect(x + col * sx, y + row * sy, sx, sy);
    }
  }
  for (const loot of game.loot) {
    if (loot.taken) continue;
    ctx.fillStyle = COLORS.loot;
    ctx.fillRect(x + loot.col * sx - 1, y + loot.row * sy - 1, 3, 3);
  }
  ctx.fillStyle = COLORS.exit;
  ctx.fillRect(x + game.exitTile.col * sx - 1.5, y + game.exitTile.row * sy - 1.5, 4, 4);
  for (const guard of game.guards) {
    const t = pixelToTile(guard.x, guard.y);
    ctx.fillStyle = guard.alerted ? '#ff4030' : '#ff8a7a';
    ctx.beginPath();
    ctx.arc(x + (t.col + 0.5) * sx, y + (t.row + 0.5) * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const pt = pixelToTile(game.player.x, game.player.y);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + (pt.col + 0.5) * sx, y + (pt.row + 0.5) * sy, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.muted;
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('MAP', x, y - 8);
}

function drawToast(ctx, game) {
  if (!game.message || game.messageTimer <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, game.messageTimer);
  ctx.fillStyle = 'rgba(10, 13, 20, 0.88)';
  ctx.font = '15px system-ui, sans-serif';
  const w = ctx.measureText(game.message).width + 28;
  roundRect(ctx, CANVAS_W / 2 - w / 2, CANVAS_H - 40, w, 28, 8);
  ctx.fill();
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(game.message, CANVAS_W / 2, CANVAS_H - 26);
  ctx.restore();
}

// --- Screens ---------------------------------------------------------------

export function drawTitle(ctx, game) {
  // Night sky, moon, rooftops.
  const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  sky.addColorStop(0, '#0b1026');
  sky.addColorStop(0.6, '#182238');
  sky.addColorStop(1, '#10141f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#f4e9c8';
  ctx.beginPath();
  ctx.arc(1080, 110, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d9cba0';
  ctx.beginPath();
  ctx.arc(1064, 100, 10, 0, Math.PI * 2);
  ctx.arc(1096, 122, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0a0e1a';
  for (let i = 0; i < 9; i += 1) {
    const bx = i * 150 - 20;
    const bh = 90 + ((i * 37) % 60);
    ctx.fillRect(bx, CANVAS_H - bh, 130, bh);
    ctx.fillStyle = 'rgba(255, 217, 74, 0.75)';
    for (let wy = 0; wy < 3; wy += 1) {
      if ((i + wy) % 2 === 0) ctx.fillRect(bx + 20 + wy * 34, CANVAS_H - bh + 22 + wy * 24, 12, 14);
    }
    ctx.fillStyle = '#0a0e1a';
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText('SHADOW LANTERN', CANVAS_W / 2, 128);
  ctx.fillStyle = COLORS.text;
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('Slip past the patrols. Take the gold. Reach the EXIT unseen.', CANVAS_W / 2, 168);
  ctx.fillStyle = COLORS.muted;
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('3 levels · 9 guards · 18 gems · vision cones · bushes · shadow · coin distractions', CANVAS_W / 2, 196);

  // Level cards.
  const cardW = 300;
  const cardH = 190;
  const gap = 28;
  const totalW = cardW * 3 + gap * 2;
  const startX = (CANVAS_W - totalW) / 2;
  const cardY = 232;
  game.levelCards = [];
  game.levels.forEach((level, i) => {
    const x = startX + i * (cardW + gap);
    game.levelCards.push({ x, y: cardY, w: cardW, h: cardH, index: i });
    ctx.fillStyle = 'rgba(16, 20, 31, 0.92)';
    roundRect(ctx, x, cardY, cardW, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = i === 0 ? COLORS.gold : COLORS.hudLine;
    ctx.lineWidth = i === 0 ? 2 : 1.5;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(`LEVEL ${level.number} · ${level.difficulty.toUpperCase()}`, x + 18, cardY + 30);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(level.name, x + 18, cardY + 62);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(level.tagline, x + 18, cardY + 88, cardW - 36);
    ctx.fillStyle = COLORS.text;
    ctx.font = '15px system-ui, sans-serif';
    const lootCount = level.map.join('').split('L').length - 1;
    ctx.fillText(`👁 ${level.guards.length} guards    ◆ ${lootCount} gems    ⏱ ${Math.floor(level.timeLimit / 60)}:${String(level.timeLimit % 60).padStart(2, '0')}`, x + 18, cardY + 122);
    const best = game.bestByLevel[i] ?? 0;
    ctx.fillStyle = best > 0 ? COLORS.exit : COLORS.muted;
    ctx.fillText(best > 0 ? `BEST ${best}` : 'Not cleared yet', x + 18, cardY + 150);
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`Press ${i + 1} or click to play`, x + 18, cardY + 176);
  });

  // How to play.
  const hy = 452;
  ctx.fillStyle = 'rgba(16, 20, 31, 0.92)';
  roundRect(ctx, 190, hy, CANVAS_W - 380, 128, 12);
  ctx.fill();
  ctx.strokeStyle = COLORS.hudLine;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('HOW TO PLAY', CANVAS_W / 2, hy + 26);
  ctx.fillStyle = COLORS.text;
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('WASD / arrows — move      SHIFT — sneak (slow, quiet, harder to spot)', CANVAS_W / 2, hy + 54);
  ctx.fillText('CLICK or F — throw a coin to distract a guard      Stay in shadow (dark tiles) and bushes to hide', CANVAS_W / 2, hy + 80);
  ctx.fillText('Yellow cone = patrol sight · red cone = chasing you · fill the meter and you are SPOTTED', CANVAS_W / 2, hy + 106);
  ctx.fillStyle = COLORS.muted;
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('P pause · R restart · L levels · M mute · an original game — no assets, no network, all sound synthesised', CANVAS_W / 2, 622);
}

export function drawPaused(ctx) {
  dimScreen(ctx);
  panel(ctx, 'PAUSED', 'The patrols wait. Take a breath.', [
    'P / Esc — resume',
    'R — restart this level',
    'L — back to level select',
  ]);
}

export function drawWon(ctx, game) {
  dimScreen(ctx);
  const rating = game.rating;
  const color = rating === 'GHOST' ? COLORS.exit : rating === 'SHADOW' ? COLORS.gold : '#ff8a7a';
  panel(ctx, 'LEVEL COMPLETE', `${game.level.name} — cleared ${rating === 'GHOST' ? 'unseen' : rating === 'SHADOW' ? 'spotted once' : 'spotted ' + game.spottedCount + ' times'}`, [
    `Rating: ${rating}`,
    `Loot: ${game.lootCollected}/${game.lootTotal} gems`,
    `Time left: ${formatTime(game.timeLeft)}  ·  Score: ${game.score}`,
    `Best score: ${game.bestByLevel[game.levelIndex] ?? game.score}`,
    game.levelIndex < 2 ? 'N — next level' : 'You cleared every level!',
    'R — replay this level   ·   L — level select',
  ], color);
}

export function drawLost(ctx, game) {
  dimScreen(ctx);
  const title = game.loseReason === 'time' ? "TIME'S UP!" : 'CAUGHT!';
  const sub = game.loseReason === 'time'
    ? 'The night ran out before you reached the EXIT.'
    : 'A guard caught you in the lamplight.';
  panel(ctx, title, sub, [
    `Loot: ${game.lootCollected}/${game.lootTotal} gems  ·  Score: ${game.score}`,
    'R — try again',
    'L — back to level select',
  ], '#ff5040');
}

function dimScreen(ctx) {
  ctx.fillStyle = 'rgba(8, 10, 18, 0.72)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function panel(ctx, title, subtitle, lines, accent = COLORS.gold) {
  const w = 560;
  const h = 150 + lines.length * 30;
  const x = (CANVAS_W - w) / 2;
  const y = (CANVAS_H - h) / 2;
  ctx.fillStyle = 'rgba(16, 20, 31, 0.97)';
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 38px Georgia, serif';
  ctx.fillText(title, CANVAS_W / 2, y + 62);
  ctx.fillStyle = COLORS.text;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(subtitle, CANVAS_W / 2, y + 96);
  ctx.font = '15px system-ui, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillStyle = i === 0 && title === 'LEVEL COMPLETE' ? accent : COLORS.text;
    if (title === 'LEVEL COMPLETE' && i === 0) ctx.font = 'bold 22px system-ui, sans-serif';
    else ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(line, CANVAS_W / 2, y + 132 + i * 30);
  });
}
