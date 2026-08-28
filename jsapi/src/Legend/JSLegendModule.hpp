// JS 包壳类：世界状态机 API 暴露给 QuickJS
#pragma once
#include "Legend/LegendCore.hpp"
#include <jqutil_v2/jqutil.h>
#include <memory>
#include <mutex>

using namespace JQUTIL_NS;

class JSLegendModule : public JQPublishObject
{
public:
    JSLegendModule();
    ~JSLegendModule();

    // 全部为同步方法：都是毫秒级以内的纯计算
    void getVersion(JQFunctionInfo &info);
    void bench(JQFunctionInfo &info);
    void initWorld(JQFunctionInfo &info);       // (seed, mapId) -> {w,h,tiles,spawn,monsters}
    void setPlayerStats(JQFunctionInfo &info);  // ({atkMin,atkMax,acc,eva,def,leechPct})
    void setDestination(JQFunctionInfo &info);  // (tx,ty) -> bool
    void setMoveDir(JQFunctionInfo &info);      // (dx,dy)
    void tick(JQFunctionInfo &info);            // (nowSec, dtSec) -> {px,py,events}
    void playerAttack(JQFunctionInfo &info);    // (mult, now, range) -> 攻击结果
    void castAoe(JQFunctionInfo &info);         // (mult, radius, now) -> [结果...]
    void getVisibleMobs(JQFunctionInfo &info);  // (radius) -> [[id,type,level,x,y,hp,maxHp,flash]...]
    void getPos(JQFunctionInfo &info);          // -> [px,py]
    void genMap(JQFunctionInfo &info);          // 兼容旧探测页

private:
    std::unique_ptr<legend::LegendCore> core_;
    mutable std::mutex coreMutex_;
    legend::LegendCore *getCore() const
    {
        std::lock_guard<std::mutex> lock(coreMutex_);
        return core_.get();
    }
};

extern JSValue createLegendModule(JQModuleEnv *env);
