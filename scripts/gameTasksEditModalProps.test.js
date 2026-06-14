import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const modalPath = path.join(
  process.cwd(),
  'components',
  'modals',
  'game-tasks',
  'GameTasksEditModal.js',
)
const modalSource = fs.readFileSync(modalPath, 'utf8')

test('GameTasksEditModal accepts updateSelectedGame when rendering PrequelSection', () => {
  assert.equal(
    modalSource.includes('updateSelectedGame={updateSelectedGame}'),
    true,
    'Expected GameTasksEditModal to pass updateSelectedGame to PrequelSection',
  )
  assert.equal(
    modalSource.includes('  updateSelectedGame,'),
    true,
    'Expected GameTasksEditModal to destructure updateSelectedGame from props',
  )
  assert.equal(
    modalSource.includes('  updateSelectedGame: PropTypes.func.isRequired,'),
    true,
    'Expected GameTasksEditModal propTypes to require updateSelectedGame',
  )
})
