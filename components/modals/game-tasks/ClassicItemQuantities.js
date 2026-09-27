import { useRef, useState } from 'react'
import Modal from '@components/Modal'
import PropTypes from 'prop-types'

export const classicInputClass = 'w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white'
export const classicButtonClass = 'rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800'

export default function ClassicItemQuantities({ value: storedValue, items, onChange, onCreateItem, disabled = false, single = false }) {
  const value = storedValue ?? []
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState('unique')
  const createButtonRef = useRef(null)
  const closeCreateItem = () => {
    setCreating(false)
    setTitle('')
    setKind('unique')
    createButtonRef.current?.focus()
  }
  const createItem = () => {
    if (disabled || !title.trim() || !onCreateItem) return
    const item = { id: crypto.randomUUID(), title: title.trim(), description: '', kind }
    // Создание предмета и привязка к полю выполняются в одном обновлении черновика.
    onCreateItem(item, single ? [{ itemId: item.id, quantity: 1 }] : [...value, { itemId: item.id, quantity: 1 }])
    closeCreateItem()
  }
  return <div className="space-y-2">
    {value.map((entry, i) => <div className="flex flex-wrap items-center gap-2" key={i}>
      <select aria-label="Предмет" disabled={disabled} className={`${classicInputClass} flex-1 basis-40`} value={entry.itemId} onChange={(event) => onChange(value.map((current, n) => n === i ? { ...current, itemId: event.target.value, quantity: items.find((item) => item.id === event.target.value)?.kind === 'unique' ? 1 : current.quantity } : current))}>
        <option value="">Выберите предмет</option>
        {entry.itemId && !items.some((item) => item.id === entry.itemId) && <option value={entry.itemId}>Предмет удалён — выберите другой</option>}
        {items.map((item) => <option key={item.id} value={item.id}>{item.title || 'Без названия'}</option>)}
      </select>
      {items.find((item) => item.id === entry.itemId)?.kind !== 'unique' && <input aria-label="Количество" disabled={disabled} className={`${classicInputClass} max-w-24`} type="number" min="1" step="1" value={entry.quantity} onChange={(event) => onChange(value.map((current, n) => n === i ? { ...current, quantity: Number(event.target.value) } : current))} />}
      {!single && <button type="button" disabled={disabled} className={classicButtonClass} onClick={() => onChange(value.filter((_, n) => n !== i))}>Убрать</button>}
    </div>)}
    <div className="flex flex-wrap gap-2">
      {!single && <button type="button" className={classicButtonClass} disabled={disabled || !items.length} onClick={() => onChange([...value, { itemId: items[0].id, quantity: 1 }])}>Добавить предмет</button>}
      {onCreateItem && <button ref={createButtonRef} type="button" aria-haspopup="dialog" disabled={disabled} className={classicButtonClass} onClick={() => setCreating(true)}>Создать новый предмет</button>}
    </div>
    {!items.length && !creating && <p className="text-xs text-slate-500">Создайте предмет здесь, например ключ или жетон.</p>}
    <Modal
      isOpen={creating}
      title="Новый предмет"
      onClose={closeCreateItem}
      dialogClassName="md:!max-w-xl"
      footer={<>
        <button type="button" className={classicButtonClass} onClick={closeCreateItem}>Отмена</button>
        <button type="button" className="aq-modal-btn aq-modal-btn-primary" disabled={disabled || !title.trim()} onClick={createItem}>Создать и выбрать</button>
      </>}
    >
      <div className="space-y-4">
        <label className="block space-y-1 text-sm">
          <span>Название предмета</span>
          <input autoFocus disabled={disabled} className={classicInputClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например, ключ" />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Количество у команды</span>
          <select disabled={disabled} className={classicInputClass} value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="unique">Один экземпляр — ключ, пропуск</option>
            <option value="stackable">Можно накапливать — жетоны, монеты</option>
          </select>
        </label>
      </div>
    </Modal>
  </div>
}
ClassicItemQuantities.propTypes = { value: PropTypes.array, items: PropTypes.array.isRequired, onChange: PropTypes.func.isRequired, onCreateItem: PropTypes.func, disabled: PropTypes.bool, single: PropTypes.bool }

export function ClassicOutcomeRewards({ value: storedValue, items, onChange, onCreateItem, disabled }) {
  const value = storedValue ?? {}
  return <div className="space-y-3">{Object.entries({ completed: 'За выполнение', timeout: 'Если время истекло', captain_failed: 'Если капитан слил задание' }).map(([outcome, title]) => <details key={outcome}>
    <summary className="cursor-pointer text-sm">{title}{value[outcome]?.length ? ` · ${value[outcome].map((entry) => `${items.find((item) => item.id === entry.itemId)?.title || 'Удалённый предмет'} ×${entry.quantity}`).join(', ')}` : ''}</summary>
    <div className="mt-2"><ClassicItemQuantities value={value[outcome]} items={items} disabled={disabled} onChange={(entries) => onChange({ ...value, [outcome]: entries })} onCreateItem={onCreateItem ? (item, entries) => onCreateItem(item, { ...value, [outcome]: entries }) : undefined} /></div>
  </details>)}</div>
}
ClassicOutcomeRewards.propTypes = { value: PropTypes.object, items: PropTypes.array.isRequired, onChange: PropTypes.func.isRequired, onCreateItem: PropTypes.func, disabled: PropTypes.bool }
