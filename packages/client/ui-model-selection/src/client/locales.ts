/**
 * `model` namespace dictionaries.
 *
 * `trigger.selectAria` intentionally matches `trigger.fallback` but remains a
 * separate key: the visible fallback label and the accessible name of
 * an unset trigger are free to diverge per locale, and folding it into
 * `trigger.aria` would announce the degenerate "Select model, current Select
 * model".
 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'provider.account': 'DeepSeek 账号',
  'command.label': '模型',
  'command.description': '选择本会话使用的模型',
  'option.loadError': '目录加载失败：{message}',
  'trigger.fallback': '请选择模型',
  'trigger.loading': '正在加载模型…',
  'trigger.selectAria': '请选择模型',
  'trigger.aria': '选择模型，当前 {model}',
  'trigger.ariaEffort': '选择模型，当前 {model}，推理等级 {effort}',
  'trigger.ariaThinking': '选择模型，当前 {model}，思考模式 {effort}',
  'menu.aria': '模型与推理等级',
  'menu.ariaDeepSeek': 'DeepSeek 模型设置',
  'menu.model': '模型',
  'menu.effort': '推理等级',
  'menu.thinking': '思考模式',
  'model.nativeVision': '支持图片',
  'model.nativeVisionRecommended': '支持图片',
  'effort.providerDefault': '跟随模型默认',
  'deepseek.effort.off': '关闭思考',
  'deepseek.effort.low': '低强度思考',
  'deepseek.effort.high': '深度思考',
  'deepseek.effort.max': '最大思考',
  'deepseek.effort.offDescription': '不启用深度思考',
  'deepseek.effort.lowDescription': '减少推理消耗，适合简单任务',
  'deepseek.effort.highDescription': '启用深度思考，适合大多数开发任务',
  'deepseek.effort.maxDescription': '使用最高推理强度，适合复杂任务',
  'status.loading': '正在刷新模型列表…',
  'error.action': '模型操作失败：{message}',
  'error.sessionInUse': '当前会话已被占用，可能是其他正在运行的 DSH 导致的（如其他 dsh web、桌面端），请退出其他正在运行的 DSH 后重试。',
  'action.reload': '重新加载',
  'warning.groupLoad': '{name} 加载失败：{message}',
  'search.placeholder': '搜索模型…',
  'search.clear': '清除搜索',
  'search.empty': '没有匹配的模型。',
  'empty.models': '暂无可用模型',
  'empty.efforts': '当前模型未提供推理等级。',
} satisfies Record<string, string>

/** The model namespace key union. */
export type ModelKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'provider.account': 'DeepSeek Account',
  'command.label': 'Model',
  'command.description': 'Select the model for this conversation',
  'option.loadError': 'Catalog failed to load: {message}',
  'trigger.fallback': 'Select model',
  'trigger.loading': 'Loading models…',
  'trigger.selectAria': 'Select model',
  'trigger.aria': 'Select model, current {model}',
  'trigger.ariaEffort': 'Select model, current {model}, reasoning effort {effort}',
  'trigger.ariaThinking': 'Select model, current {model}, thinking mode {effort}',
  'menu.aria': 'Model and reasoning effort',
  'menu.ariaDeepSeek': 'DeepSeek model settings',
  'menu.model': 'Model',
  'menu.effort': 'Effort',
  'menu.thinking': 'Thinking mode',
  'model.nativeVision': 'Image input',
  'model.nativeVisionRecommended': 'Image input',
  'effort.providerDefault': 'Default',
  'deepseek.effort.off': 'Thinking off',
  'deepseek.effort.low': 'Low thinking',
  'deepseek.effort.high': 'Deep thinking',
  'deepseek.effort.max': 'Maximum thinking',
  'deepseek.effort.offDescription': 'Answers without deep thinking',
  'deepseek.effort.lowDescription': 'Uses less reasoning for simple tasks',
  'deepseek.effort.highDescription': 'Uses deep thinking for most development tasks',
  'deepseek.effort.maxDescription': 'Uses the highest reasoning effort for complex tasks',
  'status.loading': 'Refreshing model list…',
  'error.action': 'Model operation failed: {message}',
  'error.sessionInUse': 'This session is already in use, possibly by another running DSH instance (such as dsh web or the desktop app). Quit other running DSH instances and try again.',
  'action.reload': 'Reload',
  'warning.groupLoad': '{name} failed to load: {message}',
  'search.placeholder': 'Search models…',
  'search.clear': 'Clear search',
  'search.empty': 'No matching models.',
  'empty.models': 'No models available.',
  'empty.efforts': 'This model provides no reasoning effort levels.',
} satisfies Record<ModelKey, string>
