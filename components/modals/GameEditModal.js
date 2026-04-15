import { memo, useEffect, useState } from 'react'
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
  availableOrganizersForSelect,
  selectedModeratorToAdd,
  setSelectedModeratorToAdd,
  handleAddModerator,
  handleRemoveModerator,
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
  const organizersByTelegramId = new Map(
    (Array.isArray(availableOrganizersForSelect)
      ? availableOrganizersForSelect
      : []
    ).map((organizer) => [organizer.telegramId, organizer]),
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
    }
  }, [isEditModalOpen, selectedGame?.id])

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

            {(selectedGame?.creatorTelegramId ||
              availableOrganizersForSelect.length > 0 ||
              canEditSelectedGame) && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                  Организатор игры
                </h3>
                <div className="mt-3">
                  <CabinetSelectField
                    id="edit-game-organizer"
                    label={null}
                    value={String(selectedGame?.creatorTelegramId || '')}
                    onChange={(event) => {
                      const nextTelegramId = String(
                        event.target.value || '',
                      ).trim()
                      const nextOrganizer =
                        organizersByTelegramId.get(nextTelegramId)
                      updateSelectedGame({
                        creatorTelegramId: nextTelegramId,
                        creator: nextOrganizer
                          ? {
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
                        <option
                          key={organizer.telegramId}
                          value={organizer.telegramId}
                        >
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
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
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
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/80"
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
                  <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
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
          </ModalSection>
        )}

        {!isTasksOnly && (
          <ModalSection>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              Настройки заданий и подсказок
            </h2>
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
              <CabinetButton onClick={handleAddTask} variant="primary">
                Добавить задание
              </CabinetButton>
            </div>

            {selectedGame.tasks?.length > 0 ? (
              <div className="space-y-4">
                {selectedGame.tasks.map((task, index) => {
                  const isExpanded = expandedTaskIds.includes(task.id)
                  const taskTitle = typeof task?.title === 'string' ? task.title.trim() : ''
                  const taskDescription = getTaskDescriptionText(task).trim()
                  const taskClues = Array.isArray(task?.clues) ? task.clues : []
                  const hasFilledClue = taskClues.some(
                    (clue) => getClueText(clue).trim() !== '',
                  )
                  const normalizedCodes = (Array.isArray(task?.codes) ? task.codes : [])
                    .map((codeValue) =>
                      typeof codeValue === 'string' ? codeValue.trim() : '',
                    )
                    .filter(Boolean)
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
                  const hasTaskValidationErrors =
                    !taskTitle ||
                    !taskDescription ||
                    taskClues.length === 0 ||
                    !hasFilledClue ||
                    (!isPhotoGame && normalizedCodes.length === 0) ||
                    hasCodesOverflowError
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
                            {task.isBonusTask
                              ? 'Бонусное задание'
                              : 'Основное задание'}
                            {task.canceled ? ' · Отменено' : ''}
                            {task.codes?.length
                              ? ` · Код${task.codes.length === 1 ? '' : 'ы'}: ${task.codes.length}`
                              : ''}
                            {task.clues?.length
                              ? ` · Подсказок: ${task.clues.length}`
                              : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasTaskValidationErrors ? (
                            <span
                              className="inline-flex h-5 w-5 items-center justify-center"
                              title="В задании есть незаполненные обязательные поля"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className="h-5 w-5"
                                aria-hidden="true"
                              >
                                <path
                                  d="M12 3L2 21h20L12 3z"
                                  fill="#ef4444"
                                />
                                <rect
                                  x="11"
                                  y="8"
                                  width="2"
                                  height="7"
                                  rx="1"
                                  fill="#ffffff"
                                />
                                <circle cx="12" cy="18" r="1.3" fill="#ffffff" />
                              </svg>
                            </span>
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

                      {isExpanded && (
                        <div className="space-y-5 px-4 py-5">
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
                          </div>

                          <div className="space-y-2">
                            <p className={fieldLabelClassName}>
                              {withRequiredMark('Описание задания')}
                            </p>
                            <TaskRichEditor
                              value={task.taskRich || task.task || ''}
                              directory={`games/${selectedGame.id || 'draft'}/tasks/${task.id}/editor`}
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
                                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60"
                                  >
                                    <summary className="flex list-none cursor-pointer items-center justify-between gap-2 rounded-xl px-2 py-1 text-sm font-medium text-slate-700 marker:content-none dark:text-slate-100">
                                      <div className="min-w-0 flex items-center gap-2">
                                        <span className="rounded-full border border-cyan-300/70 bg-cyan-100/70 px-2 py-0.5 text-[11px] font-semibold text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">
                                          Подсказка
                                        </span>
                                        <span className="truncate font-semibold">
                                          {truncateWithDots(getClueText(clue), 72) ||
                                            `${clueIndex + 1}`}
                                        </span>
                                      </div>
                                      <AccordionChevronIcon
                                        isOpen={expandedClueAccordions.has(
                                          `${task.id}-clue-${clue.id}`,
                                        )}
                                      />
                                    </summary>
                                    <div className="mt-2 space-y-2">
                                      <TaskRichEditor
                                        value={clue.clueRich || clue.clue || ''}
                                        directory={`games/${selectedGame.id || 'draft'}/tasks/${task.id}/clues/${clue.id}/editor`}
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

                          <CabinetTextareaField
                            id={`task-post-message-${task.id}`}
                            label="Сообщение после выполнения"
                            rows={3}
                            value={task.postMessage}
                            onChange={(event) =>
                              handleTaskFieldChange(
                                task.id,
                                'postMessage',
                                event.target.value,
                              )
                            }
                            labelClassName={fieldLabelClassName}
                            textareaClassName={fieldInputClassName}
                          />

                          <div>
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-white">
                              Координаты
                            </h4>
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
                                  {withRequiredMark('Коды задания')}
                                </h4>
                              </div>
                              {task.codes?.length > 0 ? (
                                <div className="mt-3 space-y-3">
                                  {task.codes.map((codeValue, codeIndex) => {
                                    const accordionKey = `${task.id}-main-${codeIndex}`
                                    const isExpanded =
                                      expandedCodeAccordions.has(accordionKey)

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
                                      className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60"
                                    >
                                      <summary className="flex list-none cursor-pointer items-center justify-between gap-2 rounded-xl px-2 py-1 text-sm font-medium text-slate-700 marker:content-none dark:text-slate-100">
                                        <div className="min-w-0 flex items-center gap-2">
                                          <span className="rounded-full border border-cyan-300/70 bg-cyan-100/70 px-2 py-0.5 text-[11px] font-semibold text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">
                                            Код
                                          </span>
                                          <span className="truncate font-semibold">
                                            {compactSingleLine(codeValue) ||
                                              `Код ${codeIndex + 1}`}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {(Array.isArray(task.codePhotos)
                                            ? task.codePhotos[codeIndex]
                                            : '') ? (
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
                                      </summary>
                                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
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
                                      className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
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
                                  {task.penaltyCodes.map((penalty, penaltyIndex) => {
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
                                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                                    >
                                      <summary className="flex list-none cursor-pointer items-center justify-between gap-2 rounded-xl px-2 py-1 text-sm font-medium text-slate-700 marker:content-none dark:text-slate-100">
                                        <div className="min-w-0 flex items-center gap-2">
                                          <span className="rounded-full border border-rose-300/70 bg-rose-100/80 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                                            Штраф
                                          </span>
                                          <span className="truncate font-semibold">
                                            {compactSingleLine(penalty.code) ||
                                              'Код не указан'}
                                          </span>
                                          {truncateWithDots(
                                            penalty.description,
                                          ) ? (
                                            <span className="max-w-[240px] truncate text-xs font-normal text-slate-500 dark:text-slate-300">
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
                                      </summary>
                                      <div className="mt-2 grid gap-3 md:grid-cols-4">
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
                                              event.target.value,
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
                                            images={[penalty.image || ''].filter(
                                              Boolean,
                                            )}
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
                                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                                    >
                                      <summary className="flex list-none cursor-pointer items-center justify-between gap-2 rounded-xl px-2 py-1 text-sm font-medium text-slate-700 marker:content-none dark:text-slate-100">
                                        <div className="min-w-0 flex items-center gap-2">
                                          <span className="rounded-full border border-emerald-300/70 bg-emerald-100/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                                            Бонус
                                          </span>
                                          <span className="truncate font-semibold">
                                            {compactSingleLine(bonus.code) ||
                                              'Код не указан'}
                                          </span>
                                          {truncateWithDots(
                                            bonus.description,
                                          ) ? (
                                            <span className="max-w-[240px] truncate text-xs font-normal text-slate-500 dark:text-slate-300">
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
                                      </summary>
                                      <div className="mt-2 grid gap-3 md:grid-cols-4">
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
                                              event.target.value,
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
                                            images={[bonus.image || ''].filter(
                                              Boolean,
                                            )}
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
              <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
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
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
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

            <div className="p-4 bg-slate-50 border border-slate-200 dark:border-slate-700 dark:bg-slate-800/60 rounded-2xl">
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
  handleTaskCodePhotoChange: PropTypes.func.isRequired,
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
  availableOrganizersForSelect: PropTypes.arrayOf(
    PropTypes.shape({
      telegramId: PropTypes.string.isRequired,
      name: PropTypes.string,
      username: PropTypes.string,
    }),
  ).isRequired,
  selectedModeratorToAdd: PropTypes.string.isRequired,
  setSelectedModeratorToAdd: PropTypes.func.isRequired,
  handleAddModerator: PropTypes.func.isRequired,
  handleRemoveModerator: PropTypes.func.isRequired,
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
  sectionMode: 'full',
  modalTitleOverride: null,
}

AccordionChevronIcon.propTypes = {
  isOpen: PropTypes.bool,
}

AccordionChevronIcon.defaultProps = {
  isOpen: false,
}

export default memo(GameEditModal)
