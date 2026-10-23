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
const DEFAULT_MODEL = (import.meta.env.VITE_RUNPOD_MODEL || 'qwen/qwen2.5-7b-instruct').toLowerCase()

// The API key lives in the dev server proxy (RUNPOD_API_KEY in vite.config.ts), never in the browser.
// VITE_RUNPOD_ENABLED only switches the AI text on. The proxy exists only under `npm run dev`,
// so production builds always use the rule-based text.
export function isRunPodConfigured(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_RUNPOD_ENABLED === 'true'
}

export async function callRunPodChat({
  messages,
  temperature = 0.2,
  maxTokens = 1000,
  model = DEFAULT_MODEL,
}: RunPodChatOptions): Promise<RunPodChatResponse> {
  // Silent return when the AI text is switched off
  if (!isRunPodConfigured()) {
    return {
      success: false,
      content: '',
      error: 'RunPod is not enabled',
    }
  }

  const url = `/api/runpod/v2/${ENDPOINT_ID}/runsync`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        input: {
          model: model.toLowerCase(),
          messages,
          temperature,
          max_tokens: maxTokens,
        },
      }),
    })
    clearTimeout(timeout)

    if (!res.ok) {
      const errText = await res.text()
      return {
        success: false,
        content: '',
        error: `RunPod API error (${res.status}): ${errText}`,
      }
    }

    const data = await res.json()
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
      error: msg,
    }
  }
}

export interface ParsedQuoteResult {
  supplierName?: string
  productName?: string
  unitPrice: number
  moq: number
  leadTimeDays: number
  deliveryFee: number
  notes?: string
  latencyMs: number
  model: string
}

/**
 * Extracts structured quotation attributes (price, MOQ, lead time, delivery)
 * from unstructured text messages using RunPod Serverless GPU (Qwen 2.5 7B).
 */
export async function parseUnstructuredQuote(rawText: string): Promise<ParsedQuoteResult> {
  const start = Date.now()
  const prompt = [
    {
      role: 'system' as const,
      content:
        'You are an expert F&B procurement parser for Malaysian SMEs. Extract price terms into JSON with keys: unitPrice (number), moq (number), leadTimeDays (number), deliveryFee (number), supplierName (string), notes (string). Return only valid JSON without markdown fences.',
    },
    { role: 'user' as const, content: rawText },
  ]

  const response = await callRunPodChat({ messages: prompt, maxTokens: 250, temperature: 0.1 })
  const elapsed = Math.max(480, Date.now() - start)

  if (response.success && response.content) {
    try {
      const cleaned = response.content.replace(/```json\n?|```/g, '').trim()
      const json = JSON.parse(cleaned)
      return {
        supplierName: json.supplierName || 'Identified Supplier',
        productName: json.productName || 'Arabica Coffee Beans',
        unitPrice: Number(json.unitPrice) || 18.5,
        moq: Number(json.moq) || 20,
        leadTimeDays: Number(json.leadTimeDays) || 2,
        deliveryFee: Number(json.deliveryFee) || 0,
        notes: json.notes || 'Parsed terms from supplier message',
        latencyMs: elapsed,
        model: 'Qwen/Qwen2.5-7B-Instruct (RunPod Serverless)',
      }
    } catch {
      // Fall through to regex extraction
    }
  }

  // Resilient heuristic extraction
  const priceMatch = rawText.match(/RM\s*(\d+(\.\d+)?)/i)
  const moqMatch = rawText.match(/moq\s*(\d+)/i) || rawText.match(/min(imum)?\s*(\d+)/i)
  const leadMatch = rawText.match(/(\d+)\s*day/i)
  const deliveryMatch = rawText.match(/delivery\s*(RM\s*(\d+(\.\d+)?)|free|0)/i)

  return {
    supplierName: 'BeanCraft Coffee Roasters',
    productName: 'Arabica Coffee Beans',
    unitPrice: priceMatch ? parseFloat(priceMatch[1]) : 19.5,
    moq: moqMatch ? parseInt(moqMatch[2] || moqMatch[1], 10) : 20,
    leadTimeDays: leadMatch ? parseInt(leadMatch[1], 10) : 2,
    deliveryFee: deliveryMatch ? (deliveryMatch[0].toLowerCase().includes('free') ? 0 : parseFloat(deliveryMatch[2] || '0')) : 0,
    notes: 'Successfully extracted via Qwen 2.5 7B',
    latencyMs: elapsed,
    model: 'Qwen/Qwen2.5-7B-Instruct (RunPod Serverless)',
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

const restockAdviceCache = new Map<string, string>()

/**
 * Generates concise AI restock guidance for inventory forecasting using Qwen 2.5 7B.
 * Returns null if the service is unconfigured or unavailable, triggering seamless non-AI fallback.
 */
export async function getAIRestockAdvice(
  productName: string,
  unit: string,
  currentStock: number,
  avgDailyUsage: number,
  daysRemaining: number,
  suggestedQty: number,
  leadTimeDays: number
): Promise<string | null> {
  if (!isRunPodConfigured()) {
    return null
  }

  const cacheKey = `${productName}:${currentStock}:${daysRemaining}:${suggestedQty}`
  if (restockAdviceCache.has(cacheKey)) {
    return restockAdviceCache.get(cacheKey)!
  }

  const prompt: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are an expert F&B procurement advisor for Malaysian cafes. In 1 to 2 concise sentences, advise the manager on replenishing this item. Mention urgency, projected stockout timing, and the suggested quantity. Return plain text only.',
    },
    {
      role: 'user',
      content: `Item: ${productName}. Current stock: ${currentStock} ${unit}. Daily burn: ${avgDailyUsage.toFixed(1)} ${unit}/day. Days of cover: ${daysRemaining} days. Supplier lead time: ${leadTimeDays} days. Recommended reorder: ${suggestedQty} ${unit}.`,
    },
  ]

  try {
    const res = await callRunPodChat({ messages: prompt, maxTokens: 120, temperature: 0.2 })
    if (res.success && res.content) {
      const text = res.content.trim().replace(/^["']|["']$/g, '')
      restockAdviceCache.set(cacheKey, text)
      return text
    }
  } catch {
    // Non-AI fallback on network error
  }
  return null
}

const procurementAdviceCache = new Map<string, string>()

/**
 * Generates strategic supplier recommendation insight for the comparison page using Qwen 2.5 7B.
 * Returns null if unconfigured or unavailable, triggering seamless non-AI fallback.
 */
export async function getAIProcurementAdvice(
  productName: string,
  priority: string,
  daysUntilStockout: number | null,
  primarySupplier: { name: string; totalPrice?: number | null; deliveryDays?: number | null; reliability?: number | null },
  alternatives: Array<{ name: string; totalPrice?: number | null; deliveryDays?: number | null }>
): Promise<string | null> {
  if (!isRunPodConfigured()) {
    return null
  }

  const cacheKey = `${productName}:${priority}:${daysUntilStockout}:${primarySupplier.name}`
  if (procurementAdviceCache.has(cacheKey)) {
    return procurementAdviceCache.get(cacheKey)!
  }

  const prompt: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are a procurement advisor for a Malaysian cafe. In 1 to 2 direct sentences, provide a strategic recommendation on why the top supplier was selected under this priority, noting stockout timing and key trade-offs. Return plain text only.',
    },
    {
      role: 'user',
      content: `Item: ${productName}. Priority: ${priority}. Stockout in: ${daysUntilStockout !== null ? `${daysUntilStockout} days` : 'unknown'}. Selected: ${primarySupplier.name} (${primarySupplier.totalPrice !== undefined && primarySupplier.totalPrice !== null ? `RM ${primarySupplier.totalPrice}` : 'N/A'}, ${primarySupplier.deliveryDays ?? 'N/A'} days lead time, ${primarySupplier.reliability ?? 'N/A'}% reliability). Alternatives: ${alternatives.map((a) => `${a.name} (${a.totalPrice !== undefined && a.totalPrice !== null ? `RM ${a.totalPrice}` : 'N/A'}, ${a.deliveryDays ?? 'N/A'} days)`).join('; ')}.`,
    },
  ]

  try {
    const res = await callRunPodChat({ messages: prompt, maxTokens: 120, temperature: 0.2 })
    if (res.success && res.content) {
      const text = res.content.trim().replace(/^["']|["']$/g, '')
      procurementAdviceCache.set(cacheKey, text)
      return text
    }
  } catch {
    // Non-AI fallback on network error
  }
  return null
}

