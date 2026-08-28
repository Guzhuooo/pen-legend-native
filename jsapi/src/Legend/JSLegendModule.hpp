// JS 包壳类：把 LegendCore 暴露给 QuickJS
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
    void genMap(JQFunctionInfo &info);
    void pathTo(JQFunctionInfo &info);

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
