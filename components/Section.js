import cn from 'classnames'

const Section = ({ id, className, children, ...props }) => (
  <section
    id={id}
    className={cn('relative -top-15', className)}
    {...props}
  >
    {children}
  </section>
)

export default Section
