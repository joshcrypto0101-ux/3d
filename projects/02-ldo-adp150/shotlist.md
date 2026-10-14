# 02 · ADP150 LDO — 镜头清单

来源：`refs/datasheets/ADP150.pdf`，典型电路 `schematic-typical-app.png`，ADI 评估板布局 `pcb-layout-example-tsot.png`（可直接作为 PCB 风格参考）。
封装：5-Lead TSOT。

> **待确认**：`ADP150AUJZ-3.3-R7` 固定输出 3.3 V，原提示词要求展示 1.8 V。
> 改型号为 `ADP150AUJZ-1.8-R7` 或把测试镜头改为 3.30 V。下面按 3.3 V 写。

## BOM（0603 电容）
| 位号 | 器件 | 封装 |
|---|---|---|
| U1 | ADP150AUJZ-3.3-R7 | TSOT-5 |
| CIN | 1 µF X5R/X7R 10 V | 0603 |
| COUT | 1 µF X5R/X7R 10 V | 0603 |
| J1 | 2-pin 座（VIN/GND） | 直插 |
| J2 | 2-pin 座（VOUT/GND） | 直插 |
| JP1 | EN 跳线（EN→VIN） | 2-pin |

## 镜头顺序
与 03 相同的 11 段模板，器件段为 CIN → COUT → U1 → J1/J2/JP1。
测试段：锂电 3.70 V 入，万用表 `VOUT 3.30 V`。
总长约 80 s。
