// 世界适配层：怪物 AI / 移动 / 战斗结算都在 native（LegendCore）。
// 这里只管理：掉落物、特效、击杀结算（经验/金币/掉落 roll）、玩家血蓝。
import { MONSTERS, MAPS } from './monsters.js';
import { rollDrop } from './loot.js';
import { grantXp, deriveStats } from './player.js';

export const PICKUP_DIST = 0.9;
export const MELEE_RANGE = 1.6;
export const DROP_TTL = 60000;

function isWalkableTile(tiles, w, h, x, y) {
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  const c = tiles.charAt(y * w + x);
  return c === '.' || c === ',';
}

export function createWorld(native, player, mapId, seed) {
  const info = MAPS[mapId];
  const raw = native.initWorld(seed >>> 0, mapId);
  const world = {
    mapId,
    mapName: info.name,
    safe: !!info.safe,
    w: raw.w,
    h: raw.h,
    tiles: raw.tiles,
    player,
    drops: [],
    effects: [],
    targetId: 0,
    stats: deriveStats(player),
    hp: 0,
    mp: 0,
    atkCdUntil: 0,
    cd: {},
    kills: 0,
    runGold: 0,
    bossKilled: false,
    dead: false,
    px: raw.spawn[0] + 0.5,
    py: raw.spawn[1] + 0.5,
    seed
  };
  syncStats(world, native);
  world.hp = world.stats.hpMax;
  world.mp = world.stats.mpMax;
  return world;
}

export function syncStats(world, native) {
  world.stats = deriveStats(world.player);
  world.hp = Math.min(world.hp || world.stats.hpMax, world.stats.hpMax);
  try {
    native.setPlayerStats({
      atkMin: world.stats.atkMin,
      atkMax: world.stats.atkMax,
      acc: Math.round(world.stats.acc),
      eva: Math.round(world.stats.eva),
      def: world.stats.def,
      leechPct: Math.round(world.stats.leechPct)
    });
  } catch (e) {}
}

export function isWalkable(world, x, y) {
  return isWalkableTile(world.tiles, world.w, world.h, x, y);
}

// 点击寻路：屏幕点转世界格后由 native A*
export function tapMove(world, native, tx, ty) {
  world.targetId = 0;
  return native.setDestination(tx, ty);
}

export function setTarget(world, mobId) {
  world.targetId = mobId;
}

function addEffect(world, kind, x, y, text) {
  world.effects.push({ kind, x, y, text: text || '', t: 0 });
  if (world.effects.length > 24) world.effects.splice(0, world.effects.length - 24);
}

function killMonster(world, run, ev) {
  const mon = MONSTERS[ev.type];
  world.kills += 1;
  if (mon.boss) world.bossKilled = true;
  const xpGain = Math.round(mon.xp * (1 + world.stats.xpPct / 100));
  grantXp(world.player, xpGain);
  syncStats(world, run.native);
  world.hp = Math.min(world.hp, world.stats.hpMax);
  const drop = rollDrop(run.rng, ev.type, world.stats.mfPct);
  if (drop.gold > 0) world.drops.push({ id: 'g' + ev.mobId + '_' + world.kills, x: ev.x, y: ev.y, gold: drop.gold, expire: run.now + DROP_TTL });
  if (drop.potion) world.drops.push({ id: 'p' + ev.mobId + '_' + world.kills, x: ev.x + 0.3, y: ev.y, potion: drop.potion, expire: run.now + DROP_TTL });
  if (drop.ore) world.drops.push({ id: 'o' + ev.mobId + '_' + world.kills, x: ev.x - 0.3, y: ev.y + 0.2, ore: drop.ore, expire: run.now + DROP_TTL });
  if (drop.item) world.drops.push({ id: 'i' + ev.mobId + '_' + world.kills, x: ev.x, y: ev.y + 0.35, item: drop.item, expire: run.now + DROP_TTL });
  addEffect(world, 'xp', ev.x, ev.y, '+' + xpGain + 'exp');
}

export function visibleMobs(world, native) {
  try { return native.getVisibleMobs(24) || []; } catch (e) { return []; }
}

// 主 tick
export function tick(world, native, run, input) {
  if (world.dead) return;
  // 输入写入 native（方向/目标点）
  if (input.move && (input.move.dx || input.move.dy)) {
    native.setMoveDir(input.move.dx, input.move.dy);
    world.moving = true;
  } else if (world.moving) {
    native.setMoveDir(0, 0); // 只在松开那一刻发一次
    world.moving = false;
  }

  // 玩家自动攻击：有锁定且冷却好
  if (world.targetId && run.now >= world.atkCdUntil) {
    const r = native.playerAttack(1.0, run.now, MELEE_RANGE);
    applyAttack(world, run, r);
  }

  const res = native.tick(run.now, run.dt);
  world.px = res.px;
  world.py = res.py;

  for (const ev of res.events || []) {
    const kind = ev[0];
    if (kind === 0) {
      // 怪物攻击玩家
      if (!ev[7]) {
        world.hp -= ev[6];
        addEffect(world, 'hurt', world.px, world.py, '-' + ev[6]);
        if (world.hp <= 0) { world.hp = 0; world.dead = true; addEffect(world, 'die', world.px, world.py, '你被击倒了'); }
      } else {
        addEffect(world, 'miss', world.px, world.py, 'miss');
      }
    } else if (kind === 2) {
      killMonster(world, run, { mobId: ev[1], type: ev[2], level: ev[3], x: ev[4], y: ev[5] });
      if (world.targetId === ev[1]) world.targetId = 0;
    }
  }

  // 拾取
  if (!world.safe) {
    const remain = [];
    for (const d of world.drops) {
      if (run.now > d.expire) continue;
      const dx = d.x - world.px;
      const dy = d.y - world.py;
      if (dx * dx + dy * dy <= PICKUP_DIST * PICKUP_DIST) {
        if (d.gold) { world.player.gold += d.gold; world.runGold += d.gold; addEffect(world, 'gold', d.x, d.y, '+' + d.gold); continue; }
        if (d.ore) { world.player.ore += d.ore; addEffect(world, 'gold', d.x, d.y, '黑铁矿+' + d.ore); continue; }
        if (d.potion) {
          if ((world.player.potions[d.potion] || 0) < 9) { world.player.potions[d.potion] = (world.player.potions[d.potion] || 0) + 1; addEffect(world, 'gold', d.x, d.y, '拾到药水'); continue; }
        }
        if (d.item && world.player.inventory.length < 24) { world.player.inventory.push(d.item); addEffect(world, 'loot', d.x, d.y, d.item.name); continue; }
      }
      remain.push(d);
    }
    world.drops = remain;
  }

  // 特效老化
  const fx = [];
  for (const e of world.effects) {
    e.t += run.dt;
    if (e.t < 0.9) fx.push(e);
  }
  world.effects = fx;
}

function applyAttack(world, run, r) {
  // r = [ok, miss, killed, mobId, dmg, leech, x, y, type, level]
  if (!r || !r[0]) return;
  world.atkCdUntil = run.now + world.stats.atkInterval * 1000;
  if (r[1]) { addEffect(world, 'miss', r[6], r[7], 'miss'); return; }
  if (r[5] > 0) world.hp = Math.min(world.stats.hpMax, world.hp + r[5]);
  addEffect(world, 'dmg', r[6], r[7], String(r[4]));
}

// 施放技能
export function cast(world, native, key, run) {
  const SKILLS = { gongsha: { mult: 1.8, mp: 3, cd: 3 }, banyue: { mult: 1.3, mp: 8, cd: 6, aoe: 1.6 }, chongzhuang: { mult: 1.2, mp: 10, cd: 9, stun: 1 }, liehuo: { mult: 2.8, mp: 15, cd: 12 } };
  const sk = SKILLS[key];
  if (!sk || world.dead) return { ok: false, reason: '无此技能' };
  if (!world.player.skillUnlocks[key]) return { ok: false, reason: '未解锁' };
  if ((world.cd[key] || 0) > run.now) return { ok: false, reason: '冷却中' };
  if (world.mp < sk.mp) return { ok: false, reason: '魔法不足' };
  world.mp -= sk.mp;
  world.cd[key] = run.now + sk.cd * 1000;

  if (sk.aoe) {
    const results = native.castAoe(sk.mult, sk.aoe, run.now) || [];
    let hitAny = false;
    for (const r of results) {
      if (!r[0]) continue;
      hitAny = true;
      if (r[1]) { addEffect(world, 'miss', r[6], r[7], 'miss'); continue; }
      if (r[5] > 0) world.hp = Math.min(world.stats.hpMax, world.hp + r[5]);
      addEffect(world, 'dmg', r[6], r[7], String(r[4]));
      if (r[2]) { killMonster(world, run, { mobId: r[3], type: r[8], level: r[9], x: r[6], y: r[7] }); if (world.targetId === r[3]) world.targetId = 0; }
    }
    addEffect(world, 'aoe', world.px, world.py, '半月弯刀');
    return { ok: hitAny };
  }

  const r = native.playerAttack(sk.mult, run.now, 3.2);
  if (!r || !r[0]) return { ok: false, reason: '无目标' };
  if (r[1]) { addEffect(world, 'miss', r[6], r[7], 'miss'); return { ok: true }; }
  if (r[5] > 0) world.hp = Math.min(world.stats.hpMax, world.hp + r[5]);
  addEffect(world, 'dmg', r[6], r[7], String(r[4]));
  if (r[2]) { killMonster(world, run, { mobId: r[3], type: r[8], level: r[9], x: r[6], y: r[7] }); if (world.targetId === r[3]) world.targetId = 0; }
  return { ok: true };
}

// 锁定最近（可点击目标走这里 + 寻路接近由 native 完成）
export function lockNearest(world, native) {
  const mobs = visibleMobs(world, native);
  let best = null;
  let bestD = 64; // 8^2
  for (const m of mobs) {
    const dx = m[3] - world.px;
    const dy = m[4] - world.py;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) { bestD = d2; best = m; }
  }
  if (!best) return null;
  world.targetId = best[0];
  native.setDestination(Math.floor(best[3]), Math.floor(best[4]));
  return best;
}

export function quickPotion(world, kind) {
  const key = kind === 'hp' ? 'hp_s' : 'mp_s';
  if ((world.player.potions[key] || 0) <= 0) return { ok: false, reason: '没有药水' };
  world.player.potions[key] -= 1;
  if (kind === 'hp') world.hp = Math.min(world.stats.hpMax, world.hp + 35);
  else world.mp = Math.min(world.stats.mpMax, world.mp + 18);
  return { ok: true };
}
