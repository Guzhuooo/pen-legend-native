// 物品系统：基础表 / 词缀 / 品质 / 生成器（DESIGN.md 第 7 节数值）
import { randInt, pick, rollChance } from './rng.js';

// 部位：0武器 1头盔 2衣服 3项链 4戒指 5靴子
export const SLOTS = ['武器', '头盔', '衣服', '项链', '戒指', '靴子'];

// 武器基础：需求等级 → 攻击区间
export const WEAPONS = [
  { key: 'wood_sword', name: '木剑', req: 1, atkMin: 1, atkMax: 2 },
  { key: 'short_sword', name: '短剑', req: 2, atkMin: 2, atkMax: 4 },
  { key: 'iron_sword', name: '铁剑', req: 4, atkMin: 3, atkMax: 6 },
  { key: 'bronze_axe', name: '青铜斧', req: 6, atkMin: 4, atkMax: 8 },
  { key: 'shura', name: '修罗', req: 9, atkMin: 6, atkMax: 12 },
  { key: 'purgatory', name: '炼狱', req: 12, atkMin: 8, atkMax: 15 },
  { key: 'woma_blade', name: '沃玛战刃', req: 14, atkMin: 9, atkMax: 17 },
  { key: 'verdant', name: '裁决之杖', req: 15, atkMin: 11, atkMax: 20 },
  { key: 'slaughter', name: '屠龙', req: 18, atkMin: 16, atkMax: 30 }
];

// 防具/饰品基础：需求等级 → 防御
export const ARMORS = {
  1: [
    { key: 'cloth_hood', name: '布帽', req: 1, def: 1 },
    { key: 'cloth_robe', name: '布衣', req: 1, def: 1 },
    { key: 'leather_boots', name: '皮靴', req: 1, def: 1 },
    { key: 'bone_neck', name: '骨珠项链', req: 2, def: 1 },
    { key: 'bone_ring', name: '骨戒', req: 2, def: 1 }
  ],
  5: [
    { key: 'leather_cap', name: '皮帽', req: 5, def: 3 },
    { key: 'leather_armor', name: '皮甲', req: 5, def: 3 },
    { key: 'leather_boots2', name: '猎手靴', req: 5, def: 2 },
    { key: 'jade_neck', name: '翡翠项链', req: 6, def: 2 },
    { key: 'jade_ring', name: '翡翠戒指', req: 6, def: 2 }
  ],
  9: [
    { key: 'light_helm', name: '轻盔', req: 9, def: 5 },
    { key: 'light_armor', name: '轻型盔甲', req: 9, def: 5 },
    { key: 'iron_boots', name: '铁履靴', req: 9, def: 4 },
    { key: 'woma_neck', name: '沃玛项链', req: 10, def: 3 },
    { key: 'woma_ring', name: '沃玛戒指', req: 10, def: 3 }
  ],
  14: [
    { key: 'woma_helm', name: '沃玛头盔', req: 14, def: 8 },
    { key: 'woma_armor', name: '沃玛战甲', req: 14, def: 8 },
    { key: 'woma_boots', name: '沃玛战靴', req: 14, def: 6 },
    { key: 'zuma_neck', name: '祖玛项链', req: 15, def: 4 },
    { key: 'zuma_ring', name: '祖玛戒指', req: 15, def: 4 }
  ],
  18: [
    { key: 'zuma_helm', name: '祖玛头盔', req: 18, def: 11 },
    { key: 'zuma_armor', name: '祖玛战甲', req: 18, def: 11 },
    { key: 'dragon_boots', name: '龙纹靴', req: 18, def: 8 }
  ]
};

// 词缀池：key/名称/效果范围（按 ilvl 缩放）
export const AFFIXES = [
  { key: 'atk', name: '锋利', stat: 'atkFlat', base: 1, perLvl: 0.35, slots: [0] },
  { key: 'str', name: '力量', stat: 'str', base: 1, perLvl: 0.3, slots: [0, 1, 2] },
  { key: 'vit', name: '体力', stat: 'vit', base: 1, perLvl: 0.3, slots: [0, 1, 2, 3, 4, 5] },
  { key: 'agi', name: '敏捷', stat: 'agi', base: 1, perLvl: 0.22, slots: [0, 1, 4, 5] },
  { key: 'acc', name: '准确', stat: 'accPct', base: 3, perLvl: 0.4, slots: [0, 3, 4], pct: 1 },
  { key: 'eva', name: '轻灵', stat: 'evaPct', base: 2, perLvl: 0.25, slots: [3, 4, 5], pct: 1 },
  { key: 'leech', name: '嗜血', stat: 'leechPct', base: 2, perLvl: 0.22, slots: [0, 3], pct: 1 },
  { key: 'aspd', name: '疾风', stat: 'aspdPct', base: 4, perLvl: 0.5, slots: [0, 5], pct: 1 },
  { key: 'mf', name: '寻宝', stat: 'mfPct', base: 8, perLvl: 1.5, slots: [3, 4], pct: 1 },
  { key: 'xp', name: '感悟', stat: 'xpPct', base: 5, perLvl: 0.6, slots: [3, 4], pct: 1 }
];

// 品质：权重与词缀数
export const QUALITIES = [
  { key: 'white', name: '普通', weight: 62, affixes: 0, color: '#d8d8d8' },
  { key: 'magic', name: '魔法', weight: 25, affixes: 1, color: '#5aa0ff' },
  { key: 'rare', name: '稀有', weight: 10, affixes: 2, color: '#ffd24a' },
  { key: 'epic', name: '暗金', weight: 3, affixes: 2, color: '#c77dff' }
];

// 暗金固定神装（ilvl 达标后可掉）
export const UNIQUES = [
  { key: 'u_verdant_dragon', base: 'verdant', name: '龙纹·裁决之杖', slot: 0, req: 15, affixes: { aspdPct: 10, leechPct: 5 } },
  { key: 'u_slaughter', base: 'slaughter', name: '破天·屠龙', slot: 0, req: 18, affixes: { str: 5, atkFlat: 4 } },
  { key: 'u_zuma_armor', base: 'zuma_armor', name: '不灭·祖玛战甲', slot: 2, req: 18, affixes: { vit: 5, evaPct: 6 } },
  { key: 'u_woma_neck', base: 'woma_neck', name: '运数·沃玛项链', slot: 3, req: 14, affixes: { mfPct: 25, xpPct: 12 } }
];

// 药水（消耗品，不入装备栏）
export const POTIONS = {
  hp_s: { key: 'hp_s', name: '金创药(小)', kind: 'hp', value: 35, price: 15, drop: 10 },
  hp_m: { key: 'hp_m', name: '金创药(中)', kind: 'hp', value: 90, price: 40, drop: 5 },
  hp_l: { key: 'hp_l', name: '金创药(大)', kind: 'hp', value: 220, price: 90, drop: 1 },
  mp_s: { key: 'mp_s', name: '魔法药(小)', kind: 'mp', value: 18, price: 12, drop: 0 },
  mp_l: { key: 'mp_l', name: '魔法药(大)', kind: 'mp', value: 45, price: 30, drop: 0 }
};

// 生成一件装备。ilvl = 掉落怪物等级；rng 由调用方注入（可测）。
export function makeItem(rng, monsterLevel, forceQuality) {
  let q;
  if (forceQuality) {
    q = QUALITIES.find(item => item.key === forceQuality);
  } else {
    const mfBonus = 0; // MF 词缀由外层加权，这里保底纯权重
    const total = QUALITIES.reduce((sum, item) => sum + item.weight + (item.key === 'epic' || item.key === 'rare' ? mfBonus : 0), 0);
    let roll = rng() * total;
    q = QUALITIES[0];
    for (const item of QUALITIES) {
      roll -= item.weight;
      if (roll <= 0) { q = item; break; }
    }
  }

  const isWeapon = rollChance(rng, 0.4);
  let base;
  if (isWeapon) {
    const pool = WEAPONS.filter(w => w.req <= monsterLevel + 2);
    base = pool.length ? pool[pool.length - 1 - Math.floor(rng() * Math.min(3, pool.length))] : WEAPONS[0];
  } else {
    const tiers = Object.keys(ARMORS).map(Number).sort((a, b) => a - b);
    let tier = tiers[0];
    for (const t of tiers) { if (t <= monsterLevel + 2) tier = t; }
    base = pick(rng, ARMORS[tier]);
  }
  const slot = isWeapon ? 0 : SLOTS.indexOf(base.name.includes('帽') ? '头盔' : base.name.includes('靴') ? '靴子' : base.name.includes('项链') ? '项链' : base.name.includes('戒指') ? '戒指' : '衣服');

  const item = {
    kind: 'equip',
    slot,
    baseKey: base.key,
    name: base.name,
    req: base.req,
    ilvl: monsterLevel,
    quality: q.key,
    atkMin: base.atkMin || 0,
    atkMax: base.atkMax || 0,
    def: base.def || 0,
    affixes: [],
    plus: 0
  };

  const affixCount = q.affixes;
  if (affixCount > 0) {
    const used = {};
    for (let i = 0; i < affixCount; i++) {
      const pool = AFFIXES.filter(a => a.slots.indexOf(item.slot) >= 0 && !used[a.key]);
      if (!pool.length) break;
      const a = pick(rng, pool);
      used[a.key] = 1;
      const v = Math.max(1, Math.round(a.base + a.perLvl * monsterLevel * (0.75 + rng() * 0.5)));
      item.affixes.push({ key: a.key, name: a.name, stat: a.stat, value: v });
    }
  }
  if (q.key === 'epic') {
    const uniques = UNIQUES.filter(u => u.req <= monsterLevel + 2 && u.slot === item.slot);
    if (uniques.length) {
      const u = pick(rng, uniques);
      item.baseKey = u.base;
      item.name = u.name;
      item.req = u.req;
      item.affixes = Object.keys(u.affixes).map(key => ({ key, name: key, stat: key, value: u.affixes[key] }));
    }
  }
  if (q.key === 'magic') item.name = item.affixes.length ? item.affixes[0].name + base.name : base.name;
  if (q.key === 'rare' || q.key === 'epic') item.name = base.name; // 稀有/暗金以基础名+颜色区分
  return item;
}

// 武器强化收益：+N 每 12% 基础攻击
export function plusMultiplier(plus) { return 1 + plus * 0.12; }
export const REFORGE_CHANCES = [95, 85, 70, 55, 40, 30, 20];
