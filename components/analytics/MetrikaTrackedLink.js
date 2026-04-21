'use client'

import Link from 'next/link'
import PropTypes from 'prop-types'
import { reachAnalyticsGoal } from '@helpers/yandexMetrika'

export default function MetrikaTrackedLink({
  href,
  className,
  children,
  target,
  rel,
  goal,
  params,
}) {
  return (
    <Link
      href={href}
      className={className}
      target={target}
      rel={rel}
      onClick={() => {
        if (goal) {
          reachAnalyticsGoal(goal, params)
        }
      }}
    >
      {children}
    </Link>
  )
}

MetrikaTrackedLink.propTypes = {
  href: PropTypes.string.isRequired,
  className: PropTypes.string,
  children: PropTypes.node.isRequired,
  target: PropTypes.string,
  rel: PropTypes.string,
  goal: PropTypes.string,
  params: PropTypes.object,
}

MetrikaTrackedLink.defaultProps = {
  className: '',
  target: undefined,
  rel: undefined,
  goal: '',
  params: {},
}
