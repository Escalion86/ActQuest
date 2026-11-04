import { useState } from 'react'
import PropTypes from 'prop-types'
import Modal from '@components/Modal'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPen, faTrash } from '@fortawesome/free-solid-svg-icons'
import { classicItemUsage } from '@helpers/classicVariantEditor'
import { classicStageId } from '@helpers/classicVariants'
import { CLASSIC_ITEM_EFFECTS, getClassicEffectDefinition, getClassicEffectLabel, getClassicEffectValidationError, isClassicTimedEffect, isClassicHelpEffect } from '@helpers/classicItemDefinitions'

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white'
const iconButtonClass = 'inline-flex h-10 w-10 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/50'
const itemPropType = PropTypes.shape({ id: PropTypes.string, title: PropTypes.string.isRequired, description: PropTypes.string, kind: PropTypes.oneOf(['unique', 'stackable']), effect: PropTypes.shape({ type: PropTypes.oneOf(CLASSIC_ITEM_EFFECTS.map((effect) => effect.type)), seconds: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), text: PropTypes.string, image: PropTypes.string, allowedStageIds: PropTypes.arrayOf(PropTypes.string) }) })

function ItemCard({ item, children }) {
  return <article className="min-w-0 rounded-xl border border-cyan-200 bg-cyan-50/50 p-4 dark:border-cyan-800 dark:bg-cyan-950/20">
    <span className="inline-flex rounded-full bg-white px-2 py-1 text-xs text-cyan-800 dark:bg-slate-800 dark:text-cyan-200">{item.kind === 'unique' ? 'Уникальный' : 'Накапливаемый'}</span>
    <h4 className="mt-3 break-words text-lg font-semibold">{item.title.trim() || 'Название предмета'}</h4>
    {item.description?.trim() && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-300">{item.description.trim()}</p>}
    {item.effect && <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">{getClassicEffectLabel(item.effect)} · Расходуется при применении</p>}
    {children}
  </article>
}
ItemCard.propTypes = { item: itemPropType.isRequired, children: PropTypes.node }

export default function ClassicItemsEditor({ items, onChange, disabled, tasks = [] }) {
  const [draft, setDraft] = useState(null)
  const isExisting = draft && items.some((item) => item.id === draft.id)
  const effectError = getClassicEffectValidationError(draft?.effect)
  const validEffect = !effectError
  const close = () => setDraft(null)
  const save = () => {
    if (disabled || !draft?.title.trim() || !validEffect) return
    const item = { ...draft, title: draft.title.trim(), description: draft.description.trim() }
    onChange(isExisting ? items.map((entry) => entry.id === item.id ? item : entry) : [...items, item])
    close()
  }
  return <section className="space-y-3" aria-label="Предметы игры">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="font-medium">Предметы ({items.length})</p>
      <button type="button" disabled={disabled} className="aq-modal-btn aq-modal-btn-secondary" onClick={() => setDraft({ id: crypto.randomUUID(), title: '', description: '', kind: 'stackable' })}>Создать предмет</button>
    </div>
    {items.length ? <div className="grid gap-3 sm:grid-cols-2">{items.map((item) => {
      const usage = classicItemUsage(tasks, item.id)
      const used = usage.grants.length > 0 || usage.uses.length > 0
      return <ItemCard key={item.id} item={item}>
      <div className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-300">
        <p>Где выдаётся: {usage.grants.join('; ') || 'пока нигде'}</p>
        <p>Где используется: {item.effect ? 'Применяется капитаном во время задания' : usage.uses.join('; ') || 'пока нигде'}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={disabled} className={iconButtonClass} title="Редактировать" aria-label={`Редактировать предмет ${item.title}`} onClick={() => setDraft({ ...item, description: item.description || '' })}><FontAwesomeIcon icon={faPen} aria-hidden="true" /></button>
        <button type="button" disabled={disabled || used} className={iconButtonClass} title={used ? 'Сначала уберите предмет из наград и условий' : 'Удалить'} aria-label={`Удалить предмет ${item.title}`} onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}><FontAwesomeIcon icon={faTrash} aria-hidden="true" /></button>
      </div>
      {used && <p className="mt-2 text-xs text-slate-500">Для удаления сначала уберите предмет из перечисленных наград и условий.</p>}
    </ItemCard>})}</div> : <p className="text-sm text-slate-500">Добавьте предмет — например, жетон, ключ или маховик времени. Его можно выдавать за коды, использовать при выборе пути или применять во время задания.</p>}
    <div onKeyDown={(event) => {
      // Escape закрывает только редактор предмета, сохраняя окно заданий.
      if (draft && event.key === 'Escape') { event.stopPropagation(); close() }
    }}>
      <Modal isOpen={Boolean(draft)} title={isExisting ? 'Редактирование предмета' : 'Новый предмет'} onClose={close} footer={<div className="flex flex-wrap gap-2 pr-14 md:pr-0">
        <button type="button" className="aq-modal-btn aq-modal-btn-secondary" onClick={close}>Отмена</button>
        <button type="button" className="aq-modal-btn aq-modal-btn-primary" disabled={disabled || !draft?.title.trim() || !validEffect} onClick={save}>{isExisting ? 'Применить' : 'Добавить предмет'}</button>
      </div>}>
        {draft && <div className="grid gap-6 md:grid-cols-2">
          <fieldset disabled={disabled} className="min-w-0 space-y-4">
            <label className="block space-y-1 text-sm"><span>Название предмета</span><input autoFocus className={inputClass} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
            <label className="block space-y-1 text-sm"><span>Тип предмета</span><select className={inputClass} value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value })}><option value="stackable">Накапливаемый</option><option value="unique">Уникальный</option></select></label>
            <label className="block space-y-1 text-sm"><span>Описание предмета</span><textarea rows={4} className={inputClass} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
            <label className="block space-y-1 text-sm"><span>Эффект при применении</span><select aria-label="Эффект при применении" className={inputClass} value={draft.effect?.type || ''} onChange={(event) => { const definition = getClassicEffectDefinition(event.target.value); setDraft({ ...draft, effect: definition ? { type: definition.type, ...(definition.seconds ? { seconds: definition.seconds } : {}), ...(isClassicHelpEffect(definition.type) ? { text: '', image: '' } : {}), allowedStageIds: draft.effect?.allowedStageIds || [] } : null }) }}><option value="">Без активного эффекта</option>{CLASSIC_ITEM_EFFECTS.map((effect) => <option key={effect.type} value={effect.type}>{effect.title}</option>)}</select></label>
            {draft.effect && <>
              {isClassicTimedEffect(draft.effect.type) && <label className="block space-y-1 text-sm"><span>{draft.effect.type === 'time_rewind' ? 'Откат времени, минут' : 'Длительность заморозки, минут'}</span><input type="number" min="0" step="any" className={inputClass} value={draft.effect.seconds === '' ? '' : draft.effect.seconds / 60} onChange={(event) => setDraft({ ...draft, effect: { ...draft.effect, seconds: event.target.value === '' ? '' : Math.round(Number(event.target.value) * 60) } })} /></label>}
              <p className="text-xs text-slate-500">{getClassicEffectDefinition(draft.effect.type)?.description}</p>
              {isClassicHelpEffect(draft.effect.type) && <>
                <label className="block space-y-1 text-sm"><span>Текст для команды после применения</span><textarea rows={4} className={inputClass} value={draft.effect.text || ''} onChange={(event) => setDraft({ ...draft, effect: { ...draft.effect, text: event.target.value } })} /></label>
                <label className="block space-y-1 text-sm"><span>Изображение подсказки (ссылка)</span><input type="url" className={inputClass} value={draft.effect.image || ''} onChange={(event) => setDraft({ ...draft, effect: { ...draft.effect, image: event.target.value } })} /></label>
                <p className="text-xs text-slate-500">Содержимое скрыто от команды до применения. Для подсказки к определённому заданию выберите его ниже.</p>
              </>}
              {effectError && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{effectError}</p>}
              <fieldset className="space-y-2"><legend className="text-sm font-medium">На каких заданиях можно применить</legend>
                <p className="text-xs text-slate-500">Если ничего не выбрано — на любом активном задании.</p>
                {tasks.map((task, index) => { const id = classicStageId(task, index); return <label key={id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={(draft.effect.allowedStageIds || []).includes(id)} onChange={(event) => setDraft({ ...draft, effect: { ...draft.effect, allowedStageIds: event.target.checked ? [...(draft.effect.allowedStageIds || []), id] : (draft.effect.allowedStageIds || []).filter((entry) => entry !== id) } })} />{index + 1}. {task.title || 'Без названия'}</label> })}
              </fieldset>
            </>}
            <p className="text-xs text-slate-500">После добавления предмета сохраните изменения игры.</p>
          </fieldset>
          <div className="min-w-0"><p className="mb-3 text-sm font-medium">Карточка предмета</p><ItemCard item={draft} /></div>
        </div>}
      </Modal>
    </div>
  </section>
}
ClassicItemsEditor.propTypes = { items: PropTypes.arrayOf(itemPropType).isRequired, onChange: PropTypes.func.isRequired, disabled: PropTypes.bool, tasks: PropTypes.array }
