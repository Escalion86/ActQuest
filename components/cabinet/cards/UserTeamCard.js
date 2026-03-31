import PropTypes from 'prop-types'

import SelectableCard from '@components/cabinet/SelectableCard'

const UserTeamCard = ({
  team,
  onOpen,
  metaText,
  rightContent,
  footerText,
  showCaptainBadge,
}) => (
  <SelectableCard
    as={typeof onOpen === 'function' ? 'button' : 'div'}
    type={typeof onOpen === 'function' ? 'button' : undefined}
    onClick={typeof onOpen === 'function' ? () => onOpen(team) : undefined}
    className="relative w-full text-left"
    aria-label={
      typeof onOpen === 'function'
        ? `Открыть команду «${team.name || 'Без названия'}»`
        : undefined
    }
    title={team.name || 'Без названия'}
  >
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex items-center gap-3">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80">
          <img
            src={team.image || '/img/avatars/team.png'}
            alt={`Иконка команды ${team.name || 'Без названия'}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary dark:text-slate-100">
            {team.name || 'Без названия'}
          </p>
          <p className="text-xs text-slate-500">
            {metaText || `Сыграно игр: ${Number(team.gamesCount) || 0}`}
          </p>
        </div>
      </div>
      {rightContent || (showCaptainBadge && team.isCaptain ? (
        <span className="text-xs font-medium px-2 py-1 rounded-full border border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">
          Капитан
        </span>
      ) : null)}
    </div>
    {footerText ? (
      <p className="mt-2 text-xs text-slate-400">{footerText}</p>
    ) : null}
  </SelectableCard>
)

UserTeamCard.propTypes = {
  team: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    image: PropTypes.string,
    isCaptain: PropTypes.bool,
    gamesCount: PropTypes.number,
    updatedAt: PropTypes.string,
  }).isRequired,
  onOpen: PropTypes.func,
  metaText: PropTypes.string,
  rightContent: PropTypes.node,
  footerText: PropTypes.string,
  showCaptainBadge: PropTypes.bool,
}

UserTeamCard.defaultProps = {
  onOpen: undefined,
  metaText: '',
  rightContent: null,
  footerText: '',
  showCaptainBadge: true,
}

export default UserTeamCard
