import PropTypes from 'prop-types'
import cn from 'classnames'

const ModalSection = ({ children, className, noPadding }) => {
  return (
    <section
      className={cn(
        'space-y-5 bg-white border shadow-sm dark:bg-slate-900/80 border-slate-200 dark:border-slate-700 rounded-2xl',
        noPadding ? 'p-0' : 'p-6',
        className,
      )}
    >
      {children}
    </section>
  )
}

ModalSection.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
}

ModalSection.defaultProps = {
  children: null,
  className: '',
}

export default ModalSection
