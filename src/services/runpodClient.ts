/**
 * RunPod Serverless vLLM Client
 * Connects to Qwen/Qwen2.5-7B-Instruct deployed on RunPod Serverless (OpenAI-compatible API).
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface RunPodChatOptions {
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  model?: string
}

export interface RunPodChatResponse {
  success: boolean
  content: string
  raw?: unknown
  error?: string
}

const ENDPOINT_ID = import.meta.env.VITE_RUNPOD_ENDPOINT_ID || 's3yoz365sju59f'
const API_KEY = import.meta.env.VITE_RUNPOD_API_KEY || ''
const DEFAULT_MODEL = import.meta.env.VITE_RUNPOD_MODEL || 'Qwen/Qwen2.5-7B-Instruct'

export function isRunPodConfigured(): boolean {
  return Boolean(ENDPOINT_ID && API_KEY && API_KEY !== 'YOUR_RUNPOD_API_KEY_HERE')
}

export async function callRunPodChat({
  messages,
  temperature = 0.2,
  maxTokens = 1000,
  model = DEFAULT_MODEL,
}: RunPodChatOptions): Promise<RunPodChatResponse> {
  if (!isRunPodConfigured()) {
    return {
      success: false,
      content: '',
      error: 'RunPod API key not configured. Please add VITE_RUNPOD_API_KEY in .env.local.',
    }
  }

  const url = `https://api.runpod.ai/v2/${ENDPOINT_ID}/runsync`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        input: {
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return {
        success: false,
        content: '',
        error: `RunPod API error (${res.status}): ${errText}`,
      }
    }

    const data = await res.json()
    // Handle RunPod Serverless response payload structure
    const choice = data.output?.[0]?.choices?.[0]
    const text = choice?.message?.content ?? choice?.text ?? (typeof data.output === 'string' ? data.output : '')

    return {
      success: Boolean(text),
      content: text,
      raw: data,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      content: '',
      error: `Network error connecting to RunPod: ${msg}`,
    }
  }
}

/**
 * Health check / test utility to verify the live RunPod endpoint.
 */
export async function testRunPodConnection(): Promise<{ ok: boolean; message: string }> {
  if (!isRunPodConfigured()) {
    return { ok: false, message: 'RunPod API key is missing or set to placeholder in .env.local.' }
  }

  const res = await callRunPodChat({
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Reply with the word "PONG" only.' },
    ],
    maxTokens: 10,
    temperature: 0.1,
  })

  if (res.success) {
    return { ok: true, message: `Connected to RunPod successfully! Response: ${res.content.trim()}` }
  }
  return { ok: false, message: res.error ?? 'Unknown error connecting to RunPod.' }
}
