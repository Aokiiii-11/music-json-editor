## 背景确认

* 翻译映射：`utils/matcher.ts` 的 `buildTranslationMapFromJson` 已按路径收集字符串，语言无关。

* 缺失告警：`components/JsonEditor.tsx:213` 计算 `en && !cn && !refCn`；`components/JsonEditor.tsx:236-239` 渲染 "Missing Translation"。

* 参考列与标题：右列标签在 `components/JsonEditor.tsx:333`；参考输入面板标题在 `components/TranslationJsonInput.tsx:87`（占位提示约 `108`）。

* 视图/对照模式：状态 `viewMode` 定义于 `App.tsx:63`；推导 `effectiveMode` 于 `App.tsx:69-75`；工具栏切换在 `App.tsx:589-601`；`JsonEditor` 接收 `compareMode` 于 `App.tsx:699-705`。

## 目标

* 保持参考 JSON 语言无关：只要路径一致即可对齐显示。

* 文案去语言化：

  * 顶部面板标题改为“译文/参考 JSON”。

  * 右侧列标题改为“Reference”。

  * 告警文案改为“Missing Reference”。

* 新增 Diff 模式开关（建议在设置或工具栏）：

  * 开启后取消所有“缺失参考”告警，仅进行结构/值对照。

  * 在左右列显示差异指示：相等标“✓”，不等标“≠”。

  * 继续保留现有匹配统计（缺失/多余/类型不一致）。

## 技术改动

* `utils/matcher.ts`

  * 保持 `buildTranslationMapFromJson` 与 `diagnoseMatch` 不变（已语言无关）。

* `components/TranslationJsonInput.tsx`

  * 标题改为“译文/参考 JSON”（`components/TranslationJsonInput.tsx:87`）。

  * 相关占位/说明同步用“参考 JSON”。

* `components/JsonEditor.tsx`

  * 右列标题改为“Reference（只读）”（`components/JsonEditor.tsx:333`）。

  * 将 `isMissingTranslation` 重命名为 `isMissingReference` 并替换显示文案。

  * 受 Diff 模式控制：`diffModeEnabled` 为真时不渲染缺失告警（包裹 `!diffModeEnabled && isMissingReference`）。

  * 在字段行右侧增加差异指示：比较源值与参考值（同路径），相等显示“✓”，不等显示“≠”（仅在 `compareMode==='dual'` 且 `diffModeEnabled` 为真时显示）。

* `App.tsx`

  * 新增 `diffModeEnabled` 状态，默认关闭；随设置或工具栏按钮切换。

  * 将 `diffModeEnabled` 通过 props 传入 `JsonEditor`。

  * 工具栏在 `Compare Mode` 块旁新增“Diff 模式”按钮（`App.tsx:589-601` 邻近位置），或在设置视图中提供开关。

* `components/Settings.tsx`

  * 若走设置面板：在顶部或通用区添加“Diff 模式”开关，通过回调更新 `App.tsx` 的 `diffModeEnabled`。

## 交互与数据流

* 参考 JSON 输入 → `buildTranslationMapFromJson` → `translationMap`。

* `translationMap` 与源 JSON 同路径比对，UI 按 `compareMode` 控制是否展示参考列。

* `diffModeEnabled` 控制：

  * 禁止缺失告警渲染。

  * 启用差异指示（✓/≠）。

## 验证方案

* 手动验证：

  * 粘贴任意语言参考 JSON，路径一致时右列正常显示，且不再出现缺失告警（在 Diff 模式）。

  * 切换 `Compare Mode` 与 `Diff 模式`，观察差异指示与统计面板一致性。

* 自动/单元测试：

  * 为 `JsonEditor` 增加快照/条件渲染测试：Diff 开启时隐藏缺失告警；相等/不等时指示符正确。

  * `matcher.test.ts` 保持现有测试，通过即可（逻辑未变）。

## 风险与兼容

* 文案更改需同步用户文档（`docs/user-guide.md`）。

* Diff 模式为渲染层增强，不影响数据结构与导入/导出流程。

* 若后续需要更细粒度的比较（如忽略空白/大小写），可在差异指示比较处加配置。

## 交付内容

* UI 文案调整与 Diff 模式开关。

* 差异指示（✓/≠）与缺失告警屏蔽逻辑。

* 基础测试用例与手动验证说明。

