import { memo, useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import dynamic from 'next/dynamic'

import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetDurationField from '@components/cabinet/CabinetDurationField'
import CabinetInputField from '@components/cabinet/CabinetInputField'
import CabinetNumberField from '@components/cabinet/CabinetNumberField'
import CabinetSelectField from '@components/cabinet/CabinetSelectField'
import CabinetTextareaField from '@components/cabinet/CabinetTextareaField'
import ImagesInput from '@components/cabinet/ImagesInput'
import NeonCheckbox from '@components/NeonCheckbox'
import {
  formatDateTimeLocalInLocation,
  parseDateTimeLocalInLocation,
} from '@helpers/dateTimeLocalInLocation'
import {
  buildDefaultPrequel,
  isPrequelReadyForPlayers,
  normalizePrequelConfig,
  normalizePrequelConfigs,
  normalizePrequelStoryEffect,
} from '@helpers/normalizePrequel'
import {
  stripHtmlToPlainText,
  normalizeComparableEditorPlainText,
  normalizeComparableRichText,
  areComparableMediaListsEqual,
  compactSingleLine,
  truncateWithDots,
} from '../sharedHelpers'
import {
  CodePhotoBadgeIcon,
  TaskWarningIcon,
  AccordionChevronIcon,
} from '../sharedIcons'

const TaskRichEditor = dynamic(
  () => import('@components/cabinet/TaskRichEditor'),
  { ssr: false },
)

const fieldLabelClassName =
  'text-sm font-semibold text-slate-700 dark:text-white'
const fieldInputClassName =
  'w-full px-4 py-3 text-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-white rounded-xl focus:border-primary focus:outline-none'
const fieldSelectClassName = fieldInputClassName
const compactLabelClassName =
  'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-200'
const compactInputClassName =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-white'

const getPrequelCodeAccordionKey = (kind, index) => `prequel-${kind}-${index}`

const PrequelItem = ({
  prequel,
  prequelIndex,
  isExpanded,
  onExpandedChange,
  onUpdatePrequel,
  onRemovePrequel,
  selectedGame,
  canEditSelectedGame,
  isSaving,
  canViewCodePhotos,
}) => {
  const [expandedCodeAccordions, setExpandedCodeAccordions] = useState(
    () => new Set(),
  )
  const [, setSelectedCodePhoto] = useState(null)

  const isPhotoGame = selectedGame?.type === 'photo'
  const isStoryGame = selectedGame?.type === 'story'
  const hasPrequelValidationErrors =
    Boolean(prequel.enabled) && !isPrequelReadyForPlayers(prequel)

  useEffect(() => {
    if (!isExpanded) {
      setExpandedCodeAccordions(new Set())
    }
  }, [isExpanded])

  const updatePrequel = (patch) => {
    onUpdatePrequel(prequel.id, patch)
  }

  const updatePrequelCodeEntry = (kind, index, patch) => {
    const fieldName =
      kind === 'main'
        ? 'mainCodes'
        : kind === 'penalty'
          ? 'penaltyCodes'
          : 'bonusCodes'
    updatePrequel((currentPrequel) => ({
      [fieldName]: (currentPrequel[fieldName] || []).map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              ...(typeof patch === 'function' ? patch(item) : patch),
            }
          : item,
      ),
    }))
  }

  const renderPrequelCodeList = ({
    kind,
    title,
    addLabel,
    removeLabel,
    emptyLabel,
  }) => {
    const isPenaltyKind = kind === 'penalty'
    const isMainKind = kind === 'main'
    const fieldName = isMainKind
      ? 'mainCodes'
      : isPenaltyKind
        ? 'penaltyCodes'
        : 'bonusCodes'
    const items = Array.isArray(prequel[fieldName]) ? prequel[fieldName] : []

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className={fieldLabelClassName}>{title}</p>
          <CabinetButton
            onClick={() => {
              const nextIndex = items.length
              const nextAccordionKey = getPrequelCodeAccordionKey(
                kind,
                nextIndex,
              )
              setExpandedCodeAccordions((prev) => {
                const next = new Set(prev)
                next.add(nextAccordionKey)
                return next
              })
              updatePrequel((currentPrequel) => ({
                [fieldName]: [
                  ...(currentPrequel[fieldName] || []),
                  {
                    id: `prequel-${kind}-${Date.now()}`,
                    code: '',
                    value: 0,
                    description: '',
                    image: '',
                    storyEffects: [],
                  },
                ],
              }))
            }}
            variant="secondary"
            size="sm"
          >
            {addLabel}
          </CabinetButton>
        </div>
        {items.length > 0 ? (
          <div className="mt-3 space-y-4">
            {items.map((item, itemIndex) => {
              const accordionKey = getPrequelCodeAccordionKey(kind, itemIndex)
              const isExpanded = expandedCodeAccordions.has(accordionKey)
              return (
                <details
                  key={item.id || `prequel-${kind}-${itemIndex}`}
                  open={isExpanded}
                  onToggle={(event) => {
                    const isOpen = Boolean(event.currentTarget?.open)
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
                  <summary className="w-full max-w-full overflow-hidden text-sm font-medium list-none rounded-xl text-slate-700 marker:content-none dark:text-slate-100">
                    <div
                      className={`absolute left-0 top-0 shrink-0 rounded-br-full border-b border-r px-3 py-0 text-[11px] font-semibold ${
                        isMainKind
                          ? 'border-cyan-300/70 bg-cyan-100/80 text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200'
                          : isPenaltyKind
                          ? 'border-rose-300/70 bg-rose-100/80 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200'
                          : 'border-emerald-300/70 bg-emerald-100/80 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200'
                      }`}
                    >
                      {isMainKind ? 'Основной' : isPenaltyKind ? 'Штраф' : 'Бонус'}
                    </div>
                    <div className="grid w-full max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 py-1">
                      <div className="flex items-center w-full min-w-0 gap-2 mt-2 overflow-hidden">
                        <span className="flex-1 block min-w-0 overflow-hidden">
                          <span className="block w-full font-semibold truncate">
                            {compactSingleLine(item.code) || 'Код не указан'}
                          </span>
                        </span>
                        {truncateWithDots(item.description) ? (
                          <span className="hidden min-w-0 shrink max-w-[240px] truncate text-xs font-normal text-slate-500 dark:text-slate-300 sm:block">
                            {truncateWithDots(item.description)}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.image ? (
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
                      id={`prequel-${prequel.id}-${kind}-code-${item.id || itemIndex}`}
                      label="Код"
                      type="text"
                      value={item.code || ''}
                      onChange={(event) =>
                        updatePrequelCodeEntry(kind, itemIndex, {
                          code: event.target.value,
                        })
                      }
                      containerClassName="space-y-1 md:col-span-2"
                      labelClassName={compactLabelClassName}
                      inputClassName={compactInputClassName}
                    />
                    {isMainKind ? null : isPhotoGame ? (
                      <CabinetNumberField
                        id={`prequel-${prequel.id}-${kind}-value-${item.id || itemIndex}`}
                        label={isPenaltyKind ? 'Штраф' : 'Бонус'}
                        value={item.value ?? 0}
                        onChange={(event) =>
                          updatePrequelCodeEntry(kind, itemIndex, {
                            value: Number(event.target.value) || 0,
                          })
                        }
                        containerClassName="space-y-1 md:col-span-2"
                        labelClassName={compactLabelClassName}
                        inputClassName={compactInputClassName}
                      />
                    ) : (
                      <CabinetDurationField
                        id={`prequel-${prequel.id}-${kind}-value-${item.id || itemIndex}`}
                        label={isPenaltyKind ? 'Штраф' : 'Бонус'}
                        valueSeconds={item.value ?? 0}
                        onChangeSeconds={(nextSeconds) =>
                          updatePrequelCodeEntry(kind, itemIndex, {
                            value: nextSeconds,
                          })
                        }
                        containerClassName="space-y-1 md:col-span-2"
                        labelClassName={compactLabelClassName}
                      />
                    )}
                  </div>
                  <CabinetInputField
                    id={`prequel-${prequel.id}-${kind}-description-${item.id || itemIndex}`}
                    label="Комментарий"
                    type="text"
                    value={item.description || ''}
                    onChange={(event) =>
                      updatePrequelCodeEntry(kind, itemIndex, {
                        description: event.target.value,
                      })
                    }
                    containerClassName="space-y-1"
                    labelClassName={compactLabelClassName}
                    inputClassName={compactInputClassName}
                  />
                  {canViewCodePhotos ? (
                    <div className="mt-2">
                      <ImagesInput
                        label="Фото кода"
                        images={[item.image || ''].filter(Boolean)}
                        onChange={(nextImages) =>
                          updatePrequelCodeEntry(kind, itemIndex, {
                            image:
                              Array.isArray(nextImages) && nextImages.length > 0
                                ? nextImages[0]
                                : '',
                          })
                        }
                        directory={`games/${selectedGame.id || 'draft'}/prequel/${prequel.id}/${kind}-codes/${item.id || itemIndex}`}
                        imageName={`prequel-${kind}-code-${item.id || itemIndex}`}
                        maxImages={1}
                        uploadLabel="Загрузить фото"
                        onPreviewClick={(imageUrl) =>
                          setSelectedCodePhoto({
                            src: imageUrl,
                            alt: `Фото для кода ${compactSingleLine(item.code) || itemIndex + 1}`,
                          })
                        }
                        disabled={!canEditSelectedGame || isSaving}
                        previewShape="square"
                      />
                    </div>
                  ) : null}
                  {isStoryGame && !isMainKind ? (
                    <CabinetTextareaField
                      id={`prequel-${prequel.id}-${kind}-effects-${item.id || itemIndex}`}
                      label="Story-эффекты, JSON-массив"
                      value={JSON.stringify(item.storyEffects || [], null, 2)}
                      onChange={(event) => {
                        try {
                          const parsed = JSON.parse(event.target.value || '[]')
                          updatePrequelCodeEntry(kind, itemIndex, {
                            storyEffects: Array.isArray(parsed)
                              ? parsed.map(normalizePrequelStoryEffect)
                              : [],
                          })
                        } catch {
                          return
                        }
                      }}
                      labelClassName={fieldLabelClassName}
                      textareaClassName={`${fieldInputClassName} font-mono text-xs`}
                    />
                  ) : null}
                  <div className="flex justify-end">
                    <CabinetButton
                      onClick={() =>
                        updatePrequel((currentPrequel) => ({
                          [fieldName]: (currentPrequel[fieldName] || []).filter(
                            (_entry, index) => index !== itemIndex,
                          ),
                        }))
                      }
                      variant="secondary"
                      tone="danger"
                      size="sm"
                      className="inline-flex items-center justify-center"
                    >
                      {removeLabel}
                    </CabinetButton>
                  </div>
                </details>
              )
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-200">
            {emptyLabel}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="overflow-hidden transition bg-white border rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/70">
      <div className="flex items-stretch w-full bg-slate-50 dark:bg-slate-800/70">
        <button
          type="button"
          onClick={
            prequel.enabled
              ? () => onExpandedChange(!isExpanded)
              : undefined
          }
          className={`relative flex flex-1 items-center justify-between gap-3 overflow-hidden px-4 py-3 text-sm font-semibold text-left text-slate-700 transition dark:text-white ${
            prequel.enabled
              ? 'hover:bg-blue-50 dark:hover:bg-sky-500/10'
              : 'cursor-default'
          }`}
        >
          <div className="absolute top-0 left-0 shrink-0 px-3 py-0 text-[11px] font-semibold border-b border-r rounded-br-full border-violet-300/70 bg-violet-100/80 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-200">
            Приквел {prequelIndex + 1}
          </div>
          <div className="min-w-0 pt-2">
            <p>{prequel.title || `Приквел ${prequelIndex + 1}`}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-200">
              Основных кодов: {prequel.mainCodes.length} · Бонусных:{' '}
              {prequel.bonusCodes.length} · Штрафных:{' '}
              {prequel.penaltyCodes.length}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasPrequelValidationErrors ? (
              <TaskWarningIcon title="В приквеле есть незаполненные обязательные поля" />
            ) : null}
            {prequel.enabled ? (
              <AccordionChevronIcon isOpen={isExpanded} />
            ) : null}
          </div>
        </button>
        <div className="flex items-center gap-2 border-l px-3 shrink-0 border-slate-200 dark:border-slate-700">
          <NeonCheckbox
            id={`game-prequel-enabled-${prequel.id}`}
            checked={Boolean(prequel.enabled)}
            onChange={(eventOrChecked) => {
              const checked =
                typeof eventOrChecked === 'boolean'
                  ? eventOrChecked
                  : Boolean(eventOrChecked?.target?.checked)
              onExpandedChange(checked)
              updatePrequel({ enabled: checked })
            }}
            label="Включён"
            labelClassName="text-sm text-slate-600 dark:text-slate-200"
          />
          <button
            type="button"
            onClick={() => onRemovePrequel(prequel.id)}
            disabled={!canEditSelectedGame || isSaving}
            title={`Удалить приквел ${prequelIndex + 1}`}
            aria-label={`Удалить приквел ${prequelIndex + 1}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 bg-transparent text-lg font-semibold leading-none text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
          >
            ×
          </button>
        </div>
      </div>

      {prequel.enabled && isExpanded ? (
        <div className="px-3 py-4 space-y-5 sm:px-4 sm:py-5">
          <CabinetInputField
            id={`game-prequel-title-${prequel.id || 'draft'}`}
            label="Название приквела"
            type="text"
            value={prequel.title || ''}
            onChange={(event) => updatePrequel({ title: event.target.value })}
            disabled={!canEditSelectedGame || isSaving}
            labelClassName={fieldLabelClassName}
            inputClassName={fieldInputClassName}
          />
          <CabinetInputField
            id={`game-prequel-open-at-${prequel.id}`}
            label="Открыть приквел"
            type="datetime-local"
            value={
              prequel.openAt
                ? formatDateTimeLocalInLocation(
                    prequel.openAt,
                    selectedGame.location,
                  )
                : ''
            }
            onChange={(event) =>
              updatePrequel({
                openAt: event.target.value
                  ? parseDateTimeLocalInLocation(
                      event.target.value,
                      selectedGame.location,
                    )
                  : null,
              })
            }
            disabled={!canEditSelectedGame || isSaving}
            labelClassName={fieldLabelClassName}
            inputClassName={fieldInputClassName}
          />

          <p className="-mt-3 text-xs text-slate-500 dark:text-slate-300">
            Обязательная дата, с которой игроки увидят задание приквела.
          </p>

          <div className="space-y-2">
            <p className={fieldLabelClassName}>Описание приквела</p>
            <TaskRichEditor
              value={prequel.descriptionRich || prequel.description || ''}
              directory={`games/${selectedGame.id || 'draft'}/prequel/${prequel.id}/editor`}
              contentMaxHeight="none"
              disabled={!canEditSelectedGame || isSaving}
              placeholder="Введите описание задания приквела."
              onChange={({ html, plainText, media }) => {
                const nextDescription =
                  plainText || stripHtmlToPlainText(html || '')
                const nextDescriptionRich =
                  typeof html === 'string' ? html : ''
                const isSameDescription =
                  normalizeComparableEditorPlainText(nextDescription) ===
                  normalizeComparableEditorPlainText(prequel.description)
                const isSameDescriptionRich =
                  normalizeComparableRichText(
                    nextDescriptionRich,
                    nextDescription,
                  ) ===
                  normalizeComparableRichText(
                    prequel.descriptionRich,
                    prequel.description,
                  )
                const isSameMedia = areComparableMediaListsEqual(
                  media,
                  prequel.descriptionMedia,
                )
                if (isSameDescription && isSameDescriptionRich && isSameMedia) {
                  return
                }
                updatePrequel({
                  descriptionRich: nextDescriptionRich,
                  description: nextDescription,
                  descriptionMedia: Array.isArray(media) ? media : [],
                })
              }}
            />
          </div>

          {renderPrequelCodeList({
            kind: 'main',
            title: 'Основные коды приквела',
            addLabel: 'Добавить основной код',
            removeLabel: 'Удалить код',
            emptyLabel:
              'Основных кодов нет — выполнение определяется режимом бонусных и штрафных кодов либо администратором.',
          })}

          {prequel.mainCodes.length > 0 ? (
            <CabinetNumberField
              id={`game-prequel-required-main-${prequel.id}`}
              label="Основных кодов для выполнения"
              min={1}
              max={prequel.mainCodes.length}
              value={prequel.requiredMainCodesCount ?? ''}
              placeholder="Все"
              onChange={(event) =>
                updatePrequel({
                  requiredMainCodesCount:
                    event.target.value === ''
                      ? null
                      : Math.max(1, Number(event.target.value) || 1),
                })
              }
              labelClassName={fieldLabelClassName}
              inputClassName={fieldInputClassName}
            />
          ) : (
            <CabinetSelectField
              id={`game-prequel-mode-${prequel.id}`}
              label="Режим обработки кодов"
              value={prequel.mode}
              onChange={(event) => updatePrequel({ mode: event.target.value })}
              labelClassName={fieldLabelClassName}
              selectClassName={fieldSelectClassName}
              containerClassName="space-y-2"
            >
              <option value="multi_hit">Выполнить после всех кодов</option>
              <option value="single_hit">
                Выполнить после первого бонусного или штрафного кода
              </option>
            </CabinetSelectField>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {isPhotoGame ? (
              <CabinetNumberField
                id={`game-prequel-completion-bonus-${prequel.id}`}
                label="Бонус за выполнение, баллы"
                value={prequel.completionBonus?.value ?? 0}
                onChange={(event) =>
                  updatePrequel({
                    completionBonus: {
                      ...prequel.completionBonus,
                      value: Number(event.target.value) || 0,
                    },
                  })
                }
                labelClassName={fieldLabelClassName}
                inputClassName={fieldInputClassName}
              />
            ) : (
              <CabinetDurationField
                id={`game-prequel-completion-bonus-${prequel.id}`}
                label="Бонус за выполнение"
                valueSeconds={prequel.completionBonus?.value ?? 0}
                onChangeSeconds={(value) =>
                  updatePrequel({
                    completionBonus: { ...prequel.completionBonus, value },
                  })
                }
                labelClassName={fieldLabelClassName}
              />
            )}
            <CabinetInputField
              id={`game-prequel-completion-description-${prequel.id}`}
              label="Комментарий к бонусу"
              type="text"
              value={prequel.completionBonus?.description || ''}
              onChange={(event) =>
                updatePrequel({
                  completionBonus: {
                    ...prequel.completionBonus,
                    description: event.target.value,
                  },
                })
              }
              labelClassName={fieldLabelClassName}
              inputClassName={fieldInputClassName}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <CabinetNumberField
              id={`game-prequel-wrong-limit-${prequel.id}`}
              label="Лимит неверных кодов"
              min={0}
              value={prequel.wrongAttemptsLimit ?? ''}
              placeholder="Нет ограничений"
              onChange={(event) =>
                updatePrequel({
                  wrongAttemptsLimit:
                    event.target.value === ''
                      ? null
                      : Math.max(0, Number(event.target.value) || 0),
                })
              }
              labelClassName={fieldLabelClassName}
              inputClassName={fieldInputClassName}
            />
            {isPhotoGame ? (
              <CabinetNumberField
                id={`game-prequel-wrong-penalty-${prequel.id}`}
                label="Штраф за каждый пакет неверных кодов, баллы"
                value={prequel.wrongAttemptsPenalty ?? 0}
                onChange={(event) =>
                  updatePrequel({
                    wrongAttemptsPenalty: Number(event.target.value) || 0,
                  })
                }
                labelClassName={fieldLabelClassName}
                inputClassName={fieldInputClassName}
              />
            ) : (
              <CabinetDurationField
                id={`game-prequel-wrong-penalty-${prequel.id}`}
                label="Штраф за каждый пакет неверных кодов"
                valueSeconds={prequel.wrongAttemptsPenalty ?? 0}
                onChangeSeconds={(nextSeconds) =>
                  updatePrequel({
                    wrongAttemptsPenalty: nextSeconds,
                  })
                }
                labelClassName={fieldLabelClassName}
              />
            )}
          </div>

          <p className="px-3 py-2 text-xs border rounded-xl border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            Если лимит включён, каждые N неверных кодов начисляют повторный
            штраф. После старта игры ввод приквела закрывается, но организатор
            всё ещё может редактировать конфиг для последующего пересчёта
            результата.
          </p>

          {renderPrequelCodeList({
            kind: 'bonus',
            title: 'Бонусные коды приквела',
            addLabel: 'Добавить бонус',
            removeLabel: 'Удалить бонус',
            emptyLabel: 'Бонусных кодов пока нет.',
          })}

          {renderPrequelCodeList({
            kind: 'penalty',
            title: 'Штрафные коды приквела',
            addLabel: 'Добавить штраф',
            removeLabel: 'Удалить штраф',
            emptyLabel: 'Штрафных кодов пока нет.',
          })}

        </div>
      ) : null}
    </div>
  )
}

const PrequelSection = ({
  selectedGame,
  canEditSelectedGame,
  isSaving,
  updateSelectedGame,
  canViewCodePhotos,
}) => {
  const [expandedPrequelIds, setExpandedPrequelIds] = useState(
    () => new Set(),
  )
  const prequels = normalizePrequelConfigs(
    Array.isArray(selectedGame?.prequels) && selectedGame.prequels.length > 0
      ? selectedGame.prequels
      : selectedGame?.prequel
        ? [selectedGame.prequel]
        : [],
  )

  useEffect(() => {
    setExpandedPrequelIds(new Set())
  }, [selectedGame?.id])

  const setPrequelExpanded = (prequelId, isExpanded) => {
    setExpandedPrequelIds((current) => {
      const next = new Set(current)
      if (isExpanded) {
        next.add(prequelId)
      } else {
        next.delete(prequelId)
      }
      return next
    })
  }

  const updatePrequel = (prequelId, patch) => {
    const currentPrequel = prequels.find((item) => item.id === prequelId)
    if (!currentPrequel) return
    const nextPatch =
      typeof patch === 'function' ? patch(currentPrequel) : patch
    const nextPrequel = {
      ...currentPrequel,
      ...(nextPatch && typeof nextPatch === 'object' ? nextPatch : {}),
    }
    const nextPrequels = prequels.map((item) =>
      item.id === prequelId ? nextPrequel : item,
    )
    updateSelectedGame({ prequels: nextPrequels, prequel: nextPrequels[0] })
  }

  const addPrequel = () => {
    const id = `prequel-${Date.now()}`
    const nextPrequel = normalizePrequelConfig({
      ...buildDefaultPrequel(),
      id,
      title: `Приквел ${prequels.length + 1}`,
    })
    const nextPrequels = [...prequels, nextPrequel]
    updateSelectedGame({ prequels: nextPrequels, prequel: nextPrequels[0] })
    setPrequelExpanded(id, true)
  }

  const removePrequel = (prequelId) => {
    const nextPrequels = prequels.filter((item) => item.id !== prequelId)
    updateSelectedGame({
      prequels: nextPrequels,
      prequel:
        nextPrequels[0] || normalizePrequelConfig(buildDefaultPrequel()),
    })
    setPrequelExpanded(prequelId, false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
          Приквелы
        </h2>
        <CabinetButton
          onClick={addPrequel}
          variant="secondary"
          size="sm"
          disabled={!canEditSelectedGame || isSaving}
        >
          Добавить приквел
        </CabinetButton>
      </div>

      {prequels.map((prequel, index) => (
        <PrequelItem
          key={`${selectedGame?.id || 'draft'}-${prequel.id}`}
          prequel={prequel}
          prequelIndex={index}
          isExpanded={expandedPrequelIds.has(prequel.id)}
          onExpandedChange={(nextIsExpanded) =>
            setPrequelExpanded(prequel.id, nextIsExpanded)
          }
          onUpdatePrequel={updatePrequel}
          onRemovePrequel={removePrequel}
          selectedGame={selectedGame}
          canEditSelectedGame={canEditSelectedGame}
          isSaving={isSaving}
          canViewCodePhotos={canViewCodePhotos}
        />
      ))}
    </div>
  )
}

PrequelItem.propTypes = {
  prequel: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string,
    enabled: PropTypes.bool,
    mainCodes: PropTypes.arrayOf(PropTypes.object).isRequired,
    bonusCodes: PropTypes.arrayOf(PropTypes.object).isRequired,
    penaltyCodes: PropTypes.arrayOf(PropTypes.object).isRequired,
  }).isRequired,
  prequelIndex: PropTypes.number.isRequired,
  isExpanded: PropTypes.bool.isRequired,
  onExpandedChange: PropTypes.func.isRequired,
  onUpdatePrequel: PropTypes.func.isRequired,
  onRemovePrequel: PropTypes.func.isRequired,
  selectedGame: PropTypes.shape({
    id: PropTypes.string,
    type: PropTypes.string,
    location: PropTypes.string,
  }).isRequired,
  canEditSelectedGame: PropTypes.bool.isRequired,
  isSaving: PropTypes.bool.isRequired,
  canViewCodePhotos: PropTypes.bool,
}

PrequelItem.defaultProps = {
  canViewCodePhotos: false,
}

PrequelSection.propTypes = {
  selectedGame: PropTypes.shape({
    id: PropTypes.string,
    type: PropTypes.string,
    location: PropTypes.string,
    prequel: PropTypes.object,
    prequels: PropTypes.arrayOf(PropTypes.object),
  }),
  canEditSelectedGame: PropTypes.bool.isRequired,
  isSaving: PropTypes.bool.isRequired,
  updateSelectedGame: PropTypes.func.isRequired,
  canViewCodePhotos: PropTypes.bool,
}

PrequelSection.defaultProps = {
  selectedGame: null,
  canViewCodePhotos: false,
}

export default memo(PrequelSection)
