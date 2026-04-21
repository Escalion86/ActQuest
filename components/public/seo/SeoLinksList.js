import Link from 'next/link'
import PropTypes from 'prop-types'
import cn from 'classnames'

export default function SeoLinksList({ items, className, linkClassName }) {
  if (!Array.isArray(items) || items.length === 0) {
    return null
  }

  return (
    <ul className={cn('space-y-2 text-[#cbe8ff]', className)}>
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className={cn(
              'underline decoration-[#00D1FF]/60 underline-offset-2 hover:text-[#eaf7ff]',
              linkClassName,
            )}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  )
}

SeoLinksList.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      href: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    }),
  ),
  className: PropTypes.string,
  linkClassName: PropTypes.string,
}

SeoLinksList.defaultProps = {
  items: [],
  className: '',
  linkClassName: '',
}
