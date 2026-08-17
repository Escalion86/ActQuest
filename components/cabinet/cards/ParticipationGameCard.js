import PropTypes from 'prop-types'

import GamePlaceBadge from '@components/cabinet/GamePlaceBadge'
import SelectableCard from '@components/cabinet/SelectableCard'
import formatDateInLocationTimeZone from '@helpers/formatDateInLocationTimeZone'
import getGameStatusLabel from '@helpers/getGameStatusLabel'

const GAME_STATUS_BADGE_STYLES = {
  active:
    'border border-sky-300 bg-sky-100 text-sky-700 dark:border-[#00D1FF]/35 dark:bg-[#00D1FF]/12 dark:text-[#bdf4ff]',
  started:
    'border border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-[#17e6ae]/35 dark:bg-[#17e6ae]/12 dark:text-[#c8ffe9]',
  finished:
    'border border-violet-300 bg-violet-100 text-violet-700 dark:border-[#7A00FF]/35 dark:bg-[#7A00FF]/12 dark:text-[#e2d5ff]',
  closed:
    'border border-indigo-300 bg-indigo-100 text-indigo-700 dark:border-[#8b5cf6]/45 dark:bg-[#8b5cf6]/14 dark:text-[#e9ddff]',
  canceled:
    'border border-rose-300 bg-rose-100 text-rose-700 dark:border-[#ff4d6d]/35 dark:bg-[#ff4d6d]/12 dark:text-[#ffd1da]',
}

const getStatusBadgeClassName = (status) => {
  if (!status) {
    return 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-100'
  }

  const normalized = typeof status === 'string' ? status.toLowerCase() : String(status)

  return (
    GAME_STATUS_BADGE_STYLES[normalized] ??
    'border border-slate-300 bg-slate-100 text-slate-700 dark:border-white/20 dark:bg-white/10 dark:text-slate-200'
  )
}

const ParticipationGameCard = ({
  game,
  onOpen,
  showPlace = false,
  showLocation = false,
  locationLabel = '',
  showTeam = true,
  footerText = '',
}) => (
  <SelectableCard
    as={typeof onOpen === 'function' ? 'button' : 'div'}
    type={typeof onOpen === 'function' ? 'button' : undefined}
    onClick={typeof onOpen === 'function' ? () => onOpen(game.id) : undefined}
    className="relative w-full text-left"
    aria-label={typeof onOpen === 'function' ? `Открыть игру «${game.name || 'Без названия'}»` : undefined}
    title={game.name || 'Без названия'}
  >
    <div className="flex min-w-0 w-full flex-1 items-start gap-3">
      <div className="min-w-0 flex-1">
        <span
          className={`mb-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClassName(game.status)}`}
        >
          {getGameStatusLabel(game.status)}
        </span>
        <p className="aq-line-clamp-2 text-sm font-semibold text-primary dark:text-slate-100">
          {game.name || 'Без названия'}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">
            {game.dateStart
              ? formatDateInLocationTimeZone(game.dateStart, game.location, {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })
              : 'Дата не указана'}
          </span>
          {showLocation && (
            <>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500">{locationLabel || 'Не указана'}</span>
            </>
          )}
        </div>
        {showTeam ? (
          <p className="mt-1 text-xs text-slate-400">
            Команда: {Array.isArray(game.teams) && game.teams.length > 0 ? game.teams.join(', ') : '—'}
          </p>
        ) : null}
        {footerText ? (
          <p className="mt-1 text-xs text-slate-400">{footerText}</p>
        ) : null}
      </div>
    </div>
    {showPlace && Number.isFinite(Number(game.place)) && Number(game.place) > 0 && (
      <div className="mt-2 self-start">
        <GamePlaceBadge place={game.place} />
      </div>
    )}
  </SelectableCard>
)

ParticipationGameCard.propTypes = {
  game: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    status: PropTypes.string,
    dateStart: PropTypes.string,
    location: PropTypes.string,
    teams: PropTypes.arrayOf(PropTypes.string),
    place: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }).isRequired,
  onOpen: PropTypes.func,
  showPlace: PropTypes.bool,
  showLocation: PropTypes.bool,
  locationLabel: PropTypes.string,
  showTeam: PropTypes.bool,
  footerText: PropTypes.string,
}

ParticipationGameCard.defaultProps = {
  onOpen: undefined,
  showPlace: false,
  showLocation: false,
  locationLabel: '',
  showTeam: true,
  footerText: '',
}

export default ParticipationGameCard
