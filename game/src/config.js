// SHADOW LANTERN — shared constants for the whole game.
// One place owns the board geometry, the palette and the tuning numbers
// so the renderer, the guard AI and the HUD can never drift apart.
export const CANVAS_W = 1280;
export const CANVAS_H = 720;
export const TILE = 40;
export const COLS = 32;
export const ROWS = 16;
export const ORIGIN_X = 0;
export const ORIGIN_Y = 64;
export const HUD_H = 56;

// Tile letters used by the hand-designed maps in levels.js.
export const TILE_WALL = '#';
export const TILE_FLOOR = '.';
export const TILE_SHADOW = ',';
export const TILE_BUSH = 'B';
export const TILE_CRATE = 'C';
export const TILE_LOOT = 'L';
export const TILE_PLAYER = 'P';
export const TILE_EXIT = 'E';

// Movement + senses (pixels and seconds — tuned so a guard spots you in
// about 1.5 s in the open, about 3.5 s in shadow, and never through a bush).
export const PLAYER_WALK_SPEED = 170;
export const PLAYER_SNEAK_SPEED = 85;
export const PLAYER_RADIUS = 13;
export const GUARD_PATROL_SPEED = 58;
export const GUARD_CHASE_SPEED = 138;
export const GUARD_INVESTIGATE_SPEED = 78;
export const GUARD_RETURN_SPEED = 88;
export const GUARD_RADIUS = 14;
export const VISION_RANGE = 232;
export const VISION_HALF_ANGLE = 0.66; // ~38 degrees each side
export const DETECTION_FILL_BASE = 92; // per second at point-blank range
export const DETECTION_FILL_FAR = 16; // per second at the edge of the cone
export const DETECTION_DRAIN = 26; // per second while unseen
export const SHADOW_RANGE_FACTOR = 0.58;
export const SHADOW_FILL_FACTOR = 0.45;
export const SNEAK_RANGE_FACTOR = 0.8;
export const SNEAK_FILL_FACTOR = 0.5;
export const BUSH_HIDE_RANGE = 46; // a guard must be this close to see into a bush
export const COIN_RANGE = 280;
export const COIN_HEAR_RANGE = 360;
export const NOISE_RADIUS = 72; // walking footsteps a guard can hear
export const CATCH_DISTANCE = 26;
export const LOOT_PICKUP_RADIUS = 24;
export const EXIT_RADIUS = 26;
export const LOOT_SCORE = 100;
export const GHOST_BONUS = 500;
export const TIME_BONUS_PER_SECOND = 5;

// The palette: a moonlit blue night, warm lantern gold, danger red.
export const COLORS = {
  floorA: '#232c3d',
  floorB: '#202839',
  floorLine: '#2c3750',
  wall: '#4a5468',
  wallTop: '#6b7891',
  shadow: '#161d2e',
  shadowEdge: '#3a4a6b',
  bush: '#2f6b3a',
  bushLeaf: '#3f9150',
  crate: '#7a5a33',
  crateEdge: '#a07d4a',
  loot: '#ffd94a',
  lootCore: '#fff3b0',
  exit: '#39d98a',
  exitGlow: '#1d7a4c',
  player: '#e8dcc3',
  playerCloak: '#3a2f5e',
  lantern: '#ffb84d',
  guard: '#c0392b',
  guardArmor: '#7a1f16',
  cone: 'rgba(255, 214, 90, 0.20)',
  coneEdge: 'rgba(255, 214, 90, 0.55)',
  coneAlert: 'rgba(255, 64, 48, 0.28)',
  coneAlertEdge: 'rgba(255, 64, 48, 0.7)',
  hud: '#10141f',
  hudLine: '#2a3348',
  text: '#e8ecf4',
  muted: '#9aa7bd',
  gold: '#ffd94a',
};
