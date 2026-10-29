'use client'

import { useEffect, useState } from 'react'
import NeonCheckbox from '@components/NeonCheckbox'

// Монтируется только на странице разработчика; право записи проверяет сервер.
export default function AssistantAiSetting() {
  const [enabled, setEnabled] = useState(false)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch('/api/cabinet/settings', { cache: 'no-store', signal: controller.signal })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error()
        if (!controller.signal.aborted) { setEnabled(json.data?.assistantAiEnabled === true); setReady(true) }
      } catch { if (!controller.signal.aborted) setError('Не удалось загрузить настройку') }
    }
    void load()
    return () => controller.abort()
  }, [])
  async function save(value) {
    if (!ready || saving) return
    setSaving(true); setError('')
    try {
      const response = await fetch('/api/cabinet/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assistantAiEnabled: value }),
      })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error()
      setEnabled(json.data?.assistantAiEnabled === true)
    } catch { setError('Не удалось сохранить настройку') }
    finally { setSaving(false) }
  }
  return <div className="mb-6 rounded-2xl border border-cyan-300/30 p-6">
    <NeonCheckbox id="assistant-ai-enabled" label="ИИ в помощнике" checked={enabled} disabled={!ready || saving}
      onChange={event => save(event.target.checked)} description="Разрешить свободные вопросы. Готовая помощь, выбор игры и советы по записи работают и без ИИ." />
    {error && <p role="alert" className="mt-2 text-sm text-red-500">{error}</p>}
  </div>
}
