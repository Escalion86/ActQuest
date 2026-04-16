'use client'

import PropTypes from 'prop-types'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import FullscreenImageViewer from '@components/FullscreenImageViewer'

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
  const [selectedImage, setSelectedImage] = useState(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const isVisuallyEmptyParagraph = (node) => {
      if (!(node instanceof HTMLElement)) return false
      if (node.tagName !== 'P') return false
      const text = String(node.textContent || '').replace(/\u00a0/g, '').trim()
      if (text.length > 0) return false
      return true
    }

    const trimProseMirrorEdges = () => {
      const proseMirror = root.querySelector('.ProseMirror')
      if (!proseMirror) {
        return
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
    }
    trimProseMirrorEdges()

    const handleImageClick = (event) => {
      const target = event.target
      if (!(target instanceof Element)) {
        return
      }
      const imageElement =
        target instanceof HTMLImageElement
          ? target
          : target.closest?.('img')
      if (!(imageElement instanceof HTMLImageElement)) {
        return
      }
      const src = String(imageElement.getAttribute('src') || '').trim()
      if (!src) {
        return
      }
      setSelectedImage({
        src,
        alt: String(imageElement.getAttribute('alt') || 'Изображение'),
      })
    }

    const observer = new MutationObserver(() => {
      trimProseMirrorEdges()
    })
    observer.observe(root, {
      childList: true,
      subtree: true,
    })

    root.addEventListener('click', handleImageClick)
    return () => {
      observer.disconnect()
      root.removeEventListener('click', handleImageClick)
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
      <FullscreenImageViewer
        isOpen={Boolean(selectedImage?.src)}
        src={selectedImage?.src || ''}
        alt={selectedImage?.alt || 'Изображение'}
        onClose={() => setSelectedImage(null)}
      />
      <style jsx global>{`
        .aq-rich-task-content-view .ProseMirror img,
        .aq-rich-task-content-view .aq-image-node__image {
          cursor: zoom-in !important;
        }
      `}</style>
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
