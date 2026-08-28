# 设备画像（真机验证）

profile_id: youdao-cv182x-3.4.6

## 身份

| 项 | 值 | 证据 |
|---|---|---|
| 商业型号 | 有道词典笔（X5 同源，hostname `YoudaoDictionaryPen-112`） | `adb shell uname -a` |
| ADB 身份 | 伪装 `Nexus_4 / occam / mako`（勿信） | `adb devices -l` |
| SoC | Cvitek CV182x，ARM Cortex-A53 (0xd03) 运行 armv7l 32 位 | `/proc/cpuinfo` |
| 固件内核 | Linux 4.19.164，构建于 2026-03-30 | `uname -a` |
| 系统 | Buildroot 2021.05-rc3 | `/etc/os-release` |
| libc | glibc 2.23 | `ldd --version` |

## Runtime

| 项 | 值 |
|---|---|
| Falcon 运行时 | 3.4.6（`/etc/miniapp/resources/local_packages.json` version） |
| JS 引擎 | QuickJS 20200705 |
| debugger | enable（`/etc/miniapp/resources/cfg.json`） |

## 屏幕

| 项 | 值 |
|---|---|
| 物理面板 | 254 × 800（竖） |
| direction / tp_direction | 270 / 270 |
| 逻辑分辨率（横屏） | **800 × 254** |
| 适配方式 | `App.setViewPort(800)`，宽度归一化（登山赛车已验证） |

cfg.json 原文要点：`{"width":254,"height":800,"direction":270,"tp_direction":270,"tp_xoffset":113,"tp_yoffset":0}`。
触控注入（raw→logical）：`rawX = logicalY + 113`，`rawY = 800 - logicalX`。

## 包与工具

| 项 | 值 |
|---|---|
| miniapp_cli | `/usr/bin/miniapp_cli`，支持 install/uninstall/start/stop? /capture/captureFB/memoryUsageGC |
| 系统输入法 | 有道输入法 appid `8001666679481944`（系统应用，未逐条验证 startTextEdit） |
| 本项目 appid | `8001799000000042` |
| 启动页 | `index`（显式传参） |

## 构建链（开发机 Windows）

| 项 | 值 |
|---|---|
| Node | v20.18.0 |
| pnpm | 10.12.4 |
| CLI | aiot-vue-cli@1.0.32（本地 checkout：`<项目>/aiot-vue-cli`，link 进 ui/devDependencies） |
| 打包 | `pnpm -C ui package`（= `aiot-cli -c -q -p`），产物 `ui/<appid>.<v>_<v>_<v>.amr` |
| 交叉工具链（native 用） | `F:\armv7-eabihf--glibc--stable-2018.11-1 (2)\armv7-eabihf--glibc--stable-2018.11-1`（Buildroot arm-gnueabihf glibc） |
| 设备 native SDK | `X5versionInfo/`（libcurl.so + libsqlite3.so 与头文件） |

## 常用命令

```sh
# 安装并启动（显式传启动页）
adb push ui/8001799000000042.0_1_0.amr /tmp/rpg.amr
adb shell miniapp_cli install /tmp/rpg.amr
adb shell miniapp_cli start 8001799000000042 index

# 截图（Git Bash 必须 MSYS_NO_PATHCONV=1）
MSYS_NO_PATHCONV=1 adb shell "miniapp_cli capture /tmp/x.png"
adb pull /tmp/x.png shot.png

# 日志
MSYS_NO_PATHCONV=1 adb shell "logcat -d | grep -i miniapp | tail -50"

# 触控注入（可选自动化）
adb shell send_event touch press <rawX> <rawY>
adb shell send_event touch release <rawX> <rawY>
```

## 已知坑（继承自登山赛车项目）

- 词典笔息屏会断 ADB；长会话需保持亮屏，掉线后重插重连。
- CSS 仅单 class 选择器；`border-radius` 只接受单值 px；不用后代/复合选择器。
- 文本必须 `<text>`；`<image>` 必须同时给 `src/width/height`；`<scroller>` 必须固定宽高。
- 首次渲染前不要猜尺寸：`onLaunch` 里 `setViewPort(800)` 后再挂页面。
- QuickJS 内存有限；图片缓存上限 4MB（`imageloader.image_cache_size=4194304`），素材总量必须克制。

## 验证记录

- 2026-08-28：adb 探测完成（上表全部证据来自当日真机只读探测）。
- 待验证：canvas `getContext('2d')` / `drawImage` 图片源形式、帧率上限（里程碑 1）。
