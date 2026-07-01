import { memo, useState, useRef, useCallback } from 'react'
import PropTypes from 'prop-types'
import dynamic from 'next/dynamic'

import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetInputField from '@components/cabinet/CabinetInputField'
import CabinetNumberField from '@components/cabinet/CabinetNumberField'
import CabinetDurationField from '@components/cabinet/CabinetDurationField'
import CabinetTextareaField from '@components/cabinet/CabinetTextareaField'
import ImagesInput from '@components/cabinet/ImagesInput'
import NeonCheckbox from '@components/NeonCheckbox'
import ModalSection from '@components/modals/ModalSection'
import {
  stripHtmlToPlainText,
  normalizeComparableEditorPlainText,
  normalizeComparableRichText,
  areComparableMediaListsEqual,
  hasMeaningfulRichMarkup,
  compactSingleLine,
  truncateWithDots,
  normalizeCodeDuplicateKey,
  formatCodeItemsCount,
  hasCoordinateValue,
  getTaskDescriptionText,
  getClueText,
} from '@components/modals/game-edit/sharedHelpers'
import {
  CodePhotoBadgeIcon,
  TaskWarningIcon,
  AccordionChevronIcon,
} from '@components/modals/game-edit/sharedIcons'

const TaskRichEditor = dynamic(
  () => import('@components/cabinet/TaskRichEditor'),
  { ssr: false },
)

const fieldLabelClassName =
  'text-sm font-semibold text-slate-700 dark:text-white'
const fieldInputClassName =
  'w-full px-4 py-3 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none'
const compactLabelClassName =
  'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-200'
const compactInputClassName =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white'

const requiredMark = (
  <span className="ml-1 text-rose-500" aria-hidden="true">
    *
  </span>
)
const withRequiredMark = (label) => (
  <>
    {label}
    {requiredMark}
  </>
)

const TaskItem = ({
  task,
  index,
  isExpanded,
  toggleTaskExpansion,
  isTaskOrderLocked,
  canEditSelectedGame,
  isSaving,
  selectedGame,
  selectedGameAgents,
  canViewCodePhotos,
  isPhotoGame,
  draggedTaskId,
  dragOverTaskId,
  setDraggedTaskId,
  setDragOverTaskId,
  draggedClueMeta,
  dragOverClueMeta,
  setDraggedClueMeta,
  setDragOverClueMeta,
  dragGhostPosition,
  setDragGhostPosition,
  dragClueGhostPosition,
  setDragClueGhostPosition,
  handleTaskFieldChange,
  handleTaskNumberChange,
  handleTaskOptionalNumberChange,
  handleTaskCheckboxChange,
  handleTaskCoordinateChange,
  handleAddTaskCode,
  handleTaskCodeChange,
  handleTaskCodePhotoChange,
  handleRemoveTaskCode,
  handleAddClue,
  handleReorderClue,
  handleTaskClueChange,
  handleRemoveClue,
  handleAddSubTask,
  handleSubTaskChange,
  handleRemoveSubTask,
  handleAddPenaltyCode,
  handlePenaltyCodeChange,
  handleRemovePenaltyCode,
  handleAddBonusCode,
  handleBonusCodeChange,
  handleRemoveBonusCode,
  handleReorderTask,
  handleSaveAndOpenTaskPreview,
  handleRemoveTask,
  handleTaskHandlePointerDown,
  handleTaskHandlePointerMove,
  handleTaskHandlePointerUp,
  resetTouchTaskDragState,
  handleClueHandlePointerDown,
  handleClueHandlePointerMove,
  handleClueHandlePointerUp,
  resetTouchClueDragState,
  expandedCodeAccordions,
  setExpandedCodeAccordions,
  expandedClueAccordions,
  setExpandedClueAccordions,
  selectedCodePhoto,
  setSelectedCodePhoto,
}) => {
  const canDragTask = canEditSelectedGame && !isSaving && !isTaskOrderLocked
  const isDragOver = dragOverTaskId === task.id
  const isDraggingCurrent = draggedTaskId === task.id
  const taskTitle = typeof task?.title === 'string' ? task.title.trim() : ''
  const taskDescription = getTaskDescriptionText(task).trim()
  const hasTaskMedia =
    Array.isArray(task?.taskMedia) &&
    task.taskMedia.some((item) => {
      if (!item || typeof item !== 'object') return false
      const type = typeof item.type === 'string' ? item.type.trim() : ''
      const url = typeof item.url === 'string' ? item.url.trim() : ''
      const path = typeof item.path === 'string' ? item.path.trim() : ''
      return Boolean(type && (url || path))
    })
  const hasTaskDescription =
    taskDescription !== '' ||
    hasMeaningfulRichMarkup(task?.taskRich) ||
    hasTaskMedia
  const taskClues = Array.isArray(task?.clues) ? task.clues : []
  const hasFilledClue = taskClues.some(
    (clue) =>
      getClueText(clue).trim() !== '' ||
      hasMeaningfulRichMarkup(clue?.clueRich),
  )
  const normalizedCodes = (Array.isArray(task?.codes) ? task.codes : [])
    .map((codeValue) => (typeof codeValue === 'string' ? codeValue.trim() : ''))
    .filter(Boolean)
  const codeDuplicateCounts = normalizedCodes.reduce((acc, codeValue) => {
    const key = normalizeCodeDuplicateKey(codeValue)
    if (!key) return acc
    acc.set(key, (acc.get(key) || 0) + 1)
    return acc
  }, new Map())
  const duplicateCodeKeys = new Set(
    Array.from(codeDuplicateCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([key]) => key),
  )
  const rawRequiredCodes = task?.numCodesToCompliteTask
  const requiredCodesCount =
    rawRequiredCodes === null ||
    rawRequiredCodes === undefined ||
    rawRequiredCodes === ''
      ? null
      : Number(rawRequiredCodes)
  const hasCodesOverflowError =
    !isPhotoGame &&
    requiredCodesCount !== null &&
    Number.isFinite(requiredCodesCount) &&
    requiredCodesCount > normalizedCodes.length
  const hasPostTaskMessage =
    (typeof task?.postMessage === 'string' && task.postMessage.trim() !== '') ||
    stripHtmlToPlainText(task?.postMessageRich).trim() !== '' ||
    hasMeaningfulRichMarkup(task?.postMessageRich) ||
    (Array.isArray(task?.postMessageMedia) && task.postMessageMedia.length > 0)
  const hasTaskCoordinates =
    hasCoordinateValue(task?.coordinates?.latitude) &&
    hasCoordinateValue(task?.coordinates?.longitude)
  const hasTaskValidationErrors =
    !taskTitle ||
    !hasTaskDescription ||
    taskClues.length === 0 ||
    !hasFilledClue ||
    (!isPhotoGame && normalizedCodes.length === 0) ||
    hasCodesOverflowError
  const taskBadgeLabel = task.isBonusTask
    ? `${index + 1} Бонусное задание`
    : `${index + 1} Задание`

  return (
    <div
      key={task.id}
      data-task-dnd-id={String(task.id)}
      className={`overflow-hidden rounded-2xl border bg-white transition dark:bg-slate-900/70 ${
        isDraggingCurrent
          ? 'border-cyan-500/80 opacity-85 ring-2 ring-cyan-400/30 dark:border-cyan-400 dark:ring-cyan-300/30'
          : ''
      } ${
        isDragOver
          ? 'border-cyan-500 ring-1 ring-cyan-500/40 dark:border-cyan-400 dark:ring-cyan-400/40'
          : 'border-slate-200 dark:border-slate-700'
      }`}
      onDragEnd={() => {
        setDraggedTaskId(null)
        setDragOverTaskId(null)
      }}
      onDragOver={(event) => {
        if (!draggedTaskId || draggedTaskId === task.id || isTaskOrderLocked) {
          return
        }
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setDragOverTaskId(task.id)
      }}
      onDragLeave={() => {
        if (dragOverTaskId === task.id) {
          setDragOverTaskId(null)
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        const sourceTaskId =
          draggedTaskId ||
          String(event.dataTransfer.getData('text/plain') || '')
        setDragOverTaskId(null)
        setDraggedTaskId(null)
        if (!sourceTaskId || sourceTaskId === task.id) return
        const sourceIndex = (selectedGame.tasks || []).findIndex(
          (item) => item.id === sourceTaskId,
        )
        const targetIndex = (selectedGame.tasks || []).findIndex(
          (item) => item.id === task.id,
        )
        if (sourceIndex < 0 || targetIndex < 0) return
        handleReorderTask(sourceIndex, targetIndex)
      }}
    >
      <div className="flex items-stretch w-full bg-slate-50 dark:bg-slate-800/70">
        <button
          type="button"
          draggable={canDragTask}
          onPointerDown={(event) =>
            handleTaskHandlePointerDown(task.id, canDragTask, event)
          }
          onPointerMove={handleTaskHandlePointerMove}
          onPointerUp={handleTaskHandlePointerUp}
          onPointerCancel={resetTouchTaskDragState}
          onLostPointerCapture={resetTouchTaskDragState}
          onDragStart={(event) => {
            if (!canDragTask) {
              event.preventDefault()
              return
            }
            setDraggedTaskId(task.id)
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', String(task.id))
          }}
          className={`inline-flex min-h-full w-9 shrink-0 items-center justify-center border-r text-slate-500 touch-none transition-colors dark:text-slate-300 sm:w-10 ${
            isTaskOrderLocked
              ? 'cursor-not-allowed border-amber-500/40 bg-amber-500/10'
              : canDragTask
                ? isDraggingCurrent
                  ? 'cursor-grabbing border-cyan-400/70 bg-cyan-50/80 text-cyan-700 dark:border-cyan-400/70 dark:bg-cyan-500/10 dark:text-cyan-200'
                  : 'cursor-grab border-slate-200 bg-white/80 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-900/70'
                : 'cursor-default border-slate-200/80 bg-white/60 dark:border-slate-700/80 dark:bg-slate-900/50'
          }`}
          title={
            isTaskOrderLocked
              ? 'Порядок этого задания заблокирован'
              : 'Перетащите за эту область, чтобы изменить порядок'
          }
          aria-label={
            isTaskOrderLocked
              ? 'Порядок задания заблокирован'
              : 'Перетащить задание'
          }
        >
          {isTaskOrderLocked ? (
            <svg viewBox="0 0 20 20" className="w-5 h-5">
              <path
                d="M6.5 8V6.8a3.5 3.5 0 1 1 7 0V8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              <rect
                x="5.3"
                y="8"
                width="9.4"
                height="7.2"
                rx="1.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" className="w-5 h-5">
              <circle cx="7" cy="6" r="1.2" fill="currentColor" />
              <circle cx="13" cy="6" r="1.2" fill="currentColor" />
              <circle cx="7" cy="10" r="1.2" fill="currentColor" />
              <circle cx="13" cy="10" r="1.2" fill="currentColor" />
              <circle cx="7" cy="14" r="1.2" fill="currentColor" />
              <circle cx="13" cy="14" r="1.2" fill="currentColor" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={() => toggleTaskExpansion(task.id)}
          className={`relative flex items-center justify-between flex-1 min-w-0 gap-3 px-4 py-3 overflow-hidden text-sm font-semibold text-left transition dark:text-white ${
            task.canceled
              ? 'bg-rose-50/80 text-rose-800 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/15'
              : 'text-slate-700 hover:bg-blue-50 dark:hover:bg-sky-500/10'
          }`}
        >
          <div
            className={`absolute top-0 left-0 shrink-0 rounded-br-full border-b border-r px-3 py-0 text-[11px] font-semibold ${
              task.isBonusTask
                ? 'border-violet-300/70 bg-violet-100/80 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-200'
                : 'border-cyan-300/70 bg-cyan-100/70 text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200'
            }`}
          >
            {taskBadgeLabel}
          </div>
          <div className="min-w-0 pt-2">
            <p>{task.title || 'Без названия'}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-200">
              <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
                {task.canceled ? <span>Отменено</span> : null}
                <span>Коды:</span>
                {normalizedCodes.length > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    {requiredCodesCount !== null &&
                    Number.isFinite(requiredCodesCount) &&
                    requiredCodesCount > 0 ? (
                      <span className="font-semibold text-slate-600 dark:text-slate-100">
                        {requiredCodesCount}/
                      </span>
                    ) : null}
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-cyan-300/70 bg-cyan-100/70 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">
                      {normalizedCodes.length}
                    </span>
                  </span>
                ) : !isPhotoGame ? (
                  <TaskWarningIcon title="Основные коды не заполнены" />
                ) : null}
                {(Array.isArray(task.bonusCodes) ? task.bonusCodes.length : 0) >
                0 ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-emerald-300/70 bg-emerald-100/80 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                    {task.bonusCodes.length}
                  </span>
                ) : null}
                {(Array.isArray(task.penaltyCodes)
                  ? task.penaltyCodes.length
                  : 0) > 0 ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-rose-300/70 bg-rose-100/80 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                    {task.penaltyCodes.length}
                  </span>
                ) : null}
                <span>·</span>
                <span>
                  Подсказок: {Array.isArray(task.clues) ? task.clues.length : 0}
                </span>
                {hasPostTaskMessage ? (
                  <>
                    <span>·</span>
                    <span>Сообщение после</span>
                  </>
                ) : null}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasTaskCoordinates ? (
              <span
                className="inline-flex items-center justify-center w-6 h-6 border rounded-full border-cyan-300 bg-cyan-100 text-cyan-700 dark:border-cyan-500/45 dark:bg-cyan-500/15 dark:text-cyan-200"
                title="У задания указаны координаты"
                aria-label="У задания указаны координаты"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                  <path
                    d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="10"
                    r="2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </span>
            ) : null}
            {hasTaskValidationErrors ? (
              <TaskWarningIcon title="В задании есть незаполненные обязательные поля" />
            ) : null}
            <span
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition-transform duration-200 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 ${
                isExpanded ? 'rotate-180' : 'rotate-0'
              }`}
              aria-hidden="true"
            >
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5">
                <path
                  d="M4 7.5l6 6 6-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </button>
      </div>

      {isExpanded && (
        <div className="px-3 py-4 space-y-5 sm:px-4 sm:py-5">
          <div className="space-y-4">
            <div className="flex justify-end">
              <CabinetButton
                type="button"
                variant="secondary"
                onClick={() => handleSaveAndOpenTaskPreview(index)}
                disabled={isSaving}
              >
                Сохранить и открыть предпросмотр
              </CabinetButton>
            </div>
            <div className="flex flex-col gap-2 md:items-start">
              <NeonCheckbox
                id={`task-is-bonus-${task.id}`}
                checked={Boolean(task.isBonusTask)}
                onChange={(eventOrChecked) => {
                  const checked =
                    typeof eventOrChecked === 'boolean'
                      ? eventOrChecked
                      : Boolean(eventOrChecked?.target?.checked)
                  handleTaskCheckboxChange(task.id, 'isBonusTask', checked)
                }}
                label="Бонусное задание"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
              <NeonCheckbox
                id={`task-canceled-${task.id}`}
                checked={Boolean(task.canceled)}
                onChange={(eventOrChecked) => {
                  const checked =
                    typeof eventOrChecked === 'boolean'
                      ? eventOrChecked
                      : Boolean(eventOrChecked?.target?.checked)
                  handleTaskCheckboxChange(task.id, 'canceled', checked)
                }}
                label="Задание отменено"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
            </div>
            <CabinetInputField
              id={`task-title-${task.id}`}
              label={withRequiredMark('Название задания')}
              type="text"
              value={task.title}
              onChange={(event) =>
                handleTaskFieldChange(task.id, 'title', event.target.value)
              }
              labelClassName={fieldLabelClassName}
              inputClassName={fieldInputClassName}
            />
            <div className="space-y-2">
              <p className={fieldLabelClassName}>Агенты задания</p>
              {selectedGameAgents.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {selectedGameAgents.map((agent) => {
                    const checked = (
                      Array.isArray(task.agentUserIds) ? task.agentUserIds : []
                    ).includes(agent.userId)
                    return (
                      <label
                        key={`${task.id}-${agent.userId}`}
                        className="flex items-start gap-2 px-3 py-2 text-sm bg-white border rounded-xl border-slate-200 text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!canEditSelectedGame || isSaving}
                          onChange={(event) => {
                            const current = Array.isArray(task.agentUserIds)
                              ? task.agentUserIds
                              : []
                            const next = event.target.checked
                              ? Array.from(new Set([...current, agent.userId]))
                              : current.filter(
                                  (id) => String(id) !== String(agent.userId),
                                )
                            handleTaskFieldChange(task.id, 'agentUserIds', next)
                          }}
                          className="mt-0.5 rounded border-slate-400 text-cyan-600 focus:ring-cyan-500/40"
                        />
                        <span>
                          <span className="font-semibold">
                            {agent.name || 'Без имени'}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  Сначала добавьте агентов в настройках игры.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className={fieldLabelClassName}>
              {withRequiredMark('Описание задания')}
            </p>
            <TaskRichEditor
              value={task.taskRich || task.task || ''}
              directory={`games/${selectedGame.id || 'draft'}/tasks/${task.id}/editor`}
              contentMaxHeight="none"
              aiInitialGame={{
                id: selectedGame.id || '',
                name: selectedGame.name || '',
                description: selectedGame.description || '',
                dateStart: selectedGame.dateStart || '',
                type: selectedGame.type === 'photo' ? 'photo' : 'classic',
                location: selectedGame.location || '',
              }}
              disabled={!canEditSelectedGame || isSaving}
              placeholder="Введите описание задания. Можно использовать форматирование, картинки и аудио."
              onChange={({ html, plainText, media }) => {
                const nextTaskText =
                  plainText || stripHtmlToPlainText(html || '')
                const nextTaskRich = typeof html === 'string' ? html : ''
                const currentTaskText =
                  typeof task.task === 'string' ? task.task : ''
                const currentTaskRich =
                  typeof task.taskRich === 'string' ? task.taskRich : ''
                const isSameTaskText =
                  normalizeComparableEditorPlainText(nextTaskText) ===
                  normalizeComparableEditorPlainText(currentTaskText)
                const isSameTaskRich =
                  normalizeComparableRichText(nextTaskRich, nextTaskText) ===
                  normalizeComparableRichText(currentTaskRich, currentTaskText)
                const isSameTaskMedia = areComparableMediaListsEqual(
                  media,
                  task.taskMedia,
                )
                if (isSameTaskText && isSameTaskRich && isSameTaskMedia) return
                handleTaskFieldChange(task.id, 'taskRich', nextTaskRich)
                handleTaskFieldChange(task.id, 'task', nextTaskText)
                handleTaskFieldChange(task.id, 'taskMedia', media)
              }}
            />
          </div>

          {/* Clues Section */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-white">
              {withRequiredMark('Подсказки')}
            </h4>
            {task.clues?.length > 0 ? (
              <div className="mt-3 space-y-3">
                {task.clues.map((clue, clueIndex) => (
                  <details
                    key={clue.id}
                    data-clue-dnd-task-id={String(task.id)}
                    data-clue-dnd-id={String(clue.id)}
                    open={expandedClueAccordions.has(
                      `${task.id}-clue-${clue.id}`,
                    )}
                    onToggle={(event) => {
                      const accordionKey = `${task.id}-clue-${clue.id}`
                      const isOpen = Boolean(event.currentTarget?.open)
                      setExpandedClueAccordions((prev) => {
                        const next = new Set(prev)
                        if (isOpen) next.add(accordionKey)
                        else next.delete(accordionKey)
                        return next
                      })
                    }}
                    className={`relative overflow-hidden rounded-2xl border bg-slate-50 p-0 transition dark:bg-slate-800/60 ${
                      dragOverClueMeta &&
                      String(dragOverClueMeta.taskId) === String(task.id) &&
                      String(dragOverClueMeta.clueId) === String(clue.id)
                        ? 'border-cyan-500 ring-1 ring-cyan-500/40 dark:border-cyan-400 dark:ring-cyan-400/40'
                        : draggedClueMeta &&
                            String(draggedClueMeta.taskId) ===
                              String(task.id) &&
                            String(draggedClueMeta.clueId) === String(clue.id)
                          ? 'border-cyan-500/80 opacity-85 ring-2 ring-cyan-400/30 dark:border-cyan-400 dark:ring-cyan-300/30'
                          : 'border-slate-200 dark:border-slate-700'
                    }`}
                    onDragEnd={resetTouchClueDragState}
                    onDragOver={(event) => {
                      if (
                        !draggedClueMeta ||
                        String(draggedClueMeta.taskId) !== String(task.id) ||
                        String(draggedClueMeta.clueId) === String(clue.id)
                      ) {
                        return
                      }
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                      setDragOverClueMeta({
                        taskId: String(task.id),
                        clueId: String(clue.id),
                      })
                    }}
                    onDragLeave={() => {
                      if (
                        dragOverClueMeta &&
                        String(dragOverClueMeta.taskId) === String(task.id) &&
                        String(dragOverClueMeta.clueId) === String(clue.id)
                      ) {
                        setDragOverClueMeta(null)
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      const transfer = String(
                        event.dataTransfer.getData('text/plain') || '',
                      )
                      const [taskIdRaw, clueIdRaw] = transfer.split(':')
                      const sourceTaskId = String(
                        draggedClueMeta?.taskId || taskIdRaw || '',
                      )
                      const sourceClueId = String(
                        draggedClueMeta?.clueId || clueIdRaw || '',
                      )
                      setDragOverClueMeta(null)
                      setDraggedClueMeta(null)
                      if (
                        !sourceTaskId ||
                        !sourceClueId ||
                        String(sourceTaskId) !== String(task.id) ||
                        String(sourceClueId) === String(clue.id)
                      ) {
                        return
                      }
                      const clues = Array.isArray(task?.clues) ? task.clues : []
                      const sourceIndex = clues.findIndex(
                        (item) => String(item?.id) === String(sourceClueId),
                      )
                      const targetIndex = clues.findIndex(
                        (item) => String(item?.id) === String(clue.id),
                      )
                      if (sourceIndex < 0 || targetIndex < 0) return
                      handleReorderClue(
                        String(task.id),
                        sourceIndex,
                        targetIndex,
                      )
                    }}
                  >
                    <summary
                      className={`relative w-full max-w-full min-h-[56px] overflow-hidden text-sm font-medium list-none cursor-pointer text-slate-700 marker:content-none dark:text-slate-100 ${
                        expandedClueAccordions.has(`${task.id}-clue-${clue.id}`)
                          ? 'rounded-t-xl rounded-b-none'
                          : 'rounded-xl'
                      }`}
                    >
                      <button
                        type="button"
                        draggable={
                          canEditSelectedGame &&
                          !isSaving &&
                          task.clues.length > 1
                        }
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                        }}
                        onPointerDown={(event) => {
                          handleClueHandlePointerDown(
                            task.id,
                            clue.id,
                            canEditSelectedGame &&
                              !isSaving &&
                              task.clues.length > 1,
                            event,
                          )
                        }}
                        onPointerMove={handleClueHandlePointerMove}
                        onPointerUp={handleClueHandlePointerUp}
                        onPointerCancel={resetTouchClueDragState}
                        onLostPointerCapture={resetTouchClueDragState}
                        onDragStart={(event) => {
                          const canDragClue =
                            canEditSelectedGame &&
                            !isSaving &&
                            task.clues.length > 1
                          if (!canDragClue) {
                            event.preventDefault()
                            return
                          }
                          event.stopPropagation()
                          setDraggedClueMeta({
                            taskId: String(task.id),
                            clueId: String(clue.id),
                          })
                          event.dataTransfer.effectAllowed = 'move'
                          event.dataTransfer.setData(
                            'text/plain',
                            `${String(task.id)}:${String(clue.id)}`,
                          )
                        }}
                        className={`absolute left-0 top-0 bottom-0 inline-flex w-8 items-center justify-center border-r text-slate-500 touch-none transition-colors dark:text-slate-300 ${
                          canEditSelectedGame &&
                          !isSaving &&
                          task.clues.length > 1
                            ? draggedClueMeta &&
                              String(draggedClueMeta.taskId) ===
                                String(task.id) &&
                              String(draggedClueMeta.clueId) === String(clue.id)
                              ? 'cursor-grabbing border-cyan-400/70 bg-cyan-50/80 text-cyan-700 dark:border-cyan-400/70 dark:bg-cyan-500/10 dark:text-cyan-200'
                              : 'cursor-grab border-slate-200 bg-white/80 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-900/70'
                            : 'cursor-default border-slate-200/80 bg-white/60 dark:border-slate-700/80 dark:bg-slate-900/50'
                        }`}
                        title={
                          task.clues.length > 1
                            ? 'Перетащите за эту область, чтобы изменить порядок подсказок'
                            : 'Для перетаскивания нужно минимум 2 подсказки'
                        }
                        aria-label="Перетащить подсказку"
                      >
                        <svg viewBox="0 0 20 20" className="w-4 h-4">
                          <circle cx="7" cy="6" r="1.1" fill="currentColor" />
                          <circle cx="13" cy="6" r="1.1" fill="currentColor" />
                          <circle cx="7" cy="10" r="1.1" fill="currentColor" />
                          <circle cx="13" cy="10" r="1.1" fill="currentColor" />
                          <circle cx="7" cy="14" r="1.1" fill="currentColor" />
                          <circle cx="13" cy="14" r="1.1" fill="currentColor" />
                        </svg>
                      </button>
                      <div className="absolute top-0 left-8 shrink-0 rounded-br-full border-b border-r border-cyan-300/70 bg-cyan-100/70 px-3 py-0 text-[11px] font-semibold text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">
                        {`Подсказка ${clueIndex + 1}`}
                      </div>
                      <div className="grid h-full w-full max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 pt-3 pb-2 pl-9">
                        <div className="flex items-center w-full max-w-full min-w-0 gap-2 mt-3 overflow-hidden">
                          <span className="flex-1 block min-w-0 overflow-hidden">
                            <span className="block w-full font-semibold truncate">
                              {getClueText(clue) || `${clueIndex + 1}`}
                            </span>
                          </span>
                        </div>
                        <span className="inline-flex items-center self-center justify-center">
                          <AccordionChevronIcon
                            isOpen={expandedClueAccordions.has(
                              `${task.id}-clue-${clue.id}`,
                            )}
                          />
                        </span>
                      </div>
                    </summary>
                    <div className="px-2 pb-2 mt-2 space-y-2">
                      <TaskRichEditor
                        value={clue.clueRich || clue.clue || ''}
                        directory={`games/${selectedGame.id || 'draft'}/tasks/${task.id}/clues/${clue.id}/editor`}
                        contentMaxHeight="none"
                        aiInitialGame={{
                          id: selectedGame.id || '',
                          name: selectedGame.name || '',
                          description: selectedGame.description || '',
                          dateStart: selectedGame.dateStart || '',
                          type:
                            selectedGame.type === 'photo' ? 'photo' : 'classic',
                          location: selectedGame.location || '',
                        }}
                        disabled={!canEditSelectedGame || isSaving}
                        placeholder="Введите текст подсказки."
                        onChange={({ html, plainText }) => {
                          const nextClueText =
                            plainText || stripHtmlToPlainText(html || '')
                          const nextClueRich =
                            typeof html === 'string' ? html : ''
                          handleTaskClueChange(
                            task.id,
                            clue.id,
                            'clueRich',
                            nextClueRich,
                          )
                          handleTaskClueChange(
                            task.id,
                            clue.id,
                            'clue',
                            nextClueText,
                          )
                        }}
                      />
                      <div className="pt-1">
                        <CabinetButton
                          onClick={() => handleRemoveClue(task.id, clue.id)}
                          variant="secondary"
                          tone="danger"
                          size="sm"
                          className="inline-flex items-center justify-center"
                        >
                          Удалить подсказку
                        </CabinetButton>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-200">
                Подсказок пока нет.
              </p>
            )}
            <div className="mt-3">
              <CabinetButton
                onClick={() => {
                  const nextClueId =
                    typeof crypto !== 'undefined' &&
                    typeof crypto.randomUUID === 'function'
                      ? crypto.randomUUID()
                      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
                  const nextAccordionKey = `${task.id}-clue-${nextClueId}`
                  setExpandedClueAccordions((prev) => {
                    const next = new Set(prev)
                    next.add(nextAccordionKey)
                    return next
                  })
                  handleAddClue(task.id, nextClueId)
                }}
                variant="secondary"
                tone="brand"
                size="sm"
                className="inline-flex justify-center"
              >
                Добавить подсказку
              </CabinetButton>
            </div>
          </div>

          {/* Bonus for completion (photo only) */}
          <div className="grid gap-4">
            {isPhotoGame && (
              <CabinetNumberField
                id={`task-bonus-${task.id}`}
                label="Бонус за выполнение"
                min="0"
                value={task.taskBonusForComplite ?? 0}
                onChange={(event) =>
                  handleTaskNumberChange(
                    task.id,
                    'taskBonusForComplite',
                    event.target.value,
                  )
                }
                labelClassName={fieldLabelClassName}
                inputClassName={fieldInputClassName}
              />
            )}
          </div>

          {/* How to solve */}
          <CabinetTextareaField
            id={`task-how-to-solve-${task.id}`}
            label="Как разгадать?"
            rows={4}
            value={task.howToSolve || ''}
            onChange={(event) =>
              handleTaskFieldChange(task.id, 'howToSolve', event.target.value)
            }
            labelClassName={fieldLabelClassName}
            textareaClassName={fieldInputClassName}
            placeholder="Кратко опишите логику разгадки для разбора после игры"
          />

          {/* Post-message */}
          <div className="space-y-2">
            <p className={fieldLabelClassName}>Сообщение после выполнения</p>
            <TaskRichEditor
              value={task.postMessageRich || task.postMessage || ''}
              directory={`games/${selectedGame.id || 'draft'}/tasks/${task.id}/post-message/editor`}
              contentMaxHeight="none"
              disabled={!canEditSelectedGame || isSaving}
              placeholder="Введите сообщение, которое команда увидит после выполнения задания."
              onChange={({ html, plainText, media }) => {
                const nextPostMessage =
                  plainText || stripHtmlToPlainText(html || '')
                const nextPostMessageRich = typeof html === 'string' ? html : ''
                const currentPostMessage =
                  typeof task.postMessage === 'string' ? task.postMessage : ''
                const currentPostMessageRich =
                  typeof task.postMessageRich === 'string'
                    ? task.postMessageRich
                    : ''
                const isSamePostMessage =
                  normalizeComparableEditorPlainText(nextPostMessage) ===
                  normalizeComparableEditorPlainText(currentPostMessage)
                const isSamePostMessageRich =
                  normalizeComparableRichText(
                    nextPostMessageRich,
                    nextPostMessage,
                  ) ===
                  normalizeComparableRichText(
                    currentPostMessageRich,
                    currentPostMessage,
                  )
                const isSamePostMessageMedia = areComparableMediaListsEqual(
                  media,
                  task.postMessageMedia,
                )
                if (
                  isSamePostMessage &&
                  isSamePostMessageRich &&
                  isSamePostMessageMedia
                ) {
                  return
                }
                handleTaskFieldChange(
                  task.id,
                  'postMessageRich',
                  nextPostMessageRich,
                )
                handleTaskFieldChange(task.id, 'postMessage', nextPostMessage)
                handleTaskFieldChange(task.id, 'postMessageMedia', media)
              }}
            />
          </div>

          {/* Coordinates */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-white">
              Координаты
            </h4>
            <div className="grid gap-4 mt-2 sm:grid-cols-3">
              <CabinetNumberField
                id={`task-lat-${task.id}`}
                label="Широта"
                step="any"
                value={task.coordinates?.latitude ?? ''}
                onChange={(event) =>
                  handleTaskCoordinateChange(
                    task.id,
                    'latitude',
                    event.target.value,
                  )
                }
                containerClassName="space-y-1"
                labelClassName={compactLabelClassName}
                inputClassName={compactInputClassName}
              />
              <CabinetNumberField
                id={`task-lng-${task.id}`}
                label="Долгота"
                step="any"
                value={task.coordinates?.longitude ?? ''}
                onChange={(event) =>
                  handleTaskCoordinateChange(
                    task.id,
                    'longitude',
                    event.target.value,
                  )
                }
                containerClassName="space-y-1"
                labelClassName={compactLabelClassName}
                inputClassName={compactInputClassName}
              />
              <CabinetNumberField
                id={`task-radius-${task.id}`}
                label="Радиус (м)"
                min="0"
                value={task.coordinates?.radius ?? ''}
                onChange={(event) =>
                  handleTaskCoordinateChange(
                    task.id,
                    'radius',
                    event.target.value,
                  )
                }
                containerClassName="space-y-1"
                labelClassName={compactLabelClassName}
                inputClassName={compactInputClassName}
              />
            </div>
          </div>

          {/* Main codes (non-photo) */}
          {!isPhotoGame && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-white">
                {withRequiredMark(
                  `Коды задания (${formatCodeItemsCount(
                    Array.isArray(task.codes) ? task.codes.length : 0,
                  )})`,
                )}
              </h4>
              {task.codes?.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {task.codes.map((codeValue, codeIndex) => {
                    const accordionKey = `${task.id}-main-${codeIndex}`
                    const isExpanded = expandedCodeAccordions.has(accordionKey)
                    const normalizedCodeKey =
                      normalizeCodeDuplicateKey(codeValue)
                    const isDuplicateCode =
                      normalizedCodeKey &&
                      duplicateCodeKeys.has(normalizedCodeKey)
                    const codeBadgeLabel = normalizedCodeKey
                      ? `Код ${codeIndex + 1}`
                      : '-'
                    return (
                      <details
                        key={`${task.id}-code-${codeIndex}`}
                        open={isExpanded}
                        onToggle={(event) => {
                          const isOpen = Boolean(event.currentTarget?.open)
                          setExpandedCodeAccordions((prev) => {
                            const next = new Set(prev)
                            if (isOpen) next.add(accordionKey)
                            else next.delete(accordionKey)
                            return next
                          })
                        }}
                        className={`relative overflow-hidden rounded-2xl border p-2 ${
                          isDuplicateCode
                            ? 'border-rose-400 bg-rose-50/80 ring-1 ring-rose-300/60 dark:border-rose-500/70 dark:bg-rose-500/10 dark:ring-rose-500/25'
                            : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60'
                        }`}
                      >
                        <summary className="w-full max-w-full overflow-hidden text-sm font-medium list-none cursor-pointer rounded-xl text-slate-700 marker:content-none dark:text-slate-100">
                          <div
                            className={`absolute left-0 top-0 shrink-0 rounded-br-full border-b border-r px-3 py-0 text-[11px] font-semibold ${
                              isDuplicateCode
                                ? 'border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-500/45 dark:bg-rose-500/15 dark:text-rose-200'
                                : 'border-cyan-300/70 bg-cyan-100/70 text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200'
                            }`}
                          >
                            {codeBadgeLabel}
                          </div>
                          <div className="grid w-full max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 py-1">
                            <div className="flex items-center w-full max-w-full min-w-0 gap-2 mt-2 overflow-hidden">
                              <span className="flex-1 block min-w-0 overflow-hidden">
                                <span className="block w-full font-semibold truncate">
                                  {compactSingleLine(codeValue) || '-'}
                                </span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {(
                                Array.isArray(task.codePhotos)
                                  ? task.codePhotos[codeIndex]
                                  : ''
                              ) ? (
                                <span
                                  className="inline-flex items-center text-cyan-600 dark:text-cyan-300"
                                  title="Фото добавлено"
                                >
                                  <CodePhotoBadgeIcon />
                                </span>
                              ) : null}
                              {isDuplicateCode ? (
                                <span
                                  className="inline-flex items-center justify-center w-5 h-5 text-xs font-black leading-none border rounded-full border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-500/60 dark:bg-rose-500/20 dark:text-rose-200"
                                  title="Код дублируется в этом задании"
                                  aria-label="Код дублируется"
                                >
                                  !
                                </span>
                              ) : null}
                              <AccordionChevronIcon isOpen={isExpanded} />
                            </div>
                          </div>
                        </summary>
                        <div className="flex flex-col gap-2 mt-2 sm:flex-row sm:items-center">
                          <CabinetInputField
                            id={`task-code-${task.id}-${codeIndex}`}
                            label={null}
                            type="text"
                            value={codeValue}
                            onChange={(event) =>
                              handleTaskCodeChange(
                                task.id,
                                codeIndex,
                                event.target.value,
                              )
                            }
                            placeholder="Код"
                            containerClassName="w-full space-y-0"
                            inputClassName={compactInputClassName}
                          />
                          <CabinetButton
                            onClick={() =>
                              handleRemoveTaskCode(task.id, codeIndex)
                            }
                            variant="secondary"
                            tone="danger"
                            size="sm"
                            className="inline-flex items-center justify-center"
                          >
                            Удалить
                          </CabinetButton>
                        </div>
                        {canViewCodePhotos && (
                          <div className="mt-2">
                            <ImagesInput
                              label="Фото кода"
                              images={[
                                (Array.isArray(task.codePhotos)
                                  ? task.codePhotos[codeIndex]
                                  : '') || '',
                              ].filter(Boolean)}
                              onChange={(nextImages) =>
                                handleTaskCodePhotoChange(
                                  task.id,
                                  codeIndex,
                                  Array.isArray(nextImages) &&
                                    nextImages.length > 0
                                    ? nextImages[0]
                                    : '',
                                )
                              }
                              directory={`games/${selectedGame.id || 'draft'}/tasks/${task.id}/codes/${codeIndex}`}
                              imageName={`task-code-${codeIndex + 1}`}
                              maxImages={1}
                              uploadLabel="Загрузить фото"
                              onPreviewClick={(imageUrl) =>
                                setSelectedCodePhoto({
                                  src: imageUrl,
                                  alt: `Фото для кода ${compactSingleLine(codeValue) || codeIndex + 1}`,
                                })
                              }
                              disabled={!canEditSelectedGame || isSaving}
                              previewShape="square"
                            />
                          </div>
                        )}
                      </details>
                    )
                  })}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-200">
                  Кодов пока нет.
                </p>
              )}
              <div className="mt-3">
                <CabinetButton
                  onClick={() => {
                    const nextIndex = Array.isArray(task?.codes)
                      ? task.codes.length
                      : 0
                    const nextAccordionKey = `${task.id}-main-${nextIndex}`
                    setExpandedCodeAccordions((prev) => {
                      const next = new Set(prev)
                      next.add(nextAccordionKey)
                      return next
                    })
                    handleAddTaskCode(task.id)
                  }}
                  variant="secondary"
                  tone="brand"
                  size="sm"
                  className="inline-flex justify-center"
                >
                  Добавить код
                </CabinetButton>
              </div>
              <div className="mt-4">
                <CabinetNumberField
                  id={`task-codes-required-${task.id}`}
                  label="Кодов для выполнения"
                  min="0"
                  value={task.numCodesToCompliteTask ?? ''}
                  onChange={(event) =>
                    handleTaskOptionalNumberChange(
                      task.id,
                      'numCodesToCompliteTask',
                      event.target.value,
                    )
                  }
                  placeholder="Все"
                  labelClassName={compactLabelClassName}
                  inputClassName={compactInputClassName}
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-200">
                  Оставьте пустым, чтобы требовались все коды.
                </p>
              </div>
            </div>
          )}

          {/* Sub-tasks (photo only) */}
          {isPhotoGame && (
            <div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-white">
                  Подзадания
                </h4>
                <CabinetButton
                  onClick={() => handleAddSubTask(task.id)}
                  variant="secondary"
                  tone="brand"
                  size="sm"
                  className="inline-flex justify-center"
                >
                  Добавить подзадание
                </CabinetButton>
              </div>
              {task.subTasks?.length > 0 ? (
                <div className="mt-3 space-y-4">
                  {task.subTasks.map((subTask, subIndex) => (
                    <div
                      key={subTask.id}
                      className="p-4 space-y-4 border rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-semibold text-slate-700 dark:text-white">
                          Подзадание {subIndex + 1}
                        </p>
                        <CabinetButton
                          onClick={() =>
                            handleRemoveSubTask(task.id, subTask.id)
                          }
                          variant="secondary"
                          tone="danger"
                          size="sm"
                          className="inline-flex items-center justify-center"
                        >
                          Удалить подзадание
                        </CabinetButton>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <CabinetInputField
                          id={`task-subtask-name-${subTask.id}`}
                          label="Название"
                          type="text"
                          value={subTask.name}
                          onChange={(event) =>
                            handleSubTaskChange(
                              task.id,
                              subTask.id,
                              'name',
                              event.target.value,
                            )
                          }
                          containerClassName="space-y-1"
                          labelClassName={compactLabelClassName}
                          inputClassName={compactInputClassName}
                        />
                        <CabinetNumberField
                          id={`task-subtask-bonus-${subTask.id}`}
                          label="Бонус"
                          min="0"
                          value={subTask.bonus ?? 0}
                          onChange={(event) =>
                            handleSubTaskChange(
                              task.id,
                              subTask.id,
                              'bonus',
                              event.target.value,
                            )
                          }
                          containerClassName="space-y-1"
                          labelClassName={compactLabelClassName}
                          inputClassName={compactInputClassName}
                        />
                      </div>
                      <CabinetTextareaField
                        id={`task-subtask-text-${subTask.id}`}
                        label="Описание"
                        rows={3}
                        value={subTask.task}
                        onChange={(event) =>
                          handleSubTaskChange(
                            task.id,
                            subTask.id,
                            'task',
                            event.target.value,
                          )
                        }
                        containerClassName="space-y-1"
                        labelClassName={compactLabelClassName}
                        textareaClassName={compactInputClassName}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-200">
                  Подзаданий пока нет.
                </p>
              )}
            </div>
          )}

          {/* Penalty codes */}
          {!isPhotoGame && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-white">
                Штрафные коды
              </h4>
              {task.penaltyCodes?.length > 0 ? (
                <div className="mt-3 space-y-4">
                  {task.penaltyCodes.map((penalty, penaltyIndex) => {
                    const accordionKey = `${task.id}-penalty-${penaltyIndex}`
                    const isExpanded = expandedCodeAccordions.has(accordionKey)
                    return (
                      <details
                        key={penalty.id}
                        open={isExpanded}
                        onToggle={(event) => {
                          const isOpen = Boolean(event.currentTarget?.open)
                          setExpandedCodeAccordions((prev) => {
                            const next = new Set(prev)
                            if (isOpen) next.add(accordionKey)
                            else next.delete(accordionKey)
                            return next
                          })
                        }}
                        className="relative p-2 overflow-hidden border rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60"
                      >
                        <summary className="w-full max-w-full overflow-hidden text-sm font-medium list-none cursor-pointer rounded-xl text-slate-700 marker:content-none dark:text-slate-100">
                          <div className="absolute top-0 left-0 shrink-0 rounded-br-full border-b border-r border-rose-300/70 bg-rose-100/80 px-3 py-0 text-[11px] font-semibold text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                            Штраф
                          </div>
                          <div className="grid w-full max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 py-1">
                            <div className="flex items-center w-full max-w-full min-w-0 gap-2 mt-2 overflow-hidden">
                              <span className="flex-1 block min-w-0 overflow-hidden">
                                <span className="block w-full font-semibold truncate">
                                  {compactSingleLine(penalty.code) ||
                                    'Код не указан'}
                                </span>
                              </span>
                              {truncateWithDots(penalty.description) ? (
                                <span className="hidden max-w-[240px] shrink min-w-0 truncate text-xs font-normal text-slate-500 dark:text-slate-300 sm:block">
                                  {truncateWithDots(penalty.description)}
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              {penalty.image ? (
                                <span
                                  className="inline-flex items-center text-cyan-600 dark:text-cyan-300"
                                  title="Фото добавлено"
                                >
                                  <CodePhotoBadgeIcon />
                                </span>
                              ) : null}
                              <AccordionChevronIcon isOpen={isExpanded} />
                            </div>
                          </div>
                        </summary>
                        <div className="grid gap-3 mt-2 md:grid-cols-4">
                          <CabinetInputField
                            id={`task-penalty-code-${penalty.id}`}
                            label="Код"
                            type="text"
                            value={penalty.code}
                            onChange={(event) =>
                              handlePenaltyCodeChange(
                                task.id,
                                penalty.id,
                                'code',
                                event.target.value,
                              )
                            }
                            containerClassName="md:col-span-2 space-y-1"
                            labelClassName={compactLabelClassName}
                            inputClassName={compactInputClassName}
                          />
                          <CabinetDurationField
                            id={`task-penalty-value-${penalty.id}`}
                            label="Штраф"
                            valueSeconds={penalty.penalty ?? 0}
                            onChangeSeconds={(nextSeconds) =>
                              handlePenaltyCodeChange(
                                task.id,
                                penalty.id,
                                'penalty',
                                nextSeconds,
                              )
                            }
                            containerClassName="space-y-1 md:col-span-2"
                            labelClassName={compactLabelClassName}
                          />
                        </div>
                        <CabinetInputField
                          id={`task-penalty-description-${penalty.id}`}
                          label="Комментарий"
                          type="text"
                          value={penalty.description}
                          onChange={(event) =>
                            handlePenaltyCodeChange(
                              task.id,
                              penalty.id,
                              'description',
                              event.target.value,
                            )
                          }
                          containerClassName="space-y-1"
                          labelClassName={compactLabelClassName}
                          inputClassName={compactInputClassName}
                        />
                        {canViewCodePhotos && (
                          <div className="mt-2">
                            <ImagesInput
                              label="Фото кода"
                              images={[penalty.image || ''].filter(Boolean)}
                              onChange={(nextImages) =>
                                handlePenaltyCodeChange(
                                  task.id,
                                  penalty.id,
                                  'image',
                                  Array.isArray(nextImages) &&
                                    nextImages.length > 0
                                    ? nextImages[0]
                                    : '',
                                )
                              }
                              directory={`games/${selectedGame.id || 'draft'}/tasks/${task.id}/penalty-codes/${penalty.id}`}
                              imageName={`penalty-code-${penalty.id}`}
                              maxImages={1}
                              uploadLabel="Загрузить фото"
                              disabled={!canEditSelectedGame || isSaving}
                              previewShape="square"
                            />
                          </div>
                        )}
                        <div className="flex justify-end">
                          <CabinetButton
                            onClick={() =>
                              handleRemovePenaltyCode(task.id, penalty.id)
                            }
                            variant="secondary"
                            tone="danger"
                            size="sm"
                            className="inline-flex items-center justify-center"
                          >
                            Удалить штраф
                          </CabinetButton>
                        </div>
                      </details>
                    )
                  })}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-200">
                  Штрафных кодов пока нет.
                </p>
              )}
              <div className="mt-3">
                <CabinetButton
                  onClick={() => {
                    const nextIndex = Array.isArray(task?.penaltyCodes)
                      ? task.penaltyCodes.length
                      : 0
                    const nextAccordionKey = `${task.id}-penalty-${nextIndex}`
                    setExpandedCodeAccordions((prev) => {
                      const next = new Set(prev)
                      next.add(nextAccordionKey)
                      return next
                    })
                    handleAddPenaltyCode(task.id)
                  }}
                  variant="secondary"
                  tone="brand"
                  size="sm"
                  className="inline-flex justify-center"
                >
                  Добавить штраф
                </CabinetButton>
              </div>
            </div>
          )}

          {/* Bonus codes */}
          {!isPhotoGame && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-white">
                Бонусные коды
              </h4>
              {task.bonusCodes?.length > 0 ? (
                <div className="mt-3 space-y-4">
                  {task.bonusCodes.map((bonus, bonusIndex) => {
                    const accordionKey = `${task.id}-bonus-${bonusIndex}`
                    const isExpanded = expandedCodeAccordions.has(accordionKey)
                    return (
                      <details
                        key={bonus.id}
                        open={isExpanded}
                        onToggle={(event) => {
                          const isOpen = Boolean(event.currentTarget?.open)
                          setExpandedCodeAccordions((prev) => {
                            const next = new Set(prev)
                            if (isOpen) next.add(accordionKey)
                            else next.delete(accordionKey)
                            return next
                          })
                        }}
                        className="relative p-2 overflow-hidden border rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60"
                      >
                        <summary className="w-full max-w-full overflow-hidden text-sm font-medium list-none cursor-pointer rounded-xl text-slate-700 marker:content-none dark:text-slate-100">
                          <div className="absolute top-0 left-0 shrink-0 rounded-br-full border-b border-r border-emerald-300/70 bg-emerald-100/80 px-3 py-0 text-[11px] font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                            Бонус
                          </div>
                          <div className="grid w-full max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 py-1">
                            <div className="flex items-center w-full max-w-full min-w-0 gap-2 mt-2 overflow-hidden">
                              <span className="flex-1 block min-w-0 overflow-hidden">
                                <span className="block w-full font-semibold truncate">
                                  {compactSingleLine(bonus.code) ||
                                    'Код не указан'}
                                </span>
                              </span>
                              {truncateWithDots(bonus.description) ? (
                                <span className="hidden max-w-[240px] shrink min-w-0 truncate text-xs font-normal text-slate-500 dark:text-slate-300 sm:block">
                                  {truncateWithDots(bonus.description)}
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              {bonus.image ? (
                                <span
                                  className="inline-flex items-center text-cyan-600 dark:text-cyan-300"
                                  title="Фото добавлено"
                                >
                                  <CodePhotoBadgeIcon />
                                </span>
                              ) : null}
                              <AccordionChevronIcon isOpen={isExpanded} />
                            </div>
                          </div>
                        </summary>
                        <div className="grid gap-3 mt-2 md:grid-cols-4">
                          <CabinetInputField
                            id={`task-bonus-code-${bonus.id}`}
                            label="Код"
                            type="text"
                            value={bonus.code}
                            onChange={(event) =>
                              handleBonusCodeChange(
                                task.id,
                                bonus.id,
                                'code',
                                event.target.value,
                              )
                            }
                            containerClassName="md:col-span-2 space-y-1"
                            labelClassName={compactLabelClassName}
                            inputClassName={compactInputClassName}
                          />
                          <CabinetDurationField
                            id={`task-bonus-value-${bonus.id}`}
                            label="Бонус"
                            valueSeconds={bonus.bonus ?? 0}
                            onChangeSeconds={(nextSeconds) =>
                              handleBonusCodeChange(
                                task.id,
                                bonus.id,
                                'bonus',
                                nextSeconds,
                              )
                            }
                            containerClassName="space-y-1 md:col-span-2"
                            labelClassName={compactLabelClassName}
                          />
                        </div>
                        <CabinetInputField
                          id={`task-bonus-description-${bonus.id}`}
                          label="Комментарий"
                          type="text"
                          value={bonus.description}
                          onChange={(event) =>
                            handleBonusCodeChange(
                              task.id,
                              bonus.id,
                              'description',
                              event.target.value,
                            )
                          }
                          containerClassName="space-y-1"
                          labelClassName={compactLabelClassName}
                          inputClassName={compactInputClassName}
                        />
                        {canViewCodePhotos && (
                          <div className="mt-2">
                            <ImagesInput
                              label="Фото кода"
                              images={[bonus.image || ''].filter(Boolean)}
                              onChange={(nextImages) =>
                                handleBonusCodeChange(
                                  task.id,
                                  bonus.id,
                                  'image',
                                  Array.isArray(nextImages) &&
                                    nextImages.length > 0
                                    ? nextImages[0]
                                    : '',
                                )
                              }
                              directory={`games/${selectedGame.id || 'draft'}/tasks/${task.id}/bonus-codes/${bonus.id}`}
                              imageName={`bonus-code-${bonus.id}`}
                              maxImages={1}
                              uploadLabel="Загрузить фото"
                              disabled={!canEditSelectedGame || isSaving}
                              previewShape="square"
                            />
                          </div>
                        )}
                        <div className="flex justify-end">
                          <CabinetButton
                            onClick={() =>
                              handleRemoveBonusCode(task.id, bonus.id)
                            }
                            variant="secondary"
                            tone="danger"
                            size="sm"
                            className="inline-flex items-center justify-center"
                          >
                            Удалить бонус
                          </CabinetButton>
                        </div>
                      </details>
                    )
                  })}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-200">
                  Бонусных кодов пока нет.
                </p>
              )}
              <div className="mt-3">
                <CabinetButton
                  onClick={() => {
                    const nextIndex = Array.isArray(task?.bonusCodes)
                      ? task.bonusCodes.length
                      : 0
                    const nextAccordionKey = `${task.id}-bonus-${nextIndex}`
                    setExpandedCodeAccordions((prev) => {
                      const next = new Set(prev)
                      next.add(nextAccordionKey)
                      return next
                    })
                    handleAddBonusCode(task.id)
                  }}
                  variant="secondary"
                  tone="brand"
                  size="sm"
                  className="inline-flex justify-center"
                >
                  Добавить бонус
                </CabinetButton>
              </div>
            </div>
          )}

          {/* Delete task */}
          <div className="flex justify-end">
            <CabinetButton
              onClick={() => {
                if (
                  typeof window !== 'undefined' &&
                  !window.confirm(
                    `Удалить задание «${task.title || `№${index + 1}`}»? Это действие нельзя отменить.`,
                  )
                ) {
                  return
                }
                handleRemoveTask(task.id)
              }}
              variant="secondary"
              tone="danger"
              size="sm"
              className="inline-flex items-center justify-center"
            >
              Удалить задание
            </CabinetButton>
          </div>
        </div>
      )}
    </div>
  )
}

TaskItem.propTypes = {
  task: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string,
    task: PropTypes.string,
    taskRich: PropTypes.string,
    taskMedia: PropTypes.array,
    howToSolve: PropTypes.string,
    postMessage: PropTypes.string,
    postMessageRich: PropTypes.string,
    postMessageMedia: PropTypes.array,
    canceled: PropTypes.bool,
    isBonusTask: PropTypes.bool,
    clues: PropTypes.array,
    codes: PropTypes.array,
    codePhotos: PropTypes.array,
    bonusCodes: PropTypes.array,
    penaltyCodes: PropTypes.array,
    subTasks: PropTypes.array,
    coordinates: PropTypes.object,
    agentUserIds: PropTypes.array,
    numCodesToCompliteTask: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string,
    ]),
    taskBonusForComplite: PropTypes.number,
  }).isRequired,
  index: PropTypes.number.isRequired,
  isExpanded: PropTypes.bool.isRequired,
  toggleTaskExpansion: PropTypes.func.isRequired,
  isTaskOrderLocked: PropTypes.bool.isRequired,
  canEditSelectedGame: PropTypes.bool.isRequired,
  isSaving: PropTypes.bool.isRequired,
  selectedGame: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    type: PropTypes.string,
    description: PropTypes.string,
    dateStart: PropTypes.string,
    location: PropTypes.string,
    tasks: PropTypes.array,
  }),
  selectedGameAgents: PropTypes.array,
  canViewCodePhotos: PropTypes.bool,
  isPhotoGame: PropTypes.bool.isRequired,
  draggedTaskId: PropTypes.string,
  dragOverTaskId: PropTypes.string,
  setDraggedTaskId: PropTypes.func,
  setDragOverTaskId: PropTypes.func,
  draggedClueMeta: PropTypes.object,
  dragOverClueMeta: PropTypes.object,
  setDraggedClueMeta: PropTypes.func,
  setDragOverClueMeta: PropTypes.func,
  dragGhostPosition: PropTypes.object,
  setDragGhostPosition: PropTypes.func,
  dragClueGhostPosition: PropTypes.object,
  setDragClueGhostPosition: PropTypes.func,
  handleTaskFieldChange: PropTypes.func.isRequired,
  handleTaskNumberChange: PropTypes.func.isRequired,
  handleTaskOptionalNumberChange: PropTypes.func.isRequired,
  handleTaskCheckboxChange: PropTypes.func.isRequired,
  handleTaskCoordinateChange: PropTypes.func.isRequired,
  handleAddTaskCode: PropTypes.func.isRequired,
  handleTaskCodeChange: PropTypes.func.isRequired,
  handleTaskCodePhotoChange: PropTypes.func.isRequired,
  handleRemoveTaskCode: PropTypes.func.isRequired,
  handleAddClue: PropTypes.func.isRequired,
  handleReorderClue: PropTypes.func.isRequired,
  handleTaskClueChange: PropTypes.func.isRequired,
  handleRemoveClue: PropTypes.func.isRequired,
  handleAddSubTask: PropTypes.func.isRequired,
  handleSubTaskChange: PropTypes.func.isRequired,
  handleRemoveSubTask: PropTypes.func.isRequired,
  handleAddPenaltyCode: PropTypes.func.isRequired,
  handlePenaltyCodeChange: PropTypes.func.isRequired,
  handleRemovePenaltyCode: PropTypes.func.isRequired,
  handleAddBonusCode: PropTypes.func.isRequired,
  handleBonusCodeChange: PropTypes.func.isRequired,
  handleRemoveBonusCode: PropTypes.func.isRequired,
  handleReorderTask: PropTypes.func.isRequired,
  handleSaveAndOpenTaskPreview: PropTypes.func.isRequired,
  handleRemoveTask: PropTypes.func.isRequired,
  handleTaskHandlePointerDown: PropTypes.func.isRequired,
  handleTaskHandlePointerMove: PropTypes.func.isRequired,
  handleTaskHandlePointerUp: PropTypes.func.isRequired,
  resetTouchTaskDragState: PropTypes.func.isRequired,
  handleClueHandlePointerDown: PropTypes.func.isRequired,
  handleClueHandlePointerMove: PropTypes.func.isRequired,
  handleClueHandlePointerUp: PropTypes.func.isRequired,
  resetTouchClueDragState: PropTypes.func.isRequired,
  expandedCodeAccordions: PropTypes.instanceOf(Set).isRequired,
  setExpandedCodeAccordions: PropTypes.func.isRequired,
  expandedClueAccordions: PropTypes.instanceOf(Set).isRequired,
  setExpandedClueAccordions: PropTypes.func.isRequired,
  selectedCodePhoto: PropTypes.object,
  setSelectedCodePhoto: PropTypes.func.isRequired,
}

export default memo(TaskItem)
