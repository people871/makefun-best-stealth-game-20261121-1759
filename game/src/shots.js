// SHADOW LANTERN — deterministic screenshot staging + the self-test.
//
// ?shot=cover — The Gilded Vault mid-heist: the player sneaking in shadow
//   behind a crate, a guard's cone sweeping nearby, loot + EXIT visible,
//   HUD + minimap + detection meter live. The cover.
// ?shot=title — the title screen with the three level cards.
// ?shot=alert — a guard chasing, RED cone, "SPOTTED!" banner, the meter
//   nearly full.
// ?shot=win   — level complete: "GHOST — unseen", loot, score, time.
// ?selftest=1 — a scripted play-through; results land in window.__selftest.
//
// In shot mode the game is frozen (no clock, no patrol drift) so the
// capture is deterministic for a fixed seed.
import { Game } from './main.js';
import { tileToPixel } from './guards.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);
window.__game = game;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const selftest = params.get('selftest') === '1';

// Hold every guard still (a staring guard neither patrols nor chases),
// so a measurement depends only on the thing being measured.
function freezeGuards() {
  for (const guard of game.guards) {
    guard.state = 'suspicious';
    guard.investigate = null;
    guard.pauseTimer = 0;
  }
}

// Park guards 1 and 2 far from the action (bottom-left corner, facing
// away) so only guard 0 can possibly see the player in a vision test.
function parkOtherGuards() {
  placeGuard(1, 2, 14, 0);
  placeGuard(2, 2, 13, 0);
}

function placeGuard(index, col, row, facing) {
  const guard = game.guards[index];
  const p = tileToPixel(col, row);
  guard.x = p.x;
  guard.y = p.y;
  guard.facing = facing;
  guard.state = 'suspicious';
  guard.investigate = null;
  guard.pauseTimer = 0;
  return guard;
}

function placePlayer(col, row) {
  const p = tileToPixel(col, row);
  game.player.x = p.x;
  game.player.y = p.y;
}

function press(code) {
  game.input.keys.add(code);
}

function release(code) {
  game.input.keys.delete(code);
}

function stageShot(name) {
  game.frozen = true;
  if (name === 'title') {
    game.state = 'title';
  } else if (name === 'cover') {
    // The Gilded Vault: player sneaking in shadow at (14,3), a crate just
    // below, guard 0 sweeping left toward them, 2 gems already pocketed.
    game.startLevel(1);
    game.frozen = true;
    placePlayer(14, 3);
    placeGuard(0, 18, 3, Math.PI);
    game.loot[0].taken = true;
    game.loot[1].taken = true;
    game.lootCollected = 2;
    game.score = 200;
    game.detection = 35;
    game.coinsLeft = 2;
    game.timeLeft = 247;
    game.showMessage('Shadow hides you — the cone is sweeping closer…');
    game.messageTimer = 99;
  } else if (name === 'alert') {
    // Moonlit Museum: guard 0 charging down the hall, red cone, SPOTTED.
    game.startLevel(0);
    game.frozen = true;
    placePlayer(15, 8);
    const guard = placeGuard(0, 12, 8, 0);
    guard.state = 'chase';
    game.detection = 95;
    game.spottedCount = 1;
    game.spottedFlash = 1.6;
    game.timeLeft = 213;
    game.showMessage('SPOTTED! Break line of sight!');
    game.messageTimer = 99;
  } else if (name === 'win') {
    // Moonlit Museum cleared unseen: all 4 gems, GHOST rating, big score.
    game.startLevel(0);
    game.frozen = true;
    for (const loot of game.loot) loot.taken = true;
    game.lootCollected = 4;
    game.score = 400;
    game.timeLeft = 187;
    placePlayer(game.exitTile.col, game.exitTile.row);
    game.winLevel();
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { window.__shotReady = true; });
  });
}

function runSelftest() {
  const checks = {};
  const step = (name, ok) => { checks[name] = !!ok; };
  try {
    step('startsOnTitle', game.state === 'title');

    // Start level 1 from the title with the keyboard.
    game.onKey('1');
    step('startLevel1ViaKey', game.state === 'playing' && game.levelIndex === 0);
    step('level1Has4Loot', game.lootTotal === 4);
    step('level1Has3Guards', game.guards.length === 3);

    // Movement: walk right, then sneak right — sneak must be slower.
    game.frozen = true;
    freezeGuards();
    placePlayer(5, 14);
    const x0 = game.player.x;
    press('KeyD');
    game.update(0.5);
    release('KeyD');
    const walkDist = game.player.x - x0;
    step('playerMovesRight', walkDist > 50);
    game.player.x = x0;
    press('KeyD');
    press('ShiftLeft');
    game.update(0.5);
    release('KeyD');
    release('ShiftLeft');
    const sneakDist = game.player.x - x0;
    step('sneakSlowerThanWalk', sneakDist > 10 && sneakDist < walkDist * 0.8);

    // A wall stops the player cold.
    placePlayer(5, 1);
    press('KeyD');
    game.update(0.5);
    release('KeyD');
    step('wallBlocksMovement', game.player.x < 235);

    // A guard patrols its waypoints.
    game.startLevel(0);
    game.frozen = true;
    const g0 = game.guards[0];
    const gx0 = g0.x;
    const gy0 = g0.y;
    game.update(1.5);
    step('guardPatrolsWaypoints', Math.hypot(g0.x - gx0, g0.y - gy0) > 10);

    // The cone spots the player in the open…
    game.detection = 0;
    placeGuard(0, 12, 8, 0);
    parkOtherGuards();
    placePlayer(15, 8);
    game.update(0.5);
    const openDetection = game.detection;
    step('coneDetectsInOpen', openDetection > 10);

    // …but shadow slows the fill a lot. (Shadow tiles on row 3 are
    // columns 12–13, so the player stands on column 13.)
    game.detection = 0;
    placeGuard(0, 11, 3, 0);
    parkOtherGuards();
    placePlayer(13, 3);
    game.update(0.5);
    const shadowDetection = game.detection;
    step('shadowReducesDetection', shadowDetection > 0 && shadowDetection < openDetection);

    // A bush hides the player entirely at range.
    game.detection = 0;
    placeGuard(0, 17, 7, Math.PI);
    parkOtherGuards();
    placePlayer(20, 7);
    game.update(0.5);
    step('bushHidesPlayer', game.detection === 0);

    // A crate blocks line of sight.
    game.detection = 0;
    placeGuard(0, 12, 9, 0);
    parkOtherGuards();
    placePlayer(17, 9);
    game.update(0.5);
    step('crateBlocksSight', game.detection === 0);

    // A thrown coin distracts the nearest guard to the landing spot.
    game.startLevel(0);
    game.frozen = true;
    placePlayer(9, 2);
    const coinsBefore = game.coinsLeft;
    game.throwCoin(game.guards[0].x + 30, game.guards[0].y);
    step('coinThrowSpendsOne', game.coinsLeft === coinsBefore - 1);
    game.update(0.6);
    step('coinDistractsGuard', game.guards[0].state === 'suspicious'
      && game.guards[0].investigate !== null);

    // Loot pickup increments the count and the score.
    const loot0 = game.loot[0];
    game.player.x = loot0.x;
    game.player.y = loot0.y;
    const scoreBefore = game.score;
    game.update(0.1);
    step('lootPickupIncrements', game.lootCollected === 1 && game.score === scoreBefore + 100);

    // A full detection meter means SPOTTED and a chase.
    game.detection = 99;
    placeGuard(0, 12, 8, 0);
    parkOtherGuards();
    placePlayer(15, 8);
    const spottedBefore = game.spottedCount;
    game.update(0.5);
    step('detectionMaxSpots', game.spottedCount === spottedBefore + 1
      && game.guards[0].state === 'chase');

    // A chasing guard that touches the player catches them.
    game.startLevel(0);
    game.frozen = true;
    const chaser = game.guards[0];
    chaser.state = 'chase';
    chaser.x = game.player.x;
    chaser.y = game.player.y;
    game.update(0.1);
    step('caughtLoses', game.state === 'lost' && game.loseReason === 'caught');

    // Reaching the exit wins the level, unseen = GHOST.
    game.startLevel(0);
    game.frozen = true;
    game.player.x = game.exitPos.x;
    game.player.y = game.exitPos.y;
    game.update(0.1);
    step('exitWinsLevel', game.state === 'won');
    step('ratingGhostWhenUnseen', game.rating === 'GHOST');
    step('scoreIncludesTimeBonus', game.score > 600);
    step('bestSaved', game.bestByLevel[0] === game.score);

    // Pause freezes the clock; resume restarts it.
    game.startLevel(0);
    game.frozen = true;
    game.onKey('p');
    step('pauses', game.state === 'paused');
    const frozenTime = game.timeLeft;
    game.update(1.0);
    step('clockStopsWhenPaused', game.timeLeft === frozenTime);
    game.onKey('p');
    step('resumes', game.state === 'playing');

    // Restart resets everything.
    game.score = 999;
    game.lootCollected = 2;
    game.onKey('r');
    step('restartResets', game.state === 'playing' && game.score === 0
      && game.lootCollected === 0 && game.detection === 0
      && game.timeLeft === game.level.timeLimit);

    // Mute toggles.
    const mutedBefore = game.audio.muted;
    game.onKey('m');
    step('muteToggles', game.audio.muted !== mutedBefore);
    game.onKey('m');

    // Level select, level 2 and level 3.
    game.onKey('l');
    step('backToTitleViaL', game.state === 'title');
    game.onKey('2');
    step('startLevel2', game.levelIndex === 1 && game.lootTotal === 6);
    game.startLevel(2);
    step('level3Has8LootAnd4Coins', game.lootTotal === 8 && game.coinsLeft === 4);

    // The clock running out loses the level.
    game.timeLeft = 0.05;
    game.update(0.2);
    step('timerRunsOut', game.state === 'lost' && game.loseReason === 'time');

    const names = Object.keys(checks);
    checks.passed = names.filter((k) => checks[k]).length;
    checks.total = names.length;
  } catch (e) {
    checks.error = String(e);
  }
  window.__selftest = checks;
}

if (selftest) {
  game.frozen = true;
  runSelftest();
} else if (shot) {
  stageShot(shot);
}
