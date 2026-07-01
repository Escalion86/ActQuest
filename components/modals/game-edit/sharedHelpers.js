/**
 * Общие текстовые/форматирующие утилиты для модалок game-edit и game-tasks.
 * Вынесены из GameEditModal.js для переиспользования.
 */

export const stripHtmlToPlainText = (value) =>
  String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&/gi, '&')
    .replace(/</gi, '<')
    .replace(/>/gi, '>')
    .replace(/\r?\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

export const normalizeComparablePlainText = (value) =>
  String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

export const normalizeComparableEditorPlainText = (value) =>
  normalizeComparablePlainText(stripHtmlToPlainText(value))

export const hasHtmlMarkup = (value) => /<[^>]+>/i.test(String(value || ''))

export const isInitialEditorHtmlNormalization = ({
  nextPlainText,
  nextRichText,
  currentPlainText,
  currentRichText,
}) => {
  if (String(currentRichText || '').trim() !== '') {
    return false
  }
  if (!hasHtmlMarkup(currentPlainText)) {
    return false
  }

  const normalizedCurrent = normalizeComparableEditorPlainText(currentPlainText)
  return (
    normalizeComparableEditorPlainText(nextPlainText) === normalizedCurrent &&
    normalizeComparableEditorPlainText(nextRichText) === normalizedCurrent
  )
}

export const hasMeaningfulRichMarkup = (value) =>
  /<(?!\/?(p|br|div|span)\b)[^>]+>/i.test(String(value || ''))

export const normalizeComparableRichText = (richValue, plainValue) => {
  const rich = typeof richValue === 'string' ? richValue.trim() : ''
  if (!rich) {
    return ''
  }
  const normalizedPlain = normalizeComparablePlainText(plainValue)
  const normalizedRichPlain = normalizeComparablePlainText(
    stripHtmlToPlainText(rich),
  )
  if (
    normalizedRichPlain === normalizedPlain &&
    !hasMeaningfulRichMarkup(rich)
  ) {
    return ''
  }
  return rich
}

const normalizeComparableMediaItem = (item) => ({
  type:
    item?.type === 'audio' ? 'audio' : item?.type === 'video' ? 'video' : 'image',
  url: typeof item?.url === 'string' ? item.url.trim() : '',
})

export const normalizeComparableMediaList = (media) =>
  (Array.isArray(media) ? media : [])
    .map(normalizeComparableMediaItem)
    .filter((item) => item.url !== '')

export const areComparableMediaListsEqual = (left, right) =>
  JSON.stringify(normalizeComparableMediaList(left)) ===
  JSON.stringify(normalizeComparableMediaList(right))

export const compactSingleLine = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()

export const truncateWithDots = (value, maxLength = 56) => {
  const normalized = compactSingleLine(value)
  if (!normalized) {
    return ''
  }
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`
}

export const normalizeCodeDuplicateKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()

export const formatCodeItemsCount = (count) =>
  `${Math.max(0, Number(count) || 0)} шт.`

export const hasCoordinateValue = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value)
  }
  return typeof value === 'string' && value.trim() !== ''
}

export const getTaskDescriptionText = (task) => {
  const taskText = typeof task?.task === 'string' ? task.task.trim() : ''
  if (taskText) {
    return taskText
  }
  return stripHtmlToPlainText(task?.taskRich)
}

export const getClueText = (clue) => {
  const clueText = typeof clue?.clue === 'string' ? clue.clue.trim() : ''
  if (clueText) {
    return clueText
  }
  return stripHtmlToPlainText(clue?.clueRich)
}
