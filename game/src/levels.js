// SHADOW LANTERN — the three hand-designed levels.
// Tile letters: # wall · . floor · , shadow floor · B bush (hide, blocks
// sight) · C crate (blocks sight + movement) · L loot · P player start ·
// E exit. Every map is 32 columns by 16 rows; guards patrol the tile
// waypoints listed per level. A checker (capture/check-levels.mjs) proves
// every row is 32 wide, every waypoint is walkable, and the exit and all
// loot are reachable from the player start.
import { COLS, ROWS, TILE, ORIGIN_X, ORIGIN_Y } from './config.js';

export const LEVELS = [
  {
    id: 'moonlit-museum',
    name: 'Moonlit Museum',
    number: 1,
    difficulty: 'Easy',
    tagline: 'Learn the dark — 3 guards, wide halls, long shadows.',
    timeLimit: 240,
    coins: 3,
    guards: [
      { spawn: [7, 2], waypoints: [[7, 2], [18, 2], [18, 3], [7, 3]] },
      { spawn: [15, 8], waypoints: [[9, 7], [24, 7]] },
      { spawn: [8, 14], waypoints: [[8, 14], [24, 14]] },
    ],
    map: [
      '################################',
      '#P....#........,,......E.......#',
      '#.....#...L.........####.......#',
      '#..B..#.....,,.....#.....L.....#',
      '#.....#..........C.#...........#',
      '#..C..####..####..#...####.....#',
      '#..............................#',
      '#....L.......,......B....L.....#',
      '#.....######.....####..........#',
      '#.....#......C.....#....C......#',
      '#..B..#......,,....#...........#',
      '#.....#..........####..###.....#',
      '#.....#....C.............#.....#',
      '#.........####....B......#.....#',
      '#..............................#',
      '################################',
    ],
  },
  {
    id: 'gilded-vault',
    name: 'The Gilded Vault',
    number: 2,
    difficulty: 'Medium',
    tagline: 'Gold behind glass — 3 guards, deep shadow lanes, 6 gems.',
    timeLimit: 300,
    coins: 3,
    guards: [
      { spawn: [6, 1], waypoints: [[6, 1], [16, 1], [16, 3], [6, 3]] },
      { spawn: [8, 7], waypoints: [[8, 7], [24, 7], [24, 5], [8, 5]] },
      { spawn: [6, 14], waypoints: [[6, 14], [20, 14]] },
    ],
    map: [
      '################################',
      '#P...#......,,,,.....E.........#',
      '#....#..L....##....###...L.....#',
      '#..B.#......,,,,....#..........#',
      '#....####..###..C...#..####....#',
      '#..............................#',
      '#.C...,,....####.....B....L....#',
      '#.....##.........L.............#',
      '#..L......C....,,,,....##......#',
      '#....####......##....#....C....#',
      '#.......#..B.....,,....L.......#',
      '#..C....#....####.....####.....#',
      '#............#........#........#',
      '#..B....,,...#...C....#..B.....#',
      '#..............................#',
      '################################',
    ],
  },
  {
    id: 'midnight-manor',
    name: 'Midnight Manor',
    number: 3,
    difficulty: 'Hard',
    tagline: 'Tight patrols, thin cover — 3 guards, 8 gems, no mercy.',
    timeLimit: 300,
    coins: 4,
    guards: [
      { spawn: [7, 1], waypoints: [[7, 1], [18, 1]] },
      { spawn: [8, 8], waypoints: [[8, 8], [24, 8]] },
      { spawn: [7, 11], waypoints: [[7, 11], [22, 11]] },
    ],
    map: [
      '################################',
      '#P....#.....,,.....E....#......#',
      '#..B..#..L...##....#..L....#...#',
      '#.....#......,,....#...........#',
      '#..C..###..####..###..####.....#',
      '#..............................#',
      '#..L...,,....C.....B....L......#',
      '#..####...####...####...###....#',
      '#..............................#',
      '#..C....L....,,....C....L......#',
      '#..###..####...####..####......#',
      '#..............................#',
      '#..B.....,,....L....#....C.....#',
      '#..####....####....###....L....#',
      '#..............................#',
      '################################',
    ],
  },
];

// --- Tile helpers shared by the game loop, the guard AI and the renderer ---

export function tileAt(level, col, row) {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return '#';
  return level.map[row][col];
}

export function isSolidTile(ch) {
  return ch === '#' || ch === 'C';
}

export function isShadowTile(ch) {
  return ch === ',';
}

export function isBushTile(ch) {
  return ch === 'B';
}

// A tile a guard's eyes cannot see through (walls and crates).
export function blocksSightTile(ch) {
  return ch === '#' || ch === 'C';
}

// Find the single tile holding a letter (P or E) on a map.
export function findTile(level, letter) {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (level.map[row][col] === letter) return { col, row };
    }
  }
  return null;
}

// Every loot tile on a map, in reading order.
export function lootTiles(level) {
  const out = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (level.map[row][col] === 'L') out.push({ col, row });
    }
  }
  return out;
}

// True when a circle of radius r centred at (x, y) overlaps a solid
// tile. The closest point on each overlapped tile decides — a bounding
// box corner check would wedge the player against diagonally adjacent
// walls the circle never actually touches.
export function circleBlocked(level, x, y, r) {
  const col0 = Math.floor((x - r - ORIGIN_X) / TILE);
  const col1 = Math.floor((x + r - ORIGIN_X) / TILE);
  const row0 = Math.floor((y - r - ORIGIN_Y) / TILE);
  const row1 = Math.floor((y + r - ORIGIN_Y) / TILE);
  for (let row = row0; row <= row1; row += 1) {
    for (let col = col0; col <= col1; col += 1) {
      if (!isSolidTile(tileAt(level, col, row))) continue;
      const tx0 = ORIGIN_X + col * TILE;
      const ty0 = ORIGIN_Y + row * TILE;
      const cx = Math.max(tx0, Math.min(x, tx0 + TILE));
      const cy = Math.max(ty0, Math.min(y, ty0 + TILE));
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < r * r) return true;
    }
  }
  return false;
}

// Breadth-first reachability from the player start over walkable tiles.
// Used by the self-test and by the level checker: a level is only fair
// when the exit and every gem can actually be reached.
export function reachableFromStart(level) {
  const start = findTile(level, 'P');
  const seen = new Set();
  if (!start) return seen;
  const queue = [start];
  seen.add(`${start.col},${start.row}`);
  while (queue.length > 0) {
    const cur = queue.shift();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = cur.col + dc;
      const nr = cur.row + dr;
      const key = `${nc},${nr}`;
      if (seen.has(key)) continue;
      if (isSolidTile(tileAt(level, nc, nr))) continue;
      seen.add(key);
      queue.push({ col: nc, row: nr });
    }
  }
  return seen;
}
