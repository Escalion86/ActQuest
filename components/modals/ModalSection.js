import PropTypes from 'prop-types'
import cn from 'classnames'

const ModalSection = ({ children, className }) => {
  return (
    <section
      className={cn(
        'p-6 space-y-5 bg-white border shadow-sm dark:bg-slate-900/80 border-slate-200 dark:border-slate-700 rounded-2xl',
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

