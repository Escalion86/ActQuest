import { useState } from 'react'
import PropTypes from 'prop-types'
import { classicStageId, getClassicVariantChoices } from '@helpers/classicVariants'
import { explainClassicVariant, normalizeClassicItemQuantities } from '@helpers/classicVariantEditor'
import Quantities, { classicInputClass as inputClass } from './ClassicItemQuantities'
import { Field, outcomes, categories, codesFor } from './ClassicVariantFields'

export default function ClassicVariantSimulation({ game, stageIndex }) {
  const [inventory, setInventory] = useState([])
  const [stages, setStages] = useState({})
  const task = game.tasks[stageIndex]
  const items = game.classicItems || []
  const team = {
    classicProgress: { inventory: normalizeClassicItemQuantities(inventory, items), stages: Object.entries(stages).map(([stageId, state]) => ({ stageId, ...state })) },
    ...Object.fromEntries([['main', 'findedCodes'], ['bonus', 'findedBonusCodes'], ['penalty', 'findedPenaltyCodes']].map(([category, key]) => [key, game.tasks.map((entry, i) => stages[classicStageId(entry, i)]?.[category] || [])])),
  }
  const choices = getClassicVariantChoices(game, team, stageIndex)
  return <details className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><summary className="cursor-pointer font-semibold">Проверить, какое задание получит команда</summary><div className="mt-3 space-y-3">
    <p className="text-sm">Задайте пример состояния команды. Эти данные не сохраняются в игру.</p>
    <p className="text-sm font-medium">Предметы у команды</p><Quantities items={items} value={normalizeClassicItemQuantities(inventory, items)} onChange={setInventory} />
    {game.tasks.slice(0, stageIndex).map((previous, index) => {
      const key = classicStageId(previous, index); const state = stages[key] || {}
      const patch = (value) => setStages((current) => ({ ...current, [key]: { ...current[key], ...value } }))
      const source = state.selectedVariantId === 'default' ? previous : previous.variants?.find((entry) => entry.id === state.selectedVariantId)?.content
      return <details key={key}><summary className="cursor-pointer">{index + 1}. {previous.title}</summary><div className="mt-2 space-y-2">
        <Field label="Пройденный вариант"><select className={inputClass} value={state.selectedVariantId || ''} onChange={(event) => patch({ selectedVariantId: event.target.value, main: [], bonus: [], penalty: [] })}><option value="">Не выбран</option><option value="default">Основное задание</option>{(previous.variants || []).map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}</select></Field>
        <Field label="Исход этапа"><select className={inputClass} value={state.outcome || ''} onChange={(event) => patch({ outcome: event.target.value })}><option value="">Не завершён</option>{Object.entries(outcomes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        {source && Object.entries(categories).flatMap(([category, label]) => codesFor(source, category).filter(Boolean).map((code) => <label className="flex gap-2 text-sm" key={`${category}:${code}`}><input type="checkbox" checked={(state[category] || []).includes(code)} onChange={(event) => patch({ [category]: event.target.checked ? [...(state[category] || []), code] : (state[category] || []).filter((value) => value !== code) })} />{label}: {code}</label>))}
      </div></details>
    })}
    <div aria-live="polite" className="space-y-2 rounded-xl bg-white p-3 text-sm dark:bg-slate-900">
      <p className="font-semibold">{task.variantConfig.mode === 'captain' && choices.length > 1 ? 'Капитан выберет из: ' : 'Будет назначен: '}{(task.variantConfig.mode === 'captain' ? choices : choices.slice(0, 1)).map((entry) => entry.id === 'default' ? task.variantConfig.title || 'Основное задание' : entry.title).join(', ')}</p>
      {(task.variants || []).map((entry) => { const reasons = explainClassicVariant(game, team, stageIndex, entry); return <p key={entry.id}>{entry.title}: {reasons.length ? reasons.join('; ') : 'условия выполнены, предметов для расхода хватает'}</p> })}
    </div>
  </div></details>
}
ClassicVariantSimulation.propTypes = { game: PropTypes.object.isRequired, stageIndex: PropTypes.number.isRequired }
