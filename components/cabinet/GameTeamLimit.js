import PropTypes from 'prop-types'

const GameTeamLimit = ({ game, role }) => {
  if (!['admin', 'dev'].includes(role) || game?.participationMode === 'player' ||
      !Number.isSafeInteger(game?.maxTeams) || game.maxTeams <= 0) return null
  return (
    <p className="text-xs text-slate-500 dark:text-slate-300">
      Лимит команд: {game.maxTeams}
    </p>
  )
}

GameTeamLimit.propTypes = {
  game: PropTypes.shape({ maxTeams: PropTypes.number, participationMode: PropTypes.string }),
  role: PropTypes.string,
}

export default GameTeamLimit
