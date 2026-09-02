import assert from 'node:assert/strict'
import test from 'node:test'

import buildStoryClientConfig from '../helpers/buildStoryClientConfig.js'
import { buildStoryInvestigationGraph } from '../helpers/buildStoryInvestigationGraph.js'
import pauseOtherAudioElements from '../helpers/audioPlayback.js'
import canCreateStoryGame from '../helpers/storyGameAccess.js'
import {
  getStoryAudioMedia,
  getStoryCoverImage,
  getStoryMediaByType,
  mergeStoryEditorMedia,
  setStoryAudioMedia,
  setStoryCoverImage,
  setStoryMediaByType,
} from '../helpers/storyCoverMedia.js'
import lastBroadcastScenario from '../data/storyLastBroadcastScenario.js'

test('игроковая проекция сохраняет режим расследования', () => {
  assert.deepEqual(
    buildStoryClientConfig({
      type: 'story',
      storyConfig: { experienceMode: 'investigation' },
    }),
    { experienceMode: 'investigation' },
  )
})

test('обычный story-квест не превращается в расследование', () => {
  assert.deepEqual(buildStoryClientConfig({ type: 'story' }), {
    experienceMode: 'quest',
  })
  assert.equal(buildStoryClientConfig({ type: 'classic' }), null)
})

test('администраторы и разработчики могут создавать story-игры', () => {
  assert.equal(canCreateStoryGame('admin'), true)
  assert.equal(canCreateStoryGame('dev'), true)
  assert.equal(canCreateStoryGame('ADMIN'), true)
  assert.equal(canCreateStoryGame('client'), false)
  assert.equal(canCreateStoryGame('moder'), false)
  assert.equal(canCreateStoryGame(null), false)
})

test('обложка story-сущности сохраняется отдельно от медиа rich-text редактора', () => {
  const withCover = setStoryCoverImage(
    [
      { id: 'audio-1', type: 'audio', url: '/audio.mp3' },
      { id: 'video-1', type: 'video', url: '/video.mp4' },
    ],
    '/cover.jpg',
  )

  assert.equal(getStoryCoverImage(withCover), '/cover.jpg')
  assert.deepEqual(
    mergeStoryEditorMedia(withCover, [
      { id: 'image-1', type: 'image', url: '/inside.jpg' },
    ]),
    [
      {
        id: 'story-cover-image',
        type: 'image',
        url: '/cover.jpg',
        title: '',
      },
      { id: 'audio-1', type: 'audio', url: '/audio.mp3' },
      { id: 'video-1', type: 'video', url: '/video.mp4' },
      { id: 'image-1', type: 'image', url: '/inside.jpg' },
    ],
  )
  assert.deepEqual(getStoryAudioMedia(withCover), [
    { id: 'audio-1', type: 'audio', url: '/audio.mp3' },
  ])
  assert.deepEqual(
    setStoryAudioMedia(withCover, [
      { id: 'audio-2', type: 'audio', url: '/replacement.mp3' },
    ]),
    [
      {
        id: 'story-cover-image',
        type: 'image',
        url: '/cover.jpg',
        title: '',
      },
      { id: 'audio-2', type: 'audio', url: '/replacement.mp3' },
      { id: 'video-1', type: 'video', url: '/video.mp4' },
    ],
  )
  assert.deepEqual(getStoryMediaByType(withCover, 'video'), [
    { id: 'video-1', type: 'video', url: '/video.mp4' },
  ])
  assert.deepEqual(
    setStoryMediaByType(withCover, 'video', [
      { id: 'video-2', type: 'video', url: '/replacement.mp4' },
    ]),
    [
      {
        id: 'story-cover-image',
        type: 'image',
        url: '/cover.jpg',
        title: '',
      },
      { id: 'audio-1', type: 'audio', url: '/audio.mp3' },
      { id: 'video-2', type: 'video', url: '/replacement.mp4' },
    ],
  )
  assert.equal(getStoryCoverImage(setStoryCoverImage(withCover, '')), '')
})

test('запуск аудиодорожки останавливает остальные проигрыватели', () => {
  const previousDocument = globalThis.document
  const previousAudioElement = globalThis.HTMLAudioElement

  class FakeAudioElement {
    constructor(paused) {
      this.paused = paused
      this.pauseCalls = 0
    }

    pause() {
      this.paused = true
      this.pauseCalls += 1
    }
  }

  const playingAudio = new FakeAudioElement(false)
  const currentAudio = new FakeAudioElement(false)
  const pausedAudio = new FakeAudioElement(true)
  globalThis.HTMLAudioElement = FakeAudioElement
  globalThis.document = {
    querySelectorAll: () => [playingAudio, currentAudio, pausedAudio],
  }

  try {
    pauseOtherAudioElements(currentAudio)
    assert.equal(playingAudio.pauseCalls, 1)
    assert.equal(currentAudio.pauseCalls, 0)
    assert.equal(pausedAudio.pauseCalls, 0)
  } finally {
    if (previousDocument === undefined) delete globalThis.document
    else globalThis.document = previousDocument
    if (previousAudioElement === undefined) delete globalThis.HTMLAudioElement
    else globalThis.HTMLAudioElement = previousAudioElement
  }
})

test('карта расследования строит причинную цепочку Soundcheck 17:21', () => {
  const graph = buildStoryInvestigationGraph(lastBroadcastScenario)

  assert.equal(graph.nodes.filter((node) => node.type === 'location-group').length, 7)
  assert.equal(graph.nodes.filter((node) => node.type === 'interaction').length, 38)
  assert.deepEqual(graph.diagnostics, [])
  assert.ok(
    graph.edges.some((edge) =>
      edge.source === 'int_kirill_voice' &&
      edge.target === 'act_inspect_echo_log' &&
      edge.refKey === 'flag:flag_echo_queue_identified'),
  )
  assert.ok(
    graph.edges.some((edge) =>
      edge.source === 'act_find_soundcheck_source' &&
      edge.target === 'act_compare_audio' &&
      edge.label === 'Soundcheck 17:21'),
  )
  assert.deepEqual(
    graph.index.producers.get('item:item_audio_1721'),
    ['act_find_soundcheck_source'],
  )
  assert.deepEqual(
    graph.nodes
      .find((node) => node.id === 'act_reconcile_charity_reports')
      ?.required.map((entry) => entry.label),
    ['После: Спросить Тамару об отчётах'],
  )
  assert.equal(
    graph.nodes
      .find((node) => node.id === 'int_tamara_victim')
      ?.results.find((entry) => entry.id === 'ev_tamara_video_call')
      ?.shortLabel,
    'Видеозвонок Тамары',
  )
  assert.equal(
    graph.nodes
      .find((node) => node.id === 'int_tamara_victim')
      ?.results.find((entry) => entry.id === 'ev_tamara_video_call')
      ?.label,
    'Улика: Видеозвонок Тамары',
  )
  assert.equal(
    graph.nodes
      .find((node) => node.id === 'int_pavel_camera_confrontation')
      ?.required.find((entry) => entry.id === 'ev_kirill_sale_chat')
      ?.label,
    'Улика: Переписка Кирилла о продаже микрофонов',
  )
  assert.equal(
    graph.nodes
      .find((node) => node.id === 'int_kirill_voice')
      ?.results.find((entry) => entry.type === 'flag')
      ?.label,
    'Условие для: Проверить очередь «Эхо-9»',
  )
  assert.equal(
    graph.nodes
      .find((node) => node.id === 'act_inspect_echo_log')
      ?.required.find((entry) => entry.type === 'flag')
      ?.label,
    'После: Спросить Кирилла о голосе или Спросить Кирилла о несостоявшемся эфире',
  )
  assert.equal(
    graph.nodes
      .find((node) => node.id === 'act_search_warm_city_box')
      ?.required.find((entry) => entry.type === 'flag')
      ?.label,
    'После: Прижать Павла журналом карты',
  )
  assert.equal(
    graph.nodes
      .find((node) => node.id === 'int_pavel_trophy')
      ?.results.find((entry) => entry.id === 'flag_warm_city_box_identified')
      ?.label,
    'Условие для: Обыскать коробку «Тёплого города»',
  )
  assert.equal(
    graph.nodes
      .find((node) => node.id === 'int_pavel_trophy')
      ?.results.some((entry) => entry.id === 'flag_pavel_confessed'),
    false,
  )
  assert.equal(
    graph.nodes
      .find((node) => node.id === 'act_inspect_badge_log')
      ?.required.find((entry) => entry.id === 'topic_access_cards')
      ?.label,
    'Тема: Карты доступа',
  )
  assert.equal(
    graph.nodes
      .find((node) => node.id === 'act_export_watch_data')
      ?.required.find((entry) => entry.id === 'item_smartwatch')
      ?.label,
    'Предмет: Умные часы Артёма',
  )
  assert.equal(
    graph.nodes
      .find((node) => node.id === 'act_inspect_body')
      ?.results.find((entry) => entry.id === 'loc_police_lab')
      ?.label,
    'Локация: Мобильная лаборатория',
  )
  assert.ok(
    graph.nodes
      .find((node) => node.id === 'int_vera_broadcast')
      ?.results.some((entry) => entry.label === 'Тема: Марафон «Тёплый город»'),
  )
  assert.ok(
    graph.nodes
      .find((node) => node.id === 'int_marina_victim')
      ?.results.some((entry) => entry.label === 'Персонаж: Тамара Воронцова'),
  )
})

test('карта расследования отдельно показывает локации и дерево финалов', () => {
  const locations = buildStoryInvestigationGraph(lastBroadcastScenario, {
    mode: 'locations',
  })
  const finals = buildStoryInvestigationGraph(lastBroadcastScenario, {
    mode: 'finals',
  })

  assert.equal(locations.nodes.length, 7)
  assert.ok(locations.edges.some((edge) => edge.relation === 'unlock'))
  assert.equal(finals.nodes.filter((node) => node.type === 'outcome').length, 5)
  assert.equal(finals.nodes.filter((node) => node.type === 'ending').length, 6)
  assert.equal(finals.edges.length, 10)
})
