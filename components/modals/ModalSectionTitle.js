import PropTypes from 'prop-types'
import cn from 'classnames'

const ModalSectionTitle = ({ as: Tag = 'h4', children, className = '' }) => (
  <Tag
    className={cn(
      'aq-modal-section-title text-base font-semibold text-slate-900 dark:text-slate-100',
      className,
    )}
  >
    {children}
  </Tag>
)

ModalSectionTitle.propTypes = {
  as: PropTypes.oneOf(['h2', 'h3', 'h4', 'h5', 'h6']),
  children: PropTypes.node,
  className: PropTypes.string,
}

ModalSectionTitle.defaultProps = {
  children: null,
}

export default ModalSectionTitle
