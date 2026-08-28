#include "Legend/LegendCore.hpp"
#include <chrono>
#include <cmath>
#include <queue>
#include <algorithm>

namespace legend {

namespace {

// 确定性 32 位 LCG（地图可由 seed 复现）
class Rng {
public:
    explicit Rng(uint32_t seed) : state_(seed ? seed : 0x9E3779B9u) {}
    uint32_t next() {
        state_ = state_ * 1664525u + 1013904223u;
        return state_;
    }
    uint32_t range(uint32_t n) { return n ? next() % n : 0; }
    int rangeInt(int lo, int hi) { return lo + (int)range((uint32_t)(hi - lo + 1)); }

private:
    uint32_t state_;
};

constexpr uint8_t WALL = '#';
constexpr uint8_t FLOOR = '.';
constexpr uint8_t GRASS = ',';
constexpr uint8_t PILLAR = '*';

} // namespace

LegendCore::LegendCore() = default;

bool LegendCore::inside(int x, int y) const { return x >= 0 && y >= 0 && x < map_.w && y < map_.h; }
char LegendCore::at(int x, int y) const { return inside(x, y) ? map_.tiles[(size_t)y * map_.w + x] : WALL; }
void LegendCore::setAt(int x, int y, char c) {
    if (inside(x, y)) map_.tiles[(size_t)y * map_.w + x] = c;
}
bool LegendCore::walkable(int x, int y) const {
    char c = at(x, y);
    return c == FLOOR || c == GRASS;
}
void LegendCore::fillRect(char c, int x0, int y0, int w, int h) {
    for (int y = y0; y < y0 + h; ++y)
        for (int x = x0; x < x0 + w; ++x) setAt(x, y, c);
}

int LegendCore::findFloorNear(uint32_t seed, int x, int y) const {
    Rng rng(seed);
    if (walkable(x, y)) return y * map_.w + x;
    for (int r = 1; r < 12; ++r) {
        for (int attempt = 0; attempt < 24; ++attempt) {
            int cx = x + rng.rangeInt(-r, r);
            int cy = y + rng.rangeInt(-r, r);
            if (walkable(cx, cy)) return cy * map_.w + cx;
        }
    }
    return -1;
}

void LegendCore::scatterMonsters(uint32_t seed, int count, const std::vector<MapSpawn> &pool, int minDist) {
    Rng rng(seed ^ 0x5DEECE66u);
    int placed = 0;
    int attempts = 0;
    while (placed < count && attempts < count * 40) {
        ++attempts;
        int x = rng.rangeInt(1, map_.w - 2);
        int y = rng.rangeInt(1, map_.h - 2);
        if (!walkable(x, y)) continue;
        int dx = x - map_.spawnX;
        int dy = y - map_.spawnY;
        if (dx * dx + dy * dy < minDist * minDist) continue;
        const MapSpawn &proto = pool[rng.range(pool.size())];
        map_.monsters.push_back({x, y, proto.type, proto.level});
        ++placed;
    }
}

// ---- 村庄：围墙 + 若干建筑块 + 中心水井 ----
void LegendCore::genVillage(uint32_t seed) {
    Rng rng(seed ^ 0xABCD1234u);
    map_.w = 48;
    map_.h = 48;
    map_.tiles.assign((size_t)map_.w * map_.h, GRASS);
    // 外圈围墙
    for (int x = 0; x < map_.w; ++x) { setAt(x, 0, WALL); setAt(x, map_.h - 1, WALL); }
    for (int y = 0; y < map_.h; ++y) { setAt(0, y, WALL); setAt(map_.w - 1, y, WALL); }
    // 建筑（矩形实心块）
    for (int i = 0; i < 7; ++i) {
        int bw = rng.rangeInt(4, 7);
        int bh = rng.rangeInt(3, 5);
        int bx = rng.rangeInt(2, map_.w - bw - 3);
        int by = rng.rangeInt(2, map_.h - bh - 3);
        int dx = bx + bw / 2 - map_.w / 2;
        int dy = by + bh / 2 - map_.h / 2;
        if (dx * dx + dy * dy < 20 * 20) continue; // 让开中心区
        fillRect(WALL, bx, by, bw, bh);
    }
    // 中心水井
    int cx = map_.w / 2, cy = map_.h / 2;
    fillRect(PILLAR, cx - 1, cy - 1, 2, 2);
    map_.spawnX = cx + 3;
    map_.spawnY = cy + 3;
    map_.monsters.clear(); // 安全区
}

// ---- 野外：草地 + 灌木簇 ----
void LegendCore::genMeadow(uint32_t seed) {
    Rng rng(seed ^ 0x1234ABCDu);
    map_.w = 56;
    map_.h = 56;
    map_.tiles.assign((size_t)map_.w * map_.h, GRASS);
    for (int x = 0; x < map_.w; ++x) { setAt(x, 0, WALL); setAt(x, map_.h - 1, WALL); }
    for (int y = 0; y < map_.h; ++y) { setAt(0, y, WALL); setAt(map_.w - 1, y, WALL); }
    // 随机树墙簇（ drunk blocks ）
    for (int i = 0; i < 26; ++i) {
        int bw = rng.rangeInt(1, 4);
        int bh = rng.rangeInt(1, 3);
        int bx = rng.rangeInt(2, map_.w - bw - 3);
        int by = rng.rangeInt(2, map_.h - bh - 3);
        fillRect(WALL, bx, by, bw, bh);
    }
    map_.spawnX = map_.w / 2;
    map_.spawnY = map_.h / 2;
    setAt(map_.spawnX, map_.spawnY, GRASS);
}

// ---- 矿洞：醉汉游走雕刻有机洞穴 ----
void LegendCore::genCave(uint32_t seed) {
    Rng rng(seed ^ 0x77E1B00u);
    map_.w = 56;
    map_.h = 56;
    map_.tiles.assign((size_t)map_.w * map_.h, WALL);
    int cx = map_.w / 2, cy = map_.h / 2;
    int carvers = 7;
    int steps = 460;
    for (int c = 0; c < carvers; ++c) {
        int x = cx, y = cy;
        for (int s = 0; s < steps; ++s) {
            setAt(x, y, FLOOR);
            if (rng.range(3) == 0) setAt(x + 1, y, FLOOR);
            int dir = rng.range(4);
            switch (dir) {
            case 0: x = std::min(map_.w - 2, x + 1); break;
            case 1: x = std::max(1, x - 1); break;
            case 2: y = std::min(map_.h - 2, y + 1); break;
            case 3: y = std::max(1, y - 1); break;
            }
        }
    }
    map_.spawnX = cx;
    map_.spawnY = cy;
    if (!walkable(cx, cy)) { setAt(cx, cy, FLOOR); }
}

// ---- 寺庙：房间 + 走廊 + 石柱阵 ----
void LegendCore::genTemple(uint32_t seed, int pillarRooms) {
    Rng rng(seed ^ 0x0BADC0DEu);
    map_.w = 60;
    map_.h = 60;
    map_.tiles.assign((size_t)map_.w * map_.h, WALL);

    struct Room { int x, y, w, h; };
    std::vector<Room> rooms;
    for (int attempt = 0; attempt < 60 && rooms.size() < 9; ++attempt) {
        int rw = rng.rangeInt(6, 12);
        int rh = rng.rangeInt(5, 10);
        int rx = rng.rangeInt(1, map_.w - rw - 2);
        int ry = rng.rangeInt(1, map_.h - rh - 2);
        bool overlap = false;
        for (const Room &r : rooms) {
            if (rx < r.x + r.w + 2 && rx + rw + 2 > r.x &&
                ry < r.y + r.h + 2 && ry + rh + 2 > r.y) { overlap = true; break; }
        }
        if (overlap) continue;
        rooms.push_back({rx, ry, rw, rh});
        fillRect(FLOOR, rx, ry, rw, rh);
    }
    // 走廊：按生成顺序 L 形连接房间中心
    for (size_t i = 1; i < rooms.size(); ++i) {
        Room &a = rooms[i - 1];
        Room &b = rooms[i];
        int ax = a.x + a.w / 2, ay = a.y + a.h / 2;
        int bx = b.x + b.w / 2, by = b.y + b.h / 2;
        for (int x = std::min(ax, bx); x <= std::max(ax, bx); ++x) setAt(x, ay, FLOOR);
        for (int y = std::min(ay, by); y <= std::max(ay, by); ++y) setAt(bx, y, FLOOR);
    }
    // 石柱（仪式感 + 掩体）
    for (int i = 0; i < pillarRooms && !rooms.empty(); ++i) {
        const Room &r = rooms[rng.range(rooms.size())];
        for (int px = r.x + 2; px < r.x + r.w - 1; px += 2)
            for (int py = r.y + 2; py < r.y + r.h - 1; py += 2)
                setAt(px, py, PILLAR);
    }
    // 出生点：第一个房间中心
    const Room &first = rooms.front();
    map_.spawnX = first.x + first.w / 2;
    map_.spawnY = first.y + first.h / 2;
    setAt(map_.spawnX, map_.spawnY, FLOOR);
}

const GameMap &LegendCore::genMap(uint32_t seed, int mapId) {
    map_.mapId = mapId;
    map_.monsters.clear();
    switch (mapId) {
    case 0: genVillage(seed); break;
    case 1: genMeadow(seed); break;
    case 2: genCave(seed); break;
    case 3: genTemple(seed, 3); break;
    default: genTemple(seed, 6); break;
    }

    // 怪物配置：与 JS 端 monsters 数值表对应
    std::vector<MapSpawn> pool;
    int count = 0;
    int minDist = 8;
    if (mapId == 1) {
        pool = {{0, 0, 1, 1}, {0, 0, 2, 2}};              // 鸡 / 鹿
        count = 26;
        minDist = 6;
    } else if (mapId == 2) {
        pool = {{0, 0, 3, 3}, {0, 0, 4, 5}, {0, 0, 5, 6}}; // 骷髅 / 僵尸 / 掷斧骷髅
        count = 30;
    } else if (mapId == 3) {
        pool = {{0, 0, 6, 9}, {0, 0, 7, 11}};              // 沃玛战士 / 勇士
        count = 30;
    } else if (mapId == 4) {
        pool = {{0, 0, 9, 15}, {0, 0, 10, 16}};            // 祖玛卫士 / 雕像
        count = 32;
    } else {
        pool = {{0, 0, 3, 3}};
        count = 10;
    }
    scatterMonsters(seed, count, pool, minDist);

    // Boss：3 图沃玛教主 / 4 图祖玛教主，放在离出生点最远的可走格
    if (mapId == 3 || mapId == 4) {
        int best = -1;
        long bestD = -1;
        for (int y = 1; y < map_.h - 1; ++y) {
            for (int x = 1; x < map_.w - 1; ++x) {
                if (!walkable(x, y)) continue;
                long d = (long)(x - map_.spawnX) * (x - map_.spawnX) +
                         (long)(y - map_.spawnY) * (y - map_.spawnY);
                if (d > bestD) { bestD = d; best = y * map_.w + x; }
            }
        }
        if (best >= 0) {
            map_.monsters.push_back({best % map_.w, best / map_.w, mapId == 3 ? 8 : 11,
                                     mapId == 3 ? 14 : 20});
        }
    }
    return map_;
}

std::vector<int32_t> LegendCore::pathTo(int sx, int sy, int tx, int ty) {
    std::vector<int32_t> out;
    if (!inside(sx, sy) || !inside(tx, ty)) return out;
    if (!walkable(sx, sy) || !walkable(tx, ty)) return out;
    if (sx == tx && sy == ty) return out;

    const int W = map_.w;
    const size_t N = (size_t)W * map_.h;
    std::vector<float> g(N, 1e9f);
    std::vector<int32_t> from(N, -1);
    std::vector<char> closed(N, 0);

    using Node = std::pair<float, int32_t>; // (f, index)
    std::priority_queue<Node, std::vector<Node>, std::greater<Node>> open;
    const int startIdx = sy * W + sx;
    const int goalIdx = ty * W + tx;
    g[startIdx] = 0.f;
    open.push({0.f, startIdx});

    const int dx8[8] = {1, -1, 0, 0, 1, 1, -1, -1};
    const int dy8[8] = {0, 0, 1, -1, 1, -1, 1, -1};
    const float cost8[8] = {1, 1, 1, 1, 1.4142f, 1.4142f, 1.4142f, 1.4142f};

    int expanded = 0;
    const int kMaxExpand = 6000;
    while (!open.empty() && expanded < kMaxExpand) {
        Node cur = open.top();
        open.pop();
        int32_t idx = cur.second;
        if (closed[idx]) continue;
        closed[idx] = 1;
        ++expanded;
        if (idx == goalIdx) break;
        int cx = idx % W;
        int cy = idx / W;
        for (int d = 0; d < 8; ++d) {
            int nx = cx + dx8[d];
            int ny = cy + dy8[d];
            if (!walkable(nx, ny)) continue;
            if (d >= 4 && (!walkable(cx + dx8[d], cy) || !walkable(cx, cy + dy8[d]))) continue; // 禁止穿墙缝
            int32_t nIdx = ny * W + nx;
            if (closed[nIdx]) continue;
            float ng = g[idx] + cost8[d];
            if (ng < g[nIdx]) {
                g[nIdx] = ng;
                from[nIdx] = idx;
                float hx = (float)std::abs(nx - tx), hy = (float)std::abs(ny - ty);
                float h = std::max(hx, hy) + 0.4142f * std::min(hx, hy);
                open.push({ng + h, nIdx});
            }
        }
    }

    if (!closed[goalIdx]) return out; // 不可达
    int32_t walk = goalIdx;
    while (walk != startIdx && walk >= 0) {
        out.push_back(walk % W);
        out.push_back(walk / W);
        walk = from[walk];
    }
    std::reverse(out.begin(), out.end());
    return out;
}

double LegendCore::bench(int n) const {
    if (n <= 0) n = 1;
    auto t0 = std::chrono::steady_clock::now();
    volatile uint32_t sink = 0;
    uint32_t x = 12345;
    for (int i = 0; i < n; ++i) {
        x = x * 1664525u + 1013904223u;
        sink ^= x;
    }
    (void)sink;
    auto t1 = std::chrono::steady_clock::now();
    return std::chrono::duration<double, std::milli>(t1 - t0).count();
}

} // namespace legend
