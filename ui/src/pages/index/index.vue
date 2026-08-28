<template>
  <div class="page">
    <canvas ref="gameCanvas" class="game-canvas" style="width: 800px; height: 254px;" @touchstart="onTapC"></canvas>
    <div class="tap-layer" v-if="mode === 'field'" @touchstart="onTap"></div>

    <!-- 实体精灵层 -->
    <div v-for="e in sprites" :key="e.key" class="ent" :class="e.cls" :style="e.style">
      <div class="ent-hp" v-if="e.hpPct !== null"><div class="ent-hp-fill" :style="e.hpStyle"></div></div>
    </div>
    <div v-for="d in dropDots" :key="d.key" class="drop-dot" :class="d.cls" :style="d.style"></div>
    <text v-for="fx in fxTexts" :key="fx.key" class="fx-text" :style="fx.style">{{ fx.text }}</text>

    <!-- 顶部 HUD -->
    <div class="hud" v-if="mode === 'field' || mode === 'town'">
      <div class="hud-bars">
        <div class="bar-track hp"><div class="bar-fill hp-fill" :style="{ width: hpPct + '%' }"></div><text class="bar-text">{{ hpNow }}/{{ hpMax }}</text></div>
        <div class="bar-track mp"><div class="bar-fill mp-fill" :style="{ width: mpPct + '%' }"></div><text class="bar-text mp-text">{{ mpNow }}/{{ mpMax }}</text></div>
      </div>
      <div class="hud-mid">
        <text class="hud-level">Lv.{{ level }}</text>
        <div class="xp-track"><div class="xp-fill" :style="{ width: xpBarPct + '%' }"></div></div>
        <text class="hud-gold">●{{ gold }}</text>
      </div>
      <div class="hud-btns">
        <div class="hud-btn" @click="openPanel('bag')"><text class="hud-btn-text">包</text></div>
        <div class="hud-btn" @click="openPanel('char')"><text class="hud-btn-text">人</text></div>
        <div class="hud-btn" @click="goTown"><text class="hud-btn-text">城</text></div>
      </div>
    </div>

    <!-- 底部操作区（仅野外）：全部显式 left/top，避免 bottom/right 嵌套定位差异 -->
    <div class="dpad" v-if="mode === 'field'">
      <div class="dp dpu" @touchstart="pressDir(0, -1)" @touchend="releaseDir" @touchcancel="releaseDir"><text class="dp-t">▲</text></div>
      <div class="dp dpl" @touchstart="pressDir(-1, 0)" @touchend="releaseDir" @touchcancel="releaseDir"><text class="dp-t">◀</text></div>
      <div class="dp dpc" @click="pickTarget"><text class="dp-t">◎</text></div>
      <div class="dp dpr" @touchstart="pressDir(1, 0)" @touchend="releaseDir" @touchcancel="releaseDir"><text class="dp-t">▶</text></div>
      <div class="dp dpd" @touchstart="pressDir(0, 1)" @touchend="releaseDir" @touchcancel="releaseDir"><text class="dp-t">▼</text></div>
    </div>
    <div class="skill-bar" v-if="mode === 'field'">
      <div class="skill atk" @click="doAttack"><text class="skill-t">击</text></div>
      <div class="skill" :class="{ cooling: !skillReady('gongsha') }" @click="doCast('gongsha')"><text class="skill-t">攻</text></div>
      <div class="skill" :class="{ cooling: !skillReady('banyue') }" @click="doCast('banyue')"><text class="skill-t">半</text></div>
      <div class="skill" :class="{ cooling: !skillReady('liehuo') }" @click="doCast('liehuo')"><text class="skill-t">烈</text></div>
      <div class="skill spot" @click="drink('hp')"><text class="skill-t">血{{ potionsHp }}</text></div>
      <div class="skill spot" @click="drink('mp')"><text class="skill-t">魔{{ potionsMp }}</text></div>
    </div>

    <!-- 标题页 -->
    <div class="overlay" v-if="mode === 'splash'">
      <text class="title">笔尖传奇</text>
      <text class="subtitle">传奇剑术 × 暗黑掉落 · 词典笔 ARPG</text>
      <div class="menu-btn" @click="startGame"><text class="menu-btn-text">{{ hasSave ? '继续冒险' : '开始冒险' }}</text></div>
      <text class="hint">{{ native }} · T{{ tickN }} · GuZhuooo · v0.2.0</text>
    </div>

    <!-- 村庄 -->
    <div class="overlay" v-if="mode === 'town'">
      <text class="panel-title">新手村</text>
      <text class="town-info">金币 ●{{ gold }} · 矿石 {{ ore }} · 背包 {{ bagCount }}/24</text>
      <div class="town-grid">
        <div class="menu-btn sm" @click="openPanel('map')"><text class="menu-btn-text">出城冒险</text></div>
        <div class="menu-btn sm" @click="openPanel('shop')"><text class="menu-btn-text">商店</text></div>
        <div class="menu-btn sm" @click="openPanel('smith')"><text class="menu-btn-text">铁匠</text></div>
        <div class="menu-btn sm" @click="openPanel('bag')"><text class="menu-btn-text">背包</text></div>
        <div class="menu-btn sm" @click="openPanel('char')"><text class="menu-btn-text">角色</text></div>
      </div>
      <text class="hint">{{ townMsg }}</text>
    </div>

    <!-- 死亡结算 -->
    <div class="overlay" v-if="mode === 'dead'">
      <text class="panel-title">你被击倒了</text>
      <text class="town-info">本次击杀 {{ runKills }} · 收获 ●{{ runGold }}（死亡扣除一半金币）</text>
      <div class="menu-btn" @click="revive"><text class="menu-btn-text">回村休整</text></div>
    </div>

    <!-- 面板：出城 -->
    <div class="overlay panel" v-if="panel === 'map'">
      <text class="panel-title">选择目的地</text>
      <div class="map-list">
        <div v-for="m in mapOptions" :key="m.id" class="map-row" :class="{ locked: m.locked }" @click="enterMap(m)">
          <text class="map-name">{{ m.name }}</text>
          <text class="map-req">{{ m.locked ? '需击杀前置Boss' : (m.safe ? '安全区' : 'Lv' + m.minLevel + '+') }}</text>
        </div>
      </div>
      <div class="close-btn" @click="closePanel"><text class="close-text">返回</text></div>
    </div>

    <!-- 面板：背包 -->
    <div class="overlay panel" v-if="panel === 'bag'">
      <text class="panel-title">背包（{{ bagCount }}/24）</text>
      <scroller class="bag-scroll" scroll-direction="vertical" show-scrollbar="false">
        <div v-for="it in bagItems" :key="it.key" class="bag-row" :style="{ borderColor: it.color }">
          <text class="bag-name" :style="{ color: it.color }">{{ it.name }}{{ it.plus ? ' +' + it.plus : '' }}</text>
          <text class="bag-stat">{{ it.stat }}</text>
          <div class="bag-act" @click="equipItem(it.ref)"><text class="bag-act-t">穿</text></div>
          <div class="bag-act sell" @click="sellItem(it.ref)"><text class="bag-act-t">卖{{ it.sell }}</text></div>
        </div>
        <text v-if="!bagItems.length" class="bag-empty">背包空空如也</text>
      </scroller>
      <div class="close-btn" @click="closePanel"><text class="close-text">返回</text></div>
    </div>

    <!-- 面板：角色 -->
    <div class="overlay panel" v-if="panel === 'char'">
      <text class="panel-title">{{ name }} · Lv.{{ level }}</text>
      <text class="char-line">生命 {{ hpMax }} · 法力 {{ mpMax }} · 攻击 {{ atkMin }}-{{ atkMax }} · 防御 {{ def }}</text>
      <text class="char-line">命中 {{ acc }}% · 闪避 {{ eva }}% · 攻速 {{ atkSpeed }}/s · 经验加成 +{{ xpPct }}%</text>
      <text class="char-line">经验 {{ xp }}/{{ xpNext }}</text>
      <text class="char-line">可分配点数：{{ statPoints }}</text>
      <div class="stat-row">
        <div class="stat-add" @click="addPoint('str')"><text class="stat-add-t">+</text></div><text class="stat-name">力量 {{ strVal }}（攻击）</text>
      </div>
      <div class="stat-row">
        <div class="stat-add" @click="addPoint('vit')"><text class="stat-add-t">+</text></div><text class="stat-name">体力 {{ vitVal }}（生命）</text>
      </div>
      <div class="stat-row">
        <div class="stat-add" @click="addPoint('agi')"><text class="stat-add-t">+</text></div><text class="stat-name">敏捷 {{ agiVal }}（闪避）</text>
      </div>
      <div class="close-btn" @click="closePanel"><text class="close-text">返回</text></div>
    </div>

    <!-- 面板：商店 -->
    <div class="overlay panel" v-if="panel === 'shop'">
      <text class="panel-title">药店 · 金币 ●{{ gold }}</text>
      <div class="map-list">
        <div v-for="p in shopItems" :key="p.key" class="map-row" @click="buyPotion(p)">
          <text class="map-name">{{ p.name }}（持有 {{ p.own }}）</text>
          <text class="map-req">●{{ p.price }}</text>
        </div>
      </div>
      <div class="close-btn" @click="closePanel"><text class="close-text">返回</text></div>
    </div>

    <!-- 面板：铁匠 -->
    <div class="overlay panel" v-if="panel === 'smith'">
      <text class="panel-title">铁匠铺 · 矿石 {{ ore }} · ●{{ gold }}</text>
      <text class="char-line">强化武器 +N：每级 +12% 武器攻击，上限 +7</text>
      <div class="map-list">
        <div class="map-row" :class="{ locked: !equippedWeapon }" @click="doReforge">
          <text class="map-name">{{ equippedWeapon ? '强化 ' + equippedWeapon.name + ' +' + equippedWeapon.plus : '未装备武器' }}</text>
          <text class="map-req">{{ equippedWeapon ? '1矿+●' + reforgeCost : '—' }}</text>
        </div>
      </div>
      <text class="char-line">{{ smithMsg }}</text>
      <div class="close-btn" @click="closePanel"><text class="close-text">返回</text></div>
    </div>
  </div>
</template>

<script>
import { LegendModule } from 'legend';
import { createRng } from '../../engine/rng.js';
import { createPlayer, grantXp, spendPoint, deriveStats, xpNeed } from '../../engine/player.js';
import { MONSTERS, MAPS } from '../../engine/monsters.js';
import { createWorld, tick, cast, lockNearest, quickPotion, tapMove, visibleMobs, syncStats } from '../../engine/game.js';
import { renderTerrain } from '../../render/canvas-renderer.js';
import { worldToScreen, cameraFor } from '../../render/iso.js';
import { QUALITIES, POTIONS, REFORGE_CHANCES } from '../../engine/items.js';
import { loadSave, saveGame, normalizePlayer } from '../../save.js';

const TICK_MS = 50;

export default {
  name: 'index',
  data() {
    return {
      mode: 'splash',
      panel: '',
      hasSave: false,
      native: '',
      level: 1, name: '无名剑客',
      hpNow: 50, hpMax: 50, mpNow: 20, mpMax: 20,
      gold: 50, ore: 0, xp: 0, xpNext: 20, statPoints: 0,
      strVal: 0, vitVal: 0, agiVal: 0,
      atkMin: 2, atkMax: 4, def: 0, acc: 85, eva: 5, atkSpeed: '1.0', xpPct: 0,
      sprites: [], dropDots: [], fxTexts: [],
      potionsHp: 0, potionsMp: 0,
      runKills: 0, runGold: 0, tickN: 0, tapInfo: '',
      townMsg: '', smithMsg: '',
      unlockedMaps: { 0: true, 1: true },
      dirX: 0, dirY: 0,
      bagCount: 0, bagItems: [], shopItems: [], mapOptions: []
    };
  },
  computed: {
    hpPct() { return this.hpMax ? Math.round(this.hpNow / this.hpMax * 100) : 0; },
    mpPct() { return this.mpMax ? Math.round(this.mpNow / this.mpMax * 100) : 0; },
    equippedWeapon() { const w = this._player && this._player.equipped[0]; return w || null; },
    reforgeCost() { const w = this.equippedWeapon; return w ? (w.plus + 1) * 120 : 0; },
    xpBarPct() { return this.xpNext ? Math.min(100, Math.round(this.xp / this.xpNext * 100)) : 0; }
  },
  methods: {
    // ---------- 生命周期 ----------
    async onShow() {
      if (this._started) return;
      this._started = true;
      this._ctx = this._getContext();
      await this.loadProgress();
      try {
        const t0 = Date.now();
        const ver = LegendModule.getVersion();
        const ms = LegendModule.bench(500000);
        const m = LegendModule.initWorld(1, 1);
        this.native = 'native ' + ver + ' · bench ' + ms.toFixed(1) + 'ms · 图' + m.w + 'x' + m.h;
      } catch (e) {
        this.native = 'native 不可用: ' + e;
      }
      // 定时器探针：验证 $page.setInterval 是否触发
      const owner = this.$page && this.$page.setInterval ? this.$page : null;
      this._probeTimer = owner ? owner.setInterval(() => { this.tickN = (this.tickN + 1) % 1000; }, 500)
        : setInterval(() => { this.tickN = (this.tickN + 1) % 1000; }, 500);
      this.refreshHud();
      this.showSplash();
    },
    onHide() { this.stopLoop(); this.persist(); },
    onUnload() { this.stopLoop(); this.persist(); },

    _getContext() {
      const ref = this.$refs.gameCanvas;
      try { if (typeof createCanvasContext === 'function') return createCanvasContext(ref); } catch (e) {}
      try { return ref.getContext('2d'); } catch (e) { return null; }
    },

    // ---------- 存档 ----------
    async loadProgress() {
      try {
        const saved = await loadSave($falcon.jsapi.storage);
        this.hasSave = !!saved;
        this._player = normalizePlayer(saved, createPlayer);
        this.unlockedMaps = { 0: true, 1: true, 2: true };
        if (saved && saved.unlockedMaps) {
          for (const k in saved.unlockedMaps) if (saved.unlockedMaps[k]) this.unlockedMaps[k] = true;
        }
      } catch (e) {
        this._player = createPlayer();
      }
      this.name = this._player.name;
    },
    persist() {
      if (!this._player) return;
      // Boss 首杀解锁下一张图；矿洞清怪 20 只解锁沃玛
      const w = this._world;
      if (w && w.bossKilled && w.mapId + 1 <= 4) this.unlockedMaps[w.mapId + 1] = true;
      else if (w && w.mapId === 2 && w.kills >= 20) this.unlockedMaps[3] = true;
      try { saveGame($falcon.jsapi.storage, this._player); } catch (e) {}
      try {
        $falcon.jsapi.storage.setStorage({
          key: '/userdata/miniapp/pen_legend/maps_v1.json',
          data: JSON.stringify({ version: 1, unlockedMaps: this.unlockedMaps })
        });
      } catch (e) {}
    },

    // ---------- 主循环 ----------
    startLoop() {
      this.stopLoop();
      this._last = Date.now();
      this._tickCount = 0;
      this._timer = this.$page && this.$page.setInterval ? this.$page.setInterval(() => this.frame(), TICK_MS) : setInterval(() => this.frame(), TICK_MS);
    },
    stopLoop() {
      if (this._timer === null || this._timer === undefined) return;
      if (this.$page && this.$page.clearInterval) this.$page.clearInterval(this._timer);
      else clearInterval(this._timer);
      this._timer = null;
    },
    frame() {
      const w = this._world;
      if (!w || this.mode !== 'field' || this.panel) return;
      try {
        const now = Date.now();
        const dt = Math.min(0.2, (now - this._last) / 1000);
        this._last = now;
        this._rngState = this._rngState || createRng(now & 0xffff);
        tick(w, LegendModule, { dt, now, rng: this._rngState, native: LegendModule }, { move: { dx: this.dirX, dy: this.dirY }, clearMove: !this.dirX && !this.dirY });
        if (w.dead) { this.onDead(); return; }
        // 渲染节流：逻辑 20Hz，画面 10Hz
        this._renderPhase = !this._renderPhase;
        if (this._renderPhase) this.renderFrame(now);
        this.tickN = (this.tickN + 1) % 1000;
        this._errCount = 0;
      } catch (e) {
        this._errCount = (this._errCount || 0) + 1;
        this.townMsg = 'E' + this._errCount + ': ' + e;
      }
    },
    renderFrame(now) {
      const w = this._world;
      w.player.x = w.px; w.player.y = w.py;
      const cam = cameraFor(w.player);
      // 地形只在相机跨半格时重绘（战斗站立不动时 0 次 canvas 调用）
      const camKey = Math.round(w.player.x * 2) + ':' + Math.round(w.player.y * 2);
      if (this._ctx && camKey !== this._camKey) {
        renderTerrain(this._ctx, w, cam);
        this._camKey = camKey;
      }
      // 精灵
      const sprites = [];
      for (const mv of visibleMobs(w, LegendModule)) {
        // mv = [id, type, level, x, y, hp, maxHp, flash]
        const mon = MONSTERS[mv[1]];
        if (!mon) continue;
        const s = worldToScreen(cam.camX, cam.camY, mv[3], mv[4]);
        if (s.x < -40 || s.x > 840) continue;
        const pct = Math.max(0, Math.round(mv[5] / mv[6] * 100));
        sprites.push({
          key: 'm' + mv[0],
          cls: 'mob' + (mv[7] ? ' mhit' : '') + (mon.boss ? ' mboss' : ''),
          style: { left: (s.x - 14) + 'px', top: (s.y - 28) + 'px', zIndex: 1000 + Math.round(mv[3] + mv[4]) },
          hpPct: pct,
          hpStyle: { width: pct + '%' }
        });
      }
      const ps = worldToScreen(cam.camX, cam.camY, w.player.x, w.player.y);
      sprites.push({
        key: 'hero', cls: 'hero',
        style: { left: (ps.x - 14) + 'px', top: (ps.y - 30) + 'px', zIndex: 1000 + Math.round(w.player.x + w.player.y) },
        hpPct: null, hpStyle: {}
      });
      this.sprites = sprites;
      const dots = [];
      for (const d of w.drops) {
        const s = worldToScreen(cam.camX, cam.camY, d.x, d.y);
        if (s.x < -20 || s.x > 820) continue;
        dots.push({
          key: d.id,
          cls: d.gold ? 'dgold' : (d.potion ? 'dpot' : (d.ore ? 'dore' : 'dloot')),
          style: { left: (s.x - 4) + 'px', top: (s.y - 10) + 'px', zIndex: 999 + Math.round(d.x + d.y) }
        });
      }
      this.dropDots = dots;
      const fxs = [];
      for (const e of w.effects) {
        const s = worldToScreen(cam.camX, cam.camY, e.x, e.y);
        fxs.push({
          key: 'fx' + e.kind + e.x.toFixed(1) + e.y.toFixed(1),
          text: e.text,
          style: { left: (s.x - 20) + 'px', top: (s.y - 40 - e.t * 34) + 'px', opacity: String(1 - e.t / 0.9), zIndex: 2000 }
        });
      }
      this.fxTexts = fxs;
      // HUD 数值
      this.hpNow = Math.ceil(w.hp);
      this.mpNow = Math.ceil(w.mp);
      this._tickCount = (this._tickCount || 0) + 1;
      if (this._tickCount % 4 === 0) this.refreshHud();
    },
    refreshHud() {
      const p = this._player;
      if (!p) return;
      const s = deriveStats(p);
      this.level = p.level;
      this.gold = p.gold;
      this.ore = p.ore;
      this.xp = p.xp;
      this.xpNext = xpNeed(p.level);
      this.statPoints = p.statPoints;
      this.strVal = s.str;
      this.vitVal = s.vit;
      this.agiVal = s.agi;
      this.atkMin = s.atkMin;
      this.atkMax = s.atkMax;
      this.def = s.def;
      this.acc = s.acc;
      this.eva = s.eva;
      this.atkSpeed = (1 / s.atkInterval).toFixed(1);
      this.xpPct = s.xpPct;
      this.hpMax = s.hpMax;
      this.mpMax = s.mpMax;
      if (this.mode !== 'field') { this.hpNow = s.hpMax; this.mpNow = s.mpMax; }
      this.potionsHp = p.potions.hp_s || 0;
      this.potionsMp = p.potions.mp_s || 0;
      this.bagCount = p.inventory.length;
    },

    // ---------- 流程 ----------
    showSplash() { this.mode = 'splash'; this.stopLoop(); },
    startGame() {
      this.mode = 'town';
      this.refreshHud();
      this.townMsg = '欢迎回来，' + this._player.name + '。整装出发吧。';
    },
    goTown() {
      this.stopLoop();
      this.mode = 'town';
      this.panel = '';
      this.refreshHud();
      this.persist();
    },
    openPanel(name) {
      this.refreshHud();
      this.panel = name;
      if (name === 'map') this.buildMapOptions();
      if (name === 'shop') this.buildShop();
      if (name === 'bag') this.buildBag();
      this.smithMsg = '';
    },
    closePanel() { this.panel = ''; },
    onDead() {
      this.stopLoop();
      const p = this._player;
      const lost = Math.floor(p.gold / 2);
      p.gold -= lost;
      this.runKills = this._world.kills;
      this.runGold = Math.max(0, this._world.runGold - lost);
      this.persist();
      this.refreshHud();
      this.mode = 'dead';
    },
    revive() { this.mode = 'town'; this.refreshHud(); },

    buildMapOptions() {
      const bossUnlocked = this._world && this._world.bossKilled;
      this.mapOptions = MAPS.filter(m => m.id !== 0).map(m => {
        const prevKey = 'prev_' + m.id;
        const locked = m.id > 1 && !this.unlockedMaps[m.id];
        return { id: m.id, name: m.name, minLevel: m.minLevel, safe: m.safe, locked, bossUnlocked };
      });
    },
    enterMap(m) {
      if (m.locked) { this.townMsg = '先在前一张地图击败Boss解锁。'; this.panel = ''; this._toastTimer && this.$page.clearTimeout(this._toastTimer); return; }
      this._player.mapId = m.id;
      this.launchField(m.id);
      this.panel = '';
    },
    launchField(mapId) {
      const seed = (Date.now() & 0xffffff) >>> 0;
      this._world = createWorld(LegendModule, this._player, mapId, seed);
      this._world.safe = !!MAPS[mapId].safe;
      this.townMsg = '';
      this.mode = 'field';
      this.panel = '';
      this.refreshHud();
      // 停掉 splash 探针定时器
      if (this._probeTimer !== undefined && this._probeTimer !== null) {
        if (this.$page && this.$page.clearInterval) this.$page.clearInterval(this._probeTimer);
        else clearInterval(this._probeTimer);
        this._probeTimer = null;
      }
      this.startLoop();
      this._camKey = '';
      this.renderFrame(Date.now());
    },

    // ---------- 输入 ----------
    pressDir(x, y) { this.dirX = x; this.dirY = y;  },
    releaseDir() { this.dirX = 0; this.dirY = 0;  },
    pickTarget() {
      const w = this._world;
      if (!w) return;
      const mob = lockNearest(w, LegendModule);
      this.townMsg = mob ? ('锁' + mob[0]) : '无目标';
    },
    onTapC(e) { this._onTap('C', e); },
    onTapL(e) { this._onTap('L', e); },
    _onTap(tag, e) {
      try {
        this.townMsg = tag + '!';
        let t = e && (e.changedTouches && e.changedTouches[0]);
        if (!t) t = e && e.touches && e.touches[0];
        const keys = e ? Object.keys(e).join('|') : 'null';
        const sx = t ? t.screenX : -1;
        const sy = t ? t.screenY : -1;
        if (sx < 0 || sy < 0) { this.townMsg = tag + '无坐标'; return; }
        const A = (sx - 400) / 20;
        const B = (sy - 127) / 10;
        let wx = Math.floor(this._world.px + (A + B) / 2);
        let wy = Math.floor(this._world.py + (B - A) / 2);
        wx = Math.max(0, Math.min(this._world.w - 1, wx));
        wy = Math.max(0, Math.min(this._world.h - 1, wy));
        const moved = tapMove(this._world, LegendModule, wx, wy);
        this.townMsg = tag + '走' + wx + ',' + wy + (moved ? '' : '(挡)');
        if (!moved) {
          for (const [ox, oy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            if (tapMove(this._world, LegendModule, wx + ox, wy + oy)) { this.townMsg += '→邻'; break; }
          }
        }
        if (sx === undefined || sy === undefined) { this.townMsg = tag + ':无坐标 [' + keys + ']'; return; }

      } catch (err) {
        this.townMsg = tag + 'ERR:' + err;
      }
    },
    doAttack() {
      const w = this._world;
      if (!w) return;
      if (!w.targetId) { this.pickTarget(); return; }
    },
    doCast(key) {
      const w = this._world;
      if (!w) return;
      const r = cast(w, LegendModule, key, { dt: 0.05, now: Date.now(), rng: this._rngState });
      if (!r.ok && r.reason) this.townMsg = r.reason;
    },
    drink(kind) {
      const w = this._world;
      if (!w) return;
      const r = quickPotion(w, kind);
      if (!r.ok && r.reason) this.townMsg = r.reason;
    },
    skillReady(key) {
      const w = this._world;
      if (!w) return false;
      const p = this._player;
      if (key === 'gongsha') return !!p.skillUnlocks.gongsha;
      if (key === 'banyue') return !!p.skillUnlocks.banyue;
      if (key === 'liehuo') return !!p.skillUnlocks.liehuo;
      return false;
    },

    // ---------- 背包 ----------
    buildBag() {
      const p = this._player;
      const rows = [];
      const colors = {};
      for (const q of QUALITIES) colors[q.key] = q.color;
      p.inventory.forEach((it, idx) => {
        const parts = [];
        if (it.atkMax) parts.push('攻' + it.atkMin + '-' + it.atkMax);
        if (it.def) parts.push('防' + it.def);
        for (const a of it.affixes) parts.push(a.name + '+' + a.value);
        rows.push({
          key: 'b' + idx,
          ref: idx,
          name: it.name,
          plus: it.plus || 0,
          color: colors[it.quality] || '#d8d8d8',
          stat: parts.join(' ') + (' 需Lv' + it.req),
          sell: '●' + Math.max(5, Math.round(it.ilvl * 6 * (it.quality === 'white' ? 1 : it.quality === 'magic' ? 2.2 : it.quality === 'rare' ? 4 : 7)))
        });
      });
      this.bagItems = rows;
    },
    equipItem(idx) {
      const p = this._player;
      const it = p.inventory[idx];
      if (!it) return;
      if (p.level < it.req) { this.townMsg = '等级不足（需 Lv' + it.req + '）'; return; }
      const old = p.equipped[it.slot];
      p.equipped[it.slot] = it;
      p.inventory.splice(idx, 1);
      if (old) p.inventory.push(old);
      this.buildBag();
      this.refreshHud();
      this.persist();
    },
    sellItem(idx) {
      const p = this._player;
      const it = p.inventory[idx];
      if (!it) return;
      const price = Math.max(5, Math.round(it.ilvl * 6 * (it.quality === 'white' ? 1 : it.quality === 'magic' ? 2.2 : it.quality === 'rare' ? 4 : 7)));
      p.gold += price;
      p.inventory.splice(idx, 1);
      this.buildBag();
      this.refreshHud();
      this.persist();
    },

    // ---------- 角色 ----------
    addPoint(stat) {
      if (spendPoint(this._player, stat)) { this.refreshHud(); this.persist(); }
    },

    // ---------- 商店/铁匠 ----------
    buildShop() {
      const p = this._player;
      this.shopItems = ['hp_s', 'hp_m', 'mp_s'].map(key => {
        const def = POTIONS[key];
        return { key, name: def.name, price: def.price, own: p.potions[key] || 0 };
      });
    },
    buyPotion(p) {
      const player = this._player;
      if (player.gold < p.price) { this.townMsg = '金币不足'; return; }
      if ((player.potions[p.key] || 0) >= 9) { this.townMsg = '该药水已满 9'; return; }
      player.gold -= p.price;
      player.potions[p.key] = (player.potions[p.key] || 0) + 1;
      this.buildShop();
      this.refreshHud();
      this.persist();
    },
    doReforge() {
      const p = this._player;
      const w = p.equipped[0];
      if (!w) return;
      const cost = (w.plus + 1) * 120;
      this._rngState = this._rngState || createRng(Date.now() & 0xffff);
      const r = requireReforge(p, w, this._rngState, 1, cost);
      if (!r.ok) { this.smithMsg = r.reason; return; }
      this.smithMsg = r.success ? '强化成功！' + w.name + ' +' + r.plus : '强化失败，材料已消耗（武器无损）';
      this.refreshHud();
      this.persist();
    }
  }
};

function requireReforge(player, item, rng, oreCost, goldCost) {
  if (player.ore < oreCost) return { ok: false, reason: '黑铁矿石不足' };
  if (player.gold < goldCost) return { ok: false, reason: '金币不足' };
  if ((item.plus || 0) >= 7) return { ok: false, reason: '已达 +7' };
  player.ore -= oreCost;
  player.gold -= goldCost;
  const chance = REFORGE_CHANCES[item.plus || 0];
  const success = rng() * 100 < chance;
  if (success) item.plus = (item.plus || 0) + 1;
  return { ok: true, success, plus: item.plus || 0 };
}
</script>

<style lang="less" scoped>
.page {
  width: 800px;
  height: 254px;
  background-color: #0b0d10;
}
.tap-layer {
  position: absolute;
  left: 0px;
  top: 0px;
  width: 800px;
  height: 254px;
  z-index: 100;
  background-color: rgba(0, 0, 0, 0.01);
}
.game-canvas {
  position: absolute;
  left: 0px;
  top: 0px;
  width: 800px;
  height: 254px;
}

/* 实体 */
.ent {
  position: absolute;
  width: 28px;
  height: 30px;
}
.hero {
  background-color: #ffd24a;
  border-radius: 10px;
  border-width: 2px;
  border-style: solid;
  border-color: #ffffff;
}
.mob {
  background-color: #c0504d;
  border-radius: 8px;
}
.mhit {
  background-color: #ffffff;
}
.mboss {
  background-color: #7b2d8b;
  width: 40px;
  height: 42px;
  border-radius: 12px;
}
.ent-hp {
  position: absolute;
  left: 0px;
  top: -6px;
  width: 28px;
  height: 3px;
  background-color: #441111;
}
.ent-hp-fill {
  height: 3px;
  background-color: #e84c3d;
}
.drop-dot {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 4px;
}
.dgold {
  background-color: #ffcc44;
}
.dpot {
  background-color: #e84c3d;
}
.dore {
  background-color: #8a8a8a;
}
.dloot {
  background-color: #5aa0ff;
}
.fx-text {
  position: absolute;
  width: 80px;
  font-size: 13px;
  color: #ffffff;
  text-align: center;
}

/* HUD */
.hud {
  position: absolute;
  left: 0px;
  top: 0px;
  width: 800px;
  height: 34px;
  flex-direction: row;
  background-color: rgba(10, 12, 16, 0.72);
  z-index: 3000;
}
.hud-bars {
  width: 250px;
  height: 34px;
}
.bar-track {
  position: relative;
  left: 6px;
  top: 5px;
  width: 238px;
  height: 10px;
  background-color: #2a1215;
  border-radius: 3px;
}
.mp {
  top: 19px;
  height: 8px;
  background-color: #14202e;
}
.bar-fill {
  height: 10px;
  background-color: #e84c3d;
  border-radius: 3px;
}
.mp-fill {
  height: 8px;
  background-color: #3f7fe0;
}
.bar-text {
  position: absolute;
  left: 8px;
  top: -3px;
  font-size: 9px;
  color: #ffffff;
}
.mp-text {
  top: -2px;
}
.hud-mid {
  width: 300px;
  height: 34px;
  flex-direction: row;
  align-items: center;
}
.hud-level {
  font-size: 14px;
  color: #ffd24a;
  margin-left: 10px;
  margin-right: 8px;
}
.xp-track {
  width: 170px;
  height: 5px;
  background-color: #20242c;
  border-radius: 2px;
}
.xp-fill {
  height: 5px;
  background-color: #9b59b6;
  border-radius: 2px;
}
.hud-gold {
  font-size: 14px;
  color: #ffcc44;
  margin-left: 10px;
}

.hud-btns {
  position: absolute;
  right: 0px;
  top: 0px;
  flex-direction: row;
}
.hud-btn {
  width: 46px;
  height: 30px;
  margin-left: 6px;
  margin-top: 2px;
  background-color: #223344;
  border-radius: 6px;
}
.hud-btn-text {
  font-size: 14px;
  color: #ffffff;
  text-align: center;
  line-height: 30px;
}

/* 操作区：直接挂在页面根节点，显式 left/top */
.dpad {
  position: absolute;
  left: 10px;
  top: 90px;
  width: 156px;
  height: 156px;
  z-index: 3000;
}
.dp {
  position: absolute;
  width: 50px;
  height: 50px;
  background-color: rgba(34, 51, 68, 0.85);
  border-radius: 10px;
}
.dpu {
  left: 52px;
  top: 0px;
}
.dpl {
  left: 0px;
  top: 52px;
}
.dpc {
  left: 52px;
  top: 52px;
  background-color: rgba(60, 80, 100, 0.9);
}
.dpr {
  left: 104px;
  top: 52px;
}
.dpd {
  left: 52px;
  top: 104px;
}
.dp-t {
  font-size: 18px;
  color: #cfe3ff;
  text-align: center;
  line-height: 50px;
}
.skill-bar {
  position: absolute;
  left: 410px;
  top: 162px;
  width: 384px;
  height: 64px;
  flex-direction: row;
  z-index: 3000;
}
.skill {
  width: 54px;
  height: 54px;
  margin-left: 8px;
  background-color: rgba(90, 60, 30, 0.92);
  border-radius: 27px;
}
.atk {
  background-color: rgba(180, 60, 50, 0.95);
  width: 56px;
  height: 56px;
  border-radius: 28px;
}
.spot {
  background-color: rgba(50, 90, 60, 0.92);
}
.cooling {
  opacity: 0.4;
}
.skill-t {
  font-size: 15px;
  color: #ffffff;
  text-align: center;
  line-height: 54px;
}

/* 覆盖层 */
.overlay {
  position: absolute;
  left: 0px;
  top: 0px;
  width: 800px;
  height: 254px;
  background-color: rgba(8, 10, 14, 0.94);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.panel {
  z-index: 5000;
}
.title {
  font-size: 52px;
  color: #ffd24a;
  text-align: center;
  margin-top: 18px;
}
.subtitle {
  font-size: 15px;
  color: #9aa4b0;
  text-align: center;
  margin-top: 4px;
}
.menu-btn {
  width: 220px;
  height: 44px;
  background-color: #2c3e50;
  border-radius: 8px;
  margin-top: 12px;
}
.sm {
  width: 168px;
  height: 44px;
  margin: 8px;
}
.menu-btn-text {
  font-size: 18px;
  color: #ffffff;
  text-align: center;
  line-height: 44px;
}
.hint {
  font-size: 12px;
  color: #6b7684;
  text-align: center;
  margin-top: 8px;
}
.panel-title {
  font-size: 20px;
  color: #ffd24a;
  margin: 8px 0 4px 12px;
}
.town-info {
  font-size: 13px;
  color: #9aa4b0;
  margin-left: 14px;
  margin-top: 2px;
}
.town-grid {
  flex-direction: row;
  flex-wrap: wrap;
  margin-left: 4px;
}
.map-list {
  margin-left: 12px;
}
.map-row {
  width: 500px;
  height: 32px;
  flex-direction: row;
  align-items: center;
  background-color: #1b232e;
  border-radius: 6px;
  margin-top: 5px;
  border-left-width: 4px;
  border-left-style: solid;
  border-left-color: #3f7fe0;
}
.locked {
  opacity: 0.45;
}
.map-name {
  font-size: 14px;
  color: #ffffff;
  margin-left: 10px;
  width: 240px;
}
.map-req {
  font-size: 12px;
  color: #9aa4b0;
}
.bag-scroll {
  width: 776px;
  height: 170px;
  margin-left: 12px;
}
.bag-row {
  width: 756px;
  height: 34px;
  flex-direction: row;
  align-items: center;
  background-color: #1b232e;
  border-radius: 6px;
  margin-top: 4px;
  border-left-width: 4px;
  border-left-style: solid;
}
.bag-name {
  font-size: 13px;
  width: 250px;
  margin-left: 8px;
}
.bag-stat {
  font-size: 11px;
  color: #9aa4b0;
  width: 330px;
}
.bag-act {
  width: 56px;
  height: 26px;
  background-color: #2c5e50;
  border-radius: 5px;
  margin-left: 6px;
}
.sell {
  background-color: #5e4a2c;
}
.bag-act-t {
  font-size: 12px;
  color: #ffffff;
  text-align: center;
  line-height: 26px;
}
.bag-empty {
  font-size: 13px;
  color: #6b7684;
  margin: 10px;
}
.char-line {
  font-size: 13px;
  color: #cfd6de;
  margin-left: 14px;
  margin-top: 3px;
}
.stat-row {
  flex-direction: row;
  align-items: center;
  margin-left: 14px;
  margin-top: 4px;
}
.stat-add {
  width: 34px;
  height: 26px;
  background-color: #2c5e50;
  border-radius: 5px;
  margin-right: 8px;
}
.stat-add-t {
  font-size: 16px;
  color: #ffffff;
  text-align: center;
  line-height: 26px;
}
.stat-name {
  font-size: 13px;
  color: #cfd6de;
}
.close-btn {
  position: absolute;
  right: 12px;
  top: 8px;
  width: 88px;
  height: 30px;
  background-color: #223344;
  border-radius: 6px;
}
.close-text {
  font-size: 14px;
  color: #ffffff;
  text-align: center;
  line-height: 30px;
}
</style>
