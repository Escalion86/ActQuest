import cn from 'classnames'
import PropTypes from 'prop-types'

import GamePlaceBadge from '@components/cabinet/GamePlaceBadge'
import formatDateInLocationTimeZone from '@helpers/formatDateInLocationTimeZone'

const getReviewCountLabel = (count) => {
  const normalizedCount = Number(count) || 0
  const lastTwoDigits = normalizedCount % 100
  const lastDigit = normalizedCount % 10

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${normalizedCount} оценок`
  }
  if (lastDigit === 1) return `${normalizedCount} оценка`
  if (lastDigit >= 2 && lastDigit <= 4) return `${normalizedCount} оценки`
  return `${normalizedCount} оценок`
}

const toFiniteNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null
  const normalizedValue = Number(value)
  return Number.isFinite(normalizedValue) ? normalizedValue : null
}

const PlayedGameCard = ({
  game,
  onOpen,
  className = '',
  footerText = '',
}) => {
  const Component = typeof onOpen === 'function' ? 'button' : 'div'
  const gameName = game.gameName || game.name || 'Без названия'
  const teamName =
    game.teamName ||
    (Array.isArray(game.teams) ? game.teams.filter(Boolean).join(', ') : '')
  const dateLabel =
    game.dateLabel ||
    (game.dateStart
      ? formatDateInLocationTimeZone(game.dateStart, game.location, {
          dateStyle: 'short',
          timeStyle: 'medium',
        })
      : null) ||
    'Дата не указана'
  const normalizedPlace = toFiniteNumberOrNull(game.place)
  const hasPlace = normalizedPlace !== null && normalizedPlace > 0
  const isResultPublished = game.isResultPublished !== false
  const reviewsCount = Number(game.reviewsCount) || 0
  const reviewAverageRating = toFiniteNumberOrNull(game.reviewAverageRating)
  const reviewAverageDifficultyRating = toFiniteNumberOrNull(
    game.reviewAverageDifficultyRating,
  )

  return (
    <Component
      {...(Component === 'button' ? { type: 'button' } : {})}
      onClick={
        typeof onOpen === 'function' ? () => onOpen(game) : undefined
      }
      className={cn(
        'w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition dark:border-slate-700 dark:bg-slate-800/80',
        typeof onOpen === 'function' &&
          'cursor-pointer hover:border-cyan-400 hover:bg-cyan-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:hover:border-cyan-500/50 dark:hover:bg-cyan-500/10 dark:focus-visible:ring-offset-slate-950',
        className,
      )}
      aria-label={
        typeof onOpen === 'function' ? `Открыть игру «${gameName}»` : undefined
      }
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900/70">
            {game.image ? (
              <img
                src={game.image}
                alt={`Обложка игры «${gameName}»`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-slate-500 dark:text-slate-300">
                Нет фото
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="aq-modal-item-title truncate text-sm font-semibold">
              {gameName}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
              {dateLabel}
            </p>
            {teamName ? (
              <p className="mt-1 text-xs font-semibold text-cyan-700 dark:text-cyan-200">
                {teamName}
              </p>
            ) : null}
            {footerText ? (
              <p className="mt-1 text-xs text-slate-400">{footerText}</p>
            ) : null}
            {reviewsCount > 0 && reviewAverageRating !== null ? (
              <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-200">
                {reviewAverageRating} ★
                {reviewAverageDifficultyRating !== null ? (
                  <> · {reviewAverageDifficultyRating} ◈</>
                ) : null}{' '}
                - {getReviewCountLabel(reviewsCount)}
              </p>
            ) : null}
          </div>
        </div>
        {isResultPublished && hasPlace ? (
          <GamePlaceBadge
            place={normalizedPlace}
            label={`${normalizedPlace} место`}
          />
        ) : (
          <span className="inline-flex shrink-0 items-center rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">
            {isResultPublished ? 'Без места' : 'Результаты скрыты'}
          </span>
        )}
      </div>
    </Component>
  )
}

PlayedGameCard.propTypes = {
  game: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    gameName: PropTypes.string,
    location: PropTypes.string,
    image: PropTypes.string,
    dateStart: PropTypes.string,
    dateLabel: PropTypes.string,
    teamName: PropTypes.string,
    teams: PropTypes.arrayOf(PropTypes.string),
    place: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    isResultPublished: PropTypes.bool,
    reviewAverageRating: PropTypes.number,
    reviewAverageDifficultyRating: PropTypes.number,
    reviewsCount: PropTypes.number,
  }).isRequired,
  onOpen: PropTypes.func,
  className: PropTypes.string,
  footerText: PropTypes.string,
}

export default PlayedGameCard
