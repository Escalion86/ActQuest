import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import sendMessage from 'telegram/sendMessage'
import { LOCATIONS } from '@server/serverConstants'

const isDeveloperRole = (role) => {
  if (typeof role !== 'string') {
    return false
  }

  return role.trim().toLowerCase() === 'dev'
}

const normalizeLocation = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return normalized || null
}

const resolveSupportedLocations = () =>
  Object.entries(LOCATIONS)
    .filter(([, config]) => !config?.hidden)
    .map(([locationKey]) => locationKey)

const TELEGRAM_TOKEN_ENV_BY_LOCATION = {
  dev: 'TELEGRAM_DEV_TOKEN',
  krsk: 'TELEGRAM_KRSK_TOKEN',
  nrsk: 'TELEGRAM_NRSK_TOKEN',
  ekb: 'TELEGRAM_EKB_TOKEN',
}

const getMissingTokenLocations = (locations) =>
  locations.filter((locationKey) => {
    const envKey = TELEGRAM_TOKEN_ENV_BY_LOCATION[locationKey]
    if (!envKey) {
      return true
    }
    const token = process.env[envKey]
    return typeof token !== 'string' || token.trim().length === 0
  })

const splitToChunks = (items, chunkSize) => {
  const safeChunkSize = Math.max(1, Number(chunkSize) || 1)
  const result = []
  for (let index = 0; index < items.length; index += safeChunkSize) {
    result.push(items.slice(index, index + safeChunkSize))
  }
  return result
}

const collectTelegramIdsForLocation = async ({ db, location }) => {
  const telegramIds = new Set()

  const games = await db
    .model('Games')
    .find({ location })
    .select({ _id: 1, creatorTelegramId: 1 })
    .lean()

  const gameIds = games
    .map((game) => (game?._id ? String(game._id) : null))
    .filter(Boolean)

  games.forEach((game) => {
    const creatorTelegramId = Number(game?.creatorTelegramId)
    if (Number.isFinite(creatorTelegramId)) {
      telegramIds.add(creatorTelegramId)
    }
  })

  if (!gameIds.length) {
    return telegramIds
  }

  const gameTeams = await db
    .model('GamesTeams')
    .find({ gameId: { $in: gameIds } })
    .select({ teamId: 1 })
    .lean()

  const teamIds = Array.from(
    new Set(
      gameTeams
        .map((item) => (item?.teamId ? String(item.teamId) : null))
        .filter(Boolean),
    ),
  )

  if (!teamIds.length) {
    return telegramIds
  }

  const teamsUsers = await db
    .model('TeamsUsers')
    .find({ teamId: { $in: teamIds } })
    .select({ userTelegramId: 1 })
    .lean()

  teamsUsers.forEach((membership) => {
    const telegramId = Number(membership?.userTelegramId)
    if (Number.isFinite(telegramId)) {
      telegramIds.add(telegramId)
    }
  })

  return telegramIds
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isDeveloperRole(session.user.role)) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав' },
      { status: 403 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  const targetLocation = normalizeLocation(body?.location) || 'all'

  if (!message) {
    return NextResponse.json(
      { success: false, error: 'Введите сообщение для рассылки' },
      { status: 400 },
    )
  }

  const supportedLocations = resolveSupportedLocations()
  if (targetLocation !== 'all' && !supportedLocations.includes(targetLocation)) {
    return NextResponse.json(
      { success: false, error: 'Некорректный город для рассылки' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных')
    }

    const targetLocations =
      targetLocation === 'all' ? supportedLocations : [targetLocation]

    const missingTokenLocations = getMissingTokenLocations(targetLocations)
    if (missingTokenLocations.length > 0) {
      const details = missingTokenLocations
        .map((locationKey) => {
          const envKey =
            TELEGRAM_TOKEN_ENV_BY_LOCATION[locationKey] || 'UNKNOWN_TOKEN'
          return `${locationKey} (${envKey})`
        })
        .join(', ')
      return NextResponse.json(
        {
          success: false,
          error: `Не настроены Telegram токены для локаций: ${details}`,
        },
        { status: 400 },
      )
    }

    const recipients = []
    for (const locationKey of targetLocations) {
      const locationTelegramIds = await collectTelegramIdsForLocation({
        db,
        location: locationKey,
      })

      locationTelegramIds.forEach((telegramId) => {
        recipients.push({
          chatId: telegramId,
          location: locationKey,
        })
      })
    }

    const uniqueRecipientsMap = new Map()
    recipients.forEach((recipient) => {
      uniqueRecipientsMap.set(
        `${recipient.location}:${recipient.chatId}`,
        recipient,
      )
    })
    const uniqueRecipients = Array.from(uniqueRecipientsMap.values())

    const skippedNoTelegram = 0
    const skippedNoLocation = 0
    const batches = splitToChunks(uniqueRecipients, 25)

    let sent = 0
    let failed = 0
    const failures = []
    const sentRecipients = []

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map(({ chatId, location }) =>
          sendMessage({
            chat_id: chatId,
            text: message,
            location,
          }),
        ),
      )

      results.forEach((result, index) => {
        const recipient = batch[index]
        const sendValue = result.status === 'fulfilled' ? result.value : null
        const sendReturnedError = sendValue instanceof Error

        if (result.status === 'fulfilled' && !sendReturnedError) {
          sent += 1
          sentRecipients.push({
            chatId: recipient.chatId,
            location: recipient.location,
          })
          return
        }

        failed += 1
        if (failures.length < 20) {
          failures.push({
            chatId: recipient.chatId,
            location: recipient.location,
            error:
              (sendReturnedError ? sendValue?.message : null) ||
              result.reason?.message ||
              'Ошибка отправки',
          })
        }
      })
    }

    const uniqueSentTelegramIds = Array.from(
      new Set(
        sentRecipients
          .map((item) => Number(item.chatId))
          .filter((id) => Number.isFinite(id)),
      ),
    ).sort((a, b) => a - b)

    return NextResponse.json(
      {
        success: true,
        data: {
          requestedLocation: targetLocation,
          usersMatched: uniqueRecipients.length,
          uniqueRecipients: uniqueRecipients.length,
          skippedNoTelegram,
          skippedNoLocation,
          sent,
          failed,
          sentTelegramIds: uniqueSentTelegramIds,
          sentRecipients,
          failures,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Failed to broadcast bot message (app)', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Не удалось выполнить рассылку по подписчикам ботов',
      },
      { status: 500 },
    )
  }
}
