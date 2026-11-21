// SHADOW LANTERN — the game itself: state machine, main loop, player
// movement and collision, the detection meter, coin throws, loot, the
// exit, scoring and best scores. The guard AI lives in guards.js; all
// drawing lives in render.js.
import {
  CANVAS_W, CANVAS_H, TILE, ORIGIN_X, ORIGIN_Y,
  PLAYER_WALK_SPEED, PLAYER_SNEAK_SPEED, PLAYER_RADIUS,
  DETECTION_DRAIN, COIN_RANGE, COIN_HEAR_RANGE, NOISE_RADIUS,
  LOOT_PICKUP_RADIUS, EXIT_RADIUS, LOOT_SCORE, GHOST_BONUS,
  TIME_BONUS_PER_SECOND, TILE_LOOT, TILE_PLAYER, TILE_EXIT,
} from './config.js';
import { LEVELS, tileAt, findTile, lootTiles, isSolidTile, circleBlocked } from './levels.js';
import { Guard, tileToPixel, pixelToTile, detectionRateFor } from './guards.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { mulberry32 } from './random.js';
import {
  drawWorld, drawVisionCones, drawGuards, drawPlayer, drawCoin,
  drawHUD, drawTitle, drawPaused, drawWon, drawLost,
} from './render.js';

const BEST_KEY = 'shadow-lantern-best-v1';
const MUTE_KEY = 'shadow-lantern-muted-v1';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.levels = LEVELS;
    this.input = new Input(canvas);
    this.audio = new SoundBank();
    this.state = 'title'; // title | playing | paused | won | lost
    this.levelIndex = 0;
    this.level = LEVELS[0];
    this.player = { x: 0, y: 0 };
    this.playerFacing = 0;
    this.guards = [];
    this.loot = [];
    this.lootTotal = 0;
    this.lootCollected = 0;
    this.coinsLeft = 3;
    this.coin = null; // a coin in flight {x0,y0,x1,y1,t,dur}
    this.detection = 0;
    this.spottedCount = 0;
    this.spottedFlash = 0;
    this.spottedThisChase = false;
    this.score = 0;
    this.timeLeft = 0;
    this.rating = null;
    this.loseReason = null;
    this.message = '';
    this.messageTimer = 0;
    this.animTime = 0;
    this.frozen = false; // staged screenshots freeze the clock
    this.motes = [];
    this.bestByLevel = this.loadBest();
    this.levelCards = [];
    this.exitTile = { col: 0, row: 0 };
    this.exitPos = { x: 0, y: 0 };
    this.stepTimer = 0;
    this.noiseTimer = 0;
    try {
      this.audio.setMuted(window.localStorage.getItem(MUTE_KEY) === '1');
    } catch { /* storage may be unavailable */ }

    this.input.onKeyPress = (code) => this.onKey(code);
    this.input.onPointerDown = (x, y) => this.onPointer(x, y);

    this.loadLevel(0, true);
    this.state = 'title';
    this.lastTime = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;
      if (!this.frozen) this.update(dt);
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // --- Persistence ---------------------------------------------------------

  loadBest() {
    try {
      const raw = window.localStorage.getItem(BEST_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  saveBest() {
    try {
      window.localStorage.setItem(BEST_KEY, JSON.stringify(this.bestByLevel));
    } catch { /* storage may be unavailable */ }
  }

  // --- Level setup ----------------------------------------------------------

  loadLevel(index, forTitle = false) {
    this.levelIndex = index;
    this.level = LEVELS[index];
    const start = findTile(this.level, TILE_PLAYER);
    const startPx = tileToPixel(start.col, start.row);
    this.player = { x: startPx.x, y: startPx.y };
    this.playerFacing = 0;
    this.guards = this.level.guards.map((def) => new Guard(def, index));
    this.loot = lootTiles(this.level).map(({ col, row }) => {
      const p = tileToPixel(col, row);
      return { col, row, x: p.x, y: p.y, taken: false };
    });
    this.lootTotal = this.loot.length;
    this.lootCollected = 0;
    this.coinsLeft = this.level.coins;
    this.coin = null;
    this.detection = 0;
    this.spottedCount = 0;
    this.spottedFlash = 0;
    this.spottedThisChase = false;
    this.score = 0;
    this.timeLeft = this.level.timeLimit;
    this.rating = null;
    this.loseReason = null;
    this.exitTile = findTile(this.level, TILE_EXIT);
    this.exitPos = tileToPixel(this.exitTile.col, this.exitTile.row);
    this.message = '';
    this.messageTimer = 0;
    // Deterministic fireflies for this level (seeded by level number).
    const rng = mulberry32(1000 + index * 77);
    this.motes = [];
    for (let i = 0; i < 26; i += 1) {
      this.motes.push({
        x: ORIGIN_X + rng() * 32 * TILE,
        y: ORIGIN_Y + rng() * 16 * TILE,
        phase: rng() * Math.PI * 2,
        speed: 0.3 + rng() * 0.7,
      });
    }
    if (!forTitle) this.audio.startDrone();
  }

  startLevel(index) {
    this.loadLevel(index);
    this.state = 'playing';
    this.showMessage(`${this.level.name} — reach the EXIT unseen`);
    this.audio.uiClick();
  }

  // --- Input ---------------------------------------------------------------

  onKey(code) {
    // Letter keys arrive as KeyX; digits as Digit1..3; also accept the
    // plain key names the self-test uses ('1', 'p', 'r', 'l', 'm', 'n').
    const key = code.startsWith('Key') ? code.slice(3).toLowerCase()
      : code.startsWith('Digit') ? code.slice(5)
      : code.toLowerCase();
    if (key === 'm') {
      this.toggleMute();
      return;
    }
    if (this.state === 'title') {
      if (key === '1' || key === '2' || key === '3') {
        this.startLevel(Number(key) - 1);
      }
      return;
    }
    if (this.state === 'playing') {
      if (key === 'p' || key === 'escape') {
        this.state = 'paused';
        this.showMessage('Paused');
      } else if (key === 'r') {
        this.startLevel(this.levelIndex);
      } else if (key === 'l') {
        this.state = 'title';
        this.loadLevel(this.levelIndex, true);
        this.audio.stopDrone();
      } else if (key === 'f') {
        this.throwCoin(this.input.mouse.x, this.input.mouse.y);
      }
      return;
    }
    if (this.state === 'paused') {
      if (key === 'p' || key === 'escape') this.state = 'playing';
      else if (key === 'r') this.startLevel(this.levelIndex);
      else if (key === 'l') {
        this.state = 'title';
        this.loadLevel(this.levelIndex, true);
        this.audio.stopDrone();
      }
      return;
    }
    if (this.state === 'won') {
      if (key === 'n' && this.levelIndex < LEVELS.length - 1) {
        this.startLevel(this.levelIndex + 1);
      } else if (key === 'r') {
        this.startLevel(this.levelIndex);
      } else if (key === 'l') {
        this.state = 'title';
        this.loadLevel(this.levelIndex, true);
        this.audio.stopDrone();
      }
      return;
    }
    if (this.state === 'lost') {
      if (key === 'r') this.startLevel(this.levelIndex);
      else if (key === 'l') {
        this.state = 'title';
        this.loadLevel(this.levelIndex, true);
        this.audio.stopDrone();
      }
    }
  }

  onPointer(x, y) {
    if (this.state === 'title') {
      for (const card of this.levelCards) {
        if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
          this.startLevel(card.index);
          return;
        }
      }
      return;
    }
    if (this.state === 'playing') {
      this.throwCoin(x, y);
    }
  }

  toggleMute() {
    this.audio.setMuted(!this.audio.muted);
    try {
      window.localStorage.setItem(MUTE_KEY, this.audio.muted ? '1' : '0');
    } catch { /* storage may be unavailable */ }
    this.showMessage(this.audio.muted ? 'Sound off (M to unmute)' : 'Sound on');
  }

  get sneaking() {
    return this.input.sneaking;
  }

  // --- Actions --------------------------------------------------------------

  throwCoin(tx, ty) {
    if (this.state !== 'playing' || this.coin || this.coinsLeft <= 0) {
      if (this.state === 'playing' && this.coinsLeft <= 0) {
        this.showMessage('No coins left — slip past them instead');
      }
      return;
    }
    const dx = tx - this.player.x;
    const dy = ty - this.player.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, COIN_RANGE);
    const nx = dist === 0 ? this.player.x + 40 : this.player.x + (dx / dist) * clamped;
    const ny = dist === 0 ? this.player.y : this.player.y + (dy / dist) * clamped;
    this.coinsLeft -= 1;
    this.coin = { x0: this.player.x, y0: this.player.y, x1: nx, y1: ny, t: 0, dur: 0.45 };
    this.audio.coinThrow();
  }

  landCoin() {
    const coin = this.coin;
    this.coin = null;
    this.audio.coinClink();
    // The nearest guard in earshot goes to look at the landing spot.
    let nearest = null;
    let nearestDist = Infinity;
    for (const guard of this.guards) {
      const d = Math.hypot(guard.x - coin.x1, guard.y - coin.y1);
      if (d < COIN_HEAR_RANGE && d < nearestDist) {
        nearest = guard;
        nearestDist = d;
      }
    }
    if (nearest) {
      nearest.investigatePoint(coin.x1, coin.y1);
      this.audio.suspicious();
      this.showMessage('Coin clink — a guard goes to look');
    } else {
      this.showMessage('Coin clink — nobody heard it');
    }
  }

  showMessage(text) {
    this.message = text;
    this.messageTimer = 3;
  }

  // --- Detection ------------------------------------------------------------

  onSpotted() {
    if (this.spottedThisChase) return;
    this.spottedThisChase = true;
    this.spottedCount += 1;
    this.spottedFlash = 1.6;
    this.audio.spottedAlarm();
    this.showMessage('SPOTTED! Break line of sight!');
    // Chase with every guard that can see the player right now; if none
    // can (a stale frame), the nearest guard takes up the hunt.
    let chased = false;
    for (const guard of this.guards) {
      if (detectionRateFor(guard, this.level, this.player, this.sneaking) > 0) {
        guard.startChase();
        chased = true;
      }
    }
    if (!chased && this.guards.length > 0) {
      let nearest = this.guards[0];
      for (const guard of this.guards) {
        if (Math.hypot(guard.x - this.player.x, guard.y - this.player.y)
          < Math.hypot(nearest.x - this.player.x, nearest.y - this.player.y)) {
          nearest = guard;
        }
      }
      nearest.startChase();
    }
  }

  onCaught() {
    if (this.state !== 'playing') return;
    this.state = 'lost';
    this.loseReason = 'caught';
    this.audio.loseSting();
    this.audio.stopDrone();
  }

  winLevel() {
    if (this.state !== 'playing') return;
    this.state = 'won';
    this.rating = this.spottedCount === 0 ? 'GHOST' : this.spottedCount === 1 ? 'SHADOW' : 'LOUD';
    const timeBonus = Math.round(this.timeLeft * TIME_BONUS_PER_SECOND);
    const ghostBonus = this.rating === 'GHOST' ? GHOST_BONUS : 0;
    // Loot already added 100 per gem at pickup; add time + ghost here.
    this.score += timeBonus + ghostBonus;
    const prevBest = this.bestByLevel[this.levelIndex] ?? 0;
    if (this.score > prevBest) {
      this.bestByLevel[this.levelIndex] = this.score;
      this.saveBest();
    }
    this.audio.winJingle();
    this.audio.stopDrone();
  }

  // --- Update ---------------------------------------------------------------

  // One frame of game time. The playing simulation runs in substeps of
  // at most 1/30 s so a large dt (a slow frame, or a scripted test step)
  // can never tunnel a player or a guard through a wall.
  update(dt) {
    this.animTime += dt;
    if (this.messageTimer > 0) this.messageTimer -= dt;
    if (this.spottedFlash > 0) this.spottedFlash -= dt;
    if (this.state === 'title') return;
    if (this.state !== 'playing') return;
    let remaining = dt;
    while (remaining > 0.000001) {
      const step = Math.min(remaining, 1 / 30);
      this.stepPlaying(step);
      remaining -= step;
      if (this.state !== 'playing') break;
    }
  }

  stepPlaying(dt) {
    // Clock.
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.state = 'lost';
      this.loseReason = 'time';
      this.audio.loseSting();
      this.audio.stopDrone();
      return;
    }

    // Player movement.
    const { dx, dy } = this.input.moveDirection();
    const sneaking = this.sneaking;
    const speed = sneaking ? PLAYER_SNEAK_SPEED : PLAYER_WALK_SPEED;
    if (dx !== 0 || dy !== 0) {
      this.playerFacing = Math.atan2(dy, dx);
      this.movePlayer(this.player.x + dx * speed * dt, this.player.y);
      this.movePlayer(this.player.x, this.player.y + dy * speed * dt);
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.audio.footstep(sneaking);
        this.stepTimer = sneaking ? 0.45 : 0.3;
      }
      // Walking (not sneaking) makes noise a nearby guard can hear.
      if (!sneaking) {
        this.noiseTimer -= dt;
        if (this.noiseTimer <= 0) {
          this.noiseTimer = 0.7;
          for (const guard of this.guards) {
            const d = Math.hypot(guard.x - this.player.x, guard.y - this.player.y);
            if (d < NOISE_RADIUS && guard.state === 'patrol') {
              guard.investigatePoint(this.player.x, this.player.y);
              this.showMessage('Your footsteps gave you away…');
            }
          }
        }
      }
    }

    // Coin flight.
    if (this.coin) {
      this.coin.t += dt;
      if (this.coin.t >= this.coin.dur) this.landCoin();
    }

    // Detection: the closest seeing guard drives the meter.
    let bestRate = 0;
    let anySees = false;
    for (const guard of this.guards) {
      const rate = detectionRateFor(guard, this.level, this.player, sneaking);
      if (rate > 0) {
        anySees = true;
        if (rate > bestRate) bestRate = rate;
      }
    }
    if (anySees) {
      this.detection += bestRate * dt;
      if (this.detection > 40 && this.detection < 100) {
        for (const guard of this.guards) {
          if (guard.seesPlayer) guard.growSuspicious();
        }
      }
      if (this.detection >= 100) {
        this.detection = 100;
        this.onSpotted();
      }
    } else {
      this.detection = Math.max(0, this.detection - DETECTION_DRAIN * dt);
      if (this.detection < 55) this.spottedThisChase = false;
    }

    // Guards.
    for (const guard of this.guards) guard.update(dt, this);
    if (this.state !== 'playing') return;

    // Loot pickup.
    for (const loot of this.loot) {
      if (loot.taken) continue;
      if (Math.hypot(loot.x - this.player.x, loot.y - this.player.y) < LOOT_PICKUP_RADIUS) {
        loot.taken = true;
        this.lootCollected += 1;
        this.score += LOOT_SCORE;
        this.audio.lootPickup();
        this.showMessage(`Gem taken — ${this.lootCollected}/${this.lootTotal}`);
      }
    }

    // Exit.
    if (Math.hypot(this.exitPos.x - this.player.x, this.exitPos.y - this.player.y) < EXIT_RADIUS) {
      this.winLevel();
    }
  }

  movePlayer(nx, ny) {
    // The collision radius (10) is a touch smaller than the drawn body
    // (13): the player slides past wall corners instead of snagging on
    // them, while walls still block properly.
    if (circleBlocked(this.level, nx, ny, 10)) return;
    this.player.x = nx;
    this.player.y = ny;
  }

  // --- Render ---------------------------------------------------------------

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (this.state === 'title') {
      drawTitle(ctx, this);
      return;
    }
    drawWorld(ctx, this);
    drawVisionCones(ctx, this);
    drawGuards(ctx, this);
    drawPlayer(ctx, this);
    drawCoin(ctx, this);
    drawHUD(ctx, this);
    if (this.state === 'paused') drawPaused(ctx);
    else if (this.state === 'won') drawWon(ctx, this);
    else if (this.state === 'lost') drawLost(ctx, this);
  }
}
