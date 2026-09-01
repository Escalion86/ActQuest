const STORY_COVER_MEDIA_ID = 'story-cover-image'

const normalizeMedia = (media) => (Array.isArray(media) ? media : [])

const isStoryCoverMedia = (item) => item?.id === STORY_COVER_MEDIA_ID

const isMediaType = (type) => (item) => item?.type === type

const isAudioMedia = isMediaType('audio')
const isVideoMedia = isMediaType('video')

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
    (item) =>
      isStoryCoverMedia(item) || isAudioMedia(item) || isVideoMedia(item),
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

export const getStoryMediaByType = (media, type) =>
  normalizeMedia(media).filter(isMediaType(type))

export const setStoryMediaByType = (media, type, typedMedia) => {
  const matchesType = isMediaType(type)
  const currentMedia = normalizeMedia(media)
  const nextMedia = normalizeMedia(typedMedia).filter(matchesType)
  const firstMediaIndex = currentMedia.findIndex(matchesType)
  const remainingMedia = currentMedia.filter((item) => !matchesType(item))
  const insertIndex =
    firstMediaIndex < 0
      ? remainingMedia.length
      : currentMedia
          .slice(0, firstMediaIndex)
          .filter((item) => !matchesType(item)).length

  return [
    ...remainingMedia.slice(0, insertIndex),
    ...nextMedia,
    ...remainingMedia.slice(insertIndex),
  ]
}

export const setStoryAudioMedia = (media, audioMedia) =>
  setStoryMediaByType(media, 'audio', audioMedia)

export { STORY_COVER_MEDIA_ID }
