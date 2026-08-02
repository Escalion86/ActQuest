'use client'

import PropTypes from 'prop-types'
import { useCallback, useEffect, useMemo, useState } from 'react'

import RichTaskContentView from '@components/game/RichTaskContentView'
import StoryInvestigationClock from './StoryInvestigationClock'
import StoryMediaList from './StoryMediaList'

const REASON_MESSAGES = {
  accusation_unavailable: 'Обвинение пока недоступно.',
  already_at_location: 'Команда уже находится в этой локации.',
  deadline_exceeded: 'Времени не хватило: расследование завершено по дедлайну.',
  duplicate_evidence: 'Одно доказательство выбрано несколько раз.',
  evidence_not_discovered: 'Можно использовать только найденные доказательства.',
  interaction_already_used: 'Ответ уже сохранён в журнале.',
  interaction_not_available: 'Это взаимодействие сейчас недоступно.',
  invalid_evidence_count: 'Проверьте количество выбранных доказательств.',
  location_not_available: 'Локация пока недоступна.',
  story_finished: 'Расследование уже завершено.',
  wrong_accusation_location: 'Вернитесь в локацию финального обвинения.',
}

const getReasonMessage = (reason) =>
  REASON_MESSAGES[reason] || 'Действие не применено. Обновите состояние.'

const StoryInvestigationProcess = ({ gameId, teamId, testRunId, isActive }) => {
  const [state, setState] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState('')
  const [selectedCharacterId, setSelectedCharacterId] = useState('')
  const [lastResponse, setLastResponse] = useState(null)
  const [isAccusationOpen, setIsAccusationOpen] = useState(false)
  const [culpritId, setCulpritId] = useState('')
  const [motiveId, setMotiveId] = useState('')
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState([])

  const loadState = useCallback(async () => {
    if (!gameId || !teamId || !isActive) return
    setIsLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ teamId })
      if (testRunId) params.set('testRunId', testRunId)
      const response = await fetch(
        `/api/cabinet/games/${encodeURIComponent(gameId)}/story-state?${params.toString()}`,
      )
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || 'Не удалось загрузить расследование')
      }
      setState(json.data || null)
    } catch (loadError) {
      setError(loadError?.message || 'Не удалось загрузить расследование')
    } finally {
      setIsLoading(false)
    }
  }, [gameId, isActive, teamId, testRunId])

  const mutate = useCallback(
    async (route, payload) => {
      if (isMutating) return null
      setIsMutating(true)
      setError('')
      try {
        const response = await fetch(
          `/api/cabinet/games/${encodeURIComponent(gameId)}/story/${route}${
            testRunId
              ? `?testRunId=${encodeURIComponent(testRunId)}`
              : ''
          }`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teamId, ...payload }),
          },
        )
        const json = await response.json().catch(() => null)
        if (!response.ok || !json?.success) {
          throw new Error(json?.error || 'Не удалось выполнить действие')
        }
        const data = json.data || {}
        if (data.state) setState(data.state)
        if (!data.applied) setError(getReasonMessage(data.reason))
        return data
      } catch (mutationError) {
        setError(mutationError?.message || 'Не удалось выполнить действие')
        return null
      } finally {
        setIsMutating(false)
      }
    },
    [gameId, isMutating, teamId, testRunId],
  )

  useEffect(() => {
    if (!state && !isLoading && !error) void loadState()
  }, [error, isLoading, loadState, state])

  const investigation = state?.investigation
  const currentNodeId = investigation?.currentLocation?.id || ''
  const charactersHere = useMemo(
    () =>
      (Array.isArray(investigation?.characters)
        ? investigation.characters
        : []
      ).filter(
        (character) =>
          !character?.defaultNodeId || character.defaultNodeId === currentNodeId,
      ),
    [currentNodeId, investigation?.characters],
  )
  const activeCharacterId = charactersHere.some(
    (character) => character.id === selectedCharacterId,
  )
    ? selectedCharacterId
    : charactersHere[0]?.id || ''
  const activeCharacter =
    charactersHere.find((character) => character.id === activeCharacterId) ||
    null
  const interactions = Array.isArray(investigation?.availableInteractions)
    ? investigation.availableInteractions
    : []
  const characterInteractions = interactions.filter(
    (interaction) => interaction?.characterId === activeCharacterId,
  )
  const examinations = interactions.filter(
    (interaction) => !interaction?.characterId,
  )
  const topicsById = new Map(
    (Array.isArray(investigation?.topics) ? investigation.topics : []).map(
      (topic) => [topic.id, topic],
    ),
  )
  const evidence = Array.isArray(investigation?.discoveredEvidence)
    ? investigation.discoveredEvidence
    : []
  const accusation = investigation?.accusation
  const accusationRequiredNodeTitle = accusation?.requiredNodeTitle || ''
  const canOpenAccusation = accusation?.isAtRequiredNode !== false

  const handleInteraction = async (interactionId) => {
    const data = await mutate('interaction', { interactionId })
    if (data?.applied) {
      setLastResponse({
        responseRich: data.responseRich || '',
        media: Array.isArray(data.media) ? data.media : [],
        journalEntry: data.journalEntry || null,
      })
    }
  }

  const handleTravel = async (location) => {
    const minutes = Number(location?.travelTimeMinutes) || 0
    if (!window.confirm(`Перейти в «${location.title}»? Это займёт ${minutes} мин.`)) return
    const data = await mutate('travel', { targetNodeId: location.id })
    if (data?.applied) {
      setSelectedCharacterId('')
      setLastResponse(null)
    }
  }

  const toggleEvidence = (evidenceId) => {
    setSelectedEvidenceIds((current) =>
      current.includes(evidenceId)
        ? current.filter((id) => id !== evidenceId)
        : [...current, evidenceId],
    )
  }

  const handleAccusation = async () => {
    if (!culpritId || !motiveId) {
      setError('Выберите подозреваемого и мотив.')
      return
    }
    if (!window.confirm('Предъявить обвинение? Изменить версию после отправки нельзя.')) return
    const data = await mutate('accusation', {
      culpritId,
      motiveId,
      evidenceIds: selectedEvidenceIds,
    })
    if (data?.applied) setIsAccusationOpen(false)
  }

  const handleOpenAccusation = () => {
    if (!canOpenAccusation) {
      setError(
        accusationRequiredNodeTitle
          ? `Обвинение можно предъявить только в локации «${accusationRequiredNodeTitle}».`
          : 'Обвинение можно предъявить только в назначенной локации.',
      )
      return
    }
    setError('')
    setIsAccusationOpen(true)
  }

  if (isLoading && !state) {
    return <section className="rounded-3xl bg-white p-6 shadow-lg dark:bg-slate-900">Загружаем материалы дела…</section>
  }
  if (!state) {
    return (
      <section className="rounded-3xl border border-rose-300 bg-rose-50 p-6 dark:bg-rose-500/10">
        <p>{error || 'Состояние расследования недоступно.'}</p>
        <button type="button" onClick={() => void loadState()} className="mt-3 rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white">Повторить</button>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <header className="rounded-3xl border border-cyan-200 bg-white p-5 shadow-lg dark:border-cyan-500/20 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">Цифровое расследование</p>
            <h2 className="mt-1 text-2xl font-bold">{state?.game?.name}</h2>
          </div>
          <button type="button" disabled={isLoading || isMutating} onClick={() => void loadState()} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700">Обновить</button>
        </div>
        {state?.game?.storyConfig?.investigation?.showClockToTeam !== false ? (
          <div className="mt-4"><StoryInvestigationClock clock={investigation?.clock} /></div>
        ) : null}
        {error ? <p className="mt-3 rounded-xl bg-rose-100 p-3 text-sm text-rose-800 dark:bg-rose-500/15 dark:text-rose-200">{error}</p> : null}
      </header>

      {!state?.currentEnding ? (
        <article className="rounded-3xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-500/30 dark:bg-violet-500/10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">
            Ваша задача
          </p>
          {state?.game?.descriptionRich ? (
            <RichTaskContentView
              html={state.game.descriptionRich}
              text=""
              className="mt-3 leading-relaxed text-slate-800 dark:text-slate-100"
              directory="games/story/investigation/introduction"
            />
          ) : state?.game?.description ? (
            <p className="mt-3 leading-relaxed text-slate-800 dark:text-slate-100">
              {state.game.description}
            </p>
          ) : (
            <p className="mt-3 leading-relaxed text-slate-800 dark:text-slate-100">
              Восстановите события, найдите доказательства и предъявите обоснованное обвинение до истечения времени.
            </p>
          )}
          <ol className="mt-4 grid gap-2 text-sm text-slate-700 dark:text-slate-200 sm:grid-cols-3">
            <li className="rounded-2xl bg-white/80 p-3 dark:bg-slate-900/60">
              <span className="font-bold text-violet-700 dark:text-violet-300">1.</span>{' '}
              Осматривайте локации и задавайте персонажам доступные вопросы.
            </li>
            <li className="rounded-2xl bg-white/80 p-3 dark:bg-slate-900/60">
              <span className="font-bold text-violet-700 dark:text-violet-300">2.</span>{' '}
              Сверяйте ответы с журналом и собранными доказательствами.
            </li>
            <li className="rounded-2xl bg-white/80 p-3 dark:bg-slate-900/60">
              <span className="font-bold text-violet-700 dark:text-violet-300">3.</span>{' '}
              Когда версия сложится, вернитесь к месту обвинения и назовите виновного.
            </li>
          </ol>
          <p className="mt-3 text-sm font-semibold text-violet-900 dark:text-violet-100">
            Начните ниже: выберите вопрос персонажу или действие в текущей локации. Каждое новое действие расходует игровое время.
          </p>
        </article>
      ) : null}

      {state?.currentEnding ? (
        <article className="rounded-3xl border border-violet-300 bg-violet-50 p-6 dark:border-violet-500/30 dark:bg-violet-500/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">Расследование завершено</p>
          <h3 className="mt-2 text-2xl font-bold">{state.currentEnding.title}</h3>
          <RichTaskContentView html={state.currentEnding.descriptionRich || ''} text="" className="mt-3" directory="games/story/investigation/ending" />
          <StoryMediaList media={state.currentEnding.media} directory="ending" />
        </article>
      ) : (
        <>
          <article className="rounded-3xl bg-white p-5 shadow-lg dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Текущая локация</p>
            <h3 className="mt-1 text-xl font-bold">{investigation?.currentLocation?.title || '—'}</h3>
            <RichTaskContentView html={investigation?.currentLocation?.descriptionRich || ''} text="" className="mt-3" directory={`games/story/investigation/${currentNodeId}`} />
            <StoryMediaList media={investigation?.currentLocation?.media} directory={currentNodeId} />
            <div className="mt-4 flex flex-wrap gap-2">
              {(investigation?.availableLocations || []).filter((location) => !location.isCurrent).map((location) => (
                <button key={location.id} type="button" disabled={isMutating} onClick={() => void handleTravel(location)} className="rounded-xl border border-cyan-300 px-3 py-2 text-sm font-semibold text-cyan-800 dark:border-cyan-500/40 dark:text-cyan-100">
                  {location.title} · +{location.travelTimeMinutes} мин.
                </button>
              ))}
            </div>
          </article>

          {charactersHere.length > 0 ? (
            <article className="rounded-3xl bg-white p-5 shadow-lg dark:bg-slate-900">
              <h3 className="text-lg font-bold">Персонажи и темы</h3>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                {charactersHere.map((character) => (
                  <button key={character.id} type="button" onClick={() => setSelectedCharacterId(character.id)} className={`flex shrink-0 items-center gap-3 rounded-xl border p-2 pr-3 text-left ${activeCharacterId === character.id ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10' : 'border-slate-300 dark:border-slate-700'}`}>
                    {character.image ? (
                      <img
                        src={character.image}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-lg object-cover"
                      />
                    ) : null}
                    <span>
                      <span className="block font-semibold">{character.title}</span>
                      {character.subtitle ? <span className="block text-xs text-slate-500">{character.subtitle}</span> : null}
                    </span>
                  </button>
                ))}
              </div>
              {activeCharacter ? (
                <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-500/25 dark:bg-violet-500/10">
                  <p className="font-semibold">{activeCharacter.title}</p>
                  {activeCharacter.subtitle ? (
                    <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-500">
                      {activeCharacter.subtitle}
                    </p>
                  ) : null}
                  {activeCharacter.image ? (
                    <StoryMediaList
                      media={[
                        {
                          id: `portrait-${activeCharacter.id}`,
                          type: 'image',
                          url: activeCharacter.image,
                          title: activeCharacter.title,
                        },
                      ]}
                      directory={`games/story/investigation/characters/${activeCharacter.id}`}
                    />
                  ) : null}
                  <RichTaskContentView
                    html={activeCharacter.descriptionRich || ''}
                    text=""
                    className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200"
                    directory={`games/story/investigation/characters/${activeCharacter.id}/description`}
                  />
                  <StoryMediaList
                    media={activeCharacter.media}
                    directory={`games/story/investigation/characters/${activeCharacter.id}/media`}
                  />
                </div>
              ) : null}
              <div className="mt-3 grid gap-2">
                {characterInteractions.length > 0 ? characterInteractions.map((interaction) => (
                  <button key={interaction.id} type="button" disabled={isMutating} onClick={() => void handleInteraction(interaction.id)} className="rounded-2xl border border-slate-300 p-3 text-left transition hover:border-violet-400 dark:border-slate-700">
                    <span className="font-semibold">{topicsById.get(interaction.topicId)?.title || interaction.label}</span>
                    {interaction.label && topicsById.get(interaction.topicId)?.title !== interaction.label ? <span className="mt-1 block text-sm text-slate-500">{interaction.label}</span> : null}
                    <span className="mt-1 block text-xs font-semibold text-violet-600 dark:text-violet-300">+{interaction.timeCostMinutes} мин.</span>
                  </button>
                )) : <p className="text-sm text-slate-500">Для этого персонажа пока нет доступных тем.</p>}
              </div>
            </article>
          ) : null}

          {examinations.length > 0 ? (
            <article className="rounded-3xl bg-white p-5 shadow-lg dark:bg-slate-900">
              <h3 className="text-lg font-bold">Осмотры и анализы</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {examinations.map((interaction) => (
                  <button key={interaction.id} type="button" disabled={isMutating} onClick={() => void handleInteraction(interaction.id)} className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-left dark:border-amber-500/30 dark:bg-amber-500/10">
                    <span className="font-semibold">{interaction.label}</span>
                    <span className="mt-1 block text-xs font-semibold">+{interaction.timeCostMinutes} мин.</span>
                  </button>
                ))}
              </div>
            </article>
          ) : null}

          {lastResponse ? (
            <article className="rounded-3xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <h3 className="text-lg font-bold">Последний ответ</h3>
              <RichTaskContentView html={lastResponse.responseRich} text="" className="mt-3" directory="games/story/investigation/response" />
              <StoryMediaList media={lastResponse.media} directory="response" />
            </article>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-3xl bg-white p-5 shadow-lg dark:bg-slate-900">
              <h3 className="text-lg font-bold">Журнал</h3>
              <div className="mt-3 max-h-[32rem] space-y-3 overflow-y-auto">
                {(investigation?.journal || []).length > 0 ? [...investigation.journal].reverse().map((entry) => (
                  <details key={entry.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                    <summary className="cursor-pointer font-semibold">{entry.title || 'Запись'} · {entry.discoveredAtMinute} мин.</summary>
                    <RichTaskContentView html={entry.summaryRich || ''} text="" className="mt-2 text-sm" directory={`games/story/investigation/journal/${entry.id}`} />
                    <StoryMediaList media={entry.media} directory={entry.id} />
                  </details>
                )) : <p className="text-sm text-slate-500">Новые записи появятся после действий команды.</p>}
              </div>
            </article>
            <article className="rounded-3xl bg-white p-5 shadow-lg dark:bg-slate-900">
              <h3 className="text-lg font-bold">Доска доказательств</h3>
              <div className="mt-3 space-y-2">
                {evidence.length > 0 ? evidence.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-cyan-200 p-3 dark:border-cyan-500/30">
                    <p className="font-semibold">{item.title}</p>
                    <RichTaskContentView html={item.descriptionRich || ''} text="" className="mt-1 text-sm" directory={`games/story/investigation/evidence/${item.id}`} />
                  </div>
                )) : <p className="text-sm text-slate-500">Доказательства ещё не найдены.</p>}
              </div>
            </article>
          </div>

          {accusation?.available ? (
            <div className="rounded-2xl border border-rose-300 bg-rose-50 p-3 dark:border-rose-500/30 dark:bg-rose-500/10">
              <button type="button" onClick={handleOpenAccusation} className="w-full rounded-2xl bg-rose-600 px-5 py-4 text-lg font-bold text-white shadow-lg hover:bg-rose-700">Предъявить обвинение</button>
              {accusationRequiredNodeTitle ? (
                <p className="mt-2 text-center text-sm font-semibold text-rose-800 dark:text-rose-200">
                  Обвинение можно предъявить только в локации «{accusationRequiredNodeTitle}».
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {isAccusationOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-3 sm:p-8">
          <div className="mx-auto min-h-full max-w-2xl rounded-3xl bg-white p-5 text-slate-950 shadow-2xl dark:bg-slate-900 dark:text-white">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-2xl font-bold">Финальное обвинение</h3>
              <button type="button" onClick={() => setIsAccusationOpen(false)} className="rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700">Закрыть</button>
            </div>
            <label className="mt-5 block text-sm font-semibold">Подозреваемый
              <select value={culpritId} onChange={(event) => setCulpritId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-transparent p-3 dark:border-slate-700">
                <option value="">Выберите подозреваемого</option>
                {(investigation?.accusation?.culpritOptions || []).map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
              </select>
            </label>
            <label className="mt-4 block text-sm font-semibold">Мотив
              <select value={motiveId} onChange={(event) => setMotiveId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-transparent p-3 dark:border-slate-700">
                <option value="">Выберите мотив</option>
                {(investigation?.accusation?.motiveOptions || []).map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
              </select>
            </label>
            <fieldset className="mt-5">
              <legend className="font-semibold">Доказательства ({selectedEvidenceIds.length}/{investigation?.accusation?.maxSelectableEvidence})</legend>
              <div className="mt-2 space-y-2">
                {evidence.map((item) => (
                  <label key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-300 p-3 dark:border-slate-700">
                    <input type="checkbox" checked={selectedEvidenceIds.includes(item.id)} disabled={!selectedEvidenceIds.includes(item.id) && selectedEvidenceIds.length >= investigation?.accusation?.maxSelectableEvidence} onChange={() => toggleEvidence(item.id)} className="mt-1" />
                    <span>{item.title}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button type="button" disabled={isMutating} onClick={() => void handleAccusation()} className="mt-6 w-full rounded-xl bg-rose-600 px-4 py-3 font-bold text-white disabled:opacity-60">Отправить версию</button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

StoryInvestigationProcess.propTypes = {
  gameId: PropTypes.string.isRequired,
  teamId: PropTypes.string.isRequired,
  testRunId: PropTypes.string,
  isActive: PropTypes.bool,
}

StoryInvestigationProcess.defaultProps = { isActive: true, testRunId: '' }

export default StoryInvestigationProcess
