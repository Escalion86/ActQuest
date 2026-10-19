import test from 'node:test'
import assert from 'node:assert/strict'
import normalizeTelegramId from '../helpers/normalizeTelegramId.js'
import resolveTeamMembershipForIdentity from '../helpers/resolveTeamMembershipForIdentity.js'
import { getTeamMembershipForUser, getTeamMessageReadUserKey } from '../server/gameTeamMessages.js'
import updateParticipantsRatings from '../server/updateParticipantsRatings.js'

const invalidIds = [null, undefined, '', ' ', 0, '0', -1, false, true, [], {}, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]

test('некорректные Telegram ID не подтверждают членство и не создают ключ прочтения', () => {
  for (const telegramId of invalidIds) {
    assert.equal(normalizeTelegramId(telegramId), null)
    assert.equal(getTeamMessageReadUserKey({ telegramId }), '')
    assert.equal(resolveTeamMembershipForIdentity({
      teamUsers: [{ userId: 'other', userTelegramId: telegramId, role: 'captain' }],
      userId: 'stranger', telegramId,
    }).isTeamMember, false)
  }
  assert.equal(normalizeTelegramId('123'), 123)
})

test('сообщения используют роль по userId, даже если Telegram совпал у другого участника', async () => {
  const calls = []
  const db = { model: () => ({ findOne: (query) => {
    calls.push(query)
    return { select: () => ({ lean: async () => ({ role: query.userId ? 'participant' : 'captain' }) }) }
  } }) }
  const membership = await getTeamMembershipForUser({ db, teamId: 'team', userId: 'author', telegramId: 123 })
  assert.equal(membership.role, 'participant')
  assert.deepEqual(calls, [{ teamId: 'team', userId: 'author' }])
})

test('сообщения не ищут членство по пустому ID, но поддерживают старый Telegram ID', async () => {
  const calls = []
  const db = { model: () => ({ findOne: (query) => {
    calls.push(query)
    return { select: () => ({ lean: async () => query.userTelegramId ? { role: 'captain' } : null }) }
  } }) }
  for (const telegramId of invalidIds) {
    assert.equal(await getTeamMembershipForUser({ db, teamId: 'team', telegramId }), null)
  }
  assert.equal(calls.length, 0)
  assert.equal((await getTeamMembershipForUser({ db, teamId: 'team', userId: 'migrated', telegramId: '123' })).role, 'captain')
  assert.deepEqual(calls, [{ teamId: 'team', userId: 'migrated' }, { teamId: 'team', userTelegramId: 123 }])
})

test('пересчёт рейтинга не записывает результат участнику с Telegram ID 0', async () => {
  const game = { _id: 'game', status: 'closed', result: {
    teamsPlaces: { first: 1, second: 2 },
    teamsUsers: [
      { userId: 'author', userTelegramId: null, teamId: 'first' },
      { userTelegramId: '123', teamId: 'second' },
      ...invalidIds.map((userTelegramId) => ({ userTelegramId, teamId: 'first' })),
    ],
  } }
  for (const updateAllEntities of [false, true]) {
    const userOps = []
    const db = { model: (name) => name === 'Games'
      ? { find: () => ({ select: () => ({ lean: async () => [game] }) }) }
      : { bulkWrite: async (ops) => { if (name === 'Users') userOps.push(...ops) } } }
    await updateParticipantsRatings({ db, game, updateAllEntities })
    const filters = userOps.map((op) => (op.updateOne || op.updateMany).filter)
    assert.deepEqual(filters, [{ _id: 'author' }, { telegramId: 123 }])
  }
})
