import assert from 'node:assert/strict'
import test from 'node:test'
import mongoose from 'mongoose'

import {
  applyInvestigationInteraction,
  buildInitialInvestigationProgress,
  getInvestigationClock,
  submitInvestigationAccusation,
  travelInvestigation,
  upgradeInvestigationProgress,
} from '../server/storyInvestigationEngine.js'

const NOW = new Date('2026-07-15T12:00:00.000Z')

const buildGame = () => ({
  type: 'story',
  storyConfig: {
    experienceMode: 'investigation',
    investigation: {
      startNodeId: 'reception',
      startClockMinutes: 20 * 60 + 20,
      deadlineMinutes: 40,
      defaultTravelTimeMinutes: 10,
      defaultInteractionTimeMinutes: 10,
      accusationTimeMinutes: 10,
      allowFreeReplay: true,
      autoFailOnDeadline: true,
    },
  },
  storyNodes: [
    { id: 'reception', title: 'Приёмная', visibility: { startVisible: true } },
    { id: 'studio', title: 'Студия', visibility: { startVisible: true } },
  ],
  storyItems: [],
  storyCharacters: [
    { id: 'marina', title: 'Марина', startVisible: true, defaultNodeId: 'reception' },
    { id: 'gleb', title: 'Глеб', startVisible: true, defaultNodeId: 'studio' },
  ],
  storyTopics: [
    { id: 'timeline', title: 'Хронология', startVisible: true },
    { id: 'accuse', title: 'Обвинение', startVisible: false },
  ],
  storyEvidence: [
    { id: 'badge', title: 'Журнал карты', tags: ['opportunity'], weight: 1, isKey: true },
    { id: 'email', title: 'Черновик письма', tags: ['motive'], weight: 1, isKey: true },
  ],
  storyInteractions: [
    {
      id: 'ask-marina',
      kind: 'question',
      locationId: 'reception',
      characterId: 'marina',
      topicId: 'timeline',
      label: 'Спросить Марину',
      responseRich: '<p>Я была в кафе.</p>',
      timeCostMinutes: 10,
      conditions: {},
      effects: { grantsEvidenceIds: ['badge'], unlocksTopicIds: [] },
      journal: { title: 'Алиби Марины', summaryRich: '<p>Марина заявила об алиби.</p>', kind: 'testimony' },
    },
    {
      id: 'find-email',
      kind: 'examine',
      locationId: 'studio',
      label: 'Найти письмо',
      responseRich: '<p>Письмо назначено на 21:00.</p>',
      timeCostMinutes: 10,
      conditions: {},
      effects: { grantsEvidenceIds: ['email'] },
      journal: { title: 'Черновик письма', summaryRich: '<p>Найден мотив.</p>', kind: 'evidence' },
    },
  ],
  storyEndings: [
    { id: 'solved', title: 'Решено', type: 'success', conditions: {} },
    { id: 'wrong', title: 'Ошибка', type: 'failed', conditions: {} },
    { id: 'timeout', title: 'Время вышло', type: 'failed', conditions: {} },
  ],
  storyAccusation: {
    enabled: true,
    requiredNodeId: 'reception',
    unlockTopicId: 'accuse',
    availability: { minKeyEvidence: 2 },
    culpritCharacterIds: ['marina', 'gleb'],
    motives: [{ id: 'fraud', title: 'Скрыть хищение' }],
    minSelectableEvidence: 1,
    maxSelectableEvidence: 2,
    correctCulpritId: 'marina',
    correctMotiveId: 'fraud',
    outcomes: [
      {
        id: 'correct',
        priority: 10,
        endingId: 'solved',
        conditions: { culprit: 'correct', motive: 'correct', minSelectedEvidence: 2 },
      },
    ],
    fallbackEndingId: 'wrong',
    timeoutEndingId: 'timeout',
  },
})

test('investigation initializes clock, location, characters and topics without changing quest mode', () => {
  const game = buildGame()
  const progress = buildInitialInvestigationProgress(game, { now: NOW })
  assert.equal(progress.currentNodeId, 'reception')
  assert.equal(progress.elapsedMinutes, 0)
  assert.deepEqual(progress.unlockedCharacterIds, ['marina', 'gleb'])
  assert.deepEqual(progress.unlockedTopicIds, ['timeline'])
  assert.equal(getInvestigationClock(game, progress).formattedCurrentTime, '20:20')

  const quest = { ...game, storyConfig: { experienceMode: 'quest' } }
  assert.equal(buildInitialInvestigationProgress(quest, { now: NOW }), null)
})

test('legacy quest progress is upgraded without resetting team history', () => {
  const game = buildGame()
  const legacyProgress = {
    status: 'in_progress',
    startedAt: NOW,
    currentNodeId: null,
    elapsedMinutes: 0,
    unlockedNodeIds: ['reception', 'studio'],
    unlockedCharacterIds: [],
    unlockedTopicIds: [],
    history: [{ id: 'legacy-start', type: 'story_started', actor: 'system' }],
  }

  const result = upgradeInvestigationProgress(game, legacyProgress, {
    now: NOW,
  })

  assert.equal(result.upgraded, true)
  assert.equal(result.progress.currentNodeId, 'reception')
  assert.deepEqual(result.progress.unlockedCharacterIds, ['marina', 'gleb'])
  assert.deepEqual(result.progress.unlockedTopicIds, ['timeline'])
  assert.deepEqual(result.progress.history, legacyProgress.history)

  const travel = travelInvestigation({
    game,
    progress: result.progress,
    targetNodeId: 'studio',
    now: NOW,
  })
  assert.equal(travel.applied, true)
  assert.equal(travel.progress.currentNodeId, 'studio')
  assert.equal(travel.progress.elapsedMinutes, 10)
})

test('investigation mutations remove Mongo subdocument ids before persistence', () => {
  const game = buildGame()
  const objectId = new mongoose.Types.ObjectId()
  const initial = buildInitialInvestigationProgress(game, { now: NOW })
  const progress = {
    ...initial,
    _id: objectId,
    accusation: { ...initial.accusation, _id: objectId },
    history: initial.history.map((entry) => ({ ...entry, _id: objectId })),
  }

  const result = travelInvestigation({
    game,
    progress,
    targetNodeId: 'studio',
    now: NOW,
  })

  assert.equal(result.applied, true)
  assert.equal('_id' in result.progress, false)
  assert.equal('_id' in result.progress.accusation, false)
  assert.equal(result.progress.history.some((entry) => '_id' in entry), false)
})

test('travel and an interaction consume server time once and persist a safe journal entry', () => {
  const game = buildGame()
  let progress = buildInitialInvestigationProgress(game, { now: NOW })
  const travel = travelInvestigation({ game, progress, targetNodeId: 'studio', now: NOW })
  assert.equal(travel.applied, true)
  assert.equal(travel.progress.elapsedMinutes, 10)

  const interaction = applyInvestigationInteraction({
    game,
    progress: travel.progress,
    interactionId: 'find-email',
    now: NOW,
  })
  assert.equal(interaction.applied, true)
  assert.equal(interaction.progress.elapsedMinutes, 20)
  assert.deepEqual(interaction.progress.discoveredEvidenceIds, ['email'])
  assert.equal(interaction.progress.journal[0].summaryRich, '<p>Найден мотив.</p>')
  assert.equal(interaction.responseRich, '<p>Письмо назначено на 21:00.</p>')

  const repeated = applyInvestigationInteraction({
    game,
    progress: interaction.progress,
    interactionId: 'find-email',
    now: NOW,
  })
  assert.equal(repeated.applied, false)
  assert.equal(repeated.reason, 'interaction_already_used')
  assert.equal(repeated.progress.elapsedMinutes, 20)
})

test('accusation rejects forged evidence and evaluates before exact-deadline timeout', () => {
  const game = buildGame()
  const progress = {
    ...buildInitialInvestigationProgress(game, { now: NOW }),
    elapsedMinutes: 30,
    discoveredEvidenceIds: ['badge', 'email'],
    unlockedTopicIds: ['timeline', 'accuse'],
  }

  const forged = submitInvestigationAccusation({
    game,
    progress,
    culpritId: 'marina',
    motiveId: 'fraud',
    evidenceIds: ['forged'],
    now: NOW,
  })
  assert.equal(forged.applied, false)
  assert.equal(forged.reason, 'evidence_not_discovered')
  assert.equal(forged.progress.elapsedMinutes, 30)

  const solved = submitInvestigationAccusation({
    game,
    progress,
    culpritId: 'marina',
    motiveId: 'fraud',
    evidenceIds: ['badge', 'email'],
    now: NOW,
  })
  assert.equal(solved.applied, true)
  assert.equal(solved.progress.elapsedMinutes, 40)
  assert.equal(solved.progress.currentEndingId, 'solved')
  assert.equal(solved.progress.accusation.outcomeId, 'correct')
})

test('an action crossing deadline applies only timeout ending', () => {
  const game = buildGame()
  const progress = {
    ...buildInitialInvestigationProgress(game, { now: NOW }),
    currentNodeId: 'studio',
    elapsedMinutes: 35,
  }
  const result = applyInvestigationInteraction({
    game,
    progress,
    interactionId: 'find-email',
    now: NOW,
  })
  assert.equal(result.applied, false)
  assert.equal(result.reason, 'deadline_exceeded')
  assert.equal(result.progress.elapsedMinutes, 40)
  assert.equal(result.progress.currentEndingId, 'timeout')
  assert.deepEqual(result.progress.discoveredEvidenceIds, [])
})
