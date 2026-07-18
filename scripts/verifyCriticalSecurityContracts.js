const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8')

const failures = []
const requireText = (relativePath, fragments) => {
  const source = read(relativePath)
  fragments.forEach((fragment) => {
    if (!source.includes(fragment)) {
      failures.push(`${relativePath}: отсутствует обязательный фрагмент ${fragment}`)
    }
  })
}

const forbidText = (relativePath, fragments) => {
  const source = read(relativePath)
  fragments.forEach((fragment) => {
    if (source.includes(fragment)) {
      failures.push(`${relativePath}: найден запрещённый фрагмент ${fragment}`)
    }
  })
}

for (const action of ['start', 'stop']) {
  requireText(`app/api/[location]/games/${action}/[id]/route.js`, [
    'requireAuth: true',
    'canManageGame({ session: req.session',
    'export async function POST',
  ])
}

requireText('app/api/[location]/games/check/[id]/route.js', [
  'requireAuth: true',
  'canManageGame({ session: req.session',
])
requireText('app/api/[location]/games/[id]/route.js', [
  'sanitizeGameForPublicRead',
  'canManageGame({ session: req.session',
  'protectStoryScenarioUpdate',
])
requireText('helpers/protectStoryScenarioUpdate.js', [
  'STORY_SCENARIO_FIELDS',
  'STORY_SCENARIO_FIELDS.forEach',
  'delete safeUpdate[field]',
])
requireText('helpers/sanitizeGameForPublicRead.js', [
  'codes: []',
  'codePhotos: []',
  'postMessage: \'\'',
])
requireText('app/[location]/control/[jsonCommand]/page.js', [
  'getServerSession(authOptions)',
  "toLowerCase() !== 'dev'",
  'resolveSessionUserFilter(session.user)',
])
forbidText('app/[location]/control/[jsonCommand]/page.js', ['telegramId: 261102161'])

requireText('app/api/deepseek/route.js', [
  'getServerSession(authOptions)',
  'MAX_TOTAL_CONTENT_LENGTH',
])
requireText('app/api/escalioncloud/route.js', [
  'getServerSession(authOptions)',
  'canUploadPlayerPhoto',
  'resolveTeamMembershipForIdentity',
  'MAX_REQUEST_BYTES',
])
requireText('app/api/escalioncloud/files/route.js', [
  'getServerSession(authOptions)',
])

for (const kind of ['image', 'media']) {
  requireText(`app/api/public/${kind}-download/route.js`, [
    'ALLOWED_REMOTE_HOSTS',
    "redirect: 'error'",
    'AbortSignal.timeout',
    'createLimitedBody',
  ])
}

requireText('app/api/phone/verify/finalize/route.js', [
  'expiresAt: { $gt: lockedAt }',
  'finalizingAt: null',
  'releaseVerificationLock',
])
requireText('schemas/phoneVerificationsSchema.js', ['expires: 0', 'finalizingAt'])

// Игровой ввод должен оставаться на основной web-ветке и продолжать проверять
// членство команды на сервере.
requireText('app/api/webapp/game-task/route.js', [
  'getTeamGameTaskState',
  'TEAM_ACCESS_DENIED',
])
requireText('server/webGameProcess.js', [
  'acquireGameProcessLock',
  'releaseGameProcessLock',
  'didGameProcessStepChange',
  'retryable: true',
  'staleState: true',
])
requireText('server/gameProcessLock.js', ["returnDocument: 'after'"])
forbidText('server/gameProcessLock.js', ['new: true'])
requireText('schemas/gamesTeamsSchema.js', [
  'gameProcessLock',
  'expiresAt',
])
for (const storyMutationRoute of [
  'app/api/cabinet/games/[gameId]/story/code/route.js',
  'app/api/cabinet/games/[gameId]/story/action/route.js',
  'app/api/cabinet/games/[gameId]/story/clue/route.js',
  'app/api/cabinet/games/[gameId]/story/travel/route.js',
  'app/api/cabinet/games/[gameId]/story/interaction/route.js',
  'app/api/cabinet/games/[gameId]/story/accusation/route.js',
]) {
  requireText(storyMutationRoute, ['runLockedStoryMutation'])
}
requireText('app/api/cabinet/_lib/storyApi.js', [
  'runLockedStoryMutation',
  "'gameProcessLock.token': lock.token",
  'matchedCount !== 1',
  'buildTeamInvestigationStatePayload',
  'upgradeInvestigationProgress',
])
requireText('helpers/sanitizeGameForPublicRead.js', [
  'storyInteractions: []',
  'storyEvidence: []',
  'storyCharacters: []',
  'storyTopics: []',
])
requireText('app/api/cabinet/admin/story-control/_lib.js', [
  'runLockedStoryMutation',
])
requireText('app/api/cabinet/games/route.js', [
  "gameType === 'story'",
  "normalizeRole(session.user.role) !== 'dev'",
  'Создание story-игр пока доступно только разработчику',
])
requireText('server/getTeamGameTaskState.js', [
  'buildStoryClientConfig',
  'resolveTeamMembershipForIdentity',
  'webGameProcess',
])

// Тестовый прогон должен использовать отдельное хранилище, проверять владельца
// на каждом игроком запросе и не инициировать реальные уведомления.
requireText('app/api/cabinet/admin/game-test-runs/route.js', [
  'getServerSession(authOptions)',
  'canManageGame',
  "db.model('GameTestRuns')",
  'isTestRunOwner',
])
forbidText('app/api/cabinet/admin/game-test-runs/route.js', [
  "db.model('GamesTeams')",
])
requireText('server/gameTestRuns.js', [
  'isTestRunOwner',
  'loadOwnedTestRun',
  "runtimeMode: 'test'",
])
requireText('server/getTeamGameTaskState.js', [
  "db.model('GameTestRuns')",
  'loadOwnedTestRun',
  'progressModel: gamesTeamsModel',
])
requireText('app/api/cabinet/_lib/storyApi.js', [
  "db.model('GameTestRuns')",
  'loadOwnedTestRun',
])
requireText('server/agentNotifications.js', [
  "game?.runtimeMode === 'test'",
])

for (const legacyCrudRoute of [
  'app/api/[location]/users/[id]/route.js',
  'app/api/[location]/teams/[id]/route.js',
  'app/api/[location]/teamsusers/[id]/route.js',
  'app/api/[location]/gamesteams/[id]/route.js',
  'app/api/[location]/gamesteams/route.js',
]) {
  requireText(legacyCrudRoute, ['requireAuth: true', "role !== 'admin'"])
}
requireText('app/api/[location]/gamesteams/process/[id]/route.js', [
  'requireAuth: true',
  'membership.isTeamMember',
  'canManageGame({ session: req.session',
])
requireText('server/UsersInGame.js', [
  'sanitizeGameForPublicRead(game)',
  "select({ telegramId: 1, location: 1 })",
])
forbidText('server/UsersInGame.js', ['return { ...user, team'])

if (failures.length > 0) {
  console.error('[verify:critical-security] FAILED')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('[verify:critical-security] OK')
console.log('- административные маршруты требуют права управления игрой')
console.log('- публичные ответы не содержат правильные коды')
console.log('- внешние прокси и телефонная верификация защищены')
console.log('- основной web-маршрут ввода кодов сохранён')
console.log('- создание story-игр ограничено ролью dev')
console.log('- story-сценарий изменяется только через специализированный редактор')
