// ============================================================================
//  JSAPI 总注册入口
//  规则：pluginname 必须 == CMake LIB_NAME 去 libjsapi_ 前缀、== .so 名去前缀和 .so
//       == registerCModuleLoader 第一参 == JS import 'pluginname' 里的 pluginname
//  本项目 pluginname = "legend"  =>  .so 名 libjsapi_legend.so、JS: import {LegendModule} from 'legend'
// ============================================================================

#include <jsmodules/JSCModuleExtension.h>
#include <jquick_config.h>
#include "Legend/JSLegendModule.hpp"

using namespace JQUTIL_NS;

static std::vector<std::string> exportList = {
    "LegendModule",
};

static int module_init(JSContext *ctx, JSModuleDef *m)
{
    auto env = JQModuleEnv::CreateModule(ctx, m, "legend");
    env->setModuleExport("LegendModule", createLegendModule(env.get()));
    env->setModuleExportDone(JS_UNDEFINED, exportList);
    return 0;
}

DEF_MODULE_LOAD_FUNC_EXPORT(legend, module_init, exportList)

extern "C" JQUICK_EXPORT void custom_init_jsapis()
{
    registerCModuleLoader("legend", &legend_module_load);
}
