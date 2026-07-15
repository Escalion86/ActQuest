import assert from 'node:assert/strict'
import test from 'node:test'

import protectStoryScenarioUpdate, {
  STORY_SCENARIO_FIELDS,
} from '../helpers/protectStoryScenarioUpdate.js'

const destructiveScenarioPayload = Object.fromEntries(
  STORY_SCENARIO_FIELDS.map((field) => [field, field === 'storyConfig' ? { experienceMode: 'quest' } : []]),
)

test('обычное сохранение story-игры не может перезаписать сценарий', () => {
  const result = protectStoryScenarioUpdate({
    existingGame: { type: 'story' },
    updateData: {
      name: 'Новое название',
      status: 'active',
      type: 'story',
      ...destructiveScenarioPayload,
    },
  })

  assert.equal(result.name, 'Новое название')
  assert.equal(result.status, 'active')
  STORY_SCENARIO_FIELDS.forEach((field) => {
    assert.equal(Object.prototype.hasOwnProperty.call(result, field), false)
  })
})

test('защита срабатывает и при попытке сменить тип игры на story', () => {
  const result = protectStoryScenarioUpdate({
    existingGame: { type: 'classic' },
    updateData: { type: 'story', ...destructiveScenarioPayload },
  })

  STORY_SCENARIO_FIELDS.forEach((field) => {
    assert.equal(Object.prototype.hasOwnProperty.call(result, field), false)
  })
})

test('обычная игра сохраняет общие поля, но не служебные поля story', () => {
  const updateData = { name: 'Classic', type: 'classic', storyNodes: [] }
  assert.deepEqual(protectStoryScenarioUpdate({ updateData }), {
    name: 'Classic',
    type: 'classic',
  })
})
