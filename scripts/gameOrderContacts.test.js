import test from 'node:test'
import assert from 'node:assert/strict'

import {
  formatGameOrderPhone,
  getGameOrderPhoneHref,
  getGameOrderTelegramHref,
} from '../helpers/gameOrderContacts.js'

test('formatGameOrderPhone adds plus before numeric phone', () => {
  assert.equal(formatGameOrderPhone('71234567890'), '+71234567890')
  assert.equal(formatGameOrderPhone('+71234567890'), '+71234567890')
})

test('getGameOrderPhoneHref uses normalized tel link', () => {
  assert.equal(getGameOrderPhoneHref('71234567890'), 'tel:+71234567890')
  assert.equal(getGameOrderPhoneHref(''), '')
})

test('контакт Telegram открывает профиль через общий deep link', () => {
  assert.equal(getGameOrderTelegramHref('@actquest'), 'tg://resolve?domain=actquest')
  assert.equal(getGameOrderTelegramHref('actquest'), 'tg://resolve?domain=actquest')
  assert.equal(
    getGameOrderTelegramHref('https://t.me/actquest'),
    'tg://resolve?domain=actquest',
  )
  assert.equal(getGameOrderTelegramHref(''), '')
})
