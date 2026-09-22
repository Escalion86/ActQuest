import ClassicItemsEditor from './ClassicItemsEditor'
import { normalizeTaskTheme } from '@helpers/taskThemes'
import { useState } from 'react'
import PropTypes from 'prop-types'
import dynamic from 'next/dynamic'
import { classicStageId, validateClassicVariants, getClassicVariantChoices } from '@helpers/classicVariants'

const RichEditor = dynamic(() => import('@components/cabinet/TaskRichEditor'), { ssr: false })
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white'
const buttonClass = 'rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-600'
const id = () => crypto.randomUUID()
const outcomes = { completed: 'Выполнено', timeout: 'Время истекло', captain_failed: 'Слито капитаном' }
const categories = { main: 'Основной', bonus: 'Бонусный', penalty: 'Штрафной' }
const codesFor = (content, category) => category === 'main' ? content.codes || [] : (content[category === 'bonus' ? 'bonusCodes' : 'penaltyCodes'] || []).map((entry) => entry.code)

function Field({ label, children }) { return <label className="block space-y-1 text-sm"><span>{label}</span>{children}</label> }
Field.propTypes = { label: PropTypes.string.isRequired, children: PropTypes.node }
function Quantities({ value = [], items, onChange }) {
  return <div className="space-y-2">{value.map((entry, i) => <div className="flex gap-2" key={i}>
    <select aria-label="Предмет" className={inputClass} value={entry.itemId} onChange={(e) => onChange(value.map((v, n) => n === i ? { ...v, itemId: e.target.value, quantity: items.find((item) => item.id === e.target.value)?.kind === 'unique' ? 1 : v.quantity } : v))}><option value="">Выберите предмет</option>{items.map((item) => <option key={item.id} value={item.id}>{item.title || 'Без названия'}</option>)}</select>
    {items.find((item) => item.id === entry.itemId)?.kind !== 'unique' && <input aria-label="Количество" className={`${inputClass} max-w-24`} type="number" min="1" step="1" value={entry.quantity} onChange={(e) => onChange(value.map((v, n) => n === i ? { ...v, quantity: Number(e.target.value) } : v))} />}
    <button type="button" className={buttonClass} onClick={() => onChange(value.filter((_, n) => n !== i))}>Убрать</button>
  </div>)}<button type="button" className={buttonClass} disabled={!items.length} onClick={() => onChange([...value, { itemId: items[0]?.id || '', quantity: 1 }])}>Добавить предмет</button></div>
}
Quantities.propTypes = { value: PropTypes.array, items: PropTypes.array.isRequired, onChange: PropTypes.func.isRequired }

function Rewards({ content, items, onChange, outcomesOnly = false }) {
  const rewards = content || {}
  return <div className="space-y-3">{Object.entries(outcomes).map(([key, label]) => <details key={key}><summary>Выдать предметы: {label}</summary><Quantities items={items} value={rewards[key]} onChange={(value) => onChange({ ...rewards, [key]: value })} /></details>)}
    {!outcomesOnly && <p className="text-xs text-slate-500">Награды за конкретные коды настраиваются ниже.</p>}
  </div>
}
Rewards.propTypes = { content: PropTypes.object, items: PropTypes.array.isRequired, onChange: PropTypes.func.isRequired, outcomesOnly: PropTypes.bool }

export default function ClassicVariantsEditor({ game, onChange, disabled, agents = [] }) {
  const [stageIndex, setStageIndex] = useState(0)
  const [variantId, setVariantId] = useState('default')
  const [simulation, setSimulation] = useState([])
  const [simulationStages, setSimulationStages] = useState({})
  const items = game.classicItems || []
  const tasks = game.tasks || []
  const task = tasks[stageIndex]
  const variants = task?.variants || []
  const variant = task?.variantConfig?.enabled ? variants.find((entry) => entry.id === variantId) : null
  const content = variant?.content || task
  const updateTask = (patch) => onChange((previous) => ({ ...previous, tasks: previous.tasks.map((entry, i) => i === stageIndex ? { ...entry, stageKey: classicStageId(entry, i), ...patch } : entry) }))
  const updateVariant = (patch) => updateTask({ variants: variants.map((entry) => entry.id === variantId ? { ...entry, ...patch } : entry) })
  const updateContent = (patch) => variant ? updateVariant({ content: { ...content, ...patch } }) : updateTask(patch)
  const updateItems = (next) => {
    const uniqueIds = new Set(next.filter((item) => item.kind === 'unique').map((item) => item.id))
    // При смене типа предмета обновляем уже настроенные награды, расход и условия.
    const normalizeQuantities = (value) => {
      if (Array.isArray(value)) return value.map(normalizeQuantities)
      if (!value || typeof value !== 'object') return value
      const normalized = Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalizeQuantities(entry)]))
      if (uniqueIds.has(normalized.itemId) && 'quantity' in normalized) normalized.quantity = 1
      return normalized
    }
    onChange((previous) => ({ ...previous, classicItems: next, tasks: normalizeQuantities(previous.tasks) }))
    setSimulation((previous) => normalizeQuantities(previous))
  }
  const errors = validateClassicVariants(game)
  const updateRule = (index, patch) => updateVariant({ conditions: { ...variant.conditions, rules: (variant.conditions?.rules || []).map((rule, i) => i === index ? { ...rule, ...patch } : rule) } })
  if (game.type !== 'classic') return null
  return <details className="my-4 rounded-xl border border-cyan-300 p-4 dark:border-cyan-800">
    <summary className="cursor-pointer font-semibold">Варианты этапов и предметы</summary>
    <fieldset disabled={disabled} className="mt-4 space-y-5">
      <p className="text-sm">Один этап — одно задание для команды. Альтернативы зависят от предыдущих исходов и инвентаря. Для этой механики нужен линейный порядок этапов.</p>
      <ClassicItemsEditor items={items} onChange={updateItems} disabled={disabled} />
      {task && <>
        <Field label="Этап"><select className={inputClass} value={stageIndex} onChange={(e) => { setStageIndex(Number(e.target.value)); setVariantId('default') }}>{tasks.map((entry, i) => <option key={entry.id || i} value={i}>{i + 1}. {entry.title}</option>)}</select></Field>
        <label className="flex gap-2"><input type="checkbox" checked={Boolean(task.variantConfig?.enabled)} onChange={(e) => updateTask({ variantConfig: { mode: 'auto', offerDefaultAlways: false, ...task.variantConfig, enabled: e.target.checked } })} />Несколько вариантов этапа</label>
        {task.variantConfig?.enabled && <>
          <Field label="Назначение варианта"><select className={inputClass} value={task.variantConfig.mode} onChange={(e) => updateTask({ variantConfig: { ...task.variantConfig, mode: e.target.value } })}><option value="auto">Автоматически по порядку приоритета</option><option value="captain">Выбирает капитан</option></select></Field>
          <label className="flex gap-2"><input type="checkbox" checked={Boolean(task.variantConfig.offerDefaultAlways)} onChange={(e) => updateTask({ variantConfig: { ...task.variantConfig, offerDefaultAlways: e.target.checked } })} />Предлагать запасной путь всегда при ручном выборе</label>
          <Field label="Редактируемый вариант"><select className={inputClass} value={variantId} onChange={(e) => setVariantId(e.target.value)}><option value="default">Запасной путь</option>{variants.map((v, i) => <option key={v.id} value={v.id}>{i + 1}. {v.title}</option>)}</select></Field>
          <button type="button" className={buttonClass} onClick={() => {
            const variant = { id: id(), title: `Путь ${variants.length + 1}`, description: '', conditions: { mode: 'all', rules: [] }, consumeItems: [], content: { task: '', taskRich: '', codes: [], clues: [], bonusCodes: [], penaltyCodes: [] } }
            updateTask({ variants: [...variants, variant] }); setVariantId(variant.id)
          }}>Добавить альтернативу</button>
          <Field label="Название на экране выбора"><input className={inputClass} value={variant ? variant.title : task.variantConfig.title || ''} placeholder="Обычный путь" onChange={(e) => variant ? updateVariant({ title: e.target.value }) : updateTask({ variantConfig: { ...task.variantConfig, title: e.target.value } })} /></Field>
          <Field label="Краткое описание выбора"><textarea className={inputClass} value={(variant || task.variantConfig).description || ''} onChange={(e) => variant ? updateVariant({ description: e.target.value }) : updateTask({ variantConfig: { ...task.variantConfig, description: e.target.value } })} /></Field>
          {variant && <>
            <div className="flex gap-2"><button type="button" className={buttonClass} disabled={variants[0]?.id === variantId} onClick={() => { const next = [...variants]; const i = next.findIndex((v) => v.id === variantId); [next[i - 1], next[i]] = [next[i], next[i - 1]]; updateTask({ variants: next }) }}>Повысить приоритет</button><button type="button" className={buttonClass} onClick={() => { updateTask({ variants: variants.filter((v) => v.id !== variantId) }); setVariantId('default') }}>Удалить вариант</button></div>
            <Field label="Условия доступности"><select className={inputClass} value={variant.conditions?.mode || 'all'} onChange={(e) => updateVariant({ conditions: { ...variant.conditions, mode: e.target.value } })}><option value="all">Выполнены все условия</option><option value="any">Выполнено хотя бы одно</option></select></Field>
            {(variant.conditions?.rules || []).map((rule, i) => {
              const previous = tasks.find((entry, n) => classicStageId(entry, n) === rule.stageId)
              const source = rule.variantId && rule.variantId !== 'default' ? previous?.variants?.find((v) => v.id === rule.variantId)?.content : previous
              return <div key={i} className="space-y-2 rounded-lg border p-3">
                <select aria-label="Тип условия" className={inputClass} value={rule.type} onChange={(e) => updateRule(i, { type: e.target.value })}><option value="item">Количество предмета</option><option value="code">Ранее введённый код</option><option value="outcome">Исход этапа</option></select>
                {rule.type === 'item' ? <Quantities value={[{ itemId: rule.itemId || '', quantity: rule.quantity || 1 }]} items={items} onChange={(next) => next[0] && updateRule(i, next[0])} /> : <>
                  <select aria-label="Предыдущий этап" className={inputClass} value={rule.stageId || ''} onChange={(e) => updateRule(i, { stageId: e.target.value, variantId: 'default', code: '' })}><option value="">Выберите предыдущий этап</option>{tasks.slice(0, stageIndex).map((entry, n) => <option key={n} value={classicStageId(entry, n)}>{n + 1}. {entry.title}</option>)}</select>
                  <select aria-label="Исходный вариант" className={inputClass} value={rule.variantId ?? 'default'} onChange={(e) => updateRule(i, { variantId: e.target.value, code: '' })}><option value="default">Запасной / обычное задание</option>{rule.type === 'outcome' && <option value="">Любой вариант, включая отсутствие выбора</option>}{(previous?.variants || []).map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}</select>
                  {rule.type === 'outcome' ? <select aria-label="Исход" className={inputClass} value={rule.outcome || ''} onChange={(e) => updateRule(i, { outcome: e.target.value })}><option value="">Выберите исход</option>{Object.entries(outcomes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select> : <>
                    <select aria-label="Категория кода" className={inputClass} value={rule.category || 'main'} onChange={(e) => updateRule(i, { category: e.target.value, code: '' })}>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
                    <select aria-label="Код" className={inputClass} value={rule.code || ''} onChange={(e) => updateRule(i, { code: e.target.value })}><option value="">Выберите код</option>{codesFor(source || {}, rule.category || 'main').map((code) => <option key={code} value={code}>{code}</option>)}</select>
                  </>}
                </>}
                {rule.type !== 'outcome' && <label className="flex gap-2"><input type="checkbox" checked={Boolean(rule.absent)} onChange={(e) => updateRule(i, { absent: e.target.checked })} />Условие отсутствия (кода нет / предметов меньше указанного)</label>}
                <button type="button" className={buttonClass} onClick={() => updateVariant({ conditions: { ...variant.conditions, rules: variant.conditions.rules.filter((_, n) => n !== i) } })}>Удалить условие</button>
              </div>
            })}
            <button type="button" className={buttonClass} onClick={() => updateVariant({ conditions: { mode: 'all', ...variant.conditions, rules: [...(variant.conditions?.rules || []), { type: 'item', itemId: items[0]?.id || '', quantity: 1, category: 'main' }] } })}>Добавить условие</button>
            <p className="font-medium">Потратить при назначении</p><Quantities items={items} value={variant.consumeItems} onChange={(consumeItems) => updateVariant({ consumeItems })} />
            <p className="font-medium">Полное задание выбранного пути</p>
            <Field label="Скопировать содержимое существующего задания"><select className={inputClass} value="" onChange={(e) => {
              const source = tasks[Number(e.target.value)]
              const { variants: _variants, variantConfig: _config, stageKey: _key, _id, id: _draftId, outcomeRewards: _rewards, ...copy } = source
              updateVariant({ content: structuredClone(copy) })
            }}><option value="">Выберите задание для копирования</option>{tasks.map((source, i) => <option key={i} value={i}>{i + 1}. {source.title}</option>)}</select></Field>
            <Field label="Название задания"><input className={inputClass} value={content.title || ''} onChange={(e) => updateContent({ title: e.target.value })} /></Field>
            <Field label="Текст задания"><textarea className={inputClass} rows={5} value={content.task || ''} onChange={(e) => updateContent({ task: e.target.value })} /></Field>
            <details><summary>Форматированный текст и медиа</summary><RichEditor taskTheme={normalizeTaskTheme(game?.taskTheme)} value={content.taskRich || ''} disabled={disabled} directory={`games/${game.id}/variants/${variant.id}`} onChange={({ html, plainText, media }) => updateContent({ taskRich: html, task: plainText, taskMedia: media })} /></details>
            <Field label="Основные коды (по одному на строку)"><textarea className={inputClass} value={(content.codes || []).join('\n')} onChange={(e) => updateContent({ codes: e.target.value.split('\n') })} /></Field>
            <Field label="Кодов для завершения (пусто — все)"><input className={inputClass} type="number" min="1" value={content.numCodesToCompliteTask ?? ''} onChange={(e) => updateContent({ numCodesToCompliteTask: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="Подсказки (по одной на строку)"><textarea className={inputClass} value={(content.clues || []).map((clue) => clue.clue).join('\n')} onChange={(e) => updateContent({ clues: e.target.value.split('\n').map((clue) => ({ clue })) })} /></Field>
            {['bonus', 'penalty'].map((category) => { const key = category === 'bonus' ? 'bonusCodes' : 'penaltyCodes'; return <details key={key}><summary>{category === 'bonus' ? 'Бонусные' : 'Штрафные'} коды</summary>{(content[key] || []).map((code, i) => <div key={i} className="my-2 flex gap-2"><input aria-label="Код" className={inputClass} value={code.code} onChange={(e) => updateContent({ [key]: content[key].map((v, n) => n === i ? { ...v, code: e.target.value } : v) })} /><input aria-label="Секунды" type="number" min="0" className={inputClass} value={code[category] || 0} onChange={(e) => updateContent({ [key]: content[key].map((v, n) => n === i ? { ...v, [category]: Number(e.target.value) } : v) })} /><button type="button" className={buttonClass} onClick={() => updateContent({ [key]: content[key].filter((_, n) => n !== i) })}>Убрать</button></div>)}<button type="button" className={buttonClass} onClick={() => updateContent({ [key]: [...(content[key] || []), { code: '', [category]: 0 }] })}>Добавить код</button></details> })}
            <Field label="Сообщение после задания"><textarea className={inputClass} value={content.postMessage || ''} onChange={(e) => updateContent({ postMessage: e.target.value })} /></Field>
            <details><summary>Форматированное сообщение после задания</summary><RichEditor taskTheme={normalizeTaskTheme(game?.taskTheme)} value={content.postMessageRich || ''} disabled={disabled} directory={`games/${game.id}/variants/${variant.id}/post`} onChange={({ html, plainText, media }) => updateContent({ postMessageRich: html, postMessage: plainText, postMessageMedia: media })} /></details>
            <Field label="Бонус за выполнение, секунд"><input type="number" min="0" className={inputClass} value={content.taskBonusForComplite || 0} onChange={(e) => updateContent({ taskBonusForComplite: Number(e.target.value) })} /></Field>
            <details><summary>Координаты и агенты</summary><div className="space-y-2">{[['latitude', 'Широта'], ['longitude', 'Долгота'], ['radius', 'Радиус, м']].map(([key, label]) => <Field key={key} label={label}><input type="number" step="any" className={inputClass} value={content.coordinates?.[key] ?? ''} onChange={(e) => updateContent({ coordinates: { ...content.coordinates, [key]: e.target.value === '' ? null : Number(e.target.value) } })} /></Field>)}{agents.map((agent) => <label key={agent.userId} className="flex gap-2"><input type="checkbox" checked={(content.agentUserIds || []).includes(agent.userId)} onChange={(e) => updateContent({ agentUserIds: e.target.checked ? [...(content.agentUserIds || []), agent.userId] : (content.agentUserIds || []).filter((value) => value !== agent.userId) })} />{agent.name || 'Агент'}</label>)}</div></details>
          </>}
        </>}
        <details><summary>Предметы за исход выбранного задания</summary><Rewards content={content.itemRewards} items={items} onChange={(itemRewards) => updateContent({ itemRewards })} /></details>
        <details><summary>Предметы за коды выбранного задания</summary>{Object.keys(categories).flatMap((category) => codesFor(content, category).filter(Boolean).map((code) => {
          const rewards = content.itemRewards || {}
          const reward = rewards.codes?.find((r) => r.category === category && r.code === code)
          return <details key={`${category}:${code}`}><summary>{categories[category]}: {code}</summary><Quantities items={items} value={reward?.items} onChange={(value) => updateContent({ itemRewards: { ...rewards, codes: [...(rewards.codes || []).filter((r) => r.category !== category || r.code !== code), { category, code, items: value }] } })} /></details>
        }))}</details>
        <details><summary>Общие награды исхода этапа, в том числе без выбора</summary><Rewards outcomesOnly content={task.outcomeRewards} items={items} onChange={(outcomeRewards) => updateTask({ outcomeRewards })} /></details>
        <details><summary>Проверка доступности</summary><Quantities items={items} value={simulation} onChange={setSimulation} />
          {tasks.slice(0, stageIndex).map((previous, index) => {
            const key = classicStageId(previous, index)
            const state = simulationStages[key] || {}
            const patch = (value) => setSimulationStages((current) => ({ ...current, [key]: { ...current[key], ...value } }))
            const source = state.selectedVariantId === 'default' ? previous : previous.variants?.find((v) => v.id === state.selectedVariantId)?.content
            return <details key={key}><summary>{index + 1}. {previous.title}</summary>
              <select aria-label="Вариант в примере" className={inputClass} value={state.selectedVariantId || ''} onChange={(e) => patch({ selectedVariantId: e.target.value, main: [], bonus: [], penalty: [] })}><option value="">Не выбран</option><option value="default">Обычное задание</option>{(previous.variants || []).map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}</select>
              <select aria-label="Исход в примере" className={inputClass} value={state.outcome || ''} onChange={(e) => patch({ outcome: e.target.value })}><option value="">Не завершён</option>{Object.entries(outcomes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              {source && Object.entries(categories).flatMap(([category, label]) => codesFor(source, category).filter(Boolean).map((code) => <label className="flex gap-2" key={`${category}:${code}`}><input type="checkbox" checked={(state[category] || []).includes(code)} onChange={(e) => patch({ [category]: e.target.checked ? [...(state[category] || []), code] : (state[category] || []).filter((value) => value !== code) })} />{label}: {code}</label>))}
            </details>
          })}
          <p>Доступны: {getClassicVariantChoices(game, {
            classicProgress: { inventory: simulation, stages: Object.entries(simulationStages).map(([stageId, state]) => ({ stageId, ...state })) },
            ...Object.fromEntries([['main', 'findedCodes'], ['bonus', 'findedBonusCodes'], ['penalty', 'findedPenaltyCodes']].map(([category, key]) => [key, tasks.map((task, i) => simulationStages[classicStageId(task, i)]?.[category] || [])])),
          }, stageIndex).map((v) => v.title).join(', ')}</p>
        </details>
      </>}
      {errors.length > 0 && <ul className="text-sm text-amber-700 dark:text-amber-300">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
    </fieldset>
  </details>
}
ClassicVariantsEditor.propTypes = { game: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired, disabled: PropTypes.bool, agents: PropTypes.array }
