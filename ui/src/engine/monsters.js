// 怪物数值表（与 native LegendCore 的 type id 对应）
// hp/atkMin/atkMax/def/xp 依据 DESIGN.md 第 6 节
export const MONSTERS = {
  1: { id: 1, name: '鸡', level: 1, hp: 12, atkMin: 1, atkMax: 2, def: 0, xp: 4, speed: 0.6, aggro: 0, atkInterval: 2.0, ranged: 0, sprite: 'chicken' },
  2: { id: 2, name: '鹿', level: 2, hp: 22, atkMin: 2, atkMax: 3, def: 1, xp: 8, speed: 0.9, aggro: 0, atkInterval: 2.0, ranged: 0, sprite: 'deer' },
  3: { id: 3, name: '骷髅', level: 3, hp: 35, atkMin: 3, atkMax: 6, def: 2, xp: 15, speed: 0.9, aggro: 5, atkInterval: 1.8, ranged: 0, sprite: 'skeleton' },
  4: { id: 4, name: '僵尸', level: 5, hp: 62, atkMin: 5, atkMax: 9, def: 3, xp: 28, speed: 0.55, aggro: 5, atkInterval: 2.2, ranged: 0, sprite: 'zombie' },
  5: { id: 5, name: '掷斧骷髅', level: 6, hp: 45, atkMin: 6, atkMax: 10, def: 2, xp: 35, speed: 0.8, aggro: 6, atkInterval: 2.5, ranged: 4, sprite: 'axer' },
  6: { id: 6, name: '沃玛战士', level: 9, hp: 115, atkMin: 9, atkMax: 15, def: 6, xp: 70, speed: 0.9, aggro: 5, atkInterval: 1.6, ranged: 0, sprite: 'woma' },
  7: { id: 7, name: '沃玛勇士', level: 11, hp: 175, atkMin: 13, atkMax: 20, def: 8, xp: 110, speed: 0.9, aggro: 5, atkInterval: 1.6, ranged: 0, sprite: 'woma2' },
  8: { id: 8, name: '沃玛教主', level: 14, hp: 900, atkMin: 18, atkMax: 28, def: 10, xp: 900, speed: 0.5, aggro: 7, atkInterval: 2.0, ranged: 0, boss: 1, sprite: 'womaboss' },
  9: { id: 9, name: '祖玛卫士', level: 15, hp: 230, atkMin: 15, atkMax: 24, def: 10, xp: 160, speed: 1.0, aggro: 5, atkInterval: 1.5, ranged: 0, sprite: 'zuma' },
  10: { id: 10, name: '祖玛雕像', level: 16, hp: 185, atkMin: 18, atkMax: 28, def: 8, xp: 190, speed: 0.45, aggro: 6, atkInterval: 2.4, ranged: 5, sprite: 'zumastatue' },
  11: { id: 11, name: '祖玛教主', level: 20, hp: 2400, atkMin: 26, atkMax: 40, def: 14, xp: 3000, speed: 0.8, aggro: 7, atkInterval: 1.8, ranged: 0, boss: 2, sprite: 'zumaboss' }
};

// 地图元信息：mapId 与 native genMap 一致
export const MAPS = [
  { id: 0, name: '新手村', minLevel: 0, safe: 1, monsterTypes: [], monsterCount: 0 },
  { id: 1, name: '鹿寨', minLevel: 1, safe: 0, monsterTypes: [1, 2], monsterCount: 26 },
  { id: 2, name: '僵尸矿洞', minLevel: 3, safe: 0, monsterTypes: [3, 4, 5], monsterCount: 30 },
  { id: 3, name: '沃玛寺庙', minLevel: 8, safe: 0, monsterTypes: [6, 7], monsterCount: 30, boss: 8 },
  { id: 4, name: '祖玛寺庙', minLevel: 14, safe: 0, monsterTypes: [9, 10], monsterCount: 32, boss: 11 }
];
