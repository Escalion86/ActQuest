import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canAssignGameOrganizer,
  normalizeGameOrganizerId,
  resolveGameOrganizerForCreate,
} from '../helpers/gameOrganizer.js'

test('allows assigning admins and developers as game organizers', () => {
  assert.equal(canAssignGameOrganizer({ role: 'admin' }), true)
  assert.equal(canAssignGameOrganizer({ role: 'dev' }), true)
  assert.equal(canAssignGameOrganizer({ role: 'client' }), false)
  assert.equal(canAssignGameOrganizer({ role: 'ban' }), false)
})

test('resolves selected admin organizer before session fallback', () => {
  const result = resolveGameOrganizerForCreate({
    requestedCreatorUserId: 'admin-1',
    requestedCreatorDoc: {
      _id: 'admin-1',
      role: 'admin',
      telegramId: 101,
    },
    sessionCreatorUserId: 'session-user',
    sessionCreatorTelegramId: 202,
  })

  assert.deepEqual(result, {
    creatorUserId: 'admin-1',
    creatorTelegramId: 101,
  })
})

test('falls back to session user when organizer is not selected', () => {
  const result = resolveGameOrganizerForCreate({
    requestedCreatorUserId: '',
    requestedCreatorDoc: null,
    sessionCreatorUserId: 'session-user',
    sessionCreatorTelegramId: 202,
  })

  assert.deepEqual(result, {
    creatorUserId: 'session-user',
    creatorTelegramId: 202,
  })
})

test('rejects non-admin organizer selections', () => {
  assert.throws(
    () =>
      resolveGameOrganizerForCreate({
        requestedCreatorUserId: 'client-1',
        requestedCreatorDoc: {
          _id: 'client-1',
          role: 'client',
          telegramId: 303,
        },
        sessionCreatorUserId: 'session-user',
        sessionCreatorTelegramId: 202,
      }),
    /Организатором игры может быть только администратор или разработчик/,
  )
})

test('normalizes only non-empty string-like organizer ids', () => {
  assert.equal(normalizeGameOrganizerId('  user-1  '), 'user-1')
  assert.equal(normalizeGameOrganizerId(null), null)
  assert.equal(normalizeGameOrganizerId('   '), null)
})
