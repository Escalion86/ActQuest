import PropTypes from 'prop-types'

import SelectableCard from '@components/cabinet/SelectableCard'
import getUserAvatarSrc from '@helpers/getUserAvatarSrc'

const systemRoleLabels = {
  client: 'Участник',
  moder: 'Модератор',
  admin: 'Администратор',
  dev: 'Разработчик',
  ban: 'Заблокирован',
}

const TeamMemberCard = ({ member, onOpen }) => (
  <SelectableCard
    as={typeof onOpen === 'function' ? 'button' : 'div'}
    type={typeof onOpen === 'function' ? 'button' : undefined}
    onClick={typeof onOpen === 'function' ? () => onOpen(member) : undefined}
    className="relative w-full text-left"
    aria-label={
      typeof onOpen === 'function'
        ? `Открыть профиль участника «${member.name || 'Без имени'}»`
        : undefined
    }
    title={member.name || 'Без имени'}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80">
          <img
            src={getUserAvatarSrc(member)}
            alt={member.name || 'Участник'}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {member.name || 'Без имени'}
          </p>
          {member.username ? (
            <p className="mt-1 text-xs text-slate-500">@{member.username}</p>
          ) : null}
          {member.userGamesCount !== undefined || member.rating ? (
            <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
              {member.userGamesCount !== undefined && (
                <span>Игр: {member.userGamesCount}</span>
              )}
              {member.rating?.isEligible &&
                Number.isFinite(member.rating?.rank) && (
                  <span>#{member.rating.rank}</span>
                )}
            </div>
          ) : null}
          {!member.hasLinkedUser ? (
            <p className="mt-1 text-xs text-amber-600">
              Профиль пользователя не найден в глобальной базе.
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {member.isCaptain ? (
          <span className="inline-flex items-center rounded-full border border-emerald-300/70 bg-emerald-50/90 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/12 dark:text-emerald-200">
            Капитан
          </span>
        ) : null}
        {member.userRole
          ? (() => {
              const normalizedRole = String(member.userRole).toLowerCase()
              const roleLabel =
                systemRoleLabels[normalizedRole] ?? member.userRole
              if (normalizedRole === 'client' || roleLabel === 'Участник') {
                return null
              }
              return (
                <span className="inline-flex items-center rounded-full border border-slate-300/70 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/12 dark:text-slate-200">
                  {roleLabel}
                </span>
              )
            })()
          : null}
      </div>
    </div>
  </SelectableCard>
)

TeamMemberCard.propTypes = {
  member: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    username: PropTypes.string,
    userRole: PropTypes.string,
    hasLinkedUser: PropTypes.bool,
    phone: PropTypes.string,
    isCaptain: PropTypes.bool,
  }).isRequired,
  onOpen: PropTypes.func,
}

TeamMemberCard.defaultProps = {
  onOpen: undefined,
}

export default TeamMemberCard
