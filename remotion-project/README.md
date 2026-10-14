# remotion-project — 6 个视频共用的代码渲染工程

照 `docs/02-样片拆解-代码渲染一镜到底.md` 的方案：**Remotion**（时间轴、逐帧渲染、HUD/字幕）+ **React Three Fiber / three.js**（3D 场景）。不用任何 AI 视频生成。

## 跑起来

```bash
cd remotion-project
npm install
npm run dev          # Remotion Studio，浏览器里拖时间轴预览
npm run still:03     # 渲染一张静帧到 out/03-still.png
npm run render:03    # 渲染成片到 out/03-rp114n331.mp4（1080p30）
```

云容器里没有 GPU，`remotion.config.ts` 指向预装的 Chromium headless shell 并用软件 GL（swangle）。本地有 GPU 的机器把 `REMOTION_BROWSER` 指到自己的 Chrome 即可，快一个数量级。

## 结构

```
data/03-rp114n331.json   一块板 = 一份数据：器件、坐标、贴装顺序、测试点、测试读数、结尾卡
src/lib/timeline.ts      阶段 / 每个器件的「放置→热风→熔锡」时间槽 / 字幕，全部由数据推导
src/hud/                 终端打字、章节标签、计数器、用料统计、双语字幕、SCAN 面板、万用表、结尾卡
src/three/               一镜到底摄像机样条、环境光、Canvas 文字贴图
src/scenes/pcb/          板子 + 焊盘 + 丝印、封装库、器件模型、镊子 / 热风枪 / 刷子 / 电线 / 表笔、总场景
src/compositions/PcbVideo.tsx   把 3D 与 HUD 合成；01–04 四块板共用
src/Root.tsx             注册 Composition（每块板一个）
scripts-count-lines.sh   统计代码行数写进 src/code-lines.json，结尾卡显示
```

## 加一块新板（02 / 01 / 04）

1. 复制 `data/03-rp114n331.json`，改器件列表、坐标、顺序、测试读数。
2. 新封装在 `src/scenes/pcb/footprints.ts` 加焊盘定义，在 `Part.tsx` 加器件外形。
3. `Root.tsx` 注册一个新 `<Composition>`。

时长自动随器件数变化（每个器件 1.8 s）。

## 03 样片的时间线

| 段 | 时间 | 画面 |
|---|---|---|
| 00 | 0–3.2 s | Claude Code 终端打出提示词 |
| 01 原理图 | 3.2–6.8 s | 数据手册原理图擦入 + SCAN 面板 + 器件标注 |
| 02 布板 | 6.8–10 s | 焊盘、丝印按器件逐个弹出，右上角焊盘计数 |
| 03 锡膏 | 10–12 s | 每个焊盘出现锡膏 |
| 04 贴装 · 热风 | 12–21 s | 每个器件：镊子落下 → 松开 → 热风进 → 锡膏变亮收拢、器件自对中 → 热风走 |
| 05 洗板 | 21–23.6 s | 刷子扫过，助焊剂残留消失 |
| 06 上电 | 23.6–28.2 s | 红黑线接 J1，VIN 3.70 V；表笔到 J2，VOUT 升到 3.30 V |
| 结尾 | 28.2–31.8 s | 「这块板子，用了」数据卡 + 代码行数 + 原始 prompt |
