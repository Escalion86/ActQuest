const escapeHtml = (value) =>
  String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const normalizeLineBreaks = (value) => String(value || '').replace(/\r\n?/g, '\n')

const formatInlineMarkdownToHtml = (value) => {
  const escaped = escapeHtml(value)

  return escaped
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    )
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

export const markdownToHtml = (markdownValue) => {
  const source = normalizeLineBreaks(markdownValue).trim()
  if (!source) {
    return '<p></p>'
  }

  const lines = source.split('\n')
  const blocks = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    if (/^##\s+/.test(trimmed)) {
      blocks.push(`<h2>${formatInlineMarkdownToHtml(trimmed.replace(/^##\s+/, ''))}</h2>`)
      index += 1
      continue
    }

    if (/^###\s+/.test(trimmed)) {
      blocks.push(`<h3>${formatInlineMarkdownToHtml(trimmed.replace(/^###\s+/, ''))}</h3>`)
      index += 1
      continue
    }

    if (/^>\s*/.test(trimmed)) {
      const quoteLines = []
      while (index < lines.length && /^>\s*/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s*/, ''))
        index += 1
      }
      blocks.push(
        `<blockquote><p>${formatInlineMarkdownToHtml(quoteLines.join('<br>'))}</p></blockquote>`,
      )
      continue
    }

    if (/^```/.test(trimmed)) {
      index += 1
      const codeLines = []
      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length && /^```/.test(lines[index].trim())) {
        index += 1
      }
      blocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
      continue
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items = []
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ''))
        index += 1
      }
      blocks.push(
        `<ul>${items
          .map((item) => `<li>${formatInlineMarkdownToHtml(item)}</li>`)
          .join('')}</ul>`,
      )
      continue
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items = []
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ''))
        index += 1
      }
      blocks.push(
        `<ol>${items
          .map((item) => `<li>${formatInlineMarkdownToHtml(item)}</li>`)
          .join('')}</ol>`,
      )
      continue
    }

    const paragraphLines = []
    while (index < lines.length && lines[index].trim()) {
      paragraphLines.push(lines[index].trim())
      index += 1
    }
    blocks.push(`<p>${formatInlineMarkdownToHtml(paragraphLines.join('<br>'))}</p>`)
  }

  return blocks.join('') || '<p></p>'
}

const inlineHtmlToMarkdown = (node) => {
  if (!node) return ''
  const nodeType = Number(node.nodeType)
  if (nodeType === 3) {
    return String(node.textContent || '')
  }

  if (nodeType !== 1) {
    return ''
  }

  const tag = String(node.tagName || '').toLowerCase()
  const childText = Array.from(node.childNodes || [])
    .map((child) => inlineHtmlToMarkdown(child))
    .join('')

  if (tag === 'br') return '\n'
  if (tag === 'strong' || tag === 'b') return `**${childText}**`
  if (tag === 'em' || tag === 'i') return `*${childText}*`
  if (tag === 'del' || tag === 's') return `~~${childText}~~`
  if (tag === 'code') return `\`${childText}\``
  if (tag === 'a') {
    const href = String(node.getAttribute('href') || '').trim()
    return href ? `[${childText}](${href})` : childText
  }

  return childText
}

const blockHtmlToMarkdown = (node) => {
  if (!node || Number(node.nodeType) !== 1) {
    return ''
  }

  const tag = String(node.tagName || '').toLowerCase()

  if (tag === 'h2') {
    const text = inlineHtmlToMarkdown(node).trim()
    return text ? `## ${text}` : ''
  }

  if (tag === 'h3') {
    const text = inlineHtmlToMarkdown(node).trim()
    return text ? `### ${text}` : ''
  }

  if (tag === 'blockquote') {
    const text = inlineHtmlToMarkdown(node).trim()
    if (!text) return ''
    return text
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')
  }

  if (tag === 'pre') {
    const codeText = String(node.textContent || '').replace(/\s+$/, '')
    return codeText ? `\`\`\`\n${codeText}\n\`\`\`` : ''
  }

  if (tag === 'ul') {
    const items = Array.from(node.children || [])
      .filter((item) => String(item.tagName || '').toLowerCase() === 'li')
      .map((item) => {
        const text = inlineHtmlToMarkdown(item).trim()
        return text ? `- ${text}` : ''
      })
      .filter(Boolean)
    return items.join('\n')
  }

  if (tag === 'ol') {
    const items = Array.from(node.children || [])
      .filter((item) => String(item.tagName || '').toLowerCase() === 'li')
      .map((item, index) => {
        const text = inlineHtmlToMarkdown(item).trim()
        return text ? `${index + 1}. ${text}` : ''
      })
      .filter(Boolean)
    return items.join('\n')
  }

  const text = inlineHtmlToMarkdown(node)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text
}

export const htmlToMarkdown = (htmlValue) => {
  const source = String(htmlValue || '').trim()
  if (!source) return ''

  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return source.replace(/<[^>]+>/g, ' ').trim()
  }

  try {
    const parser = new window.DOMParser()
    const doc = parser.parseFromString(source, 'text/html')
    const blocks = Array.from(doc.body.childNodes || [])
      .map((node) => {
        if (Number(node.nodeType) === 3) {
          const text = String(node.textContent || '').trim()
          return text || ''
        }
        return blockHtmlToMarkdown(node)
      })
      .filter(Boolean)

    return blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
  } catch {
    return source.replace(/<[^>]+>/g, ' ').trim()
  }
}
