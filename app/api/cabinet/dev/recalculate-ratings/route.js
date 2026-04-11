import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import updateParticipantsRatings from '@server/updateParticipantsRatings'
import updateParticipantsClosedStats from '@server/updateParticipantsClosedStats'
import buildGameResultComputed from '@server/buildGameResultComputed'

const isDeveloperRole = (role) => {
  if (typeof role !== 'string') {
    return false
  }

  return role.trim().toLowerCase() === 'dev'
}

const stripHtmlToPlainText = (value) =>
  String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r?\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const xmlEscape = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\r\n?/g, '\n')

const toPlainTaskText = (task) => {
  const taskText =
    typeof task?.task === 'string' && task.task.trim().length > 0
      ? task.task
      : stripHtmlToPlainText(task?.taskRich)
  return taskText.trim()
}

const toPlainClueText = (clue) => {
  const clueText =
    typeof clue?.clue === 'string' && clue.clue.trim().length > 0
      ? clue.clue
      : stripHtmlToPlainText(clue?.clueRich)
  return clueText.trim()
}

const formatDateKrasnoyarsk = (value) => {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Krasnoyarsk',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const buildCluesCell = (task) => {
  const clues = Array.isArray(task?.clues) ? task.clues : []
  if (clues.length === 0) {
    return ''
  }

  return clues
    .map((clue, index) => {
      const clueText = toPlainClueText(clue)
      return clueText ? `${index + 1}. ${clueText}` : `${index + 1}.`
    })
    .join('\n')
}

const buildCoordinatesText = (task) => {
  const latitude = Number(task?.coordinates?.latitude)
  const longitude = Number(task?.coordinates?.longitude)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return ''
  }

  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
}

const buildAnswerCell = (gameType, task) => {
  const coordinatesText = buildCoordinatesText(task)

  if (gameType === 'photo') {
    return coordinatesText
      ? `Фото-ответ\nКоординаты: ${coordinatesText}`
      : 'Фото-ответ'
  }

  const codes = (Array.isArray(task?.codes) ? task.codes : [])
    .map((code) => (typeof code === 'string' ? code.trim() : ''))
    .filter(Boolean)

  const codesText = codes.join(', ')
  if (codesText && coordinatesText) {
    return `${codesText}\nКоординаты: ${coordinatesText}`
  }

  if (codesText) {
    return codesText
  }

  if (coordinatesText) {
    return `Координаты: ${coordinatesText}`
  }

  return ''
}

const toCell = (value) =>
  `<Cell ss:StyleID="Wrap"><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`

const toHeaderCell = (value) =>
  `<Cell ss:StyleID="HeaderWrap"><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`

const buildSpreadsheetXml = (rows) => {
  const header = [
    'Название игры',
    'Дата',
    'Тип игры',
    'Задание',
    'Подсказки',
    'Ответ',
    'Как разгадать?',
  ]

  const headerRow = `<Row>${header.map(toHeaderCell).join('')}</Row>`
  const dataRows = rows
    .map((row) => {
      const cells = [
        row.gameName,
        row.gameDate,
        row.gameType,
        row.taskText,
        row.cluesText,
        row.answerText,
        row.howToSolveText,
      ]
      return `<Row>${cells.map(toCell).join('')}</Row>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Top"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="11"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Wrap">
   <Alignment ss:Vertical="Top" ss:WrapText="1"/>
  </Style>
  <Style ss:ID="HeaderWrap">
   <Alignment ss:Vertical="Top" ss:WrapText="1"/>
   <Font ss:Bold="1"/>
   <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Задания игр">
  <Table>
   <Column ss:Width="220"/>
   <Column ss:Width="110"/>
   <Column ss:Width="90"/>
   <Column ss:Width="420"/>
   <Column ss:Width="320"/>
   <Column ss:Width="260"/>
   <Column ss:Width="320"/>
   ${headerRow}
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isDeveloperRole(session.user.role)) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  const requestUrl = new URL(request.url)
  const mode = requestUrl.searchParams.get('mode')
  if (mode !== 'export-game-tasks') {
    return NextResponse.json(
      { success: false, error: 'Неизвестный режим GET для dev/recalculate-ratings' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const Games = db.model('Games')
    const games = await Games.find({
      tasks: { $exists: true, $type: 'array', $ne: [] },
    })
      .sort({ dateStart: 1, _id: 1 })
      .select({
        name: 1,
        dateStart: 1,
        type: 1,
        tasks: 1,
      })
      .lean()

    const rows = []

    for (const game of games) {
      const gameTasks = Array.isArray(game?.tasks) ? game.tasks : []
      if (gameTasks.length === 0) {
        continue
      }

      const gameName =
        typeof game?.name === 'string' && game.name.trim().length > 0
          ? game.name.trim()
          : 'Без названия'

      const gameDate = formatDateKrasnoyarsk(game?.dateStart)
      const gameType = game?.type === 'photo' ? 'photo' : 'classic'

      for (const task of gameTasks) {
        rows.push({
          gameName,
          gameDate,
          gameType,
          taskText: toPlainTaskText(task),
          cluesText: buildCluesCell(task),
          answerText: buildAnswerCell(gameType, task),
          howToSolveText:
            typeof task?.howToSolve === 'string' ? task.howToSolve.trim() : '',
        })
      }
    }

    const xml = buildSpreadsheetXml(rows)
    const dateStamp = new Date().toISOString().slice(0, 10)
    const fileName = `actquest-game-tasks-${dateStamp}.xls`

    return new NextResponse(`\uFEFF${xml}`, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.ms-excel; charset=UTF-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
        'X-Exported-Rows': String(rows.length),
        'X-Exported-Games': String(games.length),
      },
    })
  } catch (error) {
    console.error('Failed to export game tasks to excel (app)', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось выгрузить задания в Excel' },
      { status: 500 },
    )
  }
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isDeveloperRole(session.user.role)) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const Games = db.model('Games')
    const ratedGames = await Games.find({
      status: { $in: ['finished', 'closed'] },
      isRated: { $ne: false },
    })
      .sort({ dateStart: 1, _id: 1 })
      .select({
        _id: 1,
        status: 1,
        hideResult: 1,
        location: 1,
        dateStart: 1,
        dateStartFact: 1,
        dateEndFact: 1,
        taskDuration: 1,
        taskFailurePenalty: 1,
        manyCodesPenalty: 1,
        tasks: 1,
        result: 1,
      })
      .lean()

    await Promise.all([
      db.model('Users').updateMany(
        {},
        {
          $unset: {
            rating: '',
            ratingsByLocation: '',
            gameStats: '',
          },
        },
      ),
      db.model('Teams').updateMany(
        {},
        {
          $unset: {
            rating: '',
            ratingsByLocation: '',
            gameStats: '',
          },
        },
      ),
    ])

    let usersStatsUpdatedOperations = 0
    let teamsStatsUpdatedOperations = 0
    let usersUpdatedOperations = 0
    let teamsUpdatedOperations = 0
    let gamesWithRebuiltResults = 0
    let gamesSkippedNoSnapshots = 0
    let finalGlobalRatingsRebuild = {
      usersUpdated: 0,
      teamsUpdated: 0,
    }

    for (const gameSource of ratedGames) {
      let game = gameSource
      try {
        const hasResultSnapshots =
          Array.isArray(game?.result?.teams) &&
          game.result.teams.length > 0 &&
          Array.isArray(game?.result?.gameTeams) &&
          game.result.gameTeams.length > 0 &&
          Array.isArray(game?.result?.teamsUsers) &&
          game.result.teamsUsers.length > 0

        if (!hasResultSnapshots) {
          gamesSkippedNoSnapshots += 1
          continue
        }

        const built = await buildGameResultComputed({ game })
        const nextResult = {
          ...(game.result && typeof game.result === 'object' ? game.result : {}),
          teamsPlaces: built.teamsPlaces,
          computed: built.computed,
        }

        const updatedGame = await Games.findByIdAndUpdate(
          game._id,
          { result: nextResult },
          { returnDocument: 'after', runValidators: true },
        ).lean()

        if (updatedGame) {
          game = updatedGame
          gamesWithRebuiltResults += 1
        }
      } catch (buildError) {
        if (buildError?.code === 'RESULT_SNAPSHOTS_MISSING') {
          gamesSkippedNoSnapshots += 1
          continue
        }
        throw buildError
      }

      const statsUpdateInfo = await updateParticipantsClosedStats({ db, game })
      usersStatsUpdatedOperations += Number(statsUpdateInfo?.usersUpdated) || 0
      teamsStatsUpdatedOperations += Number(statsUpdateInfo?.teamsUpdated) || 0

      const ratingUpdateInfo = await updateParticipantsRatings({ db, game })
      usersUpdatedOperations += Number(ratingUpdateInfo?.usersUpdated) || 0
      teamsUpdatedOperations += Number(ratingUpdateInfo?.teamsUpdated) || 0
    }

    const globalRatingSourceGame =
      ratedGames.length > 0 ? ratedGames[ratedGames.length - 1] : null
    if (globalRatingSourceGame?._id) {
      finalGlobalRatingsRebuild = await updateParticipantsRatings({
        db,
        game: globalRatingSourceGame,
        updateAllEntities: true,
      })
      usersUpdatedOperations +=
        Number(finalGlobalRatingsRebuild?.usersUpdated) || 0
      teamsUpdatedOperations +=
        Number(finalGlobalRatingsRebuild?.teamsUpdated) || 0
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          gamesProcessed: ratedGames.length,
          gamesWithRebuiltResults,
          gamesSkippedNoSnapshots,
          usersStatsUpdatedOperations,
          teamsStatsUpdatedOperations,
          usersUpdatedOperations,
          teamsUpdatedOperations,
          finalGlobalRatingsRebuild,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to recalculate ratings (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось полностью пересчитать рейтинг игроков и команд',
      },
      { status: 500 },
    )
  }
}

