'use client'

import { useRef, useState } from 'react'
import PropTypes from 'prop-types'
import Modal from '@components/Modal'
import { getClassicEffectDefinition, getClassicEffectLabel } from '@helpers/classicItemDefinitions'
import ClassicInventoryPopover from './ClassicInventoryPopover'

export default function ClassicVariantChoice({ data, location, gameId, teamId, testRunId, onUpdate }) {
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const inventoryTriggerRef = useRef(null)
  const returnFocusRef = useRef(null)
  if (!data) return null
  const closeSelection = () => {
    setSelected(null)
    window.requestAnimationFrame(() => {
      const target = returnFocusRef.current?.isConnected ? returnFocusRef.current : inventoryTriggerRef.current
      target?.focus()
    })
  }
  const submit = async () => {
    if (busy || !selected) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/webapp/game-task', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, gameId, teamId, testRunId, stageId: selected.stageId,
          ...(selected.kind === 'item' ? { action: 'useItem', itemId: selected.itemId, requestId: selected.requestId, penaltyKey: selected.penaltyKey || null } : { action: 'selectVariant', variantId: selected.id }),
        }),
      })
      const result = await response.json()
      if (result.data) onUpdate(result.data)
      if (!response.ok || !result.success) throw new Error(result.error || (selected.kind === 'item' ? 'Не удалось применить предмет.' : 'Не удалось выбрать вариант.'))
      setNotice(result.data?.result?.message || (selected.kind === 'item' ? 'Предмет применён.' : 'Путь выбран.'))
      closeSelection()
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  const costText = (choice) => choice.consumeItems?.length
    ? choice.consumeItems.map((cost) => `${cost.title} ×${cost.quantity}`).join(', ') : 'Без расхода предметов'
  const hasInlineContent = Boolean(data.activeShields > 0 || data.itemHelp?.length || data.variantChoices?.length || notice)
  return <section className={hasInlineContent ? 'my-4 space-y-3' : undefined} aria-label={hasInlineContent ? 'Путь и помощь команды' : undefined}>
    <ClassicInventoryPopover items={data.inventory} busy={busy} triggerRef={inventoryTriggerRef} onUse={(item) => { returnFocusRef.current = inventoryTriggerRef.current; setSelected({ ...item, kind: 'item', stageId: data.stageId, penaltyKey: item.penalties?.[0]?.key || null, requestId: crypto.randomUUID() }); setError(''); setNotice('') }} />
    {data.activeShields > 0 && <p className="text-sm">Активных щитов на задании: {data.activeShields}</p>}
    {data.itemHelp?.length > 0 && <section className="space-y-3" aria-label="Помощь от предметов"><h3 className="font-semibold">Открытая помощь</h3>{data.itemHelp.map((help) => <article key={help.id} className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 dark:border-cyan-800 dark:bg-cyan-950/30"><h4 className="font-medium">{help.title}</h4>{help.text && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{help.text}</p>}{help.image && <img src={help.image} alt={`Ориентир: ${help.title}`} className="mt-2 max-h-80 max-w-full rounded-lg object-contain" />}</article>)}</section>}
    {data.variantChoices?.length > 0 && <>
      <p className="text-sm">Время задания уже идёт. {data.canSelectVariant ? 'Выберите путь для команды.' : 'Ожидаем решения капитана.'}</p>
      {data.variantChoices.map((choice) => <div key={choice.id} className="rounded-xl border border-slate-300 p-4 dark:border-slate-700">
        <p className="font-semibold">{choice.title}</p><p className="whitespace-pre-wrap">{choice.description}</p>
        <p className="my-2 text-sm">{costText(choice)}</p>
        {data.canSelectVariant && <button type="button" className="aq-modal-btn aq-modal-btn-primary" disabled={busy} onClick={(event) => { returnFocusRef.current = event.currentTarget; setSelected({ ...choice, stageId: data.stageId }); setError('') }}>Выбрать путь</button>}
      </div>)}
    </>}
    {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
    <Modal isOpen={Boolean(selected)} onClose={() => { if (!busy) closeSelection() }} title={selected?.kind === 'item' ? 'Применить предмет' : 'Подтвердить путь'} footer={<button autoFocus type="button" className="aq-modal-btn aq-modal-btn-primary" disabled={busy} onClick={submit}>{busy ? 'Сохраняем…' : selected?.kind === 'item' ? 'Применить и потратить предмет' : 'Подтвердить выбор'}</button>}>
      <p>{selected?.title}</p>
      {selected?.kind === 'item' ? <div className="mt-2 space-y-3 text-sm"><p>{getClassicEffectLabel(selected.effect)}. {getClassicEffectDefinition(selected.effect.type)?.description}</p><p>Один предмет будет потрачен.</p>{selected.effect.type === 'penalty_erase' && <label className="block space-y-1"><span>Какой штраф снять</span><select aria-label="Какой штраф снять" className="w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900" value={selected.penaltyKey || ''} onChange={(event) => setSelected({ ...selected, penaltyKey: event.target.value })}>{selected.penalties?.map((penalty) => <option key={penalty.key} value={penalty.key}>{penalty.name}: {penalty.seconds} сек.</option>)}</select></label>}</div> : <><p>{selected ? costText(selected) : ''}</p><p className="mt-2 text-sm">После подтверждения изменить путь нельзя. Таймер продолжает идти.</p></>}
      {error && <p role="alert" className="mt-2 text-red-600">{error}</p>}
    </Modal>
  </section>
}
ClassicVariantChoice.propTypes = {
  data: PropTypes.shape({ stageId: PropTypes.string, canSelectVariant: PropTypes.bool, variantChoices: PropTypes.array, activeShields: PropTypes.number, itemHelp: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, title: PropTypes.string, text: PropTypes.string, image: PropTypes.string })), inventory: PropTypes.arrayOf(PropTypes.shape({ itemId: PropTypes.string.isRequired, title: PropTypes.string, description: PropTypes.string, quantity: PropTypes.number, effect: PropTypes.shape({ type: PropTypes.string, seconds: PropTypes.number }), canUse: PropTypes.bool, useBlockReason: PropTypes.string, penalties: PropTypes.arrayOf(PropTypes.shape({ key: PropTypes.string, name: PropTypes.string, seconds: PropTypes.number })) })) }), location: PropTypes.string.isRequired, gameId: PropTypes.string.isRequired,
  teamId: PropTypes.string.isRequired, testRunId: PropTypes.string, onUpdate: PropTypes.func.isRequired,
}
