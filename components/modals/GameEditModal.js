import { memo } from 'react'
import PropTypes from 'prop-types'
import dynamic from 'next/dynamic'

import Modal from '@components/Modal'
import AmountStepperInput from '@components/cabinet/AmountStepperInput'
import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetInputField from '@components/cabinet/CabinetInputField'
import CabinetSelectField from '@components/cabinet/CabinetSelectField'
import CabinetTextareaField from '@components/cabinet/CabinetTextareaField'
import ImagesInput from '@components/cabinet/ImagesInput'
import CabinetNumberField from '@components/cabinet/CabinetNumberField'
import NeonCheckbox from '@components/NeonCheckbox'
import formatDate from '@helpers/formatDate'
import formatDateTime from '@helpers/formatDateTime'
import ModalSection from './ModalSection'

const TaskRichEditor = dynamic(() => import('@components/cabinet/TaskRichEditor'), {
  ssr: false,
})

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
  editGameSeasons,
  isEditGameSeasonsLoading,
  isEditGameSeasonCreating,
  handleCreateSeasonForEditGame,
  sectionMode,
  modalTitleOverride,
}) => {
  const isTasksOnly = sectionMode === 'tasks'
  const isClosedGame =
    String(selectedGame?.status || '').toLowerCase() === 'closed'
  const isPhotoGame = selectedGame?.type === 'photo'
  const amountInputClassName =
    'aq-amount-step-input h-10 w-full rounded-xl border border-slate-200 bg-white px-12 py-2 text-center text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white'
  const fieldLabelClassName = 'text-sm font-semibold text-slate-700 dark:text-white'
  const fieldInputClassName =
    'w-full px-4 py-3 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none'
  const fieldSelectClassName = fieldInputClassName
  const compactLabelClassName =
    'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-200'
  const compactInputClassName =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white'
  const getCheckboxChecked = (valueOrEvent) =>
    typeof valueOrEvent === 'boolean'
      ? valueOrEvent
      : Boolean(valueOrEvent?.target?.checked)
  const debugCheckboxUpdate = (source, checked, payloadFactory) => {
    try {
      const payload = typeof payloadFactory === 'function' ? payloadFactory(checked) : payloadFactory
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

  const modalFooter = (
    <>
      <CabinetButton
        onClick={handleModalPrimaryAction}
        disabled={
          isSaving || (isDirty && (!canEditSelectedGame || !location))
        }
        variant="primary"
      >
        {isDirty
          ? isSaving
            ? 'Сохранение…'
            : 'Сохранить и закрыть'
          : 'Закрыть'}
      </CabinetButton>
      <CabinetButton
        onClick={handleResetChanges}
        disabled={!canEditSelectedGame || !isDirty}
        variant="secondary"
      >
        Отменить изменения
      </CabinetButton>
    </>
  )

  if (!selectedGame) {
    console.error('[GameEditModal] Модалка редактирования открыта без selectedGame', {
      isEditModalOpen,
    })
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
          className="m-0 space-y-4 border-0 p-0"
        >
          <ModalSection>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Для закрытой игры можно менять только параметры публикации.
            </p>
            <div className="mt-4 grid gap-3">
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
                      <CabinetInputField
                        id="game-date"
                        label="Плановое начало"
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
                          (checked) => ({ individualStart: checked })
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
                          selectedGame.descriptionRich ||
                          selectedGame.description ||
                          ''
                        }
                        directory={`games/${selectedGame.id || 'draft'}/description/editor`}
                        disabled={!canEditSelectedGame || isSaving}
                        placeholder="Введите описание игры. Можно использовать форматирование, картинки и аудио."
                        onChange={({ html, plainText, media }) => {
                          updateSelectedGame({
                            descriptionRich: html,
                            description:
                              plainText || stripHtmlToPlainText(html || ''),
                            descriptionMedia: media,
                          })
                        }}
                      />
                    </div>

                    {(selectedGameModerators.length > 0 || canEditSelectedGame) && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Модераторы игры</h3>
                        {selectedGameModerators.length > 0 ? (
                          <ul className="mt-3 space-y-2">
                            {selectedGameModerators.map((moderator) => {
                              const moderatorId = typeof moderator === 'string' ? moderator : moderator.id
                              const fallback =
                                typeof moderator === 'string'
                                  ? availableModeratorsMap.get(moderator)
                                  : null
                              const name =
                                typeof moderator === 'string'
                                  ? fallback?.name ?? 'Без имени'
                                  : moderator.name || 'Без имени'
                              const username =
                                typeof moderator === 'string'
                                  ? fallback?.username ?? ''
                                  : moderator.username || ''
                              const telegramId =
                                typeof moderator === 'string'
                                  ? fallback?.telegramId ?? ''
                                  : moderator.telegramId || ''

                              return (
                                <li
                                  key={moderatorId}
                                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/80"
                                >
                                  <div>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{name}</p>
                                    {username && <p className="text-xs text-slate-500">@{username}</p>}
                                    {telegramId && <p className="text-xs text-slate-500">ID: {telegramId}</p>}
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
                          <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                            <p className={fieldLabelClassName}>Добавить модератора</p>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                              <CabinetSelectField
                                id="edit-game-moderator"
                                label={null}
                                value={selectedModeratorToAdd}
                                onChange={(event) => setSelectedModeratorToAdd(event.target.value)}
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

                    </ModalSection>
                    )}

                    {!isTasksOnly && (
                    <ModalSection>
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Настройки заданий и подсказок</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      <CabinetNumberField
                        id="game-task-duration"
                        label="Продолжительность задания (мин)"
                        min="0"
                        value={toMinutes(selectedGame.taskDuration)}
                        onChange={(event) =>
                          updateSelectedGame({
                            taskDuration: toSeconds(event.target.value),
                          })
                        }
                        inputClassName={fieldInputClassName}
                        labelClassName={fieldLabelClassName}
                      />
                      <div>
                        <CabinetNumberField
                          id="game-clues-duration"
                          label="Время до подсказки (мин)"
                          min="0"
                          value={toMinutes(selectedGame.cluesDuration)}
                          onChange={(event) =>
                            updateSelectedGame({
                              cluesDuration: toSeconds(event.target.value),
                            })
                          }
                          inputClassName={fieldInputClassName}
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
                      <CabinetNumberField
                        id="game-clue-penalty"
                        label={
                          selectedGame.clueEarlyAccessMode === 'penalty'
                            ? 'Штраф за досрочную подсказку (мин)'
                            : 'Дополнительное время после подсказки (мин)'
                        }
                        min="0"
                        value={toMinutes(selectedGame.clueEarlyPenalty)}
                        onChange={(event) =>
                          updateSelectedGame({
                            clueEarlyPenalty: toSeconds(event.target.value),
                          })
                        }
                        inputClassName={fieldInputClassName}
                        labelClassName={fieldLabelClassName}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <CabinetNumberField
                        id="game-break-duration"
                        label="Перерыв между заданиями (мин)"
                        min="0"
                        value={toMinutes(selectedGame.breakDuration)}
                        onChange={(event) =>
                          updateSelectedGame({
                            breakDuration: toSeconds(event.target.value),
                          })
                        }
                        inputClassName={fieldInputClassName}
                        labelClassName={fieldLabelClassName}
                      />
                      <CabinetNumberField
                        id="game-task-penalty"
                        label={
                          selectedGame.type === 'photo'
                            ? 'Штраф за невыполненное задание (баллы)'
                            : 'Штраф за невыполненное задание (мин)'
                        }
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
                        inputClassName={fieldInputClassName}
                        labelClassName={fieldLabelClassName}
                      />
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
                        <CabinetNumberField
                          id="game-many-codes-penalty"
                          label="Штраф за превышение лимита (мин)"
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
                          inputClassName={fieldInputClassName}
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
                            (checked) => ({ allowCaptainForceClue: checked })
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
                            (checked) => ({ allowCaptainFailTask: checked })
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
                            (checked) => ({ allowCaptainFinishBreak: checked })
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
                      <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Задания</h2>
                      <CabinetButton
                        onClick={handleAddTask}
                        variant="primary"
                      >
                        Добавить задание
                      </CabinetButton>
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
                                    <CabinetInputField
                                      id={`task-title-${task.id}`}
                                      label="Название задания"
                                      type="text"
                                      value={task.title}
                                      onChange={(event) =>
                                        handleTaskFieldChange(task.id, 'title', event.target.value)
                                      }
                                      labelClassName={fieldLabelClassName}
                                      inputClassName={fieldInputClassName}
                                    />
                                    <div className="flex flex-col gap-2 md:items-start">
                                      <NeonCheckbox
                                        id={`task-is-bonus-${task.id}`}
                                        checked={Boolean(task.isBonusTask)}
                                        onChange={(eventOrChecked) =>
                                          (() => {
                                            const checked = getCheckboxChecked(eventOrChecked)
                                            try {
                                              handleTaskCheckboxChange(task.id, 'isBonusTask', checked)
                                            } catch (error) {
                                              console.error('[GameEditModal] Ошибка обновления чекбокса задания', {
                                                source: 'task.isBonusTask',
                                                taskId: task.id,
                                                checked,
                                                gameId: selectedGame?.id ?? null,
                                                error,
                                              })
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
                                            const checked = getCheckboxChecked(eventOrChecked)
                                            try {
                                              handleTaskCheckboxChange(task.id, 'canceled', checked)
                                            } catch (error) {
                                              console.error('[GameEditModal] Ошибка обновления чекбокса задания', {
                                                source: 'task.canceled',
                                                taskId: task.id,
                                                checked,
                                                gameId: selectedGame?.id ?? null,
                                                error,
                                              })
                                            }
                                          })()
                                        }
                                        label="Задание отменено"
                                        labelClassName="text-sm text-slate-600 dark:text-slate-200"
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <p className={fieldLabelClassName}>Описание задания</p>
                                    <TaskRichEditor
                                      value={task.taskRich || task.task || ''}
                                      directory={`games/${selectedGame.id || 'draft'}/tasks/${task.id}/editor`}
                                      disabled={!canEditSelectedGame || isSaving}
                                      placeholder="Введите описание задания. Можно использовать форматирование, картинки и аудио."
                                      onChange={({ html, plainText, media }) => {
                                        handleTaskFieldChange(task.id, 'taskRich', html)
                                        handleTaskFieldChange(task.id, 'task', plainText)
                                        handleTaskFieldChange(task.id, 'taskMedia', media)
                                      }}
                                    />
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
                                            event.target.value
                                          )
                                        }
                                        labelClassName={fieldLabelClassName}
                                        inputClassName={fieldInputClassName}
                                      />
                                    )}
                                  </div>

                                  <CabinetTextareaField
                                    id={`task-post-message-${task.id}`}
                                    label="Сообщение после выполнения"
                                    rows={3}
                                    value={task.postMessage}
                                    onChange={(event) =>
                                      handleTaskFieldChange(task.id, 'postMessage', event.target.value)
                                    }
                                    labelClassName={fieldLabelClassName}
                                    textareaClassName={fieldInputClassName}
                                  />

                                  <div>
                                    <h4 className="text-sm font-semibold text-slate-700 dark:text-white">Координаты</h4>
                                    <div className="mt-2 grid gap-4 sm:grid-cols-3">
                                      <CabinetNumberField
                                        id={`task-lat-${task.id}`}
                                        label="Широта"
                                        step="any"
                                        value={task.coordinates?.latitude ?? ''}
                                        onChange={(event) =>
                                          handleTaskCoordinateChange(
                                            task.id,
                                            'latitude',
                                            event.target.value
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
                                            event.target.value
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
                                            event.target.value
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
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                      <h4 className="text-sm font-semibold text-slate-700 dark:text-white">Коды задания</h4>
                                      <CabinetButton
                                        onClick={() => handleAddTaskCode(task.id)}
                                        variant="secondary"
                                        tone="brand"
                                        size="sm"
                                        className="inline-flex justify-center"
                                      >
                                        Добавить код
                                      </CabinetButton>
                                    </div>
                                    {task.codes?.length > 0 ? (
                                      <div className="mt-3 space-y-3">
                                        {task.codes.map((codeValue, codeIndex) => (
                                          <div
                                            key={`${task.id}-code-${codeIndex}`}
                                            className="flex flex-col gap-2 sm:flex-row sm:items-center"
                                          >
                                            <CabinetInputField
                                              id={`task-code-${task.id}-${codeIndex}`}
                                              label={null}
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
                                              containerClassName="w-full space-y-0"
                                              inputClassName={compactInputClassName}
                                            />
                                            <CabinetButton
                                              onClick={() => handleRemoveTaskCode(task.id, codeIndex)}
                                              variant="secondary"
                                              tone="danger"
                                              size="sm"
                                              className="inline-flex items-center justify-center"
                                            >
                                              Удалить
                                            </CabinetButton>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="mt-3 text-sm text-slate-500 dark:text-slate-200">Кодов пока нет.</p>
                                    )}
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
                                            event.target.value
                                          )
                                        }
                                        labelClassName={compactLabelClassName}
                                        inputClassName={compactInputClassName}
                                      />
                                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-200">
                                        Оставьте пустым, чтобы требовались все коды.
                                      </p>
                                    </div>
                                  </div>
                                  )}

                                  <div>
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                      <h4 className="text-sm font-semibold text-slate-700 dark:text-white">Подсказки</h4>
                                      <CabinetButton
                                        onClick={() => handleAddClue(task.id)}
                                        variant="secondary"
                                        tone="brand"
                                        size="sm"
                                        className="inline-flex justify-center"
                                      >
                                        Добавить подсказку
                                      </CabinetButton>
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
                                            <div className="space-y-2">
                                              <p className={compactLabelClassName}>Текст подсказки</p>
                                              <TaskRichEditor
                                                value={clue.clueRich || clue.clue || ''}
                                                directory={`games/${selectedGame.id || 'draft'}/tasks/${task.id}/clues/${clue.id}/editor`}
                                                disabled={!canEditSelectedGame || isSaving}
                                                placeholder="Введите текст подсказки. Можно использовать форматирование, картинки и аудио."
                                                onChange={({ html, plainText }) => {
                                                  handleTaskClueChange(task.id, clue.id, 'clueRich', html)
                                                  handleTaskClueChange(task.id, clue.id, 'clue', plainText)
                                                }}
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
                                              className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                                            >
                                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <p className="text-sm font-semibold text-slate-700 dark:text-white">
                                                  Подзадание {subIndex + 1}
                                                </p>
                                                <CabinetButton
                                                  onClick={() => handleRemoveSubTask(task.id, subTask.id)}
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
                                                      event.target.value
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
                                                      event.target.value
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
                                                    event.target.value
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
                                        <p className="mt-3 text-sm text-slate-500 dark:text-slate-200">Подзаданий пока нет.</p>
                                      )}
                                    </div>
                                  )}

                                  {!isPhotoGame && (
                                  <div>
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                      <h4 className="text-sm font-semibold text-slate-700 dark:text-white">Штрафные коды</h4>
                                      <CabinetButton
                                        onClick={() => handleAddPenaltyCode(task.id)}
                                        variant="secondary"
                                        tone="brand"
                                        size="sm"
                                        className="inline-flex justify-center"
                                      >
                                        Добавить штраф
                                      </CabinetButton>
                                    </div>
                                    {task.penaltyCodes?.length > 0 ? (
                                      <div className="mt-3 space-y-4">
                                        {task.penaltyCodes.map((penalty) => (
                                          <div
                                            key={penalty.id}
                                            className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                                          >
                                            <div className="grid gap-3 md:grid-cols-4">
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
                                                    event.target.value
                                                  )
                                                }
                                                containerClassName="md:col-span-2 space-y-1"
                                                labelClassName={compactLabelClassName}
                                                inputClassName={compactInputClassName}
                                              />
                                              <CabinetNumberField
                                                id={`task-penalty-value-${penalty.id}`}
                                                label="Штраф"
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
                                                containerClassName="space-y-1"
                                                labelClassName={compactLabelClassName}
                                                inputClassName={compactInputClassName}
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
                                                  event.target.value
                                                )
                                              }
                                              containerClassName="space-y-1"
                                              labelClassName={compactLabelClassName}
                                              inputClassName={compactInputClassName}
                                            />
                                            <div className="flex justify-end">
                                              <CabinetButton
                                                onClick={() => handleRemovePenaltyCode(task.id, penalty.id)}
                                                variant="secondary"
                                                tone="danger"
                                                size="sm"
                                                className="inline-flex items-center justify-center"
                                              >
                                                Удалить штраф
                                              </CabinetButton>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="mt-3 text-sm text-slate-500 dark:text-slate-200">Штрафных кодов пока нет.</p>
                                    )}
                                  </div>
                                  )}

                                  {!isPhotoGame && (
                                  <div>
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                      <h4 className="text-sm font-semibold text-slate-700 dark:text-white">Бонусные коды</h4>
                                      <CabinetButton
                                        onClick={() => handleAddBonusCode(task.id)}
                                        variant="secondary"
                                        tone="brand"
                                        size="sm"
                                        className="inline-flex justify-center"
                                      >
                                        Добавить бонус
                                      </CabinetButton>
                                    </div>
                                    {task.bonusCodes?.length > 0 ? (
                                      <div className="mt-3 space-y-4">
                                        {task.bonusCodes.map((bonus) => (
                                          <div
                                            key={bonus.id}
                                            className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                                          >
                                            <div className="grid gap-3 md:grid-cols-4">
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
                                                    event.target.value
                                                  )
                                                }
                                                containerClassName="md:col-span-2 space-y-1"
                                                labelClassName={compactLabelClassName}
                                                inputClassName={compactInputClassName}
                                              />
                                              <CabinetNumberField
                                                id={`task-bonus-value-${bonus.id}`}
                                                label="Бонус"
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
                                                containerClassName="space-y-1"
                                                labelClassName={compactLabelClassName}
                                                inputClassName={compactInputClassName}
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
                                                  event.target.value
                                                )
                                              }
                                              containerClassName="space-y-1"
                                              labelClassName={compactLabelClassName}
                                              inputClassName={compactInputClassName}
                                            />
                                            <div className="flex justify-end">
                                              <CabinetButton
                                                onClick={() => handleRemoveBonusCode(task.id, bonus.id)}
                                                variant="secondary"
                                                tone="danger"
                                                size="sm"
                                                className="inline-flex items-center justify-center"
                                              >
                                                Удалить бонус
                                              </CabinetButton>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="mt-3 text-sm text-slate-500 dark:text-slate-200">Бонусных кодов пока нет.</p>
                                    )}
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
                                            }»? Это действие нельзя отменить.`
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
                    </ModalSection>
                    )}

                    {!isTasksOnly && (
                    <ModalSection>
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Публикация и результаты</h2>
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
                                : { isRated: false }
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
                            (checked) => ({ hidden: checked })
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
                            (checked) => ({ showCreator: checked })
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
                            (checked) => ({ showTasks: checked })
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
                            (checked) => ({ hideResult: !checked })
                          )
                        }
                        label="Показать результаты"
                        labelClassName="text-sm text-slate-600 dark:text-slate-200"
                      />
                    </div>
                    {Boolean(selectedGame.isRated ?? true) && (
                      <div className="mt-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                        <label
                          htmlFor="game-season"
                          className="block text-sm font-semibold text-slate-700 dark:text-slate-100"
                        >
                          Сезон
                        </label>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <select
                            id="game-season"
                            value={typeof selectedGame.seasonId === 'string' ? selectedGame.seasonId : ''}
                            onChange={(event) => {
                              const seasonId = event.target.value
                              const selectedSeason = Array.isArray(editGameSeasons)
                                ? editGameSeasons.find((season) => season.id === seasonId)
                                : null
                              updateSelectedGame({
                                seasonId,
                                seasonName: selectedSeason?.name || '',
                              })
                            }}
                            disabled={isEditGameSeasonsLoading || !canEditSelectedGame || isSaving}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
                          >
                            <option value="">
                              {isEditGameSeasonsLoading ? 'Загружаем сезоны…' : 'Вне сезона'}
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
                            disabled={!canEditSelectedGame || isEditGameSeasonCreating || isSaving}
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
                        {isGeneratingResults ? 'Формируем…' : 'Сформировать результаты'}
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
                      <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Стоимость участия</h2>
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
                      <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Финансы игры</h2>
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
                                handleFinanceChange(entry.id, 'type', event.target.value)
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
                                handleFinanceChange(entry.id, 'date', event.target.value)
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
                                  handleFinanceChange(entry.id, 'description', event.target.value)
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
                    </ModalSection>
                    )}

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
  editGameSeasons: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      location: PropTypes.string,
    })
  ),
  isEditGameSeasonsLoading: PropTypes.bool,
  isEditGameSeasonCreating: PropTypes.bool,
  handleCreateSeasonForEditGame: PropTypes.func.isRequired,
  sectionMode: PropTypes.oneOf(['full', 'tasks']),
  modalTitleOverride: PropTypes.string,
}

GameEditModal.defaultProps = {
  selectedGame: null,
  location: null,
  editGameSeasons: [],
  isEditGameSeasonsLoading: false,
  isEditGameSeasonCreating: false,
  sectionMode: 'full',
  modalTitleOverride: null,
}

export default memo(GameEditModal)






