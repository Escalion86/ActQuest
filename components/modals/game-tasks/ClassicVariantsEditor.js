import { useRef, useState } from 'react'
import Modal from '@components/Modal'
import PropTypes from 'prop-types'
import { classicStageId } from '@helpers/classicVariants'
import { copyClassicContent, describeClassicCondition } from '@helpers/classicVariantEditor'
import Quantities, { classicInputClass as inputClass, classicButtonClass as buttonClass } from './ClassicItemQuantities'
import ClassicVariantSimulation from './ClassicVariantSimulation'
import { Field, outcomes, categories, codesFor } from './ClassicVariantFields'

export default function ClassicVariantsEditor({ game, stageIndex, variantId, onSelectVariant, onChange, disabled }) {
  const [adding, setAdding] = useState(false)
  const addButtonRef = useRef(null)
  const closeAddVariant = () => {
    setAdding(false)
    addButtonRef.current?.focus()
  }
  const task = game.tasks[stageIndex]
  const items = game.classicItems || []
  const variants = task.variants || []
  const enabled = Boolean(task.variantConfig?.enabled)
  const variant = enabled ? variants.find((entry) => entry.id === variantId) : null
  const updateTask = (patch, item) => {
    if (disabled) return
    onChange((previous) => ({ ...previous,
      ...(item ? { classicItems: [...(previous.classicItems || []), item] } : {}),
      tasks: previous.tasks.map((entry) => entry.id === task.id ? { ...entry, stageKey: classicStageId(entry, stageIndex), ...(typeof patch === 'function' ? patch(entry) : patch) } : entry),
    }))
  }
  const updateVariant = (patch, item) => updateTask((current) => ({ variants: current.variants.map((entry) => entry.id === variantId ? { ...entry, ...(typeof patch === 'function' ? patch(entry) : patch) } : entry) }), item)
  const updateConfig = (patch) => updateTask((current) => ({ variantConfig: { mode: 'auto', offerDefaultAlways: false, ...current.variantConfig, ...patch } }))
  const updateRule = (index, patch, item) => updateVariant((current) => ({ conditions: { ...current.conditions, rules: current.conditions.rules.map((rule, i) => i === index ? { ...rule, ...patch } : rule) } }), item)
  const addVariant = (copy) => {
    if (disabled) return
    const next = { id: crypto.randomUUID(), title: `Вариант ${variants.length + 1}`, description: '', conditions: { mode: 'all', rules: [] }, consumeItems: [], content: copy ? copyClassicContent(task) : { title: '', task: '', taskRich: '', codes: [], clues: [], bonusCodes: [], penaltyCodes: [] } }
    updateTask((current) => ({ variantConfig: { mode: 'auto', offerDefaultAlways: false, ...current.variantConfig, enabled: true }, variants: [...(current.variants || []), next] }))
    onSelectVariant(next.id); closeAddVariant()
  }
  return <section aria-label={`Варианты этапа ${stageIndex + 1}`} className="space-y-4 rounded-2xl border border-cyan-200 bg-cyan-50/40 p-3 dark:border-cyan-800 dark:bg-cyan-950/15 sm:p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-semibold">Варианты задания</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Команда проходит один вариант этого этапа.</p></div>
      <button ref={addButtonRef} type="button" aria-haspopup="dialog" className={buttonClass} disabled={disabled} onClick={() => setAdding(true)}>Добавить вариант задания</button>
    </div>
    <Modal
      isOpen={adding}
      title="С чего начать новый вариант?"
      onClose={closeAddVariant}
      dialogClassName="md:!max-w-xl"
      footer={<button type="button" className={buttonClass} onClick={closeAddVariant}>Отмена</button>}
    >
      <div className="grid gap-3">
        <button autoFocus type="button" disabled={disabled} className={`${buttonClass} text-left`} onClick={() => addVariant(true)}>
          Скопировать основное задание
        </button>
        <button type="button" disabled={disabled} className={`${buttonClass} text-left`} onClick={() => addVariant(false)}>
          Создать пустое
        </button>
      </div>
    </Modal>
    {!enabled && <p className="text-sm text-slate-600 dark:text-slate-300">Сейчас все команды получают основное задание.{variants.length > 0 && <> Сохранено альтернатив: {variants.length}.</>}</p>}
    {enabled && <>
      <Field label="Кто выбирает задание?"><select className={inputClass} disabled={disabled} value={task.variantConfig.mode || 'auto'} onChange={(event) => updateConfig({ mode: event.target.value })}><option value="auto">Автоматически по условиям</option><option value="captain">Капитан команды</option></select></Field>
      <p className="text-sm text-slate-600 dark:text-slate-300">{task.variantConfig.mode === 'captain' ? 'Капитан увидит доступные варианты. Если доступен только один, он назначится автоматически. Время на выбор входит во время этапа.' : 'Назначится первая подходящая альтернатива сверху. Если ни одна не подходит — основное задание.'}</p>
      {task.variantConfig.mode === 'captain' && <label className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={disabled} checked={Boolean(task.variantConfig.offerDefaultAlways)} onChange={(event) => updateConfig({ offerDefaultAlways: event.target.checked })} />Также разрешить основное задание, чтобы команда могла сохранить предметы</label>}
      <div className="grid gap-2 sm:grid-cols-2" aria-label="Редактируемый вариант">
        {[{ id: 'default', title: task.variantConfig.title || 'Основное задание' }, ...variants].map((entry, i) => <button key={entry.id} type="button" aria-pressed={variantId === entry.id} onClick={() => onSelectVariant(entry.id)} className={`min-w-0 rounded-xl border p-3 text-left ${variantId === entry.id ? 'border-cyan-500 bg-cyan-100 dark:bg-cyan-900/40' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}>
          <span className="block break-words font-semibold">{i ? `${i}. ` : ''}{entry.title || 'Без названия'}</span>
          <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">{i ? (entry.conditions?.rules?.length ? entry.conditions.rules.map((rule) => describeClassicCondition(rule, game)).join(entry.conditions.mode === 'any' ? ' ИЛИ ' : ' И ') : 'Без условий') : 'Без условий и расхода; используется, если альтернативы недоступны'}</span>
          {entry.consumeItems?.length > 0 && <span className="mt-1 block text-xs">Расход: {entry.consumeItems.map((cost) => `${items.find((item) => item.id === cost.itemId)?.title || 'Удалённый предмет'} ×${cost.quantity}`).join(', ')}</span>}
        </button>)}
      </div>
      <fieldset disabled={disabled} className="min-w-0 space-y-4">
        <Field label="Название варианта"><input className={inputClass} value={variant ? variant.title : task.variantConfig.title || ''} placeholder="Основное задание" onChange={(event) => variant ? updateVariant({ title: event.target.value }) : updateConfig({ title: event.target.value })} /></Field>
        {task.variantConfig.mode === 'captain' && <Field label="Описание для капитана перед выбором"><textarea className={inputClass} value={(variant || task.variantConfig).description || ''} onChange={(event) => variant ? updateVariant({ description: event.target.value }) : updateConfig({ description: event.target.value })} /></Field>}
        {(!variant || variants.length > 1) && <h4 className="font-semibold">{variant ? 'Когда доступен этот вариант?' : 'Основной вариант'}</h4>}
        {!variant && <p className="text-sm">Это гарантированный путь без условий и расхода предметов.</p>}
        {variant && <>
          {variants.length > 1 && <>
          <div className="flex flex-wrap gap-2">{[-1, 1].map((direction) => <button key={direction} type="button" className={buttonClass} disabled={disabled || (direction < 0 ? variants[0]?.id === variantId : variants.at(-1)?.id === variantId)} onClick={() => updateTask((current) => { const next = [...current.variants]; const i = next.findIndex((entry) => entry.id === variantId); [next[i], next[i + direction]] = [next[i + direction], next[i]]; return { variants: next } })}>{direction < 0 ? 'Выше в списке' : 'Ниже в списке'}</button>)}</div>
          {(variant.conditions?.rules || []).length > 1 && <Field label="Как объединить условия?"><select className={inputClass} value={variant.conditions?.mode || 'all'} onChange={(event) => updateVariant({ conditions: { ...variant.conditions, mode: event.target.value } })}><option value="all">Должны выполняться все</option><option value="any">Достаточно любого</option></select></Field>}
          {(variant.conditions?.rules || []).map((rule, i) => {
            const previous = game.tasks.find((entry, n) => classicStageId(entry, n) === rule.stageId)
            const source = rule.variantId && rule.variantId !== 'default' ? previous?.variants?.find((entry) => entry.id === rule.variantId)?.content : previous
            return <div key={i} className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <Field label="Условие"><select className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`} disabled={disabled || stageIndex === 0} value={rule.type} onChange={(event) => {
                const next = event.target.value === 'item' ? { type: 'item', itemId: '', quantity: 1 } : event.target.value === 'outcome' ? { type: 'outcome', stageId: '', variantId: '', outcome: '' } : { type: 'code', stageId: '', variantId: 'default', category: 'main', code: '', absent: false }
                updateVariant({ conditions: { ...variant.conditions, rules: variant.conditions.rules.map((entry, n) => n === i ? next : entry) } })
              }}><option value="item">Наличие или количество предмета</option><option value="outcome" disabled={!stageIndex}>Результат предыдущего этапа</option><option value="code" disabled={!stageIndex}>Ранее введённый код</option></select></Field>
              {rule.type === 'item' ? <>
                <Field label="Проверить количество"><select className={inputClass} value={rule.absent ? 'absent' : 'present'} onChange={(event) => updateRule(i, { absent: event.target.value === 'absent' })}><option value="present">Не меньше указанного</option><option value="absent">Меньше указанного (нет предмета, если указано 1)</option></select></Field>
                <Quantities single items={items} value={[{ itemId: rule.itemId || '', quantity: rule.quantity ?? 1 }]} onChange={(next) => updateRule(i, next[0])} onCreateItem={(item, next) => updateRule(i, next[0], item)} />
                {!rule.absent && rule.itemId && <label className="flex gap-2 text-sm"><input type="checkbox" checked={(variant.consumeItems || []).some((cost) => cost.itemId === rule.itemId)} onChange={(event) => updateVariant({ consumeItems: event.target.checked ? [...(variant.consumeItems || []), { itemId: rule.itemId, quantity: rule.quantity || 1 }] : (variant.consumeItems || []).filter((cost) => cost.itemId !== rule.itemId) })} />Забрать этот предмет при выборе (количество указано ниже)</label>}
              </> : <>
                <Field label="На каком этапе?"><select className={inputClass} value={rule.stageId || ''} onChange={(event) => updateRule(i, { stageId: event.target.value, variantId: rule.type === 'outcome' ? '' : 'default', code: '' })}><option value="">Выберите предыдущий этап</option>{game.tasks.slice(0, stageIndex).map((entry, n) => <option key={entry.id} value={classicStageId(entry, n)}>{n + 1}. {entry.title}</option>)}</select></Field>
                {(previous?.variants?.length > 0 || (rule.type === 'outcome' && rule.variantId)) && <Field label="Вариант предыдущего этапа"><select className={inputClass} value={rule.variantId ?? 'default'} onChange={(event) => updateRule(i, { variantId: event.target.value, code: '' })}>{rule.type === 'outcome' && <option value="">Любой, включая отсутствие выбора</option>}<option value="default">Основное задание</option>{(previous?.variants || []).map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}</select></Field>}
                {rule.type === 'outcome' ? <Field label="Результат"><select className={inputClass} value={rule.outcome || ''} onChange={(event) => updateRule(i, { outcome: event.target.value })}><option value="">Выберите результат</option>{Object.entries(outcomes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field> : <>
                  <Field label="Тип кода"><select className={inputClass} value={rule.category || 'main'} onChange={(event) => updateRule(i, { category: event.target.value, code: '' })}>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
                  <Field label="Код"><select className={inputClass} value={rule.code || ''} onChange={(event) => updateRule(i, { code: event.target.value })}><option value="">Выберите код</option>{codesFor(source || {}, rule.category || 'main').filter(Boolean).map((code) => <option key={code} value={code}>{code}</option>)}</select></Field>
                  <Field label="Что произошло с кодом?"><select className={inputClass} value={rule.absent ? 'absent' : 'found'} onChange={(event) => updateRule(i, { absent: event.target.value === 'absent' })}><option value="found">Команда ввела код</option><option value="absent">Команда не ввела код</option></select></Field>
                </>}
              </>}
              <button type="button" className={buttonClass} onClick={() => updateVariant({ conditions: { ...variant.conditions, rules: variant.conditions.rules.filter((_, n) => n !== i) } })}>Удалить условие</button>
            </div>
          })}
          {!variant.conditions?.rules?.length && <p className="text-sm">Пока доступен всем, у кого хватает предметов на расход.</p>}
          <button type="button" className={buttonClass} onClick={() => updateVariant({ conditions: { mode: 'all', ...variant.conditions, rules: [...(variant.conditions?.rules || []), { type: 'item', itemId: '', quantity: 1 }] } })}>Добавить условие</button>
          </>}
          <details open={(variant.consumeItems || []).length > 0}><summary className="cursor-pointer font-medium">Что потратить при выборе?</summary><p className="my-2 text-xs text-slate-500">Расход проверяется всегда, даже если достаточно любого условия. Без этого списка предметы сохраняются.</p><Quantities items={items} value={variant.consumeItems} onChange={(consumeItems) => updateVariant({ consumeItems })} onCreateItem={(item, consumeItems) => updateVariant({ consumeItems }, item)} /></details>
          <button type="button" className={`${buttonClass} text-red-600`} onClick={() => {
            if (!window.confirm(`Удалить вариант «${variant.title}» вместе с его заданием? До сохранения игры изменения можно сбросить.`)) return
            updateTask((current) => ({ variants: current.variants.filter((entry) => entry.id !== variantId) })); onSelectVariant('default')
          }}>Удалить этот вариант</button>
        </>}
      </fieldset>
      <ClassicVariantSimulation game={game} stageIndex={stageIndex} />
    </>}
  </section>
}
ClassicVariantsEditor.propTypes = { game: PropTypes.object.isRequired, stageIndex: PropTypes.number.isRequired, variantId: PropTypes.string.isRequired, onSelectVariant: PropTypes.func.isRequired, onChange: PropTypes.func.isRequired, disabled: PropTypes.bool }
