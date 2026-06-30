import { useMemo, useState } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import ModalSection from '@components/modals/ModalSection'
import {
  formatTaskDistributionTemplate,
  moveTaskInDistributionTemplate,
  normalizeStoredTaskDistributionTemplate,
  normalizeTaskDistributionMode,
  removeTaskFromDistributionTemplate,
  validateTaskDistributionTemplate,
} from '@helpers/taskDistribution'

const buildDefaultTemplate = (tasksCount) =>
  tasksCount > 0 ? [Array.from({ length: tasksCount }, (_, index) => index)] : []

const TaskDistributionSection = ({
  selectedGame,
  updateSelectedGame,
  disabled,
}) => {
  const [isConstructorOpen, setIsConstructorOpen] = useState(false)
  const [draggedTaskIndex, setDraggedTaskIndex] = useState(null)
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
  const assignedTaskIndexes = useMemo(
    () => new Set(effectiveTemplate.flat()),
    [effectiveTemplate],
  )
  const unassignedTaskOptions = taskOptions.filter(
    (task) => !assignedTaskIndexes.has(task.taskIndex),
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
      moveTaskInDistributionTemplate({
        template: effectiveTemplate,
        taskIndex,
        toBlockIndex: blockIndex,
      }),
    )
  }

  const handleRemoveTask = (taskIndex) => {
    updateTemplate(removeTaskFromDistributionTemplate(effectiveTemplate, taskIndex))
  }

  const handleDropTask = ({ taskIndex, blockIndex, beforeTaskIndex = null }) => {
    if (!Number.isInteger(taskIndex)) return

    const blockWithoutDraggedTask = (effectiveTemplate[blockIndex] || []).filter(
      (item) => item !== taskIndex,
    )
    const toItemIndex =
      beforeTaskIndex === null
        ? null
        : blockWithoutDraggedTask.indexOf(beforeTaskIndex)

    updateTemplate(
      moveTaskInDistributionTemplate({
        template: effectiveTemplate,
        taskIndex,
        toBlockIndex: blockIndex,
        toItemIndex: toItemIndex >= 0 ? toItemIndex : null,
      }),
    )
    setDraggedTaskIndex(null)
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
                onDragOver={(event) => {
                  if (draggedTaskIndex !== null) event.preventDefault()
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  handleDropTask({
                    taskIndex: draggedTaskIndex,
                    blockIndex,
                  })
                }}
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
                      draggable={!disabled}
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-2 py-1 text-sm text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      onDragStart={() => setDraggedTaskIndex(taskIndex)}
                      onDragEnd={() => setDraggedTaskIndex(null)}
                      onDragOver={(event) => {
                        if (draggedTaskIndex !== null) event.preventDefault()
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        handleDropTask({
                          taskIndex: draggedTaskIndex,
                          blockIndex,
                          beforeTaskIndex: taskIndex,
                        })
                      }}
                    >
                      <span>
                        {taskOptions.find((item) => item.taskIndex === taskIndex)
                          ?.label || `Задание ${taskIndex + 1}`}
                      </span>
                      <button
                        type="button"
                        className="rounded-full px-1 text-xs font-bold text-slate-500 hover:bg-white hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-rose-300"
                        onClick={() => handleRemoveTask(taskIndex)}
                        disabled={disabled}
                        aria-label={`Убрать задание ${taskIndex + 1} из блока`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                {unassignedTaskOptions.length > 0 ? (
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
                    {unassignedTaskOptions.map((task) => (
                      <option key={task.taskIndex} value={task.taskIndex}>
                        {task.label}
                      </option>
                    ))}
                  </select>
                ) : null}
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
