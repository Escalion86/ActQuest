'use client'

import { useEffect, useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import { enhanceTaskRichTabs } from '@helpers/taskRichTabsDom'

const TaskTabsHtmlView = ({ html, className = '' }) => {
  const rootRef = useRef(null)
  const innerHtml = useMemo(() => ({ __html: html }), [html])

  useEffect(() => enhanceTaskRichTabs(rootRef.current), [html])

  return (
    <div
      ref={rootRef}
      className={className}
      dangerouslySetInnerHTML={innerHtml}
    />
  )
}

TaskTabsHtmlView.propTypes = {
  html: PropTypes.string.isRequired,
  className: PropTypes.string,
}

export default TaskTabsHtmlView
