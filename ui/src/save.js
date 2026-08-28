// 存档：Falcon Storage，schema v1，容错读取
const KEY = '/userdata/miniapp/pen_legend/save_v1.json';

function parseStored(result) {
  if (!result) return null;
  const raw = result.data !== undefined ? result.data : result.value;
  if (raw === undefined || raw === null || raw === '') return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return null; }
}

export async function loadSave(storage) {
  try { return parseStored(await storage.getStorage({ key: KEY })); } catch (e) { return null; }
}

export function saveGame(storage, player) {
  const payload = {
    version: 1,
    savedAt: Date.now(),
    player: {
      name: player.name,
      level: player.level,
      xp: player.xp,
      gold: player.gold,
      statPoints: player.statPoints,
      base: player.base,
      mapId: player.mapId,
      inventory: player.inventory,
      potions: player.potions,
      ore: player.ore,
      equipped: player.equipped,
      skillUnlocks: player.skillUnlocks
    }
  };
  return storage.setStorage({ key: KEY, data: JSON.stringify(payload) });
}

// 容错归一化：坏档/旧档 → 补默认值
export function normalizePlayer(data, createPlayer) {
  const base = createPlayer();
  if (!data || !data.player) return base;
  const p = data.player;
  base.name = typeof p.name === 'string' ? p.name.slice(0, 12) : base.name;
  base.level = Math.max(1, Math.min(30, Number(p.level) || 1));
  base.xp = Math.max(0, Number(p.xp) || 0);
  base.gold = Math.max(0, Math.floor(Number(p.gold) || 0));
  base.statPoints = Math.max(0, Math.min(120, Number(p.statPoints) || 0));
  if (p.base) {
    for (const k of ['str', 'vit', 'agi']) base.base[k] = Math.max(0, Math.min(60, Number(p.base[k]) || 0));
  }
  base.mapId = Math.max(0, Math.min(4, Number(p.mapId) || 0));
  if (Array.isArray(p.inventory)) {
    base.inventory = p.inventory.filter(item => validItem(item)).slice(0, 24);
  }
  if (p.potions) {
    for (const k in base.potions) base.potions[k] = Math.max(0, Math.min(9, Number(p.potions[k]) || 0));
  }
  base.ore = Math.max(0, Math.min(99, Number(p.ore) || 0));
  if (p.equipped) {
    for (const slot in base.equipped) {
      const item = p.equipped[slot];
      if (validItem(item) && Number(slot) === item.slot) base.equipped[slot] = item;
    }
  }
  return base;
}

function validItem(item) {
  return !!(item && item.kind === 'equip' && typeof item.baseKey === 'string' &&
    Number.isFinite(item.slot) && item.slot >= 0 && item.slot <= 5 &&
    typeof item.quality === 'string');
}
