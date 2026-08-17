'use client'

import PropTypes from 'prop-types'
import { useState } from 'react'

import Modal from '@components/Modal'

const formatScore = (value) =>
  Number.isFinite(value) ? value.toFixed(2).replace('.', ',') : '—'

const ratingDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const formatRatingDate = (value) => {
  if (!value) return 'Дата не указана'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Дата не указана'
    : ratingDateFormatter.format(date)
}

const RatingBreakdownModal = ({ item, type, initialPeriodId, onClose }) => {
  const [selectedPeriodId, setSelectedPeriodId] = useState(initialPeriodId)
  const periods = item?.ratingPeriods?.length
    ? item.ratingPeriods
    : item
      ? [{ id: 'all', name: 'За всё время', rating: item.rating }]
      : []
  const selectedPeriod =
    periods.find((period) => period.id === selectedPeriodId) || periods[0]
  const rating = selectedPeriod?.rating || item?.rating
  const breakdown = rating?.breakdown || []
  const isTeam = type === 'teams'
  const entityLabel = isTeam ? 'команды' : 'игрока'

  return (
    <Modal
      isOpen={Boolean(item)}
      title={
        item
          ? `Рейтинг ${entityLabel} «${item.name}»`
          : `Рейтинг ${entityLabel}`
      }
      onClose={onClose}
      dialogClassName="md:max-w-3xl"
    >
      {item ? (
        <div className="space-y-5">
          <div>
            <label
              htmlFor="rating-breakdown-period"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300"
            >
              Период рейтинга
            </label>
            <select
              id="rating-breakdown-period"
              value={selectedPeriod?.id || 'all'}
              onChange={(event) => setSelectedPeriodId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-100 p-3 dark:bg-white/5">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Место
              </p>
              <p className="mt-1 font-bold text-slate-900 dark:text-white">
                {Number.isFinite(rating.rank) ? `#${rating.rank}` : '—'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-100 p-3 dark:bg-white/5">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Средний балл
              </p>
              <p className="mt-1 font-bold text-slate-900 dark:text-white">
                {formatScore(rating.finalScore)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-100 p-3 dark:bg-white/5">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Игры
              </p>
              <p className="mt-1 font-bold text-slate-900 dark:text-white">
                {rating.playedGames}
              </p>
            </div>
            <div className="rounded-xl bg-slate-100 p-3 dark:bg-white/5">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Победы
              </p>
              <p className="mt-1 font-bold text-slate-900 dark:text-white">
                {rating.wins}
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Результаты игр
            </h3>
            {breakdown.length ? (
              <ol className="mt-3 space-y-2">
                {breakdown.map((game) => (
                  <li
                    key={game.gameId}
                    className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center dark:border-white/10"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {game.gameName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {formatRatingDate(game.dateStart)} · {game.place}-е место
                        из {game.participantsCount}
                      </p>
                      {!isTeam && game.teamName ? (
                        <p className="mt-1 text-xs text-cyan-700 dark:text-cyan-300">
                          Команда: {game.teamName}
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-lg bg-cyan-50 px-3 py-2 text-right dark:bg-cyan-500/10">
                      <p className="text-[10px] uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                        Очки
                      </p>
                      <p className="font-bold text-cyan-900 dark:text-cyan-100">
                        {formatScore(game.score)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
                В выбранном периоде нет рейтинговых игр {entityLabel}.
              </p>
            )}
          </div>

          <div className="rounded-xl bg-cyan-50 p-4 text-xs leading-5 text-cyan-900 dark:bg-cyan-500/10 dark:text-cyan-100">
            {isTeam
              ? 'За первое место начисляется 100 очков, за последнее — 0.'
              : 'Игрок получает очки за место своей команды: первое место даёт 100 очков, последнее — 0.'}{' '}
            Балл за остальные места зависит от количества команд. Итоговый
            рейтинг — среднее арифметическое очков за показанные игры. Победа
            означает первое место.
          </div>
        </div>
      ) : null}
    </Modal>
  )
}

RatingBreakdownModal.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    rating: PropTypes.shape({
      rank: PropTypes.number,
      finalScore: PropTypes.number,
      playedGames: PropTypes.number.isRequired,
      wins: PropTypes.number,
      breakdown: PropTypes.arrayOf(
        PropTypes.shape({
          gameId: PropTypes.string.isRequired,
          gameName: PropTypes.string.isRequired,
          dateStart: PropTypes.string,
          place: PropTypes.number.isRequired,
          participantsCount: PropTypes.number.isRequired,
          score: PropTypes.number.isRequired,
          teamName: PropTypes.string,
          seasonId: PropTypes.string,
        }),
      ),
    }).isRequired,
    ratingPeriods: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        rating: PropTypes.object.isRequired,
      }),
    ),
  }),
  type: PropTypes.oneOf(['teams', 'players']).isRequired,
  initialPeriodId: PropTypes.string,
  onClose: PropTypes.func.isRequired,
}

RatingBreakdownModal.defaultProps = {
  item: null,
  initialPeriodId: 'all',
}

export default RatingBreakdownModal
