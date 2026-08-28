// 笔尖传奇 · 纯 C++ 引擎核心（地图生成 / A* 寻路 / 基准测试）
// 只依赖 OS/C++，不碰 JS 值，便于移植与单测。
#pragma once
#include <cstdint>
#include <string>
#include <vector>

namespace legend {

struct MapSpawn {
    int x;
    int y;
    int type;   // 怪物类型 id（与 JS 端 monsters.js 表对应）
    int level;  // 怪物等级
};

struct GameMap {
    int w = 0;
    int h = 0;
    int mapId = 0;
    std::string tiles;          // w*h 字符：'#'墙 '.'地板 ','草地 '*'石柱
    int spawnX = 0;
    int spawnY = 0;
    std::vector<MapSpawn> monsters;
};

class LegendCore {
public:
    LegendCore();

    // 生成地图并保存副本供 pathTo 使用
    const GameMap &genMap(uint32_t seed, int mapId);

    // A* 八方向寻路（不可对角穿墙缝）。返回 [x0,y0,x1,y1,...]；不可达返回空。
    std::vector<int32_t> pathTo(int sx, int sy, int tx, int ty);

    // 简单整数基准：n 次迭代耗时毫秒
    double bench(int n) const;

    const GameMap &currentMap() const { return map_; }

private:
    GameMap map_;

    void genVillage(uint32_t seed);
    void genMeadow(uint32_t seed);
    void genCave(uint32_t seed);
    void genTemple(uint32_t seed, int pillars);

    bool inside(int x, int y) const;
    char at(int x, int y) const;
    void setAt(int x, int y, char c);
    bool walkable(int x, int y) const;
    void fillRect(char c, int x0, int y0, int w, int h);
    void scatterMonsters(uint32_t seed, int count, const std::vector<MapSpawn> &pool, int minDist);
    int findFloorNear(uint32_t seed, int x, int y) const;
};

} // namespace legend
