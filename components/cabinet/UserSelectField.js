import PropTypes from 'prop-types'

import EntitySelectField from '@components/cabinet/EntitySelectField'

const ADMIN_USERS_LIST_ENDPOINT = '/api/cabinet/admin/users-list'

const mapUserOption = (item) => {
  const id = item?.id ? String(item.id) : ''
  if (!id) {
    return null
  }

  const name =
    typeof item?.name === 'string' && item.name.trim()
      ? item.name.trim()
      : typeof item?.username === 'string' && item.username.trim()
        ? `@${item.username.trim()}`
        : `Пользователь ${id.slice(-6)}`

  const metaParts = []
  if (typeof item?.username === 'string' && item.username.trim()) {
    metaParts.push(`@${item.username.trim()}`)
  }
  if (typeof item?.phone === 'string' && item.phone.trim()) {
    metaParts.push(item.phone.trim())
  }
  if (typeof item?.role === 'string' && item.role.trim()) {
    metaParts.push(item.role.trim())
  }

  return {
    id,
    title: name,
    subtitle: metaParts.join(' · '),
  }
}

const UserSelectField = ({
  label,
  selectedOption,
  onSelect,
  onClear,
  disabled,
  placeholder,
  modalTitle,
  searchPlaceholder,
}) => {
  return (
    <EntitySelectField
      label={label}
      placeholder={placeholder}
      modalTitle={modalTitle}
      searchPlaceholder={searchPlaceholder}
      endpoint={ADMIN_USERS_LIST_ENDPOINT}
      mapOption={mapUserOption}
      selectedOption={selectedOption}
      onSelect={onSelect}
      onClear={onClear}
      disabled={disabled}
    />
  )
}

UserSelectField.propTypes = {
  label: PropTypes.string,
  selectedOption: PropTypes.shape({
    id: PropTypes.string,
    title: PropTypes.string,
    subtitle: PropTypes.string,
  }),
  onSelect: PropTypes.func,
  onClear: PropTypes.func,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string,
  modalTitle: PropTypes.string,
  searchPlaceholder: PropTypes.string,
}

UserSelectField.defaultProps = {
  label: 'Пользователь',
  selectedOption: null,
  onSelect: undefined,
  onClear: undefined,
  disabled: false,
  placeholder: 'Выберите пользователя',
  modalTitle: 'Выбор пользователя',
  searchPlaceholder: 'Поиск по имени, нику, телефону или ID',
}

export default UserSelectField
