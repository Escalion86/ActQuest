import { useState } from 'react'
import PropTypes from 'prop-types'
import Modal from '@components/Modal'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPen, faTrash } from '@fortawesome/free-solid-svg-icons'

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white'
const iconButtonClass = 'inline-flex h-10 w-10 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/50'

function ItemCard({ item, children }) {
  return <article className="min-w-0 rounded-xl border border-cyan-200 bg-cyan-50/50 p-4 dark:border-cyan-800 dark:bg-cyan-950/20">
    <span className="inline-flex rounded-full bg-white px-2 py-1 text-xs text-cyan-800 dark:bg-slate-800 dark:text-cyan-200">{item.kind === 'unique' ? 'Уникальный' : 'Накапливаемый'}</span>
    <h4 className="mt-3 break-words text-lg font-semibold">{item.title.trim() || 'Название предмета'}</h4>
    {item.description?.trim() && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-300">{item.description.trim()}</p>}
    {children}
  </article>
}
ItemCard.propTypes = { item: PropTypes.object.isRequired, children: PropTypes.node }

export default function ClassicItemsEditor({ items, onChange, disabled }) {
  const [draft, setDraft] = useState(null)
  const isExisting = draft && items.some((item) => item.id === draft.id)
  const close = () => setDraft(null)
  const save = () => {
    if (disabled || !draft?.title.trim()) return
    const item = { ...draft, title: draft.title.trim(), description: draft.description.trim() }
    onChange(isExisting ? items.map((entry) => entry.id === item.id ? item : entry) : [...items, item])
    close()
  }
  return <section className="space-y-3" aria-label="Предметы игры">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="font-medium">Предметы ({items.length})</p>
      <button type="button" disabled={disabled} className="aq-modal-btn aq-modal-btn-secondary" onClick={() => setDraft({ id: crypto.randomUUID(), title: '', description: '', kind: 'stackable' })}>Создать предмет</button>
    </div>
    {items.length ? <div className="grid gap-3 sm:grid-cols-2">{items.map((item) => <ItemCard key={item.id} item={item}>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={disabled} className={iconButtonClass} title="Редактировать" aria-label={`Редактировать предмет ${item.title}`} onClick={() => setDraft({ ...item, description: item.description || '' })}><FontAwesomeIcon icon={faPen} aria-hidden="true" /></button>
        <button type="button" disabled={disabled} className={iconButtonClass} title="Удалить" aria-label={`Удалить предмет ${item.title}`} onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}><FontAwesomeIcon icon={faTrash} aria-hidden="true" /></button>
      </div>
    </ItemCard>)}</div> : <p className="text-sm text-slate-500">Добавьте предмет — например, жетон или ключ. Его можно выдавать за коды и использовать при выборе пути.</p>}
    <div onKeyDown={(event) => {
      // Escape закрывает только редактор предмета, сохраняя окно заданий.
      if (draft && event.key === 'Escape') { event.stopPropagation(); close() }
    }}>
      <Modal isOpen={Boolean(draft)} title={isExisting ? 'Редактирование предмета' : 'Новый предмет'} onClose={close} footer={<div className="flex flex-wrap gap-2 pr-14 md:pr-0">
        <button type="button" className="aq-modal-btn aq-modal-btn-secondary" onClick={close}>Отмена</button>
        <button type="button" className="aq-modal-btn aq-modal-btn-primary" disabled={disabled || !draft?.title.trim()} onClick={save}>{isExisting ? 'Применить' : 'Добавить предмет'}</button>
      </div>}>
        {draft && <div className="grid gap-6 md:grid-cols-2">
          <fieldset disabled={disabled} className="min-w-0 space-y-4">
            <label className="block space-y-1 text-sm"><span>Название предмета</span><input autoFocus className={inputClass} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
            <label className="block space-y-1 text-sm"><span>Тип предмета</span><select className={inputClass} value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value })}><option value="stackable">Накапливаемый</option><option value="unique">Уникальный</option></select></label>
            <label className="block space-y-1 text-sm"><span>Описание предмета</span><textarea rows={4} className={inputClass} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
            <p className="text-xs text-slate-500">После добавления предмета сохраните изменения игры.</p>
          </fieldset>
          <div className="min-w-0"><p className="mb-3 text-sm font-medium">Карточка предмета</p><ItemCard item={draft} /></div>
        </div>}
      </Modal>
    </div>
  </section>
}
ClassicItemsEditor.propTypes = { items: PropTypes.array.isRequired, onChange: PropTypes.func.isRequired, disabled: PropTypes.bool }
