import PropTypes from 'prop-types'

const AuthLocationSelect = ({
  location,
  onChange,
  disabled,
  availableLocations,
}) => (
  <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
    Игровой регион
    <select
      className="px-4 py-3 text-base transition border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
      value={location}
      onChange={onChange}
      disabled={disabled}
    >
      {availableLocations.map((item) => (
        <option key={item.key} value={item.key}>
          {item.townRu[0].toUpperCase() + item.townRu.slice(1)}
        </option>
      ))}
    </select>
  </label>
)

AuthLocationSelect.propTypes = {
  location: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  availableLocations: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      townRu: PropTypes.string.isRequired,
    }),
  ).isRequired,
}

AuthLocationSelect.defaultProps = {
  disabled: false,
}

export default AuthLocationSelect
