import { memo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import ImagesInput from '@components/cabinet/ImagesInput'
import formatDate from '@helpers/formatDate'
import formatDateTime from '@helpers/formatDateTime'

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
  GAME_STATUS_OPTIONS,
  GAME_TYPE_OPTIONS,
  CLUE_EARLY_MODE_OPTIONS,
  toMinutes,
  toSeconds,
  handleAddTask,
  handleRemoveTask,
  handleTaskFieldChange,
  handleTaskNumberChange,
  handleTaskOptionalNumberChange,
  handleTaskCheckboxChange,
  handleTaskCoordinateChange,
  handleAddTaskCode,
  handleTaskCodeChange,
  handleRemoveTaskCode,
  handleAddTaskImage,
  handleTaskImageChange,
  handleRemoveTaskImage,
  handleAddClue,
  handleTaskClueChange,
  handleRemoveClue,
  handleAddClueImage,
  handleClueImageChange,
  handleRemoveClueImage,
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
  currencyFormatter,
  financesSummary,
  balanceClass,
  expandedTaskIds,
  toggleTaskExpansion,
  selectedGameModerators,
  availableModeratorsForSelect,
  availableModeratorsMap,
  selectedModeratorToAdd,
  setSelectedModeratorToAdd,
  handleAddModerator,
  handleRemoveModerator,
  taskDurationLabel,
  cluesDurationLabel,
  clueModeDetails,
  breakDurationLabel,
  taskFailurePenaltyLabel,
  manyCodesLimitLabel,
  manyCodesPenaltyLabel,
}) => {
  const isPhotoGame = selectedGame?.type === 'photo'
  const modalFooter = (
    <>
      <button
        type="button"
        onClick={handleModalPrimaryAction}
        disabled={
          isSaving || (isDirty && (!canEditSelectedGame || !location))
        }
        className="aq-modal-btn aq-modal-btn-primary"
      >
        {isDirty
          ? isSaving
            ? 'Сохранение…'
            : 'Сохранить и закрыть'
          : 'Закрыть'}
      </button>
      <button
        type="button"
        onClick={handleResetChanges}
        disabled={!canEditSelectedGame || !isDirty}
        className="aq-modal-btn aq-modal-btn-secondary"
      >
        Отменить изменения
      </button>
    </>
  )

  return (
    <Modal
                    isOpen={isEditModalOpen}
                    title={`Редактирование игры «${selectedGame.name || 'Без названия'}»`}
                    onClose={handleCloseEditModal}
                    footer={modalFooter}
                  >
                  <fieldset
                    disabled={!canEditSelectedGame || isSaving}
                    className="space-y-6 border-0 p-0 m-0 [&_button]:cursor-pointer [&_select]:cursor-pointer [&_input[type='checkbox']]:cursor-pointer"
                  >
                    <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label htmlFor="game-title" className="text-sm font-semibold text-slate-700 dark:text-white">
                          Название игры
                        </label>
                        <input
                          id="game-title"
                          type="text"
                          value={selectedGame.name}
                          onChange={(event) =>
                            updateSelectedGame({ name: event.target.value })
                          }
                          className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="game-status" className="text-sm font-semibold text-slate-700 dark:text-white">
                          Статус
                        </label>
                        <select
                          id="game-status"
                          value={selectedGame.status}
                          onChange={(event) =>
                            updateSelectedGame({ status: event.target.value })
                          }
                          className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                        >
                          {GAME_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label htmlFor="game-type" className="text-sm font-semibold text-slate-700 dark:text-white">
                          Тип игры
                        </label>
                        <select
                          id="game-type"
                          value={selectedGame.type}
                          onChange={(event) =>
                            updateSelectedGame({ type: event.target.value })
                          }
                          className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                        >
                          {GAME_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="game-date" className="text-sm font-semibold text-slate-700 dark:text-white">
                          Плановое начало
                        </label>
                        <input
                          id="game-date"
                          type="datetime-local"
                          value={
                            selectedGame.dateStart
                              ? formatDateTime(selectedGame.dateStart, true, true)
                              : ''
                          }
                          onChange={(event) =>
                            updateSelectedGame({
                              dateStart: event.target.value
                                ? new Date(event.target.value).toISOString()
                                : null,
                            })
                          }
                          className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        id="game-individual-start"
                        type="checkbox"
                        checked={Boolean(selectedGame.individualStart)}
                        onChange={(event) =>
                          updateSelectedGame({ individualStart: event.target.checked })
                        }
                        className="w-4 h-4 text-primary border-slate-300 rounded"
                      />
                      <label htmlFor="game-individual-start" className="text-sm text-slate-600 dark:text-slate-200">
                        Индивидуальный старт для команд
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label htmlFor="game-starting-place" className="text-sm font-semibold text-slate-700 dark:text-white">
                          Место сбора
                        </label>
                        <input
                          id="game-starting-place"
                          type="text"
                          value={selectedGame.startingPlace}
                          onChange={(event) =>
                            updateSelectedGame({ startingPlace: event.target.value })
                          }
                          className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="game-finishing-place" className="text-sm font-semibold text-slate-700 dark:text-white">
                          Место окончания
                        </label>
                        <input
                          id="game-finishing-place"
                          type="text"
                          value={selectedGame.finishingPlace}
                          onChange={(event) =>
                            updateSelectedGame({ finishingPlace: event.target.value })
                          }
                          className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="game-description" className="text-sm font-semibold text-slate-700 dark:text-white">
                        Описание
                      </label>
                      <textarea
                        id="game-description"
                        value={selectedGame.description}
                        onChange={(event) =>
                          updateSelectedGame({ description: event.target.value })
                        }
                        rows={5}
                        className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                      />
                    </div>

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
                    />
                    </section>

                    <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-5">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Настройки заданий и подсказок</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label htmlFor="game-task-duration" className="text-sm font-semibold text-slate-700 dark:text-white">
                          Продолжительность задания (мин)
                        </label>
                        <input
                          id="game-task-duration"
                          type="number"
                          min="0"
                          value={toMinutes(selectedGame.taskDuration)}
                          onChange={(event) =>
                            updateSelectedGame({
                              taskDuration: toSeconds(event.target.value),
                            })
                          }
                          className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="game-clues-duration" className="text-sm font-semibold text-slate-700 dark:text-white">
                          Время до подсказки (мин)
                        </label>
                        <input
                          id="game-clues-duration"
                          type="number"
                          min="0"
                          value={toMinutes(selectedGame.cluesDuration)}
                          onChange={(event) =>
                            updateSelectedGame({
                              cluesDuration: toSeconds(event.target.value),
                            })
                          }
                          className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                        />
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-200">
                          Укажите 0, чтобы отключить автоматическую выдачу подсказок.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label htmlFor="game-clue-mode" className="text-sm font-semibold text-slate-700 dark:text-white">
                          Режим досрочной подсказки
                        </label>
                        <select
                          id="game-clue-mode"
                          value={selectedGame.clueEarlyAccessMode}
                          onChange={(event) =>
                            updateSelectedGame({
                              clueEarlyAccessMode: event.target.value,
                            })
                          }
                          className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                        >
                          {CLUE_EARLY_MODE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="game-clue-penalty" className="text-sm font-semibold text-slate-700 dark:text-white">
                          {selectedGame.clueEarlyAccessMode === 'penalty'
                            ? 'Штраф за досрочную подсказку (мин)'
                            : 'Дополнительное время после подсказки (мин)'}
                        </label>
                        <input
                          id="game-clue-penalty"
                          type="number"
                          min="0"
                          value={toMinutes(selectedGame.clueEarlyPenalty)}
                          onChange={(event) =>
                            updateSelectedGame({
                              clueEarlyPenalty: toSeconds(event.target.value),
                            })
                          }
                          className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label htmlFor="game-break-duration" className="text-sm font-semibold text-slate-700 dark:text-white">
                          Перерыв между заданиями (мин)
                        </label>
                        <input
                          id="game-break-duration"
                          type="number"
                          min="0"
                          value={toMinutes(selectedGame.breakDuration)}
                          onChange={(event) =>
                            updateSelectedGame({
                              breakDuration: toSeconds(event.target.value),
                            })
                          }
                          className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="game-task-penalty" className="text-sm font-semibold text-slate-700 dark:text-white">
                          {selectedGame.type === 'photo'
                            ? 'Штраф за невыполненное задание (баллы)'
                            : 'Штраф за невыполненное задание (мин)'}
                        </label>
                        <input
                          id="game-task-penalty"
                          type="number"
                          min="0"
                          value={
                            selectedGame.type === 'photo'
                              ? Number(selectedGame.taskFailurePenalty) || 0
                              : toMinutes(selectedGame.taskFailurePenalty)
                          }
                          onChange={(event) =>
                            updateSelectedGame({
                              taskFailurePenalty:
                                selectedGame.type === 'photo'
                                  ? Math.max(0, Number(event.target.value) || 0)
                                  : toSeconds(event.target.value),
                            })
                          }
                          className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>

                    {selectedGame.type !== 'photo' && (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label htmlFor="game-many-codes-limit" className="text-sm font-semibold text-slate-700 dark:text-white">
                            Лимит неверных кодов для штрафа
                          </label>
                          <input
                            id="game-many-codes-limit"
                            type="number"
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
                            className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div>
                          <label htmlFor="game-many-codes-penalty" className="text-sm font-semibold text-slate-700 dark:text-white">
                            Штраф за превышение лимита (мин)
                          </label>
                          <input
                            id="game-many-codes-penalty"
                            type="number"
                            min="0"
                            value={toMinutes(selectedGame.manyCodesPenalty?.[1] ?? 0)}
                            onChange={(event) =>
                              updateSelectedGame({
                                manyCodesPenalty: [
                                  selectedGame.manyCodesPenalty?.[0] ?? 0,
                                  toSeconds(event.target.value),
                                ],
                              })
                            }
                            className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedGame.allowCaptainForceClue)}
                          onChange={(event) =>
                            updateSelectedGame({
                              allowCaptainForceClue: event.target.checked,
                            })
                          }
                          className="w-4 h-4 text-primary border-slate-300 rounded"
                        />
                        Досрочные подсказки капитанам
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedGame.allowCaptainFailTask)}
                          onChange={(event) =>
                            updateSelectedGame({
                              allowCaptainFailTask: event.target.checked,
                            })
                          }
                          className="w-4 h-4 text-primary border-slate-300 rounded"
                        />
                        Слив задания капитаном
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedGame.allowCaptainFinishBreak)}
                          onChange={(event) =>
                            updateSelectedGame({
                              allowCaptainFinishBreak: event.target.checked,
                            })
                          }
                          className="w-4 h-4 text-primary border-slate-300 rounded"
                        />
                        Досрочное завершение перерыва
                      </label>
                    </div>
                    </section>


                    <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Задания</h2>
                      <button
                        type="button"
                        onClick={handleAddTask}
                        className="inline-flex justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        Добавить задание
                      </button>
                    </div>

                    {selectedGame.tasks?.length > 0 ? (
                      <div className="space-y-4">
                        {selectedGame.tasks.map((task, index) => {
                          const isExpanded = expandedTaskIds.includes(task.id)

                          return (
                            <div
                              key={task.id}
                              className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70"
                            >
                              <button
                                type="button"
                                onClick={() => toggleTaskExpansion(task.id)}
                                className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-white transition hover:bg-blue-50 dark:bg-slate-800/70 dark:hover:bg-sky-500/10"
                              >
                                <div>
                                  <p>
                                    {index + 1}. {task.title || 'Без названия'}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-200">
                                    {task.isBonusTask ? 'Бонусное задание' : 'Основное задание'}
                                    {task.canceled ? ' · Отменено' : ''}
                                    {task.codes?.length
                                      ? ` · Код${task.codes.length === 1 ? '' : 'ы'}: ${task.codes.length}`
                                      : ''}
                                    {task.clues?.length
                                      ? ` · Подсказок: ${task.clues.length}`
                                      : ''}
                                  </p>
                                </div>
                                <span className="text-xs font-semibold">
                                  {isExpanded ? 'Свернуть' : 'Развернуть'}
                                </span>
                              </button>

                              {isExpanded && (
                                <div className="space-y-5 px-4 py-5">
                                  <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                      <label className="text-sm font-semibold text-slate-700 dark:text-white" htmlFor={`task-title-${task.id}`}>
                                        Название задания
                                      </label>
                                      <input
                                        id={`task-title-${task.id}`}
                                        type="text"
                                        value={task.title}
                                        onChange={(event) =>
                                          handleTaskFieldChange(task.id, 'title', event.target.value)
                                        }
                                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                                      />
                                    </div>
                                    <div className="flex flex-col gap-2 md:items-start">
                                      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-200">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(task.isBonusTask)}
                                          onChange={(event) =>
                                            handleTaskCheckboxChange(
                                              task.id,
                                              'isBonusTask',
                                              event.target.checked
                                            )
                                          }
                                          className="h-4 w-4 rounded border-slate-300 text-primary"
                                        />
                                        Бонусное задание
                                      </label>
                                      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-200">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(task.canceled)}
                                          onChange={(event) =>
                                            handleTaskCheckboxChange(
                                              task.id,
                                              'canceled',
                                              event.target.checked
                                            )
                                          }
                                          className="h-4 w-4 rounded border-slate-300 text-primary"
                                        />
                                        Задание отменено
                                      </label>
                                    </div>
                                  </div>

                                  <div>
                                    <label className="text-sm font-semibold text-slate-700 dark:text-white" htmlFor={`task-text-${task.id}`}>
                                      Описание задания
                                    </label>
                                    <textarea
                                      id={`task-text-${task.id}`}
                                      rows={4}
                                      value={task.task}
                                      onChange={(event) =>
                                        handleTaskFieldChange(task.id, 'task', event.target.value)
                                      }
                                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                                    />
                                  </div>

                                  <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                      <label className="text-sm font-semibold text-slate-700 dark:text-white" htmlFor={`task-bonus-${task.id}`}>
                                        Бонус за выполнение
                                      </label>
                                      <input
                                        id={`task-bonus-${task.id}`}
                                        type="number"
                                        min="0"
                                        value={task.taskBonusForComplite ?? 0}
                                        onChange={(event) =>
                                          handleTaskNumberChange(
                                            task.id,
                                            'taskBonusForComplite',
                                            event.target.value
                                          )
                                        }
                                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-sm font-semibold text-slate-700 dark:text-white" htmlFor={`task-codes-required-${task.id}`}>
                                        Кодов для выполнения
                                      </label>
                                      <input
                                        id={`task-codes-required-${task.id}`}
                                        type="number"
                                        min="0"
                                        value={task.numCodesToCompliteTask ?? ''}
                                        onChange={(event) =>
                                          handleTaskOptionalNumberChange(
                                            task.id,
                                            'numCodesToCompliteTask',
                                            event.target.value
                                          )
                                        }
                                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                                      />
                                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-200">
                                        Оставьте пустым, чтобы требовались все коды.
                                      </p>
                                    </div>
                                  </div>

                                  <div>
                                    <label className="text-sm font-semibold text-slate-700 dark:text-white" htmlFor={`task-post-message-${task.id}`}>
                                      Сообщение после выполнения
                                    </label>
                                    <textarea
                                      id={`task-post-message-${task.id}`}
                                      rows={3}
                                      value={task.postMessage}
                                      onChange={(event) =>
                                        handleTaskFieldChange(task.id, 'postMessage', event.target.value)
                                      }
                                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                                    />
                                  </div>

                                  <div>
                                    <h4 className="text-sm font-semibold text-slate-700 dark:text-white">Координаты</h4>
                                    <div className="mt-2 grid gap-4 sm:grid-cols-3">
                                      <div>
                                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-200" htmlFor={`task-lat-${task.id}`}>
                                          Широта
                                        </label>
                                        <input
                                          id={`task-lat-${task.id}`}
                                          type="number"
                                          step="any"
                                          value={task.coordinates?.latitude ?? ''}
                                          onChange={(event) =>
                                            handleTaskCoordinateChange(
                                              task.id,
                                              'latitude',
                                              event.target.value
                                            )
                                          }
                                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-200" htmlFor={`task-lng-${task.id}`}>
                                          Долгота
                                        </label>
                                        <input
                                          id={`task-lng-${task.id}`}
                                          type="number"
                                          step="any"
                                          value={task.coordinates?.longitude ?? ''}
                                          onChange={(event) =>
                                            handleTaskCoordinateChange(
                                              task.id,
                                              'longitude',
                                              event.target.value
                                            )
                                          }
                                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-200" htmlFor={`task-radius-${task.id}`}>
                                          Радиус (м)
                                        </label>
                                        <input
                                          id={`task-radius-${task.id}`}
                                          type="number"
                                          min="0"
                                          value={task.coordinates?.radius ?? ''}
                                          onChange={(event) =>
                                            handleTaskCoordinateChange(
                                              task.id,
                                              'radius',
                                              event.target.value
                                            )
                                          }
                                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  <div>
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                      <h4 className="text-sm font-semibold text-slate-700 dark:text-white">Коды для задания</h4>
                                      <button
                                        type="button"
                                        onClick={() => handleAddTaskCode(task.id)}
                                        className="inline-flex justify-center rounded-xl border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-sky-500/10"
                                      >
                                        Добавить код
                                      </button>
                                    </div>
                                    {task.codes?.length > 0 ? (
                                      <div className="mt-3 space-y-3">
                                        {task.codes.map((codeValue, codeIndex) => (
                                          <div
                                            key={`${task.id}-code-${codeIndex}`}
                                            className="flex flex-col gap-2 sm:flex-row sm:items-center"
                                          >
                                            <input
                                              type="text"
                                              value={codeValue}
                                              onChange={(event) =>
                                                handleTaskCodeChange(
                                                  task.id,
                                                  codeIndex,
                                                  event.target.value
                                                )
                                              }
                                              placeholder="Код"
                                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveTaskCode(task.id, codeIndex)}
                                              className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                                            >
                                              Удалить
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="mt-3 text-sm text-slate-500 dark:text-slate-200">Кодов пока нет.</p>
                                    )}
                                  </div>

                                  <div>
                                    <ImagesInput
                                      label="Изображения задания"
                                      images={task.images ?? []}
                                      onChange={(nextImages) =>
                                        handleTaskFieldChange(task.id, 'images', nextImages)
                                      }
                                      directory={`games/${selectedGame.id || 'draft'}/tasks/${task.id}`}
                                      disabled={!canEditSelectedGame || isSaving}
                                      maxImages={12}
                                    />
                                  </div>

                                  <div>
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                      <h4 className="text-sm font-semibold text-slate-700 dark:text-white">Подсказки</h4>
                                      <button
                                        type="button"
                                        onClick={() => handleAddClue(task.id)}
                                        className="inline-flex justify-center rounded-xl border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-sky-500/10"
                                      >
                                        Добавить подсказку
                                      </button>
                                    </div>
                                    {task.clues?.length > 0 ? (
                                      <div className="mt-3 space-y-4">
                                        {task.clues.map((clue, clueIndex) => (
                                          <div
                                            key={clue.id}
                                            className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                                          >
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                              <p className="text-sm font-semibold text-slate-700 dark:text-white">
                                                Подсказка {clueIndex + 1}
                                              </p>
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveClue(task.id, clue.id)}
                                                className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                                              >
                                                Удалить подсказку
                                              </button>
                                            </div>
                                            <div>
                                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-200" htmlFor={`task-clue-${clue.id}`}>
                                                Текст подсказки
                                              </label>
                                              <textarea
                                                id={`task-clue-${clue.id}`}
                                                rows={3}
                                                value={clue.clue}
                                                onChange={(event) =>
                                                  handleTaskClueChange(
                                                    task.id,
                                                    clue.id,
                                                    'clue',
                                                    event.target.value
                                                  )
                                                }
                                                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                                              />
                                            </div>
                                            <div>
                                              <ImagesInput
                                                label="Изображения подсказки"
                                                images={clue.images ?? []}
                                                onChange={(nextImages) =>
                                                  handleTaskClueChange(
                                                    task.id,
                                                    clue.id,
                                                    'images',
                                                    nextImages
                                                  )
                                                }
                                                directory={`games/${selectedGame.id || 'draft'}/tasks/${task.id}/clues/${clue.id}`}
                                                disabled={!canEditSelectedGame || isSaving}
                                                maxImages={8}
                                              />
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="mt-3 text-sm text-slate-500 dark:text-slate-200">Подсказок пока нет.</p>
                                    )}
                                  </div>

                                  {isPhotoGame && (
                                    <div>
                                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <h4 className="text-sm font-semibold text-slate-700 dark:text-white">Подзадания</h4>
                                        <button
                                          type="button"
                                          onClick={() => handleAddSubTask(task.id)}
                                          className="inline-flex justify-center rounded-xl border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-sky-500/10"
                                        >
                                          Добавить подзадание
                                        </button>
                                      </div>
                                      {task.subTasks?.length > 0 ? (
                                        <div className="mt-3 space-y-4">
                                          {task.subTasks.map((subTask, subIndex) => (
                                            <div
                                              key={subTask.id}
                                              className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                                            >
                                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <p className="text-sm font-semibold text-slate-700 dark:text-white">
                                                  Подзадание {subIndex + 1}
                                                </p>
                                                <button
                                                  type="button"
                                                  onClick={() => handleRemoveSubTask(task.id, subTask.id)}
                                                  className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                                                >
                                                  Удалить подзадание
                                                </button>
                                              </div>
                                              <div className="grid gap-4 md:grid-cols-2">
                                                <div>
                                                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-200" htmlFor={`task-subtask-name-${subTask.id}`}>
                                                    Название
                                                  </label>
                                                  <input
                                                    id={`task-subtask-name-${subTask.id}`}
                                                    type="text"
                                                    value={subTask.name}
                                                    onChange={(event) =>
                                                      handleSubTaskChange(
                                                        task.id,
                                                        subTask.id,
                                                        'name',
                                                        event.target.value
                                                      )
                                                    }
                                                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                                                  />
                                                </div>
                                                <div>
                                                  <label
                                                    className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-200"
                                                    htmlFor={`task-subtask-bonus-${subTask.id}`}
                                                  >
                                                    Бонус
                                                  </label>
                                                  <input
                                                    id={`task-subtask-bonus-${subTask.id}`}
                                                    type="number"
                                                    min="0"
                                                    value={subTask.bonus ?? 0}
                                                    onChange={(event) =>
                                                      handleSubTaskChange(
                                                        task.id,
                                                        subTask.id,
                                                        'bonus',
                                                        event.target.value
                                                      )
                                                    }
                                                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                                                  />
                                                </div>
                                              </div>
                                              <div>
                                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-200" htmlFor={`task-subtask-text-${subTask.id}`}>
                                                  Описание
                                                </label>
                                                <textarea
                                                  id={`task-subtask-text-${subTask.id}`}
                                                  rows={3}
                                                  value={subTask.task}
                                                  onChange={(event) =>
                                                    handleSubTaskChange(
                                                      task.id,
                                                      subTask.id,
                                                      'task',
                                                      event.target.value
                                                    )
                                                  }
                                                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                                                />
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="mt-3 text-sm text-slate-500 dark:text-slate-200">Подзаданий пока нет.</p>
                                      )}
                                    </div>
                                  )}

                                  <div>
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                      <h4 className="text-sm font-semibold text-slate-700 dark:text-white">Штрафные коды</h4>
                                      <button
                                        type="button"
                                        onClick={() => handleAddPenaltyCode(task.id)}
                                        className="inline-flex justify-center rounded-xl border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-sky-500/10"
                                      >
                                        Добавить штраф
                                      </button>
                                    </div>
                                    {task.penaltyCodes?.length > 0 ? (
                                      <div className="mt-3 space-y-4">
                                        {task.penaltyCodes.map((penalty) => (
                                          <div
                                            key={penalty.id}
                                            className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                                          >
                                            <div className="grid gap-3 md:grid-cols-4">
                                              <div className="md:col-span-2">
                                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-200" htmlFor={`task-penalty-code-${penalty.id}`}>
                                                  Код
                                                </label>
                                                <input
                                                  id={`task-penalty-code-${penalty.id}`}
                                                  type="text"
                                                  value={penalty.code}
                                                  onChange={(event) =>
                                                    handlePenaltyCodeChange(
                                                      task.id,
                                                      penalty.id,
                                                      'code',
                                                      event.target.value
                                                    )
                                                  }
                                                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                                                />
                                              </div>
                                              <div>
                                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-200" htmlFor={`task-penalty-value-${penalty.id}`}>
                                                  Штраф
                                                </label>
                                                <input
                                                  id={`task-penalty-value-${penalty.id}`}
                                                  type="number"
                                                  min="0"
                                                  value={penalty.penalty ?? 0}
                                                  onChange={(event) =>
                                                    handlePenaltyCodeChange(
                                                      task.id,
                                                      penalty.id,
                                                      'penalty',
                                                      event.target.value
                                                    )
                                                  }
                                                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                                                />
                                              </div>
                                            </div>
                                            <div>
                                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-200" htmlFor={`task-penalty-description-${penalty.id}`}>
                                                Комментарий
                                              </label>
                                              <input
                                                id={`task-penalty-description-${penalty.id}`}
                                                type="text"
                                                value={penalty.description}
                                                onChange={(event) =>
                                                  handlePenaltyCodeChange(
                                                    task.id,
                                                    penalty.id,
                                                    'description',
                                                    event.target.value
                                                  )
                                                }
                                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                                              />
                                            </div>
                                            <div className="flex justify-end">
                                              <button
                                                type="button"
                                                onClick={() => handleRemovePenaltyCode(task.id, penalty.id)}
                                                className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                                              >
                                                Удалить штраф
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="mt-3 text-sm text-slate-500 dark:text-slate-200">Штрафных кодов пока нет.</p>
                                    )}
                                  </div>

                                  <div>
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                      <h4 className="text-sm font-semibold text-slate-700 dark:text-white">Бонусные коды</h4>
                                      <button
                                        type="button"
                                        onClick={() => handleAddBonusCode(task.id)}
                                        className="inline-flex justify-center rounded-xl border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-sky-500/10"
                                      >
                                        Добавить бонус
                                      </button>
                                    </div>
                                    {task.bonusCodes?.length > 0 ? (
                                      <div className="mt-3 space-y-4">
                                        {task.bonusCodes.map((bonus) => (
                                          <div
                                            key={bonus.id}
                                            className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                                          >
                                            <div className="grid gap-3 md:grid-cols-4">
                                              <div className="md:col-span-2">
                                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-200" htmlFor={`task-bonus-code-${bonus.id}`}>
                                                  Код
                                                </label>
                                                <input
                                                  id={`task-bonus-code-${bonus.id}`}
                                                  type="text"
                                                  value={bonus.code}
                                                  onChange={(event) =>
                                                    handleBonusCodeChange(
                                                      task.id,
                                                      bonus.id,
                                                      'code',
                                                      event.target.value
                                                    )
                                                  }
                                                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                                                />
                                              </div>
                                              <div>
                                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-200" htmlFor={`task-bonus-value-${bonus.id}`}>
                                                  Бонус
                                                </label>
                                                <input
                                                  id={`task-bonus-value-${bonus.id}`}
                                                  type="number"
                                                  min="0"
                                                  value={bonus.bonus ?? 0}
                                                  onChange={(event) =>
                                                    handleBonusCodeChange(
                                                      task.id,
                                                      bonus.id,
                                                      'bonus',
                                                      event.target.value
                                                    )
                                                  }
                                                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                                                />
                                              </div>
                                            </div>
                                            <div>
                                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-200" htmlFor={`task-bonus-description-${bonus.id}`}>
                                                Комментарий
                                              </label>
                                              <input
                                                id={`task-bonus-description-${bonus.id}`}
                                                type="text"
                                                value={bonus.description}
                                                onChange={(event) =>
                                                  handleBonusCodeChange(
                                                    task.id,
                                                    bonus.id,
                                                    'description',
                                                    event.target.value
                                                  )
                                                }
                                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white"
                                              />
                                            </div>
                                            <div className="flex justify-end">
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveBonusCode(task.id, bonus.id)}
                                                className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                                              >
                                                Удалить бонус
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="mt-3 text-sm text-slate-500 dark:text-slate-200">Бонусных кодов пока нет.</p>
                                    )}
                                  </div>

                                  <div className="flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveTask(task.id)}
                                      className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                                    >
                                      Удалить задание
                                    </button>
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
                    </section>

                    <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-5">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Публикация и результаты</h2>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedGame.hidden)}
                          onChange={(event) =>
                            updateSelectedGame({ hidden: event.target.checked })
                          }
                          className="w-4 h-4 text-primary border-slate-300 rounded"
                        />
                        Игра скрыта из общего списка
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedGame.showCreator)}
                          onChange={(event) =>
                            updateSelectedGame({ showCreator: event.target.checked })
                          }
                          className="w-4 h-4 text-primary border-slate-300 rounded"
                        />
                        Показывать организатора игрокам
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedGame.showTasks)}
                          onChange={(event) =>
                            updateSelectedGame({ showTasks: event.target.checked })
                          }
                          className="w-4 h-4 text-primary border-slate-300 rounded"
                        />
                        Открыть задания после завершения
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedGame.hideResult)}
                          onChange={(event) =>
                            updateSelectedGame({ hideResult: event.target.checked })
                          }
                          className="w-4 h-4 text-primary border-slate-300 rounded"
                        />
                        Скрыть результаты для участников
                      </label>
                    </div>
                    </section>

                    <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Стоимость участия</h2>
                      <button
                        type="button"
                        onClick={handleAddPrice}
                        className="px-3 py-2 text-xs font-semibold text-white bg-primary rounded-xl hover:bg-blue-700"
                      >
                        Добавить тариф
                      </button>
                    </div>

                    {(selectedGame.prices ?? []).length > 0 ? (
                      <div className="space-y-3">
                        {selectedGame.prices.map((price) => (
                          <div
                            key={price.id}
                            className="grid gap-3 md:grid-cols-[2fr_1fr_auto] items-center p-4 border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/50 rounded-2xl"
                          >
                            <input
                              type="text"
                              value={price.name}
                              onChange={(event) =>
                                handlePriceChange(price.id, 'name', event.target.value)
                              }
                              placeholder="Название тарифа"
                              className="w-full px-4 py-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                            />
                            <input
                              type="number"
                              min="0"
                              value={price.price}
                              onChange={(event) =>
                                handlePriceChange(price.id, 'price', event.target.value)
                              }
                              placeholder="Стоимость"
                              className="w-full px-4 py-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemovePrice(price.id)}
                              className="px-3 py-2 text-xs font-semibold text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                            >
                              Удалить
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-200">
                        Добавьте тариф, чтобы задать стоимость участия для команд.
                      </p>
                    )}
                  </section>

                  <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Финансы игры</h2>
                      <button
                        type="button"
                        onClick={handleAddFinance}
                        className="px-3 py-2 text-xs font-semibold text-white bg-primary rounded-xl hover:bg-blue-700"
                      >
                        Добавить запись
                      </button>
                    </div>

                    {(selectedGame.finances ?? []).length > 0 ? (
                      <div className="space-y-3">
                        {selectedGame.finances.map((entry) => (
                          <div
                            key={entry.id}
                            className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] items-center p-4 border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/50 rounded-2xl"
                          >
                            <select
                              value={entry.type}
                              onChange={(event) =>
                                handleFinanceChange(entry.id, 'type', event.target.value)
                              }
                              className="w-full px-3 py-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                            >
                              <option value="income">Доход</option>
                              <option value="expense">Расход</option>
                            </select>
                            <input
                              type="number"
                              min="0"
                              value={entry.sum}
                              onChange={(event) =>
                                handleFinanceChange(entry.id, 'sum', event.target.value)
                              }
                              placeholder="Сумма"
                              className="w-full px-3 py-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                            />
                            <input
                              type="date"
                              value={entry.date ? formatDate(entry.date, true) : ''}
                              onChange={(event) =>
                                handleFinanceChange(entry.id, 'date', event.target.value)
                              }
                              className="w-full px-3 py-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveFinance(entry.id)}
                              className="px-3 py-2 text-xs font-semibold text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                            >
                              Удалить
                            </button>
                            <div className="md:col-span-3">
                              <input
                                type="text"
                                value={entry.description}
                                onChange={(event) =>
                                  handleFinanceChange(entry.id, 'description', event.target.value)
                                }
                                placeholder="Комментарий"
                                className="w-full px-3 py-2 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-200">
                        Пока нет финансовых записей по этой игре. Добавьте доходы и расходы, чтобы контролировать бюджет.
                      </p>
                    )}

                    <div className="p-4 bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800/60 rounded-2xl">
                      <p className="text-sm text-slate-600 dark:text-slate-200">
                        Доходы: <span className="font-semibold">{currencyFormatter.format(financesSummary.income)}</span>
                      </p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-200">
                        Расходы: <span className="font-semibold">{currencyFormatter.format(financesSummary.expense)}</span>
                      </p>
                      <p className={`mt-1 text-sm font-semibold ${balanceClass}`}>
                        Баланс: {currencyFormatter.format(financesSummary.balance)}
                      </p>
                    </div>
                    </section>

                  </fieldset>
                  </Modal>
  )
}

GameEditModal.propTypes = {
  selectedGame: PropTypes.shape({ id: PropTypes.string }).isRequired,
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
  GAME_STATUS_OPTIONS: PropTypes.array.isRequired,
  GAME_TYPE_OPTIONS: PropTypes.array.isRequired,
  CLUE_EARLY_MODE_OPTIONS: PropTypes.array.isRequired,
  toMinutes: PropTypes.func.isRequired,
  toSeconds: PropTypes.func.isRequired,
  handleAddTask: PropTypes.func.isRequired,
  handleRemoveTask: PropTypes.func.isRequired,
  handleTaskFieldChange: PropTypes.func.isRequired,
  handleTaskNumberChange: PropTypes.func.isRequired,
  handleTaskOptionalNumberChange: PropTypes.func.isRequired,
  handleTaskCheckboxChange: PropTypes.func.isRequired,
  handleTaskCoordinateChange: PropTypes.func.isRequired,
  handleAddTaskCode: PropTypes.func.isRequired,
  handleTaskCodeChange: PropTypes.func.isRequired,
  handleRemoveTaskCode: PropTypes.func.isRequired,
  handleAddTaskImage: PropTypes.func.isRequired,
  handleTaskImageChange: PropTypes.func.isRequired,
  handleRemoveTaskImage: PropTypes.func.isRequired,
  handleAddClue: PropTypes.func.isRequired,
  handleTaskClueChange: PropTypes.func.isRequired,
  handleRemoveClue: PropTypes.func.isRequired,
  handleAddClueImage: PropTypes.func.isRequired,
  handleClueImageChange: PropTypes.func.isRequired,
  handleRemoveClueImage: PropTypes.func.isRequired,
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
  selectedModeratorToAdd: PropTypes.string.isRequired,
  setSelectedModeratorToAdd: PropTypes.func.isRequired,
  handleAddModerator: PropTypes.func.isRequired,
  handleRemoveModerator: PropTypes.func.isRequired,
  taskDurationLabel: PropTypes.string.isRequired,
  cluesDurationLabel: PropTypes.string.isRequired,
  clueModeDetails: PropTypes.shape({
    modeLabel: PropTypes.string.isRequired,
    valueLabel: PropTypes.string.isRequired,
  }).isRequired,
  breakDurationLabel: PropTypes.string.isRequired,
  taskFailurePenaltyLabel: PropTypes.string.isRequired,
  manyCodesLimitLabel: PropTypes.string,
  manyCodesPenaltyLabel: PropTypes.string,
}

GameEditModal.defaultProps = {
  location: null,
  manyCodesLimitLabel: null,
  manyCodesPenaltyLabel: null,
}

export default memo(GameEditModal)




