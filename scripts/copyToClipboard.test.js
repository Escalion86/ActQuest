import test from 'node:test'
import assert from 'node:assert/strict'

import copyToClipboard from '../helpers/copyToClipboard.js'

const setGlobalValue = (key, value) => {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  })
}

test('copyToClipboard uses navigator.clipboard when available', async () => {
  let copiedText = null

  setGlobalValue('navigator', {
    clipboard: {
      writeText: async (text) => {
        copiedText = text
      },
    },
  })

  await copyToClipboard('game-id-123')

  assert.equal(copiedText, 'game-id-123')
})

test('copyToClipboard falls back to document.execCommand when clipboard api is unavailable', async () => {
  let appendedNode = null
  let removedNode = null
  let selected = false
  let copied = false

  setGlobalValue('navigator', {})
  setGlobalValue('document', {
    body: {
      appendChild: (node) => {
        appendedNode = node
      },
      removeChild: (node) => {
        removedNode = node
      },
    },
    createElement: () => ({
      value: '',
      style: {},
      setAttribute() {},
      select() {
        selected = true
      },
    }),
    execCommand: (command) => {
      if (command === 'copy') {
        copied = true
        return true
      }
      return false
    },
  })

  await copyToClipboard('team-id-456')

  assert.equal(appendedNode?.value, 'team-id-456')
  assert.equal(removedNode?.value, 'team-id-456')
  assert.equal(selected, true)
  assert.equal(copied, true)
})
