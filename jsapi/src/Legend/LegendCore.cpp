#include "Legend/LegendCore.hpp"
#include <chrono>
#include <cmath>
#include <queue>
#include <algorithm>

namespace legend {

namespace {
constexpr uint8_t WALL = '#';
constexpr uint8_t FLOOR = '.';
constexpr uint8_t GRASS = ',';
constexpr uint8_t PILLAR = '*';

// 平衡常数（与 DESIGN.md 对应）
constexpr float PLAYER_SPEED = 3.2f;     // tiles/s
constexpr float CORNER = 0.32f;          // 玩家碰撞半径
constexpr float ACTIVATE_DIST = 12.0f;   // 怪物 AI 激活半径
constexpr float DESPAWN_DIST = 22.0f;    // 无仇恨怪清理半径
constexpr float RESPAWN_RING_MIN = 10.0f, RESPAWN_RING_MAX = 16.0f;
constexpr float CLEANUP_INTERVAL = 5.0f; // 清理检查周期（秒）
constexpr float RESPAWN_DELAY = 20.0f;   // 击杀后重生延迟
constexpr float MOB_SPEED = 1.5f;        // 追击速度
constexpr float MELEE_RANGE = 1.5f;

// 怪物基础表（type, level, hp, atkMin, atkMax, def, aggro, atkInterval, speedMul, ranged）
struct MonDef { int type, level, hp, atkMin, atkMax, def, aggro; float atkInterval, speedMul; int ranged; };
const MonDef MON_DEFS[] = {
    { 1,  1,  12,  1,  2, 0, 0, 2.0f, 0.6f, 0 },  // 鸡
    { 2,  2,  22,  2,  3, 1, 0, 2.0f, 0.9f, 0 },  // 鹿
    { 3,  3,  35,  3,  6, 2, 5, 1.8f, 0.9f, 0 },  // 骷髅
    { 4,  5,  62,  5,  9, 3, 5, 2.2f, 0.55f, 0 }, // 僵尸
    { 5,  6,  45,  6, 10, 2, 6, 2.5f, 0.8f, 4 },  // 掷斧骷髅
    { 6,  9, 115,  9, 15, 6, 5, 1.6f, 0.9f, 0 },  // 沃玛战士
    { 7, 11, 175, 13, 20, 8, 5, 1.6f, 0.9f, 0 },  // 沃玛勇士
    { 8, 14, 900, 18, 28,10, 7, 2.0f, 0.5f, 0 },  // 沃玛教主
    { 9, 15, 230, 15, 24,10, 5, 1.5f, 1.0f, 0 },  // 祖玛卫士
    {10, 16, 185, 18, 28, 8, 6, 2.4f, 0.45f, 5 }, // 祖玛雕像
    {11, 20,2400, 26, 40,14, 7, 1.8f, 0.8f, 0 },  // 祖玛教主
};
const MonDef *monDef(int type) {
    for (const MonDef &d : MON_DEFS) if (d.type == type) return &d;
    return &MON_DEFS[0];
}
} // namespace

LegendCore::LegendCore() = default;

bool LegendCore::inside(int x, int y) const { return x >= 0 && y >= 0 && x < map_.w && y < map_.h; }
char LegendCore::at(int x, int y) const { return inside(x, y) ? map_.tiles[(size_t)y * map_.w + x] : WALL; }
bool LegendCore::walkable(int x, int y) const {
    char c = at(x, y);
    return c == FLOOR || c == GRASS;
}
bool LegendCore::canStand(float x, float y) const {
    return walkable((int)(x - CORNER), (int)y) && walkable((int)(x + CORNER), (int)y) &&
           walkable((int)x, (int)(y - CORNER)) && walkable((int)x, (int)(y + CORNER));
}

void LegendCore::genVillage(uint32_t seed) {
    // 村庄保持兼容：复用 v1 逻辑（围墙+建筑+水井）
    map_.w = 48; map_.h = 48;
    map_.tiles.assign((size_t)map_.w * map_.h, GRASS);
    for (int x = 0; x < map_.w; ++x) { map_.tiles[x] = WALL; map_.tiles[(size_t)(map_.h - 1) * map_.w + x] = WALL; }
    for (int y = 0; y < map_.h; ++y) { map_.tiles[(size_t)y * map_.w] = WALL; map_.tiles[(size_t)y * map_.w + map_.w - 1] = WALL; }
    setRng(seed ^ 0xABCD1234u);
    for (int i = 0; i < 7; ++i) {
        int bw = rngInt(4, 7), bh = rngInt(3, 5);
        int bx = rngInt(2, map_.w - bw - 3), by = rngInt(2, map_.h - bh - 3);
        int dx = bx + bw / 2 - map_.w / 2, dy = by + bh / 2 - map_.h / 2;
        if (dx * dx + dy * dy < 400) continue;
        for (int y = by; y < by + bh; ++y) for (int x = bx; x < bx + bw; ++x) map_.tiles[(size_t)y * map_.w + x] = WALL;
    }
    int cx = map_.w / 2, cy = map_.h / 2;
    for (int y = cy - 1; y <= cy; ++y) for (int x = cx - 1; x <= cx; ++x) map_.tiles[(size_t)y * map_.w + x] = PILLAR;
    map_.spawnX = cx + 3;
    map_.spawnY = cy + 3;
}

void LegendCore::genMeadow(uint32_t seed) {
    map_.w = 56; map_.h = 56;
    map_.tiles.assign((size_t)map_.w * map_.h, GRASS);
    for (int x = 0; x < map_.w; ++x) { map_.tiles[x] = WALL; map_.tiles[(size_t)(map_.h - 1) * map_.w + x] = WALL; }
    for (int y = 0; y < map_.h; ++y) { map_.tiles[(size_t)y * map_.w] = WALL; map_.tiles[(size_t)y * map_.w + map_.w - 1] = WALL; }
    setRng(seed ^ 0x1234ABCDu);
    for (int i = 0; i < 26; ++i) {
        int bw = rngInt(1, 4), bh = rngInt(1, 3);
        int bx = rngInt(2, map_.w - bw - 3), by = rngInt(2, map_.h - bh - 3);
        for (int y = by; y < by + bh; ++y) for (int x = bx; x < bx + bw; ++x) map_.tiles[(size_t)y * map_.w + x] = WALL;
    }
    map_.spawnX = map_.w / 2;
    map_.spawnY = map_.h / 2;
}

void LegendCore::genCave(uint32_t seed) {
    map_.w = 56; map_.h = 56;
    map_.tiles.assign((size_t)map_.w * map_.h, WALL);
    int cx = map_.w / 2, cy = map_.h / 2;
    setRng(seed ^ 0x77E1B00u);
    for (int c = 0; c < 7; ++c) {
        int x = cx, y = cy;
        for (int s = 0; s < 460; ++s) {
            map_.tiles[(size_t)y * map_.w + x] = FLOOR;
            if (rngNext() % 3 == 0 && x + 1 < map_.w - 1) map_.tiles[(size_t)y * map_.w + x + 1] = FLOOR;
            int dir = rngNext() % 4;
            if (dir == 0) x = std::min(map_.w - 2, x + 1);
            else if (dir == 1) x = std::max(1, x - 1);
            else if (dir == 2) y = std::min(map_.h - 2, y + 1);
            else y = std::max(1, y - 1);
        }
    }
    map_.spawnX = cx;
    map_.spawnY = cy;
    if (!walkable(cx, cy)) map_.tiles[(size_t)cy * map_.w + cx] = FLOOR;
}

void LegendCore::genTemple(uint32_t seed, int pillarRooms) {
    map_.w = 60; map_.h = 60;
    map_.tiles.assign((size_t)map_.w * map_.h, WALL);
    setRng(seed ^ 0x0BADC0DEu);
    struct Room { int x, y, w, h; };
    std::vector<Room> rooms;
    for (int attempt = 0; attempt < 60 && (int)rooms.size() < 9; ++attempt) {
        int rw = rngInt(6, 12), rh = rngInt(5, 10);
        int rx = rngInt(1, map_.w - rw - 2), ry = rngInt(1, map_.h - rh - 2);
        bool overlap = false;
        for (const Room &r : rooms)
            if (rx < r.x + r.w + 2 && rx + rw + 2 > r.x && ry < r.y + r.h + 2 && ry + rh + 2 > r.y) { overlap = true; break; }
        if (overlap) continue;
        rooms.push_back({rx, ry, rw, rh});
        for (int y = ry; y < ry + rh; ++y) for (int x = rx; x < rx + rw; ++x) map_.tiles[(size_t)y * map_.w + x] = FLOOR;
    }
    for (size_t i = 1; i < rooms.size(); ++i) {
        Room &a = rooms[i - 1];
        Room &b = rooms[i];
        int ax = a.x + a.w / 2, ay = a.y + a.h / 2;
        int bx = b.x + b.w / 2, by = b.y + b.h / 2;
        for (int x = std::min(ax, bx); x <= std::max(ax, bx); ++x) map_.tiles[(size_t)ay * map_.w + x] = FLOOR;
        for (int y = std::min(ay, by); y <= std::max(ay, by); ++y) map_.tiles[(size_t)bx * map_.w + y] = FLOOR;
    }
    for (int i = 0; i < pillarRooms && !rooms.empty(); ++i) {
        const Room &r = rooms[rngNext() % rooms.size()];
        for (int px = r.x + 2; px < r.x + r.w - 1; px += 2)
            for (int py = r.y + 2; py < r.y + r.h - 1; py += 2)
                map_.tiles[(size_t)py * map_.w + px] = PILLAR;
    }
    const Room &first = rooms.front();
    map_.spawnX = first.x + first.w / 2;
    map_.spawnY = first.y + first.h / 2;
    map_.tiles[(size_t)map_.spawnY * map_.w + map_.spawnX] = FLOOR;
}

Mob *LegendCore::poolAlloc() {
    // 对象池：死亡槽位优先复用，容量封顶 POOL_CAP
    for (Mob &m : mobs_) if (!m.alive && m.deadUntil <= 0) return &m;
    if ((int)mobs_.size() < POOL_CAP) {
        mobs_.push_back(Mob());
        return &mobs_.back();
    }
    return nullptr;
}

void LegendCore::spawnMonsters(uint32_t seed, int count, const std::vector<MobSpawn> &pool, int minDist) {
    setRng(seed ^ 0x5DEECE66u);
    int placed = 0, attempts = 0;
    while (placed < count && attempts < count * 40) {
        ++attempts;
        int x = rngInt(1, map_.w - 2), y = rngInt(1, map_.h - 2);
        if (!walkable(x, y)) continue;
        int dx = x - map_.spawnX, dy = y - map_.spawnY;
        if (dx * dx + dy * dy < minDist * minDist) continue;
        const MobSpawn &proto = pool[rngNext() % pool.size()];
        Mob *slot = poolAlloc();
        if (!slot) break;
        *slot = Mob();
        slot->id = nextId_++;
        slot->type = proto.type;
        slot->level = proto.level;
        slot->x = x + 0.5f;
        slot->y = y + 0.5f;
        slot->maxHp = (float)monDef(proto.type)->hp;
        slot->hp = slot->maxHp;
        ++placed;
    }
}

const GameMap &LegendCore::initWorld(uint32_t seed, int mapId) {
    map_.mapId = mapId;
    mobs_.clear();
    nextId_ = 1;
    path_.clear();
    dirX_ = dirY_ = 0;
    targetId_ = 0;
    lastCleanupAt_ = 0;

    switch (mapId) {
    case 0: genVillage(seed); break;
    case 1: genMeadow(seed); break;
    case 2: genCave(seed); break;
    case 3: genTemple(seed, 3); break;
    default: genTemple(seed, 6); break;
    }

    std::vector<MobSpawn> pool;
    int count = 0, minDist = 8;
    if (mapId == 1) {
        pool = {{0, 0, 1, 1}, {0, 0, 2, 2}};
        count = 26; minDist = 6;
    } else if (mapId == 2) {
        pool = {{0, 0, 3, 3}, {0, 0, 4, 5}, {0, 0, 5, 6}};
        count = 30;
    } else if (mapId == 3) {
        pool = {{0, 0, 6, 9}, {0, 0, 7, 11}};
        count = 30;
    } else if (mapId == 4) {
        pool = {{0, 0, 9, 15}, {0, 0, 10, 16}};
        count = 32;
    } else {
        pool = {{0, 0, 3, 3}};
        count = 10;
    }
    spawnMonsters(seed, count, pool, minDist);

    // Boss 放最远的可走格
    if (mapId == 3 || mapId == 4) {
        int best = -1;
        long bestD = -1;
        for (int y = 1; y < map_.h - 1; ++y)
            for (int x = 1; x < map_.w - 1; ++x) {
                if (!walkable(x, y)) continue;
                long d = (long)(x - map_.spawnX) * (x - map_.spawnX) + (long)(y - map_.spawnY) * (y - map_.spawnY);
                if (d > bestD) { bestD = d; best = y * map_.w + x; }
            }
        if (best >= 0) {
            Mob *slot = poolAlloc();
            if (slot) {
                *slot = Mob();
                slot->id = nextId_++;
                slot->type = (mapId == 3) ? 8 : 11;
                slot->level = (mapId == 3) ? 14 : 20;
                slot->x = (float)(best % map_.w) + 0.5f;
                slot->y = (float)(best / map_.w) + 0.5f;
                slot->maxHp = (float)monDef(slot->type)->hp;
                slot->hp = slot->maxHp;
            }
        }
    }

    px_ = map_.spawnX + 0.5f;
    py_ = map_.spawnY + 0.5f;
    setRng(seed ^ 0xC0FFEE11u);
    return map_;
}

bool LegendCore::setDestination(int tx, int ty) {
    const int W = map_.w;
    int sx = (int)px_, sy = (int)py_;
    if (!inside(tx, ty) || !walkable(tx, ty) || !walkable(sx, sy)) return false;
    if (sx == tx && sy == ty) { path_.clear(); return true; }

    const size_t N = (size_t)W * map_.h;
    std::vector<float> g(N, 1e9f);
    std::vector<int32_t> from(N, -1);
    std::vector<char> closed(N, 0);
    using Node = std::pair<float, int32_t>;
    std::priority_queue<Node, std::vector<Node>, std::greater<Node>> open;
    const int startIdx = sy * W + sx, goalIdx = ty * W + tx;
    g[startIdx] = 0.f;
    open.push({0.f, startIdx});
    const int dx8[8] = {1, -1, 0, 0, 1, 1, -1, -1};
    const int dy8[8] = {0, 0, 1, -1, 1, -1, 1, -1};
    const float cost8[8] = {1, 1, 1, 1, 1.4142f, 1.4142f, 1.4142f, 1.4142f};
    int expanded = 0;
    while (!open.empty() && expanded < 6000) {
        Node cur = open.top();
        open.pop();
        int32_t idx = cur.second;
        if (closed[idx]) continue;
        closed[idx] = 1;
        ++expanded;
        if (idx == goalIdx) break;
        int cx = idx % W, cy = idx / W;
        for (int d = 0; d < 8; ++d) {
            int nx = cx + dx8[d], ny = cy + dy8[d];
            if (!walkable(nx, ny)) continue;
            if (d >= 4 && (!walkable(cx + dx8[d], cy) || !walkable(cx, cy + dy8[d]))) continue;
            int32_t nIdx = ny * W + nx;
            if (closed[nIdx]) continue;
            float ng = g[idx] + cost8[d];
            if (ng < g[nIdx]) {
                g[nIdx] = ng;
                from[nIdx] = idx;
                float hx = (float)std::abs(nx - tx), hy = (float)std::abs(ny - ty);
                open.push({ng + std::max(hx, hy) + 0.4142f * std::min(hx, hy), nIdx});
            }
        }
    }
    if (!closed[goalIdx]) return false;

    path_.clear();
    dirX_ = dirY_ = 0;
    int32_t walk = goalIdx;
    std::vector<int32_t> rev;
    while (walk != startIdx && walk >= 0) {
        rev.push_back(walk);
        walk = from[walk];
    }
    for (size_t i = rev.size(); i-- > 0;) {
        path_.push_back((float)(rev[i] % W) + 0.5f);
        path_.push_back((float)(rev[i] / W) + 0.5f);
    }
    targetId_ = 0;
    return true;
}

void LegendCore::stepPlayer(float dt) {
    if (dt <= 0) return;
    float step = PLAYER_SPEED * dt;
    if (dirX_ != 0 || dirY_ != 0) {
        float len = std::sqrt(dirX_ * dirX_ + dirY_ * dirY_);
        if (len < 1e-4f) return;
        float nx = px_ + dirX_ / len * step;
        float ny = py_ + dirY_ / len * step;
        if (canStand(nx, ny)) { px_ = nx; py_ = ny; }
        else if (canStand(nx, py_)) px_ = nx;
        else if (canStand(px_, ny)) py_ = ny;
        return;
    }
    while (!path_.empty()) {
        float tx = path_[0], ty = path_[1];
        float dx = tx - px_, dy = ty - py_;
        float len = std::sqrt(dx * dx + dy * dy);
        if (len <= step) {
            if (canStand(tx, ty)) { px_ = tx; py_ = ty; }
            path_.erase(path_.begin(), path_.begin() + 2);
            continue;
        }
        float nx = px_ + dx / len * step;
        float ny = py_ + dy / len * step;
        if (canStand(nx, ny)) { px_ = nx; py_ = ny; }
        else if (canStand(nx, py_)) px_ = nx;
        else if (canStand(px_, ny)) py_ = ny;
        else path_.clear(); // 被卡死，放弃路径
        break;
    }
    px_ = std::max(0.5f, std::min((float)map_.w - 0.5f, px_));
    py_ = std::max(0.5f, std::min((float)map_.h - 0.5f, py_));
}

Mob *LegendCore::findMob(int id) {
    for (Mob &m : mobs_) if (m.id == id) return &m;
    return nullptr;
}

bool LegendCore::moveTo(Mob &m, float tx, float ty, float dist, float dt) {
    float dx = tx - m.x, dy = ty - m.y;
    float len = std::sqrt(dx * dx + dy * dy);
    if (len < 1e-3f || len <= dist * dt) return true;
    float step = dist * dt;
    float nx = m.x + dx / len * step;
    float ny = m.y + dy / len * step;
    if (canStand(nx, ny)) { m.x = nx; m.y = ny; }
    return false;
}

void LegendCore::tick(float now, float dt, std::vector<WorldEvent> &events) {
    stepPlayer(dt);

    // 怪物 AI：只处理激活半径内
    for (Mob &m : mobs_) {
        const MonDef *def = monDef(m.type);
        if (!m.alive) {
            if (now >= m.deadUntil) {
                // 重生：玩家周环随机点，保持玩家附近密度
                for (int attempt = 0; attempt < 24; ++attempt) {
                    float ang = rngFloat() * 6.2831853f;
                    float r = RESPAWN_RING_MIN + rngFloat() * (RESPAWN_RING_MAX - RESPAWN_RING_MIN);
                    float nx = px_ + std::cos(ang) * r;
                    float ny = py_ + std::sin(ang) * r;
                    if (canStand(nx, ny)) {
                        m.x = nx; m.y = ny;
                        m.hp = m.maxHp;
                        m.alive = true;
                        m.aggro = false;
                        WorldEvent ev = {3, m.id, m.type, m.level, m.x, m.y, 0, false};
                        events.push_back(ev);
                        break;
                    }
                }
            }
            continue;
        }
        float dx = px_ - m.x, dy = py_ - m.y;
        float dist = std::sqrt(dx * dx + dy * dy);
        if (dist > ACTIVATE_DIST && !m.aggro) continue; // 视野外：不消耗 CPU
        if (!m.aggro && def->aggro > 0 && dist <= def->aggro) m.aggro = true;
        if (!m.aggro || now < m.stunUntil) continue;

        float range = def->ranged ? (float)def->ranged : MELEE_RANGE;
        bool inRange = def->ranged ? (dist <= range && dist >= 1.2f) : (dist <= MELEE_RANGE);
        if (inRange) {
            if (now >= m.atkCdUntil) {
                m.atkCdUntil = now + def->atkInterval;
                // 命中判定：88% 基础 - 玩家闪避
                int hitChance = std::max(25, std::min(97, 88 - stats_.eva));
                bool miss = (int)(rngFloat() * 100) >= hitChance;
                int dmg = 0;
                if (!miss) {
                    float raw = def->atkMin + rngFloat() * (def->atkMax - def->atkMin + 1);
                    dmg = std::max(1, (int)(raw - stats_.def * 0.8f));
                }
                WorldEvent ev = {0, m.id, m.type, m.level, m.x, m.y, dmg, miss};
                events.push_back(ev);
            }
        } else if (dist > (def->ranged ? range * 0.8f : MELEE_RANGE * 0.8f)) {
            moveTo(m, px_, py_, MOB_SPEED * def->speedMul * 1.6f, dt);
        }
    }

    // 周期清理：远处的无仇恨活怪 relocation 到玩家附近（等效清理+补怪）
    if (now - lastCleanupAt_ >= CLEANUP_INTERVAL) {
        lastCleanupAt_ = now;
        for (Mob &m : mobs_) {
            if (!m.alive || m.aggro) continue;
            float dx = px_ - m.x, dy = py_ - m.y;
            if (dx * dx + dy * dy > DESPAWN_DIST * DESPAWN_DIST) {
                for (int attempt = 0; attempt < 12; ++attempt) {
                    float ang = rngFloat() * 6.2831853f;
                    float r = RESPAWN_RING_MIN + rngFloat() * (RESPAWN_RING_MAX - RESPAWN_RING_MIN);
                    float nx = px_ + std::cos(ang) * r;
                    float ny = py_ + std::sin(ang) * r;
                    if (canStand(nx, ny)) { m.x = nx; m.y = ny; break; }
                }
            }
        }
    }
}

Mob *LegendCore::pickAttackTarget(float range) {
    if (targetId_ != 0) {
        Mob *m = findMob(targetId_);
        if (m && m->alive) {
            float dx = px_ - m->x, dy = py_ - m->y;
            if (dx * dx + dy * dy <= (range + 0.2f) * (range + 0.2f)) return m;
        }
    }
    Mob *best = nullptr;
    float bestD = range * range;
    for (Mob &m : mobs_) {
        if (!m.alive) continue;
        float dx = px_ - m.x, dy = py_ - m.y;
        float d2 = dx * dx + dy * dy;
        if (d2 <= bestD) { bestD = d2; best = &m; }
    }
    return best;
}

void LegendCore::attackMob(Mob &m, float mult, float now, AttackResult &out) {
    const MonDef *def = monDef(m.type);
    out.ok = true;
    out.mobId = m.id;
    out.mobX = m.x;
    out.mobY = m.y;
    out.mobType = m.type;
    out.mobLevel = m.level;
    int hitChance = std::max(25, std::min(97, stats_.acc - 5));
    if ((int)(rngFloat() * 100) >= hitChance) {
        out.miss = true;
        return;
    }
    float raw = (stats_.atkMin + rngFloat() * (stats_.atkMax - stats_.atkMin + 1)) * mult;
    out.dmg = std::max(1, (int)raw - def->def);
    out.leech = (int)(out.dmg * stats_.leechPct / 100);
    m.hp -= (float)out.dmg;
    m.flashUntil = now + 0.12f;
    m.aggro = true;
    if (m.hp <= 0) {
        m.alive = false;
        m.aggro = false;
        m.deadUntil = now + RESPAWN_DELAY;
        if (targetId_ == m.id) targetId_ = 0;
        out.killed = true;
    }
}

AttackResult LegendCore::playerAttack(float mult, float now, float range) {
    AttackResult out;
    Mob *m = pickAttackTarget(range);
    if (!m) return out;
    attackMob(*m, mult, now, out);
    return out;
}

int LegendCore::castAoe(float mult, float radius, float now, std::vector<AttackResult> &out) {
    int hits = 0;
    for (Mob &m : mobs_) {
        if (!m.alive) continue;
        float dx = px_ - m.x, dy = py_ - m.y;
        if (dx * dx + dy * dy > (radius + 0.3f) * (radius + 0.3f)) continue;
        AttackResult r;
        attackMob(m, mult, now, r);
        if (r.ok) { out.push_back(r); ++hits; }
    }
    return hits;
}

void LegendCore::visibleMobs(float radius, std::vector<const Mob *> &out) const {
    float r2 = radius * radius;
    for (const Mob &m : mobs_) {
        if (!m.alive) continue;
        float dx = px_ - m.x, dy = py_ - m.y;
        if (dx * dx + dy * dy <= r2) out.push_back(&m);
    }
}

int LegendCore::tapWorld(int tx, int ty) {
    // 点中怪（1.6 格内）→ 锁定追击
    for (Mob &m : mobs_) {
        if (!m.alive) continue;
        float dx = (tx + 0.5f) - m.x, dy = (ty + 0.5f) - m.y;
        if (dx * dx + dy * dy <= 2.56f) {
            targetId_ = m.id;
            m.aggro = true;
            setDestination(std::max(0, std::min(map_.w - 1, tx)), std::max(0, std::min(map_.h - 1, ty)));
            return m.id;
        }
    }
    targetId_ = 0;
    return setDestination(tx, ty) ? 0 : -1;
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
