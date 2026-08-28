// Canvas 2.5D 渲染器：只画地形（菱形地面 + 抬升墙体），实体由 DOM 精灵层负责。
// 真机探测结论：ctx 矢量绘制可用且快（~370fps@400矩形），drawImage/fillText 不可用。
import { TILE_W, TILE_H, WALL_H, worldToScreen } from './iso.js';

const PALETTES = {
  0: { g1: '#3f6f46', g2: '#38643f', wallTop: '#8a7a5c', wallL: '#5d5140', wallR: '#6f6150', bg: '#10151b' },
  1: { g1: '#3d6b42', g2: '#365f3b', wallTop: '#4f7a44', wallL: '#33512e', wallR: '#406238', bg: '#101812' },
  2: { g1: '#5c4a35', g2: '#523f2d', wallTop: '#6e5a42', wallL: '#3a2e20', wallR: '#4a3a29', bg: '#14100c' },
  3: { g1: '#565a68', g2: '#4c505c', wallTop: '#7a7f8f', wallL: '#3b3e49', wallR: '#4a4e5b', bg: '#121319' },
  4: { g1: '#5a5468', g2: '#504a5c', wallTop: '#837a99', wallL: '#3e3949', wallR: '#4d4760', bg: '#131017' }
};

function diamond(ctx, sx, sy, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + TILE_W / 2, sy + TILE_H / 2);
  ctx.lineTo(sx, sy + TILE_H);
  ctx.lineTo(sx - TILE_W / 2, sy + TILE_H / 2);
  ctx.closePath();
  ctx.fill();
}

function wallBlock(ctx, sx, sy, pal) {
  const top = sy - WALL_H;
  // 顶面
  diamond(ctx, sx, top, pal.wallTop);
  // 左侧面
  ctx.fillStyle = pal.wallL;
  ctx.beginPath();
  ctx.moveTo(sx - TILE_W / 2, top + TILE_H / 2);
  ctx.lineTo(sx, top + TILE_H);
  ctx.lineTo(sx, top + TILE_H + WALL_H);
  ctx.lineTo(sx - TILE_W / 2, top + TILE_H / 2 + WALL_H);
  ctx.closePath();
  ctx.fill();
  // 右侧面
  ctx.fillStyle = pal.wallR;
  ctx.beginPath();
  ctx.moveTo(sx + TILE_W / 2, top + TILE_H / 2);
  ctx.lineTo(sx, top + TILE_H);
  ctx.lineTo(sx, top + TILE_H + WALL_H);
  ctx.lineTo(sx + TILE_W / 2, top + TILE_H / 2 + WALL_H);
  ctx.closePath();
  ctx.fill();
}

// 主渲染入口。按 iso 对角线窗口绘制：|dx-dy|≤A_LIMIT，|dx+dy|≤B_LIMIT
const A_LIMIT = 21;  // 屏幕 400px / 20
const B_LIMIT = 17;  // (127 + 墙高) / 10

export function renderTerrain(ctx, world, cam) {
  const pal = PALETTES[world.mapId] || PALETTES[1];
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, 800, 254);

  const c = cam.camX + cam.camY;
  const dLo = Math.ceil(c - B_LIMIT);
  const dHi = Math.floor(c + B_LIMIT);
  for (let d = dLo; d <= dHi; d++) {
    let x0 = Math.ceil((d - A_LIMIT) / 2);
    let x1 = Math.floor((d + A_LIMIT) / 2);
    if (x0 < 0) x0 = 0;
    if (x1 > world.w - 1) x1 = world.w - 1;
    if (d - x1 > world.h - 1 || d - x0 < 0) continue;
    const xa = Math.max(x0, d - (world.h - 1));
    const xb = Math.min(x1, d);
    for (let x = xa; x <= xb; x++) {
      const y = d - x;
      const ch = world.tiles.charAt(y * world.w + x);
      const s = worldToScreen(cam.camX, cam.camY, x + 0.5, y + 0.5);
      if (s.x < -TILE_W || s.x > 800 + TILE_W || s.y < -40 || s.y > 254 + TILE_H) continue;
      if (ch === '#') {
        wallBlock(ctx, s.x, s.y - TILE_H / 2, pal);
      } else if (ch === '*') {
        diamond(ctx, s.x, s.y - TILE_H / 2 - 6, pal.wallTop);
        ctx.fillStyle = pal.wallL;
        ctx.fillRect(s.x - 4, s.y - TILE_H / 2 - 6, 8, 12);
      } else {
        diamond(ctx, s.x, s.y - TILE_H / 2, ((x + y) & 1) ? pal.g1 : pal.g2);
      }
    }
  }
}
