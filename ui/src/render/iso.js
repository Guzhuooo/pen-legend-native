// 2.5D 斜45°投影：世界坐标(tile, float) → 屏幕坐标
// 菱形瓦片 40×20（2:1 iso），玩家精灵底部锚点在菱形中心。
export const TILE_W = 40;
export const TILE_H = 20;
export const WALL_H = 14;   // 墙体抬升高度
export const SPRITE_W = 30; // 人物精灵显示宽
export const SPRITE_H = 34;

export function worldToScreen(camX, camY, x, y) {
  return {
    x: Math.round(400 + (x - camX - (y - camY)) * (TILE_W / 2)),
    y: Math.round(127 + (x - camX + (y - camY)) * (TILE_H / 2))
  };
}

// 相机：把玩家保持在画面中心偏下
export function cameraFor(player) {
  return { camX: player.x, camY: player.y };
}

// 需要绘制的 tile 范围（屏幕 800×254 → tile 世界窗口）
export function visibleTileBounds(camX, camY) {
  // 屏幕半宽 400px → ±400/(TILE_W/2)=±20 tile（x-y 方向），高 127px → ±13
  const rx = 22, ry = 15;
  return {
    minX: Math.floor(camX - (rx + ry) / 2),
    maxX: Math.ceil(camX + (rx + ry) / 2),
    minY: Math.floor(camY - (rx - ry) / 2 - 4),
    maxY: Math.ceil(camY + (rx - ry) / 2 + 4)
  };
}

export function tileDepth(x, y) { return (x + y); }
