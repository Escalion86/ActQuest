'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import ImagesInput from '@components/cabinet/ImagesInput'
import StoryAudioEditor from '@components/cabinet/story-editor/StoryAudioEditor'
import {
  getStoryCoverImage,
  mergeStoryEditorMedia,
  setStoryCoverImage,
} from '@helpers/storyCoverMedia'

const TaskRichEditor = dynamic(
  () => import('@components/cabinet/TaskRichEditor'),
  { ssr: false },
)

const fieldClassName =
  'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60'

const normalizeArray = (value) => (Array.isArray(value) ? value : [])

const endingTypeLabels = {
  success: 'Успех',
  failed: 'Провал',
  neutral: 'Нейтральная',
  secret: 'Секретная',
}

const ReferenceChecklist = ({ label, options, value, onChange, disabled }) => {
  const selectedIds = new Set(normalizeArray(value))

  return (
    <fieldset className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <legend className="px-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
        {label}
      </legend>
      <div className="mt-1 grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
        {options.length > 0 ? (
          options.map((option) => (
            <label key={option.id} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                className="mt-0.5"
                disabled={disabled}
                checked={selectedIds.has(option.id)}
                onChange={(event) => {
                  const nextIds = new Set(selectedIds)
                  if (event.target.checked) nextIds.add(option.id)
                  else nextIds.delete(option.id)
                  onChange(Array.from(nextIds))
                }}
              />
              <span>{option.title || 'Без названия'}</span>
            </label>
          ))
        ) : (
          <p className="text-xs text-slate-400">Нет доступных сущностей</p>
        )}
      </div>
    </fieldset>
  )
}

ReferenceChecklist.propTypes = {
  label: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(PropTypes.object).isRequired,
  value: PropTypes.arrayOf(PropTypes.string),
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
}

ReferenceChecklist.defaultProps = { value: [], disabled: false }

const StoryEndingsEditor = ({
  isOpen,
  onClose,
  game,
  gameId,
  selectedEndingId,
  onSelectEnding,
  onAddEnding,
  onRemoveEnding,
  onUpdateEnding,
  updateGame,
  disabled,
}) => {
  const endings = normalizeArray(game?.storyEndings)
  const nodes = normalizeArray(game?.storyNodes)
  const items = normalizeArray(game?.storyItems)
  const interactions = normalizeArray(game?.storyInteractions)
  const selectedEnding = endings.find((ending) => ending.id === selectedEndingId)
  const selectedEndingCoverImage = getStoryCoverImage(selectedEnding?.media)

  const references = useMemo(() => {
    if (!selectedEndingId) return []
    const result = []

    nodes.forEach((node) => {
      normalizeArray(node.codes).forEach((code) => {
        if (code.endingId === selectedEndingId) {
          result.push(`Код в локации «${node.title || 'без названия'}»`)
        }
      })
      normalizeArray(node.actions).forEach((action) => {
        if (action.endingId === selectedEndingId) {
          result.push(`Действие «${action.label || 'без названия'}»`)
        }
      })
    })
    interactions.forEach((interaction) => {
      if (interaction.effects?.endingId === selectedEndingId) {
        result.push(`Взаимодействие «${interaction.label || 'без названия'}»`)
      }
    })

    const accusation = game?.storyAccusation || {}
    if (accusation.fallbackEndingId === selectedEndingId) {
      result.push('Запасная концовка финального обвинения')
    }
    if (accusation.timeoutEndingId === selectedEndingId) {
      result.push('Концовка по истечении времени')
    }
    if (
      normalizeArray(accusation.outcomes).some(
        (outcome) => outcome.endingId === selectedEndingId,
      )
    ) {
      result.push('Один или несколько исходов финального обвинения')
    }

    return result
  }, [game?.storyAccusation, interactions, nodes, selectedEndingId])

  if (!isOpen) return null

  return (
    <Modal
      isOpen
      title={`Концовки · ${endings.length}`}
      onClose={onClose}
      dialogClassName="md:max-w-6xl"
      bodyClassName="bg-slate-50/80 dark:bg-slate-950/40"
      footer={(
        <>
          <p className="mr-auto text-xs text-slate-500 dark:text-slate-400">
            Изменения сохранятся после нажатия общей кнопки «Сохранить сценарий».
          </p>
          <button type="button" onClick={onClose} className="aq-modal-btn aq-modal-btn-primary">
            Готово
          </button>
        </>
      )}
    >
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            disabled={disabled}
            onClick={onAddEnding}
            className="w-full rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Добавить концовку
          </button>
          <div className="mt-3 max-h-[62vh] space-y-2 overflow-y-auto pr-1">
            {endings.map((ending) => (
              <button
                key={ending.id}
                type="button"
                onClick={() => onSelectEnding(ending.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  ending.id === selectedEndingId
                    ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200 dark:bg-violet-500/10 dark:ring-violet-500/20'
                    : 'border-slate-200 bg-white hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900'
                }`}
              >
                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {ending.title || 'Концовка без названия'}
                </span>
                <span className="mt-1 block text-xs text-slate-400">
                  {endingTypeLabels[ending.type] || 'Тип не указан'}
                  {ending.manualOnly ? ' · только организатор' : ''}
                </span>
              </button>
            ))}
            {endings.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700">
                Концовок пока нет.
              </p>
            ) : null}
          </div>
        </aside>

        {selectedEnding ? (
          <section className="rounded-2xl border border-violet-200 bg-white p-4 dark:border-violet-500/30 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  {selectedEnding.title || 'Концовка без названия'}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Настройте текст финала и условия автоматического завершения.
                </p>
              </div>
              <button
                type="button"
                disabled={disabled || references.length > 0}
                onClick={() => onRemoveEnding(selectedEnding.id)}
                className="rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/40 dark:text-rose-200"
              >
                Удалить концовку
              </button>
            </div>

            {references.length > 0 ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                Концовка используется в логике сценария: {references.slice(0, 5).join(', ')}
                {references.length > 5 ? ` и ещё ${references.length - 5}` : ''}.
              </p>
            ) : null}

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
                Название
                <input
                  value={selectedEnding.title || ''}
                  disabled={disabled}
                  onChange={(event) => onUpdateEnding(selectedEnding.id, (ending) => ({ ...ending, title: event.target.value }))}
                  className={fieldClassName}
                />
              </label>
              <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
                Тип финала
                <select
                  value={selectedEnding.type || 'success'}
                  disabled={disabled}
                  onChange={(event) => onUpdateEnding(selectedEnding.id, (ending) => ({ ...ending, type: event.target.value }))}
                  className={fieldClassName}
                >
                  {Object.entries(endingTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={Boolean(selectedEnding.manualOnly)}
                disabled={disabled || (!selectedEnding.manualOnly && references.length > 0)}
                onChange={(event) => {
                  const manualOnly = event.target.checked
                  updateGame((previous) => ({
                    ...previous,
                    storyEndings: normalizeArray(previous.storyEndings).map((ending) =>
                      ending.id === selectedEnding.id ? { ...ending, manualOnly } : ending,
                    ),
                    storyNodes: manualOnly
                      ? normalizeArray(previous.storyNodes).map((node) => ({
                          ...node,
                          codes: normalizeArray(node.codes).map((code) => ({ ...code, endingId: code.endingId === selectedEnding.id ? null : code.endingId })),
                          actions: normalizeArray(node.actions).map((action) => ({ ...action, endingId: action.endingId === selectedEnding.id ? null : action.endingId })),
                        }))
                      : previous.storyNodes,
                  }))
                }}
              />
              Завершается только вручную организатором
            </label>

            <div className="mt-4">
              <ImagesInput
                label="Изображение концовки"
                images={selectedEndingCoverImage ? [selectedEndingCoverImage] : []}
                onChange={(nextImages) => onUpdateEnding(selectedEnding.id, (ending) => ({
                  ...ending,
                  media: setStoryCoverImage(ending.media, nextImages?.[0] ?? ''),
                }))}
                directory={`games/${gameId || 'draft'}/story/endings/${selectedEnding.id}/cover`}
                imageName="ending-cover"
                disabled={disabled}
                maxImages={1}
                previewShape="square"
                uploadLabel="Загрузить обложку"
              />
            </div>

            <div className="mt-4">
              <p className="mb-1 text-sm text-slate-600 dark:text-slate-300">Литературное описание финала и медиа</p>
              <TaskRichEditor
                value={selectedEnding.descriptionRich || ''}
                directory={`games/${gameId || 'draft'}/story/endings/${selectedEnding.id}/description/editor`}
                disabled={disabled}
                contentMaxHeight="420px"
                placeholder="Опишите итог истории, который увидят игроки."
                onChange={({ html, media }) => onUpdateEnding(selectedEnding.id, (ending) => ({
                  ...ending,
                  descriptionRich: typeof html === 'string' ? html : '',
                  media: mergeStoryEditorMedia(ending.media, media),
                }))}
              />
            </div>

            <div className="mt-4">
              <StoryAudioEditor
                media={selectedEnding.media}
                onChange={(media) => onUpdateEnding(selectedEnding.id, (ending) => ({
                  ...ending,
                  media,
                }))}
                directory={`games/${gameId || 'draft'}/story/endings/${selectedEnding.id}/audio`}
                disabled={disabled}
                label="Аудиодорожки концовки"
              />
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <label className="grid content-start gap-1 text-sm text-slate-600 dark:text-slate-300">
                Минимум баллов
                <input
                  type="number"
                  value={selectedEnding.conditions?.minScore ?? ''}
                  disabled={disabled || selectedEnding.manualOnly}
                  onChange={(event) => onUpdateEnding(selectedEnding.id, (ending) => ({
                    ...ending,
                    conditions: {
                      ...ending.conditions,
                      minScore: event.target.value === '' ? null : Number(event.target.value) || 0,
                    },
                  }))}
                  placeholder="Без ограничения"
                  className={fieldClassName}
                />
              </label>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {selectedEnding.manualOnly
                  ? 'Условия ниже не запускают ручную концовку автоматически.'
                  : 'Автоматическая концовка срабатывает, когда выполнены все выбранные условия.'}
              </div>
              <ReferenceChecklist
                label="Требует предметы"
                options={items}
                value={selectedEnding.conditions?.requiredItemIds}
                disabled={disabled || selectedEnding.manualOnly}
                onChange={(requiredItemIds) => onUpdateEnding(selectedEnding.id, (ending) => ({
                  ...ending,
                  conditions: { ...ending.conditions, requiredItemIds },
                }))}
              />
              <ReferenceChecklist
                label="Требует завершённые локации"
                options={nodes}
                value={selectedEnding.conditions?.requiredCompletedNodeIds}
                disabled={disabled || selectedEnding.manualOnly}
                onChange={(requiredCompletedNodeIds) => onUpdateEnding(selectedEnding.id, (ending) => ({
                  ...ending,
                  conditions: { ...ending.conditions, requiredCompletedNodeIds },
                }))}
              />
            </div>
          </section>
        ) : (
          <section className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
            Добавьте концовку или выберите её в списке.
          </section>
        )}
      </div>
    </Modal>
  )
}

StoryEndingsEditor.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  game: PropTypes.object.isRequired,
  gameId: PropTypes.string,
  selectedEndingId: PropTypes.string,
  onSelectEnding: PropTypes.func.isRequired,
  onAddEnding: PropTypes.func.isRequired,
  onRemoveEnding: PropTypes.func.isRequired,
  onUpdateEnding: PropTypes.func.isRequired,
  updateGame: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
}

StoryEndingsEditor.defaultProps = {
  gameId: '',
  selectedEndingId: '',
  disabled: false,
}

export default StoryEndingsEditor
