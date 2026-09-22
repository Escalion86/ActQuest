'use client'

import { useState } from 'react'
import PropTypes from 'prop-types'
import Modal from '@components/Modal'

export default function ClassicVariantChoice({ data, location, gameId, teamId, testRunId, onUpdate }) {
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!data) return null
  const submit = async () => {
    if (busy || !selected) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/webapp/game-task', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, gameId, teamId, testRunId, action: 'selectVariant', stageId: data.stageId, variantId: selected.id }),
      })
      const result = await response.json()
      if (result.data) onUpdate(result.data)
      if (!response.ok || !result.success) throw new Error(result.error || 'Не удалось выбрать вариант.')
      setSelected(null)
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  const costText = (choice) => choice.consumeItems?.length
    ? choice.consumeItems.map((cost) => `${cost.title} ×${cost.quantity}`).join(', ') : 'Без расхода предметов'
  return <section className="my-4 space-y-3" aria-label="Путь и инвентарь команды">
    {data.inventory?.length > 0 && <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
      <p className="font-semibold">Инвентарь команды</p>
      <ul>{data.inventory.map((item) => <li key={item.itemId} title={item.description}>{item.title} ×{item.quantity}</li>)}</ul>
    </div>}
    {data.variantChoices?.length > 0 && <>
      <p className="text-sm">Время задания уже идёт. {data.canSelectVariant ? 'Выберите путь для команды.' : 'Ожидаем решения капитана.'}</p>
      {data.variantChoices.map((choice) => <div key={choice.id} className="rounded-xl border border-slate-300 p-4 dark:border-slate-700">
        <p className="font-semibold">{choice.title}</p><p className="whitespace-pre-wrap">{choice.description}</p>
        <p className="my-2 text-sm">{costText(choice)}</p>
        {data.canSelectVariant && <button type="button" className="aq-modal-btn aq-modal-btn-primary" disabled={busy} onClick={() => { setSelected(choice); setError('') }}>Выбрать путь</button>}
      </div>)}
    </>}
    <Modal isOpen={Boolean(selected)} onClose={() => { if (!busy) setSelected(null) }} title="Подтвердить путь" footer={<button type="button" className="aq-modal-btn aq-modal-btn-primary" disabled={busy} onClick={submit}>{busy ? 'Сохраняем…' : 'Подтвердить выбор'}</button>}>
      <p>{selected?.title}</p><p>{selected ? costText(selected) : ''}</p><p className="mt-2 text-sm">После подтверждения изменить путь нельзя. Таймер продолжает идти.</p>
      {error && <p role="alert" className="mt-2 text-red-600">{error}</p>}
    </Modal>
  </section>
}
ClassicVariantChoice.propTypes = {
  data: PropTypes.object, location: PropTypes.string.isRequired, gameId: PropTypes.string.isRequired,
  teamId: PropTypes.string.isRequired, testRunId: PropTypes.string, onUpdate: PropTypes.func.isRequired,
}
