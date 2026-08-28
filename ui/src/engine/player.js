// 玩家成长 / 装备聚合（DESIGN.md 第 3、7 节）
import { plusMultiplier } from './items.js';

export const STAT_POINTS_PER_LEVEL = 3;
export const MAX_LEVEL = 30;

export function xpNeed(level) {
  if (level >= MAX_LEVEL) return Infinity;
  return Math.round(20 * Math.pow(level, 1.9));
}

export function createPlayer(name) {
  return {
    name: name || '无名剑客',
    level: 1,
    xp: 0,
    gold: 50,
    statPoints: 0,
    base: { str: 0, vit: 0, agi: 0 },
    hpMaxBase: 50,
    mpMaxBase: 20,
    mapId: 0,
    x: 0,
    y: 0,
    inventory: [],   // 装备物品（24 格）
    potions: { hp_s: 3, mp_s: 1 },
    ore: 0,          // 黑铁矿石
    equipped: { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null },
    skillUnlocks: { hit: true, gongsha: true, banyue: false, chongzhuang: false, liehuo: false }
  };
}

export function grantXp(player, amount) {
  const gains = { levels: 0, xp: amount };
  player.xp += amount;
  while (player.level < MAX_LEVEL && player.xp >= xpNeed(player.level)) {
    player.xp -= xpNeed(player.level);
    player.level += 1;
    player.statPoints += STAT_POINTS_PER_LEVEL;
    gains.levels += 1;
  }
  if (player.level >= MAX_LEVEL) player.xp = 0;
  return gains;
}

export function spendPoint(player, stat) {
  if (player.statPoints <= 0) return false;
  if (!(stat in player.base)) return false;
  player.statPoints -= 1;
  player.base[stat] += 1;
  return true;
}

// 等级 + 基础点 + 装备聚合后的战斗属性
export function deriveStats(player) {
  let str = player.base.str;
  let vit = player.base.vit;
  let agi = player.base.agi;
  let atkFlat = 0;
  let defFlat = 0;
  let accPct = 0;
  let evaPct = 0;
  let leechPct = 0;
  let aspdPct = 0;
  let mfPct = 0;
  let xpPct = 0;
  let weaponAtkMin = 1;
  let weaponAtkMax = 3;

  const eq = player.equipped;
  for (const slotKey in eq) {
    const item = eq[slotKey];
    if (!item) continue;
    if (item.slot === 0) {
      const mult = plusMultiplier(item.plus || 0);
      weaponAtkMin = Math.round(item.atkMin * mult);
      weaponAtkMax = Math.round(item.atkMax * mult);
    } else {
      defFlat += item.def;
    }
    for (const affix of item.affixes) {
      switch (affix.stat) {
        case 'atkFlat': atkFlat += affix.value; break;
        case 'str': str += affix.value; break;
        case 'vit': vit += affix.value; break;
        case 'agi': agi += affix.value; break;
        case 'accPct': accPct += affix.value; break;
        case 'evaPct': evaPct += affix.value; break;
        case 'leechPct': leechPct += affix.value; break;
        case 'aspdPct': aspdPct += affix.value; break;
        case 'mfPct': mfPct += affix.value; break;
        case 'xpPct': xpPct += affix.value; break;
      }
    }
  }

  const levelAtk = Math.floor((player.level - 1) * 1.2);
  const atkMin = 2 + Math.floor(str * 1.5) + weaponAtkMin + atkFlat + levelAtk;
  const atkMax = 4 + Math.round(str * 1.5) + weaponAtkMax + atkFlat + levelAtk;
  const hpMax = 50 + (player.level - 1) * 12 + vit * 8;
  const mpMax = 20 + (player.level - 1) * 4;
  const def = Math.floor((player.level - 1) / 3) + defFlat;
  const eva = Math.min(35, 5 + agi + evaPct);
  const acc = Math.min(100, 85 + accPct);
  const atkInterval = Math.max(0.55, 0.9 * (100 / (100 + aspdPct)));

  return { atkMin, atkMax, hpMax, mpMax, def, acc, eva, leechPct, atkInterval, str, vit, agi, mfPct, xpPct };
}

export function usePotion(player, kind, value) {
  const key = kind === 'hp' ? 'hp_s' : 'mp_s';
  const stock = player.potions[key] || 0;
  if (stock <= 0) return false;
  player.potions[key] = stock - 1;
  return true;
}

// 强化：消耗矿石 + 金币；成功率表 items.REFORGE_CHANCES
export function tryReforge(player, item, rng, oreCost, goldCost) {
  if (!item || item.slot !== 0) return { ok: false, reason: '只能强化武器' };
  if ((item.plus || 0) >= 7) return { ok: false, reason: '已达 +7 上限' };
  if (player.ore < oreCost) return { ok: false, reason: '黑铁矿石不足' };
  if (player.gold < goldCost) return { ok: false, reason: '金币不足' };
  player.ore -= oreCost;
  player.gold -= goldCost;
  const chances = [95, 85, 70, 55, 40, 30, 20];
  const chance = chances[item.plus || 0];
  const success = rng() * 100 < chance;
  if (success) item.plus = (item.plus || 0) + 1;
  return { ok: true, success, plus: item.plus || 0 };
}
