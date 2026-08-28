// 笔尖传奇 · 纯 C++ 世界状态机 v2
// 地图生成 / 玩家移动与碰撞 / 怪物 AI（激活、追击、攻击、清理重生）/ 战斗结算 全部在此。
// JS 端只负责：掉落、经验、UI。所有方法毫秒级返回，不做阻塞 IO。
#pragma once
#include <cstdint>
#include <string>
#include <vector>

namespace legend {

struct MobSpawn {
    int x;
    int y;
    int type;
    int level;
};

struct GameMap {
    int w = 0;
    int h = 0;
    int mapId = 0;
    std::string tiles;   // '#'墙 '.'地板 ','草地 '*'石柱
    int spawnX = 0;
    int spawnY = 0;
    std::vector<MobSpawn> monsters;
};

struct PlayerStats {
    int atkMin = 2;
    int atkMax = 4;
    int acc = 85;      // 命中%
    int eva = 5;       // 闪避%
    int def = 0;
    int leechPct = 0;
};

struct Mob {
    int id = 0;
    int type = 0;
    int level = 0;
    float x = 0, y = 0;
    float hp = 1, maxHp = 1;
    bool aggro = false;
    bool alive = true;
    float atkCdUntil = 0;   // 秒（世界时钟）
    float stunUntil = 0;
    float flashUntil = 0;
    float deadUntil = 0;    // 尸体消失/重生的世界时刻
};

// tick 产生的结算事件，JS 据此扣血/掉落/特效
struct WorldEvent {
    int kind;        // 0=mobAtk 1=mobHit(受击白闪) 2=mobDie 3=mobRespawn
    int mobId;
    int type;        // mobDie: 怪物类型（JS 查掉落表）
    int level;
    float x, y;
    int dmg;
    bool miss;
};

struct AttackResult {
    bool ok = false;
    bool miss = false;
    bool killed = false;
    int mobId = 0;
    int dmg = 0;
    int leech = 0;
    float mobX = 0, mobY = 0;
    int mobType = 0;
    int mobLevel = 0;
};

class LegendCore {
public:
    static constexpr int POOL_CAP = 64;   // 怪物对象池容量（固定，不动态扩容）

public:
    LegendCore();

    // 生成地图并初始化世界（怪物运行时状态在 native 内部）
    const GameMap &initWorld(uint32_t seed, int mapId);

    // 玩家状态同步（升级/换装后由 JS 调用）
    void setPlayerStats(const PlayerStats &s) { stats_ = s; }
    const PlayerStats &playerStats() const { return stats_; }

    // 玩家位置/地图访问
    float playerX() const { return px_; }
    float playerY() const { return py_; }
    const GameMap &map() const { return map_; }

    // 点击寻路：走向 (tx,ty)（tile 坐标，寻路失败返回 false）
    bool setDestination(int tx, int ty);

    // 方向摇杆：非零时清空寻路，按方向持续移动
    void setMoveDir(float dx, float dy) {
        dirX_ = dx;
        dirY_ = dy;
        if (dx != 0 || dy != 0) path_.clear(); // 只有真正摇方向才打断寻路
    }

    // 玩家一步：寻路跟随或方向移动，带碰撞。返回移动后坐标。
    void stepPlayer(float dt);

    // 世界 tick：怪物 AI（激活半径/追击/攻击/清理重生）。返回本步事件。
    void tick(float now, float dt, std::vector<WorldEvent> &events);

    // 玩家普攻/技能对单目标：优先当前锁定，其次射程内最近。mult=技能倍率。
    AttackResult playerAttack(float mult, float now, float range);

    // AOE：以玩家为圆心
    int castAoe(float mult, float radius, float now, std::vector<AttackResult> &out);

    // 可见怪物（供渲染；only alive，池内顺序）
    void visibleMobs(float radius, std::vector<const Mob *> &out) const;

    // 点击处理：点中怪（1.6 格内）→ 锁定并寻路接近，返回 mobId；
    // 点空地 → 寻路走过去，返回 0；不可达返回 -1
    int tapWorld(int tx, int ty);

    int targetId() const { return targetId_; }

    // 简单整数基准：n 次迭代耗时毫秒
    double bench(int n) const;

private:
    GameMap map_;
    std::vector<Mob> mobs_;   // 对象池：预留 POOL_CAP，死亡槽位复用
    PlayerStats stats_;

    float px_ = 0, py_ = 0;
    float dirX_ = 0, dirY_ = 0;
    int targetId_ = 0;
    std::vector<float> path_;          // [x0,y0,x1,y1,...] 世界坐标
    uint32_t rngState_ = 1;
    float lastCleanupAt_ = 0;

    int nextId_ = 1;

    bool inside(int x, int y) const;
    char at(int x, int y) const;
    bool walkable(int x, int y) const;
    bool canStand(float x, float y) const;
    void setRng(uint32_t s) { rngState_ = s ? s : 0x9E3779B9u; }
    uint32_t rngNext() { rngState_ = rngState_ * 1664525u + 1013904223u; return rngState_; }
    float rngFloat() { return (rngNext() >> 8) * (1.0f / 16777216.0f); }
    int rngInt(int lo, int hi) { return lo + (int)(rngNext() % (uint32_t)(hi - lo + 1)); }

    void genVillage(uint32_t seed);
    void genMeadow(uint32_t seed);
    void genCave(uint32_t seed);
    void genTemple(uint32_t seed, int pillars);
    void spawnMonsters(uint32_t seed, int count, const std::vector<MobSpawn> &pool, int minDist);
    Mob *findMob(int id);
    bool moveTo(Mob &m, float tx, float ty, float dist, float dt);
    Mob *pickAttackTarget(float range);
    void attackMob(Mob &m, float mult, float now, AttackResult &out);
};

} // namespace legend
