import assert from 'node:assert/strict'

import sanitizeGameForPublicRead from '../helpers/sanitizeGameForPublicRead.js'

const source = {
  _id: 'game-1',
  status: 'started',
  tasks: [
    {
      task: 'Текст задания',
      codes: ['MAIN_SECRET'],
      codePhotos: ['PHOTO_SECRET'],
      bonusCodes: [{ code: 'BONUS_SECRET', bonus: 60, description: 'Бонус' }],
      penaltyCodes: [
        { code: 'PENALTY_SECRET', penalty: 30, description: 'Штраф' },
      ],
      clues: [{ clue: 'CLUE_SECRET' }],
      howToSolve: 'SOLUTION_SECRET',
      postMessage: 'POST_SECRET',
    },
  ],
  storyNodes: [
    {
      codes: [{ code: 'STORY_SECRET', type: 'complete' }],
      clues: [{ contentRich: 'STORY_CLUE_SECRET' }],
    },
  ],
  storyCharacters: [{ id: 'killer', title: 'HIDDEN_KILLER' }],
  storyTopics: [{ id: 'secret-topic', title: 'HIDDEN_TOPIC' }],
  storyInteractions: [
    {
      id: 'secret-interaction',
      responseRich: 'HIDDEN_RESPONSE',
      effects: { grantsEvidenceIds: ['secret-evidence'] },
    },
  ],
  storyEvidence: [{ id: 'secret-evidence', title: 'HIDDEN_EVIDENCE' }],
  storyAccusation: {
    enabled: true,
    correctCulpritId: 'CORRECT_CULPRIT',
    correctMotiveId: 'CORRECT_MOTIVE',
    outcomes: [{ conditions: { culprit: 'correct' } }],
  },
  prequel: {
    bonusCodes: [{ code: 'PREQUEL_SECRET', value: 10 }],
    penaltyCodes: [{ code: 'PREQUEL_PENALTY_SECRET', value: 10 }],
  },
}

const sanitized = sanitizeGameForPublicRead(source)
const serialized = JSON.stringify(sanitized)

for (const secret of [
  'MAIN_SECRET',
  'PHOTO_SECRET',
  'BONUS_SECRET',
  'PENALTY_SECRET',
  'CLUE_SECRET',
  'SOLUTION_SECRET',
  'POST_SECRET',
  'STORY_SECRET',
  'STORY_CLUE_SECRET',
  'HIDDEN_KILLER',
  'HIDDEN_TOPIC',
  'HIDDEN_RESPONSE',
  'HIDDEN_EVIDENCE',
  'CORRECT_CULPRIT',
  'CORRECT_MOTIVE',
  'PREQUEL_SECRET',
  'PREQUEL_PENALTY_SECRET',
]) {
  assert.equal(serialized.includes(secret), false, `Обнаружена утечка ${secret}`)
}

assert.equal(sanitized.tasks[0].task, 'Текст задания')
assert.equal(sanitized.tasks[0].codesCount, 1)
assert.equal(sanitized.tasks[0].bonusCodes[0].bonus, 60)
assert.equal(sanitized.tasks[0].penaltyCodes[0].penalty, 30)

const finished = sanitizeGameForPublicRead({ ...source, status: 'finished' })
assert.equal(finished.tasks[0].clues[0].clue, 'CLUE_SECRET')
assert.equal(finished.tasks[0].codes.length, 0)
assert.equal('code' in finished.tasks[0].bonusCodes[0], false)

console.log('[test:public-game-sanitizer] OK')
