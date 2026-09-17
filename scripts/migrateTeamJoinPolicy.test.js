const assert = require('node:assert/strict')
const test = require('node:test')

const {
  buildMigrationFilter,
  buildMigrationUpdate,
} = require('./migrateTeamJoinPolicy')

test('миграция выбирает команды с open=false без закрытой политики', () => {
  assert.deepEqual(buildMigrationFilter(), {
    open: false,
    joinPolicy: { $ne: 'closed' },
  })
})

test('миграция устанавливает joinPolicy=closed', () => {
  assert.deepEqual(buildMigrationUpdate(), {
    $set: { joinPolicy: 'closed' },
  })
})
