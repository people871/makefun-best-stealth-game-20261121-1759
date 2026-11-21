// SHADOW LANTERN — guard AI: patrol, suspicion, chase, search, return.
// A guard sees with a vision cone (range + angle + line of sight against
// walls and crates). Seeing the player fills the shared detection meter
// in main.js; the guard's own state machine decides what to do about it.
import {
  TILE, ORIGIN_X, ORIGIN_Y,
  GUARD_PATROL_SPEED, GUARD_CHASE_SPEED, GUARD_INVESTIGATE_SPEED, GUARD_RETURN_SPEED,
  GUARD_RADIUS, VISION_RANGE, VISION_HALF_ANGLE,
  SHADOW_RANGE_FACTOR, SHADOW_FILL_FACTOR, SNEAK_RANGE_FACTOR, SNEAK_FILL_FACTOR,
  BUSH_HIDE_RANGE, CATCH_DISTANCE,
} from './config.js';
import { tileAt, blocksSightTile, isShadowTile, isBushTile, circleBlocked } from './levels.js';

export function tileToPixel(col, row) {
  return { x: ORIGIN_X + col * TILE + TILE / 2, y: ORIGIN_Y + row * TILE + TILE / 2 };
}

export function pixelToTile(x, y) {
  return {
    col: Math.floor((x - ORIGIN_X) / TILE),
    row: Math.floor((y - ORIGIN_Y) / TILE),
  };
}

// True when no wall or crate stands between two points (sampled every 6 px).
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const { col, row } = pixelToTile(x, y);
    if (blocksSightTile(tileAt(level, col, row))) return false;
  }
  return true;
}

// How fast this guard's gaze fills the detection meter for the player
// right now (0 = the guard cannot see the player at all). Shadow floor
// shrinks the range and slows the fill; sneaking does the same; a bush
// hides the player unless the guard is almost on top of them.
export function detectionRateFor(guard, level, player, sneaking) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  const playerTile = pixelToTile(player.x, player.y);
  const playerCh = tileAt(level, playerTile.col, playerTile.row);
  const inShadow = isShadowTile(playerCh);
  const inBush = isBushTile(playerCh);
  if (inBush && dist > BUSH_HIDE_RANGE) return 0;
  let range = VISION_RANGE;
  let fill = 1;
  if (inShadow) {
    range *= SHADOW_RANGE_FACTOR;
    fill *= SHADOW_FILL_FACTOR;
  }
  if (sneaking) {
    range *= SNEAK_RANGE_FACTOR;
    fill *= SNEAK_FILL_FACTOR;
  }
  if (dist > range) return 0;
  const angleToPlayer = Math.atan2(dy, dx);
  let diff = angleToPlayer - guard.facing;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > VISION_HALF_ANGLE) return 0;
  if (!hasLineOfSight(level, guard.x, guard.y, player.x, player.y)) return 0;
  // Closer + more centred = faster fill.
  const closeness = 1 - dist / range;
  const centred = 1 - Math.abs(diff) / VISION_HALF_ANGLE;
  return fill * (16 + 76 * closeness * (0.5 + 0.5 * centred));
}

// The vision cone as a fan of raycast points, for the renderer: each ray
// marches out until it hits a wall/crate or the range, so the cone hugs
// the cover the player hides behind.
export function visionConePolygon(guard, level) {
  const rays = 26;
  const points = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i <= rays; i += 1) {
    const angle = guard.facing - VISION_HALF_ANGLE + (2 * VISION_HALF_ANGLE * i) / rays;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let reach = VISION_RANGE;
    for (let d = 8; d <= VISION_RANGE; d += 8) {
      const { col, row } = pixelToTile(guard.x + dx * d, guard.y + dy * d);
      if (blocksSightTile(tileAt(level, col, row))) {
        reach = d;
        break;
      }
    }
    points.push({ x: guard.x + dx * reach, y: guard.y + dy * reach });
  }
  return points;
}

export class Guard {
  constructor(def, levelIndex) {
    this.levelIndex = levelIndex;
    const spawn = tileToPixel(def.spawn[0], def.spawn[1]);
    this.x = spawn.x;
    this.y = spawn.y;
    this.waypoints = def.waypoints.map(([c, r]) => tileToPixel(c, r));
    this.waypointIndex = 0;
    this.facing = 0; // radians; starts looking right, down the patrol lane
    this.state = 'patrol'; // patrol | suspicious | chase | search | return
    this.pauseTimer = 0;
    this.stuckTimer = 0;
    this.lastX = this.x;
    this.lastY = this.y;
    this.investigate = null; // {x, y} — a coin landing or a noise
    this.investigateTimer = 0; // give up on an unreachable spot
    this.lastSeen = null; // {x, y} — where the player was last spotted
    this.loseSightTimer = 0;
    this.searchTimer = 0;
    this.stepTimer = 0;
    this.seesPlayer = false;
  }

  get alerted() {
    return this.state === 'chase' || this.state === 'search';
  }

  // Move toward a point, sliding along walls (axis-separated collision).
  moveToward(tx, ty, speed, dt, level) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return true;
    const step = Math.min(dist, speed * dt);
    const nx = this.x + (dx / dist) * step;
    const ny = this.y + (dy / dist) * step;
    this.facing = Math.atan2(dy, dx);
    this.tryMove(nx, this.y, level);
    this.tryMove(this.x, ny, level);
    return Math.hypot(tx - this.x, ty - this.y) < 4;
  }

  tryMove(nx, ny, level) {
    // Collision radius (11) slightly under the drawn body (14), same
    // corner forgiveness as the player.
    if (circleBlocked(level, nx, ny, 11)) return;
    this.x = nx;
    this.y = ny;
  }

  // One AI step. `game` carries the player, the level and the callbacks
  // (onGuardSpotsPlayer, onGuardLosesPlayer, onCaught).
  update(dt, game) {
    const level = game.level;
    const player = game.player;
    const rate = detectionRateFor(this, level, player, game.sneaking);
    this.seesPlayer = rate > 0;
    if (this.seesPlayer) {
      this.lastSeen = { x: player.x, y: player.y };
      this.loseSightTimer = 0;
    } else if (this.state === 'chase') {
      this.loseSightTimer += dt;
    }

    // Footstep sounds while moving, louder the closer the guard is.
    this.stepTimer -= dt;
    if (this.stepTimer <= 0 && (this.state === 'patrol' || this.state === 'chase')) {
      const d = Math.hypot(player.x - this.x, player.y - this.y);
      if (d < 320) {
        game.audio.guardStep(0.22 * (1 - d / 320));
        this.stepTimer = this.state === 'chase' ? 0.32 : 0.55;
      } else {
        this.stepTimer = 0.2;
      }
    }

    switch (this.state) {
      case 'patrol': {
        if (this.pauseTimer > 0) {
          this.pauseTimer -= dt;
          break;
        }
        const target = this.waypoints[this.waypointIndex];
        const arrived = this.moveToward(target.x, target.y, GUARD_PATROL_SPEED, dt, level);
        if (arrived) {
          this.pauseTimer = 1.1;
          this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
        }
        break;
      }
      case 'suspicious': {
        if (this.investigate) {
          const arrived = this.moveToward(
            this.investigate.x, this.investigate.y, GUARD_INVESTIGATE_SPEED, dt, level,
          );
          if (arrived) {
            this.pauseTimer += dt;
            // Look around for a moment, then give up and head back.
            this.facing += dt * 1.4;
            if (this.pauseTimer > 2.4) {
              this.investigate = null;
              this.pauseTimer = 0;
              this.state = 'return';
            }
          } else {
            // The spot may be behind a wall: give up after 4 s of
            // pushing against it instead of shoving the wall forever.
            this.investigateTimer += dt;
            if (this.investigateTimer > 4) {
              this.investigate = null;
              this.investigateTimer = 0;
              this.state = 'return';
            }
          }
        } else {
          // A glimpse without a place to check: stare, then move on.
          this.pauseTimer += dt;
          if (this.pauseTimer > 1.2) {
            this.pauseTimer = 0;
            this.state = 'return';
          }
        }
        break;
      }
      case 'chase': {
        this.moveToward(player.x, player.y, GUARD_CHASE_SPEED, dt, level);
        const d = Math.hypot(player.x - this.x, player.y - this.y);
        if (d < CATCH_DISTANCE) {
          game.onCaught(this);
          return;
        }
        if (!this.seesPlayer && this.loseSightTimer > 3) {
          this.state = 'search';
          this.searchTimer = 0;
        }
        break;
      }
      case 'search': {
        this.searchTimer += dt;
        if (this.lastSeen) {
          const arrived = this.moveToward(
            this.lastSeen.x, this.lastSeen.y, GUARD_INVESTIGATE_SPEED, dt, level,
          );
          if (arrived) this.facing += dt * 2.2; // sweep the area
        }
        if (this.searchTimer > 3.2) {
          this.state = 'return';
        }
        break;
      }
      case 'return': {
        // Walk back to the nearest waypoint, then resume the patrol.
        let best = 0;
        let bestDist = Infinity;
        this.waypoints.forEach((wp, i) => {
          const d = Math.hypot(wp.x - this.x, wp.y - this.y);
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        });
        const arrived = this.moveToward(
          this.waypoints[best].x, this.waypoints[best].y, GUARD_RETURN_SPEED, dt, level,
        );
        if (arrived) {
          this.waypointIndex = best;
          this.state = 'patrol';
          this.pauseTimer = 0.4;
        }
        break;
      }
      default:
        break;
    }

    // Safety net: a guard that cannot move for 1.5 s (a bad corner) skips
    // to its next waypoint instead of shoving a wall forever.
    const moved = Math.hypot(this.x - this.lastX, this.y - this.lastY);
    if (this.state === 'patrol' || this.state === 'return') {
      if (moved < 0.5 && this.pauseTimer <= 0) {
        this.stuckTimer += dt;
        if (this.stuckTimer > 1.5) {
          this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
          this.stuckTimer = 0;
        }
      } else {
        this.stuckTimer = 0;
      }
    }
    this.lastX = this.x;
    this.lastY = this.y;
  }

  // The player was fully spotted: give chase.
  startChase() {
    if (this.state !== 'chase') {
      this.state = 'chase';
      this.loseSightTimer = 0;
    }
  }

  // Something worth a look: a coin landing or a noise.
  investigatePoint(x, y) {
    if (this.state === 'chase') return;
    this.investigate = { x, y };
    this.investigateTimer = 0;
    this.state = 'suspicious';
    this.pauseTimer = 0;
  }

  // A glimpse that never became a sighting: turn and stare briefly.
  growSuspicious() {
    if (this.state === 'patrol') {
      this.state = 'suspicious';
      this.pauseTimer = 0;
      this.investigate = null;
    }
  }
}
