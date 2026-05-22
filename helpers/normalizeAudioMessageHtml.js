const escapeHtmlAttribute = (value) =>
  String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const escapeHtmlText = (value) =>
  String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const decodeHtmlEntities = (value) => {
  let result = String(value || '')
  for (let index = 0; index < 3; index += 1) {
    const decoded = result
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
    if (decoded === result) {
      break
    }
    result = decoded
  }
  return result
}

const getAttribute = (attrs, name) => {
  const match = String(attrs || '').match(
    new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i'),
  )
  return match?.[1] ? decodeHtmlEntities(match[1]) : ''
}

const getAudioDownloadFileName = ({ src, title }) => {
  const safeTitle = String(title || 'audio')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')

  let extension = '.mp3'
  try {
    const url = new URL(src, 'https://actquest.ru')
    const extensionMatch = url.pathname.match(/\.([a-z0-9]{2,6})$/i)
    if (extensionMatch?.[1]) {
      extension = `.${extensionMatch[1].toLowerCase()}`
    }
  } catch {
    const extensionMatch = String(src || '').match(/\.([a-z0-9]{2,6})(?:[?#]|$)/i)
    if (extensionMatch?.[1]) {
      extension = `.${extensionMatch[1].toLowerCase()}`
    }
  }

  if (!safeTitle) {
    return `audio${extension}`
  }

  return safeTitle.toLowerCase().endsWith(extension)
    ? safeTitle
    : `${safeTitle}${extension}`
}

const buildDownloadHref = ({ src, title }) => {
  const params = new URLSearchParams()
  params.set('url', src)
  params.set('filename', getAudioDownloadFileName({ src, title }))
  return `/api/public/media-download?${params.toString()}`
}

const normalizeClassValue = (attrs) => {
  const classValue = getAttribute(attrs, 'class')
  const classes = new Set(
    String(classValue || '')
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean),
  )
  classes.add('aq-audio-message')
  return Array.from(classes).join(' ')
}

const buildAudioMessageInnerHtml = ({ src, title }) => {
  const safeSrc = escapeHtmlAttribute(src)
  const safeTitle = escapeHtmlText(title || 'Аудио')
  const safeDownloadHref = escapeHtmlAttribute(buildDownloadHref({ src, title }))

  return `
<div class="aq-audio-message__meta" aria-hidden="true">
  <span class="aq-audio-message__dot"></span>
  <span class="aq-audio-message__title">${safeTitle}</span>
</div>
<div class="aq-audio-message__native-wrap">
  <audio controls preload="metadata" src="${safeSrc}"></audio>
  <a
    class="aq-audio-message__download"
    href="${safeDownloadHref}"
    download
    rel="noopener noreferrer"
    title="Скачать аудио"
    aria-label="Скачать аудио"
  >
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4v9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M8.5 10.5L12 14l3.5-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5 18h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
  </a>
</div>`.trim()
}

const normalizeAudioMessageHtml = (value) => {
  const source = String(value || '')
  if (!source || !source.includes('audio-message')) {
    return source
  }

  return source.replace(
    /<audio-message([^>]*)>([\s\S]*?)<\/audio-message>/gi,
    (match, attrs, inner) => {
      const src = getAttribute(attrs, 'src')
      if (!src) {
        return match
      }

      const title = getAttribute(attrs, 'title') || 'Аудио'
      if (String(inner || '').includes('aq-audio-message__native-wrap')) {
        const safeDownloadHref = escapeHtmlAttribute(
          buildDownloadHref({ src, title }),
        )
        return match.replace(
          /(<a\b[^>]*class="[^"]*\baq-audio-message__download\b[^"]*"[^>]*\bhref=")[^"]*(")/i,
          `$1${safeDownloadHref}$2`,
        )
      }

      const className = normalizeClassValue(attrs)
      const safeSrc = escapeHtmlAttribute(src)
      const safeTitle = escapeHtmlAttribute(title)
      const safeClassName = escapeHtmlAttribute(className)
      const innerHtml = buildAudioMessageInnerHtml({ src, title })

      return `<audio-message src="${safeSrc}" title="${safeTitle}" class="${safeClassName}">${innerHtml}</audio-message>`
    },
  )
}

export default normalizeAudioMessageHtml
