import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import Head from 'next/head'
import { useSession } from 'next-auth/react'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import getSessionSafe from '@helpers/getSessionSafe'
import formatDate from '@helpers/formatDate'
import formatDateTime from '@helpers/formatDateTime'
import formatRelativeTimeFromNow from '@helpers/formatRelativeTimeFromNow'
import getGameStatusLabel from '@helpers/getGameStatusLabel'
import normalizeGameForCabinet from '@helpers/normalizeGameForCabinet'
import { getNounBonusTasks, getNounTasks, getNounTeams } from '@helpers/getNoun'
import dbConnect from '@utils/dbConnect'

const GAME_STATUS_OPTIONS = ['active', 'started', 'finished', 'canceled'].map((value) => ({
  value,
  label: getGameStatusLabel(value),
}))

const GAME_TYPE_OPTIONS = [
  { value: 'classic', label: 'Классика' },
  { value: 'photo', label: 'Фотоквест' },
]

const CLUE_EARLY_MODE_OPTIONS = [
  { value: 'time', label: 'Добавить время до следующей подсказки' },
  { value: 'penalty', label: 'Штраф организатора за подсказку' },
]

const toMinutes = (seconds) => {
  const numeric = Number(seconds)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0
  }
  return Math.round(numeric / 60)
}

const toSeconds = (minutes) => {
  const numeric = Number(minutes)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0
  }
  return Math.round(numeric * 60)
}

const createPrice = () => ({
  id: `price-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name: '',
  price: 0,
})

const createFinanceEntry = () => {
  const now = new Date()
  return {
    id: `finance-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'income',
    sum: 0,
    date: now.toISOString(),
    description: '',
  }
}

const serializeGameForComparison = (game) => {
  if (!game) {
    return null
  }

  const {
    id,
    teamsCount,
    tasksStats,
    updatedAt,
    createdAt,
    dateStartFact,
    dateEndFact,
    ...rest
  } = game

  const normalizeArray = (array) =>
    (Array.isArray(array) ? array : [])
      .map((item) => ({ ...item }))
      .sort((a, b) => (a.id || '').localeCompare(b.id || ''))

  return JSON.stringify({
    ...rest,
    prices: normalizeArray(rest.prices),
    finances: normalizeArray(rest.finances),
  })
}

const buildUpdatePayload = (game) => {
  const prices = (game.prices ?? []).map((price) => ({
    id: price.id,
    name: price.name,
    price: Number(price.price) || 0,
  }))

  const finances = (game.finances ?? []).map((entry) => ({
    id: entry.id,
    type: entry.type === 'expense' ? 'expense' : 'income',
    sum: Number(entry.sum) || 0,
    date: entry.date ? new Date(entry.date).toISOString() : null,
    description: entry.description,
  }))

  const manyCodesPenalty = Array.isArray(game.manyCodesPenalty)
    ? [Number(game.manyCodesPenalty[0]) || 0, Number(game.manyCodesPenalty[1]) || 0]
    : [0, 0]

  return {
    name: game.name,
    status: game.status,
    dateStart: game.dateStart ? new Date(game.dateStart).toISOString() : null,
    type: game.type,
    description: game.description,
    image: game.image ? game.image : null,
    startingPlace: game.startingPlace ?? '',
    finishingPlace: game.finishingPlace ?? '',
    taskDuration: Number(game.taskDuration) || 0,
    cluesDuration: Number(game.cluesDuration) || 0,
    clueEarlyAccessMode: game.clueEarlyAccessMode,
    clueEarlyPenalty: Number(game.clueEarlyPenalty) || 0,
    allowCaptainForceClue: Boolean(game.allowCaptainForceClue),
    allowCaptainFailTask: Boolean(game.allowCaptainFailTask),
    allowCaptainFinishBreak: Boolean(game.allowCaptainFinishBreak),
    breakDuration: Number(game.breakDuration) || 0,
    taskFailurePenalty: Number(game.taskFailurePenalty) || 0,
    manyCodesPenalty,
    individualStart: Boolean(game.individualStart),
    hidden: Boolean(game.hidden),
    showCreator: Boolean(game.showCreator),
    showTasks: Boolean(game.showTasks),
    hideResult: Boolean(game.hideResult),
    prices,
    finances,
  }
}

const GamesPage = ({ initialGames, initialLocation, session: initialSession }) => {
  const { data: session } = useSession()
  const activeSession = session ?? initialSession ?? null
  const location = activeSession?.user?.location ?? initialLocation ?? null
  const userRole = activeSession?.user?.role ?? 'client'
  const currentUserTelegramId = activeSession?.user?.telegramId ?? null
  const currentUserIdString =
    currentUserTelegramId === null || currentUserTelegramId === undefined
      ? null
      : String(currentUserTelegramId)

  const [games, setGames] = useState(initialGames)
  const [persistedGames, setPersistedGames] = useState(initialGames)
  const [selectedGameId, setSelectedGameId] = useState(initialGames[0]?.id ?? null)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    setGames(initialGames)
    setPersistedGames(initialGames)
    setSelectedGameId((prev) => {
      if (prev && initialGames.some((game) => game.id === prev)) {
        return prev
      }
      return initialGames[0]?.id ?? null
    })
  }, [initialGames])

  useEffect(() => {
    setFeedback(null)
  }, [selectedGameId])

  const numberFormatter = useMemo(() => new Intl.NumberFormat('ru-RU'), [])
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        maximumFractionDigits: 0,
      }),
    []
  )

  const selectedGame = useMemo(
    () => games.find((game) => game.id === selectedGameId) ?? null,
    [games, selectedGameId]
  )

  const persistedSelectedGame = useMemo(
    () => persistedGames.find((game) => game.id === selectedGameId) ?? null,
    [persistedGames, selectedGameId]
  )

  const isDirty = useMemo(() => {
    if (!selectedGame || !persistedSelectedGame) {
      return false
    }

    return (
      serializeGameForComparison(selectedGame) !==
      serializeGameForComparison(persistedSelectedGame)
    )
  }, [persistedSelectedGame, selectedGame])

  const canEditAllGames = userRole === 'admin' || userRole === 'dev'
  const canEditOwnGames = userRole === 'moder'

  const canEditSelectedGame = useMemo(() => {
    if (!selectedGame) {
      return false
    }

    if (canEditAllGames) {
      return true
    }

    if (canEditOwnGames) {
      if (!currentUserIdString) {
        return false
      }

      const creatorId = selectedGame.creatorTelegramId
      if (!creatorId) {
        return false
      }

      return creatorId === currentUserIdString
    }

    return false
  }, [canEditAllGames, canEditOwnGames, currentUserIdString, selectedGame])

  const editRestrictionMessage = useMemo(() => {
    if (!selectedGame || canEditSelectedGame) {
      return null
    }

    if (canEditOwnGames) {
      const creatorId = selectedGame?.creatorTelegramId ?? ''
      if (currentUserIdString && creatorId && creatorId !== currentUserIdString) {
        return 'Эта игра создана другим организатором. Модераторы могут редактировать только собственные игры.'
      }
    }

    return 'Недостаточно прав для редактирования игры. Обратитесь к администратору.'
  }, [canEditOwnGames, canEditSelectedGame, currentUserIdString, selectedGame])

  const updateSelectedGame = useCallback(
    (updater) => {
      if (!selectedGameId || !canEditSelectedGame) return

      setGames((prevGames) =>
        prevGames.map((game) => {
          if (game.id !== selectedGameId) {
            return game
          }

          const patch = typeof updater === 'function' ? updater(game) : updater
          return { ...game, ...patch }
        })
      )
    },
    [canEditSelectedGame, selectedGameId]
  )

  const handleResetChanges = useCallback(() => {
    if (!selectedGameId) return

    setGames((prevGames) =>
      prevGames.map((game) => {
        if (game.id !== selectedGameId) {
          return game
        }

        const original = persistedGames.find((item) => item.id === selectedGameId)
        return original ? { ...original } : game
      })
    )
    setFeedback(null)
  }, [persistedGames, selectedGameId])

  const handleSaveChanges = useCallback(async () => {
    if (!selectedGame || !location || !canEditSelectedGame) return

    setIsSaving(true)
    setFeedback(null)

    try {
      const response = await fetch(`/api/${location}/games/${selectedGame.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: buildUpdatePayload(selectedGame) }),
      })

      const json = await response.json()

      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || 'Не удалось сохранить игру')
      }

      const normalizedGame = normalizeGameForCabinet({
        ...json.data,
        teamsCount: selectedGame.teamsCount,
      })

      setGames((prevGames) =>
        prevGames.map((game) => (game.id === normalizedGame.id ? normalizedGame : game))
      )
      setPersistedGames((prevGames) =>
        prevGames.map((game) => (game.id === normalizedGame.id ? normalizedGame : game))
      )
      setFeedback({ type: 'success', message: 'Изменения сохранены' })
    } catch (error) {
      console.error('Failed to update game', error)
      setFeedback({
        type: 'error',
        message: error?.message || 'Не удалось сохранить игру',
      })
    } finally {
      setIsSaving(false)
    }
  }, [canEditSelectedGame, location, selectedGame])

  const handleAddPrice = useCallback(() => {
    if (!canEditSelectedGame) return
    updateSelectedGame((game) => ({
      prices: [...(game.prices ?? []), createPrice()],
    }))
  }, [canEditSelectedGame, updateSelectedGame])

  const handlePriceChange = useCallback(
    (priceId, field, value) => {
      if (!canEditSelectedGame) return
      updateSelectedGame((game) => ({
        prices: (game.prices ?? []).map((price) =>
          price.id === priceId
            ? {
                ...price,
                [field]: field === 'price' ? Math.max(0, Number(value) || 0) : value,
              }
            : price
        ),
      }))
    },
    [canEditSelectedGame, updateSelectedGame]
  )

  const handleRemovePrice = useCallback(
    (priceId) => {
      if (!canEditSelectedGame) return
      updateSelectedGame((game) => ({
        prices: (game.prices ?? []).filter((price) => price.id !== priceId),
      }))
    },
    [canEditSelectedGame, updateSelectedGame]
  )

  const handleAddFinance = useCallback(() => {
    if (!canEditSelectedGame) return
    updateSelectedGame((game) => ({
      finances: [...(game.finances ?? []), createFinanceEntry()],
    }))
  }, [canEditSelectedGame, updateSelectedGame])

  const handleFinanceChange = useCallback(
    (financeId, field, value) => {
      if (!canEditSelectedGame) return
      updateSelectedGame((game) => ({
        finances: (game.finances ?? []).map((entry) => {
          if (entry.id !== financeId) {
            return entry
          }

          if (field === 'sum') {
            return { ...entry, sum: Math.max(0, Number(value) || 0) }
          }

          if (field === 'date') {
            return { ...entry, date: value ? new Date(value).toISOString() : null }
          }

          if (field === 'type') {
            return { ...entry, type: value === 'expense' ? 'expense' : 'income' }
          }

        return { ...entry, [field]: value }
      }),
    }))
  },
    [canEditSelectedGame, updateSelectedGame]
  )

  const handleRemoveFinance = useCallback(
    (financeId) => {
      if (!canEditSelectedGame) return
      updateSelectedGame((game) => ({
        finances: (game.finances ?? []).filter((entry) => entry.id !== financeId),
      }))
    },
    [canEditSelectedGame, updateSelectedGame]
  )

  const tasksSummary = useMemo(() => {
    if (!selectedGame?.tasksStats) {
      return null
    }

    const { total, bonus, canceled } = selectedGame.tasksStats
    return {
      total,
      bonus,
      canceled,
      totalLabel: getNounTasks(total),
      bonusLabel: bonus > 0 ? getNounBonusTasks(bonus) : null,
      canceledLabel: canceled > 0 ? `${canceled} отменено` : null,
    }
  }, [selectedGame])

  const financesSummary = useMemo(() => {
    if (!selectedGame?.finances) {
      return { income: 0, expense: 0, balance: 0 }
    }

    const { income, expense } = selectedGame.finances.reduce(
      (acc, entry) => {
        if (entry.type === 'expense') {
          acc.expense += Number(entry.sum) || 0
        } else {
          acc.income += Number(entry.sum) || 0
        }
        return acc
      },
      { income: 0, expense: 0 }
    )

    return { income, expense, balance: income - expense }
  }, [selectedGame])

  const balanceClass = financesSummary.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'
  return (
    <>
      <Head>
        <title>ActQuest — Игры</title>
      </Head>
      <CabinetLayout
        title="Игры"
        description="Редактируйте сценарии, управляйте статусами и готовьте квесты к запуску."
        activePage="games"
      >
        <section className="grid gap-6 md:grid-cols-5">
          <div className="md:col-span-2 space-y-4">
            <div className="p-4 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
              <p className="text-sm font-semibold text-primary">Ваши игры</p>
              <p className="mt-1 text-xs text-slate-500">
                Выберите игру для редактирования основных настроек и финансовой информации.
              </p>
            </div>

            {games.length > 0 ? (
              <ul className="space-y-3">
                {games.map((game) => {
                  const startDateLabel = game.dateStart
                    ? new Date(game.dateStart).toLocaleString('ru-RU', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })
                    : 'Дата не задана'

                  const relativeUpdatedAt = game.updatedAt
                    ? formatRelativeTimeFromNow(game.updatedAt)
                    : '—'

                  return (
                    <li key={game.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedGameId(game.id)}
                        className={`w-full text-left p-4 border rounded-2xl transition hover:border-primary hover:bg-blue-50 dark:hover:bg-violet-500/10 ${
                          selectedGameId === game.id
                            ? 'border-primary bg-blue-50 shadow-sm dark:border-violet-400 dark:bg-violet-500/20'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80'
                        }`}
                      >
                        <p className="text-sm font-semibold text-primary">
                          {game.name || 'Без названия'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {getGameStatusLabel(game.status)} · {startDateLabel}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {getNounTeams(game.teamsCount)} · Обновлено {relativeUpdatedAt}
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="p-6 text-sm text-center text-slate-500 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
                Для выбранного города пока нет игр. Создайте сценарий в телеграм-боте, чтобы он появился здесь.
              </div>
            )}
          </div>

          <div className="md:col-span-3">
            {selectedGame ? (
              <div className="space-y-6">
                <div className="p-5 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="px-2.5 py-1 text-xs font-semibold text-primary bg-blue-50 rounded-full dark:bg-violet-500/20 dark:text-violet-100">
                      {getGameStatusLabel(selectedGame.status)}
                    </span>
                    <span className="text-xs text-slate-500">
                      Команд: {numberFormatter.format(selectedGame.teamsCount ?? 0)}
                    </span>
                    {selectedGame.updatedAt && (
                      <span className="text-xs text-slate-500">
                        Обновлено {formatRelativeTimeFromNow(selectedGame.updatedAt)}
                      </span>
                    )}
                  </div>
                  {tasksSummary && (
                    <p className="mt-3 text-sm text-slate-600">
                      {tasksSummary.totalLabel}
                      {tasksSummary.bonusLabel ? ` · ${tasksSummary.bonusLabel}` : ''}
                      {tasksSummary.canceledLabel ? ` · ${tasksSummary.canceledLabel}` : ''}
                    </p>
                  )}
                </div>

                {!location && (
                  <div className="p-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl">
                    Не удалось определить площадку пользователя. Сохранение изменений недоступно.
                  </div>
                )}

                {feedback && (
                  <div
                    className={`p-4 text-sm border rounded-2xl ${
                      feedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                  >
                    {feedback.message}
                  </div>
                )}

                {editRestrictionMessage && (
                  <div className="p-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl">
                    {editRestrictionMessage}
                  </div>
                )}

                <fieldset disabled={!canEditSelectedGame} className="space-y-6 border-0 p-0 m-0">
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
                      onClick={handleSaveChanges}
                      disabled={!canEditSelectedGame || !isDirty || isSaving || !location}
                      className={`inline-flex justify-center px-5 py-3 text-sm font-semibold text-white rounded-xl transition ${
                        !canEditSelectedGame || !isDirty || isSaving || !location
                          ? 'bg-slate-400 cursor-not-allowed'
                          : 'bg-primary hover:bg-blue-700'
                      }`}
                    >
                      {isSaving ? 'Сохранение…' : 'Сохранить изменения'}
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
              </div>
            ) : (
              <div className="flex items-center justify-center h-full p-6 bg-white dark:bg-slate-900/80 border border-dashed rounded-2xl border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-500">Выберите игру из списка слева, чтобы начать редактирование.</p>
              </div>
            )}
          </div>
        </section>
      </CabinetLayout>
    </>
  )
}

const priceShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string,
  price: PropTypes.number,
})

const financeShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['income', 'expense']),
  sum: PropTypes.number,
  date: PropTypes.string,
  description: PropTypes.string,
})

GamesPage.propTypes = {
  initialGames: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string,
      status: PropTypes.string,
      dateStart: PropTypes.string,
      type: PropTypes.string,
      description: PropTypes.string,
      image: PropTypes.string,
      startingPlace: PropTypes.string,
      finishingPlace: PropTypes.string,
      taskDuration: PropTypes.number,
      cluesDuration: PropTypes.number,
      clueEarlyAccessMode: PropTypes.string,
      clueEarlyPenalty: PropTypes.number,
      allowCaptainForceClue: PropTypes.bool,
      allowCaptainFailTask: PropTypes.bool,
      allowCaptainFinishBreak: PropTypes.bool,
      breakDuration: PropTypes.number,
      taskFailurePenalty: PropTypes.number,
      manyCodesPenalty: PropTypes.arrayOf(PropTypes.number),
      individualStart: PropTypes.bool,
      hidden: PropTypes.bool,
      showCreator: PropTypes.bool,
      showTasks: PropTypes.bool,
      hideResult: PropTypes.bool,
      prices: PropTypes.arrayOf(priceShape),
      finances: PropTypes.arrayOf(financeShape),
      teamsCount: PropTypes.number,
      tasksStats: PropTypes.shape({
        total: PropTypes.number,
        bonus: PropTypes.number,
        canceled: PropTypes.number,
      }),
      updatedAt: PropTypes.string,
      createdAt: PropTypes.string,
    })
  ),
  initialLocation: PropTypes.string,
  session: PropTypes.object,
}

GamesPage.defaultProps = {
  initialGames: [],
  initialLocation: null,
  session: null,
}

export async function getServerSideProps(context) {
  const session = await getSessionSafe(context)

  if (!session) {
    const callbackTarget = context.resolvedUrl || '/cabinet/games'
    return {
      redirect: {
        destination: `/cabinet/login?callbackUrl=${encodeURIComponent(callbackTarget)}`,
        permanent: false,
      },
    }
  }

  const location = session?.user?.location ?? null
  const userRole = session?.user?.role ?? 'client'
  const rawTelegramId = session?.user?.telegramId
  const numericTelegramId =
    rawTelegramId === null || rawTelegramId === undefined
      ? null
      : Number(rawTelegramId)
  const creatorTelegramId = Number.isFinite(numericTelegramId)
    ? numericTelegramId
    : null
  let initialGames = []

  if (location) {
    try {
      const db = await dbConnect(location)

      if (db) {
        const GamesModel = db.model('Games')
        const GamesTeamsModel = db.model('GamesTeams')

        const canLoadAllGames = userRole === 'admin' || userRole === 'dev'
        const canLoadOwnGames = userRole === 'moder' && creatorTelegramId !== null

        if (canLoadAllGames || canLoadOwnGames) {
          const query = canLoadAllGames ? {} : { creatorTelegramId }

          const gamesDocs = await GamesModel.find(query)
            .sort({ updatedAt: -1 })
            .select({
              _id: 1,
              name: 1,
              status: 1,
              dateStart: 1,
              dateStartFact: 1,
              dateEndFact: 1,
              type: 1,
              description: 1,
              image: 1,
              startingPlace: 1,
              finishingPlace: 1,
              taskDuration: 1,
              cluesDuration: 1,
              clueEarlyAccessMode: 1,
              clueEarlyPenalty: 1,
              allowCaptainForceClue: 1,
              allowCaptainFailTask: 1,
              allowCaptainFinishBreak: 1,
              breakDuration: 1,
              taskFailurePenalty: 1,
              manyCodesPenalty: 1,
              individualStart: 1,
              hidden: 1,
              showCreator: 1,
              showTasks: 1,
              hideResult: 1,
              prices: 1,
              finances: 1,
              tasks: 1,
              updatedAt: 1,
              createdAt: 1,
              creatorTelegramId: 1,
            })
            .lean()

          const gameIds = gamesDocs
            .map((game) => (game?._id ? game._id.toString() : null))
            .filter(Boolean)

          let teamsCountMap = {}

          if (gameIds.length > 0) {
            const gamesTeams = await GamesTeamsModel.find({ gameId: { $in: gameIds } })
              .select({ gameId: 1 })
              .lean()

            teamsCountMap = gamesTeams.reduce((acc, doc) => {
              if (!doc?.gameId) {
                return acc
              }

              const key = doc.gameId
              acc[key] = (acc[key] ?? 0) + 1
              return acc
            }, {})
          }

          initialGames = gamesDocs.map((game) =>
            normalizeGameForCabinet({
              ...game,
              teamsCount: game?._id ? teamsCountMap[game._id.toString()] ?? 0 : 0,
            })
          )
        }
      }
    } catch (error) {
      console.error('Failed to load games for cabinet', error)
    }
  }

  return {
    props: {
      session,
      initialGames,
      initialLocation: location,
    },
  }
}

export default GamesPage
