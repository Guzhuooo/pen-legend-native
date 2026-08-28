// 一次性页面改造脚本：删方向键、快照渲染、类型外观+名牌
const fs = require('fs');
const p = 'F:/传奇/ui/src/pages/index/index.vue';
let s = fs.readFileSync(p, 'utf8');

// 1. 删方向键模板（dpad 整块，从 <div class="dpad" 到 dpd 按钮的闭合）
const dpStart = s.indexOf('    <div class="dpad"');
if (dpStart > 0) {
  const anchor = s.indexOf('class="dp dpd"', dpStart);
  const dpEnd = s.indexOf('</div>', anchor) + 6;
  s = s.slice(0, dpStart) + s.slice(dpEnd);
}

// 2. import 更新
s = s.replace(
  "import { createWorld, tick, cast, lockNearest, quickPotion, tapMove, visibleMobs, syncStats } from '../../engine/game.js';",
  "import { createWorld, tick, cast, lockNearest, quickPotion, tapWorldMove, syncStats } from '../../engine/game.js';");

// 3. onTap 改用 tapWorld
s = s.replace(/        const moved = tapMove\(this\._world, LegendModule, wx, wy\);[\s\S]*?        \}\n/,
  `        const r = tapWorldMove(this._world, LegendModule, wx, wy);
        this.townMsg = (r > 0 ? '锁' + r + ' ' : '') + tag + wx + ',' + wy + (r === -1 ? '挡' : '');
`);

// 4. 怪物渲染：快照数组 + 类型外观 + 名牌
s = s.replace(/      for \(const mv of visibleMobs\(w, LegendModule\)\) \{[\s\S]*?      \}\n      const ps =/,
  `      for (const mv of w.mobs) {
        // mv = [id, type, level, x, y, hp, maxHp, flash]（与地形同相机快照）
        const mon = MONSTERS[mv[1]];
        if (!mon) continue;
        const s = worldToScreen(cam.camX, cam.camY, mv[3], mv[4]);
        if (s.x < -40 || s.x > 840) continue;
        const pct = Math.max(0, Math.round(mv[5] / mv[6] * 100));
        sprites.push({
          key: 'm' + mv[0],
          cls: 'mob m' + mv[1] + (mv[7] ? ' mhit' : '') + (mon.boss ? ' mboss' : ''),
          label: mon.name + ' ' + mv[2],
          style: { left: (s.x - 15) + 'px', top: (s.y - 30) + 'px', zIndex: 1000 + Math.round(mv[3] + mv[4]) },
          hpPct: pct,
          hpStyle: { width: pct + '%' }
        });
      }
      const ps =`);

// 5. 精灵模板：名牌 + 血条 + 类型体
s = s.replace(/    <div v-for="e in sprites" :key="e\.key" class="ent" :class="e\.cls" :style="e\.style">\n      <div class="ent-hp" v-if="e\.hpPct !== null"><div class="ent-hp-fill" :style="e\.hpStyle"><\/div><\/div>\n    <\/div>/,
  `    <div v-for="e in sprites" :key="e.key" class="ent" :class="e.cls" :style="e.style">
      <text class="ent-name">{{ e.label || '' }}</text>
      <div class="ent-hp" v-if="e.hpPct !== null"><div class="ent-hp-fill" :style="e.hpStyle"></div></div>
      <div class="ent-body"></div>
    </div>`);

// 6. frame 不再传方向
s = s.replace(
  'tick(w, LegendModule, { dt, now, rng: this._rngState, native: LegendModule }, { move: { dx: this.dirX, dy: this.dirY }, clearMove: !this.dirX && !this.dirY });',
  'tick(w, LegendModule, { dt, now, rng: this._rngState, native: LegendModule }, { move: { dx: 0, dy: 0 } });');

// 7. 删 pressDir/releaseDir
s = s.replace(/    pressDir\(x, y\) \{[^\n]*\n/, '');
s = s.replace(/    releaseDir\(\) \{[^\n]*\n/, '');

// 8. 数据字段清理 dirX/dirY
s = s.replace(/      dirX: 0, dirY: 0,\n/, '');

// 9. CSS：删 dpad/dp 系列，加类型外观与名牌
s = s.replace(/\.dpad \{[\s\S]*?\.dpd \{[^}]*\}\n/, '');
s = s.replace(/\.dp \{[^}]*\}\n/, '');
s = s.replace(/\.dpu \{[^}]*\}\n/, '');
s = s.replace(/\.dpl \{[^}]*\}\n/, '');
s = s.replace(/\.dpc \{[^}]*\}\n/, '');
s = s.replace(/\.dpr \{[^}]*\}\n/, '');
s = s.replace(/\.dpd \{[^}]*\}\n/, '');
s = s.replace(/\.dp-t \{[^}]*\}\n/, '');

// 名牌
s = s.replace('.ent {', `.ent-name {
  position: absolute;
  left: -14px;
  top: -16px;
  width: 60px;
  font-size: 9px;
  color: #ffe9a8;
  text-align: center;
}
.ent-body {
  position: absolute;
  left: 2px;
  top: 4px;
  width: 24px;
  height: 24px;
  border-radius: 7px;
}
.ent {`);

// 类型外观（色块形状差异，英雄黄方块不变）
const skins = {
  m1:  '#f5d76e', m2:  '#c8a165', m3:  '#e8e4d8', m4:  '#7da05a',
  m5:  '#b0703a', m6:  '#d05050', m7:  '#a03050', m8:  '#7b2d8b',
  m9:  '#5070d0', m10: '#8a8fa8', m11: '#5a1a6b'
};
let skinCss = '\n';
for (const k in skins) skinCss += '.' + k + ' .ent-body { background-color: ' + skins[k] + '; }\n';
skinCss += '.m3 .ent-body { border-radius: 12px; }\n.m4 .ent-body { border-radius: 3px; }\n.m8 .ent-body { border-radius: 13px; width: 34px; height: 34px; left: -2px; }\n.m11 .ent-body { border-radius: 14px; width: 36px; height: 36px; left: -3px; }\n';
s = s.replace('.mob {', skinCss + '.mob {');

// 精灵本体不再直接着色（改由 ent-body 承担），保留命中闪白于 body
s = s.replace('.mob {\n  background-color: #c0504d;\n  border-radius: 8px;\n}', '.mob {\n  background-color: rgba(0,0,0,0.01);\n}');
s = s.replace('.mhit {\n  background-color: #ffffff;\n}', '.mhit .ent-body {\n  background-color: #ffffff;\n}');
s = s.replace(/\.mboss \{[^}]*\}/, '.mboss .ent-name {\n  color: #ff9df5;\n  width: 90px;\n  left: -34px;\n}');

fs.writeFileSync(p, s);
console.log('page transform done');
