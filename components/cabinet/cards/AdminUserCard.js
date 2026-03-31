import PropTypes from 'prop-types'

import SelectableCard from '@components/cabinet/SelectableCard'
import CardActionIconButton, { EditCardIcon } from '@components/cabinet/CardActionIconButton'
import getUserAvatarSrc from '@helpers/getUserAvatarSrc'
import CABINET_ROLE_LABELS from '@helpers/cabinetRoleLabels'

const resolveRatingBadge = (rating) =>
  rating?.isEligible && Number.isFinite(rating?.rank)
    ? `#${rating.rank}`
    : null

const isPrivilegedRole = (role) => {
  const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : ''
  return normalizedRole === 'admin' || normalizedRole === 'dev'
}

const GamesCardIcon = () => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M5 5h10M5 10h10M5 15h10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
)

const AdminUserCard = ({ user, onOpenView, onOpenGames, onOpenEdit }) => (
  <SelectableCard
    as="button"
    onClick={() => onOpenView(user)}
    type="button"
    className="w-full text-left"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <img
          src={getUserAvatarSrc(user)}
          alt={user.name || 'Аватар пользователя'}
          className="h-12 w-12 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
          loading="lazy"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {user.name || 'Без имени'}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          {resolveRatingBadge(user.rating) ? (
            <span className="px-2 py-1 text-xs font-semibold text-cyan-700 bg-cyan-50 border border-cyan-300 rounded-full dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">
              {resolveRatingBadge(user.rating)}
            </span>
          ) : null}
          <CardActionIconButton
            as="span"
            onClick={(event) => {
              event.stopPropagation()
              onOpenGames(user)
            }}
            label="Показать игры участия"
          >
            <GamesCardIcon />
          </CardActionIconButton>
          <CardActionIconButton
            as="span"
            onClick={(event) => {
              event.stopPropagation()
              onOpenEdit(user)
            }}
            label="Редактировать пользователя"
          >
            <EditCardIcon />
          </CardActionIconButton>
        </div>
        {isPrivilegedRole(user.role) ? (
          <span className="px-2 py-1 text-xs font-semibold text-white bg-primary rounded-full">
            {CABINET_ROLE_LABELS[user.role] ?? user.role}
          </span>
        ) : null}
      </div>
    </div>
    <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-500">
      <span>Игры: {user.gamesCount}</span>
    </div>
    <div className="mt-2 text-xs text-slate-500">
      {Array.isArray(user.teams) && user.teams.length > 0 ? (
        <p className="truncate">
          Команды: {user.teams.map((team) => team?.name).filter(Boolean).join(', ')}
        </p>
      ) : (
        <p>Команды: —</p>
      )}
    </div>
  </SelectableCard>
)

AdminUserCard.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    role: PropTypes.string,
    rating: PropTypes.shape({
      isEligible: PropTypes.bool,
      rank: PropTypes.number,
    }),
    gamesCount: PropTypes.number,
    teams: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
      })
    ),
  }).isRequired,
  onOpenView: PropTypes.func.isRequired,
  onOpenGames: PropTypes.func.isRequired,
  onOpenEdit: PropTypes.func.isRequired,
}

export default AdminUserCard
