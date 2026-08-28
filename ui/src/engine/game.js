// 世界状态机：持有地图与实体，tick 驱动，输出场景图。
// 地图生成与长程寻路委托 native（LegendModule）；战斗/AI/掉落纯 JS。
import { MONSTERS, MAPS } from './monsters.js';
import { rollAttack, rollMonsterHit, SKILLS } from './combat.js';
import { rollDrop } from './loot.js';
import { grantXp, deriveStats } from './player.js';
import { randInt } from './rng.js';

export const PLAYER_SPEED = 3.2;      // tiles/s
export const PICKUP_DIST = 0.9;
export const MELEE_RANGE = 1.5;
export const DROP_TTL = 60000;        // 地面物品 60s 消失
const CORNER = 0.32;                  // 碰撞半径

function isWalkableTile(tiles, w, h, x, y) {
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  const c = tiles.charAt(y * w + x);
  return c === '.' || c === ',';
}

export function createWorld(native, player, mapId, seed) {
  const info = MAPS[mapId];
  const raw = native.genMap(seed >>> 0, mapId);
  const world = {
    mapId,
    mapName: info.name,
    safe: !!info.safe,
    w: raw.w,
    h: raw.h,
    tiles: raw.tiles,
    player,
    monsters: [],
    drops: [],
    effects: [],
    targetId: 0,
    path: [],
    pathAge: 0,
    stats: deriveStats(player),
    hp: 0,
    mp: 0,
    atkCdUntil: 0,
    cd: {},
    kills: 0,
    runGold: 0,
    bossKilled: false,
    dead: false,
    nextMobId: 1,
    seed
  };
  world.hp = world.stats.hpMax;
  world.mp = world.stats.mpMax;
  player.x = raw.spawn[0] + 0.5;
  player.y = raw.spawn[1] + 0.5;

  for (const m of raw.monsters) {
    world.monsters.push({
      id: world.nextMobId++,
      type: m[2],
      level: m[3],
      x: m[0] + 0.5,
      y: m[1] + 0.5,
      hp: MONSTERS[m[2]].hp,
      atkCdUntil: 0,
      aggro: false,
      stunUntil: 0,
      hitFlash: 0
    });
  }
  return world;
}

export function isWalkable(world, x, y) {
  return isWalkableTile(world.tiles, world.w, world.h, x, y);
}

function canStand(world, x, y) {
  return isWalkable(world, x - CORNER, y) && isWalkable(world, x + CORNER, y) &&
         isWalkable(world, x, y - CORNER) && isWalkable(world, x, y + CORNER);
}

function moveToward(world, ent, tx, ty, dist, dt) {
  const dx = tx - ent.x;
  const dy = ty - ent.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-4 || len <= dist * dt) { ent.x = tx; ent.y = ty; return true; }
  const step = dist * dt;
  let nx = ent.x + dx / len * step;
  let ny = ent.y + dy / len * step;
  if (canStand(world, nx, ny)) { ent.x = nx; ent.y = ny; }
  else if (canStand(world, nx, ent.y)) { ent.x = nx; }
  else if (canStand(world, ent.x, ny)) { ent.y = ny; }
  return false;
}

// 设置寻路目标（native A*）
export function setDestination(world, native, tx, ty) {
  const sx = Math.floor(world.player.x);
  const sy = Math.floor(world.player.y);
  const path = native.pathTo(sx, sy, tx, ty);
  if (path && path.length >= 2) {
    world.path = [];
    for (let i = 0; i < path.length; i += 2) {
      world.path.push({ x: path[i] + 0.5, y: path[i + 1] + 0.5 });
    }
  } else if (isWalkable(world, tx, ty)) {
    world.path = [{ x: tx + 0.5, y: ty + 0.5 }];
  }
  world.targetId = 0;
}

export function setTarget(world, mobId) {
  world.targetId = mobId;
  world.path = [];
}

function findMob(world, id) {
  for (const m of world.monsters) if (m.id === id) return m;
  return null;
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function addEffect(world, kind, x, y, text) {
  world.effects.push({ kind, x, y, text: text || '', t: 0 });
  if (world.effects.length > 24) world.effects.splice(0, world.effects.length - 24);
}

function killMonster(world, mob, run) {
  const mon = MONSTERS[mob.type];
  world.kills += 1;
  if (mon.boss) world.bossKilled = true;
  const xpGain = Math.round(mon.xp * (1 + world.stats.xpPct / 100));
  grantXp(world.player, xpGain);
  world.stats = deriveStats(world.player);
  world.hp = Math.min(world.hp, world.stats.hpMax);
  const drop = rollDrop(run.rng, mob.type, world.stats.mfPct);
  if (drop.gold > 0) world.drops.push({ id: 'g' + mob.id + '_' + world.kills, x: mob.x, y: mob.y, gold: drop.gold, expire: run.now + DROP_TTL });
  if (drop.potion) world.drops.push({ id: 'p' + mob.id + '_' + world.kills, x: mob.x + 0.3, y: mob.y, potion: drop.potion, expire: run.now + DROP_TTL });
  if (drop.ore) world.drops.push({ id: 'o' + mob.id + '_' + world.kills, x: mob.x - 0.3, y: mob.y + 0.2, ore: drop.ore, expire: run.now + DROP_TTL });
  if (drop.item) world.drops.push({ id: 'i' + mob.id + '_' + world.kills, x: mob.x, y: mob.y + 0.35, item: drop.item, expire: run.now + DROP_TTL });
  addEffect(world, 'xp', mob.x, mob.y, '+' + xpGain + 'exp');
  world.monsters = world.monsters.filter(m => m.id !== mob.id);
  if (world.targetId === mob.id) world.targetId = 0;
}

function playerAttackMob(world, mob, mult, run) {
  const mon = MONSTERS[mob.type];
  const res = rollAttack(world.stats, run.rng, mon.def, 5, mult);
  if (res.miss) { addEffect(world, 'miss', mob.x, mob.y, 'miss'); return; }
  mob.hp -= res.dmg;
  mob.hitFlash = run.now + 120;
  mob.aggro = true;
  if (res.leech > 0) world.hp = Math.min(world.stats.hpMax, world.hp + res.leech);
  addEffect(world, 'dmg', mob.x, mob.y, String(res.dmg));
  if (mob.hp <= 0) killMonster(world, mob, run);
}

// 主 tick：dt 秒
export function tick(world, native, run, input) {
  if (world.dead) return;
  const dt = run.dt;
  const now = run.now;
  const p = world.player;

  // —— 玩家移动 ——
  let moved = false;
  if (input.move && (input.move.dx || input.move.dy)) {
    world.path = [];
    const len = Math.sqrt(input.move.dx * input.move.dx + input.move.dy * input.move.dy) || 1;
    moveToward(world, p, p.x + input.move.dx / len, p.y + input.move.dy / len, PLAYER_SPEED, dt);
    moved = true;
  } else if (world.path.length) {
    const wp = world.path[0];
    if (moveToward(world, p, wp.x, wp.y, PLAYER_SPEED, dt)) world.path.shift();
    moved = true;
  }
  // 走出地图保护
  p.x = Math.max(0.5, Math.min(world.w - 0.5, p.x));
  p.y = Math.max(0.5, Math.min(world.h - 0.5, p.y));

  // —— 玩家攻击（普攻自动，技能由 cast() 处理） ——
  const target = world.targetId ? findMob(world, world.targetId) : null;
  if (target && now >= world.atkCdUntil && dist(p, target) <= MELEE_RANGE + 0.2) {
    world.atkCdUntil = now + world.stats.atkInterval * 1000;
    playerAttackMob(world, target, 1.0, run);
  }

  // —— 怪物 AI ——
  for (const mob of world.monsters) {
    const mon = MONSTERS[mob.type];
    if (!mon.aggro) continue; // 鸡鹿被动
    const d = dist(mob, p);
    if (!mob.aggro && d <= mon.aggro) mob.aggro = true;
    if (!mob.aggro) continue;
    if (now < mob.stunUntil) continue;

    const inRange = mon.ranged ? (d <= mon.ranged && d >= 1.2) : (d <= MELEE_RANGE);
    if (inRange) {
      if (now >= mob.atkCdUntil) {
        mob.atkCdUntil = now + mon.atkInterval * 1000;
        const res = rollMonsterHit(mon, world.stats, run.rng, world.stats.eva);
        if (res.miss) addEffect(world, 'miss', p.x, p.y, 'miss');
        else {
          world.hp -= res.dmg;
          addEffect(world, 'hurt', p.x, p.y, '-' + res.dmg);
          if (world.hp <= 0) { world.hp = 0; world.dead = true; addEffect(world, 'die', p.x, p.y, '你被击倒了'); }
        }
      }
    } else if (d > (mon.ranged ? mon.ranged * 0.8 : MELEE_RANGE * 0.8)) {
      moveToward(world, mob, p.x, p.y, mon.speed * 1.6, dt);
    }
  }

  // —— 拾取 ——
  if (!world.safe) {
    const remain = [];
    for (const d of world.drops) {
      if (now > d.expire) continue;
      if (dist(d, p) <= PICKUP_DIST) {
        if (d.gold) { world.player.gold += d.gold; world.runGold += d.gold; addEffect(world, 'gold', d.x, d.y, '+' + d.gold); continue; }
        if (d.ore) { world.player.ore += d.ore; addEffect(world, 'gold', d.x, d.y, '黑铁矿+' + d.ore); continue; }
        if (d.potion) {
          const cap = d.potion === 'hp_s' ? 9 : 9;
          if ((world.player.potions[d.potion] || 0) < cap) { world.player.potions[d.potion] = (world.player.potions[d.potion] || 0) + 1; addEffect(world, 'gold', d.x, d.y, '拾到药水'); continue; }
        }
        if (d.item) {
          if (world.player.inventory.length < 24) { world.player.inventory.push(d.item); addEffect(world, 'loot', d.x, d.y, d.item.name); continue; }
        }
      }
      remain.push(d);
    }
    world.drops = remain;
  }

  // —— 特效老化 ——
  const fx = [];
  for (const e of world.effects) {
    e.t += dt;
    if (e.t < 0.9) fx.push(e);
  }
  world.effects = fx;
  void moved;
}

// 施放技能
export function cast(world, key, run) {
  const sk = SKILLS[key];
  if (!sk || world.dead) return { ok: false, reason: '无此技能' };
  if (!world.player.skillUnlocks[key]) return { ok: false, reason: '未解锁' };
  if ((world.cd[key] || 0) > run.now) return { ok: false, reason: '冷却中' };
  if (world.mp < sk.mp) return { ok: false, reason: '魔法不足' };
  world.mp -= sk.mp;
  world.cd[key] = run.now + sk.cd * 1000;

  const p = world.player;
  if (sk.aoe) {
    let hitAny = false;
    for (const mob of world.monsters.slice()) {
      if (dist(mob, p) <= sk.aoe + 0.3) { playerAttackMob(world, mob, sk.mult, run); hitAny = true; }
    }
    addEffect(world, 'aoe', p.x, p.y, sk.name);
    return { ok: hitAny };
  }
  let target = world.targetId ? findMob(world, world.targetId) : null;
  if (!target) {
    let best = null;
    let bestD = 3.2;
    for (const mob of world.monsters) {
      const d = dist(mob, p);
      if (d < bestD) { bestD = d; best = mob; }
    }
    target = best;
  }
  if (!target) return { ok: false, reason: '无目标' };
  if (sk.stun) target.stunUntil = run.now + sk.stun * 1000;
  playerAttackMob(world, target, sk.mult, run);
  addEffect(world, 'skill', p.x, p.y, sk.name);
  return { ok: true };
}

// 使用药水（快捷栏固定小金创/小魔法）
export function quickPotion(world, kind) {
  const key = kind === 'hp' ? 'hp_s' : 'mp_s';
  if ((world.player.potions[key] || 0) <= 0) return { ok: false, reason: '没有药水' };
  world.player.potions[key] -= 1;
  if (kind === 'hp') world.hp = Math.min(world.stats.hpMax, world.hp + 35);
  else world.mp = Math.min(world.stats.mpMax, world.mp + 18);
  return { ok: true };
}

export function nearestMob(world, maxDist) {
  let best = null;
  let bestD = maxDist || 6;
  for (const mob of world.monsters) {
    const d = dist(mob, world.player);
    if (d < bestD) { bestD = d; best = mob; }
  }
  return best;
}
