import { memo, useCallback, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import dynamic from 'next/dynamic'

import Modal from '@components/Modal'
import AmountStepperInput from '@components/cabinet/AmountStepperInput'
import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetDurationField from '@components/cabinet/CabinetDurationField'
import CabinetInputField from '@components/cabinet/CabinetInputField'
import CabinetSelectField from '@components/cabinet/CabinetSelectField'
import CabinetTextareaField from '@components/cabinet/CabinetTextareaField'
import ImagesInput from '@components/cabinet/ImagesInput'
import CabinetNumberField from '@components/cabinet/CabinetNumberField'
import NeonCheckbox from '@components/NeonCheckbox'
import FullscreenImageViewer from '@components/FullscreenImageViewer'
import formatDate from '@helpers/formatDate'
import {
  formatDateTimeLocalInLocation,
  parseDateTimeLocalInLocation,
} from '@helpers/dateTimeLocalInLocation'
import ModalSection from './ModalSection'

const TaskRichEditor = dynamic(
  () => import('@components/cabinet/TaskRichEditor'),
  {
    ssr: false,
  },
)

const stripHtmlToPlainText = (value) =>
  String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r?\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const normalizeComparablePlainText = (value) =>
  String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const normalizeCodeDuplicateKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()

const formatCodeItemsCount = (count) => `${Math.max(0, Number(count) || 0)} шт.`

const hasCoordinateValue = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value)
  }

  return typeof value === 'string' && value.trim() !== ''
}

const hasMeaningfulRichMarkup = (value) =>
  /<(?!\/?(p|br|div|span)\b)[^>]+>/i.test(String(value || ''))

const normalizeComparableRichText = (richValue, plainValue) => {
  const rich = typeof richValue === 'string' ? richValue.trim() : ''
  if (!rich) {
    return ''
  }

  const normalizedPlain = normalizeComparablePlainText(plainValue)
  const normalizedRichPlain = normalizeComparablePlainText(
    stripHtmlToPlainText(rich),
  )

  if (
    normalizedRichPlain === normalizedPlain &&
    !hasMeaningfulRichMarkup(rich)
  ) {
    return ''
  }

  return rich
}

const getTaskDescriptionText = (task) => {
  const taskText = typeof task?.task === 'string' ? task.task.trim() : ''
  if (taskText) {
    return taskText
  }
  return stripHtmlToPlainText(task?.taskRich)
}

const getClueText = (clue) => {
  const clueText = typeof clue?.clue === 'string' ? clue.clue.trim() : ''
  if (clueText) {
    return clueText
  }
  return stripHtmlToPlainText(clue?.clueRich)
}

const compactSingleLine = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()

const truncateWithDots = (value, maxLength = 56) => {
  const normalized = compactSingleLine(value)
  if (!normalized) {
    return ''
  }
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`
}

const CodePhotoBadgeIcon = () => (
  <svg
    className="h-3.5 w-3.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="7" width="18" height="14" rx="2" />
    <path d="M9 7l1.5-2h3L15 7" />
    <circle cx="12" cy="14" r="3.2" />
  </svg>
)

const TaskWarningIcon = ({ title }) => (
  <span
    className="inline-flex items-center justify-center w-5 h-5"
    title={title}
    aria-label={title}
  >
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path d="M12 3L2 21h20L12 3z" fill="#ef4444" />
      <rect x="11" y="8" width="2" height="7" rx="1" fill="#ffffff" />
      <circle cx="12" cy="18" r="1.3" fill="#ffffff" />
    </svg>
  </span>
)

const AccordionChevronIcon = ({ isOpen }) => (
  <span
    className={`inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition-transform duration-200 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 ${
      isOpen ? 'rotate-180' : 'rotate-0'
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
)

const GameEditModal = ({
  selectedGame,
  isEditModalOpen,
  handleCloseEditModal,
  canEditSelectedGame,
  isSaving,
  location,
  isDirty,
  handleModalPrimaryAction,
  handleResetChanges,
  updateSelectedGame,
  GAME_TYPE_OPTIONS,
  CLUE_EARLY_MODE_OPTIONS,
  toMinutes,
  toSeconds,
  handleAddTask,
  handleReorderTask,
  isTaskReorderLocked,
  startedGameLockedTaskCount,
  handleRemoveTask,
  handleTaskFieldChange,
  handleTaskNumberChange,
  handleTaskOptionalNumberChange,
  handleTaskCheckboxChange,
  handleTaskCoordinateChange,
  handleAddTaskCode,
  handleTaskCodeChange,
  handleTaskCodePhotoChange,
  handleRemoveTaskCode,
  handleAddTaskImage,
  handleTaskImageChange,
  handleRemoveTaskImage,
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
  handleAddPrice,
  handlePriceChange,
  handleRemovePrice,
  handleAddFinance,
  handleFinanceChange,
  handleRemoveFinance,
  canGenerateResults,
  isGeneratingResults,
  handleGenerateResults,
  generateResultsButtonLabel,
  currencyFormatter,
  financesSummary,
  balanceClass,
  expandedTaskIds,
  toggleTaskExpansion,
  selectedGameModerators,
  availableModeratorsForSelect,
  availableModeratorsMap,
  availableOrganizersForSelect,
  selectedModeratorToAdd,
  setSelectedModeratorToAdd,
  handleAddModerator,
  handleRemoveModerator,
  selectedGameAgents,
  availableAgentsForSelect,
  selectedAgentToAdd,
  setSelectedAgentToAdd,
  handleAddAgent,
  handleRemoveAgent,
  editGameLocationOptions,
  editGameSeasons,
  isEditGameSeasonsLoading,
  isEditGameSeasonCreating,
  handleCreateSeasonForEditGame,
  handleSaveAndOpenTaskPreview,
  sectionMode,
  modalTitleOverride,
  canViewCodePhotos,
}) => {
  const isTasksOnly = sectionMode === 'tasks'
  const isClosedGame =
    String(selectedGame?.status || '').toLowerCase() === 'closed'
  const [expandedCodeAccordions, setExpandedCodeAccordions] = useState(
    () => new Set(),
  )
  const [expandedClueAccordions, setExpandedClueAccordions] = useState(
    () => new Set(),
  )
  const [selectedCodePhoto, setSelectedCodePhoto] = useState(null)
  const [draggedTaskId, setDraggedTaskId] = useState(null)
  const [dragOverTaskId, setDragOverTaskId] = useState(null)
  const [dragGhostPosition, setDragGhostPosition] = useState(null)
  const [draggedClueMeta, setDraggedClueMeta] = useState(null)
  const [dragOverClueMeta, setDragOverClueMeta] = useState(null)
  const [dragClueGhostPosition, setDragClueGhostPosition] = useState(null)
  const touchDragStateRef = useRef({
    active: false,
    pointerId: null,
    sourceTaskId: null,
    overTaskId: null,
  })
  const clueDragStateRef = useRef({
    active: false,
    pointerId: null,
    sourceTaskId: null,
    sourceClueId: null,
    overTaskId: null,
    overClueId: null,
  })
  const isPhotoGame = selectedGame?.type === 'photo'
  const amountInputClassName =
    'aq-amount-step-input h-10 w-full rounded-xl border border-slate-200 bg-white px-12 py-2 text-center text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white'
  const fieldLabelClassName =
    'text-sm font-semibold text-slate-700 dark:text-white'
  const fieldInputClassName =
    'w-full px-4 py-3 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none'
  const fieldSelectClassName = fieldInputClassName
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
  const getCheckboxChecked = (valueOrEvent) =>
    typeof valueOrEvent === 'boolean'
      ? valueOrEvent
      : Boolean(valueOrEvent?.target?.checked)
  const debugCheckboxUpdate = (source, checked, payloadFactory) => {
    try {
      const payload =
        typeof payloadFactory === 'function'
          ? payloadFactory(checked)
          : payloadFactory
      updateSelectedGame(payload)
    } catch (error) {
      console.error('[GameEditModal] Ошибка обновления чекбокса', {
        source,
        checked,
        gameId: selectedGame?.id ?? null,
        gameName: selectedGame?.name ?? null,
        error,
      })
    }
  }
  const organizersByUserId = new Map(
    (Array.isArray(availableOrganizersForSelect)
      ? availableOrganizersForSelect
      : []
    ).map((organizer) => [organizer.id, organizer]),
  )

  const resetTouchTaskDragState = useCallback(() => {
    touchDragStateRef.current = {
      active: false,
      pointerId: null,
      sourceTaskId: null,
      overTaskId: null,
    }
    setDraggedTaskId(null)
    setDragOverTaskId(null)
    setDragGhostPosition(null)
  }, [])

  const resetTouchClueDragState = useCallback(() => {
    clueDragStateRef.current = {
      active: false,
      pointerId: null,
      sourceTaskId: null,
      sourceClueId: null,
      overTaskId: null,
      overClueId: null,
    }
    setDraggedClueMeta(null)
    setDragOverClueMeta(null)
    setDragClueGhostPosition(null)
  }, [])

  const resolveTouchDragTargetTaskId = useCallback(
    (clientX, clientY, sourceTaskId) => {
      const elementUnderPointer = document.elementFromPoint(clientX, clientY)
      const taskContainer = elementUnderPointer?.closest?.('[data-task-dnd-id]')
      const targetTaskId = taskContainer?.getAttribute('data-task-dnd-id') || ''
      if (!targetTaskId || targetTaskId === sourceTaskId) {
        return ''
      }
      const targetIndex = (selectedGame?.tasks || []).findIndex(
        (item) => String(item?.id) === String(targetTaskId),
      )
      if (targetIndex < 0 || isTaskReorderLocked(targetIndex)) {
        return ''
      }
      return String(targetTaskId)
    },
    [isTaskReorderLocked, selectedGame?.tasks],
  )

  const handleTaskHandlePointerDown = useCallback(
    (taskId, canDragTask, event) => {
      if (!canDragTask) {
        return
      }
      event.preventDefault()
      touchDragStateRef.current = {
        active: true,
        pointerId: event.pointerId,
        sourceTaskId: String(taskId),
        overTaskId: null,
      }
      setDraggedTaskId(String(taskId))
      setDragOverTaskId(null)
      setDragGhostPosition({ x: event.clientX, y: event.clientY })
      if (event.currentTarget?.setPointerCapture) {
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // ignore
        }
      }
    },
    [],
  )

  const handleTaskHandlePointerMove = useCallback(
    (event) => {
      const dragState = touchDragStateRef.current
      if (!dragState.active || dragState.pointerId !== event.pointerId) {
        return
      }
      setDragGhostPosition({ x: event.clientX, y: event.clientY })

      const targetTaskId = resolveTouchDragTargetTaskId(
        event.clientX,
        event.clientY,
        dragState.sourceTaskId,
      )
      if (!targetTaskId) {
        dragState.overTaskId = null
        setDragOverTaskId(null)
        return
      }
      dragState.overTaskId = targetTaskId
      setDragOverTaskId(targetTaskId)
    },
    [resolveTouchDragTargetTaskId],
  )

  const handleTaskHandlePointerUp = useCallback(
    (event) => {
      const dragState = touchDragStateRef.current
      if (!dragState.active || dragState.pointerId !== event.pointerId) {
        return
      }

      if (event.currentTarget?.releasePointerCapture) {
        try {
          event.currentTarget.releasePointerCapture(event.pointerId)
        } catch {
          // ignore
        }
      }

      const sourceTaskId = String(dragState.sourceTaskId || '')
      const targetTaskId = String(dragState.overTaskId || '')
      resetTouchTaskDragState()

      if (!sourceTaskId || !targetTaskId || sourceTaskId === targetTaskId) {
        return
      }

      const sourceIndex = (selectedGame?.tasks || []).findIndex(
        (item) => String(item?.id) === sourceTaskId,
      )
      const targetIndex = (selectedGame?.tasks || []).findIndex(
        (item) => String(item?.id) === targetTaskId,
      )
      if (
        sourceIndex < 0 ||
        targetIndex < 0 ||
        isTaskReorderLocked(targetIndex)
      ) {
        return
      }
      handleReorderTask(sourceIndex, targetIndex)
    },
    [
      handleReorderTask,
      isTaskReorderLocked,
      resetTouchTaskDragState,
      selectedGame?.tasks,
    ],
  )

  const draggedTaskGhost = (selectedGame?.tasks || []).find(
    (task) => String(task?.id) === String(draggedTaskId || ''),
  )
  const draggedClueGhost = (() => {
    if (!draggedClueMeta) {
      return null
    }
    const task = (selectedGame?.tasks || []).find(
      (item) => String(item?.id) === String(draggedClueMeta.taskId),
    )
    if (!task) {
      return null
    }
    const clues = Array.isArray(task?.clues) ? task.clues : []
    const clueIndex = clues.findIndex(
      (item) => String(item?.id) === String(draggedClueMeta.clueId),
    )
    if (clueIndex < 0) {
      return null
    }
    return {
      taskId: String(task.id),
      clueId: String(clues[clueIndex].id),
      clueIndex,
      title: getClueText(clues[clueIndex]) || `${clueIndex + 1}`,
    }
  })()

  const resolveClueDragTarget = useCallback(
    (clientX, clientY, sourceTaskId, sourceClueId) => {
      const elementUnderPointer = document.elementFromPoint(clientX, clientY)
      const clueContainer = elementUnderPointer?.closest?.(
        '[data-clue-dnd-task-id][data-clue-dnd-id]',
      )
      const targetTaskId =
        clueContainer?.getAttribute('data-clue-dnd-task-id') || ''
      const targetClueId = clueContainer?.getAttribute('data-clue-dnd-id') || ''
      if (!targetTaskId || !targetClueId) {
        return { taskId: '', clueId: '' }
      }
      if (String(targetTaskId) !== String(sourceTaskId)) {
        return { taskId: '', clueId: '' }
      }
      if (String(targetClueId) === String(sourceClueId)) {
        return { taskId: '', clueId: '' }
      }
      return { taskId: String(targetTaskId), clueId: String(targetClueId) }
    },
    [],
  )

  const handleClueHandlePointerDown = useCallback(
    (taskId, clueId, canDragClue, event) => {
      if (!canDragClue) {
        return
      }
      event.preventDefault()
      clueDragStateRef.current = {
        active: true,
        pointerId: event.pointerId,
        sourceTaskId: String(taskId),
        sourceClueId: String(clueId),
        overTaskId: null,
        overClueId: null,
      }
      setDraggedClueMeta({ taskId: String(taskId), clueId: String(clueId) })
      setDragOverClueMeta(null)
      setDragClueGhostPosition({ x: event.clientX, y: event.clientY })
      if (event.currentTarget?.setPointerCapture) {
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // ignore
        }
      }
    },
    [],
  )

  const handleClueHandlePointerMove = useCallback(
    (event) => {
      const dragState = clueDragStateRef.current
      if (!dragState.active || dragState.pointerId !== event.pointerId) {
        return
      }
      setDragClueGhostPosition({ x: event.clientX, y: event.clientY })
      const target = resolveClueDragTarget(
        event.clientX,
        event.clientY,
        dragState.sourceTaskId,
        dragState.sourceClueId,
      )
      if (!target.taskId || !target.clueId) {
        dragState.overTaskId = null
        dragState.overClueId = null
        setDragOverClueMeta(null)
        return
      }
      dragState.overTaskId = target.taskId
      dragState.overClueId = target.clueId
      setDragOverClueMeta({ taskId: target.taskId, clueId: target.clueId })
    },
    [resolveClueDragTarget],
  )

  const handleClueHandlePointerUp = useCallback(
    (event) => {
      const dragState = clueDragStateRef.current
      if (!dragState.active || dragState.pointerId !== event.pointerId) {
        return
      }
      if (event.currentTarget?.releasePointerCapture) {
        try {
          event.currentTarget.releasePointerCapture(event.pointerId)
        } catch {
          // ignore
        }
      }

      const sourceTaskId = String(dragState.sourceTaskId || '')
      const sourceClueId = String(dragState.sourceClueId || '')
      const targetTaskId = String(dragState.overTaskId || '')
      const targetClueId = String(dragState.overClueId || '')
      resetTouchClueDragState()

      if (
        !sourceTaskId ||
        !sourceClueId ||
        !targetTaskId ||
        !targetClueId ||
        sourceTaskId !== targetTaskId ||
        sourceClueId === targetClueId
      ) {
        return
      }

      const task = (selectedGame?.tasks || []).find(
        (item) => String(item?.id) === sourceTaskId,
      )
      const clues = Array.isArray(task?.clues) ? task.clues : []
      const sourceIndex = clues.findIndex(
        (item) => String(item?.id) === sourceClueId,
      )
      const targetIndex = clues.findIndex(
        (item) => String(item?.id) === targetClueId,
      )
      if (sourceIndex < 0 || targetIndex < 0) {
        return
      }
      handleReorderClue(sourceTaskId, sourceIndex, targetIndex)
    },
    [handleReorderClue, resetTouchClueDragState, selectedGame?.tasks],
  )

  const modalFooter = (
    <>
      <CabinetButton
        onClick={handleModalPrimaryAction}
        disabled={isSaving || (isDirty && (!canEditSelectedGame || !location))}
        variant="primary"
      >
        {isDirty
          ? isSaving
            ? 'Сохранение…'
            : 'Сохранить и закрыть'
          : 'Закрыть'}
      </CabinetButton>
      {isDirty && (
        <CabinetButton
          onClick={handleResetChanges}
          disabled={!canEditSelectedGame}
          variant="secondary"
        >
          Отменить изменения
        </CabinetButton>
      )}
    </>
  )

  useEffect(() => {
    if (!isEditModalOpen) {
      setExpandedCodeAccordions(new Set())
      setExpandedClueAccordions(new Set())
      resetTouchTaskDragState()
      resetTouchClueDragState()
    }
  }, [
    isEditModalOpen,
    resetTouchClueDragState,
    resetTouchTaskDragState,
    selectedGame?.id,
  ])

  if (!selectedGame) {
    console.error(
      '[GameEditModal] Модалка редактирования открыта без selectedGame',
      {
        isEditModalOpen,
      },
    )
    return (
      <Modal
        isOpen={isEditModalOpen}
        title="Редактирование игры"
        onClose={handleCloseEditModal}
      >
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Игра не выбрана. Закройте окно и выберите игру снова.
        </p>
      </Modal>
    )
  }

  if (!isTasksOnly && isClosedGame) {
    return (
      <Modal
        isOpen={isEditModalOpen}
        title={
          modalTitleOverride ||
          `Редактирование игры «${selectedGame?.name || 'Без названия'}»`
        }
        onClose={handleCloseEditModal}
        footer={modalFooter}
      >
        <fieldset
          disabled={!canEditSelectedGame || isSaving}
          className="p-0 m-0 space-y-4 border-0"
        >
          <ModalSection>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Для закрытой игры можно менять только параметры публикации.
            </p>
            <div className="grid gap-3 mt-4">
              <NeonCheckbox
                id="game-show-creator-closed"
                checked={Boolean(selectedGame.showCreator)}
                onChange={(eventOrChecked) =>
                  debugCheckboxUpdate(
                    'showCreator',
                    getCheckboxChecked(eventOrChecked),
                    (checked) => ({ showCreator: checked }),
                  )
                }
                label="Показывать организатора игрокам"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
              <NeonCheckbox
                id="game-show-tasks-closed"
                checked={Boolean(selectedGame.showTasks)}
                onChange={(eventOrChecked) =>
                  debugCheckboxUpdate(
                    'showTasks',
                    getCheckboxChecked(eventOrChecked),
                    (checked) => ({ showTasks: checked }),
                  )
                }
                label="Открыть задания после завершения"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
              <NeonCheckbox
                id="game-hide-result-closed"
                checked={!Boolean(selectedGame.hideResult)}
                onChange={(eventOrChecked) =>
                  debugCheckboxUpdate(
                    'hideResult',
                    getCheckboxChecked(eventOrChecked),
                    (checked) => ({ hideResult: !checked }),
                  )
                }
                label="Показать результаты"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
            </div>
          </ModalSection>
        </fieldset>
      </Modal>
    )
  }

  return (
    <Modal
      isOpen={isEditModalOpen}
      title={
        modalTitleOverride ||
        `Редактирование игры «${selectedGame?.name || 'Без названия'}»`
      }
      onClose={handleCloseEditModal}
      footer={modalFooter}
    >
      <fieldset
        disabled={!canEditSelectedGame || isSaving}
        className="m-0 space-y-6 border-0 p-0 [&_button]:cursor-pointer [&_select]:cursor-pointer"
      >
        {!isTasksOnly && (
          <ModalSection>
            <ImagesInput
              label="Обложка игры"
              images={selectedGame.image ? [selectedGame.image] : []}
              onChange={(nextImages) =>
                updateSelectedGame({ image: nextImages?.[0] ?? null })
              }
              directory={`games/${selectedGame.id || 'draft'}`}
              imageName="cover"
              disabled={!canEditSelectedGame || isSaving}
              maxImages={1}
              previewShape="square"
            />

            <CabinetInputField
              id="game-title"
              label="Название игры"
              type="text"
              value={selectedGame.name}
              onChange={(event) =>
                updateSelectedGame({ name: event.target.value })
              }
              labelClassName={fieldLabelClassName}
              inputClassName={fieldInputClassName}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <CabinetSelectField
                id="game-type"
                label="Тип игры"
                value={selectedGame.type}
                onChange={(event) =>
                  updateSelectedGame({ type: event.target.value })
                }
                labelClassName={fieldLabelClassName}
                selectClassName={fieldSelectClassName}
              >
                {GAME_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </CabinetSelectField>
              <CabinetSelectField
                id="game-location"
                label="Город"
                value={selectedGame.location || ''}
                onChange={(event) =>
                  updateSelectedGame({ location: event.target.value || '' })
                }
                labelClassName={fieldLabelClassName}
                selectClassName={fieldSelectClassName}
              >
                {editGameLocationOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </CabinetSelectField>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <CabinetInputField
                id="game-date"
                label="Плановое начало"
                type="datetime-local"
                value={
                  selectedGame.dateStart
                    ? formatDateTimeLocalInLocation(
                        selectedGame.dateStart,
                        selectedGame.location,
                      )
                    : ''
                }
                onChange={(event) =>
                  updateSelectedGame({
                    dateStart: event.target.value
                      ? parseDateTimeLocalInLocation(
                          event.target.value,
                          selectedGame.location,
                        )
                      : null,
                  })
                }
                labelClassName={fieldLabelClassName}
                inputClassName={fieldInputClassName}
              />
            </div>

            <NeonCheckbox
              id="game-individual-start"
              checked={Boolean(selectedGame.individualStart)}
              onChange={(eventOrChecked) =>
                debugCheckboxUpdate(
                  'individualStart',
                  getCheckboxChecked(eventOrChecked),
                  (checked) => ({ individualStart: checked }),
                )
              }
              label="Индивидуальный старт для команд"
              labelClassName="text-sm text-slate-600 dark:text-slate-200"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <CabinetInputField
                id="game-starting-place"
                label="Место сбора"
                type="text"
                value={selectedGame.startingPlace}
                onChange={(event) =>
                  updateSelectedGame({ startingPlace: event.target.value })
                }
                labelClassName={fieldLabelClassName}
                inputClassName={fieldInputClassName}
              />
              <CabinetInputField
                id="game-finishing-place"
                label="Место окончания"
                type="text"
                value={selectedGame.finishingPlace}
                onChange={(event) =>
                  updateSelectedGame({ finishingPlace: event.target.value })
                }
                labelClassName={fieldLabelClassName}
                inputClassName={fieldInputClassName}
              />
            </div>

            <div className="space-y-2">
              <p className={fieldLabelClassName}>Описание</p>
              <TaskRichEditor
                value={
                  selectedGame.descriptionRich || selectedGame.description || ''
                }
                directory={`games/${selectedGame.id || 'draft'}/description/editor`}
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
                placeholder="Введите описание игры. Можно использовать форматирование, картинки и аудио."
                onChange={({ html, plainText, media }) => {
                  const nextDescription =
                    plainText || stripHtmlToPlainText(html || '')
                  const nextDescriptionRich =
                    typeof html === 'string' ? html : ''
                  const currentDescription =
                    typeof selectedGame.description === 'string'
                      ? selectedGame.description
                      : ''
                  const currentDescriptionRich =
                    typeof selectedGame.descriptionRich === 'string'
                      ? selectedGame.descriptionRich
                      : ''

                  const isSameDescription =
                    normalizeComparablePlainText(nextDescription) ===
                    normalizeComparablePlainText(currentDescription)
                  const isSameDescriptionRich =
                    normalizeComparableRichText(
                      nextDescriptionRich,
                      nextDescription,
                    ) ===
                    normalizeComparableRichText(
                      currentDescriptionRich,
                      currentDescription,
                    )
                  const isSameMedia =
                    JSON.stringify(Array.isArray(media) ? media : []) ===
                    JSON.stringify(
                      Array.isArray(selectedGame.descriptionMedia)
                        ? selectedGame.descriptionMedia
                        : [],
                    )

                  if (
                    isSameDescription &&
                    isSameDescriptionRich &&
                    isSameMedia
                  ) {
                    return
                  }

                  updateSelectedGame({
                    descriptionRich: nextDescriptionRich,
                    description: nextDescription,
                    descriptionMedia: media,
                  })
                }}
              />
            </div>

            {(selectedGame?.creatorUserId ||
              selectedGame?.creator?.id ||
              availableOrganizersForSelect.length > 0 ||
              canEditSelectedGame) && (
              <div className="p-4 border rounded-xl border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                  Организатор игры
                </h3>
                <div className="mt-3">
                  <CabinetSelectField
                    id="edit-game-organizer"
                    label={null}
                    value={String(
                      selectedGame?.creatorUserId ||
                        selectedGame?.creator?.id ||
                        '',
                    )}
                    onChange={(event) => {
                      const nextUserId = String(event.target.value || '').trim()
                      const nextOrganizer = organizersByUserId.get(nextUserId)
                      updateSelectedGame({
                        creatorUserId: nextUserId,
                        creatorTelegramId: nextOrganizer?.telegramId || '',
                        creator: nextOrganizer
                          ? {
                              id: nextOrganizer.id || '',
                              name: nextOrganizer.name || '',
                              username: nextOrganizer.username || '',
                              telegramId: nextOrganizer.telegramId || '',
                            }
                          : null,
                      })
                    }}
                    containerClassName="w-full space-y-0"
                    selectClassName="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                  >
                    <option value="">Выберите организатора</option>
                    {availableOrganizersForSelect.map((organizer) => {
                      const labelParts = [organizer.name || 'Без имени']
                      if (organizer.username) {
                        labelParts.push(`@${organizer.username}`)
                      }
                      if (organizer.telegramId) {
                        labelParts.push(`ID: ${organizer.telegramId}`)
                      }

                      return (
                        <option key={organizer.id} value={organizer.id}>
                          {labelParts.join(' · ')}
                        </option>
                      )
                    })}
                  </CabinetSelectField>
                  {availableOrganizersForSelect.length === 0 && (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                      Нет доступных пользователей для выбора организатора.
                    </p>
                  )}
                </div>
              </div>
            )}

            {(selectedGameModerators.length > 0 || canEditSelectedGame) && (
              <div className="p-4 border rounded-xl border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                  Модераторы игры
                </h3>
                {selectedGameModerators.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {selectedGameModerators.map((moderator) => {
                      const moderatorId =
                        typeof moderator === 'string' ? moderator : moderator.id
                      const fallback =
                        typeof moderator === 'string'
                          ? availableModeratorsMap.get(moderator)
                          : null
                      const name =
                        typeof moderator === 'string'
                          ? (fallback?.name ?? 'Без имени')
                          : moderator.name || 'Без имени'
                      const username =
                        typeof moderator === 'string'
                          ? (fallback?.username ?? '')
                          : moderator.username || ''
                      const telegramId =
                        typeof moderator === 'string'
                          ? (fallback?.telegramId ?? '')
                          : moderator.telegramId || ''

                      return (
                        <li
                          key={moderatorId}
                          className="flex items-center justify-between gap-3 px-3 py-2 bg-white border rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/80"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">
                              {name}
                            </p>
                            {username && (
                              <p className="text-xs text-slate-500">
                                @{username}
                              </p>
                            )}
                            {telegramId && (
                              <p className="text-xs text-slate-500">
                                ID: {telegramId}
                              </p>
                            )}
                          </div>
                          {canEditSelectedGame && (
                            <CabinetButton
                              onClick={() => handleRemoveModerator(moderatorId)}
                              variant="secondary"
                              tone="danger"
                              size="sm"
                              className="inline-flex items-center justify-center py-1"
                            >
                              Удалить
                            </CabinetButton>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">
                    Модераторы пока не назначены.
                  </p>
                )}

                {canEditSelectedGame && (
                  <div className="flex flex-col gap-3 pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                    <p className={fieldLabelClassName}>Добавить модератора</p>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <CabinetSelectField
                        id="edit-game-moderator"
                        label={null}
                        value={selectedModeratorToAdd}
                        onChange={(event) =>
                          setSelectedModeratorToAdd(event.target.value)
                        }
                        containerClassName="w-full space-y-0"
                        selectClassName="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                      >
                        <option value="">Выберите модератора</option>
                        {availableModeratorsForSelect.map((moderator) => {
                          const labelParts = [moderator.name || 'Без имени']
                          if (moderator.username) {
                            labelParts.push(`@${moderator.username}`)
                          }
                          if (moderator.telegramId) {
                            labelParts.push(`ID: ${moderator.telegramId}`)
                          }

                          return (
                            <option key={moderator.id} value={moderator.id}>
                              {labelParts.join(' · ')}
                            </option>
                          )
                        })}
                      </CabinetSelectField>
                      <CabinetButton
                        onClick={handleAddModerator}
                        disabled={!selectedModeratorToAdd}
                        variant="primary"
                        size="md"
                      >
                        Добавить
                      </CabinetButton>
                    </div>
                    {availableModeratorsForSelect.length === 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-300">
                        Все доступные модераторы уже назначены на эту игру.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="p-4 border rounded-xl border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                Агенты игры
              </h3>

              <div className="grid gap-3 mt-3 sm:grid-cols-2">
                <NeonCheckbox
                  id="agent-notify-previous-task"
                  checked={Boolean(
                    selectedGame.agentNotifications?.onPreviousTask ?? true,
                  )}
                  onChange={(eventOrChecked) =>
                    updateSelectedGame({
                      agentNotifications: {
                        ...(selectedGame.agentNotifications || {}),
                        onPreviousTask: getCheckboxChecked(eventOrChecked),
                      },
                    })
                  }
                  label="Уведомлять на предыдущем задании"
                  labelClassName="text-sm text-slate-600 dark:text-slate-200"
                />
                <NeonCheckbox
                  id="agent-notify-current-task"
                  checked={Boolean(
                    selectedGame.agentNotifications?.onCurrentTask ?? true,
                  )}
                  onChange={(eventOrChecked) =>
                    updateSelectedGame({
                      agentNotifications: {
                        ...(selectedGame.agentNotifications || {}),
                        onCurrentTask: getCheckboxChecked(eventOrChecked),
                      },
                    })
                  }
                  label="Уведомлять на задании агента"
                  labelClassName="text-sm text-slate-600 dark:text-slate-200"
                />
                <NeonCheckbox
                  id="agent-notify-task-completed"
                  checked={Boolean(
                    selectedGame.agentNotifications?.onTaskCompleted ?? false,
                  )}
                  onChange={(eventOrChecked) =>
                    updateSelectedGame({
                      agentNotifications: {
                        ...(selectedGame.agentNotifications || {}),
                        onTaskCompleted: getCheckboxChecked(eventOrChecked),
                      },
                    })
                  }
                  label="Уведомлять о прохождении задания"
                  labelClassName="text-sm text-slate-600 dark:text-slate-200"
                />
                <NeonCheckbox
                  id="agent-notify-all-passed"
                  checked={Boolean(
                    selectedGame.agentNotifications?.onAllTeamsPassed ?? true,
                  )}
                  onChange={(eventOrChecked) =>
                    updateSelectedGame({
                      agentNotifications: {
                        ...(selectedGame.agentNotifications || {}),
                        onAllTeamsPassed: getCheckboxChecked(eventOrChecked),
                      },
                    })
                  }
                  label="Уведомлять, когда все команды прошли"
                  labelClassName="text-sm text-slate-600 dark:text-slate-200"
                />
              </div>

              {selectedGameAgents.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {selectedGameAgents.map((agent) => (
                    <li
                      key={agent.userId}
                      className="flex items-center justify-between gap-3 px-3 py-2 bg-white border rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/80"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">
                          {agent.name || 'Без имени'}
                        </p>
                        {agent.username ? (
                          <p className="text-xs text-slate-500">
                            @{agent.username}
                          </p>
                        ) : null}
                        {agent.telegramId ? (
                          <p className="text-xs text-slate-500">
                            ID: {agent.telegramId}
                          </p>
                        ) : null}
                      </div>
                      {canEditSelectedGame ? (
                        <CabinetButton
                          onClick={() => handleRemoveAgent(agent.userId)}
                          variant="secondary"
                          tone="danger"
                          size="sm"
                          className="inline-flex items-center justify-center py-1"
                        >
                          Удалить
                        </CabinetButton>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">
                  Агенты пока не назначены.
                </p>
              )}

              {canEditSelectedGame ? (
                <div className="flex flex-col gap-3 pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                  <p className={fieldLabelClassName}>Добавить агента</p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <CabinetSelectField
                      id="edit-game-agent"
                      label={null}
                      value={selectedAgentToAdd}
                      onChange={(event) =>
                        setSelectedAgentToAdd(event.target.value)
                      }
                      containerClassName="w-full space-y-0"
                      selectClassName="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                    >
                      <option value="">Выберите агента</option>
                      {availableAgentsForSelect.map((agent) => {
                        const labelParts = [agent.name || 'Без имени']
                        if (agent.username) {
                          labelParts.push(`@${agent.username}`)
                        }
                        if (agent.telegramId) {
                          labelParts.push(`ID: ${agent.telegramId}`)
                        }

                        return (
                          <option key={agent.id} value={agent.id}>
                            {labelParts.join(' · ')}
                          </option>
                        )
                      })}
                    </CabinetSelectField>
                    <CabinetButton
                      onClick={handleAddAgent}
                      disabled={!selectedAgentToAdd}
                      variant="primary"
                      size="md"
                    >
                      Добавить
                    </CabinetButton>
                  </div>
                  {availableAgentsForSelect.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-300">
                      Нет доступных пользователей с ролью агента или все агенты
                      уже назначены.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </ModalSection>
        )}

        {!isTasksOnly && (
          <ModalSection>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              Настройки заданий и подсказок
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <CabinetDurationField
                id="game-task-duration"
                label="Продолжительность задания"
                valueSeconds={selectedGame.taskDuration}
                onChangeSeconds={(nextSeconds) =>
                  updateSelectedGame({
                    taskDuration: nextSeconds,
                  })
                }
                labelClassName={fieldLabelClassName}
              />
              <div>
                <CabinetDurationField
                  id="game-clues-duration"
                  label="Время до подсказки"
                  valueSeconds={selectedGame.cluesDuration}
                  onChangeSeconds={(nextSeconds) =>
                    updateSelectedGame({
                      cluesDuration: nextSeconds,
                    })
                  }
                  labelClassName={fieldLabelClassName}
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-200">
                  Укажите 0, чтобы отключить автоматическую выдачу подсказок.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <CabinetSelectField
                id="game-clue-mode"
                label="Режим досрочной подсказки"
                value={selectedGame.clueEarlyAccessMode}
                onChange={(event) =>
                  updateSelectedGame({
                    clueEarlyAccessMode: event.target.value,
                  })
                }
                labelClassName={fieldLabelClassName}
                selectClassName={fieldSelectClassName}
              >
                {CLUE_EARLY_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </CabinetSelectField>
              <CabinetDurationField
                id="game-clue-penalty"
                label={
                  selectedGame.clueEarlyAccessMode === 'penalty'
                    ? 'Штраф за досрочную подсказку'
                    : 'Дополнительное время после подсказки'
                }
                valueSeconds={selectedGame.clueEarlyPenalty}
                onChangeSeconds={(nextSeconds) =>
                  updateSelectedGame({
                    clueEarlyPenalty: nextSeconds,
                  })
                }
                labelClassName={fieldLabelClassName}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <CabinetDurationField
                id="game-break-duration"
                label="Перерыв между заданиями"
                valueSeconds={selectedGame.breakDuration}
                onChangeSeconds={(nextSeconds) =>
                  updateSelectedGame({
                    breakDuration: nextSeconds,
                  })
                }
                labelClassName={fieldLabelClassName}
              />
              {selectedGame.type === 'photo' ? (
                <CabinetNumberField
                  id="game-task-penalty"
                  label="Штраф за невыполненное задание (баллы)"
                  min="0"
                  value={Number(selectedGame.taskFailurePenalty) || 0}
                  onChange={(event) =>
                    updateSelectedGame({
                      taskFailurePenalty: Math.max(
                        0,
                        Number(event.target.value) || 0,
                      ),
                    })
                  }
                  inputClassName={fieldInputClassName}
                  labelClassName={fieldLabelClassName}
                />
              ) : (
                <CabinetDurationField
                  id="game-task-penalty"
                  label="Штраф за невыполненное задание"
                  valueSeconds={selectedGame.taskFailurePenalty}
                  onChangeSeconds={(nextSeconds) =>
                    updateSelectedGame({
                      taskFailurePenalty: nextSeconds,
                    })
                  }
                  labelClassName={fieldLabelClassName}
                />
              )}
            </div>

            {selectedGame.type !== 'photo' && (
              <div className="grid gap-4 md:grid-cols-2">
                <CabinetNumberField
                  id="game-many-codes-limit"
                  label="Лимит неверных кодов для штрафа"
                  min="0"
                  value={selectedGame.manyCodesPenalty?.[0] ?? 0}
                  onChange={(event) =>
                    updateSelectedGame({
                      manyCodesPenalty: [
                        Math.max(0, Number(event.target.value) || 0),
                        selectedGame.manyCodesPenalty?.[1] ?? 0,
                      ],
                    })
                  }
                  inputClassName={fieldInputClassName}
                  labelClassName={fieldLabelClassName}
                />
                <CabinetDurationField
                  id="game-many-codes-penalty"
                  label="Штраф за превышение лимита"
                  valueSeconds={selectedGame.manyCodesPenalty?.[1] ?? 0}
                  onChangeSeconds={(nextSeconds) =>
                    updateSelectedGame({
                      manyCodesPenalty: [
                        selectedGame.manyCodesPenalty?.[0] ?? 0,
                        nextSeconds,
                      ],
                    })
                  }
                  labelClassName={fieldLabelClassName}
                />
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-3">
              <NeonCheckbox
                id="game-allow-force-clue"
                checked={Boolean(selectedGame.allowCaptainForceClue)}
                onChange={(eventOrChecked) =>
                  debugCheckboxUpdate(
                    'allowCaptainForceClue',
                    getCheckboxChecked(eventOrChecked),
                    (checked) => ({ allowCaptainForceClue: checked }),
                  )
                }
                label="Досрочные подсказки капитанам"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
              <NeonCheckbox
                id="game-allow-fail-task"
                checked={Boolean(selectedGame.allowCaptainFailTask)}
                onChange={(eventOrChecked) =>
                  debugCheckboxUpdate(
                    'allowCaptainFailTask',
                    getCheckboxChecked(eventOrChecked),
                    (checked) => ({ allowCaptainFailTask: checked }),
                  )
                }
                label="Слив задания капитаном"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
              <NeonCheckbox
                id="game-allow-finish-break"
                checked={Boolean(selectedGame.allowCaptainFinishBreak)}
                onChange={(eventOrChecked) =>
                  debugCheckboxUpdate(
                    'allowCaptainFinishBreak',
                    getCheckboxChecked(eventOrChecked),
                    (checked) => ({ allowCaptainFinishBreak: checked }),
                  )
                }
                label="Досрочное завершение перерыва"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
            </div>
          </ModalSection>
        )}

        {isTasksOnly && (
          <ModalSection>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                Задания
              </h2>
            </div>
            {String(selectedGame?.status || '')
              .trim()
              .toLowerCase() === 'started' && startedGameLockedTaskCount > 0 ? (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                Первые {startedGameLockedTaskCount}{' '}
                {startedGameLockedTaskCount === 1
                  ? 'задание уже пройдено'
                  : startedGameLockedTaskCount < 5
                    ? 'задания уже пройдены'
                    : 'заданий уже пройдено'}{' '}
                и не могут менять порядок.
              </p>
            ) : null}

            {selectedGame.tasks?.length > 0 ? (
              <div className="space-y-4">
                {selectedGame.tasks.map((task, index) => {
                  const isExpanded = expandedTaskIds.includes(task.id)
                  const isTaskOrderLocked = isTaskReorderLocked(index)
                  const canDragTask =
                    canEditSelectedGame && !isSaving && !isTaskOrderLocked
                  const isDragOver = dragOverTaskId === task.id
                  const isDraggingCurrent = draggedTaskId === task.id
                  const taskTitle =
                    typeof task?.title === 'string' ? task.title.trim() : ''
                  const taskDescription = getTaskDescriptionText(task).trim()
                  const hasTaskMedia =
                    Array.isArray(task?.taskMedia) &&
                    task.taskMedia.some((item) => {
                      if (!item || typeof item !== 'object') {
                        return false
                      }
                      const type =
                        typeof item.type === 'string' ? item.type.trim() : ''
                      const url =
                        typeof item.url === 'string' ? item.url.trim() : ''
                      const path =
                        typeof item.path === 'string' ? item.path.trim() : ''
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
                  const normalizedCodes = (
                    Array.isArray(task?.codes) ? task.codes : []
                  )
                    .map((codeValue) =>
                      typeof codeValue === 'string' ? codeValue.trim() : '',
                    )
                    .filter(Boolean)
                  const codeDuplicateCounts = normalizedCodes.reduce(
                    (acc, codeValue) => {
                      const key = normalizeCodeDuplicateKey(codeValue)
                      if (!key) return acc
                      acc.set(key, (acc.get(key) || 0) + 1)
                      return acc
                    },
                    new Map(),
                  )
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
                    (typeof task?.postMessage === 'string' &&
                      task.postMessage.trim() !== '') ||
                    stripHtmlToPlainText(task?.postMessageRich).trim() !== '' ||
                    hasMeaningfulRichMarkup(task?.postMessageRich) ||
                    (Array.isArray(task?.postMessageMedia) &&
                      task.postMessageMedia.length > 0)
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
                        if (
                          !draggedTaskId ||
                          draggedTaskId === task.id ||
                          isTaskOrderLocked
                        ) {
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
                        if (!sourceTaskId || sourceTaskId === task.id) {
                          return
                        }
                        const sourceIndex = (
                          selectedGame.tasks || []
                        ).findIndex((item) => item.id === sourceTaskId)
                        const targetIndex = (
                          selectedGame.tasks || []
                        ).findIndex((item) => item.id === task.id)
                        if (sourceIndex < 0 || targetIndex < 0) {
                          return
                        }
                        handleReorderTask(sourceIndex, targetIndex)
                      }}
                    >
                      <div className="flex items-stretch w-full bg-slate-50 dark:bg-slate-800/70">
                        <button
                          type="button"
                          draggable={canDragTask}
                          onPointerDown={(event) =>
                            handleTaskHandlePointerDown(
                              task.id,
                              canDragTask,
                              event,
                            )
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
                            event.dataTransfer.setData(
                              'text/plain',
                              String(task.id),
                            )
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
                              <circle
                                cx="7"
                                cy="6"
                                r="1.2"
                                fill="currentColor"
                              />
                              <circle
                                cx="13"
                                cy="6"
                                r="1.2"
                                fill="currentColor"
                              />
                              <circle
                                cx="7"
                                cy="10"
                                r="1.2"
                                fill="currentColor"
                              />
                              <circle
                                cx="13"
                                cy="10"
                                r="1.2"
                                fill="currentColor"
                              />
                              <circle
                                cx="7"
                                cy="14"
                                r="1.2"
                                fill="currentColor"
                              />
                              <circle
                                cx="13"
                                cy="14"
                                r="1.2"
                                fill="currentColor"
                              />
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
                                {(Array.isArray(task.bonusCodes)
                                  ? task.bonusCodes.length
                                  : 0) > 0 ? (
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
                                  Подсказок:{' '}
                                  {Array.isArray(task.clues)
                                    ? task.clues.length
                                    : 0}
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
                                <svg
                                  viewBox="0 0 24 24"
                                  className="w-4 h-4"
                                  aria-hidden="true"
                                >
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
                                onClick={() =>
                                  handleSaveAndOpenTaskPreview(index)
                                }
                                disabled={isSaving}
                              >
                                Сохранить и открыть предпросмотр
                              </CabinetButton>
                            </div>
                            <div className="flex flex-col gap-2 md:items-start">
                              <NeonCheckbox
                                id={`task-is-bonus-${task.id}`}
                                checked={Boolean(task.isBonusTask)}
                                onChange={(eventOrChecked) =>
                                  (() => {
                                    const checked =
                                      getCheckboxChecked(eventOrChecked)
                                    try {
                                      handleTaskCheckboxChange(
                                        task.id,
                                        'isBonusTask',
                                        checked,
                                      )
                                    } catch (error) {
                                      console.error(
                                        '[GameEditModal] Ошибка обновления чекбокса задания',
                                        {
                                          source: 'task.isBonusTask',
                                          taskId: task.id,
                                          checked,
                                          gameId: selectedGame?.id ?? null,
                                          error,
                                        },
                                      )
                                    }
                                  })()
                                }
                                label="Бонусное задание"
                                labelClassName="text-sm text-slate-600 dark:text-slate-200"
                              />
                              <NeonCheckbox
                                id={`task-canceled-${task.id}`}
                                checked={Boolean(task.canceled)}
                                onChange={(eventOrChecked) =>
                                  (() => {
                                    const checked =
                                      getCheckboxChecked(eventOrChecked)
                                    try {
                                      handleTaskCheckboxChange(
                                        task.id,
                                        'canceled',
                                        checked,
                                      )
                                    } catch (error) {
                                      console.error(
                                        '[GameEditModal] Ошибка обновления чекбокса задания',
                                        {
                                          source: 'task.canceled',
                                          taskId: task.id,
                                          checked,
                                          gameId: selectedGame?.id ?? null,
                                          error,
                                        },
                                      )
                                    }
                                  })()
                                }
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
                                handleTaskFieldChange(
                                  task.id,
                                  'title',
                                  event.target.value,
                                )
                              }
                              labelClassName={fieldLabelClassName}
                              inputClassName={fieldInputClassName}
                            />
                            <div className="space-y-2">
                              <p className={fieldLabelClassName}>
                                Агенты задания
                              </p>
                              {selectedGameAgents.length > 0 ? (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {selectedGameAgents.map((agent) => {
                                    const checked = (
                                      Array.isArray(task.agentUserIds)
                                        ? task.agentUserIds
                                        : []
                                    ).includes(agent.userId)
                                    return (
                                      <label
                                        key={`${task.id}-${agent.userId}`}
                                        className="flex items-start gap-2 px-3 py-2 text-sm bg-white border rounded-xl border-slate-200 text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          disabled={
                                            !canEditSelectedGame || isSaving
                                          }
                                          onChange={(event) => {
                                            const current = Array.isArray(
                                              task.agentUserIds,
                                            )
                                              ? task.agentUserIds
                                              : []
                                            const next = event.target.checked
                                              ? Array.from(
                                                  new Set([
                                                    ...current,
                                                    agent.userId,
                                                  ]),
                                                )
                                              : current.filter(
                                                  (id) =>
                                                    String(id) !==
                                                    String(agent.userId),
                                                )
                                            handleTaskFieldChange(
                                              task.id,
                                              'agentUserIds',
                                              next,
                                            )
                                          }}
                                          className="mt-0.5 rounded border-slate-400 text-cyan-600 focus:ring-cyan-500/40"
                                        />
                                        <span>
                                          <span className="font-semibold">
                                            {agent.name || 'Без имени'}
                                          </span>
                                          {agent.username ? (
                                            <span className="block text-xs text-slate-500">
                                              @{agent.username}
                                            </span>
                                          ) : null}
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
                                type:
                                  selectedGame.type === 'photo'
                                    ? 'photo'
                                    : 'classic',
                                location: selectedGame.location || '',
                              }}
                              disabled={!canEditSelectedGame || isSaving}
                              placeholder="Введите описание задания. Можно использовать форматирование, картинки и аудио."
                              onChange={({ html, plainText, media }) => {
                                const nextTaskText =
                                  plainText || stripHtmlToPlainText(html || '')
                                const nextTaskRich =
                                  typeof html === 'string' ? html : ''
                                const currentTaskText =
                                  typeof task.task === 'string' ? task.task : ''
                                const currentTaskRich =
                                  typeof task.taskRich === 'string'
                                    ? task.taskRich
                                    : ''
                                const isSameTaskText =
                                  normalizeComparablePlainText(nextTaskText) ===
                                  normalizeComparablePlainText(currentTaskText)
                                const isSameTaskRich =
                                  normalizeComparableRichText(
                                    nextTaskRich,
                                    nextTaskText,
                                  ) ===
                                  normalizeComparableRichText(
                                    currentTaskRich,
                                    currentTaskText,
                                  )
                                const isSameTaskMedia =
                                  JSON.stringify(
                                    Array.isArray(media) ? media : [],
                                  ) ===
                                  JSON.stringify(
                                    Array.isArray(task.taskMedia)
                                      ? task.taskMedia
                                      : [],
                                  )

                                if (
                                  isSameTaskText &&
                                  isSameTaskRich &&
                                  isSameTaskMedia
                                ) {
                                  return
                                }

                                handleTaskFieldChange(
                                  task.id,
                                  'taskRich',
                                  nextTaskRich,
                                )
                                handleTaskFieldChange(
                                  task.id,
                                  'task',
                                  nextTaskText,
                                )
                                handleTaskFieldChange(
                                  task.id,
                                  'taskMedia',
                                  media,
                                )
                              }}
                            />
                          </div>

                          <div>
                            <div>
                              <h4 className="text-sm font-semibold text-slate-700 dark:text-white">
                                {withRequiredMark('Подсказки')}
                              </h4>
                            </div>
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
                                      const isOpen = Boolean(
                                        event.currentTarget?.open,
                                      )
                                      setExpandedClueAccordions((prev) => {
                                        const next = new Set(prev)
                                        if (isOpen) {
                                          next.add(accordionKey)
                                        } else {
                                          next.delete(accordionKey)
                                        }
                                        return next
                                      })
                                    }}
                                    className={`relative overflow-hidden rounded-2xl border bg-slate-50 p-0 transition dark:bg-slate-800/60 ${
                                      dragOverClueMeta &&
                                      String(dragOverClueMeta.taskId) ===
                                        String(task.id) &&
                                      String(dragOverClueMeta.clueId) ===
                                        String(clue.id)
                                        ? 'border-cyan-500 ring-1 ring-cyan-500/40 dark:border-cyan-400 dark:ring-cyan-400/40'
                                        : draggedClueMeta &&
                                            String(draggedClueMeta.taskId) ===
                                              String(task.id) &&
                                            String(draggedClueMeta.clueId) ===
                                              String(clue.id)
                                          ? 'border-cyan-500/80 opacity-85 ring-2 ring-cyan-400/30 dark:border-cyan-400 dark:ring-cyan-300/30'
                                          : 'border-slate-200 dark:border-slate-700'
                                    }`}
                                    onDragEnd={resetTouchClueDragState}
                                    onDragOver={(event) => {
                                      if (
                                        !draggedClueMeta ||
                                        String(draggedClueMeta.taskId) !==
                                          String(task.id) ||
                                        String(draggedClueMeta.clueId) ===
                                          String(clue.id)
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
                                        String(dragOverClueMeta.taskId) ===
                                          String(task.id) &&
                                        String(dragOverClueMeta.clueId) ===
                                          String(clue.id)
                                      ) {
                                        setDragOverClueMeta(null)
                                      }
                                    }}
                                    onDrop={(event) => {
                                      event.preventDefault()
                                      const transfer = String(
                                        event.dataTransfer.getData(
                                          'text/plain',
                                        ) || '',
                                      )
                                      const [taskIdRaw, clueIdRaw] =
                                        transfer.split(':')
                                      const sourceTaskId = String(
                                        draggedClueMeta?.taskId ||
                                          taskIdRaw ||
                                          '',
                                      )
                                      const sourceClueId = String(
                                        draggedClueMeta?.clueId ||
                                          clueIdRaw ||
                                          '',
                                      )
                                      setDragOverClueMeta(null)
                                      setDraggedClueMeta(null)
                                      if (
                                        !sourceTaskId ||
                                        !sourceClueId ||
                                        String(sourceTaskId) !==
                                          String(task.id) ||
                                        String(sourceClueId) === String(clue.id)
                                      ) {
                                        return
                                      }
                                      const clues = Array.isArray(task?.clues)
                                        ? task.clues
                                        : []
                                      const sourceIndex = clues.findIndex(
                                        (item) =>
                                          String(item?.id) ===
                                          String(sourceClueId),
                                      )
                                      const targetIndex = clues.findIndex(
                                        (item) =>
                                          String(item?.id) === String(clue.id),
                                      )
                                      if (sourceIndex < 0 || targetIndex < 0) {
                                        return
                                      }
                                      handleReorderClue(
                                        String(task.id),
                                        sourceIndex,
                                        targetIndex,
                                      )
                                    }}
                                  >
                                    <summary
                                      className={`relative w-full max-w-full min-h-[56px] overflow-hidden text-sm font-medium list-none cursor-pointer text-slate-700 marker:content-none dark:text-slate-100 ${
                                        expandedClueAccordions.has(
                                          `${task.id}-clue-${clue.id}`,
                                        )
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
                                        onPointerMove={
                                          handleClueHandlePointerMove
                                        }
                                        onPointerUp={handleClueHandlePointerUp}
                                        onPointerCancel={
                                          resetTouchClueDragState
                                        }
                                        onLostPointerCapture={
                                          resetTouchClueDragState
                                        }
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
                                          event.dataTransfer.effectAllowed =
                                            'move'
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
                                              String(draggedClueMeta.clueId) ===
                                                String(clue.id)
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
                                        <svg
                                          viewBox="0 0 20 20"
                                          className="w-4 h-4"
                                        >
                                          <circle
                                            cx="7"
                                            cy="6"
                                            r="1.1"
                                            fill="currentColor"
                                          />
                                          <circle
                                            cx="13"
                                            cy="6"
                                            r="1.1"
                                            fill="currentColor"
                                          />
                                          <circle
                                            cx="7"
                                            cy="10"
                                            r="1.1"
                                            fill="currentColor"
                                          />
                                          <circle
                                            cx="13"
                                            cy="10"
                                            r="1.1"
                                            fill="currentColor"
                                          />
                                          <circle
                                            cx="7"
                                            cy="14"
                                            r="1.1"
                                            fill="currentColor"
                                          />
                                          <circle
                                            cx="13"
                                            cy="14"
                                            r="1.1"
                                            fill="currentColor"
                                          />
                                        </svg>
                                      </button>
                                      <div className="absolute top-0 left-8 shrink-0 rounded-br-full border-b border-r border-cyan-300/70 bg-cyan-100/70 px-3 py-0 text-[11px] font-semibold text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">
                                        {`Подсказка ${clueIndex + 1}`}
                                      </div>
                                      <div className="grid h-full w-full max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 pt-3 pb-2 pl-9">
                                        <div className="flex items-center w-full max-w-full min-w-0 gap-2 mt-3 overflow-hidden">
                                          <span className="flex-1 block min-w-0 overflow-hidden">
                                            <span className="block w-full font-semibold truncate">
                                              {getClueText(clue) ||
                                                `${clueIndex + 1}`}
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
                                          description:
                                            selectedGame.description || '',
                                          dateStart:
                                            selectedGame.dateStart || '',
                                          type:
                                            selectedGame.type === 'photo'
                                              ? 'photo'
                                              : 'classic',
                                          location: selectedGame.location || '',
                                        }}
                                        disabled={
                                          !canEditSelectedGame || isSaving
                                        }
                                        placeholder="Введите текст подсказки. Можно использовать форматирование, картинки и аудио."
                                        onChange={({ html, plainText }) => {
                                          const nextClueText =
                                            plainText ||
                                            stripHtmlToPlainText(html || '')
                                          const nextClueRich =
                                            typeof html === 'string' ? html : ''
                                          const currentClueText =
                                            typeof clue.clue === 'string'
                                              ? clue.clue
                                              : ''
                                          const currentClueRich =
                                            typeof clue.clueRich === 'string'
                                              ? clue.clueRich
                                              : ''
                                          const isSameClueText =
                                            normalizeComparablePlainText(
                                              nextClueText,
                                            ) ===
                                            normalizeComparablePlainText(
                                              currentClueText,
                                            )
                                          const isSameClueRich =
                                            normalizeComparableRichText(
                                              nextClueRich,
                                              nextClueText,
                                            ) ===
                                            normalizeComparableRichText(
                                              currentClueRich,
                                              currentClueText,
                                            )

                                          if (
                                            isSameClueText &&
                                            isSameClueRich
                                          ) {
                                            return
                                          }

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
                                          onClick={() =>
                                            handleRemoveClue(task.id, clue.id)
                                          }
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

                          <CabinetTextareaField
                            id={`task-how-to-solve-${task.id}`}
                            label="Как разгадать?"
                            rows={4}
                            value={task.howToSolve || ''}
                            onChange={(event) =>
                              handleTaskFieldChange(
                                task.id,
                                'howToSolve',
                                event.target.value,
                              )
                            }
                            labelClassName={fieldLabelClassName}
                            textareaClassName={fieldInputClassName}
                            placeholder="Кратко опишите логику разгадки для разбора после игры"
                          />

                          <div className="space-y-2">
                            <p className={fieldLabelClassName}>
                              Сообщение после выполнения
                            </p>
                            <TaskRichEditor
                              value={
                                task.postMessageRich || task.postMessage || ''
                              }
                              directory={`games/${selectedGame.id || 'draft'}/tasks/${task.id}/post-message/editor`}
                              contentMaxHeight="none"
                              disabled={!canEditSelectedGame || isSaving}
                              placeholder="Введите сообщение, которое команда увидит после выполнения задания."
                              onChange={({ html, plainText, media }) => {
                                const nextPostMessage =
                                  plainText || stripHtmlToPlainText(html || '')
                                const nextPostMessageRich =
                                  typeof html === 'string' ? html : ''
                                const currentPostMessage =
                                  typeof task.postMessage === 'string'
                                    ? task.postMessage
                                    : ''
                                const currentPostMessageRich =
                                  typeof task.postMessageRich === 'string'
                                    ? task.postMessageRich
                                    : ''
                                const currentPostMessageMedia = Array.isArray(
                                  task.postMessageMedia,
                                )
                                  ? task.postMessageMedia
                                  : []
                                const nextPostMessageMedia = Array.isArray(
                                  media,
                                )
                                  ? media
                                  : []

                                const isSamePostMessage =
                                  normalizeComparablePlainText(
                                    nextPostMessage,
                                  ) ===
                                  normalizeComparablePlainText(
                                    currentPostMessage,
                                  )
                                const isSamePostMessageRich =
                                  normalizeComparableRichText(
                                    nextPostMessageRich,
                                    nextPostMessage,
                                  ) ===
                                  normalizeComparableRichText(
                                    currentPostMessageRich,
                                    currentPostMessage,
                                  )
                                const isSamePostMessageMedia =
                                  JSON.stringify(nextPostMessageMedia) ===
                                  JSON.stringify(currentPostMessageMedia)

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
                                handleTaskFieldChange(
                                  task.id,
                                  'postMessage',
                                  nextPostMessage,
                                )
                                handleTaskFieldChange(
                                  task.id,
                                  'postMessageMedia',
                                  nextPostMessageMedia,
                                )
                              }}
                            />
                          </div>

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

                          {!isPhotoGame && (
                            <div>
                              <div>
                                <h4 className="text-sm font-semibold text-slate-700 dark:text-white">
                                  {withRequiredMark(
                                    `Коды задания (${formatCodeItemsCount(
                                      Array.isArray(task.codes)
                                        ? task.codes.length
                                        : 0,
                                    )})`,
                                  )}
                                </h4>
                              </div>
                              {task.codes?.length > 0 ? (
                                <div className="mt-3 space-y-3">
                                  {task.codes.map((codeValue, codeIndex) => {
                                    const accordionKey = `${task.id}-main-${codeIndex}`
                                    const isExpanded =
                                      expandedCodeAccordions.has(accordionKey)
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
                                          const isOpen = Boolean(
                                            event.currentTarget?.open,
                                          )
                                          setExpandedCodeAccordions((prev) => {
                                            const next = new Set(prev)
                                            if (isOpen) {
                                              next.add(accordionKey)
                                            } else {
                                              next.delete(accordionKey)
                                            }
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
                                                  {compactSingleLine(
                                                    codeValue,
                                                  ) || '-'}
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
                                                  aria-label="Код дублируется в этом задании"
                                                >
                                                  !
                                                </span>
                                              ) : null}
                                              <AccordionChevronIcon
                                                isOpen={isExpanded}
                                              />
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
                                            inputClassName={
                                              compactInputClassName
                                            }
                                          />
                                          <CabinetButton
                                            onClick={() =>
                                              handleRemoveTaskCode(
                                                task.id,
                                                codeIndex,
                                              )
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
                                              disabled={
                                                !canEditSelectedGame || isSaving
                                              }
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
                                            handleRemoveSubTask(
                                              task.id,
                                              subTask.id,
                                            )
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
                                        textareaClassName={
                                          compactInputClassName
                                        }
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

                          {!isPhotoGame && (
                            <div>
                              <div>
                                <h4 className="text-sm font-semibold text-slate-700 dark:text-white">
                                  Штрафные коды
                                </h4>
                              </div>
                              {task.penaltyCodes?.length > 0 ? (
                                <div className="mt-3 space-y-4">
                                  {task.penaltyCodes.map(
                                    (penalty, penaltyIndex) => {
                                      const accordionKey = `${task.id}-penalty-${penaltyIndex}`
                                      const isExpanded =
                                        expandedCodeAccordions.has(accordionKey)

                                      return (
                                        <details
                                          key={penalty.id}
                                          open={isExpanded}
                                          onToggle={(event) => {
                                            const isOpen = Boolean(
                                              event.currentTarget?.open,
                                            )
                                            setExpandedCodeAccordions(
                                              (prev) => {
                                                const next = new Set(prev)
                                                if (isOpen) {
                                                  next.add(accordionKey)
                                                } else {
                                                  next.delete(accordionKey)
                                                }
                                                return next
                                              },
                                            )
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
                                                    {compactSingleLine(
                                                      penalty.code,
                                                    ) || 'Код не указан'}
                                                  </span>
                                                </span>
                                                {truncateWithDots(
                                                  penalty.description,
                                                ) ? (
                                                  <span className="hidden max-w-[240px] shrink min-w-0 truncate text-xs font-normal text-slate-500 dark:text-slate-300 sm:block">
                                                    {truncateWithDots(
                                                      penalty.description,
                                                    )}
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
                                                <AccordionChevronIcon
                                                  isOpen={isExpanded}
                                                />
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
                                              labelClassName={
                                                compactLabelClassName
                                              }
                                              inputClassName={
                                                compactInputClassName
                                              }
                                            />
                                            <CabinetDurationField
                                              id={`task-penalty-value-${penalty.id}`}
                                              label="Штраф"
                                              valueSeconds={
                                                penalty.penalty ?? 0
                                              }
                                              onChangeSeconds={(nextSeconds) =>
                                                handlePenaltyCodeChange(
                                                  task.id,
                                                  penalty.id,
                                                  'penalty',
                                                  nextSeconds,
                                                )
                                              }
                                              containerClassName="space-y-1 md:col-span-2"
                                              labelClassName={
                                                compactLabelClassName
                                              }
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
                                            labelClassName={
                                              compactLabelClassName
                                            }
                                            inputClassName={
                                              compactInputClassName
                                            }
                                          />
                                          {canViewCodePhotos && (
                                            <div className="mt-2">
                                              <ImagesInput
                                                label="Фото кода"
                                                images={[
                                                  penalty.image || '',
                                                ].filter(Boolean)}
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
                                                disabled={
                                                  !canEditSelectedGame ||
                                                  isSaving
                                                }
                                                previewShape="square"
                                              />
                                            </div>
                                          )}
                                          <div className="flex justify-end">
                                            <CabinetButton
                                              onClick={() =>
                                                handleRemovePenaltyCode(
                                                  task.id,
                                                  penalty.id,
                                                )
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
                                    },
                                  )}
                                </div>
                              ) : (
                                <p className="mt-3 text-sm text-slate-500 dark:text-slate-200">
                                  Штрафных кодов пока нет.
                                </p>
                              )}
                              <div className="mt-3">
                                <CabinetButton
                                  onClick={() => {
                                    const nextIndex = Array.isArray(
                                      task?.penaltyCodes,
                                    )
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

                          {!isPhotoGame && (
                            <div>
                              <div>
                                <h4 className="text-sm font-semibold text-slate-700 dark:text-white">
                                  Бонусные коды
                                </h4>
                              </div>
                              {task.bonusCodes?.length > 0 ? (
                                <div className="mt-3 space-y-4">
                                  {task.bonusCodes.map((bonus, bonusIndex) => {
                                    const accordionKey = `${task.id}-bonus-${bonusIndex}`
                                    const isExpanded =
                                      expandedCodeAccordions.has(accordionKey)

                                    return (
                                      <details
                                        key={bonus.id}
                                        open={isExpanded}
                                        onToggle={(event) => {
                                          const isOpen = Boolean(
                                            event.currentTarget?.open,
                                          )
                                          setExpandedCodeAccordions((prev) => {
                                            const next = new Set(prev)
                                            if (isOpen) {
                                              next.add(accordionKey)
                                            } else {
                                              next.delete(accordionKey)
                                            }
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
                                                  {compactSingleLine(
                                                    bonus.code,
                                                  ) || 'Код не указан'}
                                                </span>
                                              </span>
                                              {truncateWithDots(
                                                bonus.description,
                                              ) ? (
                                                <span className="hidden max-w-[240px] shrink min-w-0 truncate text-xs font-normal text-slate-500 dark:text-slate-300 sm:block">
                                                  {truncateWithDots(
                                                    bonus.description,
                                                  )}
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
                                              <AccordionChevronIcon
                                                isOpen={isExpanded}
                                              />
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
                                            labelClassName={
                                              compactLabelClassName
                                            }
                                            inputClassName={
                                              compactInputClassName
                                            }
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
                                            labelClassName={
                                              compactLabelClassName
                                            }
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
                                              images={[
                                                bonus.image || '',
                                              ].filter(Boolean)}
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
                                              disabled={
                                                !canEditSelectedGame || isSaving
                                              }
                                              previewShape="square"
                                            />
                                          </div>
                                        )}
                                        <div className="flex justify-end">
                                          <CabinetButton
                                            onClick={() =>
                                              handleRemoveBonusCode(
                                                task.id,
                                                bonus.id,
                                              )
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
                                    const nextIndex = Array.isArray(
                                      task?.bonusCodes,
                                    )
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

                          <div className="flex justify-end">
                            <CabinetButton
                              onClick={() => {
                                if (
                                  typeof window !== 'undefined' &&
                                  !window.confirm(
                                    `Удалить задание «${
                                      task.title || `№${index + 1}`
                                    }»? Это действие нельзя отменить.`,
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
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-200">
                Пока нет заданий. Добавьте первое, чтобы начать.
              </p>
            )}
            <div className="mt-4">
              <CabinetButton onClick={handleAddTask} variant="primary">
                Добавить задание
              </CabinetButton>
            </div>
          </ModalSection>
        )}

        {!isTasksOnly && (
          <ModalSection>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              Публикация и результаты
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              <NeonCheckbox
                id="game-is-rated"
                checked={Boolean(selectedGame.isRated ?? true)}
                onChange={(eventOrChecked) =>
                  debugCheckboxUpdate(
                    'isRated',
                    getCheckboxChecked(eventOrChecked),
                    (checked) =>
                      checked
                        ? { isRated: true, hidden: false }
                        : { isRated: false },
                  )
                }
                label="Рейтинговая игра"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
              <NeonCheckbox
                id="game-hidden"
                checked={Boolean(selectedGame.hidden)}
                disabled={Boolean(selectedGame.isRated ?? true)}
                onChange={(eventOrChecked) =>
                  debugCheckboxUpdate(
                    'hidden',
                    getCheckboxChecked(eventOrChecked),
                    (checked) => ({ hidden: checked }),
                  )
                }
                label="Игра скрыта из общего списка"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
              <NeonCheckbox
                id="game-show-creator"
                checked={Boolean(selectedGame.showCreator)}
                onChange={(eventOrChecked) =>
                  debugCheckboxUpdate(
                    'showCreator',
                    getCheckboxChecked(eventOrChecked),
                    (checked) => ({ showCreator: checked }),
                  )
                }
                label="Показывать организатора игрокам"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
              <NeonCheckbox
                id="game-show-tasks"
                checked={Boolean(selectedGame.showTasks)}
                onChange={(eventOrChecked) =>
                  debugCheckboxUpdate(
                    'showTasks',
                    getCheckboxChecked(eventOrChecked),
                    (checked) => ({ showTasks: checked }),
                  )
                }
                label="Открыть задания после завершения"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
              <NeonCheckbox
                id="game-hide-result"
                checked={!Boolean(selectedGame.hideResult)}
                onChange={(eventOrChecked) =>
                  debugCheckboxUpdate(
                    'hideResult',
                    getCheckboxChecked(eventOrChecked),
                    (checked) => ({ hideResult: !checked }),
                  )
                }
                label="Показать результаты"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
              {!isClosedGame && (
                <NeonCheckbox
                  id="game-registration-open"
                  checked={Boolean(selectedGame.registrationOpen ?? true)}
                  onChange={(eventOrChecked) =>
                    debugCheckboxUpdate(
                      'registrationOpen',
                      getCheckboxChecked(eventOrChecked),
                      (checked) => ({ registrationOpen: checked }),
                    )
                  }
                  label="Запись на игру открыта"
                  labelClassName="text-sm text-slate-600 dark:text-slate-200"
                />
              )}
              {!isClosedGame && (
                <NeonCheckbox
                  id="game-show-enter-button"
                  checked={Boolean(selectedGame.showEnterButton)}
                  onChange={(eventOrChecked) =>
                    debugCheckboxUpdate(
                      'showEnterButton',
                      getCheckboxChecked(eventOrChecked),
                      (checked) => ({ showEnterButton: checked }),
                    )
                  }
                  label="Показывать кнопку «Зайти в игру» до запуска"
                  labelClassName="text-sm text-slate-600 dark:text-slate-200"
                />
              )}
              <div className="p-3 border rounded-2xl border-slate-200 dark:border-slate-700">
                <NeonCheckbox
                  id="game-max-team-players-unlimited"
                  checked={selectedGame.maxTeamPlayers === null}
                  onChange={(eventOrChecked) =>
                    debugCheckboxUpdate(
                      'maxTeamPlayers',
                      getCheckboxChecked(eventOrChecked),
                      (checked) => ({
                        maxTeamPlayers: checked
                          ? null
                          : Number(selectedGame.maxTeamPlayers) > 0
                            ? Number(selectedGame.maxTeamPlayers)
                            : 4,
                      }),
                    )
                  }
                  label="Размер команды: без ограничений"
                  labelClassName="text-sm text-slate-600 dark:text-slate-200"
                />
                {selectedGame.maxTeamPlayers !== null ? (
                  <div className="mt-3">
                    <CabinetNumberField
                      id="game-max-team-players"
                      label="Максимум игроков в команде"
                      min={1}
                      step={1}
                      value={Number(selectedGame.maxTeamPlayers) || ''}
                      onChange={(event) =>
                        updateSelectedGame({
                          maxTeamPlayers:
                            event.target.value === ''
                              ? null
                              : Math.max(1, Number(event.target.value) || 1),
                        })
                      }
                      labelClassName={fieldLabelClassName}
                      inputClassName={fieldInputClassName}
                      placeholder="Например, 4"
                    />
                  </div>
                ) : null}
              </div>
            </div>
            {Boolean(selectedGame.isRated ?? true) && (
              <div className="p-4 mt-3 border rounded-2xl border-slate-200 dark:border-slate-700">
                <label
                  htmlFor="game-season"
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-100"
                >
                  Сезон
                </label>
                <div className="flex flex-col gap-2 mt-2 sm:flex-row">
                  <select
                    id="game-season"
                    value={
                      typeof selectedGame.seasonId === 'string'
                        ? selectedGame.seasonId
                        : ''
                    }
                    onChange={(event) => {
                      const seasonId = event.target.value
                      const selectedSeason = Array.isArray(editGameSeasons)
                        ? editGameSeasons.find(
                            (season) => season.id === seasonId,
                          )
                        : null
                      updateSelectedGame({
                        seasonId,
                        seasonName: selectedSeason?.name || '',
                      })
                    }}
                    disabled={
                      isEditGameSeasonsLoading ||
                      !canEditSelectedGame ||
                      isSaving
                    }
                    className="w-full px-3 py-2 text-sm border rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
                  >
                    <option value="">
                      {isEditGameSeasonsLoading
                        ? 'Загружаем сезоны…'
                        : 'Вне сезона'}
                    </option>
                    {Array.isArray(editGameSeasons) &&
                      editGameSeasons.map((season) => (
                        <option key={season.id} value={season.id}>
                          {season.name}
                        </option>
                      ))}
                  </select>
                  <CabinetButton
                    onClick={handleCreateSeasonForEditGame}
                    disabled={
                      !canEditSelectedGame ||
                      isEditGameSeasonCreating ||
                      isSaving
                    }
                    variant="secondary"
                    tone="brand"
                    size="sm"
                  >
                    {isEditGameSeasonCreating ? 'Создание…' : 'Создать сезон'}
                  </CabinetButton>
                </div>
              </div>
            )}
            <div className="pt-2">
              <CabinetButton
                onClick={handleGenerateResults}
                disabled={!canGenerateResults || isGeneratingResults}
                variant="soft"
                tone="cyan"
                size="md"
              >
                {generateResultsButtonLabel}
              </CabinetButton>
              {!canGenerateResults && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                  Доступно только для завершённых или закрытых игр.
                </p>
              )}
            </div>
          </ModalSection>
        )}

        {!isTasksOnly && (
          <ModalSection>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                Стоимость участия
              </h2>
              <CabinetButton
                onClick={handleAddPrice}
                variant="primary"
                size="sm"
              >
                Добавить тариф
              </CabinetButton>
            </div>

            {(selectedGame.prices ?? []).length > 0 ? (
              <div className="space-y-3">
                {selectedGame.prices.map((price) => (
                  <div
                    key={price.id}
                    className="grid gap-3 md:grid-cols-[2fr_1fr_auto] items-center p-4 border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/50 rounded-2xl"
                  >
                    <CabinetInputField
                      id={`game-price-name-${price.id}`}
                      label={null}
                      type="text"
                      value={price.name}
                      onChange={(event) =>
                        handlePriceChange(price.id, 'name', event.target.value)
                      }
                      placeholder="Название тарифа"
                      containerClassName="space-y-0 w-full"
                      inputClassName="w-full px-4 py-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                    />
                    <AmountStepperInput
                      value={price.price}
                      min={0}
                      step={100}
                      placeholder="Стоимость"
                      className="max-w-none"
                      inputClassName={amountInputClassName}
                      onChange={(nextValue) =>
                        handlePriceChange(price.id, 'price', nextValue)
                      }
                    />
                    <CabinetButton
                      onClick={() => handleRemovePrice(price.id)}
                      variant="secondary"
                      tone="danger"
                      size="sm"
                    >
                      Удалить
                    </CabinetButton>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-200">
                Добавьте тариф, чтобы задать стоимость участия для команд.
              </p>
            )}
          </ModalSection>
        )}

        {!isTasksOnly && (
          <ModalSection>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                Финансы игры
              </h2>
              <CabinetButton
                onClick={handleAddFinance}
                variant="primary"
                size="sm"
              >
                Добавить запись
              </CabinetButton>
            </div>

            {(selectedGame.finances ?? []).length > 0 ? (
              <div className="space-y-3">
                {selectedGame.finances.map((entry) => (
                  <div
                    key={entry.id}
                    className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] items-center p-4 border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/50 rounded-2xl"
                  >
                    <CabinetSelectField
                      id={`game-finance-type-${entry.id}`}
                      label={null}
                      value={entry.type}
                      onChange={(event) =>
                        handleFinanceChange(
                          entry.id,
                          'type',
                          event.target.value,
                        )
                      }
                      containerClassName="space-y-0 w-full"
                      selectClassName="w-full px-3 py-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                    >
                      <option value="income">Доход</option>
                      <option value="expense">Расход</option>
                    </CabinetSelectField>
                    <AmountStepperInput
                      value={entry.sum}
                      min={0}
                      step={100}
                      placeholder="Сумма"
                      className="max-w-none"
                      inputClassName={amountInputClassName}
                      onChange={(nextValue) =>
                        handleFinanceChange(entry.id, 'sum', nextValue)
                      }
                    />
                    <CabinetInputField
                      id={`game-finance-date-${entry.id}`}
                      label={null}
                      type="date"
                      value={entry.date ? formatDate(entry.date, true) : ''}
                      onChange={(event) =>
                        handleFinanceChange(
                          entry.id,
                          'date',
                          event.target.value,
                        )
                      }
                      containerClassName="space-y-0 w-full"
                      inputClassName="w-full px-3 py-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                    />
                    <CabinetButton
                      onClick={() => handleRemoveFinance(entry.id)}
                      variant="secondary"
                      tone="danger"
                      size="sm"
                    >
                      Удалить
                    </CabinetButton>
                    <div className="md:col-span-3">
                      <CabinetInputField
                        id={`game-finance-description-${entry.id}`}
                        label={null}
                        type="text"
                        value={entry.description}
                        onChange={(event) =>
                          handleFinanceChange(
                            entry.id,
                            'description',
                            event.target.value,
                          )
                        }
                        placeholder="Комментарий"
                        containerClassName="space-y-0 w-full"
                        inputClassName="w-full px-3 py-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-200">
                Пока нет финансовых записей по этой игре. Добавьте доходы и
                расходы, чтобы контролировать бюджет.
              </p>
            )}

            <div className="p-4 border bg-slate-50 border-slate-200 dark:border-slate-700 dark:bg-slate-800/60 rounded-2xl">
              <p className="text-sm text-slate-600 dark:text-slate-200">
                Доходы:{' '}
                <span className="font-semibold">
                  {currencyFormatter.format(financesSummary.income)}
                </span>
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-200">
                Расходы:{' '}
                <span className="font-semibold">
                  {currencyFormatter.format(financesSummary.expense)}
                </span>
              </p>
              <p className={`mt-1 text-sm font-semibold ${balanceClass}`}>
                Баланс: {currencyFormatter.format(financesSummary.balance)}
              </p>
            </div>
          </ModalSection>
        )}
        {draggedTaskGhost && dragGhostPosition ? (
          <div
            className="pointer-events-none fixed z-[140] w-[190px] overflow-hidden rounded-lg border border-cyan-400/50 bg-slate-900/80 px-0 py-0 shadow-xl ring-1 ring-cyan-400/20 backdrop-blur-[1px]"
            style={{
              left: `${dragGhostPosition.x}px`,
              top: `${dragGhostPosition.y}px`,
              transform: 'translate(18px, -50%)',
            }}
            aria-hidden="true"
          >
            <div className="flex items-center">
              <div className="inline-flex items-center justify-center w-8 h-10 border-r shrink-0 border-cyan-400/30 bg-slate-800/70 text-cyan-200">
                <svg viewBox="0 0 20 20" className="w-4 h-4">
                  <circle cx="7" cy="6" r="1.1" fill="currentColor" />
                  <circle cx="13" cy="6" r="1.1" fill="currentColor" />
                  <circle cx="7" cy="10" r="1.1" fill="currentColor" />
                  <circle cx="13" cy="10" r="1.1" fill="currentColor" />
                  <circle cx="7" cy="14" r="1.1" fill="currentColor" />
                  <circle cx="13" cy="14" r="1.1" fill="currentColor" />
                </svg>
              </div>
              <div className="min-w-0 px-2 py-1.5">
                <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-cyan-200/90">
                  Задание
                </div>
                <div className="text-xs font-semibold truncate text-white/95">
                  {draggedTaskGhost?.title || 'Без названия'}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {draggedClueGhost && dragClueGhostPosition ? (
          <div
            className="pointer-events-none fixed z-[141] w-[210px] overflow-hidden rounded-lg border border-cyan-400/50 bg-slate-900/80 px-0 py-0 shadow-xl ring-1 ring-cyan-400/20 backdrop-blur-[1px]"
            style={{
              left: `${dragClueGhostPosition.x}px`,
              top: `${dragClueGhostPosition.y}px`,
              transform: 'translate(18px, -50%)',
            }}
            aria-hidden="true"
          >
            <div className="flex items-center">
              <div className="inline-flex items-center justify-center w-8 h-10 border-r shrink-0 border-cyan-400/30 bg-slate-800/70 text-cyan-200">
                <svg viewBox="0 0 20 20" className="w-4 h-4">
                  <circle cx="7" cy="6" r="1.1" fill="currentColor" />
                  <circle cx="13" cy="6" r="1.1" fill="currentColor" />
                  <circle cx="7" cy="10" r="1.1" fill="currentColor" />
                  <circle cx="13" cy="10" r="1.1" fill="currentColor" />
                  <circle cx="7" cy="14" r="1.1" fill="currentColor" />
                  <circle cx="13" cy="14" r="1.1" fill="currentColor" />
                </svg>
              </div>
              <div className="min-w-0 px-2 py-1.5">
                <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-cyan-200/90">
                  Подсказка{' '}
                  {Number.isFinite(Number(draggedClueGhost?.clueIndex))
                    ? Number(draggedClueGhost.clueIndex) + 1
                    : ''}
                </div>
                <div className="text-xs font-semibold truncate text-white/95">
                  {draggedClueGhost?.title || 'Без текста'}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <FullscreenImageViewer
          isOpen={Boolean(selectedCodePhoto?.src)}
          src={selectedCodePhoto?.src || ''}
          alt={selectedCodePhoto?.alt || 'Фото кода'}
          onClose={() => setSelectedCodePhoto(null)}
        />
      </fieldset>
    </Modal>
  )
}

GameEditModal.propTypes = {
  selectedGame: PropTypes.shape({ id: PropTypes.string }),
  isEditModalOpen: PropTypes.bool.isRequired,
  handleCloseEditModal: PropTypes.func.isRequired,
  canEditSelectedGame: PropTypes.bool.isRequired,
  isSaving: PropTypes.bool.isRequired,
  location: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({ city: PropTypes.string }),
  ]),
  isDirty: PropTypes.bool.isRequired,
  handleModalPrimaryAction: PropTypes.func.isRequired,
  handleResetChanges: PropTypes.func.isRequired,
  updateSelectedGame: PropTypes.func.isRequired,
  GAME_TYPE_OPTIONS: PropTypes.array.isRequired,
  CLUE_EARLY_MODE_OPTIONS: PropTypes.array.isRequired,
  toMinutes: PropTypes.func.isRequired,
  toSeconds: PropTypes.func.isRequired,
  handleAddTask: PropTypes.func.isRequired,
  handleReorderTask: PropTypes.func.isRequired,
  isTaskReorderLocked: PropTypes.func.isRequired,
  startedGameLockedTaskCount: PropTypes.number,
  handleRemoveTask: PropTypes.func.isRequired,
  handleTaskFieldChange: PropTypes.func.isRequired,
  handleTaskNumberChange: PropTypes.func.isRequired,
  handleTaskOptionalNumberChange: PropTypes.func.isRequired,
  handleTaskCheckboxChange: PropTypes.func.isRequired,
  handleTaskCoordinateChange: PropTypes.func.isRequired,
  handleAddTaskCode: PropTypes.func.isRequired,
  handleTaskCodeChange: PropTypes.func.isRequired,
  handleTaskCodePhotoChange: PropTypes.func.isRequired,
  handleRemoveTaskCode: PropTypes.func.isRequired,
  handleAddTaskImage: PropTypes.func.isRequired,
  handleTaskImageChange: PropTypes.func.isRequired,
  handleRemoveTaskImage: PropTypes.func.isRequired,
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
  handleAddPrice: PropTypes.func.isRequired,
  handlePriceChange: PropTypes.func.isRequired,
  handleRemovePrice: PropTypes.func.isRequired,
  handleAddFinance: PropTypes.func.isRequired,
  handleFinanceChange: PropTypes.func.isRequired,
  handleRemoveFinance: PropTypes.func.isRequired,
  canGenerateResults: PropTypes.bool.isRequired,
  isGeneratingResults: PropTypes.bool.isRequired,
  handleGenerateResults: PropTypes.func.isRequired,
  generateResultsButtonLabel: PropTypes.string.isRequired,
  currencyFormatter: PropTypes.instanceOf(Intl.NumberFormat).isRequired,
  financesSummary: PropTypes.shape({
    income: PropTypes.number.isRequired,
    expense: PropTypes.number.isRequired,
    balance: PropTypes.number.isRequired,
  }).isRequired,
  balanceClass: PropTypes.string.isRequired,
  expandedTaskIds: PropTypes.instanceOf(Set).isRequired,
  toggleTaskExpansion: PropTypes.func.isRequired,
  selectedGameModerators: PropTypes.array.isRequired,
  availableModeratorsForSelect: PropTypes.array.isRequired,
  availableModeratorsMap: PropTypes.instanceOf(Map).isRequired,
  availableOrganizersForSelect: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      telegramId: PropTypes.string,
      name: PropTypes.string,
      username: PropTypes.string,
    }),
  ).isRequired,
  selectedModeratorToAdd: PropTypes.string.isRequired,
  setSelectedModeratorToAdd: PropTypes.func.isRequired,
  handleAddModerator: PropTypes.func.isRequired,
  handleRemoveModerator: PropTypes.func.isRequired,
  selectedGameAgents: PropTypes.array.isRequired,
  availableAgentsForSelect: PropTypes.array.isRequired,
  selectedAgentToAdd: PropTypes.string.isRequired,
  setSelectedAgentToAdd: PropTypes.func.isRequired,
  handleAddAgent: PropTypes.func.isRequired,
  handleRemoveAgent: PropTypes.func.isRequired,
  editGameLocationOptions: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    }),
  ),
  editGameSeasons: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      location: PropTypes.string,
    }),
  ),
  isEditGameSeasonsLoading: PropTypes.bool,
  isEditGameSeasonCreating: PropTypes.bool,
  handleCreateSeasonForEditGame: PropTypes.func.isRequired,
  handleSaveAndOpenTaskPreview: PropTypes.func.isRequired,
  canViewCodePhotos: PropTypes.bool,
  sectionMode: PropTypes.oneOf(['full', 'tasks']),
  modalTitleOverride: PropTypes.string,
}

GameEditModal.defaultProps = {
  selectedGame: null,
  location: null,
  editGameLocationOptions: [],
  editGameSeasons: [],
  isEditGameSeasonsLoading: false,
  isEditGameSeasonCreating: false,
  canViewCodePhotos: false,
  startedGameLockedTaskCount: 0,
  sectionMode: 'full',
  modalTitleOverride: null,
}

AccordionChevronIcon.propTypes = {
  isOpen: PropTypes.bool,
}

AccordionChevronIcon.defaultProps = {
  isOpen: false,
}

TaskWarningIcon.propTypes = {
  title: PropTypes.string.isRequired,
}

export default memo(GameEditModal)
