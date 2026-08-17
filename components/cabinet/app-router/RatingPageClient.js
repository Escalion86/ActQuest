'use client'

import PropTypes from 'prop-types'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

import CabinetLayout from '@components/cabinet/CabinetLayout'
import Modal from '@components/Modal'

const MIN_RATING_GAMES = 3

const formatScore = (value) =>
  Number.isFinite(value) ? value.toFixed(2).replace('.', ',') : '—'

const formatAttendance = (value) =>
  Number.isFinite(value) ? `${Math.round(value * 100)}%` : '—'

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

const RatingBreakdownModal = ({ item, onClose }) => {
  const rating = item?.rating
  const breakdown = rating?.breakdown || []

  return (
    <Modal
      isOpen={Boolean(item)}
      title={item ? `Рейтинг команды «${item.name}»` : 'Рейтинг команды'}
      onClose={onClose}
      dialogClassName="md:max-w-3xl"
    >
      {item ? (
        <div className="space-y-5">
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
                В выбранном периоде нет рейтинговых игр этой команды.
              </p>
            )}
          </div>

          <div className="rounded-xl bg-cyan-50 p-4 text-xs leading-5 text-cyan-900 dark:bg-cyan-500/10 dark:text-cyan-100">
            За первое место начисляется 100 очков, за последнее — 0. Балл за
            остальные места зависит от количества команд. Итоговый рейтинг —
            среднее арифметическое очков за показанные игры. Победа означает
            первое место.
          </div>
        </div>
      ) : null}
    </Modal>
  )
}

const RatingRow = ({ item, type, onSelect }) => {
  const rating = item.rating
  const isTeam = type === 'teams'
  const RowContainer = isTeam ? 'button' : 'div'
  const imageFallback =
    isTeam ? '/img/avatars/team.png' : '/img/avatars/user.png'

  return (
    <li
      className={`rounded-2xl border ${
        item.isCurrent
          ? 'border-cyan-400 bg-cyan-50/80 shadow-sm dark:border-cyan-500/60 dark:bg-cyan-500/10'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/80'
      }`}
    >
      <RowContainer
        type={isTeam ? 'button' : undefined}
        onClick={isTeam ? () => onSelect(item) : undefined}
        aria-haspopup={isTeam ? 'dialog' : undefined}
        className={`grid w-full gap-3 rounded-2xl p-4 text-left sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
          isTeam
            ? 'cursor-pointer transition hover:bg-cyan-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:hover:bg-cyan-500/5 dark:focus-visible:ring-offset-slate-950'
            : ''
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
            {rating.isEligible && Number.isFinite(rating.rank)
              ? `#${rating.rank}`
              : '—'}
          </div>
          <img
            src={item.image || imageFallback}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
            loading="lazy"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {item.name}
              </p>
              {item.isCurrent ? (
                <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200">
                  {isTeam ? 'Ваша команда' : 'Это вы'}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
              {rating.isEligible
                ? `${rating.wins} побед · среднее место ${formatScore(rating.averagePlace)}`
                : `До рейтинга: ${rating.playedGames} из ${MIN_RATING_GAMES} игр`}
            </p>
            {isTeam ? (
              <p className="mt-1 text-[11px] font-medium text-cyan-700 dark:text-cyan-300">
                Нажмите, чтобы увидеть расчёт
              </p>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center sm:min-w-64">
          <div className="rounded-xl bg-slate-50 px-2 py-2 dark:bg-slate-800/80">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">
              Очки
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
              {formatScore(rating.finalScore)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-2 py-2 dark:bg-slate-800/80">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">
              Игры
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
              {rating.playedGames}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-2 py-2 dark:bg-slate-800/80">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">
              Участие
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
              {formatAttendance(rating.attendance)}
            </p>
          </div>
        </div>
      </RowContainer>
    </li>
  )
}

const RatingPageClient = ({
  type,
  top,
  personal,
  cityName,
  seasons,
  selectedSeasonId,
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const [selectedTeam, setSelectedTeam] = useState(null)
  const isTeams = type === 'teams'
  const entityLabel = isTeams ? 'команд' : 'игроков'
  const selectedSeason = seasons.find(
    (season) => season.id === selectedSeasonId,
  )
  const seasonQuery = selectedSeasonId
    ? `?season=${encodeURIComponent(selectedSeasonId)}`
    : ''
  const scopeLabel = selectedSeason?.name || 'За всё время'

  const handleSeasonChange = (event) => {
    const nextSeasonId = event.target.value
    router.push(
      nextSeasonId
        ? `${pathname}?season=${encodeURIComponent(nextSeasonId)}`
        : pathname,
    )
  }

  return (
    <CabinetLayout
      title={isTeams ? 'Рейтинг команд' : 'Рейтинг игроков'}
      description={`Первые 10 ${entityLabel} города ${cityName || 'из профиля'} — ${scopeLabel.toLowerCase()}.`}
      activePage="rating"
    >
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-4 text-sm text-cyan-900 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-100">
          <p className="font-semibold">
            Город рейтинга: {cityName || 'не выбран'}
          </p>
          <p className="mt-1 text-xs text-cyan-700 dark:text-cyan-200">
            Показываем рейтинг для основного города, выбранного в вашем профиле.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <label
            htmlFor="rating-season"
            className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300"
          >
            Период рейтинга
          </label>
          <select
            id="rating-season"
            value={selectedSeasonId || ''}
            onChange={handleSeasonChange}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">За всё время</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
            В рейтинг входят только игры со статусом «Закрыта». Игры со
            статусом «Завершена» появятся после закрытия администратором.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <Link
            href={`/cabinet/rating/teams${seasonQuery}`}
            className={`rounded-xl px-4 py-3 text-center text-sm font-semibold transition ${
              isTeams
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            Команды
          </Link>
          <Link
            href={`/cabinet/rating/players${seasonQuery}`}
            className={`rounded-xl px-4 py-3 text-center text-sm font-semibold transition ${
              !isTeams
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            Игроки
          </Link>
        </div>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-cyan-600 dark:text-cyan-300">
                {scopeLabel}
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                Топ-10 {entityLabel}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-300">
              Больше очков — выше место
            </p>
          </div>
          {top.length ? (
            <ol className="space-y-2">
              {top.map((item) => (
                <RatingRow
                  key={item.id}
                  item={item}
                  type={type}
                  onSelect={setSelectedTeam}
                />
              ))}
            </ol>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
              В выбранном периоде пока нет участников с тремя рейтинговыми
              играми.
            </div>
          )}
        </section>

        {personal.length ? (
          <section className="border-t border-slate-200 pt-5 dark:border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-600 dark:text-cyan-300">
              {isTeams ? 'Ваши команды вне топ-10' : 'Ваша позиция'}
            </p>
            <ol className="mt-3 space-y-2">
              {personal.map((item) => (
                <RatingRow
                  key={item.id}
                  item={item}
                  type={type}
                  onSelect={setSelectedTeam}
                />
              ))}
            </ol>
          </section>
        ) : null}

        <details className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
          <summary className="cursor-pointer font-semibold text-slate-900 dark:text-white">
            Как сейчас считается рейтинг
          </summary>
          <div className="mt-4 space-y-2 leading-6">
            <p>
              Учитываются закрытые рейтинговые игры выбранного города и периода.
              Для попадания в таблицу нужно сыграть не менее трёх таких игр.
            </p>
            <p>
              За каждую игру начисляется от 0 до 100 очков относительно числа
              соперников: первое место всегда даёт 100, последнее — 0, середина
              таблицы — примерно 50.
            </p>
            <p>
              Рейтинг — среднее число этих очков. Пропуски не уменьшают балл и
              показываются только как участие. При равенстве выше участник с
              большим числом игр, затем побед и лучшим последним результатом.
            </p>
          </div>
        </details>
      </div>
      <RatingBreakdownModal
        item={selectedTeam}
        onClose={() => setSelectedTeam(null)}
      />
    </CabinetLayout>
  )
}

const ratingShape = PropTypes.shape({
  isEligible: PropTypes.bool.isRequired,
  rank: PropTypes.number,
  totalRanked: PropTypes.number.isRequired,
  finalScore: PropTypes.number,
  averagePlace: PropTypes.number,
  stdDevPlace: PropTypes.number,
  stdDevScore: PropTypes.number,
  attendance: PropTypes.number,
  playedGames: PropTypes.number.isRequired,
  totalGames: PropTypes.number,
  missedGames: PropTypes.number.isRequired,
  wins: PropTypes.number,
  seasonId: PropTypes.string,
  seasonName: PropTypes.string,
  updatedAt: PropTypes.string,
  breakdown: PropTypes.arrayOf(
    PropTypes.shape({
      gameId: PropTypes.string.isRequired,
      gameName: PropTypes.string.isRequired,
      dateStart: PropTypes.string,
      place: PropTypes.number.isRequired,
      participantsCount: PropTypes.number.isRequired,
      score: PropTypes.number.isRequired,
    }),
  ),
})

const itemShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  username: PropTypes.string,
  image: PropTypes.string,
  isCurrent: PropTypes.bool.isRequired,
  rating: ratingShape.isRequired,
})

RatingRow.propTypes = {
  item: itemShape.isRequired,
  type: PropTypes.oneOf(['teams', 'players']).isRequired,
  onSelect: PropTypes.func.isRequired,
}

RatingBreakdownModal.propTypes = {
  item: itemShape,
  onClose: PropTypes.func.isRequired,
}

RatingBreakdownModal.defaultProps = {
  item: null,
}

RatingPageClient.propTypes = {
  type: PropTypes.oneOf(['teams', 'players']).isRequired,
  top: PropTypes.arrayOf(itemShape).isRequired,
  personal: PropTypes.arrayOf(itemShape).isRequired,
  cityName: PropTypes.string,
  seasons: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }),
  ).isRequired,
  selectedSeasonId: PropTypes.string,
}

RatingPageClient.defaultProps = {
  cityName: null,
  selectedSeasonId: null,
}

export default RatingPageClient
