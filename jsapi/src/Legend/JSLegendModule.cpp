#include "Legend/JSLegendModule.hpp"
#include <Exceptions/AssertFailed.hpp>
#include <jqutil_v2/jqbson.h>

extern JSValue createLegendModule(JQModuleEnv *env)
{
    JQFunctionTemplateRef tpl = JQFunctionTemplate::New(env, "LegendModule");
    tpl->InstanceTemplate()->setObjectCreator([]() { return new JSLegendModule(); });

    tpl->SetProtoMethod("getVersion", &JSLegendModule::getVersion);
    tpl->SetProtoMethod("bench", &JSLegendModule::bench);
    tpl->SetProtoMethod("genMap", &JSLegendModule::genMap);
    tpl->SetProtoMethod("pathTo", &JSLegendModule::pathTo);

    JSLegendModule::InitTpl(tpl);
    return tpl->CallConstructor();
}

JSLegendModule::JSLegendModule()
    : core_(std::make_unique<legend::LegendCore>()) {}

JSLegendModule::~JSLegendModule() = default;

void JSLegendModule::getVersion(JQFunctionInfo &info)
{
    try {
        info.GetReturnValue().Set(std::string("1.0.0-legend"));
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
        legend::LegendCore *core = getCore();
        ASSERT(core != nullptr);
        info.GetReturnValue().Set(core->bench(n));
    } catch (const std::exception &e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSLegendModule::genMap(JQFunctionInfo &info)
{
    try {
        ASSERT(info.Length() >= 2);
        JQNumber seedArg(info.GetContext(), info[0]);
        JQNumber mapArg(info.GetContext(), info[1]);
        uint32_t seed = (uint32_t)seedArg.getDouble();
        int mapId = mapArg.getInt32();
        if (mapId < 0 || mapId > 4) mapId = 0;

        legend::LegendCore *core = getCore();
        ASSERT(core != nullptr);
        const legend::GameMap &m = core->genMap(seed, mapId);

        Bson::array monsterList;
        for (const legend::MapSpawn &s : m.monsters) {
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

void JSLegendModule::pathTo(JQFunctionInfo &info)
{
    try {
        ASSERT(info.Length() >= 4);
        JQNumber a0(info.GetContext(), info[0]);
        JQNumber a1(info.GetContext(), info[1]);
        JQNumber a2(info.GetContext(), info[2]);
        JQNumber a3(info.GetContext(), info[3]);

        legend::LegendCore *core = getCore();
        ASSERT(core != nullptr);
        std::vector<int32_t> path = core->pathTo(
            a0.getInt32(), a1.getInt32(), a2.getInt32(), a3.getInt32());

        Bson::array steps;
        for (int32_t v : path) steps.push_back(Bson((double)v));
        info.GetReturnValue().Set(Bson(steps));
    } catch (const std::exception &e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}
