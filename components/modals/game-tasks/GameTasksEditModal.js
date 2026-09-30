import { canManageClassicEditor, showClassicItemsAndVariants } from '@helpers/classicEditorSettings'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { TASK_THEMES, normalizeTaskTheme } from '@helpers/taskThemes'
import {
  normalizeStoredTaskDistributionTemplate,
  normalizeTaskDistributionMode,
} from '@helpers/taskDistribution'

import Modal from '@components/Modal'
import NeonCheckbox from '@components/NeonCheckbox'
import CabinetButton from '@components/cabinet/CabinetButton'
import ModalSection from '@components/modals/ModalSection'
import FullscreenImageViewer from '@components/FullscreenImageViewer'

import ClassicStageTaskItem from './ClassicStageTaskItem'
import GameTaskSettingsModal from './GameTaskSettingsModal'
import ClassicItemsSection from './ClassicItemsSection'
import { hasClassicVariants } from '@helpers/classicVariants'
import PrequelSection from '@components/modals/game-edit/sections/PrequelSection'

const GameTasksEditModal = ({
  currentUserRole,
  selectedGame,
  isEditModalOpen: isTasksModalOpen,
  handleCloseEditModal: handleCloseTasksModal,
  canEditSelectedGame: canEditGame,
  isGameClosed,
  isSaving,
  location,
  isDirty,
  dirtyTaskIds = [],
  beginTaskEditing,
  cancelTaskEditing,
  handleModalPrimaryAction: handleTasksModalPrimaryAction,
  handleResetChanges,
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
  selectedGameAgents,
  updateSelectedGame,
  canViewCodePhotos,
  handleSaveAndOpenTaskPreview,
  canViewGameMap,
  handleOpenGameMap,
}) => {
  const canManageClassic = canManageClassicEditor(currentUserRole)
  const showClassicFeatures = canManageClassic && showClassicItemsAndVariants(selectedGame)
  const variantsLocked = hasClassicVariants(selectedGame) && ['started', 'finished', 'closed'].includes(selectedGame?.status)
  const canEditSelectedGame = canEditGame && !variantsLocked
  const [expandedCodeAccordions, setExpandedCodeAccordions] = useState(
    () => new Set(),
  )
  const [expandedClueAccordions, setExpandedClueAccordions] = useState(
    () => new Set(),
  )
  const [selectedCodePhoto, setSelectedCodePhoto] = useState(null)
  const [isTaskSettingsModalOpen, setIsTaskSettingsModalOpen] = useState(false)
  const [isPrequelEditing, setIsPrequelEditing] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const taskListFocusRef = useRef(null)
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
  const supportsCustomTaskPublicTitles = ['classic', 'photo'].includes(
    selectedGame?.type,
  )
  const useCustomTaskPublicTitles =
    supportsCustomTaskPublicTitles &&
    Boolean(selectedGame?.useCustomTaskPublicTitles)

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
      if (!canDragTask) return
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
      if (!dragState.active || dragState.pointerId !== event.pointerId) return
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
      if (!dragState.active || dragState.pointerId !== event.pointerId) return
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
      if (!sourceTaskId || !targetTaskId || sourceTaskId === targetTaskId)
        return
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
      )
        return
      handleReorderTask(sourceIndex, targetIndex)
    },
    [
      handleReorderTask,
      isTaskReorderLocked,
      resetTouchTaskDragState,
      selectedGame?.tasks,
    ],
  )

  const resolveClueDragTarget = useCallback(
    (clientX, clientY, sourceTaskId, sourceClueId) => {
      const elementUnderPointer = document.elementFromPoint(clientX, clientY)
      const clueContainer = elementUnderPointer?.closest?.(
        '[data-clue-dnd-task-id][data-clue-dnd-id]',
      )
      const targetTaskId =
        clueContainer?.getAttribute('data-clue-dnd-task-id') || ''
      const targetClueId = clueContainer?.getAttribute('data-clue-dnd-id') || ''
      if (!targetTaskId || !targetClueId) return { taskId: '', clueId: '' }
      if (String(targetTaskId) !== String(sourceTaskId))
        return { taskId: '', clueId: '' }
      if (String(targetClueId) === String(sourceClueId))
        return { taskId: '', clueId: '' }
      return { taskId: String(targetTaskId), clueId: String(targetClueId) }
    },
    [],
  )

  const handleClueHandlePointerDown = useCallback(
    (taskId, clueId, canDragClue, event) => {
      if (!canDragClue) return
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
      if (!dragState.active || dragState.pointerId !== event.pointerId) return
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
      if (!dragState.active || dragState.pointerId !== event.pointerId) return
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
      )
        return
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
      if (sourceIndex < 0 || targetIndex < 0) return
      handleReorderClue(sourceTaskId, sourceIndex, targetIndex)
    },
    [handleReorderClue, resetTouchClueDragState, selectedGame?.tasks],
  )

  const draggedTaskGhost = (selectedGame?.tasks || []).find(
    (task) => String(task?.id) === String(draggedTaskId || ''),
  )
  const draggedClueGhost = (() => {
    if (!draggedClueMeta) return null
    const task = (selectedGame?.tasks || []).find(
      (item) => String(item?.id) === String(draggedClueMeta.taskId),
    )
    if (!task) return null
    const clues = Array.isArray(task?.clues) ? task.clues : []
    const clueIndex = clues.findIndex(
      (item) => String(item?.id) === String(draggedClueMeta.clueId),
    )
    if (clueIndex < 0) return null
    return {
      taskId: String(task.id),
      clueId: String(clues[clueIndex].id),
      clueIndex,
      title:
        (typeof clues[clueIndex]?.clue === 'string'
          ? clues[clueIndex].clue.trim()
          : '') || `${clueIndex + 1}`,
    }
  })()

  useEffect(() => {
    if (!isTasksModalOpen) {
      setIsTaskSettingsModalOpen(false)
      setIsPrequelEditing(false)
      setEditingTaskId(null)
      taskListFocusRef.current = null
      setExpandedCodeAccordions(new Set())
      setExpandedClueAccordions(new Set())
      resetTouchTaskDragState()
      resetTouchClueDragState()
    }
  }, [
    isTasksModalOpen,
    resetTouchClueDragState,
    resetTouchTaskDragState,
    selectedGame?.id,
  ])

  useEffect(() => {
    if (!isTasksModalOpen || editingTaskId || isTaskSettingsModalOpen || !taskListFocusRef.current) return
    const frame = requestAnimationFrame(() => {
      document.querySelector(`[data-task-open-id="${CSS.escape(taskListFocusRef.current || '')}"]`)?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [isTasksModalOpen, editingTaskId, isTaskSettingsModalOpen])

  if (!selectedGame) {
    return (
      <Modal
        isOpen={isTasksModalOpen}
        title="Редактор заданий"
        onClose={handleCloseTasksModal}
      >
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Игра не выбрана. Закройте окно и выберите игру снова.
        </p>
      </Modal>
    )
  }

  const taskThemeLabel =
    TASK_THEMES.find((theme) => theme.id === normalizeTaskTheme(selectedGame.taskTheme))
      ?.label || 'По умолчанию'
  const distributionMode = normalizeTaskDistributionMode(
    selectedGame.taskDistributionMode,
  )
  const distributionTemplate = normalizeStoredTaskDistributionTemplate(
    selectedGame.taskDistributionTemplate,
    selectedGame.tasks?.length || 0,
  )
  const distributionSummary =
    distributionMode === 'random'
      ? distributionTemplate.length > 0
        ? `Случайное, блоков: ${distributionTemplate.length}`
        : 'Случайное, шаблон не задан'
      : 'Линейное'

  const editingTaskIndex = (selectedGame.tasks || []).findIndex((task) => task.id === editingTaskId)
  const editingTask = selectedGame.tasks?.[editingTaskIndex]
  const openTaskEditor = (id, isNew = false) => {
    if (!isNew) beginTaskEditing()
    taskListFocusRef.current = id
    resetTouchTaskDragState()
    setEditingTaskId(id)
  }
  const closeTaskEditor = () => {
    if (isSaving) return false
    if (
      dirtyTaskIds.includes(editingTaskId) &&
      !window.confirm('В задании есть несохранённые изменения. Вернуться к списку и потерять эти изменения?')
    ) return false
    cancelTaskEditing()
    setSelectedCodePhoto(null)
    resetTouchClueDragState()
    setEditingTaskId(null)
    return true
  }
  const renderTask = (task, index, editing = false) => (
    <ClassicStageTaskItem
      key={`${editing ? 'editor' : 'card'}-${task.id}`}
      contentOnly={editing}
      hideStageFlags={editing}
      opensDialog={!editing}
      updateSelectedGame={updateSelectedGame}
      canManageClassic={showClassicFeatures}
      task={task}
      index={index}
      isExpanded={editing}
      toggleTaskExpansion={openTaskEditor}
      isTaskOrderLocked={isTaskReorderLocked(index)}
      canEditSelectedGame={canEditSelectedGame}
      isSaving={isSaving}
      selectedGame={selectedGame}
      selectedGameAgents={selectedGameAgents}
      canViewCodePhotos={canViewCodePhotos}
      isPhotoGame={isPhotoGame}
      useCustomTaskPublicTitles={useCustomTaskPublicTitles}
      draggedTaskId={draggedTaskId}
      dragOverTaskId={dragOverTaskId}
      setDraggedTaskId={setDraggedTaskId}
      setDragOverTaskId={setDragOverTaskId}
      draggedClueMeta={draggedClueMeta}
      dragOverClueMeta={dragOverClueMeta}
      setDraggedClueMeta={setDraggedClueMeta}
      setDragOverClueMeta={setDragOverClueMeta}
      dragGhostPosition={dragGhostPosition}
      setDragGhostPosition={setDragGhostPosition}
      dragClueGhostPosition={dragClueGhostPosition}
      setDragClueGhostPosition={setDragClueGhostPosition}
      handleTaskFieldChange={handleTaskFieldChange}
      handleTaskNumberChange={handleTaskNumberChange}
      handleTaskOptionalNumberChange={
        handleTaskOptionalNumberChange
      }
      handleTaskCheckboxChange={handleTaskCheckboxChange}
      handleTaskCoordinateChange={handleTaskCoordinateChange}
      handleAddTaskCode={handleAddTaskCode}
      handleTaskCodeChange={handleTaskCodeChange}
      handleTaskCodePhotoChange={handleTaskCodePhotoChange}
      handleRemoveTaskCode={handleRemoveTaskCode}
      handleAddClue={handleAddClue}
      handleReorderClue={handleReorderClue}
      handleTaskClueChange={handleTaskClueChange}
      handleRemoveClue={handleRemoveClue}
      handleAddSubTask={handleAddSubTask}
      handleSubTaskChange={handleSubTaskChange}
      handleRemoveSubTask={handleRemoveSubTask}
      handleAddPenaltyCode={handleAddPenaltyCode}
      handlePenaltyCodeChange={handlePenaltyCodeChange}
      handleRemovePenaltyCode={handleRemovePenaltyCode}
      handleAddBonusCode={handleAddBonusCode}
      handleBonusCodeChange={handleBonusCodeChange}
      handleRemoveBonusCode={handleRemoveBonusCode}
      handleReorderTask={handleReorderTask}
      handleSaveAndOpenTaskPreview={handleSaveAndOpenTaskPreview}
      disableTaskPreview={editing && isDirty}
      handleRemoveTask={(id) => { if (closeTaskEditor()) handleRemoveTask(id) }}
      handleTaskHandlePointerDown={handleTaskHandlePointerDown}
      handleTaskHandlePointerMove={handleTaskHandlePointerMove}
      handleTaskHandlePointerUp={handleTaskHandlePointerUp}
      resetTouchTaskDragState={resetTouchTaskDragState}
      handleClueHandlePointerDown={handleClueHandlePointerDown}
      handleClueHandlePointerMove={handleClueHandlePointerMove}
      handleClueHandlePointerUp={handleClueHandlePointerUp}
      resetTouchClueDragState={resetTouchClueDragState}
      expandedCodeAccordions={expandedCodeAccordions}
      setExpandedCodeAccordions={setExpandedCodeAccordions}
      expandedClueAccordions={expandedClueAccordions}
      setExpandedClueAccordions={setExpandedClueAccordions}
      selectedCodePhoto={selectedCodePhoto}
      setSelectedCodePhoto={setSelectedCodePhoto}
    />
  )

  const dragPreviews = (<>
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
  </>)

  const modalFooter = (
    <>
      {canViewGameMap ? (
        <CabinetButton
          onClick={handleOpenGameMap}
          disabled={isSaving}
          variant="secondary"
          tone="cyan"
        >
          Посмотреть карту
        </CabinetButton>
      ) : null}
      <CabinetButton
        onClick={handleTasksModalPrimaryAction}
        disabled={isSaving || (isDirty && (!canEditSelectedGame || !location))}
        variant="primary"
      >
        {isDirty
          ? isSaving
            ? 'Сохранение…'
            : 'Сохранить'
          : 'Закрыть'}
      </CabinetButton>
      {isDirty && !canEditSelectedGame ? (
        <span className="text-xs text-amber-700 dark:text-amber-300">
          Игра закрыта — изменения заданий сохранить нельзя.
        </span>
      ) : null}
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

  return (
    <>
    <Modal
      isOpen={isTasksModalOpen && !isTaskSettingsModalOpen && !editingTask}
      title={`Редактор заданий «${selectedGame?.name || 'Без названия'}»`}
      onClose={() => { if (!isPrequelEditing) handleCloseTasksModal() }}
      footer={modalFooter}
    >
      {/* В режиме просмотра (закрытая игра или нет прав) fieldset не блокируется:
          иначе нельзя открывать задания. Все поля редактирования дизейблятся
          на уровне компонентов через canEditSelectedGame. */}
      <fieldset
        disabled={isSaving}
        className="m-0 space-y-6 border-0 p-0 [&_button]:cursor-pointer [&_select]:cursor-pointer"
      >
        <ModalSection className="!space-y-0 !p-3 sm:!p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-800 dark:text-white">
                Настройки заданий
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Оформление: {taskThemeLabel}
                {selectedGame.type !== 'story' ? (
                  <> · Распределение: {distributionSummary}</>
                ) : null}
                {supportsCustomTaskPublicTitles ? (
                  <> · Названия: {useCustomTaskPublicTitles ? 'произвольные' : 'по порядку'}</>
                ) : null}
              </p>
            </div>
            <CabinetButton
              onClick={() => setIsTaskSettingsModalOpen(true)}
              disabled={isSaving}
              variant="secondary"
            >
              Открыть настройки
            </CabinetButton>
          </div>
        </ModalSection>

        <ModalSection>
          {variantsLocked ? <p className="mb-3 text-sm text-amber-700 dark:text-amber-300">Правила игры с вариантами зафиксированы при запуске. Для новой редакции создайте копию игры.</p> : null}
          {showClassicFeatures && <ClassicItemsSection game={selectedGame} onChange={updateSelectedGame} disabled={!canEditSelectedGame || isSaving || ['started', 'finished', 'closed'].includes(selectedGame?.status)} />}
          {isGameClosed ? (
            <p className="mb-4 rounded-xl border border-amber-300/70 bg-amber-50/90 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-400/50 dark:bg-amber-500/12 dark:text-amber-200">
              Игра закрыта: задания можно только просматривать. Сохранение
              изменений недоступно, чтобы не менять задания завершённой игры
              и не искажать её результаты.
            </p>
          ) : null}
          <div className="mb-6">
            <PrequelSection
              onEditingChange={setIsPrequelEditing}
              onSave={(patch) => handleTasksModalPrimaryAction(patch)}
              selectedGame={selectedGame}
              canEditSelectedGame={canEditSelectedGame}
              isSaving={isSaving}
              updateSelectedGame={updateSelectedGame}
              canViewCodePhotos={canViewCodePhotos}
            />
          </div>

          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            Задания
          </h2>
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
              {selectedGame.tasks.map((task, index) => renderTask(task, index))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-200">
              Пока нет заданий. Добавьте первое, чтобы начать.
            </p>
          )}
          <div className="mt-4">
            <CabinetButton
              onClick={() => {
                beginTaskEditing()
                const id = handleAddTask()
                if (id) openTaskEditor(id, true)
                else cancelTaskEditing()
              }}
              disabled={!canEditSelectedGame || isSaving}
              variant="primary"
            >
              Добавить задание
            </CabinetButton>
          </div>
        </ModalSection>

        {dragPreviews}

      </fieldset>
    </Modal>
    <Modal
      isOpen={isTasksModalOpen && Boolean(editingTask)}
      title={`${canEditSelectedGame ? 'Редактирование' : 'Просмотр'} задания ${editingTaskIndex + 1}: ${editingTask?.title || 'Без названия'}`}
      onClose={() => { if (!selectedCodePhoto?.src) closeTaskEditor() }}
      footer={<>
        <CabinetButton onClick={closeTaskEditor} disabled={isSaving} variant="secondary">К списку заданий</CabinetButton>
        {dirtyTaskIds.includes(editingTaskId) && canEditSelectedGame && (
          <CabinetButton
            onClick={handleTasksModalPrimaryAction}
            disabled={isSaving || !location}
            variant="primary"
          >
            {isSaving ? 'Сохранение…' : 'Сохранить изменения задания'}
          </CabinetButton>
        )}
      </>}
    >
      {editingTask && (
        <div className="mb-5 flex items-center gap-3 sm:gap-6">
          {[
            ['isBonusTask', 'Бонусное задание'],
            ['canceled', 'Задание отменено'],
          ].map(([field, label]) => (
            <NeonCheckbox
              key={field}
              id={`task-stage-${field}-${editingTask.id}`}
              checked={Boolean(editingTask[field])}
              onChange={(event) => handleTaskCheckboxChange(editingTask.id, field, event.target.checked)}
              label={label}
              labelClassName="text-xs sm:text-sm text-slate-600 dark:text-slate-200"
              disabled={!canEditSelectedGame || isSaving}
            />
          ))}
          {showClassicFeatures && (
              <NeonCheckbox
                id={`task-stage-variants-${editingTask.id}`}
                checked={Boolean(editingTask.variantConfig?.enabled)}
                onChange={(event) => {
                  const enabled = event.target.checked
                  updateSelectedGame((game) => ({
                    tasks: game.tasks.map((task) => task.id === editingTask.id ? {
                      ...task,
                      variantConfig: {
                        mode: 'auto',
                        offerDefaultAlways: false,
                        ...task.variantConfig,
                        enabled,
                      },
                    } : task),
                  }))
                }}
                label="Варианты задания"
                labelClassName="text-xs sm:text-sm text-slate-600 dark:text-slate-200"
                disabled={!canEditSelectedGame || isSaving || ['started', 'finished', 'closed'].includes(selectedGame.status)}
              />
            )}
        </div>
      )}
      {editingTask ? renderTask(editingTask, editingTaskIndex, true) : null}
      {dragPreviews}
    </Modal>
        <FullscreenImageViewer
          isOpen={Boolean(selectedCodePhoto?.src)}
          src={selectedCodePhoto?.src || ''}
          alt={selectedCodePhoto?.alt || 'Фото кода'}
          onClose={() => setSelectedCodePhoto(null)}
        />
    <GameTaskSettingsModal
      canManageClassic={canManageClassic}
      selectedGame={selectedGame}
      isOpen={isTasksModalOpen && isTaskSettingsModalOpen}
      onClose={() => setIsTaskSettingsModalOpen(false)}
      canEditSelectedGame={canEditSelectedGame}
      isGameClosed={isGameClosed}
      isSaving={isSaving}
      isDirty={isDirty}
      location={location}
      onSave={handleTasksModalPrimaryAction}
      updateSelectedGame={updateSelectedGame}
    />
    </>
  )
}

GameTasksEditModal.propTypes = {
  currentUserRole: PropTypes.string,
  selectedGame: PropTypes.shape({
    taskTheme: PropTypes.string,
    id: PropTypes.string,
    type: PropTypes.string,
    taskDistributionMode: PropTypes.oneOf(['linear', 'random']),
    taskDistributionTemplate: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)),
    useCustomTaskPublicTitles: PropTypes.bool,
    tasks: PropTypes.array,
  }),
  isEditModalOpen: PropTypes.bool.isRequired,
  handleCloseEditModal: PropTypes.func.isRequired,
  canEditSelectedGame: PropTypes.bool.isRequired,
  isGameClosed: PropTypes.bool,
  isSaving: PropTypes.bool.isRequired,
  location: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({ city: PropTypes.string }),
  ]),
  isDirty: PropTypes.bool.isRequired,
  dirtyTaskIds: PropTypes.arrayOf(PropTypes.string),
  beginTaskEditing: PropTypes.func.isRequired,
  cancelTaskEditing: PropTypes.func.isRequired,
  handleModalPrimaryAction: PropTypes.func.isRequired,
  handleResetChanges: PropTypes.func.isRequired,
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
  selectedGameAgents: PropTypes.array.isRequired,
  updateSelectedGame: PropTypes.func.isRequired,
  canViewCodePhotos: PropTypes.bool,
  handleSaveAndOpenTaskPreview: PropTypes.func.isRequired,
  canViewGameMap: PropTypes.bool,
  handleOpenGameMap: PropTypes.func,
}

GameTasksEditModal.defaultProps = {
  selectedGame: null,
  isGameClosed: false,
  location: null,
  startedGameLockedTaskCount: 0,
  canViewCodePhotos: false,
  canViewGameMap: false,
  handleOpenGameMap: undefined,
}

export default memo(GameTasksEditModal)
