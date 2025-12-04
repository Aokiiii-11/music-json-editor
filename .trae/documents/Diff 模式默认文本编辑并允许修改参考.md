## 目标
- 在 `Diff` 模式下，点击 EDIT 时默认进入“Text View”编辑，而不是“Segment View”。
- 在 `Diff` 模式的编辑态，右侧 Reference 不再只读，可直接修改并写回译文 JSON，同时刷新对照与诊断。
- 非 Diff 模式行为保持不变（默认进入 Segment View，可切换）。

## 行为变更
- 进入编辑：`diffModeEnabled === true` → `segmentMode = false`；否则 `segmentMode = true`。
- Reference 编辑：仅在编辑态显示为可编辑文本框，修改即时同步到译文 JSON、`translationMap` 与 `diagnostics`。
- 文案更新：右栏标题由“Reference（只读）”改为“Reference”。

## 代码改动
- 文件 `components/JsonEditor.tsx`
  - EDIT 按钮逻辑：将 `setSegmentMode(true)` 改为 `setSegmentMode(diffModeEnabled ? false : true)`（位置：`components/JsonEditor.tsx:267–270`）。
  - 启用 Reference 编辑：
    - 原位置的只读文本框（`components/JsonEditor.tsx:343–351`）改为可编辑，并调用 `onEditReference(fullPath, value)`；文案更新为“Reference”。
    - `TranslationUnitProps` 增加可选属性 `fullPath?: string` 与 `onEditReference?: (path: string, newRef: string) => void`（接口处：`components/JsonEditor.tsx:118–128`）。
  - 传参：在 `DictionaryBlock` 与全局/分段的 `TranslationUnit` 调用处，补充 `fullPath` 与 `onEditReference`（例如：`global_dimension.description`、`section_dimension[i].description/lyrics` 以及字典类块）。

- 文件 `App.tsx`
  - 新增处理函数 `onEditTranslationRef(path, newRef)`：
    - 使用 `parsePathKey(path)` 构建/更新译文 JSON 中对应节点；若路径不存在则按对象/数组类型创建中间结构。
    - 重新计算并设置：`translationJsonText`、`translationMap = buildTranslationMapFromJson(obj)`、`translationDiag = diagnoseMatch(data, obj)`。
    - 作为 `JsonEditor` 的回调属性传入。

## 验证要点
- 开启 Diff 模式后，点击 EDIT 默认进入 Text View；右栏可编辑，修改后译文面板即时更新。
- 关闭 Diff 模式时，点击 EDIT 仍默认进入 Segment View；行为不受影响。
- `Compare Mode` 为 `source_only` 时无右栏；切换到 `dual` 后按上述生效。

## 边界与兼容
- 若当前无译文 JSON，编辑 Reference 会创建对应路径与节点，保持结构与原文一致。
- 键名与路径构造沿用现有校验与路径语法；不更改现有备份/撤销逻辑。

## 交付内容
- 上述代码改动与文案更新。
- 简单回归：在全局/分段字典与描述、歌词字段验证默认视图与参考编辑同步。