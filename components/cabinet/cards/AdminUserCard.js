import PropTypes from 'prop-types'

import SelectableCard from '@components/cabinet/SelectableCard'
import CardActionIconButton, {
  EditCardIcon,
  MegaphoneCardIcon,
} from '@components/cabinet/CardActionIconButton'
import getUserAvatarSrc from '@helpers/getUserAvatarSrc'
import CABINET_ROLE_LABELS from '@helpers/cabinetRoleLabels'

const resolveRatingBadge = (rating) =>
  rating?.isEligible && Number.isFinite(rating?.rank) ? `#${rating.rank}` : null

const isPrivilegedRole = (role) => {
  const normalizedRole =
    typeof role === 'string' ? role.trim().toLowerCase() : ''
  return normalizedRole === 'admin' || normalizedRole === 'dev'
}

const hasUserPhone = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0
  }
  if (typeof value === 'string') {
    return value.trim().length > 0
  }
  return false
}

const PhoneMissingIcon = () => (
  <span
    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-rose-400/70 bg-rose-50 text-rose-600 dark:border-rose-500/60 dark:bg-rose-500/15 dark:text-rose-300"
    title="У пользователя не указан номер телефона"
    aria-label="У пользователя не указан номер телефона"
  >
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M22 16.92V20a2 2 0 0 1-2.18 2 19.84 19.84 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.84 19.84 0 0 1 2.1 4.18 2 2 0 0 1 4.1 2h3.09a2 2 0 0 1 2 1.72c.14 1.06.38 2.09.72 3.08a2 2 0 0 1-.45 2.11L8.1 10.3a16 16 0 0 0 5.6 5.6l1.39-1.36a2 2 0 0 1 2.11-.45c.99.34 2.02.58 3.08.72A2 2 0 0 1 22 16.92Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 20L20 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  </span>
)

const AdminUserCard = ({
  user,
  onOpenView,
  onOpenEdit,
  onOpenPush,
  showMissingPhoneIndicator,
}) => (
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
          <p
            className="text-sm font-semibold text-slate-800 dark:text-slate-100"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
            {user.name || 'Без имени'}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          {showMissingPhoneIndicator && !hasUserPhone(user.phone) ? (
            <PhoneMissingIcon />
          ) : null}
          {resolveRatingBadge(user.rating) ? (
            <span className="px-2 py-1 text-xs font-semibold text-cyan-700 bg-cyan-50 border border-cyan-300 rounded-full dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">
              {resolveRatingBadge(user.rating)}
            </span>
          ) : null}
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
          <CardActionIconButton
            as="span"
            onClick={(event) => {
              event.stopPropagation()
              onOpenPush(user)
            }}
            label="Отправить push-уведомление пользователю"
            title="Отправить push-уведомление"
          >
            <MegaphoneCardIcon />
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
      <p>Команды: {Array.isArray(user.teams) ? user.teams.length : 0}</p>
      <p className="mt-1 truncate">
        {Array.isArray(user.teams) && user.teams.length > 0
          ? user.teams
              .map((team) => team?.name)
              .filter(Boolean)
              .join(', ')
          : '—'}
      </p>
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
    phone: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    teams: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
      }),
    ),
  }).isRequired,
  onOpenView: PropTypes.func.isRequired,
  onOpenEdit: PropTypes.func.isRequired,
  onOpenPush: PropTypes.func.isRequired,
  showMissingPhoneIndicator: PropTypes.bool,
}

AdminUserCard.defaultProps = {
  showMissingPhoneIndicator: false,
}

export default AdminUserCard
