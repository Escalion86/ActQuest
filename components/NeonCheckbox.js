import PropTypes from 'prop-types'

const NeonCheckbox = ({
  id,
  checked,
  onChange,
  disabled,
  label,
  description,
  className,
  contentClassName,
  labelClassName,
  descriptionClassName,
  boxClassName,
  inputClassName,
  name,
  value,
  required,
  ariaLabel,
  boxAfter,
  children,
}) => {
  const box = (
    <span className={`aq-neon-checkbox-box ${boxClassName || ''}`} aria-hidden="true">
      <svg
        className="aq-neon-checkbox-icon"
        viewBox="0 0 14 14"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M3 7.2L5.6 9.7L11 4.5"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )

  const content = children || (
    <>
      {label ? (
        <span className={`aq-neon-checkbox-label ${labelClassName || ''}`}>{label}</span>
      ) : null}
      {description ? (
        <span className={`aq-neon-checkbox-description ${descriptionClassName || ''}`}>
          {description}
        </span>
      ) : null}
    </>
  )

  return (
    <label className={`aq-neon-checkbox ${disabled ? 'is-disabled' : ''} ${className || ''}`} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={Boolean(checked)}
        onChange={onChange}
        disabled={disabled}
        name={name}
        value={value}
        required={required}
        aria-label={ariaLabel}
        className={`aq-neon-checkbox-input ${inputClassName || ''}`}
      />
      {boxAfter ? null : box}
      {(children || label || description) ? (
        <span className={`aq-neon-checkbox-content ${contentClassName || ''}`}>{content}</span>
      ) : null}
      {boxAfter ? box : null}
    </label>
  )
}

NeonCheckbox.propTypes = {
  id: PropTypes.string.isRequired,
  checked: PropTypes.bool,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
  label: PropTypes.node,
  description: PropTypes.node,
  className: PropTypes.string,
  contentClassName: PropTypes.string,
  labelClassName: PropTypes.string,
  descriptionClassName: PropTypes.string,
  boxClassName: PropTypes.string,
  inputClassName: PropTypes.string,
  name: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  required: PropTypes.bool,
  ariaLabel: PropTypes.string,
  boxAfter: PropTypes.bool,
  children: PropTypes.node,
}

NeonCheckbox.defaultProps = {
  checked: false,
  onChange: () => {},
  disabled: false,
  label: null,
  description: null,
  className: '',
  contentClassName: '',
  labelClassName: '',
  descriptionClassName: '',
  boxClassName: '',
  inputClassName: '',
  name: undefined,
  value: undefined,
  required: false,
  ariaLabel: undefined,
  boxAfter: false,
  children: null,
}

export default NeonCheckbox

