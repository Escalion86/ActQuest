const fs = require('fs')
const path = require('path')
const assert = require('assert')

const filePath = path.join(
  process.cwd(),
  'components',
  'location-game',
  'GameTeamPageClient.js',
)
const source = fs.readFileSync(filePath, 'utf8')

const visibilityRuleMatch = source.match(
  /const shouldShowLastMessage =\s*([\s\S]*?)\n  const shouldShowAnswerForm/,
)

assert(
  visibilityRuleMatch,
  'GameTeamPageClient must define shouldShowLastMessage before shouldShowAnswerForm',
)

const visibilityRule = visibilityRuleMatch[1]

assert(
  visibilityRule.includes('displayedResultMessages.length > 0'),
  'Last messages block must still require result messages',
)
assert(
  visibilityRule.includes('!isStoryGame'),
  'Last messages block must stay hidden in story mode',
)
assert(
  visibilityRule.includes('!isGameCompletion'),
  'Last messages block must be hidden after the team completes the game',
)

console.log('gameTeamPageLastMessages.test.js passed')
