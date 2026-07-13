import { memo } from 'react'
import PropTypes from 'prop-types'

import CabinetDurationField from '@components/cabinet/CabinetDurationField'
import CabinetNumberField from '@components/cabinet/CabinetNumberField'
import CabinetSelectField from '@components/cabinet/CabinetSelectField'
import NeonCheckbox from '@components/NeonCheckbox'
import ModalSection from '@components/modals/ModalSection'
import {
  getTimedCluesCount,
  normalizeClueEarlyAccessFrom,
} from '@helpers/clueEarlyAccess'

const fieldLabelClassName =
  'text-sm font-semibold text-slate-700 dark:text-white'
const fieldInputClassName =
  'w-full px-4 py-3 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none'
const fieldSelectClassName = fieldInputClassName

const GameSettingsSection = ({
  selectedGame,
  canEditSelectedGame,
  isSaving,
  updateSelectedGame,
  CLUE_EARLY_MODE_OPTIONS,
  debugCheckboxUpdate,
  getCheckboxChecked,
}) => {
  const isPhotoGame = selectedGame?.type === 'photo'
  const timedCluesCount = getTimedCluesCount(
    selectedGame.taskDuration,
    selectedGame.cluesDuration,
  )
  const clueEarlyAccessOptions = Array.from(
    { length: timedCluesCount },
    (_, index) => index + 1,
  )
  const updateDurationAndClueAccess = (durationPatch) =>
    updateSelectedGame((currentGame) => {
      const nextGame = { ...currentGame, ...durationPatch }
      const nextTimedCluesCount = getTimedCluesCount(
        nextGame.taskDuration,
        nextGame.cluesDuration,
      )
      const currentAccessFrom = normalizeClueEarlyAccessFrom(
        currentGame.clueEarlyAccessFrom,
      )

      return {
        ...durationPatch,
        clueEarlyAccessFrom:
          nextTimedCluesCount > 0
            ? Math.min(currentAccessFrom, nextTimedCluesCount)
            : 1,
      }
    })

  return (
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
            updateDurationAndClueAccess({ taskDuration: nextSeconds })
          }
          labelClassName={fieldLabelClassName}
        />
        <div>
          <CabinetDurationField
            id="game-clues-duration"
            label="Время до подсказки"
            valueSeconds={selectedGame.cluesDuration}
            onChangeSeconds={(nextSeconds) =>
              updateDurationAndClueAccess({ cluesDuration: nextSeconds })
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
            updateSelectedGame({ breakDuration: nextSeconds })
          }
          labelClassName={fieldLabelClassName}
        />
        {isPhotoGame ? (
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

      {!isPhotoGame && (
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
          onChange={(eventOrChecked) => {
            const checked = getCheckboxChecked(eventOrChecked)
            updateSelectedGame({
              allowCaptainForceClue: checked,
              ...(checked
                ? {
                    clueEarlyAccessFrom:
                      timedCluesCount > 0
                        ? Math.min(
                            normalizeClueEarlyAccessFrom(
                              selectedGame.clueEarlyAccessFrom,
                            ),
                            timedCluesCount,
                          )
                        : 1,
                  }
                : {}),
            })
          }}
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
              (checked) => ({
                allowCaptainFailTask: checked,
              }),
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
              (checked) => ({
                allowCaptainFinishBreak: checked,
              }),
            )
          }
          label="Досрочное завершение перерыва"
          labelClassName="text-sm text-slate-600 dark:text-slate-200"
        />
      </div>

      {selectedGame.allowCaptainForceClue ? (
        <div className="grid gap-4 md:grid-cols-2">
          <CabinetSelectField
            id="game-clue-early-access-from"
            label="Досрочно начиная с подсказки"
            value={
              timedCluesCount > 0
                ? normalizeClueEarlyAccessFrom(
                    selectedGame.clueEarlyAccessFrom,
                  )
                : ''
            }
            onChange={(event) =>
              updateSelectedGame({
                clueEarlyAccessFrom: Number(event.target.value),
              })
            }
            disabled={timedCluesCount === 0}
            labelClassName={fieldLabelClassName}
            selectClassName={fieldSelectClassName}
          >
            {timedCluesCount === 0 ? (
              <option value="">Нет доступных подсказок</option>
            ) : (
              clueEarlyAccessOptions.map((clueNumber) => (
                <option key={clueNumber} value={clueNumber}>
                  {clueNumber}
                </option>
              ))
            )}
          </CabinetSelectField>
          <p className="self-end pb-3 text-xs text-slate-500 dark:text-slate-200">
            Более ранние подсказки команда получит только автоматически по
            таймеру.
          </p>
        </div>
      ) : null}
    </ModalSection>
  )
}

GameSettingsSection.propTypes = {
  selectedGame: PropTypes.shape({
    type: PropTypes.string,
    taskDuration: PropTypes.number,
    cluesDuration: PropTypes.number,
    clueEarlyAccessMode: PropTypes.string,
    clueEarlyPenalty: PropTypes.number,
    breakDuration: PropTypes.number,
    taskFailurePenalty: PropTypes.number,
    manyCodesPenalty: PropTypes.array,
    allowCaptainForceClue: PropTypes.bool,
    clueEarlyAccessFrom: PropTypes.number,
    allowCaptainFailTask: PropTypes.bool,
    allowCaptainFinishBreak: PropTypes.bool,
  }).isRequired,
  canEditSelectedGame: PropTypes.bool.isRequired,
  isSaving: PropTypes.bool.isRequired,
  updateSelectedGame: PropTypes.func.isRequired,
  CLUE_EARLY_MODE_OPTIONS: PropTypes.array.isRequired,
  debugCheckboxUpdate: PropTypes.func.isRequired,
  getCheckboxChecked: PropTypes.func.isRequired,
}

export default memo(GameSettingsSection)
