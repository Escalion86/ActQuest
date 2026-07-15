'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import ImagesInput from '@components/cabinet/ImagesInput'

const TaskRichEditor = dynamic(
  () => import('@components/cabinet/TaskRichEditor'),
  { ssr: false },
)

const fieldClassName =
  'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60'

const normalizeArray = (value) => (Array.isArray(value) ? value : [])
const createEntityId = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const getDefaultPosition = (index) => ({
  x: 80 + (index % 4) * 240,
  y: 80 + Math.floor(index / 4) * 160,
})

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
              <span>{option.title || option.label || 'Без названия'}</span>
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

ReferenceChecklist.defaultProps = {
  value: [],
  disabled: false,
}

const EntitySidebar = ({ entries, selectedId, onSelect, onAdd, addLabel, disabled, emptyLabel }) => (
  <aside className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
    <button
      type="button"
      disabled={disabled}
      onClick={onAdd}
      className="w-full rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {addLabel}
    </button>
    <div className="mt-3 max-h-[62vh] space-y-2 overflow-y-auto pr-1">
      {entries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => onSelect(entry.id)}
          className={`w-full rounded-xl border p-3 text-left transition ${
            entry.id === selectedId
              ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200 dark:bg-violet-500/10 dark:ring-violet-500/20'
              : 'border-slate-200 bg-white hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900'
          }`}
        >
          <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {entry.title || entry.label || 'Без названия'}
          </span>
        </button>
      ))}
      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700">
          {emptyLabel}
        </p>
      ) : null}
    </div>
  </aside>
)

EntitySidebar.propTypes = {
  entries: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedId: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  onAdd: PropTypes.func.isRequired,
  addLabel: PropTypes.string.isRequired,
  disabled: PropTypes.bool,
  emptyLabel: PropTypes.string.isRequired,
}

EntitySidebar.defaultProps = {
  selectedId: '',
  disabled: false,
}

const EditorFooter = ({ onClose }) => (
  <>
    <p className="mr-auto text-xs text-slate-500 dark:text-slate-400">
      Изменения сохранятся после нажатия общей кнопки «Сохранить сценарий».
    </p>
    <button type="button" onClick={onClose} className="aq-modal-btn aq-modal-btn-primary">
      Готово
    </button>
  </>
)

EditorFooter.propTypes = {
  onClose: PropTypes.func.isRequired,
}

const TopicsEditorModal = ({ isOpen, onClose, game, gameId, updateGame, disabled }) => {
  const topics = normalizeArray(game?.storyTopics)
  const interactions = normalizeArray(game?.storyInteractions)
  const [selectedId, setSelectedId] = useState(topics[0]?.id || '')
  const selectedTopic = topics.find((topic) => topic.id === selectedId)

  useEffect(() => {
    if (!topics.some((topic) => topic.id === selectedId)) {
      setSelectedId(topics[0]?.id || '')
    }
  }, [selectedId, topics])

  const references = useMemo(() => {
    if (!selectedId) return []
    const result = interactions.flatMap((interaction) => {
      const used =
        interaction.topicId === selectedId ||
        normalizeArray(interaction.conditions?.requiredTopicIds).includes(selectedId) ||
        normalizeArray(interaction.effects?.unlocksTopicIds).includes(selectedId)
      return used ? [interaction.label || 'Взаимодействие без названия'] : []
    })
    if (game?.storyAccusation?.unlockTopicId === selectedId) {
      result.push('Финальное обвинение')
    }
    return result
  }, [game?.storyAccusation?.unlockTopicId, interactions, selectedId])

  const patchTopic = useCallback((topicId, patch) => {
    updateGame((previous) => ({
      ...previous,
      storyTopics: normalizeArray(previous.storyTopics).map((topic) =>
        topic.id === topicId ? { ...topic, ...patch } : topic,
      ),
    }))
  }, [updateGame])

  const addTopic = () => {
    const id = createEntityId('topic')
    const nextTopic = {
      id,
      title: `Новая тема ${topics.length + 1}`,
      descriptionRich: '',
      icon: '',
      startVisible: false,
      hiddenUntilUnlocked: true,
      position: getDefaultPosition(topics.length),
    }
    updateGame((previous) => ({
      ...previous,
      storyTopics: [...normalizeArray(previous.storyTopics), nextTopic],
    }))
    setSelectedId(id)
  }

  const removeTopic = () => {
    if (!selectedTopic || references.length > 0) return
    if (!window.confirm(`Удалить тему «${selectedTopic.title || 'без названия'}»?`)) return
    updateGame((previous) => ({
      ...previous,
      storyTopics: normalizeArray(previous.storyTopics).filter((topic) => topic.id !== selectedTopic.id),
    }))
  }

  if (!isOpen) return null

  return (
    <Modal
      isOpen
      title={`Темы разговора · ${topics.length}`}
      onClose={onClose}
      dialogClassName="md:max-w-6xl"
      bodyClassName="bg-slate-50/80 dark:bg-slate-950/40"
      footer={<EditorFooter onClose={onClose} />}
    >
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <EntitySidebar entries={topics} selectedId={selectedId} onSelect={setSelectedId} onAdd={addTopic} addLabel="Добавить тему" disabled={disabled} emptyLabel="Тем пока нет." />
        {selectedTopic ? (
          <section className="rounded-2xl border border-violet-200 bg-white p-4 dark:border-violet-500/30 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{selectedTopic.title || 'Тема без названия'}</h3>
              </div>
              <button type="button" disabled={disabled || references.length > 0} onClick={removeTopic} className="rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/40 dark:text-rose-200">
                Удалить тему
              </button>
            </div>
            {references.length > 0 ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                Тема используется в логике сценария: {references.slice(0, 5).join(', ')}{references.length > 5 ? ` и ещё ${references.length - 5}` : ''}.
              </p>
            ) : null}
            <label className="mt-4 grid gap-1 text-sm text-slate-600 dark:text-slate-300">
              Название темы
              <input value={selectedTopic.title || ''} disabled={disabled} onChange={(event) => patchTopic(selectedTopic.id, { title: event.target.value })} className={fieldClassName} />
            </label>
            <div className="mt-4">
              <ImagesInput label="Иконка темы" images={selectedTopic.icon ? [selectedTopic.icon] : []} onChange={(images) => patchTopic(selectedTopic.id, { icon: images?.[0] ?? '' })} directory={`games/${gameId || 'draft'}/story/topics/${selectedTopic.id}`} imageName="icon" disabled={disabled} maxImages={1} previewShape="square" uploadLabel="Загрузить иконку" />
            </div>
            <div className="mt-4">
              <p className="mb-1 text-sm text-slate-600 dark:text-slate-300">Описание темы</p>
              <TaskRichEditor value={selectedTopic.descriptionRich || ''} directory={`games/${gameId || 'draft'}/story/topics/${selectedTopic.id}/description/editor`} disabled={disabled} contentMaxHeight="360px" placeholder="Что означает тема и когда её стоит обсуждать." onChange={({ html }) => patchTopic(selectedTopic.id, { descriptionRich: typeof html === 'string' ? html : '' })} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={Boolean(selectedTopic.startVisible)} disabled={disabled} onChange={(event) => patchTopic(selectedTopic.id, { startVisible: event.target.checked })} />Видна игрокам с начала</label>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={selectedTopic.hiddenUntilUnlocked !== false} disabled={disabled} onChange={(event) => patchTopic(selectedTopic.id, { hiddenUntilUnlocked: event.target.checked })} />Скрывать до открытия</label>
            </div>
          </section>
        ) : <div className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">Добавьте тему или выберите её в списке.</div>}
      </div>
    </Modal>
  )
}

TopicsEditorModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  game: PropTypes.object.isRequired,
  gameId: PropTypes.string,
  updateGame: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
}

TopicsEditorModal.defaultProps = { gameId: '', disabled: false }

const EvidenceEditorModal = ({ isOpen, onClose, game, gameId, updateGame, disabled }) => {
  const evidence = normalizeArray(game?.storyEvidence)
  const interactions = normalizeArray(game?.storyInteractions)
  const endings = normalizeArray(game?.storyEndings)
  const [selectedId, setSelectedId] = useState(evidence[0]?.id || '')
  const selectedEvidence = evidence.find((entry) => entry.id === selectedId)

  useEffect(() => {
    if (!evidence.some((entry) => entry.id === selectedId)) setSelectedId(evidence[0]?.id || '')
  }, [evidence, selectedId])

  const references = useMemo(() => {
    if (!selectedId) return []
    const result = interactions.flatMap((interaction) => {
      const used =
        normalizeArray(interaction.conditions?.requiredEvidenceIds).includes(selectedId) ||
        normalizeArray(interaction.effects?.grantsEvidenceIds).includes(selectedId)
      return used ? [interaction.label || 'Взаимодействие без названия'] : []
    })
    const accusation = game?.storyAccusation || {}
    if (normalizeArray(accusation.availability?.requiredEvidenceIds).includes(selectedId)) result.push('Доступность обвинения')
    normalizeArray(accusation.outcomes).forEach((outcome) => {
      if (normalizeArray(outcome.conditions?.requiredEvidenceIds).includes(selectedId)) {
        const endingTitle = endings.find((ending) => ending.id === outcome.endingId)?.title
        result.push(`Исход «${endingTitle || 'концовка без названия'}»`)
      }
    })
    return result
  }, [endings, game?.storyAccusation, interactions, selectedId])

  const patchEvidence = useCallback((evidenceId, patch) => {
    updateGame((previous) => ({
      ...previous,
      storyEvidence: normalizeArray(previous.storyEvidence).map((entry) =>
        entry.id === evidenceId ? { ...entry, ...patch } : entry,
      ),
    }))
  }, [updateGame])

  const addEvidence = () => {
    const id = createEntityId('evidence')
    const nextEvidence = { id, title: `Новое доказательство ${evidence.length + 1}`, descriptionRich: '', media: [], tags: [], weight: 0, isKey: false, hiddenUntilDiscovered: true }
    updateGame((previous) => ({ ...previous, storyEvidence: [...normalizeArray(previous.storyEvidence), nextEvidence] }))
    setSelectedId(id)
  }

  const removeEvidence = () => {
    if (!selectedEvidence || references.length > 0) return
    if (!window.confirm(`Удалить доказательство «${selectedEvidence.title || 'без названия'}»?`)) return
    updateGame((previous) => ({ ...previous, storyEvidence: normalizeArray(previous.storyEvidence).filter((entry) => entry.id !== selectedEvidence.id) }))
  }

  if (!isOpen) return null

  return (
    <Modal isOpen title={`Доказательства · ${evidence.length}`} onClose={onClose} dialogClassName="md:max-w-6xl" bodyClassName="bg-slate-50/80 dark:bg-slate-950/40" footer={<EditorFooter onClose={onClose} />}>
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <EntitySidebar entries={evidence} selectedId={selectedId} onSelect={setSelectedId} onAdd={addEvidence} addLabel="Добавить доказательство" disabled={disabled} emptyLabel="Доказательств пока нет." />
        {selectedEvidence ? (
          <section className="rounded-2xl border border-blue-200 bg-white p-4 dark:border-blue-500/30 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="font-semibold text-slate-900 dark:text-slate-100">{selectedEvidence.title || 'Доказательство без названия'}</h3></div>
              <button type="button" disabled={disabled || references.length > 0} onClick={removeEvidence} className="rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/40 dark:text-rose-200">Удалить доказательство</button>
            </div>
            {references.length > 0 ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">Доказательство используется в логике сценария: {references.slice(0, 5).join(', ')}{references.length > 5 ? ` и ещё ${references.length - 5}` : ''}.</p> : null}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300 md:col-span-2">Название<input value={selectedEvidence.title || ''} disabled={disabled} onChange={(event) => patchEvidence(selectedEvidence.id, { title: event.target.value })} className={fieldClassName} /></label>
              <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">Вес доказательства<input type="number" value={selectedEvidence.weight ?? 0} disabled={disabled} onChange={(event) => patchEvidence(selectedEvidence.id, { weight: Number(event.target.value) || 0 })} className={fieldClassName} /></label>
              <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">Категории через запятую<input value={normalizeArray(selectedEvidence.tags).join(', ')} disabled={disabled} onChange={(event) => patchEvidence(selectedEvidence.id, { tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} className={fieldClassName} placeholder="время, мотив, орудие" /></label>
            </div>
            <div className="mt-4"><p className="mb-1 text-sm text-slate-600 dark:text-slate-300">Описание и медиа</p><TaskRichEditor value={selectedEvidence.descriptionRich || ''} directory={`games/${gameId || 'draft'}/story/evidence/${selectedEvidence.id}/description/editor`} disabled={disabled} contentMaxHeight="380px" placeholder="Опишите улику, её происхождение и значение для дела." onChange={({ html, media }) => patchEvidence(selectedEvidence.id, { descriptionRich: typeof html === 'string' ? html : '', media: Array.isArray(media) ? media : [] })} /></div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={Boolean(selectedEvidence.isKey)} disabled={disabled} onChange={(event) => patchEvidence(selectedEvidence.id, { isKey: event.target.checked })} />Ключевое доказательство</label>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={selectedEvidence.hiddenUntilDiscovered !== false} disabled={disabled} onChange={(event) => patchEvidence(selectedEvidence.id, { hiddenUntilDiscovered: event.target.checked })} />Скрывать до обнаружения</label>
            </div>
          </section>
        ) : <div className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">Добавьте доказательство или выберите его в списке.</div>}
      </div>
    </Modal>
  )
}

EvidenceEditorModal.propTypes = TopicsEditorModal.propTypes
EvidenceEditorModal.defaultProps = TopicsEditorModal.defaultProps

const emptyOutcomeConditions = {
  culprit: 'any',
  motive: 'any',
  minSelectedEvidence: 0,
  minKeyEvidence: 0,
  requiredEvidenceIds: [],
  requiredEvidenceTags: [],
  maxElapsedMinutes: null,
  maxUsedClues: null,
}

const AccusationEditorModal = ({ isOpen, onClose, game, updateGame, disabled }) => {
  const accusation = game?.storyAccusation && typeof game.storyAccusation === 'object' ? game.storyAccusation : {}
  const nodes = normalizeArray(game?.storyNodes)
  const topics = normalizeArray(game?.storyTopics)
  const characters = normalizeArray(game?.storyCharacters)
  const interactions = normalizeArray(game?.storyInteractions)
  const evidence = normalizeArray(game?.storyEvidence)
  const endings = normalizeArray(game?.storyEndings)
  const motives = normalizeArray(accusation.motives)
  const outcomes = normalizeArray(accusation.outcomes)
  const culpritCandidates = characters.filter((character) =>
    normalizeArray(accusation.culpritCharacterIds).includes(character.id),
  )
  const [selectedOutcomeId, setSelectedOutcomeId] = useState(outcomes[0]?.id || '')
  const selectedOutcome = outcomes.find((outcome) => outcome.id === selectedOutcomeId)

  useEffect(() => {
    if (!outcomes.some((outcome) => outcome.id === selectedOutcomeId)) setSelectedOutcomeId(outcomes[0]?.id || '')
  }, [outcomes, selectedOutcomeId])

  const patchAccusation = useCallback((patch) => {
    updateGame((previous) => ({ ...previous, storyAccusation: { ...(previous.storyAccusation || {}), ...patch } }))
  }, [updateGame])
  const patchAvailability = (patch) => patchAccusation({ availability: { ...(accusation.availability || {}), ...patch } })
  const patchOutcome = (outcomeId, patch) => patchAccusation({ outcomes: outcomes.map((outcome) => outcome.id === outcomeId ? { ...outcome, ...patch } : outcome) })
  const patchOutcomeConditions = (outcomeId, patch) => {
    const outcome = outcomes.find((entry) => entry.id === outcomeId)
    if (!outcome) return
    patchOutcome(outcomeId, { conditions: { ...emptyOutcomeConditions, ...(outcome.conditions || {}), ...patch } })
  }
  const addMotive = () => patchAccusation({ motives: [...motives, { id: createEntityId('motive'), title: `Новый мотив ${motives.length + 1}` }] })
  const removeMotive = (motiveId) => patchAccusation({ motives: motives.filter((motive) => motive.id !== motiveId), correctMotiveId: accusation.correctMotiveId === motiveId ? null : accusation.correctMotiveId })
  const addOutcome = () => {
    const id = createEntityId('outcome')
    patchAccusation({ outcomes: [...outcomes, { id, priority: 0, endingId: endings[0]?.id || null, conditions: { ...emptyOutcomeConditions } }] })
    setSelectedOutcomeId(id)
  }
  const removeOutcome = (outcomeId) => patchAccusation({ outcomes: outcomes.filter((outcome) => outcome.id !== outcomeId) })

  if (!isOpen) return null

  return (
    <Modal isOpen title="Финальное обвинение и исходы" onClose={onClose} dialogClassName="md:max-w-7xl" bodyClassName="bg-slate-50/80 dark:bg-slate-950/40" footer={<EditorFooter onClose={onClose} />}>
      <div className="space-y-4">
        <section className="rounded-2xl border border-rose-200 bg-white p-4 dark:border-rose-500/30 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="font-semibold text-slate-900 dark:text-slate-100">Настройки обвинения</h3><p className="mt-1 text-xs text-slate-500">Кто, где и после каких находок может предъявить финальную версию.</p></div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><input type="checkbox" checked={Boolean(accusation.enabled)} disabled={disabled} onChange={(event) => patchAccusation({ enabled: event.target.checked })} />Обвинение включено</label>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">Локация обвинения<select value={accusation.requiredNodeId || ''} disabled={disabled} onChange={(event) => patchAccusation({ requiredNodeId: event.target.value || null })} className={fieldClassName}><option value="">Любая локация</option>{nodes.map((node) => <option key={node.id} value={node.id}>{node.title || 'Локация без названия'}</option>)}</select></label>
            <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">Тема, открывающая обвинение<select value={accusation.unlockTopicId || ''} disabled={disabled} onChange={(event) => patchAccusation({ unlockTopicId: event.target.value || null })} className={fieldClassName}><option value="">Без специальной темы</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title || 'Тема без названия'}</option>)}</select></label>
            <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">Минимум ключевых улик<input type="number" min="0" value={accusation.availability?.minKeyEvidence ?? 0} disabled={disabled} onChange={(event) => patchAvailability({ minKeyEvidence: Math.max(0, Number(event.target.value) || 0) })} className={fieldClassName} /></label>
            <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">Минимум выбранных улик<input type="number" min="0" value={accusation.minSelectableEvidence ?? 0} disabled={disabled} onChange={(event) => { const value = Math.max(0, Number(event.target.value) || 0); patchAccusation({ minSelectableEvidence: value, maxSelectableEvidence: Math.max(value, Number(accusation.maxSelectableEvidence) || 0) }) }} className={fieldClassName} /></label>
            <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">Максимум выбранных улик<input type="number" min="0" value={accusation.maxSelectableEvidence ?? 5} disabled={disabled} onChange={(event) => { const value = Math.max(0, Number(event.target.value) || 0); patchAccusation({ maxSelectableEvidence: value, minSelectableEvidence: Math.min(value, Number(accusation.minSelectableEvidence) || 0) }) }} className={fieldClassName} /></label>
            <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">Запасная концовка<select value={accusation.fallbackEndingId || ''} disabled={disabled} onChange={(event) => patchAccusation({ fallbackEndingId: event.target.value || null })} className={fieldClassName}><option value="">Не задана</option>{endings.map((ending) => <option key={ending.id} value={ending.id}>{ending.title || 'Концовка без названия'}</option>)}</select></label>
            <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">Концовка по дедлайну<select value={accusation.timeoutEndingId || ''} disabled={disabled} onChange={(event) => patchAccusation({ timeoutEndingId: event.target.value || null })} className={fieldClassName}><option value="">Не задана</option>{endings.map((ending) => <option key={ending.id} value={ending.id}>{ending.title || 'Концовка без названия'}</option>)}</select></label>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <ReferenceChecklist label="Обязательные доказательства для открытия обвинения" options={evidence} value={accusation.availability?.requiredEvidenceIds} disabled={disabled} onChange={(value) => patchAvailability({ requiredEvidenceIds: value })} />
            <ReferenceChecklist label="Обязательные взаимодействия для открытия обвинения" options={interactions} value={accusation.availability?.requiredInteractionIds} disabled={disabled} onChange={(value) => patchAvailability({ requiredInteractionIds: value })} />
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 xl:grid-cols-2">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Подозреваемые</h3>
            <div className="mt-3"><ReferenceChecklist label="Доступны для выбора" options={characters} value={accusation.culpritCharacterIds} disabled={disabled} onChange={(value) => patchAccusation({ culpritCharacterIds: value, correctCulpritId: value.includes(accusation.correctCulpritId) ? accusation.correctCulpritId : null })} /></div>
            <label className="mt-3 grid gap-1 text-sm text-slate-600 dark:text-slate-300">Правильный виновник<select value={accusation.correctCulpritId || ''} disabled={disabled} onChange={(event) => patchAccusation({ correctCulpritId: event.target.value || null })} className={fieldClassName}><option value="">Не задан</option>{culpritCandidates.map((character) => <option key={character.id} value={character.id}>{character.title || 'Персонаж без имени'}</option>)}</select></label>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-slate-900 dark:text-slate-100">Мотивы</h3><button type="button" disabled={disabled} onClick={addMotive} className="rounded-xl border border-violet-300 px-3 py-2 text-sm font-semibold text-violet-700 disabled:opacity-50 dark:border-violet-500/40 dark:text-violet-200">Добавить мотив</button></div>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {motives.map((motive) => <div key={motive.id} className="flex gap-2 rounded-xl border border-slate-200 p-2 dark:border-slate-700"><input value={motive.title || ''} disabled={disabled} onChange={(event) => patchAccusation({ motives: motives.map((entry) => entry.id === motive.id ? { ...entry, title: event.target.value } : entry) })} className={`min-w-0 flex-1 ${fieldClassName}`} /><button type="button" disabled={disabled} onClick={() => removeMotive(motive.id)} className="rounded-xl border border-rose-300 px-3 text-sm font-semibold text-rose-600 disabled:opacity-50 dark:border-rose-500/40 dark:text-rose-200">Удалить</button></div>)}
            </div>
            <label className="mt-3 grid gap-1 text-sm text-slate-600 dark:text-slate-300">Правильный мотив<select value={accusation.correctMotiveId || ''} disabled={disabled} onChange={(event) => patchAccusation({ correctMotiveId: event.target.value || null })} className={fieldClassName}><option value="">Не задан</option>{motives.map((motive) => <option key={motive.id} value={motive.id}>{motive.title || 'Мотив без названия'}</option>)}</select></label>
          </div>
        </section>

        <section className="rounded-2xl border border-violet-200 bg-white p-4 dark:border-violet-500/30 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-900 dark:text-slate-100">Исходы обвинения</h3><p className="mt-1 text-xs text-slate-500">Проверяются по приоритету: первым срабатывает подходящий исход.</p></div><button type="button" disabled={disabled} onClick={addOutcome} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Добавить исход</button></div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">{[...outcomes].sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0)).map((outcome) => <button key={outcome.id} type="button" onClick={() => setSelectedOutcomeId(outcome.id)} className={`w-full rounded-xl border p-3 text-left ${outcome.id === selectedOutcomeId ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200 dark:bg-violet-500/10' : 'border-slate-200 dark:border-slate-700'}`}><span className="block font-semibold text-slate-900 dark:text-slate-100">{endings.find((ending) => ending.id === outcome.endingId)?.title || 'Исход без выбранной концовки'}</span><span className="mt-1 block text-xs text-slate-400">Приоритет {outcome.priority ?? 0}</span></button>)}</div>
            {selectedOutcome ? (
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex justify-end"><button type="button" disabled={disabled} onClick={() => removeOutcome(selectedOutcome.id)} className="text-sm font-semibold text-rose-600 disabled:opacity-50">Удалить исход</button></div>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">Концовка<select value={selectedOutcome.endingId || ''} disabled={disabled} onChange={(event) => patchOutcome(selectedOutcome.id, { endingId: event.target.value || null })} className={fieldClassName}><option value="">Выберите концовку</option>{endings.map((ending) => <option key={ending.id} value={ending.id}>{ending.title || 'Концовка без названия'}</option>)}</select></label>
                  <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">Приоритет<input type="number" value={selectedOutcome.priority ?? 0} disabled={disabled} onChange={(event) => patchOutcome(selectedOutcome.id, { priority: Number(event.target.value) || 0 })} className={fieldClassName} /></label>
                  <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">Виновник<select value={selectedOutcome.conditions?.culprit || 'any'} disabled={disabled} onChange={(event) => patchOutcomeConditions(selectedOutcome.id, { culprit: event.target.value })} className={fieldClassName}><option value="any">Любой</option><option value="correct">Верный</option><option value="incorrect">Неверный</option></select></label>
                  <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">Мотив<select value={selectedOutcome.conditions?.motive || 'any'} disabled={disabled} onChange={(event) => patchOutcomeConditions(selectedOutcome.id, { motive: event.target.value })} className={fieldClassName}><option value="any">Любой</option><option value="correct">Верный</option><option value="incorrect">Неверный</option></select></label>
                  <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">Мин. выбранных улик<input type="number" min="0" value={selectedOutcome.conditions?.minSelectedEvidence ?? 0} disabled={disabled} onChange={(event) => patchOutcomeConditions(selectedOutcome.id, { minSelectedEvidence: Math.max(0, Number(event.target.value) || 0) })} className={fieldClassName} /></label>
                  <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">Мин. ключевых улик<input type="number" min="0" value={selectedOutcome.conditions?.minKeyEvidence ?? 0} disabled={disabled} onChange={(event) => patchOutcomeConditions(selectedOutcome.id, { minKeyEvidence: Math.max(0, Number(event.target.value) || 0) })} className={fieldClassName} /></label>
                  <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">Не позже минуты<input type="number" min="0" value={selectedOutcome.conditions?.maxElapsedMinutes ?? ''} disabled={disabled} onChange={(event) => patchOutcomeConditions(selectedOutcome.id, { maxElapsedMinutes: event.target.value === '' ? null : Math.max(0, Number(event.target.value) || 0) })} className={fieldClassName} placeholder="Без ограничения" /></label>
                  <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">Не больше подсказок<input type="number" min="0" value={selectedOutcome.conditions?.maxUsedClues ?? ''} disabled={disabled} onChange={(event) => patchOutcomeConditions(selectedOutcome.id, { maxUsedClues: event.target.value === '' ? null : Math.max(0, Number(event.target.value) || 0) })} className={fieldClassName} placeholder="Без ограничения" /></label>
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-2"><ReferenceChecklist label="Обязательные доказательства" options={evidence} value={selectedOutcome.conditions?.requiredEvidenceIds} disabled={disabled} onChange={(value) => patchOutcomeConditions(selectedOutcome.id, { requiredEvidenceIds: value })} /><label className="grid content-start gap-1 text-sm text-slate-600 dark:text-slate-300">Обязательные категории доказательств<input value={normalizeArray(selectedOutcome.conditions?.requiredEvidenceTags).join(', ')} disabled={disabled} onChange={(event) => patchOutcomeConditions(selectedOutcome.id, { requiredEvidenceTags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} className={fieldClassName} placeholder="время, возможность, мотив" /></label></div>
              </div>
            ) : <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">Добавьте исход или выберите его слева.</p>}
          </div>
        </section>
      </div>
    </Modal>
  )
}

AccusationEditorModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  game: PropTypes.object.isRequired,
  updateGame: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
}

AccusationEditorModal.defaultProps = { disabled: false }

const InvestigationScenarioEditors = ({ game, gameId, updateGame, disabled }) => {
  const [openEditor, setOpenEditor] = useState('')
  const buttonClassName = 'rounded-xl border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 dark:border-violet-500/50 dark:bg-slate-900 dark:text-violet-200 dark:hover:bg-violet-500/10'

  return (
    <>
      <button type="button" onClick={() => setOpenEditor('topics')} className={buttonClassName}>Темы · {normalizeArray(game?.storyTopics).length}</button>
      <button type="button" onClick={() => setOpenEditor('evidence')} className={buttonClassName}>Доказательства · {normalizeArray(game?.storyEvidence).length}</button>
      <button type="button" onClick={() => setOpenEditor('accusation')} className={buttonClassName}>Финальное обвинение</button>
      <TopicsEditorModal isOpen={openEditor === 'topics'} onClose={() => setOpenEditor('')} game={game} gameId={gameId} updateGame={updateGame} disabled={disabled} />
      <EvidenceEditorModal isOpen={openEditor === 'evidence'} onClose={() => setOpenEditor('')} game={game} gameId={gameId} updateGame={updateGame} disabled={disabled} />
      <AccusationEditorModal isOpen={openEditor === 'accusation'} onClose={() => setOpenEditor('')} game={game} updateGame={updateGame} disabled={disabled} />
    </>
  )
}

InvestigationScenarioEditors.propTypes = {
  game: PropTypes.object.isRequired,
  gameId: PropTypes.string,
  updateGame: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
}

InvestigationScenarioEditors.defaultProps = { gameId: '', disabled: false }

export default InvestigationScenarioEditors
