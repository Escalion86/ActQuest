import { memo, useCallback, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import CabinetButton from '@components/cabinet/CabinetButton'
import ModalSection from '@components/modals/ModalSection'
import FullscreenImageViewer from '@components/FullscreenImageViewer'
import NeonCheckbox from '@components/NeonCheckbox'

import TaskItem from './sections/TaskItem'
import PrequelSection from '@components/modals/game-edit/sections/PrequelSection'

const GameTasksEditModal = ({
  selectedGame,
  isEditModalOpen: isTasksModalOpen,
  handleCloseEditModal: handleCloseTasksModal,
  canEditSelectedGame,
  isSaving,
  location,
  isDirty,
  handleModalPrimaryAction: handleTasksModalPrimaryAction,
  handleResetChanges,
  expandedTaskIds,
  toggleTaskExpansion,
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
}) => {
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
  const supportsCustomTaskPublicTitles = ['classic', 'photo'].includes(
    selectedGame?.type,
  )
  const useCustomTaskPublicTitles =
    supportsCustomTaskPublicTitles &&
    Boolean(selectedGame?.useCustomTaskPublicTitles)

  const handleCustomTaskPublicTitlesChange = useCallback(
    (eventOrChecked) => {
      const checked =
        typeof eventOrChecked === 'boolean'
          ? eventOrChecked
          : Boolean(eventOrChecked?.target?.checked)

      updateSelectedGame((game) => ({
        useCustomTaskPublicTitles: checked,
        tasks: checked
          ? (game.tasks || []).map((task, index) => ({
              ...task,
              publicTitle:
                typeof task?.publicTitle === 'string' &&
                task.publicTitle.trim()
                  ? task.publicTitle
                  : `${index + 1} Задание`,
            }))
          : game.tasks || [],
      }))
    },
    [updateSelectedGame],
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

  const modalFooter = (
    <>
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
    <Modal
      isOpen={isTasksModalOpen}
      title={`Редактор заданий «${selectedGame?.name || 'Без названия'}»`}
      onClose={handleCloseTasksModal}
      footer={modalFooter}
    >
      <fieldset
        disabled={!canEditSelectedGame || isSaving}
        className="m-0 space-y-6 border-0 p-0 [&_button]:cursor-pointer [&_select]:cursor-pointer"
      >
        <ModalSection>
          <div className="mb-6">
            <PrequelSection
              selectedGame={selectedGame}
              canEditSelectedGame={canEditSelectedGame}
              isSaving={isSaving}
              updateSelectedGame={updateSelectedGame}
              canViewCodePhotos={canViewCodePhotos}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              Задания
            </h2>
            {supportsCustomTaskPublicTitles ? (
              <NeonCheckbox
                id={`game-custom-task-public-titles-${selectedGame.id}`}
                checked={useCustomTaskPublicTitles}
                onChange={handleCustomTaskPublicTitlesChange}
                label="Произвольные публичные названия"
                labelClassName="text-sm text-slate-600 dark:text-slate-200"
              />
            ) : null}
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
                return (
                  <TaskItem
                    key={task.id}
                    task={task}
                    index={index}
                    isExpanded={isExpanded}
                    toggleTaskExpansion={toggleTaskExpansion}
                    isTaskOrderLocked={isTaskOrderLocked}
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
                    handleRemoveTask={handleRemoveTask}
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

GameTasksEditModal.propTypes = {
  selectedGame: PropTypes.shape({
    id: PropTypes.string,
    type: PropTypes.string,
    useCustomTaskPublicTitles: PropTypes.bool,
    tasks: PropTypes.array,
  }),
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
  expandedTaskIds: PropTypes.array.isRequired,
  toggleTaskExpansion: PropTypes.func.isRequired,
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
}

GameTasksEditModal.defaultProps = {
  selectedGame: null,
  location: null,
  startedGameLockedTaskCount: 0,
  canViewCodePhotos: false,
}

export default memo(GameTasksEditModal)
