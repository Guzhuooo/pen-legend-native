# 笔尖传奇（Pen Legend）

有道词典笔上的传奇×暗黑 ARPG。2.5D 斜 45° 视角、全屏 canvas 地形 + DOM 精灵、
C++ 原生 JSAPI（地图生成 / A* 寻路）卸载性能热点。

- 作者：GuZhuooo
- 目标设备：有道词典笔 X5 系（cv182x / ARMv7 / glibc 2.23），Falcon 运行时 3.4.6，逻辑分辨率 800×254
- appid：`8001799000000042`

## 玩法

- 五张地图：新手村（安全区）→ 鹿寨 → 僵尸矿洞 → 沃玛寺庙（Boss 沃玛教主）→ 祖玛寺庙（最终 Boss 祖玛教主）
- 单职业战士：攻杀剑术 / 半月弯刀 / 野蛮冲撞 / 烈火剑法，等级解锁
- 暗黑式掉落：白/蓝/金/暗金四档品质 + 10 种词缀 + 固定神装；武器可用黑铁矿石强化 +1~+7
- 属性加点（力量/体力/敏捷）、药水快捷栏、商店、铁匠、6 部位装备
- 死亡惩罚：金币减半回村；Boss 首杀解锁下一张图
- 存档：Falcon Storage（`/userdata/miniapp/pen_legend/save_v1.json`），跨重启保留

操作：点击地图自动靠近，◎ 锁定最近敌人自动寻路追击；右下 击/攻/半/烈 + 血/魔药水；顶部 包/人/城。

## 数值

见 [DESIGN.md](DESIGN.md)（经验曲线、怪物表、装备与词缀池、掉落率、强化成功率）。
数值自检跑在 node 测试里：`node test/engine-smoke.mjs`（20 项断言）。

## 目录

```
ui/                 Falcon miniapp（appid/版本/打包脚本）
ui/src/engine/      纯逻辑引擎（node 可测，无运行时依赖）
ui/src/render/      2.5D iso 投影 + canvas 地形渲染器
ui/src/pages/index  游戏页面（HUD/方向盘/技能/面板）
ui/libs/            libjsapi_legend.so（ARMv7 原生模块，CI 产物）
jsapi/              C++ 原生插件工程（LegendCore：地图生成+A*）
.github/workflows/  GitHub Actions 交叉编译 .so
test/               node 冒烟测试
```

## 构建

```sh
# 前端依赖（工作区含 ui 与 aiot-vue-cli——本项目用全局 aiot-cli 时可跳过后者）
pnpm install --filter pen-legend

# 打包（需要全局 aiot-vue-cli@1.0.32 与全局 typescript@5.8.3）
cd ui && aiot-cli -c -q -p
# 产物：ui/8001799000000042.0_2_0.amr
```

native `.so` 由 GitHub Actions 编译（Windows 无法运行 Linux 宿主工具链）：
push `jsapi/**` 触发 [build-native.yml](.github/workflows/build-native.yml)，
下载 artifact 放入 `ui/libs/libjsapi_legend.so`。

## 安装到词典笔

```sh
adb push ui/8001799000000042.0_2_0.amr /tmp/legend.amr
adb shell miniapp_cli install /tmp/legend.amr
adb shell miniapp_cli start 8001799000000042 index
```

截图：`MSYS_NO_PATHCONV=1 adb shell "miniapp_cli capture /tmp/x.png"` 后 `adb pull`。

## 架构备注

- 引擎 20Hz 逻辑 tick（`$page.setInterval`），渲染 10Hz；地形仅在相机跨半格时重绘 canvas（防 OOM 的关键）
- 地图/寻路在 C++（LegendCore），战斗/掉落/成长纯 JS；两端通过种子随机保持可复现
- 渲染约束来自真机探测：canvas `fillText`/`drawImage` 不可用 → 地形矢量绘制 + DOM 精灵 + DOM 飘字
- CSS 只支持单 class 选择器；所有绝对定位控件显式 left/top 挂根节点

## 已知边界

- 精灵目前为几何色块（引擎已预留 sprite 字段），CC0 像素素材替换在计划内
- 音频未接（AudioBridge 原生模块未在 X5 3.4.6 验证）
- 模拟器未验证（外部模块 'legend' 需 api-mock 兜底）
