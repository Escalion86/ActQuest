import PropTypes from 'prop-types'

import EntitySelectField from '@components/cabinet/EntitySelectField'

const formatDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const mapGameOption = (item) => {
  const id = item?.id ? String(item.id) : ''
  if (!id) {
    return null
  }

  const title =
    typeof item?.name === 'string' && item.name.trim()
      ? item.name.trim()
      : `Игра ${id.slice(-6)}`

  const metaParts = []
  const dateText = formatDate(item?.dateStart)
  if (dateText) {
    metaParts.push(dateText)
  }
  if (typeof item?.location === 'string' && item.location.trim()) {
    metaParts.push(item.location.trim())
  }
  if (typeof item?.status === 'string' && item.status.trim()) {
    metaParts.push(item.status.trim())
  }

  return {
    id,
    title,
    subtitle: metaParts.join(' · '),
  }
}

const GameSelectField = ({
  label,
  selectedOption,
  onSelect,
  onClear,
  disabled,
}) => {
  return (
    <EntitySelectField
      label={label}
      placeholder="Выберите игру"
      modalTitle="Выбор игры"
      searchPlaceholder="Поиск по названию и городу"
      endpoint="/api/cabinet/admin/games-list"
      mapOption={mapGameOption}
      selectedOption={selectedOption}
      onSelect={onSelect}
      onClear={onClear}
      disabled={disabled}
    />
  )
}

GameSelectField.propTypes = {
  label: PropTypes.string,
  selectedOption: PropTypes.shape({
    id: PropTypes.string,
    title: PropTypes.string,
    subtitle: PropTypes.string,
  }),
  onSelect: PropTypes.func,
  onClear: PropTypes.func,
  disabled: PropTypes.bool,
}

GameSelectField.defaultProps = {
  label: 'Игра',
  selectedOption: null,
  onSelect: undefined,
  onClear: undefined,
  disabled: false,
}

export default GameSelectField
