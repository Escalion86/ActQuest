import PropTypes from 'prop-types'
import { classicTaskUsesTrigger } from '@helpers/classicTriggers'
import { classicButtonClass, classicInputClass } from './ClassicItemQuantities'

export default function ClassicTriggersEditor({ game, onChange, disabled }) {
  const triggers = game.classicTriggers || []
  const items = game.classicItems || []
  const updateTriggers = (update) => {
    if (!disabled) onChange((previous) => ({ ...previous, classicTriggers: update(previous.classicTriggers || []) }))
  }

  return (
    <details className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <summary className="cursor-pointer font-semibold">Триггеры игры · {triggers.length}</summary>
      <p className="my-3 text-sm text-slate-500">
        Один триггер открывает все связанные блоки в заданиях команды до конца игры.
      </p>
      <div className="space-y-3">
        {triggers.map((trigger, index) => {
          const used = game.tasks?.some((task) => classicTaskUsesTrigger(task, trigger.id))
          const update = (patch) => updateTriggers((current) =>
            current.map((entry) => entry.id === trigger.id ? { ...entry, ...patch } : entry))
          const availableItems = trigger.source === 'item_used' ? items.filter((item) => item.effect) : items
          return (
            <fieldset key={trigger.id} disabled={disabled} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <legend className="px-1 text-sm font-medium">Триггер {index + 1}</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm">Название для организатора
                  <input className={classicInputClass} value={trigger.title} onChange={(event) => update({ title: event.target.value })} />
                </label>
                <label className="text-sm">Когда открыть блоки
                  <select className={classicInputClass} value={trigger.source} onChange={(event) => update({ source: event.target.value, code: '', itemId: '' })}>
                    <option value="code">При вводе кода</option>
                    <option value="item_granted">При получении предмета</option>
                    <option value="item_used">При применении предмета</option>
                  </select>
                </label>
                {trigger.source === 'code' ? (
                  <label className="text-sm">Код активации
                    <input className={classicInputClass} value={trigger.code || ''} autoComplete="off" onChange={(event) => update({ code: event.target.value })} />
                  </label>
                ) : (
                  <label className="text-sm">Предмет
                    <select className={classicInputClass} value={trigger.itemId || ''} onChange={(event) => update({ itemId: event.target.value })}>
                      <option value="">Выберите предмет</option>
                      {availableItems.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                    </select>
                  </label>
                )}
              </div>
              <p className="my-2 text-xs text-slate-500">
                {trigger.source === 'code' && 'Код можно ввести на любом активном задании. Если он совпадает с кодом задания, тот тоже засчитывается.'}
                {trigger.source === 'item_used' && 'Подойдёт предмет с любым активным эффектом. Для предмета, который только открывает блоки, выберите эффект «Открытие скрытых блоков».'}
                {trigger.source === 'item_granted' && 'Срабатывает при выдаче предмета за код или исход задания.'}
              </p>
              <button type="button" disabled={used} className={`${classicButtonClass} text-red-600`} onClick={() => updateTriggers((current) => current.filter(({ id }) => id !== trigger.id))}>
                Удалить триггер
              </button>
              {used && <p className="mt-1 text-xs text-slate-500">Сначала уберите его из связанных блоков.</p>}
            </fieldset>
          )
        })}
        <button type="button" disabled={disabled} className={classicButtonClass} onClick={() => {
          const trigger = { id: crypto.randomUUID(), title: '', source: 'code', code: '', itemId: '' }
          updateTriggers((current) => [...current, trigger])
        }}>
          Создать триггер
        </button>
      </div>
    </details>
  )
}

ClassicTriggersEditor.propTypes = {
  game: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
}
