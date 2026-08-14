const normalizeEditorLinkHref = (value) => {
  const source = String(value || '').trim()
  if (!source) return ''

  if (/^(?:https?:\/\/|mailto:|tel:)/i.test(source)) return source
  if (/^\/\//.test(source)) return `http:${source}`
  if (/^(?:\/|#)/.test(source)) return source
  if (/^[a-z][a-z\d+.-]*:/i.test(source)) return ''

  return `http://${source}`
}

export default normalizeEditorLinkHref
