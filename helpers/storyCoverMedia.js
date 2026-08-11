const STORY_COVER_MEDIA_ID = 'story-cover-image'

const normalizeMedia = (media) => (Array.isArray(media) ? media : [])

const isStoryCoverMedia = (item) => item?.id === STORY_COVER_MEDIA_ID

const isAudioMedia = (item) => item?.type === 'audio'

export const getStoryCoverImage = (media) =>
  normalizeMedia(media).find(isStoryCoverMedia)?.url || ''

export const setStoryCoverImage = (media, imageUrl) => {
  const remainingMedia = normalizeMedia(media).filter(
    (item) => !isStoryCoverMedia(item),
  )
  const normalizedUrl = typeof imageUrl === 'string' ? imageUrl.trim() : ''

  if (!normalizedUrl) return remainingMedia

  return [
    {
      id: STORY_COVER_MEDIA_ID,
      type: 'image',
      url: normalizedUrl,
      title: '',
    },
    ...remainingMedia,
  ]
}

export const mergeStoryEditorMedia = (currentMedia, editorMedia) => {
  const retainedMedia = normalizeMedia(currentMedia).filter(
    (item) => isStoryCoverMedia(item) || isAudioMedia(item),
  )
  const contentMedia = normalizeMedia(editorMedia).filter(
    (item) => !isStoryCoverMedia(item),
  )

  const seen = new Set()
  return [...retainedMedia, ...contentMedia].filter((item) => {
    const key = item?.url || item?.id
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const getStoryAudioMedia = (media) =>
  normalizeMedia(media).filter(isAudioMedia)

export const setStoryAudioMedia = (media, audioMedia) => {
  const currentMedia = normalizeMedia(media)
  const nextAudio = normalizeMedia(audioMedia).filter(isAudioMedia)
  const firstAudioIndex = currentMedia.findIndex(isAudioMedia)
  const remainingMedia = currentMedia.filter((item) => !isAudioMedia(item))
  const insertIndex =
    firstAudioIndex < 0
      ? remainingMedia.length
      : currentMedia
          .slice(0, firstAudioIndex)
          .filter((item) => !isAudioMedia(item)).length

  return [
    ...remainingMedia.slice(0, insertIndex),
    ...nextAudio,
    ...remainingMedia.slice(insertIndex),
  ]
}

export { STORY_COVER_MEDIA_ID }
