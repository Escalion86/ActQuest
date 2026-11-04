import PropTypes from 'prop-types'
import NeonCheckbox from '@components/NeonCheckbox'
import { getTaskClueCoverage } from '@helpers/taskTiming'

export default function TaskClueCoverage({ game, task, disabled = false, onChange }) {
  const { requiredCount, actualCount, isIncomplete, allowIncomplete } = getTaskClueCoverage(game, task)
  return <div className="mt-4 space-y-2">
    <NeonCheckbox
      id={`task-incomplete-clues-${task.id}`}
      checked={allowIncomplete}
      disabled={disabled}
      ariaLabel="Разрешить неполный набор подсказок"
      label="Разрешить неполный набор подсказок"
      description="Не проверять, хватает ли подсказок на всё время этого задания при запуске игры."
      labelClassName="text-sm text-slate-700 dark:text-slate-200"
      onChange={(event) => onChange(event.target.checked)}
    />
    {isIncomplete && !allowIncomplete && !task.canceled && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
      Задание недозаполнено: добавлено {actualCount} из {requiredCount} подсказок для всего времени задания. Добавьте подсказки или включите «Разрешить неполный набор подсказок», чтобы пройти проверку перед запуском игры.
    </p>}
  </div>
}

TaskClueCoverage.propTypes = {
  game: PropTypes.shape({ type: PropTypes.string, taskDuration: PropTypes.number, cluesDuration: PropTypes.number, clueIntervals: PropTypes.arrayOf(PropTypes.number) }).isRequired,
  task: PropTypes.shape({ id: PropTypes.string.isRequired, clues: PropTypes.array, taskDuration: PropTypes.number, clueIntervals: PropTypes.arrayOf(PropTypes.number), allowIncompleteClues: PropTypes.bool, canceled: PropTypes.bool }).isRequired,
  disabled: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
}
