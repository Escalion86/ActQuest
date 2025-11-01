import { memo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import formatDate from '@helpers/formatDate'
import formatDateTime from '@helpers/formatDateTime'

const GameModals = ({
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
  isTeamsModalOpen,
  handleCloseTeamsModal,
  teamsModalState,
  removingTeamIds,
  selectedTeamToAdd,
  setSelectedTeamToAdd,
  handleAddTeamToGame,
  isAddingTeam,
  handleRemoveTeamFromGame,
  isRegisterModalOpen,
  handleCloseRegisterModal,
  isRegisterSubmitting,
  handleSubmitRegister,
  registerTeamId,
  registerGameId,
  setRegisterTeamId,
  setRegisterGameId,
  registerFeedback,
  isRegisterTeamsLoading,
  registerTeams,
  currentUserTelegramIdNumber,
  isCreateGameModalOpen,
  handleCloseCreateGameModal,
  isCreatingGame,
  handleCreateGame,
  newGameName,
  setNewGameName,
  createGameFeedback,
  isDescriptionModalOpen,
  handleCloseDescriptionModal,
  gameTypeLabel,
  plannedStartLabel,
  canViewRestrictedGameInfo,
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

}) => (
  <>
                    <Modal
                      isOpen={isEditModalOpen}
                      title={`Редактирование игры «${selectedGame.name || 'Без названия'}»`}
                      onClose={handleCloseEditModal}
                    >
                    <fieldset disabled={!canEditSelectedGame || isSaving} className="space-y-6 border-0 p-0 m-0">
                      <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-5">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label htmlFor="game-title" className="text-sm font-semibold text-primary">
                            Название игры
                          </label>
                          <input
                            id="game-title"
                            type="text"
                            value={selectedGame.name}
                            onChange={(event) =>
                              updateSelectedGame({ name: event.target.value })
                            }
                            className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div>
                          <label htmlFor="game-status" className="text-sm font-semibold text-primary">
                            Статус
                          </label>
                          <select
                            id="game-status"
                            value={selectedGame.status}
                            onChange={(event) =>
                              updateSelectedGame({ status: event.target.value })
                            }
                            className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
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
                          <label htmlFor="game-type" className="text-sm font-semibold text-primary">
                            Тип игры
                          </label>
                          <select
                            id="game-type"
                            value={selectedGame.type}
                            onChange={(event) =>
                              updateSelectedGame({ type: event.target.value })
                            }
                            className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                          >
                            {GAME_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="game-date" className="text-sm font-semibold text-primary">
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
                            className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
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
                        <label htmlFor="game-individual-start" className="text-sm text-slate-600">
                          Индивидуальный старт для команд
                        </label>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label htmlFor="game-starting-place" className="text-sm font-semibold text-primary">
                            Место сбора
                          </label>
                          <input
                            id="game-starting-place"
                            type="text"
                            value={selectedGame.startingPlace}
                            onChange={(event) =>
                              updateSelectedGame({ startingPlace: event.target.value })
                            }
                            className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div>
                          <label htmlFor="game-finishing-place" className="text-sm font-semibold text-primary">
                            Место окончания
                          </label>
                          <input
                            id="game-finishing-place"
                            type="text"
                            value={selectedGame.finishingPlace}
                            onChange={(event) =>
                              updateSelectedGame({ finishingPlace: event.target.value })
                            }
                            className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="game-description" className="text-sm font-semibold text-primary">
                          Описание
                        </label>
                        <textarea
                          id="game-description"
                          value={selectedGame.description}
                          onChange={(event) =>
                            updateSelectedGame({ description: event.target.value })
                          }
                          rows={5}
                          className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                        />
                      </div>

                      <div>
                        <label htmlFor="game-image" className="text-sm font-semibold text-primary">
                          Ссылка на обложку
                        </label>
                        <input
                          id="game-image"
                          type="text"
                          value={selectedGame.image}
                          onChange={(event) =>
                            updateSelectedGame({ image: event.target.value })
                          }
                          className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                        />
                        {selectedGame.image && (
                          <img
                            src={selectedGame.image}
                            alt={selectedGame.name || 'Обложка игры'}
                            className="object-cover w-full h-40 mt-3 rounded-xl border border-slate-200 dark:border-slate-700"
                          />
                        )}
                      </div>
                      </section>

                      <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-5">
                      <h2 className="text-lg font-semibold text-primary">Настройки заданий и подсказок</h2>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label htmlFor="game-task-duration" className="text-sm font-semibold text-primary">
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
                            className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div>
                          <label htmlFor="game-clues-duration" className="text-sm font-semibold text-primary">
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
                            className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                          />
                          <p className="mt-1 text-xs text-slate-500">
                            Укажите 0, чтобы отключить автоматическую выдачу подсказок.
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label htmlFor="game-clue-mode" className="text-sm font-semibold text-primary">
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
                            className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                          >
                            {CLUE_EARLY_MODE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="game-clue-penalty" className="text-sm font-semibold text-primary">
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
                            className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label htmlFor="game-break-duration" className="text-sm font-semibold text-primary">
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
                            className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div>
                          <label htmlFor="game-task-penalty" className="text-sm font-semibold text-primary">
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
                            className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                          />
                        </div>
                      </div>

                      {selectedGame.type !== 'photo' && (
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <label htmlFor="game-many-codes-limit" className="text-sm font-semibold text-primary">
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
                              className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                            />
                          </div>
                          <div>
                            <label htmlFor="game-many-codes-penalty" className="text-sm font-semibold text-primary">
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
                              className="w-full px-4 py-3 mt-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                            />
                          </div>
                        </div>
                      )}

                      <div className="grid gap-3 md:grid-cols-3">
                        <label className="flex items-center gap-2 text-sm text-slate-600">
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
                        <label className="flex items-center gap-2 text-sm text-slate-600">
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
                        <label className="flex items-center gap-2 text-sm text-slate-600">
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
                        <h2 className="text-lg font-semibold text-primary">Задания</h2>
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
                                  className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-primary transition hover:bg-blue-50 dark:bg-slate-800/70 dark:hover:bg-violet-500/10"
                                >
                                  <div>
                                    <p>
                                      {index + 1}. {task.title || 'Без названия'}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
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
                                        <label className="text-sm font-semibold text-primary" htmlFor={`task-title-${task.id}`}>
                                          Название задания
                                        </label>
                                        <input
                                          id={`task-title-${task.id}`}
                                          type="text"
                                          value={task.title}
                                          onChange={(event) =>
                                            handleTaskFieldChange(task.id, 'title', event.target.value)
                                          }
                                          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                        />
                                      </div>
                                      <div className="flex flex-col gap-2 md:items-start">
                                        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
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
                                        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
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
                                      <label className="text-sm font-semibold text-primary" htmlFor={`task-text-${task.id}`}>
                                        Описание задания
                                      </label>
                                      <textarea
                                        id={`task-text-${task.id}`}
                                        rows={4}
                                        value={task.task}
                                        onChange={(event) =>
                                          handleTaskFieldChange(task.id, 'task', event.target.value)
                                        }
                                        className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                      />
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                      <div>
                                        <label className="text-sm font-semibold text-primary" htmlFor={`task-bonus-${task.id}`}>
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
                                          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-sm font-semibold text-primary" htmlFor={`task-codes-required-${task.id}`}>
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
                                          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                        />
                                        <p className="mt-1 text-xs text-slate-500">
                                          Оставьте пустым, чтобы требовались все коды.
                                        </p>
                                      </div>
                                    </div>

                                    <div>
                                      <label className="text-sm font-semibold text-primary" htmlFor={`task-post-message-${task.id}`}>
                                        Сообщение после выполнения
                                      </label>
                                      <textarea
                                        id={`task-post-message-${task.id}`}
                                        rows={3}
                                        value={task.postMessage}
                                        onChange={(event) =>
                                          handleTaskFieldChange(task.id, 'postMessage', event.target.value)
                                        }
                                        className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                      />
                                    </div>

                                    <div>
                                      <h4 className="text-sm font-semibold text-primary">Координаты</h4>
                                      <div className="mt-2 grid gap-4 sm:grid-cols-3">
                                        <div>
                                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-lat-${task.id}`}>
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
                                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-lng-${task.id}`}>
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
                                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-radius-${task.id}`}>
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
                                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    <div>
                                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <h4 className="text-sm font-semibold text-primary">Коды для задания</h4>
                                        <button
                                          type="button"
                                          onClick={() => handleAddTaskCode(task.id)}
                                          className="inline-flex justify-center rounded-xl border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-violet-500/10"
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
                                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveTaskCode(task.id, codeIndex)}
                                                className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                                              >
                                                Удалить
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="mt-3 text-sm text-slate-500">Кодов пока нет.</p>
                                      )}
                                    </div>

                                    <div>
                                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <h4 className="text-sm font-semibold text-primary">Изображения задания</h4>
                                        <button
                                          type="button"
                                          onClick={() => handleAddTaskImage(task.id)}
                                          className="inline-flex justify-center rounded-xl border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-violet-500/10"
                                        >
                                          Добавить изображение
                                        </button>
                                      </div>
                                      {task.images?.length > 0 ? (
                                        <div className="mt-3 space-y-3">
                                          {task.images.map((imageValue, imageIndex) => (
                                            <div
                                              key={`${task.id}-image-${imageIndex}`}
                                              className="flex flex-col gap-2 sm:flex-row sm:items-center"
                                            >
                                              <input
                                                type="text"
                                                value={imageValue}
                                                onChange={(event) =>
                                                  handleTaskImageChange(
                                                    task.id,
                                                    imageIndex,
                                                    event.target.value
                                                  )
                                                }
                                                placeholder="Ссылка на изображение"
                                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveTaskImage(task.id, imageIndex)}
                                                className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                                              >
                                                Удалить
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="mt-3 text-sm text-slate-500">Изображений пока нет.</p>
                                      )}
                                    </div>

                                    <div>
                                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <h4 className="text-sm font-semibold text-primary">Подсказки</h4>
                                        <button
                                          type="button"
                                          onClick={() => handleAddClue(task.id)}
                                          className="inline-flex justify-center rounded-xl border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-violet-500/10"
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
                                                <p className="text-sm font-semibold text-primary">
                                                  Подсказка {clueIndex + 1}
                                                </p>
                                                <button
                                                  type="button"
                                                  onClick={() => handleRemoveClue(task.id, clue.id)}
                                                  className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                                                >
                                                  Удалить подсказку
                                                </button>
                                              </div>
                                              <div>
                                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-clue-${clue.id}`}>
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
                                                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                                />
                                              </div>
                                              <div>
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                  <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    Изображения подсказки
                                                  </h5>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleAddClueImage(task.id, clue.id)}
                                                    className="inline-flex justify-center rounded-xl border border-primary px-3 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-violet-500/10"
                                                  >
                                                    Добавить ссылку
                                                  </button>
                                                </div>
                                                {clue.images?.length > 0 ? (
                                                  <div className="mt-3 space-y-3">
                                                    {clue.images.map((imageValue, imageIndex) => (
                                                      <div
                                                        key={`${clue.id}-image-${imageIndex}`}
                                                        className="flex flex-col gap-2 sm:flex-row sm:items-center"
                                                      >
                                                        <input
                                                          type="text"
                                                          value={imageValue}
                                                          onChange={(event) =>
                                                            handleClueImageChange(
                                                              task.id,
                                                              clue.id,
                                                              imageIndex,
                                                              event.target.value
                                                            )
                                                          }
                                                          placeholder="Ссылка на изображение"
                                                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                                        />
                                                        <button
                                                          type="button"
                                                          onClick={() =>
                                                            handleRemoveClueImage(task.id, clue.id, imageIndex)
                                                          }
                                                          className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                                                        >
                                                          Удалить
                                                        </button>
                                                      </div>
                                                    ))}
                                                  </div>
                                                ) : (
                                                  <p className="mt-3 text-sm text-slate-500">Изображения отсутствуют.</p>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="mt-3 text-sm text-slate-500">Подсказок пока нет.</p>
                                      )}
                                    </div>

                                    {isPhotoGame && (
                                      <div>
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                          <h4 className="text-sm font-semibold text-primary">Подзадания</h4>
                                          <button
                                            type="button"
                                            onClick={() => handleAddSubTask(task.id)}
                                            className="inline-flex justify-center rounded-xl border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-violet-500/10"
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
                                                  <p className="text-sm font-semibold text-primary">
                                                    Подзадание {subIndex + 1}
                                                  </p>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleRemoveSubTask(task.id, subTask.id)}
                                                    className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                                                  >
                                                    Удалить подзадание
                                                  </button>
                                                </div>
                                                <div className="grid gap-4 md:grid-cols-2">
                                                  <div>
                                                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-subtask-name-${subTask.id}`}>
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
                                                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                                    />
                                                  </div>
                                                  <div>
                                                    <label
                                                      className="text-xs font-semibold uppercase tracking-wide text-slate-500"
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
                                                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                                    />
                                                  </div>
                                                </div>
                                                <div>
                                                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-subtask-text-${subTask.id}`}>
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
                                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                                  />
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="mt-3 text-sm text-slate-500">Подзаданий пока нет.</p>
                                        )}
                                      </div>
                                    )}

                                    <div>
                                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <h4 className="text-sm font-semibold text-primary">Штрафные коды</h4>
                                        <button
                                          type="button"
                                          onClick={() => handleAddPenaltyCode(task.id)}
                                          className="inline-flex justify-center rounded-xl border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-violet-500/10"
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
                                                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-penalty-code-${penalty.id}`}>
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
                                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-penalty-value-${penalty.id}`}>
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
                                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                                  />
                                                </div>
                                              </div>
                                              <div>
                                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-penalty-description-${penalty.id}`}>
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
                                                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                                />
                                              </div>
                                              <div className="flex justify-end">
                                                <button
                                                  type="button"
                                                  onClick={() => handleRemovePenaltyCode(task.id, penalty.id)}
                                                  className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                                                >
                                                  Удалить штраф
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="mt-3 text-sm text-slate-500">Штрафных кодов пока нет.</p>
                                      )}
                                    </div>

                                    <div>
                                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <h4 className="text-sm font-semibold text-primary">Бонусные коды</h4>
                                        <button
                                          type="button"
                                          onClick={() => handleAddBonusCode(task.id)}
                                          className="inline-flex justify-center rounded-xl border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 dark:hover:bg-violet-500/10"
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
                                                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-bonus-code-${bonus.id}`}>
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
                                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-bonus-value-${bonus.id}`}>
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
                                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                                  />
                                                </div>
                                              </div>
                                              <div>
                                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`task-bonus-description-${bonus.id}`}>
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
                                                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                                                />
                                              </div>
                                              <div className="flex justify-end">
                                                <button
                                                  type="button"
                                                  onClick={() => handleRemoveBonusCode(task.id, bonus.id)}
                                                  className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                                                >
                                                  Удалить бонус
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="mt-3 text-sm text-slate-500">Бонусных кодов пока нет.</p>
                                      )}
                                    </div>

                                    <div className="flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveTask(task.id)}
                                        className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
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
                        <p className="text-sm text-slate-500">
                          Пока нет заданий. Добавьте первое, чтобы начать.
                        </p>
                      )}
                      </section>

                      <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-5">
                      <h2 className="text-lg font-semibold text-primary">Публикация и результаты</h2>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="flex items-center gap-2 text-sm text-slate-600">
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
                        <label className="flex items-center gap-2 text-sm text-slate-600">
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
                        <label className="flex items-center gap-2 text-sm text-slate-600">
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
                        <label className="flex items-center gap-2 text-sm text-slate-600">
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
                        <h2 className="text-lg font-semibold text-primary">Стоимость участия</h2>
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
                              className="grid gap-3 md:grid-cols-[2fr_1fr_auto] items-center p-4 border border-slate-200 dark:border-slate-700 rounded-2xl"
                            >
                              <input
                                type="text"
                                value={price.name}
                                onChange={(event) =>
                                  handlePriceChange(price.id, 'name', event.target.value)
                                }
                                placeholder="Название тарифа"
                                className="w-full px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                              />
                              <input
                                type="number"
                                min="0"
                                value={price.price}
                                onChange={(event) =>
                                  handlePriceChange(price.id, 'price', event.target.value)
                                }
                                placeholder="Стоимость"
                                className="w-full px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemovePrice(price.id)}
                                className="px-3 py-2 text-xs font-semibold text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-50"
                              >
                                Удалить
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">
                          Добавьте тариф, чтобы задать стоимость участия для команд.
                        </p>
                      )}
                    </section>

                    <section className="p-6 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold text-primary">Финансы игры</h2>
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
                              className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] items-center p-4 border border-slate-200 dark:border-slate-700 rounded-2xl"
                            >
                              <select
                                value={entry.type}
                                onChange={(event) =>
                                  handleFinanceChange(entry.id, 'type', event.target.value)
                                }
                                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
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
                                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                              />
                              <input
                                type="date"
                                value={entry.date ? formatDate(entry.date, true) : ''}
                                onChange={(event) =>
                                  handleFinanceChange(entry.id, 'date', event.target.value)
                                }
                                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveFinance(entry.id)}
                                className="px-3 py-2 text-xs font-semibold text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-50"
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
                                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">
                          Пока нет финансовых записей по этой игре. Добавьте доходы и расходы, чтобы контролировать бюджет.
                        </p>
                      )}

                      <div className="p-4 bg-slate-50 border border-slate-200 dark:border-slate-700 rounded-2xl">
                        <p className="text-sm text-slate-600">
                          Доходы: <span className="font-semibold">{currencyFormatter.format(financesSummary.income)}</span>
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          Расходы: <span className="font-semibold">{currencyFormatter.format(financesSummary.expense)}</span>
                        </p>
                        <p className={`mt-1 text-sm font-semibold ${balanceClass}`}>
                          Баланс: {currencyFormatter.format(financesSummary.balance)}
                        </p>
                      </div>
                      </section>

                      <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <button
                          type="button"
                          onClick={handleModalPrimaryAction}
                          disabled={
                            isSaving || (isDirty && (!canEditSelectedGame || !location))
                          }
                          className={`inline-flex justify-center px-5 py-3 text-sm font-semibold text-white rounded-xl transition ${
                            isSaving || (isDirty && (!canEditSelectedGame || !location))
                              ? 'bg-slate-400 cursor-not-allowed'
                              : 'bg-primary hover:bg-blue-700'
                          }`}
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
                          className={`inline-flex justify-center px-5 py-3 text-sm font-semibold rounded-xl border transition ${
                            !canEditSelectedGame || !isDirty
                              ? 'border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed'
                              : 'border-primary text-primary hover:bg-blue-50 dark:hover:bg-violet-500/10'
                          }`}
                        >
                          Отменить изменения
                        </button>
                      </div>
                    </fieldset>
                    </Modal>
                    <Modal
                      isOpen={isTeamsModalOpen}
                      title={`Команды игры «${selectedGame.name || 'Без названия'}»`}
                      onClose={handleCloseTeamsModal}
                    >
                      <div className="space-y-5">
                        {teamsModalState.error && (
                          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                            {teamsModalState.error}
                          </div>
                        )}

                        <div className="space-y-4">
                          <h3 className="text-base font-semibold text-primary">Зарегистрированные команды</h3>
                          {teamsModalState.isLoading ? (
                            <p className="text-sm text-slate-500">Загружаем список команд…</p>
                          ) : teamsModalState.gameTeams.length > 0 ? (
                            <ul className="space-y-3">
                              {teamsModalState.gameTeams.map((team) => {
                                const isRemoving = removingTeamIds.includes(team.id)
                                return (
                                  <li
                                    key={team.id}
                                    className="rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900/60"
                                  >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                      <div>
                                        <p className="font-semibold text-primary">{team.teamName}</p>
                                        {team.teamDescription ? (
                                          <p className="mt-1 text-xs text-slate-500">{team.teamDescription}</p>
                                        ) : null}
                                        <p className="mt-1 text-xs text-slate-400">ID команды: {team.teamId || '—'}</p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveTeamFromGame(team.id)}
                                        disabled={isRemoving || teamsModalState.isLoading}
                                        className={`inline-flex justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                                          isRemoving || teamsModalState.isLoading
                                            ? 'cursor-not-allowed border-slate-200 text-slate-400'
                                            : 'border-rose-200 text-rose-600 hover:bg-rose-50'
                                        }`}
                                      >
                                        {isRemoving ? 'Удаление…' : 'Удалить'}
                                      </button>
                                    </div>
                                  </li>
                                )
                              })}
                            </ul>
                          ) : (
                            <p className="text-sm text-slate-500">Пока ни одна команда не зарегистрирована на эту игру.</p>
                          )}
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                          <h3 className="text-sm font-semibold text-primary">Добавить команду</h3>
                          {teamsModalState.availableTeams.length > 0 ? (
                            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                              <select
                                value={selectedTeamToAdd}
                                onChange={(event) => setSelectedTeamToAdd(event.target.value)}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700"
                              >
                                {teamsModalState.availableTeams.map((team) => {
                                  const membersCount = Number.isFinite(team?.membersCount)
                                    ? team.membersCount
                                    : Array.isArray(team?.members)
                                    ? team.members.length
                                    : 0

                                  return (
                                    <option key={team.id} value={team.id}>
                                      {`${team.name} (${membersCount})`}
                                    </option>
                                  )
                                })}
                              </select>
                              <button
                                type="button"
                                onClick={handleAddTeamToGame}
                                disabled={!selectedTeamToAdd || isAddingTeam || teamsModalState.isLoading}
                                className={`inline-flex justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
                                  !selectedTeamToAdd || isAddingTeam || teamsModalState.isLoading
                                    ? 'bg-slate-400 cursor-not-allowed'
                                    : 'bg-primary hover:bg-blue-700'
                                }`}
                              >
                                {isAddingTeam ? 'Добавление…' : 'Добавить'}
                              </button>
                            </div>
                          ) : (
                            <p className="mt-3 text-sm text-slate-500">
                              Свободных команд не найдено. Создайте команду или освободите её от участия в игре.
                            </p>
                          )}
                        </div>
                      </div>
                    </Modal>
                  </div>
                </div>
              )}
            </section>
            <Modal
              isOpen={isRegisterModalOpen}
              title="Регистрация команды по ID игры"
              onClose={handleCloseRegisterModal}
              footer={(
                <>
                  <button
                    type="button"
                    onClick={handleCloseRegisterModal}
                    disabled={isRegisterSubmitting}
                    className={`inline-flex justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      isRegisterSubmitting
                        ? 'cursor-not-allowed border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitRegister}
                    disabled={
                      isRegisterSubmitting ||
                      !registerTeamId ||
                      registerGameId.trim().length === 0 ||
                      !location ||
                      !Number.isFinite(currentUserTelegramIdNumber)
                    }
                    className={`inline-flex justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
                      isRegisterSubmitting ||
                      !registerTeamId ||
                      registerGameId.trim().length === 0 ||
                      !location ||
                      !Number.isFinite(currentUserTelegramIdNumber)
                        ? 'bg-slate-400 cursor-not-allowed'
                        : 'bg-primary hover:bg-blue-700'
                    }`}
                  >
                    {isRegisterSubmitting ? 'Регистрация…' : 'Зарегистрироваться'}
                  </button>
                </>
              )}
            >
              <fieldset disabled={isRegisterSubmitting} className="m-0 space-y-5 border-0 p-0">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Укажите игру и команду, чтобы зарегистрировать её на участие. Команда должна принадлежать вам как капитану.
                </p>
                {registerFeedback && (
                  <div
                    className={`rounded-2xl border p-4 text-sm ${
                      registerFeedback.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-rose-200 bg-rose-50 text-rose-700'
                    }`}
                  >
                    {registerFeedback.message}
                  </div>
                )}
                {(!location || !Number.isFinite(currentUserTelegramIdNumber)) && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                    Укажите площадку и привяжите Telegram в профиле, чтобы регистрироваться на игры.
                  </div>
                )}
                <div className="space-y-2">
                  <label htmlFor="register-team-select" className="text-sm font-semibold text-primary">
                    Ваша команда
                  </label>
                  {isRegisterTeamsLoading ? (
                    <p className="text-sm text-slate-500">Загружаем список команд…</p>
                  ) : registerTeams.length > 0 ? (
                    <select
                      id="register-team-select"
                      value={registerTeamId}
                      onChange={(event) => setRegisterTeamId(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
                    >
                      <option value="">Выберите команду</option>
                      {registerTeams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name || 'Без названия'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-slate-500">
                      У вас пока нет команд, где вы являетесь капитаном. Создайте команду или запросите права капитана.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label htmlFor="register-game-id" className="text-sm font-semibold text-primary">
                    ID игры
                  </label>
                  <input
                    id="register-game-id"
                    type="text"
                    value={registerGameId}
                    onChange={(event) => setRegisterGameId(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm uppercase tracking-wide focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
                    placeholder="Например, 64ff0c2e12"
                  />
                </div>
              </fieldset>
            </Modal>
            <Modal
              isOpen={isCreateGameModalOpen}
              title="Создать игру"
              onClose={handleCloseCreateGameModal}
              footer={(
                <>
                  <button
                    type="button"
                    onClick={handleCloseCreateGameModal}
                    disabled={isCreatingGame}
                    className={`inline-flex justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      isCreatingGame
                        ? 'cursor-not-allowed border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateGame}
                    disabled={isCreatingGame || newGameName.trim().length === 0}
                    className={`inline-flex justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
                      isCreatingGame || newGameName.trim().length === 0
                        ? 'bg-slate-400 cursor-not-allowed'
                        : 'bg-primary hover:bg-blue-700'
                    }`}
                  >
                    {isCreatingGame ? 'Создание…' : 'Создать'}
                  </button>
                </>
              )}
            >
              <fieldset disabled={isCreatingGame} className="m-0 space-y-5 border-0 p-0">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Будет создана пустая игра со стандартными настройками. После создания вы сможете настроить сценарий и задания.
                </p>
                {createGameFeedback && (
                  <div
                    className={`rounded-2xl border p-4 text-sm ${
                      createGameFeedback.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-rose-200 bg-rose-50 text-rose-700'
                    }`}
                  >
                    {createGameFeedback.message}
                  </div>
                )}
                <div className="space-y-2">
                  <label htmlFor="new-game-name" className="text-sm font-semibold text-primary">
                    Название игры
                  </label>
                  <input
                    id="new-game-name"
                    type="text"
                    value={newGameName}
                    onChange={(event) => setNewGameName(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
                    placeholder="Например, Ночной квест"
                  />
                </div>
              </fieldset>
            </Modal>
            <Modal
              isOpen={isDescriptionModalOpen}
              title={`Игра — ${selectedGame?.name || 'Без названия'}`}
              onClose={handleCloseDescriptionModal}
            >
              {selectedGame ? (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/60">
                    <h4 className="text-base font-semibold text-primary">Описание</h4>
                    {selectedGame.description ? (
                      <p className="mt-3 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
                        {selectedGame.description}
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">
                        Описание для этой игры не заполнено.
                      </p>
                    )}
                  </div>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                    <h4 className="text-base font-semibold text-primary">Общая информация</h4>
                    {selectedGame.image && (
                      <img
                        src={selectedGame.image}
                        alt="Обложка игры"
                        className="mt-4 h-48 w-full rounded-xl object-cover"
                      />
                    )}
                    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Тип игры</dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{gameTypeLabel}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Плановое начало</dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{plannedStartLabel}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Место старта</dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          {selectedGame.startingPlace || 'Не указано'}
                        </dd>
                      </div>
                      {canViewRestrictedGameInfo && (
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Финиш</dt>
                          <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                            {selectedGame.finishingPlace || 'Не указан'}
                          </dd>
                        </div>
                      )}
                      {canViewRestrictedGameInfo && (
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Индивидуальный старт</dt>
                          <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                            {selectedGame.individualStart ? 'Да' : 'Нет'}
                          </dd>
                        </div>
                      )}
                      {canViewRestrictedGameInfo && (
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Показывать организатора</dt>
                          <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                            {selectedGame.showCreator ? 'Да' : 'Нет'}
                          </dd>
                        </div>
                      )}
                      {canViewRestrictedGameInfo && (
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Публиковать задания в кабинете</dt>
                          <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                            {selectedGame.showTasks ? 'Да' : 'Нет'}
                          </dd>
                        </div>
                      )}
                      {canViewRestrictedGameInfo && (
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Скрывать результаты</dt>
                          <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                            {selectedGame.hideResult ? 'Да' : 'Нет'}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                    <h4 className="text-base font-semibold text-primary">Модераторы игры</h4>
                    {selectedGameModerators.length > 0 ? (
                      <ul className="mt-4 space-y-3">
                        {selectedGameModerators.map((moderator) => {
                          const moderatorId = typeof moderator === 'string' ? moderator : moderator.id
                          const fallback =
                            typeof moderator === 'string' ? availableModeratorsMap.get(moderator) : null
                          const name =
                            typeof moderator === 'string' ? fallback?.name ?? 'Без имени' : moderator.name || 'Без имени'
                          const username =
                            typeof moderator === 'string' ? fallback?.username ?? '' : moderator.username || ''
                          const telegramId =
                            typeof moderator === 'string' ? fallback?.telegramId ?? '' : moderator.telegramId || ''

                          return (
                            <li
                              key={moderatorId}
                              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900/80"
                            >
                              <div>
                                <p className="text-sm font-semibold text-primary">{name}</p>
                                {username && <p className="text-xs text-slate-500">@{username}</p>}
                                {telegramId && <p className="text-xs text-slate-400">ID: {telegramId}</p>}
                              </div>
                              {canEditSelectedGame && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveModerator(moderatorId)}
                                  className="inline-flex items-center rounded-xl border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-400/40 dark:text-rose-200 dark:hover:bg-rose-500/10"
                                >
                                  Удалить
                                </button>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500">Модераторы пока не назначены.</p>
                    )}

                    {canEditSelectedGame && (
                      <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
                        <label htmlFor="modal-game-moderator" className="text-sm font-semibold text-primary">
                          Добавить модератора
                        </label>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <select
                            id="modal-game-moderator"
                            value={selectedModeratorToAdd}
                            onChange={(event) => setSelectedModeratorToAdd(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
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
                          </select>
                          <button
                            type="button"
                            onClick={handleAddModerator}
                            disabled={!selectedModeratorToAdd}
                            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
                          >
                            Добавить
                          </button>
                        </div>
                        {availableModeratorsForSelect.length === 0 && (
                          <p className="text-xs text-slate-500">Все доступные модераторы уже назначены на эту игру.</p>
                        )}
                      </div>
                    )}
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                    <h4 className="text-base font-semibold text-primary">Параметры проведения</h4>
                    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Длительность задания</dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{taskDurationLabel}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Интервал подсказок</dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{cluesDurationLabel}</dd>
                      </div>
                      {canViewRestrictedGameInfo && (
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Режим досрочной подсказки</dt>
                          <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                            {clueModeDetails.modeLabel}
                            <br />
                            <span className="text-xs text-slate-500">{clueModeDetails.valueLabel}</span>
                          </dd>
                        </div>
                      )}
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Перерыв между заданиями</dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{breakDurationLabel}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Штраф за невыполненное задание</dt>
                        <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{taskFailurePenaltyLabel}</dd>
                      </div>
                      {canViewRestrictedGameInfo && manyCodesLimitLabel && (
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Лимит неверных кодов</dt>
                          <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{manyCodesLimitLabel}</dd>
                        </div>
                      )}
                      {canViewRestrictedGameInfo && manyCodesPenaltyLabel && (
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Штраф за превышение лимита</dt>
                          <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{manyCodesPenaltyLabel}</dd>
                        </div>
                      )}
                    </dl>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                    <h4 className="text-base font-semibold text-primary">Опции для капитана</h4>
                    <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                      <li className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${selectedGame.allowCaptainForceClue ? 'bg-emerald-500' : 'bg-slate-400'}`}
                          aria-hidden="true"
                        />
                        <span>
                          Капитан {selectedGame.allowCaptainForceClue ? 'может' : 'не может'} запрашивать подсказку
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${selectedGame.allowCaptainFailTask ? 'bg-emerald-500' : 'bg-slate-400'}`}
                          aria-hidden="true"
                        />
                        <span>
                          Капитан {selectedGame.allowCaptainFailTask ? 'может' : 'не может'} провалить задание
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${selectedGame.allowCaptainFinishBreak ? 'bg-emerald-500' : 'bg-slate-400'}`}
                          aria-hidden="true"
                        />
                        <span>
                          Капитан {selectedGame.allowCaptainFinishBreak ? 'может' : 'не может'} завершать перерыв
                        </span>
                      </li>
                    </ul>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                    <h4 className="text-base font-semibold text-primary">Стоимость участия</h4>
                    {selectedGame.prices?.length > 0 ? (
                      <ul className="mt-4 space-y-3">
                        {selectedGame.prices.map((price) => (
                          <li
                            key={price.id}
                            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/80"
                          >
                            <span className="text-slate-600 dark:text-slate-200">{price.name || 'Без названия'}</span>
                            <span className="font-semibold text-primary">
                              {currencyFormatter.format(Number(price.price) || 0)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500">Стоимость участия не указана.</p>
                    )}
                  </section>

                  {canViewRestrictedGameInfo && (
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                      <h4 className="text-base font-semibold text-primary">Финансы</h4>
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
                        <p>
                          Доходы: <span className="font-semibold">{currencyFormatter.format(financesSummary.income)}</span>
                        </p>
                        <p className="mt-1">
                          Расходы: <span className="font-semibold">{currencyFormatter.format(financesSummary.expense)}</span>
                        </p>
                        <p className={`mt-1 font-semibold ${balanceClass}`}>
                          Баланс: {currencyFormatter.format(financesSummary.balance)}
                        </p>
                      </div>
                      {selectedGame.finances?.length > 0 ? (
                        <ul className="mt-4 space-y-3">
                          {selectedGame.finances.map((entry) => (
                            <li
                              key={entry.id}
                              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/80"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <span
                                  className={`text-xs font-semibold ${
                                    entry.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'
                                  }`}
                                >
                                  {entry.type === 'expense' ? 'Расход' : 'Доход'}
                                </span>
                                <span className="text-sm font-semibold text-primary">
                                  {currencyFormatter.format(Number(entry.sum) || 0)}
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-slate-500">
                                {entry.date ? formatDate(entry.date) : 'Дата не указана'}
                              </p>
                              {entry.description ? (
                                <p className="mt-2 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
                                  {entry.description}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-4 text-sm text-slate-500">Финансовые записи отсутствуют.</p>
                      )}
                    </section>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Выберите игру из списка слева, чтобы просмотреть детали.</p>
              )}
            </Modal>
  </>
)

GameModals.propTypes = {
  selectedGame: PropTypes.object,
  isEditModalOpen: PropTypes.bool.isRequired,
  handleCloseEditModal: PropTypes.func.isRequired,
  canEditSelectedGame: PropTypes.bool.isRequired,
  isSaving: PropTypes.bool.isRequired,
  location: PropTypes.string,
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
  currencyFormatter: PropTypes.object.isRequired,
  financesSummary: PropTypes.shape({
    income: PropTypes.number.isRequired,
    expense: PropTypes.number.isRequired,
    balance: PropTypes.number.isRequired,
  }).isRequired,
  balanceClass: PropTypes.string.isRequired,
  expandedTaskIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  toggleTaskExpansion: PropTypes.func.isRequired,
  isTeamsModalOpen: PropTypes.bool.isRequired,
  handleCloseTeamsModal: PropTypes.func.isRequired,
  teamsModalState: PropTypes.shape({
    error: PropTypes.string,
    isLoading: PropTypes.bool.isRequired,
    gameTeams: PropTypes.array.isRequired,
    availableTeams: PropTypes.array.isRequired,
  }).isRequired,
  removingTeamIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  selectedTeamToAdd: PropTypes.string,
  setSelectedTeamToAdd: PropTypes.func.isRequired,
  handleAddTeamToGame: PropTypes.func.isRequired,
  isAddingTeam: PropTypes.bool.isRequired,
  handleRemoveTeamFromGame: PropTypes.func.isRequired,
  isRegisterModalOpen: PropTypes.bool.isRequired,
  handleCloseRegisterModal: PropTypes.func.isRequired,
  isRegisterSubmitting: PropTypes.bool.isRequired,
  handleSubmitRegister: PropTypes.func.isRequired,
  registerTeamId: PropTypes.string.isRequired,
  registerGameId: PropTypes.string.isRequired,
  setRegisterTeamId: PropTypes.func.isRequired,
  setRegisterGameId: PropTypes.func.isRequired,
  registerFeedback: PropTypes.shape({
    type: PropTypes.string.isRequired,
    message: PropTypes.string.isRequired,
  }),
  isRegisterTeamsLoading: PropTypes.bool.isRequired,
  registerTeams: PropTypes.array.isRequired,
  currentUserTelegramIdNumber: PropTypes.number,
  isCreateGameModalOpen: PropTypes.bool.isRequired,
  handleCloseCreateGameModal: PropTypes.func.isRequired,
  isCreatingGame: PropTypes.bool.isRequired,
  handleCreateGame: PropTypes.func.isRequired,
  newGameName: PropTypes.string.isRequired,
  setNewGameName: PropTypes.func.isRequired,
  createGameFeedback: PropTypes.shape({
    type: PropTypes.string.isRequired,
    message: PropTypes.string.isRequired,
  }),
  isDescriptionModalOpen: PropTypes.bool.isRequired,
  handleCloseDescriptionModal: PropTypes.func.isRequired,
  gameTypeLabel: PropTypes.string.isRequired,
  plannedStartLabel: PropTypes.string.isRequired,
  canViewRestrictedGameInfo: PropTypes.bool.isRequired,
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

GameModals.defaultProps = {
  selectedGame: null,
  location: null,
  registerFeedback: null,
  currentUserTelegramIdNumber: null,
  manyCodesLimitLabel: null,
  manyCodesPenaltyLabel: null,
}

export default memo(GameModals)
