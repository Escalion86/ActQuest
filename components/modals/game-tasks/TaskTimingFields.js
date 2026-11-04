import { useId } from 'react'
import PropTypes from 'prop-types'
import CabinetDurationField from '@components/cabinet/CabinetDurationField'
import { getTaskDurationSeconds, getClueTimesSeconds } from '@helpers/taskTiming'

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white'

export function ClueScheduleFields({ value, defaultInterval = 1200, onChange, disabled = false, inherit = false, cluesCount = 3 }) {
  const id = useId()
  const mode = value == null ? 'default' : value.length ? 'custom' : 'off'
  const times = getClueTimesSeconds({ type: 'classic', clueIntervals: value, cluesDuration: defaultInterval }, { clues: Array.from({ length: Math.min(cluesCount, 8) }) })
  return <fieldset disabled={disabled} className="min-w-0 space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
    <legend className="px-1 text-sm font-semibold">Расписание подсказок</legend>
    <label htmlFor={id} className="block text-sm">Режим расписания</label>
    <select id={id} className={inputClass} value={mode} onChange={(event) => onChange(event.target.value === 'default' ? null : event.target.value === 'off' ? [] : [defaultInterval > 0 ? defaultInterval : 900])}>
      <option value="default">{inherit ? 'Как в настройках игры' : 'Одинаковый интервал'}</option>
      <option value="custom">Свои интервалы</option><option value="off">Без автоматических подсказок</option>
    </select>
    {mode === 'custom' && <>
      {value.map((seconds, index) => <div key={index} className="flex items-end gap-2">
        <label className="min-w-0 flex-1 text-sm" htmlFor={`${id}-${index}`}>Интервал №{index + 1}, мин.
          <input id={`${id}-${index}`} type="number" min="0" step="any" className={inputClass} value={seconds > 0 ? seconds / 60 : ''} onChange={(event) => onChange(value.map((entry, i) => i === index ? Math.round(Number(event.target.value) * 60) : entry))} />
        </label>
        <button type="button" className="aq-modal-btn aq-modal-btn-secondary" aria-label={`Удалить интервал №${index + 1}`} disabled={value.length === 1} onClick={() => onChange(value.filter((_, i) => i !== index))}>Удалить</button>
      </div>)}
      <button type="button" className="aq-modal-btn aq-modal-btn-secondary" onClick={() => onChange([...value, value.at(-1) || 900])}>Добавить интервал</button>
      <p className="text-xs text-slate-500 dark:text-slate-300">Первый интервал — от старта задания, остальные — от предыдущей подсказки. Последний интервал повторяется для оставшихся подсказок.</p>
    </>}
    {!(inherit && mode === 'default') && <p className="text-xs text-slate-600 dark:text-slate-300">{times.length ? `Выдача от старта: ${times.map((at) => at % 60 === 0 ? `${at / 60} мин.` : `${Math.floor(at / 60)} мин. ${at % 60} сек.`).join(', ')}${cluesCount > 8 ? '…' : ''}` : 'Автоматическая выдача отключена или подсказок нет.'}</p>}
    <p className="text-xs text-slate-500 dark:text-slate-300">Чтобы добавить меньше подсказок, включите «Разрешить неполный набор подсказок» под подсказками нужного задания.</p>
  </fieldset>
}
ClueScheduleFields.propTypes = { value: PropTypes.arrayOf(PropTypes.number), defaultInterval: PropTypes.number, onChange: PropTypes.func.isRequired, disabled: PropTypes.bool, inherit: PropTypes.bool, cluesCount: PropTypes.number }

export default function TaskTimingFields({ game, task, onChange, disabled }) {
  const id = useId()
  const customDuration = task.taskDuration != null
  return <section className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700" aria-label="Время задания и подсказки">
    <h4 className="text-sm font-semibold">Время задания и подсказки</h4>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={disabled} checked={customDuration} onChange={(event) => onChange({ taskDuration: event.target.checked ? getTaskDurationSeconds(game, task) || 3600 : null })} />Своя продолжительность задания</label>
    {customDuration ? <CabinetDurationField id={id} label="Продолжительность этого задания" valueSeconds={task.taskDuration} disabled={disabled} onChangeSeconds={(seconds) => { if (!disabled) onChange({ taskDuration: seconds }) }} /> : <p className="text-xs text-slate-500 dark:text-slate-300">Лимит из настроек игры: {getTaskDurationSeconds(game, task) / 60} мин.</p>}
    <ClueScheduleFields value={task.clueIntervals ?? null} defaultInterval={game.cluesDuration ?? 1200} inherit disabled={disabled} cluesCount={task.clues?.length || 0} onChange={(clueIntervals) => onChange({ clueIntervals })} />
    <p className="text-xs text-slate-500 dark:text-slate-300">Настройки общие для всех вариантов этого задания. Подсказки, назначенные после лимита, не успеют открыться.</p>
  </section>
}
TaskTimingFields.propTypes = { game: PropTypes.shape({ type: PropTypes.string, taskDuration: PropTypes.number, cluesDuration: PropTypes.number, clueIntervals: PropTypes.arrayOf(PropTypes.number) }).isRequired, task: PropTypes.shape({ taskDuration: PropTypes.number, clueIntervals: PropTypes.arrayOf(PropTypes.number), clues: PropTypes.array }).isRequired, onChange: PropTypes.func.isRequired, disabled: PropTypes.bool }
