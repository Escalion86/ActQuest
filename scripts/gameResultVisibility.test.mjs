import test from 'node:test'
import assert from 'node:assert/strict'
import { loader } from './copyGameTasks.fixture.mjs'

test('API результатов и прямой страницы соблюдают аудиторию и snapshot участников', async () => {
  let session = null
  const game = {
    _id: '111111111111111111111111',
    status: 'closed',
    location: 'krsk',
    creatorUserId: 'creator',
    moderators: ['moderator'],
    tasks: [],
    result: {
      computed: { teams: [] },
      teams: [{ _id: 'team', name: 'Команда' }],
      gameTeams: [{ teamId: 'team' }],
      teamsUsers: [{ userId: 'participant', teamId: 'team' }],
      teamsPlaces: { team: 1 },
    },
  }
  const db = {
    model(name) {
      assert.equal(name, 'Games')
      return {
        findById() {
          return {
            then(resolve) { return Promise.resolve(game).then(resolve) },
            select(projection) {
              assert.equal(projection.showResultAudience, 1)
              return { lean: async () => game }
            },
          }
        },
      }
    },
  }
  const noop = () => {}
  const load = loader({
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => session },
    '@server/auth/authOptions': { authOptions: {} },
    '@utils/dbConnectGlobal': async () => db,
    '@server/CRUD': noop,
    '@server/buildGameResultComputed': noop,
    '@server/buildGameResultSnapshots': noop,
    '@server/updateParticipantsRatings': noop,
    '@server/updateParticipantsClosedStats': noop,
    '@server/gameTeamMessages': { deleteGameTeamMessagesForGame: noop },
    '@server/gameHistory/fetchGameHistoryState': noop,
    '@server/gameHistory/recordGameHistoryEntry': noop,
  })
  const cabinet = load('@app/api/cabinet/games/[gameId]/result/route').GET
  const publicPage = load('@app/api/[location]/games/[id]/route').GET
  for (const hideResult of [false, true]) {
    for (const showResultAudience of [undefined, 'all', 'participants']) {
      Object.assign(game, { hideResult, showResultAudience })
      for (const viewer of [null, 'outsider', 'participant', 'admin', 'creator', 'moderator']) {
        session = viewer ? { user: { id: viewer, role: viewer === 'admin' ? 'admin' : 'client' } } : null
        const canManage = ['admin', 'creator', 'moderator'].includes(viewer)
        const allowed = canManage || (!hideResult && (showResultAudience !== 'participants' || viewer === 'participant'))
        const cabinetResponse = await cabinet(
          new Request('http://localhost/api/cabinet/games/game/result'),
          { params: Promise.resolve({ gameId: game._id }) },
        )
        assert.equal(cabinetResponse.status, allowed ? 200 : 403, `${viewer}: ${hideResult}/${showResultAudience}`)
        const publicResponse = await publicPage(
          new Request('http://localhost/api/krsk/games/game'),
          { params: Promise.resolve({ id: game._id, location: 'krsk' }) },
        )
        assert.equal(publicResponse.status, 200)
        const payload = await publicResponse.json()
        assert.equal(Boolean(payload.data.result), allowed, `Прямой API: ${viewer}: ${hideResult}/${showResultAudience}`)
      }
    }
  }
})
