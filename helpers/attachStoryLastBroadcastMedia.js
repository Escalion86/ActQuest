const clone = (value) => JSON.parse(JSON.stringify(value))

const toMedia = (file, { id, title = '' } = {}) => ({
  id: id || file?.key || '',
  type: file?.type || 'image',
  url: file?.url || '',
  mime: file?.mime || '',
  size: Number(file?.size) || 0,
  duration: Number(file?.duration) || 0,
  path: file?.path || '',
  title: title || file?.title || '',
})

const upsertMedia = (media, entry) => [
  ...(Array.isArray(media) ? media : []).filter(
    (item) => item?.id !== entry.id && item?.url !== entry.url,
  ),
  entry,
]

const evidenceImageSources = {
  ev_watch_heart_stop: 'item_smartwatch',
  ev_echo_queue_log: 'item_audio_2005',
  ev_duplicate_waveform: 'item_audio_1721',
  ev_missing_trophy_fragment: 'item_trophy',
  ev_recovered_trophy: 'item_trophy',
}

const attachStoryLastBroadcastMedia = (sourceScenario, mediaManifest) => {
  const scenario = clone(sourceScenario)
  const files = Array.isArray(mediaManifest?.files) ? mediaManifest.files : []
  const byKey = new Map(files.map((file) => [file.key, file]))
  const requireFile = (key) => {
    const file = byKey.get(key)
    if (!file?.url) throw new Error(`В медиаманифесте отсутствует ${key}`)
    return file
  }

  const cover = requireFile('image:cover:game')
  scenario.image = cover.url

  for (const character of scenario.storyCharacters || []) {
    const file = requireFile(`image:characters:${character.id}`)
    character.image = file.url
  }

  const itemImages = new Map()
  for (const item of scenario.storyItems || []) {
    const file = requireFile(`image:items:${item.id}`)
    item.image = file.url
    itemImages.set(item.id, file)
    item.media = upsertMedia(
      item.media,
      toMedia(file, {
        id: `image-${item.id}`,
        title: item.title,
      }),
    )
  }

  for (const node of scenario.storyNodes || []) {
    const file = requireFile(`image:locations:${node.id}`)
    node.media = upsertMedia(
      node.media,
      toMedia(file, {
        id: `image-${node.id}`,
        title: node.title,
      }),
    )
  }

  for (const ending of scenario.storyEndings || []) {
    const image = byKey.get(`image:endings:${ending.id}`)
    if (image?.url) {
      ending.media = upsertMedia(
        ending.media,
        toMedia(image, {
          id: `image-${ending.id}`,
          title: ending.title,
        }),
      )
    }
  }

  for (const evidence of scenario.storyEvidence || []) {
    const itemId = evidenceImageSources[evidence.id]
    const file = itemId ? itemImages.get(itemId) : null
    if (file?.url) {
      evidence.media = upsertMedia(
        evidence.media,
        toMedia(file, {
          id: `image-${evidence.id}`,
          title: evidence.title,
        }),
      )
    }
  }

  const nodesById = new Map(
    (scenario.storyNodes || []).map((node) => [node.id, node]),
  )
  const interactionsById = new Map(
    (scenario.storyInteractions || []).map((interaction) => [
      interaction.id,
      interaction,
    ]),
  )
  const endingsById = new Map(
    (scenario.storyEndings || []).map((ending) => [ending.id, ending]),
  )

  const audioFiles = files
    .filter((file) => file.type === 'audio' && file.sceneNumber)
    .sort((a, b) => a.sceneNumber - b.sceneNumber)
  for (const file of audioFiles) {
    const targetType = file.target?.type
    const targetId = file.target?.id
    let target = null
    if (targetType === 'prologue') target = nodesById.get('loc_reception')
    if (targetType === 'location') target = nodesById.get(targetId)
    if (targetType === 'interaction') target = interactionsById.get(targetId)
    if (targetType === 'ending') target = endingsById.get(targetId)
    if (!target) {
      throw new Error(
        `Не найдена цель аудиосцены ${file.sceneNumber}: ${targetType}/${targetId}`,
      )
    }
    target.media = upsertMedia(
      target.media,
      toMedia(file, {
        id: `audio-scene-${String(file.sceneNumber).padStart(2, '0')}`,
        title: file.title,
      }),
    )
  }

  return scenario
}

export default attachStoryLastBroadcastMedia
