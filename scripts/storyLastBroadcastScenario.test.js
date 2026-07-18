import assert from 'node:assert/strict'
import test from 'node:test'

import storyLastBroadcastScenario from '../data/storyLastBroadcastScenario.js'
import { getStoryValidationErrors } from '../helpers/isGameHaveErrors.js'
import {
  applyInvestigationInteraction,
  buildInitialInvestigationProgress,
  getAvailableInvestigationInteractions,
  submitInvestigationAccusation,
  travelInvestigation,
} from '../server/storyInvestigationEngine.js'

const NOW = new Date('2026-07-15T12:00:00.000Z')
const game = storyLastBroadcastScenario

const EXPECTED_INTERACTION_IDS = [
  'int_marina_victim', 'int_marina_timeline', 'int_marina_broadcast',
  'int_marina_voice', 'int_marina_warm_city', 'int_marina_quartz',
  'int_gleb_victim', 'int_gleb_quarrel', 'int_gleb_broadcast',
  'int_gleb_soundcheck', 'int_kirill_voice', 'int_kirill_access',
  'int_kirill_camera', 'int_kirill_broadcast', 'int_vera_broadcast',
  'int_vera_dossier', 'int_vera_marina', 'int_denis_broadcast',
  'int_denis_victim', 'int_denis_cafe', 'int_tamara_victim',
  'int_tamara_warm_city', 'int_tamara_quartz', 'int_pavel_timeline',
  'int_pavel_camera_confrontation', 'int_pavel_trophy', 'act_inspect_body',
  'act_inspect_trophy_case', 'act_inspect_studio_door',
  'act_inspect_badge_log', 'act_inspect_echo_log',
  'act_find_soundcheck_source', 'act_search_draft_email',
  'act_reconcile_charity_reports', 'act_search_warm_city_box',
  'act_export_watch_data', 'act_compare_audio', 'act_analyze_trophy',
]

const travel = (progress, targetNodeId) => {
  const result = travelInvestigation({ game, progress, targetNodeId, now: NOW })
  assert.equal(result.applied, true, `travel ${targetNodeId}: ${result.reason}`)
  return result.progress
}

const interact = (progress, interactionId) => {
  const result = applyInvestigationInteraction({ game, progress, interactionId, now: NOW })
  assert.equal(result.applied, true, `${interactionId}: ${result.reason}`)
  return result.progress
}

const buildSolvedRoute = () => {
  let progress = buildInitialInvestigationProgress(game, { now: NOW })
  progress = interact(progress, 'int_marina_victim')
  progress = travel(progress, 'loc_studio_b')
  progress = interact(progress, 'act_inspect_body')
  progress = interact(progress, 'act_inspect_studio_door')
  progress = interact(progress, 'act_inspect_badge_log')
  progress = travel(progress, 'loc_control_room')
  progress = interact(progress, 'int_kirill_broadcast')
  progress = interact(progress, 'act_inspect_echo_log')
  progress = interact(progress, 'act_find_soundcheck_source')
  progress = travel(progress, 'loc_police_lab')
  progress = interact(progress, 'act_export_watch_data')
  progress = interact(progress, 'act_compare_audio')
  progress = travel(progress, 'loc_newsroom')
  progress = interact(progress, 'int_vera_broadcast')
  progress = interact(progress, 'int_vera_dossier')
  progress = interact(progress, 'act_search_draft_email')
  progress = travel(progress, 'loc_reception')
  progress = interact(progress, 'int_tamara_warm_city')
  progress = travel(progress, 'loc_newsroom')
  progress = interact(progress, 'act_reconcile_charity_reports')
  progress = travel(progress, 'loc_reception')
  return progress
}

test('«Последний эфир» содержит полный канонический набор сцен и проходит validation', () => {
  assert.equal(game.storyNodes.length, 7)
  assert.equal(game.storyCharacters.length, 7)
  assert.equal(game.storyTopics.length, 15)
  assert.equal(game.storyEvidence.length, 15)
  assert.equal(game.storyInteractions.length, 38)
  assert.equal(game.storyEndings.length, 6)
  assert.deepEqual(
    game.storyInteractions.map(({ id }) => id).sort(),
    [...EXPECTED_INTERACTION_IDS].sort(),
  )
  game.storyInteractions.forEach((interaction) => {
    assert.ok(
      interaction.responseRich.replace(/<[^>]+>/g, '').length >= 80,
      `${interaction.id} содержит слишком короткий сценарный ответ`,
    )
  })
  game.storyInteractions
    .filter(({ characterId }) => Boolean(characterId))
    .forEach((interaction) => {
      assert.ok(
        (interaction.responseRich.match(/<p>/g) || []).length >= 2,
        `${interaction.id} должен содержать литературную подачу и реплику`,
      )
    })
  game.storyCharacters.forEach((character) => {
    assert.match(character.descriptionRich, /<strong>Внешность\.<\/strong>/)
    assert.match(character.descriptionRich, /<strong>Характер\.<\/strong>/)
    assert.match(character.descriptionRich, /<strong>Манера речи\.<\/strong>/)
  })
  const perfectEnding = game.storyEndings.find(
    ({ id }) => id === 'ending_perfect_case',
  )
  assert.ok(perfectEnding?.descriptionRich.includes('Что произошло на самом деле'))
  assert.ok(perfectEnding?.descriptionRich.includes('19:43:18'))
  assert.ok(perfectEnding?.descriptionRich.includes('AV_check_1721.wav'))
  assert.ok(perfectEnding?.descriptionRich.replace(/<[^>]+>/g, '').length >= 2000)
  assert.deepEqual(getStoryValidationErrors(game), [])
})

test('диалоги стоят 5 минут, а переезды — 10 минут', () => {
  const dialogues = game.storyInteractions.filter(({ characterId }) => Boolean(characterId))

  assert.ok(dialogues.length > 0)
  dialogues.forEach((dialogue) => {
    assert.equal(dialogue.timeCostMinutes, 5, dialogue.id)
  })
  assert.equal(game.storyConfig.investigation.defaultTravelTimeMinutes, 10)
  assert.equal(
    game.storyInteractions.find(({ id }) => id === 'act_inspect_body')?.timeCostMinutes,
    10,
  )
  assert.equal(
    game.storyInteractions.find(({ id }) => id === 'act_export_watch_data')?.timeCostMinutes,
    20,
  )
})

test('расследование начинается в 20:40 и стартовые тексты не раскрывают разгадку', () => {
  const investigation = game.storyConfig.investigation
  const timeoutEnding = game.storyEndings.find(({ id }) => id === 'ending_timeout')
  const initialCopy = [
    game.description,
    game.descriptionRich,
    ...game.storyNodes.map(({ descriptionRich }) => descriptionRich),
  ].join('\n')

  assert.equal(investigation.startClockMinutes, 1240)
  assert.equal(investigation.deadlineMinutes, 240)
  assert.match(game.descriptionRich, /20:40/)
  assert.match(game.descriptionRich, /00:40/)
  assert.match(timeoutEnding?.descriptionRich || '', /00:40/)
  assert.doesNotMatch(initialCopy, /00:20|старая запись|голос и время смерти не совпадали|запись в алиби/i)
})

test('«Последний эфир» проходит минимальный доказательный маршрут', () => {
  const progress = buildSolvedRoute()
  const result = submitInvestigationAccusation({
    game,
    progress,
    culpritId: 'char_marina_lebedeva',
    motiveId: 'motive_charity_fraud',
    evidenceIds: [
      'ev_watch_heart_stop',
      'ev_echo_queue_log',
      'ev_marina_badge_log',
      'ev_draft_email',
    ],
    now: NOW,
  })
  assert.equal(result.applied, true)
  assert.equal(result.endingId, 'ending_solved')
  assert.ok(result.progress.elapsedMinutes <= 240)
})

test('сюжетные действия открываются только после объясняющих их разговоров', () => {
  let progress = buildInitialInvestigationProgress(game, { now: NOW })

  progress = interact(progress, 'int_marina_victim')
  assert.equal(progress.unlockedTopicIds.includes('topic_quarrel'), false)
  progress = interact(progress, 'int_marina_broadcast')
  assert.equal(progress.unlockedTopicIds.includes('topic_dossier'), false)

  progress = travel(progress, 'loc_newsroom')
  let availableIds = new Set(
    getAvailableInvestigationInteractions(game, progress).map(({ id }) => id),
  )
  assert.equal(availableIds.has('int_vera_dossier'), false)
  assert.equal(availableIds.has('act_search_draft_email'), false)
  assert.equal(availableIds.has('act_reconcile_charity_reports'), false)

  progress = interact(progress, 'int_vera_broadcast')
  availableIds = new Set(
    getAvailableInvestigationInteractions(game, progress).map(({ id }) => id),
  )
  assert.equal(availableIds.has('int_vera_dossier'), true)
  assert.equal(availableIds.has('act_search_draft_email'), false)
  assert.equal(availableIds.has('act_reconcile_charity_reports'), false)

  progress = interact(progress, 'int_vera_dossier')
  availableIds = new Set(
    getAvailableInvestigationInteractions(game, progress).map(({ id }) => id),
  )
  assert.equal(availableIds.has('act_search_draft_email'), true)
  assert.equal(availableIds.has('act_reconcile_charity_reports'), false)

  progress = travel(progress, 'loc_reception')
  progress = interact(progress, 'int_tamara_warm_city')
  progress = travel(progress, 'loc_newsroom')
  availableIds = new Set(
    getAvailableInvestigationInteractions(game, progress).map(({ id }) => id),
  )
  assert.equal(availableIds.has('act_reconcile_charity_reports'), true)
})

test('сверка отчётов требует разговора с Тамарой без дублирующего условия темы', () => {
  const interaction = game.storyInteractions.find(
    ({ id }) => id === 'act_reconcile_charity_reports',
  )

  assert.deepEqual(interaction.conditions.requiredInteractionIds, [
    'int_tamara_warm_city',
  ])
  assert.deepEqual(interaction.conditions.requiredTopicIds, [])
})

test('журнал «Эхо-9» требует наводку Кирилла и только затем открывает soundcheck', () => {
  let progress = buildInitialInvestigationProgress(game, { now: NOW })
  progress = travel(progress, 'loc_studio_b')
  progress = interact(progress, 'act_inspect_studio_door')
  progress = travel(progress, 'loc_control_room')

  let availableIds = new Set(
    getAvailableInvestigationInteractions(game, progress).map(({ id }) => id),
  )
  assert.equal(availableIds.has('act_inspect_echo_log'), false)

  progress = interact(progress, 'int_kirill_voice')
  assert.equal(progress.unlockedTopicIds.includes('topic_soundcheck'), false)
  availableIds = new Set(
    getAvailableInvestigationInteractions(game, progress).map(({ id }) => id),
  )
  assert.equal(availableIds.has('act_inspect_echo_log'), true)

  progress = interact(progress, 'act_inspect_echo_log')
  assert.equal(progress.unlockedTopicIds.includes('topic_soundcheck'), true)
})

test('идеальный маршрут «Последнего эфира» находит орудие до 230-й минуты', () => {
  let progress = buildInitialInvestigationProgress(game, { now: NOW })
  progress = travel(progress, 'loc_studio_b')
  progress = interact(progress, 'act_inspect_body')
  progress = interact(progress, 'act_inspect_studio_door')
  progress = interact(progress, 'act_inspect_badge_log')
  progress = travel(progress, 'loc_loading_dock')
  progress = interact(progress, 'int_pavel_timeline')
  progress = interact(progress, 'int_pavel_trophy')
  progress = interact(progress, 'act_search_warm_city_box')
  progress = travel(progress, 'loc_control_room')
  progress = interact(progress, 'int_kirill_broadcast')
  progress = interact(progress, 'act_inspect_echo_log')
  progress = travel(progress, 'loc_police_lab')
  progress = interact(progress, 'act_export_watch_data')
  progress = interact(progress, 'act_analyze_trophy')
  progress = travel(progress, 'loc_newsroom')
  progress = interact(progress, 'int_vera_broadcast')
  progress = interact(progress, 'int_vera_dossier')
  progress = interact(progress, 'act_search_draft_email')
  progress = travel(progress, 'loc_reception')
  const result = submitInvestigationAccusation({
    game,
    progress,
    culpritId: 'char_marina_lebedeva',
    motiveId: 'motive_charity_fraud',
    evidenceIds: [
      'ev_watch_heart_stop',
      'ev_echo_queue_log',
      'ev_draft_email',
      'ev_recovered_trophy',
    ],
    now: NOW,
  })
  assert.equal(result.endingId, 'ending_perfect_case')
  assert.ok(result.progress.elapsedMinutes <= 230)
})

test('wrong motive, wrong culprit and weak case lead to distinct story endings', () => {
  const base = buildSolvedRoute()
  const wrongMotive = submitInvestigationAccusation({
    game,
    progress: base,
    culpritId: 'char_marina_lebedeva',
    motiveId: 'motive_plagiarism',
    evidenceIds: ['ev_echo_queue_log'],
    now: NOW,
  })
  assert.equal(wrongMotive.endingId, 'ending_wrong_motive')

  const wrongCulprit = submitInvestigationAccusation({
    game,
    progress: base,
    culpritId: 'char_gleb_orlov',
    motiveId: 'motive_charity_fraud',
    evidenceIds: ['ev_gleb_live_recording'].filter((id) =>
      base.discoveredEvidenceIds.includes(id),
    ),
    now: NOW,
  })
  assert.equal(wrongCulprit.endingId, 'ending_wrong_accusation')

  const weak = submitInvestigationAccusation({
    game,
    progress: base,
    culpritId: 'char_marina_lebedeva',
    motiveId: 'motive_charity_fraud',
    evidenceIds: [],
    now: NOW,
  })
  assert.equal(weak.endingId, 'ending_right_suspect_weak_case')
})

test('повтор ответа бесплатен, а выход за deadline даёт timeout', () => {
  let progress = buildInitialInvestigationProgress(game, { now: NOW })
  progress = travel(progress, 'loc_newsroom')
  progress = interact(progress, 'int_vera_broadcast')
  const elapsed = progress.elapsedMinutes
  const repeated = applyInvestigationInteraction({
    game,
    progress,
    interactionId: 'int_vera_broadcast',
    now: NOW,
  })
  assert.equal(repeated.applied, false)
  assert.equal(repeated.reason, 'interaction_already_used')
  assert.equal(repeated.progress.elapsedMinutes, elapsed)

  progress = interact(progress, 'int_vera_dossier')

  const timeout = applyInvestigationInteraction({
    game,
    progress: { ...progress, elapsedMinutes: 235 },
    interactionId: 'act_search_draft_email',
    now: NOW,
  })
  assert.equal(timeout.reason, 'deadline_exceeded')
  assert.equal(timeout.progress.currentEndingId, 'ending_timeout')
})
