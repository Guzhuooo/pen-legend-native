// 战斗结算（DESIGN.md 第 3、4 节）
import { rollRange, rollChance } from './rng.js';

export const SKILLS = {
  hit: { key: 'hit', name: '基础剑法', unlock: 1, mult: 1.0, mp: 0, cd: 0, aoe: 0 },
  gongsha: { key: 'gongsha', name: '攻杀剑术', unlock: 1, mult: 1.8, mp: 3, cd: 3, aoe: 0 },
  banyue: { key: 'banyue', name: '半月弯刀', unlock: 4, mult: 1.3, mp: 8, cd: 6, aoe: 1.6 },
  chongzhuang: { key: 'chongzhuang', name: '野蛮冲撞', unlock: 7, mult: 1.2, mp: 10, cd: 9, aoe: 0, stun: 1.5 },
  liehuo: { key: 'liehuo', name: '烈火剑法', unlock: 10, mult: 2.8, mp: 15, cd: 12, aoe: 0, burn: 1 }
};

// 一次物理结算：返回 {dmg, crit(暂无), miss, leech}
export function rollAttack(stats, rng, targetDef, targetEva, mult) {
  const hitChance = Math.max(25, Math.min(97, stats.acc - targetEva));
  if (!rollChance(rng, hitChance)) return { miss: true, dmg: 0, leech: 0 };
  const raw = rollRange(rng, stats.atkMin, stats.atkMax) * (mult || 1);
  const dmg = Math.max(1, Math.round(raw - targetDef));
  const leech = Math.round(dmg * stats.leechPct / 100);
  return { miss: false, dmg, leech };
}

// 怪物攻击玩家
export function rollMonsterHit(mon, stats, rng, playerEva) {
  const hitChance = Math.max(25, Math.min(97, 88 - playerEva));
  if (!rollChance(rng, hitChance)) return { miss: true, dmg: 0 };
  const raw = rollRange(rng, mon.atkMin, mon.atkMax);
  const dmg = Math.max(1, Math.round(raw - stats.def * 0.8));
  return { miss: false, dmg };
}

export function skillReady(cdMap, key, now) {
  return (cdMap[key] || 0) <= now;
}

// 解锁检查（按等级）
export function refreshSkillUnlocks(player) {
  const s = player.skillUnlocks;
  s.hit = true;
  s.gongsha = player.level >= SKILLS.gongsha.unlock;
  s.banyue = player.level >= SKILLS.banyue.unlock;
  s.chongzhuang = player.level >= SKILLS.chongzhuang.unlock;
  s.liehuo = player.level >= SKILLS.liehuo.unlock;
  return s;
}
