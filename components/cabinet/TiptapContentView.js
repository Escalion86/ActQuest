import PropTypes from 'prop-types'
import normalizeAudioMessageHtml from '@helpers/normalizeAudioMessageHtml'

const escapeHtml = (value) =>
  String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const normalizeTextToHtml = (value) => {
  const source = String(value || '')
    .replace(/\r\n?/g, '\n')
    .replaceAll('\u00A0', ' ')
    .replaceAll('\u202F', ' ')
    .replaceAll('\u2007', ' ')

  if (!source.trim()) {
    return ''
  }

  const lines = source.split('\n')

  return lines
    .map((line) => {
      const normalizedLine = line.replace(/[ \t]+$/g, '')
      if (!normalizedLine.trim()) {
        return '<p data-aq-empty-line="true"><br></p>'
      }

      return `<p>${escapeHtml(normalizedLine)}</p>`
    })
    .join('')
}

const normalizeEmptyRichParagraphs = (value) =>
  String(value || '').replace(
    /<p\b[^>]*>(?:\s|&nbsp;|\u00A0|<br\s*\/?>|<\/?(?:strong|b|em|i|u|s|strike|span|font|sub|sup|a)\b[^>]*>)*<\/p>/gi,
    '<p data-aq-empty-line="true"><br></p>',
  )

const TiptapContentView = ({
  html,
  text,
  emptyText,
  className,
  textClassName,
  emptyClassName,
}) => {
  const normalizedHtml = typeof html === 'string' ? html.trim() : ''
  const normalizedText = typeof text === 'string' ? text : ''
  const hasHtmlTags = /<\/?[a-z][^>]*>/i.test(normalizedHtml)
  const htmlFromPlainText =
    !hasHtmlTags && normalizedText ? normalizeTextToHtml(normalizedText) : ''
  const normalizedHtmlContent = normalizeEmptyRichParagraphs(
    (hasHtmlTags ? normalizedHtml : htmlFromPlainText)
      .replaceAll('&nbsp;', ' ')
      .replaceAll('\u00A0', ' ')
  )
  const htmlWithNormalizedAudio = normalizeAudioMessageHtml(normalizedHtmlContent)

  if (htmlWithNormalizedAudio) {
    return (
      <div
        className={`aq-tiptap-view aq-rich-text-base aq-task-content max-w-none break-words [overflow-wrap:anywhere] [&_*]:max-w-full [&_*]:break-words ${className}`}
        dangerouslySetInnerHTML={{ __html: htmlWithNormalizedAudio }}
      />
    )
  }

  if (normalizedText) {
    return (
      <p
        className={`whitespace-pre-line break-words [overflow-wrap:anywhere] ${textClassName}`}
      >
        {normalizedText}
      </p>
    )
  }

  if (!emptyText) {
    return null
  }

  return <p className={emptyClassName}>{emptyText}</p>
}

TiptapContentView.propTypes = {
  html: PropTypes.string,
  text: PropTypes.string,
  emptyText: PropTypes.string,
  className: PropTypes.string,
  textClassName: PropTypes.string,
  emptyClassName: PropTypes.string,
}

TiptapContentView.defaultProps = {
  html: '',
  text: '',
  emptyText: '',
  className: '',
  textClassName: '',
  emptyClassName: 'text-sm text-slate-500',
}

export default TiptapContentView
