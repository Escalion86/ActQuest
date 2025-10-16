const escapeAttribute = (value = '') =>
  String(value).replace(/"/g, '&quot;')

const TRAILING_PUNCTUATION_REGEX = /[)\]\}.,!?;:]+$/

const linkifySegment = (segment) => {
  if (!segment) return ''

  const urlRegex = /(https?:\/\/[^\s<>'"]+)/gi

  return segment.replace(urlRegex, (match) => {
    let url = match
    let trailing = ''

    const punctuationMatch = url.match(TRAILING_PUNCTUATION_REGEX)
    if (punctuationMatch) {
      trailing = punctuationMatch[0]
      url = url.slice(0, -trailing.length)
    }

    if (!url) {
      return match
    }

    const href = escapeAttribute(url)
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>${trailing}`
  })
}

const linkifyText = (value) => {
  if (!value) return ''

  const parts = String(value).split(/(<[^>]+>)/g)
  let insideAnchor = false

  return parts
    .map((part) => {
      if (!part) return ''

      if (part.startsWith('<') && part.endsWith('>')) {
        if (/^<a\b/i.test(part)) {
          insideAnchor = true
        } else if (/^<\/a>/i.test(part)) {
          insideAnchor = false
        }
        return part
      }

      if (insideAnchor) {
        return part
      }

      return linkifySegment(part)
    })
    .join('')
}

export default linkifyText
