'use client'

import { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { reachAnalyticsGoal } from '@helpers/yandexMetrika'

export default function SeoMetrikaTracker({
  viewGoal,
  viewParams,
  enableScroll75,
  scrollParams,
}) {
  const sentScroll75Ref = useRef(false)

  useEffect(() => {
    if (viewGoal) {
      reachAnalyticsGoal(viewGoal, viewParams)
    }
  }, [viewGoal, viewParams])

  useEffect(() => {
    if (!enableScroll75) {
      return undefined
    }

    const onScroll = () => {
      if (sentScroll75Ref.current) {
        return
      }

      const doc = document.documentElement
      const body = document.body
      const scrollTop =
        window.scrollY || doc?.scrollTop || body?.scrollTop || 0
      const viewportHeight = window.innerHeight || doc?.clientHeight || 0
      const scrollHeight = doc?.scrollHeight || body?.scrollHeight || 0
      if (!scrollHeight || !viewportHeight) {
        return
      }

      const progress = (scrollTop + viewportHeight) / scrollHeight
      if (progress >= 0.75) {
        sentScroll75Ref.current = true
        reachAnalyticsGoal('aq_scroll_75', scrollParams)
      }
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [enableScroll75, scrollParams])

  return null
}

SeoMetrikaTracker.propTypes = {
  viewGoal: PropTypes.string,
  viewParams: PropTypes.object,
  enableScroll75: PropTypes.bool,
  scrollParams: PropTypes.object,
}

SeoMetrikaTracker.defaultProps = {
  viewGoal: '',
  viewParams: {},
  enableScroll75: true,
  scrollParams: {},
}
