import { createRequire } from 'node:module'
import { handleAssistant } from '../server/assistant/gateway.mjs'

// Проверяем наличие, никогда не печатаем значения env или ответ transport.
const require = createRequire(import.meta.url)
require('@next/env').loadEnvConfig(process.cwd())
const keyPresent = Boolean(process.env.DEEPSEEK_KEY?.trim())
console.log(JSON.stringify({ deepseekKeyPresent: keyPresent, mongoConfigured: Boolean(process.env.MONGODB_URI && process.env.MONGODB_GLOBAL_DBNAME) }))
if (!keyPresent) {
  console.log('LIVE AI: пропущен — существующий DEEPSEEK_KEY не настроен; генерация не проверена.')
} else {
  const response = await handleAssistant(new Request('http://localhost/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ city: 'krsk', question: 'Что такое автоквест?' }) }))
  const json = await response.json()
  console.log(JSON.stringify({ status: response.status, mode: json.mode, success: json.success, linksCount: json.links?.length || 0 }))
  if (!response.ok || json.mode !== 'ai') process.exitCode = 1
}
