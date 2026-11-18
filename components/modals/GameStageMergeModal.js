import { useState } from 'react'
import PropTypes from 'prop-types'
import { useInfiniteQuery, useMutation } from '@tanstack/react-query'

import Modal from '@components/Modal'
import CabinetInputField from '@components/cabinet/CabinetInputField'
import NoticeBanner from '@components/NoticeBanner'
import extractErrorMessage from '@helpers/extractErrorMessage'
import formatDateInLocationTimeZone from '@helpers/formatDateInLocationTimeZone'
import requestApiJson from '@helpers/requestApiJson'
import secondsToTimeStr from '@helpers/secondsToTimeStr'

const PAGE_SIZE = 50
const scoreFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })

const formatTaskDifference = ({ kind, referenceTitle, title }) => {
  if (kind === 'added') return `добавлено «${title || 'Без названия'}»`
  if (kind === 'removed') return `отсутствует «${referenceTitle || 'Без названия'}»`
  if (referenceTitle && title && referenceTitle !== title) {
    return `изменено с «${referenceTitle}» на «${title}»`
  }
  return `изменено «${title || referenceTitle || 'Без названия'}»`
}

const submitStage = async (gameIds, preview) => {
  const { json } = await requestApiJson('/api/cabinet/game-stages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameIds, preview }),
    fallbackMessage: preview
      ? 'Не удалось рассчитать общий результат'
      : 'Не удалось объединить проведения',
  })
  return json.data
}

const GameStageMergeModal = ({ initialLocation, locations, onClose, onMerged }) => {
  const [location, setLocation] = useState(initialLocation)
  const [search, setSearch] = useState('')
  const [selectedGames, setSelectedGames] = useState([])
  const gamesQuery = useInfiniteQuery({
    queryKey: ['cabinet-game-stage-merge', location],
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const params = new URLSearchParams({
        view: 'past',
        offset: String(pageParam),
        limit: String(PAGE_SIZE),
        location,
      })
      const { json } = await requestApiJson(`/api/cabinet/games-list?${params}`, {
        signal,
        fallbackMessage: 'Не удалось загрузить завершённые игры',
      })
      const games = Array.isArray(json?.data) ? json.data : []
      return {
        games,
        nextOffset:
          json?.meta?.hasMore && games.length ? pageParam + games.length : undefined,
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  })

  const previewMutation = useMutation({
    mutationFn: (gameIds) => submitStage(gameIds, true),
  })
  const mergeMutation = useMutation({
    mutationFn: (gameIds) => submitStage(gameIds, false),
    onSuccess: onMerged,
  })

  const preview = previewMutation.data
  const taskDifferences = preview?.taskDifferences ?? []
  const isRated = selectedGames[0]?.isRated !== false
  const isBusy = previewMutation.isPending || mergeMutation.isPending
  const error = mergeMutation.error || previewMutation.error
  const gameIds = selectedGames.map((game) => game.id)
  const dateLabels = new Map(
    selectedGames.map((game) => [game.id, game.dateLabel]),
  )
  const getPreviewDateLabel = (gameId, dateStart) =>
    formatDateInLocationTimeZone(dateStart, selectedGames[0]?.location, {
      dateStyle: 'short',
      timeStyle: 'short',
    }) || dateLabels.get(gameId) || 'Дата не указана'
  const searchKey = search.trim().toLocaleLowerCase('ru-RU')
  const visibleGames =
    gamesQuery.data?.pages.flatMap(({ games }) =>
      games.flatMap((game) => {
        if (game.status !== 'closed' || game.type !== 'classic' || game.stageId) {
          return []
        }
        const dateLabel =
          formatDateInLocationTimeZone(
            game.dateStartFact || game.dateStart,
            game.location,
            { dateStyle: 'short', timeStyle: 'short' },
          ) || 'Дата не указана'
        const searchable = `${game.name} ${dateLabel} ${game.id}`.toLocaleLowerCase('ru-RU')
        return searchable.includes(searchKey) ? [{ ...game, dateLabel }] : []
      }),
    ) ?? []

  const handleToggleGame = (game) => {
    previewMutation.reset()
    setSelectedGames((previous) =>
      previous.some(({ id }) => id === game.id)
        ? previous.filter(({ id }) => id !== game.id)
        : [...previous, game],
    )
  }

  const handleBack = () => {
    previewMutation.reset()
    mergeMutation.reset()
  }

  return (
    <Modal
      isOpen
      title="Объединить проведения"
      onClose={isBusy ? undefined : onClose}
      footer={
        <>
          <button
            type="button"
            className="aq-modal-btn aq-modal-btn-secondary"
            onClick={preview ? handleBack : onClose}
            disabled={isBusy}
          >
            {preview ? 'Назад к выбору игр' : 'Отмена'}
          </button>
          <button
            type="button"
            className="aq-modal-btn aq-modal-btn-primary"
            onClick={() =>
              preview
                ? mergeMutation.mutate(gameIds)
                : previewMutation.mutate(gameIds)
            }
            disabled={isBusy || gameIds.length < 2}
          >
            {preview
              ? mergeMutation.isPending
                ? 'Публикуем…'
                : 'Объединить и опубликовать'
              : previewMutation.isPending
                ? 'Рассчитываем…'
                : 'Предпросмотр результата'}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        {preview ? (
          <>
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {preview.name}
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              {isRated
                ? 'После публикации эти проведения войдут в рейтинг как один этап. Проверьте общие места и очки.'
                : 'После публикации участники увидят общую таблицу. Проверьте места и итоговое время.'}
            </p>
            {taskDifferences.length > 0 ? (
              <NoticeBanner tone="warning">
                <p className="font-semibold">Есть отличия в заданиях</p>
                <p className="mt-1">
                  Проверьте отличия перед публикацией общего результата.
                </p>
                <ul className="mt-3 space-y-3">
                  {taskDifferences.map((difference) => (
                    <li key={difference.gameId} className="break-words">
                      <p className="font-semibold">
                        {difference.gameName} ({getPreviewDateLabel(
                          difference.gameId,
                          difference.dateStart,
                        )})
                      </p>
                      <p className="text-xs">
                        Сравнение с «{difference.referenceGameName}» ({getPreviewDateLabel(
                          difference.referenceGameId,
                          difference.referenceDateStart,
                        )})
                      </p>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {difference.tasks.map((task) => (
                          <li key={task.number}>
                            Задание {task.number} — {formatTaskDifference(task)}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </NoticeBanner>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-left">
                <caption className="sr-only">Предпросмотр общего результата</caption>
                <thead className="border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-2 py-2" scope="col">Место</th>
                    <th className="px-2 py-2" scope="col">Участник</th>
                    <th className="px-2 py-2" scope="col">Проведение</th>
                    <th className="px-2 py-2" scope="col">Итоговое время</th>
                    {isRated ? (
                      <th className="px-2 py-2" scope="col">Очки</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {preview.teams.map((row) => (
                    <tr key={`${row.sourceGameId}-${row.teamId}`}>
                      <td className="px-2 py-2">
                        {row.outOfCompetition ? 'Вне зачёта' : row.place ?? '—'}
                      </td>
                      <td className="px-2 py-2">{row.teamName}</td>
                      <td className="px-2 py-2">{dateLabels.get(row.sourceGameId) || '—'}</td>
                      <td className="px-2 py-2">
                        {Number.isFinite(row.finalSeconds)
                          ? `${row.finalSeconds < 0 ? '−' : ''}${secondsToTimeStr(
                              Math.round(Math.abs(row.finalSeconds)),
                              true,
                            )}`
                          : '—'}
                      </td>
                      {isRated ? (
                        <td className="px-2 py-2">
                          {Number.isFinite(row.score) ? scoreFormat.format(row.score) : '—'}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <p className="text-slate-600 dark:text-slate-300">
              Выберите закрытые классические игры с одинаковыми правилами зачёта.
              Отличия в заданиях будут видны в предпросмотре.
            </p>
            <fieldset disabled={isBusy} className="space-y-3 border-0 p-0">
              <label className="block space-y-1 text-slate-700 dark:text-slate-200">
                <span className="font-semibold">Город</span>
                <select
                  value={location}
                  onChange={(event) => {
                    setLocation(event.target.value)
                    setSelectedGames([])
                    previewMutation.reset()
                  }}
                  className="block w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="all">Все города</option>
                  {locations.map(({ key, label }) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </label>
              <CabinetInputField
                id="stage-merge-search"
                label="Поиск по загруженным играм"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Название, дата или ID"
              />
              <p className="text-slate-500 dark:text-slate-400" role="status">
                Выбрано {gameIds.length}
              </p>
              {gamesQuery.isError ? (
                <NoticeBanner tone="error" variant="neon">
                  {extractErrorMessage(gamesQuery.error)}
                </NoticeBanner>
              ) : null}
              {gamesQuery.isPending ? (
                <p>Загружаем игры…</p>
              ) : visibleGames.length === 0 && !gamesQuery.isError ? (
                <p>Среди загруженных игр нет совпадений.</p>
              ) : null}
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                {visibleGames.map((game) => (
                  <li key={game.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={gameIds.includes(game.id)}
                        onChange={() => handleToggleGame(game)}
                      />
                      <span>
                        <span className="block font-medium">{game.name}</span>
                        <span className="text-xs text-slate-600 dark:text-slate-300">
                          {game.dateLabel}
                          {location === 'all'
                            ? ` · ${locations.find(({ key }) => key === game.location)?.label || game.location}`
                            : ''}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {gamesQuery.hasNextPage ? (
                <button
                  type="button"
                  onClick={() => gamesQuery.fetchNextPage()}
                  disabled={gamesQuery.isFetchingNextPage}
                  className="aq-modal-btn aq-modal-btn-secondary"
                >
                  {gamesQuery.isFetchingNextPage ? 'Загружаем…' : 'Загрузить ещё игры'}
                </button>
              ) : null}
            </fieldset>
          </>
        )}
        {error ? (
          <NoticeBanner tone="error" variant="neon">
            {extractErrorMessage(error)}
          </NoticeBanner>
        ) : null}
      </div>
    </Modal>
  )
}

GameStageMergeModal.propTypes = {
  initialLocation: PropTypes.string.isRequired,
  locations: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    }),
  ).isRequired,
  onClose: PropTypes.func.isRequired,
  onMerged: PropTypes.func.isRequired,
}

export default GameStageMergeModal
