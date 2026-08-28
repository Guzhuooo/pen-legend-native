// 引擎纯逻辑冒烟测试（node test/engine-smoke.mjs）
import assert from 'node:assert';
import { createRng, randInt } from '../ui/src/engine/rng.js';
import { xpNeed, createPlayer, grantXp, spendPoint, deriveStats, tryReforge } from '../ui/src/engine/player.js';
import { makeItem, WEAPONS, QUALITIES } from '../ui/src/engine/items.js';
import { rollAttack } from '../ui/src/engine/combat.js';
import { rollDrop } from '../ui/src/engine/loot.js';
import { MONSTERS } from '../ui/src/engine/monsters.js';
import { createWorld, tick, cast, lockNearest, quickPotion, tapMove, isWalkable } from '../ui/src/engine/game.js';
import { normalizePlayer } from '../ui/src/save.js';

let passed = 0;
function ok(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.error('  ✗ ' + name + ': ' + e.message); process.exitCode = 1; }
}

console.log('[xp 曲线]');
ok('Lv2 需要 20', () => assert.equal(xpNeed(1), 20));
ok('Lv10 需要 1590', () => assert.equal(xpNeed(9), Math.round(20 * Math.pow(9, 1.9))));
ok('满级 Infinity', () => assert.equal(xpNeed(30), Infinity));

console.log('[成长]');
ok('连升两级 + 6 点', () => {
  const p = createPlayer();
  const g = grantXp(p, xpNeed(1) + xpNeed(2));
  assert.equal(p.level, 3);
  assert.equal(g.levels, 2);
  assert.equal(p.statPoints, 6);
});
ok('加点消耗', () => {
  const p = createPlayer();
  p.statPoints = 2;
  assert.ok(spendPoint(p, 'str'));
  assert.equal(p.base.str, 1);
  assert.equal(p.statPoints, 1);
  assert.ok(!spendPoint(p, 'luck'));
});
ok('体力点加血', () => {
  const p = createPlayer();
  const s0 = deriveStats(p).hpMax;
  p.base.vit = 5;
  assert.equal(deriveStats(p).hpMax, s0 + 40);
});

console.log('[装备聚合]');
ok('武器与词缀生效', () => {
  const p = createPlayer();
  const s0 = deriveStats(p);
  p.equipped[0] = {
    kind: 'equip', slot: 0, baseKey: 'iron_sword', name: '铁剑', req: 4, ilvl: 5,
    quality: 'magic', atkMin: 3, atkMax: 6, def: 0, plus: 1,
    affixes: [{ key: 'vit', name: '体力', stat: 'vit', value: 3 }, { key: 'atk', name: '锋利', stat: 'atkFlat', value: 2 }]
  };
  const s1 = deriveStats(p);
  assert.equal(s1.atkMin, s0.atkMin - 1 + Math.round(3 * 1.12) + 2); // 木剑1→铁剑3(+12%)
  assert.equal(s1.hpMax, s0.hpMax + 24);
});
ok('+7 上限与矿石消耗', () => {
  const p = createPlayer();
  p.gold = 100000;
  p.ore = 10;
  const item = { kind: 'equip', slot: 0, plus: 6, atkMin: 3, atkMax: 6, affixes: [] };
  const r = tryReforge(p, item, createRng(7), 1, 100);
  assert.ok(r.ok);
  assert.ok(r.success); // +6 → +7 概率 20%？不，rng(7) 固定——只断言合法性
  assert.ok(item.plus === 7 || item.plus === 6);
  assert.equal(p.ore, 9);
});
ok('满 +7 拒绝', () => {
  const p = createPlayer();
  const r = tryReforge(p, { slot: 0, plus: 7, affixes: [] }, createRng(1), 1, 1);
  assert.ok(!r.ok);
});

console.log('[物品生成]');
ok('1000 件：品质分布与词缀规则', () => {
  const rng = createRng(42);
  const counts = { white: 0, magic: 0, rare: 0, epic: 0 };
  for (let i = 0; i < 1000; i++) {
    const it = makeItem(rng, 10);
    counts[it.quality]++;
    assert.ok(it.slot >= 0 && it.slot <= 5);
    if (it.quality === 'white') assert.equal(it.affixes.length, 0);
    else assert.ok(it.affixes.length >= 1);
  }
  assert.ok(counts.white > 500, '白色应过半: ' + JSON.stringify(counts));
  assert.ok(counts.magic > counts.rare, '蓝多于金');
});
ok('武器池按等级过滤', () => {
  const rng = createRng(9);
  for (let i = 0; i < 50; i++) {
    const it = makeItem(rng, 1);
    if (it.slot === 0) assert.ok(it.req <= 3);
  }
});

console.log('[战斗与掉落]');
ok('伤害至少 1、可闪避', () => {
  const rng = createRng(3);
  const stats = { atkMin: 10, atkMax: 20, acc: 85, leechPct: 10 };
  let miss = 0;
  for (let i = 0; i < 200; i++) {
    const r = rollAttack(stats, rng, 4, 10, 1);
    if (r.miss) miss++;
    else { assert.ok(r.dmg >= 1); assert.ok(r.leech <= r.dmg); }
  }
  assert.ok(miss > 0 && miss < 200);
});
ok('掉落必有钱、概率合理', () => {
  const rng = createRng(11);
  let items = 0;
  for (let i = 0; i < 1000; i++) {
    const d = rollDrop(rng, 3, 0);
    assert.ok(d.gold > 0);
    if (d.item) items++;
  }
  assert.ok(items > 60 && items < 220, '装备率 12%±: ' + items / 10 + '%');
});
ok('Boss 必掉装备', () => {
  const rng = createRng(5);
  for (let i = 0; i < 30; i++) {
    const d = rollDrop(rng, 8, 0);
    assert.ok(d.item, '沃玛教主必掉');
  }
});

console.log('[世界状态机]');
function stubNative(tiles) {
  // v2 替身：全地板 20x20，怪物静态、按需被击杀
  const w = 20, h = 20;
  const T = tiles || '.'.repeat(w * h);
  const mobs = [[1, 3, 3, 3.5, 3.5, 10, 10, 0], [2, 3, 3, 12.5, 12.5, 10, 10, 0]];
  let killed = 0;
  return {
    initWorld(seed, mapId) { return { w, h, mapId, tiles: T, spawn: [10, 10], monsters: [[3, 3, 3, 3], [12, 12, 3, 3]] }; },
    setPlayerStats() {},
    setDestination(tx, ty) { return true; },
    setMoveDir(dx, dy) { this.dx = dx; this.dy = dy; },
    tick(now, dt) {
      // 模拟移动
      if (this.dx) { this.px = (this.px || 10.5) + this.dx * 3.2 * dt; }
      return { px: this.px || 10.5, py: this.py || 10.5, events: this.events || [] };
    },
    playerAttack(mult, now, range) {
      if (killed === 0) { killed = 1; return [1, 0, 1, 1, 9, 0, 3.5, 3.5, 3, 3]; }
      return [1, 0, 0, 1, 5, 0, 3.5, 3.5, 3, 3];
    },
    castAoe() { return []; },
    getVisibleMobs() { return killed ? [] : mobs; },
    getPos() { return [this.px || 10.5, this.py || 10.5]; },
    pathTo() { return []; },
    genMap() { return this.initWorld(1, 1); }
  };
}
ok('移动与拾取', () => {
  const p = createPlayer();
  const stub = stubNative();
  const w = createWorld(stub, p, 1, 1);
  assert.ok(isWalkable(w, 10, 10));
  w.drops.push({ id: 'g1', x: 10.5, y: 10.5, gold: 7, expire: 9e15 });
  for (let i = 0; i < 10; i++) tick(w, stub, { dt: 0.05, now: i * 50, rng: createRng(i), native: stub }, { move: { dx: 0, dy: 0 } });
  assert.equal(p.gold, 50 + 7);
});
ok('方向移动（native 驱动）', () => {
  const p = createPlayer();
  const stub = stubNative();
  const w = createWorld(stub, p, 1, 1);
  for (let i = 0; i < 20; i++) tick(w, stub, { dt: 0.05, now: i * 50, rng: createRng(i), native: stub }, { move: { dx: 1, dy: 0 } });
  assert.ok(w.px > 12, 'x 应增长: ' + w.px);
});
ok('点击寻路', () => {
  const p = createPlayer();
  const stub = stubNative();
  const w = createWorld(stub, p, 1, 1);
  w.targetId = 5;
  assert.equal(tapMove(w, stub, 5, 5), true);
  assert.equal(w.targetId, 0);
});
ok('锁定最近怪', () => {
  const p = createPlayer();
  const stub = stubNative();
  const w = createWorld(stub, p, 1, 1);
  const m = lockNearest(w, stub);
  assert.ok(m, '应锁到 mob2');
  assert.equal(w.targetId, m[0]);
});
ok('击杀事件 → 经验/掉落', () => {
  const p = createPlayer();
  const stub = stubNative();
  const w = createWorld(stub, p, 2, 1);
  w.targetId = 1;
  stub.events = [[2, 1, 3, 3, 3.5, 3.5, 0, 0]];
  tick(w, stub, { dt: 0.05, now: 1000, rng: createRng(2), native: stub }, { move: { dx: 0, dy: 0 } });
  assert.equal(w.targetId, 0);
  assert.ok(p.xp > 0, '应有经验');
  assert.ok(w.drops.length >= 1, '应有掉落');
});
ok('技能：未解锁被拒、蓝不够被拒', () => {
  const p = createPlayer();
  const stub = stubNative();
  const w = createWorld(stub, p, 2, 1);
  const r1 = cast(w, stub, 'liehuo', { dt: 0.05, now: 0, rng: createRng(1), native: stub });
  assert.ok(!r1.ok);
  p.skillUnlocks.gongsha = true;
  w.mp = 0;
  const r2 = cast(w, stub, 'gongsha', { dt: 0.05, now: 0, rng: createRng(1), native: stub });
  assert.ok(!r2.ok);
});
ok('药水', () => {
  const p = createPlayer();
  const w = createWorld(stubNative(), p, 0, 1);
  w.hp = 10;
  const r = quickPotion(w, 'hp');
  assert.ok(r.ok);
  assert.ok(w.hp > 10);
  assert.equal(p.potions.hp_s, 2);
});

console.log('[存档容错]');
ok('坏档归一化', () => {
  const p = normalizePlayer({ version: 1, player: { level: 999, gold: -5, mapId: 99, inventory: 'x', potions: { hp_s: 100 }, equipped: { 0: { kind: 'equip', slot: 0 } } } }, createPlayer);
  assert.equal(p.level, 30);
  assert.equal(p.gold, 0);
  assert.equal(p.mapId, 4);
  assert.deepEqual(p.inventory, []);
  assert.equal(p.potions.hp_s, 9);
  assert.ok(p.equipped[0] === null);
});
ok('空档 → 新档', () => {
  const p = normalizePlayer(null, createPlayer);
  assert.equal(p.level, 1);
  assert.equal(p.gold, 50);
});

console.log(passed + ' 项全部通过' + (process.exitCode ? '（存在失败）' : ''));
