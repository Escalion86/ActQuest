'use client'

import PropTypes from 'prop-types'
import dynamic from 'next/dynamic'
import { useEffect, useRef } from 'react'

const TaskRichEditor = dynamic(() => import('@components/cabinet/TaskRichEditor'), {
  ssr: false,
})

const trimEdgeEmptyParagraphs = (value) => {
  const source = String(value || '').trim()
  if (!source) return ''

  return source
    .replace(
      /^(?:\s|<p\b[^>]*>\s*(?:<br\s*\/?>|&nbsp;|\u00A0)*\s*<\/p>)+/gi,
      '',
    )
    .replace(
      /(?:\s|<p\b[^>]*>\s*(?:<br\s*\/?>|&nbsp;|\u00A0)*\s*<\/p>)+$/gi,
      '',
    )
    .trim()
}

const RichTaskContentView = ({
  html,
  text,
  className,
  textClassName,
  directory,
}) => {
  const rootRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const proseMirror = root.querySelector('.ProseMirror')
    if (!proseMirror) return

    const isVisuallyEmptyParagraph = (node) => {
      if (!(node instanceof HTMLElement)) return false
      if (node.tagName !== 'P') return false
      const text = String(node.textContent || '').replace(/\u00a0/g, '').trim()
      if (text.length > 0) return false
      return true
    }

    while (proseMirror.firstElementChild) {
      const first = proseMirror.firstElementChild
      if (!isVisuallyEmptyParagraph(first)) break
      first.remove()
    }

    while (proseMirror.lastElementChild) {
      const last = proseMirror.lastElementChild
      if (!isVisuallyEmptyParagraph(last)) break
      last.remove()
    }
  }, [html, text, directory])

  return (
    <div
      ref={rootRef}
      className={`aq-rich-task-content-view ${className || textClassName || ''}`}
    >
      <TaskRichEditor
        value={trimEdgeEmptyParagraphs(
          (typeof html === 'string' && html.trim()) ||
            (typeof text === 'string' ? text : ''),
        )}
        onChange={() => {}}
        disabled
        hideToolbar
        compactReadOnly
        directory={directory}
        contentMaxHeight="unset"
      />
    </div>
  )
}

RichTaskContentView.propTypes = {
  html: PropTypes.string,
  text: PropTypes.string,
  className: PropTypes.string,
  textClassName: PropTypes.string,
  directory: PropTypes.string,
}

RichTaskContentView.defaultProps = {
  html: '',
  text: '',
  className: '',
  textClassName: '',
  directory: 'games/preview/shared',
}

export default RichTaskContentView
