#include "Legend/JSLegendModule.hpp"
#include <Exceptions/AssertFailed.hpp>
#include <jqutil_v2/jqbson.h>

using namespace legend;

extern JSValue createLegendModule(JQModuleEnv *env)
{
    JQFunctionTemplateRef tpl = JQFunctionTemplate::New(env, "LegendModule");
    tpl->InstanceTemplate()->setObjectCreator([]() { return new JSLegendModule(); });

    tpl->SetProtoMethod("getVersion", &JSLegendModule::getVersion);
    tpl->SetProtoMethod("bench", &JSLegendModule::bench);
    tpl->SetProtoMethod("initWorld", &JSLegendModule::initWorld);
    tpl->SetProtoMethod("setPlayerStats", &JSLegendModule::setPlayerStats);
    tpl->SetProtoMethod("setDestination", &JSLegendModule::setDestination);
    tpl->SetProtoMethod("setMoveDir", &JSLegendModule::setMoveDir);
    tpl->SetProtoMethod("tick", &JSLegendModule::tick);
    tpl->SetProtoMethod("playerAttack", &JSLegendModule::playerAttack);
    tpl->SetProtoMethod("castAoe", &JSLegendModule::castAoe);
    tpl->SetProtoMethod("getVisibleMobs", &JSLegendModule::getVisibleMobs);
    tpl->SetProtoMethod("getPos", &JSLegendModule::getPos);
    tpl->SetProtoMethod("genMap", &JSLegendModule::genMap);

    JSLegendModule::InitTpl(tpl);
    return tpl->CallConstructor();
}

JSLegendModule::JSLegendModule()
    : core_(std::make_unique<LegendCore>()) {}

JSLegendModule::~JSLegendModule() = default;

void JSLegendModule::getVersion(JQFunctionInfo &info)
{
    try {
        info.GetReturnValue().Set(std::string("1.1.0-legend"));
    } catch (const std::exception &e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSLegendModule::bench(JQFunctionInfo &info)
{
    try {
        int n = 1000000;
        if (info.Length() >= 1) {
            JQNumber arg(info.GetContext(), info[0]);
            n = arg.getInt32();
            if (n < 1) n = 1;
            if (n > 200000000) n = 200000000;
        }
        LegendCore *core = getCore();
        ASSERT(core != nullptr);
        info.GetReturnValue().Set(core->bench(n));
    } catch (const std::exception &e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSLegendModule::initWorld(JQFunctionInfo &info)
{
    try {
        ASSERT(info.Length() >= 2);
        JQNumber seedArg(info.GetContext(), info[0]);
        JQNumber mapArg(info.GetContext(), info[1]);
        uint32_t seed = (uint32_t)seedArg.getDouble();
        int mapId = mapArg.getInt32();
        if (mapId < 0 || mapId > 4) mapId = 0;

        LegendCore *core = getCore();
        ASSERT(core != nullptr);
        const GameMap &m = core->initWorld(seed, mapId);

        Bson::array monsterList;
        for (const MobSpawn &s : m.monsters) {
            monsterList.push_back(Bson::array{(double)s.x, (double)s.y, (double)s.type, (double)s.level});
        }
        Bson out = Bson::object{
            {"w", (double)m.w},
            {"h", (double)m.h},
            {"mapId", (double)m.mapId},
            {"tiles", m.tiles},
            {"spawn", Bson::array{(double)m.spawnX, (double)m.spawnY}},
            {"monsters", monsterList}};
        info.GetReturnValue().Set(out);
    } catch (const std::exception &e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSLegendModule::genMap(JQFunctionInfo &info)
{
    // 兼容旧探测页：等价 initWorld
    initWorld(info);
}

void JSLegendModule::setPlayerStats(JQFunctionInfo &info)
{
    try {
        ASSERT(info.Length() >= 1);
        JQObject o(info.GetContext(), info[0]);
        PlayerStats s;
        s.atkMin = o.getInt32("atkMin");
        s.atkMax = o.getInt32("atkMax");
        s.acc = o.getInt32("acc");
        s.eva = o.getInt32("eva");
        s.def = o.getInt32("def");
        s.leechPct = o.getInt32("leechPct");
        LegendCore *core = getCore();
        ASSERT(core != nullptr);
        core->setPlayerStats(s);
        info.GetReturnValue().Set(true);
    } catch (const std::exception &e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSLegendModule::setDestination(JQFunctionInfo &info)
{
    try {
        ASSERT(info.Length() >= 2);
        JQNumber a0(info.GetContext(), info[0]);
        JQNumber a1(info.GetContext(), info[1]);
        LegendCore *core = getCore();
        ASSERT(core != nullptr);
        info.GetReturnValue().Set(core->setDestination(a0.getInt32(), a1.getInt32()));
    } catch (const std::exception &e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSLegendModule::setMoveDir(JQFunctionInfo &info)
{
    try {
        ASSERT(info.Length() >= 2);
        JQNumber a0(info.GetContext(), info[0]);
        JQNumber a1(info.GetContext(), info[1]);
        LegendCore *core = getCore();
        ASSERT(core != nullptr);
        core->setMoveDir((float)a0.getDouble(), (float)a1.getDouble());
        info.GetReturnValue().Set(true);
    } catch (const std::exception &e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSLegendModule::tick(JQFunctionInfo &info)
{
    try {
        ASSERT(info.Length() >= 2);
        JQNumber nowArg(info.GetContext(), info[0]);
        JQNumber dtArg(info.GetContext(), info[1]);
        float now = (float)nowArg.getDouble();
        float dt = (float)dtArg.getDouble();

        LegendCore *core = getCore();
        ASSERT(core != nullptr);
        std::vector<WorldEvent> events;
        core->tick(now, dt, events);

        Bson::array evList;
        for (const WorldEvent &e : events) {
            evList.push_back(Bson::array{
                (double)e.kind, (double)e.mobId, (double)e.type, (double)e.level,
                (double)e.x, (double)e.y, (double)e.dmg, e.miss ? 1.0 : 0.0});
        }
        Bson out = Bson::object{
            {"px", (double)core->playerX()},
            {"py", (double)core->playerY()},
            {"events", evList}};
        info.GetReturnValue().Set(out);
    } catch (const std::exception &e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

static Bson attackToBson(const AttackResult &r)
{
    return Bson::array{
        r.ok ? 1.0 : 0.0, r.miss ? 1.0 : 0.0, r.killed ? 1.0 : 0.0,
        (double)r.mobId, (double)r.dmg, (double)r.leech,
        (double)r.mobX, (double)r.mobY, (double)r.mobType, (double)r.mobLevel};
}

void JSLegendModule::playerAttack(JQFunctionInfo &info)
{
    try {
        ASSERT(info.Length() >= 3);
        JQNumber multArg(info.GetContext(), info[0]);
        JQNumber nowArg(info.GetContext(), info[1]);
        JQNumber rangeArg(info.GetContext(), info[2]);
        LegendCore *core = getCore();
        ASSERT(core != nullptr);
        AttackResult r = core->playerAttack((float)multArg.getDouble(), (float)nowArg.getDouble(), (float)rangeArg.getDouble());
        info.GetReturnValue().Set(attackToBson(r));
    } catch (const std::exception &e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSLegendModule::castAoe(JQFunctionInfo &info)
{
    try {
        ASSERT(info.Length() >= 3);
        JQNumber multArg(info.GetContext(), info[0]);
        JQNumber radiusArg(info.GetContext(), info[1]);
        JQNumber nowArg(info.GetContext(), info[2]);
        LegendCore *core = getCore();
        ASSERT(core != nullptr);
        std::vector<AttackResult> results;
        core->castAoe((float)multArg.getDouble(), (float)radiusArg.getDouble(), (float)nowArg.getDouble(), results);
        Bson::array list;
        for (const AttackResult &r : results) list.push_back(attackToBson(r));
        info.GetReturnValue().Set(Bson(list));
    } catch (const std::exception &e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSLegendModule::getVisibleMobs(JQFunctionInfo &info)
{
    try {
        float radius = 22.0f;
        if (info.Length() >= 1) {
            JQNumber rArg(info.GetContext(), info[0]);
            radius = (float)rArg.getDouble();
        }
        LegendCore *core = getCore();
        ASSERT(core != nullptr);
        std::vector<const Mob *> mobs;
        core->visibleMobs(radius, mobs);
        Bson::array list;
        for (const Mob *m : mobs) {
            list.push_back(Bson::array{
                (double)m->id, (double)m->type, (double)m->level,
                (double)m->x, (double)m->y, (double)m->hp, (double)m->maxHp,
                (m->flashUntil > 0) ? 1.0 : 0.0});
        }
        info.GetReturnValue().Set(Bson(list));
    } catch (const std::exception &e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSLegendModule::getPos(JQFunctionInfo &info)
{
    try {
        LegendCore *core = getCore();
        ASSERT(core != nullptr);
        info.GetReturnValue().Set(Bson::array{(double)core->playerX(), (double)core->playerY()});
    } catch (const std::exception &e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}
