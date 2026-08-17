import PropTypes from 'prop-types'

const resolvePlaceVariant = (place) => {
  if (place === 1) return 'gold'
  if (place === 2) return 'silver'
  if (place === 3) return 'bronze'
  return 'default'
}

const GamePlaceBadge = ({ place, label = '' }) => {
  const normalizedPlace = Number(place)
  if (!Number.isFinite(normalizedPlace) || normalizedPlace <= 0) {
    return null
  }

  const variant = resolvePlaceVariant(normalizedPlace)

  return (
    <span
      className={`aq-game-place-badge aq-game-place-badge--${variant}`}
      aria-label={`Занятое место: ${normalizedPlace}`}
    >
      <span>{label || `${normalizedPlace} место`}</span>
    </span>
  )
}

GamePlaceBadge.propTypes = {
  place: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  label: PropTypes.string,
}

export default GamePlaceBadge
