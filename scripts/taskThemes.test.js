import test from 'node:test'
import assert from 'node:assert/strict'
import { TASK_THEMES, normalizeTaskTheme, getTaskThemeStyle } from '../helpers/taskThemes.js'
import { resolveClassicGame } from '../helpers/classicVariants.js'
import normalizeGameForCabinet from '../helpers/normalizeGameForCabinet.js'
import { applyGameDraftPatch } from '../helpers/gameDraftDirtyState.js'

const luminance = (hex) => {
  const channels = hex.slice(1).match(/../g).map((part) => {
    const value = parseInt(part, 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}
const contrast = (a, b) => {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

test('старые и неизвестные темы получают безопасное оформление', () => {
  for (const value of [undefined, null, '', 'unknown', '__proto__', {}]) {
    assert.equal(normalizeTaskTheme(value), 'cyberpunk-dark')
  }
  assert.equal(normalizeTaskTheme('cyberpunk-light'), 'cyberpunk-light')
})

test('текст и акценты читаемы на обоих фонах каждой темы', () => {
  for (const theme of TASK_THEMES) {
    for (const foreground of [theme.text, theme.accent]) {
      for (const background of [theme.background, theme.surface]) {
        assert.ok(contrast(foreground, background) >= 4.5, `${theme.id}: ${foreground} / ${background}`)
      }
    }
    assert.equal(getTaskThemeStyle(theme.id)['--aq-task-background'], theme.background)
  }
})

test('общая тема сохраняется при выборе альтернативного пути', () => {
  const game = {
    type: 'classic', taskTheme: 'cyberpunk-light',
    tasks: [{
      stageKey: 'first',
      variantConfig: { enabled: true },
      variants: [{ id: 'alternative', content: { task: 'Другой текст' } }],
    }],
  }
  const team = { classicProgress: { stages: [{ stageId: 'first', selectedVariantId: 'alternative' }] } }
  const resolved = resolveClassicGame(game, team)
  assert.equal(resolved.taskTheme, 'cyberpunk-light')
  assert.equal(resolved.tasks[0].task, 'Другой текст')
})

test('нормализация кабинета хранит тему на уровне игры', () => {
  const game = normalizeGameForCabinet({
    _id: 'game-1', taskTheme: 'cyberpunk-light',
    tasks: [{ task: 'Первое', taskTheme: 'cyberpunk-dark' }, { task: 'Второе' }],
  })
  assert.equal(game.taskTheme, 'cyberpunk-light')
  assert.equal(game.tasks.length, 2)
  assert.ok(game.tasks.every((task) => !Object.hasOwn(task, 'taskTheme')))
  assert.equal(normalizeGameForCabinet({ _id: 'old' }).taskTheme, 'cyberpunk-dark')
})

test('смена общей темы помечает игру изменённой без переписывания заданий', () => {
  const baseline = { status: 'active', taskTheme: 'cyberpunk-dark', tasks: [{ task: 'Первое' }] }
  const result = applyGameDraftPatch({
    prevGame: baseline, baselineGame: baseline, patch: { taskTheme: 'cyberpunk-light' },
  })
  assert.equal(result.hasUnsavedChanges, true)
  assert.equal(result.nextGame.taskTheme, 'cyberpunk-light')
  assert.equal(result.nextGame.tasks, baseline.tasks)
})
