const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'

// Общий transport: авторизация и контракт ответа остаются у вызывающего API.
export async function callDeepSeek(payload, { apiKey, signal, maxResponseBytes } = {}) {
  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload), cache: 'no-store', signal,
  })
  let json
  if (maxResponseBytes) {
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Пустой ответ провайдера')
    let size = 0
    const chunks = []
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > maxResponseBytes) throw new Error('Слишком большой ответ провайдера')
        chunks.push(Buffer.from(value))
      }
      json = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } finally {
      await reader.cancel().catch(() => {})
      reader.releaseLock()
    }
  } else {
    json = await response.json().catch(() => null)
  }
  return { response, json }
}
