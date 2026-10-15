/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 *
 * 清单按 2026-09 官方文档整理；别名会下线，以当前文档 ID 为准。
 */

export const AI_ENDPOINT_PRESETS = [
  {
    id: 'deepseek',
    labelKey: 'providerDeepseek',
    url: 'https://api.deepseek.com',
    models: ['deepseek-flash', 'deepseek-v4-pro'],
  },
  {
    id: 'openai',
    labelKey: 'providerOpenai',
    url: 'https://api.openai.com/v1',
    models: [
      'gpt-6-astra',
      'gpt-5.6-sol',
      'gpt-5.6-terra',
      'gpt-5.6-luna',
      'gpt-5',
      'gpt-5-mini',
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4o-mini',
    ],
  },
  {
    id: 'qwen',
    labelKey: 'providerQwen',
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      'qwen3.8-max',
      'qwen3.8-flash',
      'qwen3.7-plus',
      'qwen3.5-plus',
      'qwen-max',
      'qwen-plus',
      'qwen-turbo',
    ],
  },
  {
    id: 'qwenIntl',
    labelKey: 'providerQwenIntl',
    url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    models: [
      'qwen3.8-max',
      'qwen3.8-flash',
      'qwen3.7-plus',
      'qwen3.5-plus',
      'qwen-max',
      'qwen-plus',
      'qwen-turbo',
    ],
  },
  {
    id: 'moonshot',
    labelKey: 'providerMoonshot',
    url: 'https://api.moonshot.ai/v1',
    models: ['kimi-k3', 'kimi-k2.7-code', 'kimi-k2.7-code-highspeed', 'kimi-k2.6'],
  },
  {
    id: 'moonshotCn',
    labelKey: 'providerMoonshotCn',
    url: 'https://api.moonshot.cn/v1',
    models: ['kimi-k3', 'kimi-k2.7-code', 'kimi-k2.7-code-highspeed', 'kimi-k2.6'],
  },
  {
    id: 'zhipu',
    labelKey: 'providerZhipu',
    url: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-5.3', 'glm-5.3-flash', 'glm-5.2', 'glm-5', 'glm-4.7', 'glm-4.7-flash'],
  },
  {
    id: 'minimax',
    labelKey: 'providerMinimax',
    url: 'https://api.minimax.chat/v1',
    models: ['MiniMax-M3', 'MiniMax-Text-01'],
  },
  {
    id: 'mimo',
    labelKey: 'providerMimo',
    url: 'https://api.xiaomimimo.com/v1',
    models: [
      'mimo-v2.6-pro',
      'mimo-v2.6-flash',
      'mimo-v2.6-pro-ultraspeed',
      'mimo-v2.5-pro',
      'mimo-v2.5',
      'mimo-v2-flash',
    ],
  },
  {
    id: 'xai',
    labelKey: 'providerXai',
    url: 'https://api.x.ai/v1',
    models: [
      'grok-4.6',
      'grok-4.5',
      'grok-4.3',
      'grok-4.20-0309-reasoning',
      'grok-4.20-0309-non-reasoning',
      'grok-build-0.1',
    ],
  },
  {
    id: 'groq',
    labelKey: 'providerGroq',
    url: 'https://api.groq.com/openai/v1',
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'moonshotai/kimi-k2-instruct',
      'qwen/qwen3-32b',
    ],
  },
  {
    id: 'openrouter',
    labelKey: 'providerOpenrouter',
    url: 'https://openrouter.ai/api/v1',
    models: [
      'openai/gpt-5-mini',
      'anthropic/claude-sonnet-4.5',
      'google/gemini-2.5-flash',
      'x-ai/grok-4.6',
      'x-ai/grok-4.3',
      'deepseek/deepseek-chat',
      'qwen/qwen3-235b-a22b',
    ],
  },
  {
    id: 'siliconflow',
    labelKey: 'providerSiliconflow',
    url: 'https://api.siliconflow.cn/v1',
    models: [
      'deepseek-ai/DeepSeek-V3.2',
      'Qwen/Qwen3-235B-A22B',
      'Qwen/Qwen2.5-72B-Instruct',
      'THUDM/glm-4-9b-chat',
    ],
  },
] as const

export type AiEndpointPresetId = (typeof AI_ENDPOINT_PRESETS)[number]['id'] | 'custom'

export function normalizeAiUrl(url: string) {
  return url.trim().replace(/\/+$/, '')
}

export function matchAiEndpointId(url: string): AiEndpointPresetId {
  const n = normalizeAiUrl(url)
  const hit = AI_ENDPOINT_PRESETS.find((p) => normalizeAiUrl(p.url) === n)
  return hit?.id ?? 'custom'
}

export function modelsForEndpoint(endpointId: AiEndpointPresetId) {
  if (endpointId === 'custom') return [] as string[]
  return [...(AI_ENDPOINT_PRESETS.find((p) => p.id === endpointId)?.models ?? [])]
}

export function matchAiModelId(endpointId: AiEndpointPresetId, model: string) {
  const list = modelsForEndpoint(endpointId)
  return list.includes(model) ? model : 'custom'
}
