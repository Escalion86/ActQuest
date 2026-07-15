import assert from 'node:assert/strict'
import test from 'node:test'

import buildStoryClientConfig from '../helpers/buildStoryClientConfig.js'

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
