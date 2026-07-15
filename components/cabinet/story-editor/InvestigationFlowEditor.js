'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import ImagesInput from '@components/cabinet/ImagesInput'
import InvestigationScenarioEditors from '@components/cabinet/story-editor/InvestigationScenarioEditors'

const TaskRichEditor = dynamic(
  () => import('@components/cabinet/TaskRichEditor'),
  { ssr: false },
)

const fieldClassName =
  'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'

const normalizeArray = (value) => (Array.isArray(value) ? value : [])
const createEntityId = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const getDefaultCharacterPosition = (index) => ({
  x: 80 + (index % 4) * 240,
  y: 80 + Math.floor(index / 4) * 160,
})

const emptyConditions = {
  requiredItemIds: [],
  requiredEvidenceIds: [],
  requiredTopicIds: [],
  requiredCharacterIds: [],
  requiredInteractionIds: [],
  requiredFlagIds: [],
  minElapsedMinutes: null,
  maxElapsedMinutes: null,
}

const emptyEffects = {
  grantsItemIds: [],
  consumesItemIds: [],
  grantsEvidenceIds: [],
  unlocksNodeIds: [],
  unlocksCharacterIds: [],
  unlocksTopicIds: [],
  setsFlagIds: [],
  scoreBonus: 0,
  scorePenalty: 0,
  endingId: null,
}

const interactionKindLabels = {
  question: 'Вопрос',
  examine: 'Осмотр',
  analysis: 'Анализ',
  system: 'Системное',
}

const referenceToneClasses = {
  condition:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
  item:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100',
  evidence:
    'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100',
  unlock:
    'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-100',
  ending:
    'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100',
}

const buildReferenceMaps = (game) => {
  const toMap = (entries) =>
    new Map(
      normalizeArray(entries).map((entry) => [
        entry.id,
        entry.title || entry.label || 'Без названия',
      ]),
    )

  return {
    nodes: toMap(game?.storyNodes),
    items: toMap(game?.storyItems),
    characters: toMap(game?.storyCharacters),
    topics: toMap(game?.storyTopics),
    evidence: toMap(game?.storyEvidence),
    interactions: toMap(game?.storyInteractions),
    endings: toMap(game?.storyEndings),
  }
}

const resolveLabel = (map, id) => map.get(id) || 'неизвестная сущность'

const collectInteractionReferences = (interaction, maps) => {
  const conditions = interaction?.conditions || emptyConditions
  const effects = interaction?.effects || emptyEffects
  const required = []
  const results = []
  const pushMany = (target, ids, prefix, map, tone) => {
    normalizeArray(ids).forEach((id) => {
      target.push({
        key: `${prefix}:${id}`,
        label: `${prefix}: ${resolveLabel(map, id)}`,
        tone,
      })
    })
  }

  pushMany(required, conditions.requiredInteractionIds, 'После', maps.interactions, 'condition')
  pushMany(required, conditions.requiredItemIds, 'Нужен предмет', maps.items, 'condition')
  pushMany(required, conditions.requiredEvidenceIds, 'Нужна улика', maps.evidence, 'condition')
  pushMany(required, conditions.requiredTopicIds, 'Нужна тема', maps.topics, 'condition')
  pushMany(required, conditions.requiredCharacterIds, 'Нужен персонаж', maps.characters, 'condition')
  normalizeArray(conditions.requiredFlagIds).forEach((id) => {
    required.push({ key: `flag:${id}`, label: 'Нужно дополнительное условие', tone: 'condition' })
  })

  pushMany(results, effects.grantsItemIds, 'Предмет', maps.items, 'item')
  pushMany(results, effects.grantsEvidenceIds, 'Улика', maps.evidence, 'evidence')
  pushMany(results, effects.unlocksNodeIds, 'Открывает', maps.nodes, 'unlock')
  pushMany(results, effects.unlocksCharacterIds, 'Персонаж', maps.characters, 'unlock')
  pushMany(results, effects.unlocksTopicIds, 'Тема', maps.topics, 'unlock')
  normalizeArray(effects.setsFlagIds).forEach((id) => {
    results.push({ key: `set-flag:${id}`, label: 'Открывает дальнейшие действия', tone: 'unlock' })
  })
  if (effects.endingId) {
    results.push({
      key: `ending:${effects.endingId}`,
      label: `Финал: ${resolveLabel(maps.endings, effects.endingId)}`,
      tone: 'ending',
    })
  }

  return { required, results }
}

const ReferenceChips = ({ title, emptyLabel, entries }) => (
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
      {title}
    </p>
    <div className="mt-1 flex flex-wrap gap-1.5">
      {entries.length > 0 ? (
        entries.map((entry) => (
          <span
            key={entry.key}
            className={`rounded-full border px-2 py-1 text-[11px] leading-tight ${referenceToneClasses[entry.tone]}`}
          >
            {entry.label}
          </span>
        ))
      ) : (
        <span className="text-xs text-slate-400">{emptyLabel}</span>
      )}
    </div>
  </div>
)

ReferenceChips.propTypes = {
  title: PropTypes.string.isRequired,
  emptyLabel: PropTypes.string.isRequired,
  entries: PropTypes.arrayOf(PropTypes.object).isRequired,
}

const ReferenceChecklist = ({ label, options, value, onChange, disabled }) => {
  const selectedIds = new Set(normalizeArray(value))

  return (
    <fieldset className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <legend className="px-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
        {label}
      </legend>
      <div className="mt-1 grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">
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

const FlagInput = ({ label, value, onChange, disabled }) => (
  <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
    {label}
    <input
      value={normalizeArray(value).join(', ')}
      disabled={disabled}
      onChange={(event) =>
        onChange(
          event.target.value
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean),
        )
      }
      placeholder="например: архив_проверен, запись_найдена"
      className={fieldClassName}
    />
  </label>
)

FlagInput.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.arrayOf(PropTypes.string),
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
}

FlagInput.defaultProps = {
  value: [],
  disabled: false,
}

const InvestigationFlowEditor = ({ game, gameId, updateGame, disabled }) => {
  const interactions = normalizeArray(game?.storyInteractions)
  const nodes = normalizeArray(game?.storyNodes)
  const items = normalizeArray(game?.storyItems)
  const characters = normalizeArray(game?.storyCharacters)
  const topics = normalizeArray(game?.storyTopics)
  const evidence = normalizeArray(game?.storyEvidence)
  const endings = normalizeArray(game?.storyEndings)
  const [search, setSearch] = useState('')
  const [selectedInteractionId, setSelectedInteractionId] = useState(
    interactions[0]?.id || '',
  )
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isCharactersEditorOpen, setIsCharactersEditorOpen] = useState(false)
  const [selectedCharacterId, setSelectedCharacterId] = useState(
    characters[0]?.id || '',
  )

  useEffect(() => {
    if (!interactions.some((interaction) => interaction.id === selectedInteractionId)) {
      setSelectedInteractionId(interactions[0]?.id || '')
    }
  }, [interactions, selectedInteractionId])

  useEffect(() => {
    if (!characters.some((character) => character.id === selectedCharacterId)) {
      setSelectedCharacterId(characters[0]?.id || '')
    }
  }, [characters, selectedCharacterId])

  const maps = useMemo(() => buildReferenceMaps(game), [game])
  const selectedInteraction = interactions.find(
    (interaction) => interaction.id === selectedInteractionId,
  )
  const selectedCharacter = characters.find(
    (character) => character.id === selectedCharacterId,
  )

  const selectedCharacterReferences = useMemo(() => {
    if (!selectedCharacterId) return []

    const references = interactions.flatMap((interaction) => {
      const referencesCharacter =
        interaction.characterId === selectedCharacterId ||
        normalizeArray(interaction.conditions?.requiredCharacterIds).includes(
          selectedCharacterId,
        ) ||
        normalizeArray(interaction.effects?.unlocksCharacterIds).includes(
          selectedCharacterId,
        )

      return referencesCharacter ? [interaction] : []
    })

    const accusation = game?.storyAccusation || {}
    if (
      accusation.correctCulpritId === selectedCharacterId ||
      normalizeArray(accusation.culpritCharacterIds).includes(
        selectedCharacterId,
      )
    ) {
      references.push({
        id: 'story-accusation',
        label: 'Финальное обвинение',
      })
    }

    return references
  }, [game?.storyAccusation, interactions, selectedCharacterId])

  const selectedInteractionDependents = useMemo(() => {
    if (!selectedInteractionId) return []
    const dependents = interactions.flatMap((interaction) =>
      interaction.id !== selectedInteractionId &&
      normalizeArray(interaction.conditions?.requiredInteractionIds).includes(
        selectedInteractionId,
      )
        ? [interaction.label || 'Взаимодействие без названия']
        : [],
    )
    if (
      normalizeArray(
        game?.storyAccusation?.availability?.requiredInteractionIds,
      ).includes(selectedInteractionId)
    ) {
      dependents.push('Финальное обвинение')
    }
    return dependents
  }, [game?.storyAccusation, interactions, selectedInteractionId])

  const locationGroups = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = query
      ? interactions.filter((interaction) => {
          const references = collectInteractionReferences(interaction, maps)
          return [
            interaction.id,
            interaction.label,
            maps.characters.get(interaction.characterId),
            maps.topics.get(interaction.topicId),
            ...references.required.map((entry) => entry.label),
            ...references.results.map((entry) => entry.label),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(query)
        })
      : interactions

    const groups = nodes.map((node) => ({
      id: node.id,
      title: node.title || 'Локация без названия',
      interactions: filtered.filter((interaction) => interaction.locationId === node.id),
    }))
    const withoutLocation = filtered.filter(
      (interaction) => !nodes.some((node) => node.id === interaction.locationId),
    )
    if (withoutLocation.length > 0) {
      groups.push({ id: '__without_location', title: 'Без локации', interactions: withoutLocation })
    }
    return groups.filter((group) => group.interactions.length > 0)
  }, [interactions, maps, nodes, search])

  const patchInteraction = useCallback(
    (interactionId, patch) => {
      updateGame((previous) => ({
        ...previous,
        storyInteractions: normalizeArray(previous.storyInteractions).map((interaction) =>
          interaction.id === interactionId ? { ...interaction, ...patch } : interaction,
        ),
      }))
    },
    [updateGame],
  )

  const patchNested = useCallback(
    (section, patch) => {
      if (!selectedInteraction) return
      patchInteraction(selectedInteraction.id, {
        [section]: {
          ...(section === 'conditions' ? emptyConditions : emptyEffects),
          ...(selectedInteraction[section] || {}),
          ...patch,
        },
      })
    },
    [patchInteraction, selectedInteraction],
  )

  const addInteraction = () => {
    const id = createEntityId('interaction')
    const locationId = game?.storyConfig?.investigation?.startNodeId || nodes[0]?.id || null
    const nextInteraction = {
      id,
      kind: 'examine',
      locationId,
      characterId: null,
      topicId: null,
      label: 'Новое взаимодействие',
      promptRich: '',
      responseRich: '',
      media: [],
      timeCostMinutes: game?.storyConfig?.investigation?.defaultInteractionTimeMinutes ?? 10,
      repeatable: false,
      reapplyEffects: false,
      conditions: { ...emptyConditions },
      effects: { ...emptyEffects },
      journal: { title: 'Новое взаимодействие', summaryRich: '', kind: 'observation' },
    }
    updateGame((previous) => ({
      ...previous,
      storyInteractions: [...normalizeArray(previous.storyInteractions), nextInteraction],
    }))
    setSelectedInteractionId(id)
    setIsEditorOpen(true)
  }

  const patchCharacter = useCallback(
    (characterId, patch) => {
      updateGame((previous) => ({
        ...previous,
        storyCharacters: normalizeArray(previous.storyCharacters).map(
          (character) =>
            character.id === characterId
              ? { ...character, ...patch }
              : character,
        ),
      }))
    },
    [updateGame],
  )

  const addCharacter = () => {
    const id = createEntityId('character')
    const index = characters.length
    const nextCharacter = {
      id,
      title: `Новый персонаж ${index + 1}`,
      subtitle: '',
      descriptionRich: '',
      image: '',
      media: [],
      startVisible: true,
      hiddenUntilUnlocked: true,
      defaultNodeId:
        game?.storyConfig?.investigation?.startNodeId || nodes[0]?.id || null,
      position: getDefaultCharacterPosition(index),
    }
    updateGame((previous) => ({
      ...previous,
      storyCharacters: [
        ...normalizeArray(previous.storyCharacters),
        nextCharacter,
      ],
    }))
    setSelectedCharacterId(id)
    setIsCharactersEditorOpen(true)
  }

  const removeSelectedCharacter = () => {
    if (!selectedCharacter) return
    if (selectedCharacterReferences.length > 0) return
    if (!window.confirm(`Удалить персонажа «${selectedCharacter.title || 'без имени'}»?`)) {
      return
    }

    updateGame((previous) => ({
      ...previous,
      storyCharacters: normalizeArray(previous.storyCharacters).filter(
        (character) => character.id !== selectedCharacter.id,
      ),
    }))
  }

  const removeSelectedInteraction = () => {
    if (!selectedInteraction || selectedInteractionDependents.length > 0) return
    if (!window.confirm(`Удалить взаимодействие «${selectedInteraction.label || 'без названия'}»?`)) return
    updateGame((previous) => ({
      ...previous,
      storyInteractions: normalizeArray(previous.storyInteractions).filter(
        (interaction) => interaction.id !== selectedInteraction.id,
      ),
    }))
    setIsEditorOpen(false)
  }

  return (
    <section className="rounded-2xl border border-violet-200 bg-white p-4 dark:border-violet-500/30 dark:bg-slate-900/80">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">
            Карта логики расследования
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            В каждой локации показаны доступные действия, условия их появления и результаты. Эта карта объясняет логику расследования и не добавляет линии на основном графе локаций.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsCharactersEditorOpen(true)}
            className="rounded-xl border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 dark:border-violet-500/50 dark:bg-slate-900 dark:text-violet-200 dark:hover:bg-violet-500/10"
          >
            Персонажи · {characters.length}
          </button>
          <InvestigationScenarioEditors
            game={game}
            gameId={gameId}
            updateGame={updateGame}
            disabled={disabled}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={addInteraction}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Добавить взаимодействие
          </button>
        </div>
      </div>

      <label className="mt-4 grid max-w-xl gap-1 text-sm text-slate-600 dark:text-slate-300">
        Найти действие, предмет, улику или условие
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Например: Soundcheck 17:21"
          className={fieldClassName}
        />
      </label>

      <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {locationGroups.map((group) => (
          <section key={group.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/60">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{group.title}</h3>
              <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {group.interactions.length}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {group.interactions.map((interaction) => {
                const references = collectInteractionReferences(interaction, maps)
                const selected = interaction.id === selectedInteractionId
                return (
                  <button
                    key={interaction.id}
                    type="button"
                    onClick={() => {
                      setSelectedInteractionId(interaction.id)
                      setIsEditorOpen(true)
                    }}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selected
                        ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200 dark:bg-violet-500/10 dark:ring-violet-500/20'
                        : 'border-slate-200 bg-white hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {interaction.label || 'Взаимодействие без названия'}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {interactionKindLabels[interaction.kind] || interaction.kind} · {interaction.timeCostMinutes ?? 0} мин
                      </span>
                    </div>
                    {interaction.characterId || interaction.topicId ? (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {[maps.characters.get(interaction.characterId), maps.topics.get(interaction.topicId)]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    ) : null}
                    <div className="mt-3 space-y-2">
                      <ReferenceChips title="Требует" emptyLabel="Доступно без дополнительных условий" entries={references.required} />
                      <ReferenceChips title="Результат" emptyLabel="Только ответ и запись в журнал" entries={references.results} />
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {locationGroups.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
          По этому запросу взаимодействия не найдены.
        </p>
      ) : null}

      <Modal
        isOpen={isCharactersEditorOpen}
        title={`Персонажи расследования · ${characters.length}`}
        onClose={() => setIsCharactersEditorOpen(false)}
        dialogClassName="md:max-w-6xl"
        bodyClassName="bg-slate-50/80 dark:bg-slate-950/40"
        footer={(
          <>
            <p className="mr-auto text-xs text-slate-500 dark:text-slate-400">
              Изменения сохранятся после нажатия общей кнопки «Сохранить сценарий».
            </p>
            <button
              type="button"
              onClick={() => setIsCharactersEditorOpen(false)}
              className="aq-modal-btn aq-modal-btn-primary"
            >
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
              onClick={addCharacter}
              className="w-full rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Добавить персонажа
            </button>
            <div className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {characters.map((character) => {
                const isSelected = character.id === selectedCharacterId
                return (
                  <button
                    key={character.id}
                    type="button"
                    onClick={() => setSelectedCharacterId(character.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition ${
                      isSelected
                        ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200 dark:bg-violet-500/10 dark:ring-violet-500/20'
                        : 'border-slate-200 bg-white hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900'
                    }`}
                  >
                    {character.image ? (
                      <img
                        src={character.image}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-lg font-bold text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
                        {(character.title || '?').trim().slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {character.title || 'Персонаж без имени'}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-400">
                        {character.subtitle || 'Роль не указана'}
                      </span>
                    </span>
                  </button>
                )
              })}
              {characters.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700">
                  Персонажей пока нет.
                </p>
              ) : null}
            </div>
          </aside>

          {selectedCharacter ? (
            <section className="rounded-2xl border border-violet-200 bg-white p-4 dark:border-violet-500/30 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedCharacter.title || 'Персонаж'}
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={disabled || selectedCharacterReferences.length > 0}
                  onClick={removeSelectedCharacter}
                  className="rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/40 dark:text-rose-200"
                  title={
                    selectedCharacterReferences.length > 0
                      ? 'Сначала удалите ссылки на персонажа из логики сценария'
                      : 'Удалить персонажа'
                  }
                >
                  Удалить персонажа
                </button>
              </div>

              {selectedCharacterReferences.length > 0 ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  Персонаж используется в логике сценария: {selectedCharacterReferences
                    .slice(0, 4)
                    .map((interaction) => interaction.label || 'Взаимодействие без названия')
                    .join(', ')}
                  {selectedCharacterReferences.length > 4
                    ? ` и ещё ${selectedCharacterReferences.length - 4}`
                    : ''}.
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
                  Имя
                  <input
                    value={selectedCharacter.title || ''}
                    disabled={disabled}
                    onChange={(event) =>
                      patchCharacter(selectedCharacter.id, {
                        title: event.target.value,
                      })
                    }
                    className={fieldClassName}
                    placeholder="Имя персонажа"
                  />
                </label>
                <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
                  Роль или должность
                  <input
                    value={selectedCharacter.subtitle || ''}
                    disabled={disabled}
                    onChange={(event) =>
                      patchCharacter(selectedCharacter.id, {
                        subtitle: event.target.value,
                      })
                    }
                    className={fieldClassName}
                    placeholder="Например: ведущая вечернего эфира"
                  />
                </label>
                <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300 md:col-span-2">
                  Основная локация
                  <select
                    value={selectedCharacter.defaultNodeId || ''}
                    disabled={disabled}
                    onChange={(event) =>
                      patchCharacter(selectedCharacter.id, {
                        defaultNodeId: event.target.value || null,
                      })
                    }
                    className={fieldClassName}
                  >
                    <option value="">Без основной локации</option>
                    {nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.title || 'Локация без названия'}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4">
                <ImagesInput
                  label="Портрет персонажа"
                  images={selectedCharacter.image ? [selectedCharacter.image] : []}
                  onChange={(nextImages) =>
                    patchCharacter(selectedCharacter.id, {
                      image: nextImages?.[0] ?? '',
                    })
                  }
                  directory={`games/${gameId || 'draft'}/story/characters/${selectedCharacter.id}`}
                  imageName="portrait"
                  disabled={disabled}
                  maxImages={1}
                  previewShape="square"
                  uploadLabel="Загрузить портрет"
                />
              </div>

              <div className="mt-4">
                <p className="mb-1 text-sm text-slate-600 dark:text-slate-300">
                  Внешность, характер и досье
                </p>
                <TaskRichEditor
                  value={selectedCharacter.descriptionRich || ''}
                  directory={`games/${gameId || 'draft'}/story/characters/${selectedCharacter.id}/description/editor`}
                  disabled={disabled}
                  contentMaxHeight="360px"
                  placeholder="Опишите внешность, манеру речи, характер и важные детали персонажа."
                  onChange={({ html, media }) =>
                    patchCharacter(selectedCharacter.id, {
                      descriptionRich: typeof html === 'string' ? html : '',
                      media: Array.isArray(media) ? media : [],
                    })
                  }
                />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedCharacter.startVisible)}
                    disabled={disabled}
                    onChange={(event) =>
                      patchCharacter(selectedCharacter.id, {
                        startVisible: event.target.checked,
                      })
                    }
                  />
                  Виден игрокам с начала
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={selectedCharacter.hiddenUntilUnlocked !== false}
                    disabled={disabled}
                    onChange={(event) =>
                      patchCharacter(selectedCharacter.id, {
                        hiddenUntilUnlocked: event.target.checked,
                      })
                    }
                  />
                  Скрывать до открытия
                </label>
              </div>
            </section>
          ) : (
            <section className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
              Добавьте персонажа или выберите его в списке.
            </section>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(isEditorOpen && selectedInteraction)}
        title={`Взаимодействие: ${selectedInteraction?.label || 'без названия'}`}
        onClose={() => setIsEditorOpen(false)}
        dialogClassName="md:max-w-6xl"
        bodyClassName="bg-slate-50/80 dark:bg-slate-950/40"
        footer={(
          <>
            <p className="mr-auto text-xs text-slate-500 dark:text-slate-400">
              Изменения сохранятся в базе после нажатия общей кнопки «Сохранить сценарий».
            </p>
            <button
              type="button"
              onClick={() => setIsEditorOpen(false)}
              className="aq-modal-btn aq-modal-btn-primary"
            >
              Готово
            </button>
          </>
        )}
      >
        {selectedInteraction ? (
        <div className="rounded-2xl border border-violet-200 bg-white p-4 dark:border-violet-500/30 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Редактирование: {selectedInteraction.label || 'Взаимодействие без названия'}
              </h3>
            </div>
            <button
              type="button"
              disabled={disabled || selectedInteractionDependents.length > 0}
              onClick={removeSelectedInteraction}
              className="rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/40 dark:text-rose-200"
            >
              Удалить взаимодействие
            </button>
          </div>

          {selectedInteractionDependents.length > 0 ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              Взаимодействие требуется для: {selectedInteractionDependents
                .slice(0, 5)
                .join(', ')}
              {selectedInteractionDependents.length > 5
                ? ` и ещё ${selectedInteractionDependents.length - 5}`
                : ''}.
            </p>
          ) : null}

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
              Название
              <input
                value={selectedInteraction.label || ''}
                disabled={disabled}
                onChange={(event) => patchInteraction(selectedInteraction.id, { label: event.target.value })}
                className={fieldClassName}
              />
            </label>
            <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
              Тип
              <select
                value={selectedInteraction.kind || 'question'}
                disabled={disabled}
                onChange={(event) => patchInteraction(selectedInteraction.id, { kind: event.target.value })}
                className={fieldClassName}
              >
                {Object.entries(interactionKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
              Локация
              <select
                value={selectedInteraction.locationId || ''}
                disabled={disabled}
                onChange={(event) => patchInteraction(selectedInteraction.id, { locationId: event.target.value || null })}
                className={fieldClassName}
              >
                <option value="">Без локации</option>
                {nodes.map((node) => <option key={node.id} value={node.id}>{node.title || 'Локация без названия'}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
              Время, минут
              <input
                type="number"
                min="0"
                value={selectedInteraction.timeCostMinutes ?? 0}
                disabled={disabled}
                onChange={(event) => patchInteraction(selectedInteraction.id, { timeCostMinutes: Math.max(0, Number(event.target.value) || 0) })}
                className={fieldClassName}
              />
            </label>
            <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
              Персонаж
              <select
                value={selectedInteraction.characterId || ''}
                disabled={disabled}
                onChange={(event) => patchInteraction(selectedInteraction.id, { characterId: event.target.value || null })}
                className={fieldClassName}
              >
                <option value="">Без персонажа</option>
                {characters.map((character) => <option key={character.id} value={character.id}>{character.title || 'Персонаж без имени'}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
              Тема
              <select
                value={selectedInteraction.topicId || ''}
                disabled={disabled}
                onChange={(event) => patchInteraction(selectedInteraction.id, { topicId: event.target.value || null })}
                className={fieldClassName}
              >
                <option value="">Без темы</option>
                {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title || 'Тема без названия'}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={Boolean(selectedInteraction.repeatable)}
                disabled={disabled}
                onChange={(event) => patchInteraction(selectedInteraction.id, {
                  repeatable: event.target.checked,
                  reapplyEffects: event.target.checked
                    ? Boolean(selectedInteraction.reapplyEffects)
                    : false,
                })}
              />
              Можно повторять
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={Boolean(selectedInteraction.reapplyEffects)}
                disabled={disabled || !selectedInteraction.repeatable}
                onChange={(event) => patchInteraction(selectedInteraction.id, { reapplyEffects: event.target.checked })}
              />
              Повторно применять эффекты
            </label>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div>
              <p className="mb-1 text-sm text-slate-600 dark:text-slate-300">Формулировка действия или вопроса</p>
              <TaskRichEditor
                value={selectedInteraction.promptRich || ''}
                directory={`games/${gameId || 'draft'}/story/interactions/${selectedInteraction.id}/prompt/editor`}
                disabled={disabled}
                contentMaxHeight="280px"
                placeholder="Текст, который игрок увидит перед выполнением действия."
                onChange={({ html }) => patchInteraction(selectedInteraction.id, { promptRich: typeof html === 'string' ? html : '' })}
              />
            </div>
            <div>
              <p className="mb-1 text-sm text-slate-600 dark:text-slate-300">Ответ игроку и медиа</p>
              <TaskRichEditor
                value={selectedInteraction.responseRich || ''}
                directory={`games/${gameId || 'draft'}/story/interactions/${selectedInteraction.id}/response/editor`}
                disabled={disabled}
                contentMaxHeight="280px"
                placeholder="Реплика персонажа, результат осмотра или анализа."
                onChange={({ html, media }) => patchInteraction(selectedInteraction.id, {
                  responseRich: typeof html === 'string' ? html : '',
                  media: Array.isArray(media) ? media : [],
                })}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <details open className="rounded-xl border border-amber-200 bg-white p-3 dark:border-amber-500/30 dark:bg-slate-900">
              <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">Условия доступности</summary>
              <div className="mt-3 grid gap-3">
                <ReferenceChecklist label="После взаимодействий" options={interactions.filter((entry) => entry.id !== selectedInteraction.id)} value={selectedInteraction.conditions?.requiredInteractionIds} disabled={disabled} onChange={(value) => patchNested('conditions', { requiredInteractionIds: value })} />
                <ReferenceChecklist label="Нужны предметы" options={items} value={selectedInteraction.conditions?.requiredItemIds} disabled={disabled} onChange={(value) => patchNested('conditions', { requiredItemIds: value })} />
                <ReferenceChecklist label="Нужны улики" options={evidence} value={selectedInteraction.conditions?.requiredEvidenceIds} disabled={disabled} onChange={(value) => patchNested('conditions', { requiredEvidenceIds: value })} />
                <ReferenceChecklist label="Нужны темы" options={topics} value={selectedInteraction.conditions?.requiredTopicIds} disabled={disabled} onChange={(value) => patchNested('conditions', { requiredTopicIds: value })} />
                <ReferenceChecklist label="Нужны персонажи" options={characters} value={selectedInteraction.conditions?.requiredCharacterIds} disabled={disabled} onChange={(value) => patchNested('conditions', { requiredCharacterIds: value })} />
                <FlagInput label="Нужны служебные условия" value={selectedInteraction.conditions?.requiredFlagIds} disabled={disabled} onChange={(value) => patchNested('conditions', { requiredFlagIds: value })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
                    Не раньше минуты
                    <input type="number" min="0" value={selectedInteraction.conditions?.minElapsedMinutes ?? ''} disabled={disabled} onChange={(event) => patchNested('conditions', { minElapsedMinutes: event.target.value === '' ? null : Math.max(0, Number(event.target.value) || 0) })} className={fieldClassName} placeholder="Без ограничения" />
                  </label>
                  <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
                    Не позже минуты
                    <input type="number" min="0" value={selectedInteraction.conditions?.maxElapsedMinutes ?? ''} disabled={disabled} onChange={(event) => patchNested('conditions', { maxElapsedMinutes: event.target.value === '' ? null : Math.max(0, Number(event.target.value) || 0) })} className={fieldClassName} placeholder="Без ограничения" />
                  </label>
                </div>
              </div>
            </details>

            <details open className="rounded-xl border border-emerald-200 bg-white p-3 dark:border-emerald-500/30 dark:bg-slate-900">
              <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">Результаты взаимодействия</summary>
              <div className="mt-3 grid gap-3">
                <ReferenceChecklist label="Выдать предметы" options={items} value={selectedInteraction.effects?.grantsItemIds} disabled={disabled} onChange={(value) => patchNested('effects', { grantsItemIds: value })} />
                <ReferenceChecklist label="Израсходовать предметы" options={items} value={selectedInteraction.effects?.consumesItemIds} disabled={disabled} onChange={(value) => patchNested('effects', { consumesItemIds: value })} />
                <ReferenceChecklist label="Выдать улики" options={evidence} value={selectedInteraction.effects?.grantsEvidenceIds} disabled={disabled} onChange={(value) => patchNested('effects', { grantsEvidenceIds: value })} />
                <ReferenceChecklist label="Открыть локации" options={nodes} value={selectedInteraction.effects?.unlocksNodeIds} disabled={disabled} onChange={(value) => patchNested('effects', { unlocksNodeIds: value })} />
                <ReferenceChecklist label="Открыть темы" options={topics} value={selectedInteraction.effects?.unlocksTopicIds} disabled={disabled} onChange={(value) => patchNested('effects', { unlocksTopicIds: value })} />
                <ReferenceChecklist label="Открыть персонажей" options={characters} value={selectedInteraction.effects?.unlocksCharacterIds} disabled={disabled} onChange={(value) => patchNested('effects', { unlocksCharacterIds: value })} />
                <FlagInput label="Запомнить результат для следующих действий" value={selectedInteraction.effects?.setsFlagIds} disabled={disabled} onChange={(value) => patchNested('effects', { setsFlagIds: value })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">Бонус баллов<input type="number" value={selectedInteraction.effects?.scoreBonus ?? 0} disabled={disabled} onChange={(event) => patchNested('effects', { scoreBonus: Number(event.target.value) || 0 })} className={fieldClassName} /></label>
                  <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">Штраф баллов<input type="number" value={selectedInteraction.effects?.scorePenalty ?? 0} disabled={disabled} onChange={(event) => patchNested('effects', { scorePenalty: Number(event.target.value) || 0 })} className={fieldClassName} /></label>
                </div>
                <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
                  Перейти к концовке
                  <select
                    value={selectedInteraction.effects?.endingId || ''}
                    disabled={disabled}
                    onChange={(event) => patchNested('effects', { endingId: event.target.value || null })}
                    className={fieldClassName}
                  >
                    <option value="">Не завершать расследование</option>
                    {endings.map((ending) => <option key={ending.id} value={ending.id}>{ending.title || 'Концовка без названия'}</option>)}
                  </select>
                </label>
              </div>
            </details>
          </div>
          <details className="mt-4 rounded-xl border border-blue-200 bg-white p-3 dark:border-blue-500/30 dark:bg-slate-900">
            <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">Запись в журнале расследования</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">Заголовок записи<input value={selectedInteraction.journal?.title || ''} disabled={disabled} onChange={(event) => patchInteraction(selectedInteraction.id, { journal: { ...(selectedInteraction.journal || {}), title: event.target.value } })} className={fieldClassName} /></label>
              <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">Тип записи<select value={selectedInteraction.journal?.kind || 'observation'} disabled={disabled} onChange={(event) => patchInteraction(selectedInteraction.id, { journal: { ...(selectedInteraction.journal || {}), kind: event.target.value } })} className={fieldClassName}><option value="testimony">Показание</option><option value="evidence">Доказательство</option><option value="observation">Наблюдение</option><option value="system">Системная запись</option></select></label>
            </div>
            <div className="mt-3">
              <TaskRichEditor
                value={selectedInteraction.journal?.summaryRich || ''}
                directory={`games/${gameId || 'draft'}/story/interactions/${selectedInteraction.id}/journal/editor`}
                disabled={disabled}
                contentMaxHeight="260px"
                placeholder="Краткая формулировка, которая останется в журнале команды."
                onChange={({ html }) => patchInteraction(selectedInteraction.id, { journal: { ...(selectedInteraction.journal || {}), summaryRich: typeof html === 'string' ? html : '' } })}
              />
            </div>
          </details>
        </div>
        ) : <div />}
      </Modal>
    </section>
  )
}

InvestigationFlowEditor.propTypes = {
  game: PropTypes.object.isRequired,
  gameId: PropTypes.string,
  updateGame: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
}

InvestigationFlowEditor.defaultProps = {
  gameId: '',
  disabled: false,
}

export default InvestigationFlowEditor
