# 05 · 贴片电阻完全指南（Remotion 教学动画）

原始提示词：`prompt-original.md`（6 幕，3–4 min，4K 16:9，简体中文旁白 + 字幕）。
**不依赖 AI 视频生成，可直接开工。**

## 实现拆分
| 幕 | 时间 | 组件 | 数据源 |
|---|---|---|---|
| 1 开场 | 0:00–0:15 | PCB 推镜 + 电阻升起排列 | Blender 渲染序列帧 |
| 2 封装尺寸 | 0:15–0:55 | `<PackageTable>` + 尺寸线动画 | `data/packages.json` |
| 3 功率柱状图 | 0:55–1:35 | `<PowerBars>` | `data/packages.json` |
| 4 丝印解码 | 1:35–2:35 | `<MarkingDecoder>`：三位 / 四位 / R / EIA-96 | `data/markings.json` |
| 5 功率计算 | 2:35–3:10 | `<PowerCalc>` P = V²/R + 降额曲线 | 需引用具体厂家系列 |
| 6 速查表 | 3:10–3:35 | `<QuickRefCards>` 两张高对比表，停留 ≥ 8 s | 同上 |

## 交付清单（按提示词第五节）
- [ ] 4K MP4
- [ ] Remotion 源码
- [ ] 中文配音（TTS）+ SRT
- [ ] 封装-功率对照图 PNG
- [ ] 丝印-阻值解码图 PNG
- [ ] 结构化数据 JSON
- [ ] 工程数据核对记录（标明厂家/系列）
