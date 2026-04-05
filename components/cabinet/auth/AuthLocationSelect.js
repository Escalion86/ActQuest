import PropTypes from 'prop-types'

const AuthLocationSelect = ({
  location,
  onChange,
  disabled,
  availableLocations,
  variant,
  allowEmpty,
  emptyLabel,
}) => {
  const isNeon = variant === 'neon'

  return (
    <label
      className={`flex flex-col gap-2 text-sm font-medium ${
        isNeon ? 'text-[#bfeeff]' : 'text-slate-700'
      }`}
    >
      Игровой регион
      <select
        className={`px-4 py-3 text-base transition rounded-xl focus:outline-none ${
          isNeon
            ? 'cursor-pointer border border-[#00D1FF]/40 bg-[#090018]/80 text-white focus:border-[#00D1FF] focus:ring-2 focus:ring-[#00D1FF]/30 disabled:cursor-not-allowed'
            : 'cursor-pointer border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed'
        }`}
        value={location}
        onChange={onChange}
        disabled={disabled}
      >
        {allowEmpty ? (
          <option value="" disabled>
            {emptyLabel}
          </option>
        ) : null}
        {availableLocations.map((item) => (
          <option key={item.key} value={item.key}>
            {item.townRu[0].toUpperCase() + item.townRu.slice(1)}
          </option>
        ))}
      </select>
    </label>
  )
}

AuthLocationSelect.propTypes = {
  location: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  variant: PropTypes.oneOf(['default', 'neon']),
  allowEmpty: PropTypes.bool,
  emptyLabel: PropTypes.string,
  availableLocations: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      townRu: PropTypes.string.isRequired,
    }),
  ).isRequired,
}

AuthLocationSelect.defaultProps = {
  disabled: false,
  variant: 'default',
  allowEmpty: false,
  emptyLabel: 'Выберите регион',
}

export default AuthLocationSelect
