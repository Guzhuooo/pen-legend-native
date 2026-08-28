// 掉落结算（DESIGN.md 第 7 节）
import { randInt, rollChance, pick } from './rng.js';
import { makeItem, POTIONS } from './items.js';
import { MONSTERS } from './monsters.js';

// gold / 药水 / 矿石 / 装备 一次 roll。mfPct 提升装备与品质。
export function rollDrop(rng, monType, mfPct) {
  const mon = MONSTERS[monType];
  const out = { gold: 0, potion: null, ore: 0, item: null };

  out.gold = mon.level * randInt(rng, 2, 5);
  if (mon.boss) out.gold = Math.round(out.gold * 8);

  const potionChance = mon.boss ? 60 : 16;
  if (rollChance(rng, potionChance)) {
    const pool = [];
    for (const key in POTIONS) {
      const p = POTIONS[key];
      if (p.drop > 0) for (let i = 0; i < p.drop; i++) pool.push(key);
    }
    out.potion = pick(rng, pool);
  }

  const oreChance = mon.boss ? 100 : 8;
  if (rollChance(rng, oreChance)) out.ore = mon.boss ? randInt(rng, 2, 4) : 1;

  const itemChance = (mon.boss ? 100 : 12) * (1 + mfPct / 100);
  if (rollChance(rng, itemChance)) {
    const bonus = mon.boss ? 2 : 0; // Boss 保底蓝以上
    out.item = makeItem(rng, mon.level, mon.boss && rollChance(rng, 25) ? 'epic' : (bonus ? 'magic' : undefined));
  }
  return out;
}
