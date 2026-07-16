const STORY_COVER_MEDIA_ID = 'story-cover-image'

const normalizeMedia = (media) => (Array.isArray(media) ? media : [])

const isStoryCoverMedia = (item) => item?.id === STORY_COVER_MEDIA_ID

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
  const cover = normalizeMedia(currentMedia).find(isStoryCoverMedia)
  const contentMedia = normalizeMedia(editorMedia).filter(
    (item) => !isStoryCoverMedia(item),
  )

  return cover ? [cover, ...contentMedia] : contentMedia
}

export { STORY_COVER_MEDIA_ID }
