'use client'

import { useEffect, useState } from 'react'
import CabinetButton from '@components/cabinet/CabinetButton'

export default function PhoneVerificationPrioritySetting() {
  const [method, setMethod] = useState('call')
  const [smsAllowed, setSmsAllowed] = useState(true)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setError('')
      setReady(false)
      try {
        const response = await fetch('/api/cabinet/settings', { cache: 'no-store', signal: controller.signal })
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error()
        if (!controller.signal.aborted) {
          setMethod(json.data?.phoneVerificationPrimaryMethod === 'sms' ? 'sms' : 'call')
          setSmsAllowed(json.data?.allowSmsVerification !== false)
          setReady(true)
        }
      } catch {
        if (!controller.signal.aborted) setError('Не удалось загрузить настройку. Повторите загрузку.')
      }
    }
    void load()
    return () => controller.abort()
  }, [reload])

  async function save(value) {
    if (!ready || busy || value === method) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/cabinet/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneVerificationPrimaryMethod: value }),
      })
      const json = await response.json()
      if (!response.ok || !json.success || !['call', 'sms'].includes(json.data?.phoneVerificationPrimaryMethod)) throw new Error()
      setMethod(json.data.phoneVerificationPrimaryMethod)
    } catch {
      setError('Не удалось сохранить настройку. Выберите способ ещё раз для повтора.')
    } finally { setBusy(false) }
  }

  return <div className="mb-6 rounded-2xl border border-cyan-300/30 p-6 text-slate-800 dark:text-slate-100">
    <fieldset disabled={!ready || busy} aria-busy={!ready || busy}>
      <legend className="mb-3 font-semibold">Приоритет подтверждения телефона</legend>
      <div className="flex flex-wrap gap-6">
        {[['call', 'Звонок'], ['sms', 'СМС']].map(([value, label]) => <label key={value} className="flex cursor-pointer items-center gap-2">
          <input type="radio" name="phone-verification-priority" value={value} checked={method === value} onChange={() => save(value)} className="accent-cyan-600" />
          {label}
        </label>)}
      </div>
    </fieldset>
    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Первый способ при регистрации, восстановлении пароля и смене номера. Если СМС отключены в общих настройках, используется звонок.</p>
    {!smsAllowed && <p className="mt-2 text-sm">СМС сейчас отключены: подтверждение начинается со звонка при любом приоритете.</p>}
    {busy && <p role="status" className="mt-2 text-sm">Сохраняем…</p>}
    {!ready && !error && <p role="status" className="mt-2 text-sm">Загружаем…</p>}
    {error && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    {error && !ready && <CabinetButton type="button" variant="secondary" className="mt-3 cursor-pointer" onClick={() => setReload(value => value + 1)}>Повторить загрузку</CabinetButton>}
  </div>
}
