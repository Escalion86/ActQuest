import PropTypes from 'prop-types'

const DEFAULT_CLASS_NAME =
  'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80'

const FormSectionCard = ({ as, className, children }) => {
  const Component = as || 'section'
  const resolvedClassName = className
    ? `${DEFAULT_CLASS_NAME} ${className}`
    : DEFAULT_CLASS_NAME

  return <Component className={resolvedClassName}>{children}</Component>
}

FormSectionCard.propTypes = {
  as: PropTypes.oneOfType([PropTypes.string, PropTypes.elementType]),
  className: PropTypes.string,
  children: PropTypes.node.isRequired,
}

FormSectionCard.defaultProps = {
  as: 'section',
  className: '',
}

export default FormSectionCard
