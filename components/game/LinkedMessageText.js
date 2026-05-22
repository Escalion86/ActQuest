import PropTypes from 'prop-types'

const URL_PATTERN = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi
const TRAILING_PUNCTUATION_PATTERN = /[.,!?;:)\]}]+$/

const splitUrlTrailingPunctuation = (value) => {
  const url = String(value || '')
  const trailing = url.match(TRAILING_PUNCTUATION_PATTERN)?.[0] || ''

  if (!trailing) {
    return { url, trailing: '' }
  }

  return {
    url: url.slice(0, -trailing.length),
    trailing,
  }
}

const normalizeHref = (url) =>
  /^https?:\/\//i.test(url) ? url : `https://${url}`

const LinkedMessageText = ({ text, linkClassName }) => {
  const value = String(text || '')
  if (!value) {
    return null
  }

  const parts = []
  let lastIndex = 0

  value.replace(URL_PATTERN, (match, _url, offset) => {
    if (offset > lastIndex) {
      parts.push(value.slice(lastIndex, offset))
    }

    const { url, trailing } = splitUrlTrailingPunctuation(match)
    if (url) {
      parts.push({
        href: normalizeHref(url),
        label: url,
      })
    }
    if (trailing) {
      parts.push(trailing)
    }

    lastIndex = offset + match.length
    return match
  })

  if (lastIndex < value.length) {
    parts.push(value.slice(lastIndex))
  }

  return (
    <>
      {parts.map((part, index) => {
        if (typeof part === 'string') {
          return part
        }

        return (
          <a
            key={`${part.href}-${index}`}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
          >
            {part.label}
          </a>
        )
      })}
    </>
  )
}

LinkedMessageText.propTypes = {
  text: PropTypes.string,
  linkClassName: PropTypes.string,
}

LinkedMessageText.defaultProps = {
  text: '',
  linkClassName: 'font-semibold underline underline-offset-2',
}

export default LinkedMessageText
