import { useMemo, useState } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import ModalSection from '@components/modals/ModalSection'
import {
  formatTaskDistributionTemplate,
  normalizeStoredTaskDistributionTemplate,
  normalizeTaskDistributionMode,
  validateTaskDistributionTemplate,
} from '@helpers/taskDistribution'

const buildDefaultTemplate = (tasksCount) =>
  tasksCount > 0 ? [Array.from({ length: tasksCount }, (_, index) => index)] : []

const moveTaskToBlock = ({ template, taskIndex, blockIndex }) => {
  const nextTemplate = template
    .map((block) => block.filter((item) => item !== taskIndex))
    .filter((block) => block.length > 0)

  while (nextTemplate.length <= blockIndex) {
    nextTemplate.push([])
  }

  nextTemplate[blockIndex] = [...nextTemplate[blockIndex], taskIndex]
  return nextTemplate.filter((block) => block.length > 0)
}

const TaskDistributionSection = ({
  selectedGame,
  updateSelectedGame,
  disabled,
}) => {
  const [isConstructorOpen, setIsConstructorOpen] = useState(false)
  const tasks = Array.isArray(selectedGame?.tasks) ? selectedGame.tasks : []
  const tasksCount = tasks.length
  const mode = normalizeTaskDistributionMode(selectedGame?.taskDistributionMode)
  const template = normalizeStoredTaskDistributionTemplate(
    selectedGame?.taskDistributionTemplate,
    tasksCount,
  )
  const effectiveTemplate =
    template.length > 0 ? template : buildDefaultTemplate(tasksCount)
  const validation = validateTaskDistributionTemplate(
    effectiveTemplate,
    tasksCount,
  )
  const preview = formatTaskDistributionTemplate(effectiveTemplate)

  const taskOptions = useMemo(
    () =>
      tasks.map((task, index) => ({
        taskIndex: index,
        label: `${index + 1}. ${String(task?.title || '').trim() || 'Без названия'}`,
      })),
    [tasks],
  )

  const updateTemplate = (nextTemplate) => {
    updateSelectedGame({
      taskDistributionTemplate: normalizeStoredTaskDistributionTemplate(
        nextTemplate,
        tasksCount,
      ),
    })
  }

  const handleModeChange = (event) => {
    const nextMode = event.target.value === 'random' ? 'random' : 'linear'
    updateSelectedGame({
      taskDistributionMode: nextMode,
      taskDistributionTemplate:
        nextMode === 'random' ? effectiveTemplate : [],
    })
  }

  const handleMoveTask = (taskIndex, blockIndex) => {
    updateTemplate(
      moveTaskToBlock({
        template: effectiveTemplate,
        taskIndex,
        blockIndex,
      }),
    )
  }

  const handleAddBlock = () => {
    updateTemplate([...effectiveTemplate, []])
  }

  const handleRemoveBlock = (blockIndex) => {
    const nextTemplate = effectiveTemplate.filter((_, index) => index !== blockIndex)
    updateTemplate(nextTemplate.length > 0 ? nextTemplate : buildDefaultTemplate(tasksCount))
  }

  return (
    <ModalSection>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            Распределение заданий
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            Конструкция блоков: [1,2,3],[4,5],6,[7,8].
          </p>
        </div>
        <select
          value={mode}
          onChange={handleModeChange}
          disabled={disabled}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
        >
          <option value="linear">Линейное</option>
          <option value="random">Случайное</option>
        </select>
      </div>

      {mode === 'random' ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 font-mono text-sm text-cyan-900 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-100">
            {preview || 'Шаблон не задан'}
          </div>
          {!validation.valid ? (
            <p className="text-sm text-rose-600 dark:text-rose-300">
              {validation.messages[0]}
            </p>
          ) : null}
          <button
            type="button"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-cyan-500 dark:hover:text-cyan-200"
            onClick={() => setIsConstructorOpen(true)}
            disabled={disabled || tasksCount === 0}
          >
            Конструктор блоков
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">
          Команды получают задания в порядке редактора.
        </p>
      )}

      <Modal
        isOpen={isConstructorOpen}
        onClose={() => setIsConstructorOpen(false)}
        title="Конструктор распределения"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
            {preview}
          </div>

          <div className="space-y-3">
            {effectiveTemplate.map((block, blockIndex) => (
              <div
                key={`task-distribution-block-${blockIndex}`}
                className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                    Блок {blockIndex + 1}
                  </p>
                  {effectiveTemplate.length > 1 ? (
                    <button
                      type="button"
                      className="text-xs font-semibold text-rose-600 hover:text-rose-500 dark:text-rose-300"
                      onClick={() => handleRemoveBlock(blockIndex)}
                      disabled={disabled}
                    >
                      Удалить
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {block.map((taskIndex) => (
                    <span
                      key={taskIndex}
                      className="rounded-lg bg-slate-100 px-2 py-1 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {taskOptions.find((item) => item.taskIndex === taskIndex)
                        ?.label || `Задание ${taskIndex + 1}`}
                    </span>
                  ))}
                </div>

                <select
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                  value=""
                  onChange={(event) => {
                    const taskIndex = Number(event.target.value)
                    if (Number.isInteger(taskIndex)) {
                      handleMoveTask(taskIndex, blockIndex)
                    }
                  }}
                  disabled={disabled}
                >
                  <option value="">Добавить задание в этот блок</option>
                  {taskOptions.map((task) => (
                    <option key={task.taskIndex} value={task.taskIndex}>
                      {task.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-cyan-500 dark:hover:text-cyan-200"
            onClick={handleAddBlock}
            disabled={disabled}
          >
            Добавить блок
          </button>
        </div>
      </Modal>
    </ModalSection>
  )
}

TaskDistributionSection.propTypes = {
  selectedGame: PropTypes.object,
  updateSelectedGame: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
}

TaskDistributionSection.defaultProps = {
  selectedGame: null,
  disabled: false,
}

export default TaskDistributionSection
