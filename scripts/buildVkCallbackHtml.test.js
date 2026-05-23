const test = require('node:test')
const assert = require('node:assert/strict')

const buildVkCallbackHtml = require('../helpers/buildVkCallbackHtml')

test('uses a safe cabinet login fallback by default', () => {
  const html = buildVkCallbackHtml()

  assert.match(html, /fallbackPath = '\/cabinet\/login'/)
  assert.match(html, /window\.location\.replace\(fallbackUrl\)/)
})

test('keeps safe relative fallback paths', () => {
  const html = buildVkCallbackHtml({
    fallbackPath: '/cabinet?auth=vk',
  })

  assert.match(html, /fallbackPath = '\/cabinet\?auth=vk'/)
})

test('rejects non-relative fallback paths', () => {
  const html = buildVkCallbackHtml({
    fallbackPath: 'https://evil.example',
  })

  assert.match(html, /fallbackPath = '\/cabinet\/login'/)
})

test('posts a callback message before closing the window', () => {
  const html = buildVkCallbackHtml()

  assert.match(html, /window\.opener\.postMessage\(payload, window\.location\.origin\)/)
  assert.match(html, /window\.parent\.postMessage\(payload, window\.location\.origin\)/)
  assert.match(html, /window\.close\(\)/)
})
