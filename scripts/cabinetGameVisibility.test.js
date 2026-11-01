import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canManageCabinetGameFinances,
  canViewPublishedGameResults,
  canOpenRestrictedTeamGamePreview,
  canViewCabinetGameRestrictedInfo,
  sanitizeCabinetGameForViewer,
} from '../helpers/cabinetGameVisibility.js'
import sanitizeGameForPublicRead from '../helpers/sanitizeGameForPublicRead.js'
import { collectSnapshotTeamIdsForUser } from '../helpers/gameParticipation.js'

test('результаты доступны согласно аудитории, включая прямой публичный API', () => {
  for (const hideResult of [false, true]) {
    for (const showResultAudience of [undefined, 'all', 'participants']) {
      for (const hasUserParticipation of [false, true]) {
        for (const canViewRestrictedGameInfo of [false, true]) {
          const game = {
            hideResult, showResultAudience,
            result: { computed: { teams: [] }, teamsPlaces: { team: 1 } },
          }
          const viewer = { hasUserParticipation, canViewRestrictedGameInfo }
          const expected = canViewRestrictedGameInfo ||
            (!hideResult && (showResultAudience !== 'participants' || hasUserParticipation))
          assert.equal(canViewPublishedGameResults(game, viewer), expected)
          assert.equal(Boolean(sanitizeGameForPublicRead(game, viewer).result), expected)
          assert.equal(Boolean(sanitizeCabinetGameForViewer(game, viewer).result), expected)
        }
      }
    }
  }
})

test('участие для результатов определяется по snapshot, независимо от текущего состава команды', () => {
  const game = {
    hideResult: false,
    showResultAudience: 'participants',
    result: { teamsUsers: [{ userId: 'player', teamId: 'old-team' }] },
  }
  const participant = collectSnapshotTeamIdsForUser({ game, userId: 'player' }).length > 0
  const newcomer = collectSnapshotTeamIdsForUser({ game, userId: 'new-player' }).length > 0
  assert.equal(canViewPublishedGameResults(game, { hasUserParticipation: participant }), true)
  assert.equal(canViewPublishedGameResults(game, { hasUserParticipation: newcomer }), false)
})

test('public cabinet game view strips financial and restricted fields', () => {
  const sanitized = sanitizeCabinetGameForViewer(
    {
      finances: [{ id: 'f1', sum: 1000 }],
      tasks: [{ id: 't1' }],
      moderators: [{ id: 'm1' }],
      agents: [{ id: 'a1' }],
      creatorUserId: 'creator-1',
      creatorTelegramId: '42',
      clueEarlyAccessMode: 'penalty',
      clueEarlyPenalty: 300,
      manyCodesPenalty: [3, 60],
      individualStart: true,
      showCreator: true,
      showTasks: true,
      creator: {
        id: 'u1',
        name: 'Орг',
        username: 'org',
        phone: '+79990000000',
        telegramId: '123',
      },
    },
    { canViewRestrictedGameInfo: false },
  )

  assert.deepEqual(sanitized.finances, [])
  assert.deepEqual(sanitized.tasks, [])
  assert.deepEqual(sanitized.moderators, [])
  assert.deepEqual(sanitized.agents, [])
  assert.equal(sanitized.creatorUserId, '')
  assert.equal(sanitized.creatorTelegramId, '')
  assert.equal(sanitized.clueEarlyAccessMode, undefined)
  assert.equal(sanitized.clueEarlyPenalty, undefined)
  assert.equal(sanitized.manyCodesPenalty, undefined)
  assert.equal(sanitized.individualStart, false)
  assert.equal(sanitized.showCreator, false)
  assert.equal(sanitized.showTasks, false)
  assert.equal(sanitized.creator.phone, '')
  assert.equal(sanitized.creator.telegramId, '')
})

test('public cabinet game view keeps published tasks for finished games', () => {
  const sanitized = sanitizeCabinetGameForViewer(
    {
      status: 'finished',
      showTasks: true,
      showTasksAudience: 'all',
      tasks: [{ id: 't1', task: 'Кодовое место' }],
      finances: [{ id: 'f1', sum: 1000 }],
    },
    { canViewRestrictedGameInfo: false },
  )

  assert.equal(sanitized.showTasks, true)
  assert.deepEqual(sanitized.tasks, [{ id: 't1', task: 'Кодовое место' }])
  assert.deepEqual(sanitized.finances, [])
})

test('public cabinet game view keeps participant-only published tasks for participants', () => {
  const sanitized = sanitizeCabinetGameForViewer(
    {
      status: 'closed',
      showTasks: true,
      showTasksAudience: 'participants',
      tasks: [{ id: 't1', task: 'Финишный код' }],
      finances: [{ id: 'f1', sum: 1000 }],
    },
    {
      canViewRestrictedGameInfo: false,
      hasUserParticipation: true,
    },
  )

  assert.equal(sanitized.showTasks, true)
  assert.deepEqual(sanitized.tasks, [{ id: 't1', task: 'Финишный код' }])
  assert.deepEqual(sanitized.finances, [])
})

test('public cabinet game view hides participant-only tasks from nonparticipants', () => {
  const sanitized = sanitizeCabinetGameForViewer(
    {
      status: 'finished',
      showTasks: true,
      showTasksAudience: 'participants',
      tasks: [{ id: 't1', task: 'Секрет' }],
    },
    {
      canViewRestrictedGameInfo: false,
      hasUserParticipation: false,
    },
  )

  assert.equal(sanitized.showTasks, false)
  assert.deepEqual(sanitized.tasks, [])
})

test('moderator can view restricted info only for own game', () => {
  assert.equal(
    canViewCabinetGameRestrictedInfo({
      userRole: 'client',
      currentUserId: 'creator-1',
      gameCreatorUserId: 'creator-1',
    }),
    true,
  )

  assert.equal(
    canViewCabinetGameRestrictedInfo({
      userRole: 'client',
      currentUserId: 'user-2',
      gameCreatorUserId: 'creator-1',
    }),
    false,
  )
})

test('game moderator can view restricted info even when not creator', () => {
  assert.equal(
    canViewCabinetGameRestrictedInfo({
      userRole: 'client',
      currentUserId: 'user-2',
      gameCreatorUserId: 'creator-1',
      isGameModerator: true,
    }),
    true,
  )
})

test('team game preview is not restricted for ordinary users by default', () => {
  assert.equal(
    canOpenRestrictedTeamGamePreview({
      isAdminViewer: false,
      allowRestrictedPreview: false,
    }),
    false,
  )

  assert.equal(
    canOpenRestrictedTeamGamePreview({
      isAdminViewer: true,
      allowRestrictedPreview: false,
    }),
    true,
  )
})

test('game finances button is available for manager roles only', () => {
  assert.equal(
    canManageCabinetGameFinances({
      canManageGameStatus: true,
    }),
    true,
  )

  assert.equal(
    canManageCabinetGameFinances({
      canManageGameStatus: false,
    }),
    false,
  )
})
