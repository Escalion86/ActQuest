const fs = require('fs')
const path = require('path')
const assert = require('assert')

const filePath = path.join(
  process.cwd(),
  'components',
  'cabinet',
  'TaskRichEditor.js',
)
const source = fs.readFileSync(filePath, 'utf8')

const quoteButtonIndex = source.indexOf('label="Цитата"')
const frameButtonIndex = source.indexOf('label="Рамка"')

assert(
  quoteButtonIndex !== -1,
  'TaskRichEditor toolbar must expose a visible "Цитата" button',
)
assert(
  frameButtonIndex !== -1,
  'TaskRichEditor toolbar must still expose the "Рамка" button',
)
assert(
  quoteButtonIndex < frameButtonIndex,
  'The "Цитата" toolbar button must be placed before "Рамка"',
)
assert(
  source.includes('blockquote: editor.isActive(\'blockquote\')'),
  'Toolbar state must track active blockquote state',
)
assert(
  source.includes('prev.blockquote === nextState.blockquote'),
  'Toolbar state comparison must include blockquote',
)
assert(
  source.includes('isActive={toolbarState.blockquote}'),
  'The "Цитата" button must use toolbarState.blockquote for active state',
)
assert(
  source.includes('toggleBlockquote().run()'),
  'The "Цитата" button must toggle blockquote formatting',
)

console.log('taskRichEditorQuoteToolbar.test.js passed')
