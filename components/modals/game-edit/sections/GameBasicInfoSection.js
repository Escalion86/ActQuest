import { memo, useRef } from 'react'
import PropTypes from 'prop-types'
import dynamic from 'next/dynamic'

import CabinetInputField from '@components/cabinet/CabinetInputField'
import CabinetSelectField from '@components/cabinet/CabinetSelectField'
import NeonCheckbox from '@components/NeonCheckbox'
import ImagesInput from '@components/cabinet/ImagesInput'
import ModalSection from '@components/modals/ModalSection'
import {
  formatDateTimeLocalInLocation,
  parseDateTimeLocalInLocation,
} from '@helpers/dateTimeLocalInLocation'
import {
  stripHtmlToPlainText,
  normalizeComparableEditorPlainText,
  normalizeComparableRichText,
  areComparableMediaListsEqual,
  isInitialEditorHtmlNormalization,
} from '../sharedHelpers'

const TaskRichEditor = dynamic(
  () => import('@components/cabinet/TaskRichEditor'),
  { ssr: false },
)

const fieldLabelClassName =
  'text-sm font-semibold text-slate-700 dark:text-white'
const fieldInputClassName =
  'w-full px-4 py-3 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none'
const fieldSelectClassName = fieldInputClassName

const GameBasicInfoSection = ({
  selectedGame,
  canEditSelectedGame,
  isSaving,
  updateSelectedGame,
  GAME_TYPE_OPTIONS,
  editGameLocationOptions,
  availableOrganizersForSelect,
  debugCheckboxUpdate,
  getCheckboxChecked,
}) => {
  const descriptionEditorInitialWindowRef = useRef({
    gameId: null,
    until: 0,
  })
  const currentGameId = selectedGame?.id || 'draft'
  if (descriptionEditorInitialWindowRef.current.gameId !== currentGameId) {
    descriptionEditorInitialWindowRef.current = {
      gameId: currentGameId,
      until: Date.now() + 4000,
    }
  }

  const organizersByUserId = new Map(
    (Array.isArray(availableOrganizersForSelect)
      ? availableOrganizersForSelect
      : []
    ).map((organizer) => [organizer.id, organizer]),
  )

  return (
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
        onChange={(event) => updateSelectedGame({ name: event.target.value })}
        labelClassName={fieldLabelClassName}
        inputClassName={fieldInputClassName}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <CabinetSelectField
          id="game-type"
          label="Тип игры"
          value={selectedGame.type}
          onChange={(event) => updateSelectedGame({ type: event.target.value })}
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

      <NeonCheckbox
        id="game-show-finishing-place"
        checked={Boolean(selectedGame.showFinishingPlace)}
        onChange={(eventOrChecked) =>
          debugCheckboxUpdate(
            'showFinishingPlace',
            getCheckboxChecked(eventOrChecked),
            (checked) => ({ showFinishingPlace: checked }),
          )
        }
        label="Показывать место окончания"
        labelClassName="text-sm text-slate-600 dark:text-slate-200"
      />

      <div className="space-y-2">
        <p className={fieldLabelClassName}>Описание</p>
        <TaskRichEditor
          value={selectedGame.descriptionRich || selectedGame.description || ''}
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
            const nextDescriptionRich = typeof html === 'string' ? html : ''
            const currentDescription =
              typeof selectedGame.description === 'string'
                ? selectedGame.description
                : ''
            const currentDescriptionRich =
              typeof selectedGame.descriptionRich === 'string'
                ? selectedGame.descriptionRich
                : ''
            const isSameDescription =
              normalizeComparableEditorPlainText(nextDescription) ===
              normalizeComparableEditorPlainText(currentDescription)
            const isSameDescriptionRich =
              normalizeComparableRichText(
                nextDescriptionRich,
                nextDescription,
              ) ===
              normalizeComparableRichText(
                currentDescriptionRich,
                currentDescription,
              )
            const isSameMedia = areComparableMediaListsEqual(
              media,
              selectedGame.descriptionMedia,
            )
            const isInitialHtmlNormalization =
              isInitialEditorHtmlNormalization({
                nextPlainText: nextDescription,
                nextRichText: nextDescriptionRich,
                currentPlainText: currentDescription,
                currentRichText: currentDescriptionRich,
              })
            const isInitialEditorEquivalentNormalization =
              Date.now() <= descriptionEditorInitialWindowRef.current.until &&
              isSameDescription &&
              isSameMedia
            if (
              (isSameDescription && isSameDescriptionRich && isSameMedia) ||
              (isInitialHtmlNormalization && isSameMedia) ||
              isInitialEditorEquivalentNormalization
            ) {
              return
            }
            descriptionEditorInitialWindowRef.current.until = 0
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
                selectedGame?.creatorUserId || selectedGame?.creator?.id || '',
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
              {availableOrganizersForSelect.map((organizer) => (
                <option key={organizer.id} value={organizer.id}>
                  {organizer.name || 'Без имени'}
                </option>
              ))}
            </CabinetSelectField>
            {availableOrganizersForSelect.length === 0 && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                Нет доступных пользователей для выбора организатора.
              </p>
            )}
          </div>
        </div>
      )}
    </ModalSection>
  )
}

GameBasicInfoSection.propTypes = {
  selectedGame: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    type: PropTypes.string,
    location: PropTypes.string,
    dateStart: PropTypes.string,
    individualStart: PropTypes.bool,
    startingPlace: PropTypes.string,
    finishingPlace: PropTypes.string,
    showFinishingPlace: PropTypes.bool,
    description: PropTypes.string,
    descriptionRich: PropTypes.string,
    descriptionMedia: PropTypes.array,
    image: PropTypes.string,
    creatorUserId: PropTypes.string,
    creator: PropTypes.shape({ id: PropTypes.string }),
  }).isRequired,
  canEditSelectedGame: PropTypes.bool.isRequired,
  isSaving: PropTypes.bool.isRequired,
  updateSelectedGame: PropTypes.func.isRequired,
  GAME_TYPE_OPTIONS: PropTypes.array.isRequired,
  editGameLocationOptions: PropTypes.array.isRequired,
  availableOrganizersForSelect: PropTypes.array.isRequired,
  debugCheckboxUpdate: PropTypes.func.isRequired,
  getCheckboxChecked: PropTypes.func.isRequired,
}

export default memo(GameBasicInfoSection)
