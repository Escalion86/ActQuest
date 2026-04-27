import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import dbConnectGlobal from '@utils/dbConnectGlobal'
import executeCommand from '@server/executeCommand'
import { decodeCommandKeys } from 'telegram/func/commandShortcuts'
import { numToCommand } from 'telegram/commands/commandsArray'
import { authOptions } from '@server/auth/authOptions'

const parseCommandPayload = (command) => {
  if (!command) return null

  let parsed = command

  if (typeof command === 'string') {
    if (command.startsWith('/')) {
      return { c: command.slice(1) }
    }

    try {
      parsed = JSON.parse(command)
    } catch (error) {
      return { c: command }
    }
  }

  if (typeof parsed !== 'object' || parsed === null) return null

  const decoded = decodeCommandKeys(parsed)
  const commandValue = decoded.c

  if (typeof commandValue === 'number') {
    decoded.c = numToCommand[commandValue] ?? commandValue
  }

  return decoded
}

const mergeWithLastCommand = (command, lastCommand) => {
  if (!command) return null
  if (!lastCommand) return command

  const result = { ...command }

  if (result.prevC && lastCommand.prevCommand) {
    const { prevC, ...rest } = result
    return { ...lastCommand.prevCommand, ...rest }
  }

  if (!result.c) {
    return { ...lastCommand.command, ...result }
  }

  return result
}

export async function POST(request) {
  const session = await getServerSession(authOptions)

  const sessionUserId =
    session?.user?.globalUserId ||
    session?.user?.userId ||
    session?.user?._id ||
    session?.user?.id ||
    null
  const sessionTelegramId =
    session?.user?.telegramId !== null && session?.user?.telegramId !== undefined
      ? Number(session.user.telegramId)
      : null
  const hasTelegramId = Number.isFinite(sessionTelegramId)

  if (!sessionUserId && !hasTelegramId) {
    return NextResponse.json(
      { success: false, error: 'Необходимо войти в аккаунт' },
      { status: 401 },
    )
  }

  const { location, command, message } =
    (await request.json().catch(() => ({}))) || {}
  const targetLocation = location || session.user.location

  if (!targetLocation) {
    return NextResponse.json(
      { success: false, error: 'Не удалось определить игровую площадку' },
      { status: 400 },
    )
  }

  try {
    const db = await dbConnectGlobal()
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Указана неизвестная игровая площадка' },
        { status: 400 },
      )
    }

    let user = null
    if (sessionUserId) {
      user = await db.model('Users').findById(String(sessionUserId))
    }
    if (!user && hasTelegramId) {
      user = await db.model('Users').findOne({ telegramId: sessionTelegramId })
    }

    if (!user) {
      const name = session.user?.name || session.user?.username || 'Участник'
      const payload = {
        name,
        username: session.user?.username ?? null,
        photoUrl: session.user?.photoUrl ?? null,
        languageCode: session.user?.languageCode ?? null,
        isPremium: session.user?.isPremium ?? false,
        currentLocation: targetLocation,
      }
      if (hasTelegramId) {
        payload.telegramId = sessionTelegramId
      }
      user = await db.model('Users').create(payload)
    } else {
      const updates = {}
      if (session.user?.name && session.user.name !== user.name) {
        updates.name = session.user.name
      }
      if (session.user?.username && session.user.username !== user.username) {
        updates.username = session.user.username
      }
      if (session.user?.photoUrl && session.user.photoUrl !== user.photoUrl) {
        updates.photoUrl = session.user.photoUrl
      }
      if (
        session.user?.languageCode &&
        session.user.languageCode !== user.languageCode
      ) {
        updates.languageCode = session.user.languageCode
      }
      if (
        typeof session.user?.isPremium === 'boolean' &&
        session.user.isPremium !== user.isPremium
      ) {
        updates.isPremium = session.user.isPremium
      }
      if (
        typeof targetLocation === 'string' &&
        targetLocation.trim().length > 0 &&
        targetLocation !== user.currentLocation
      ) {
        updates.currentLocation = targetLocation
      }

      if (Object.keys(updates).length > 0) {
        const userFilter = sessionUserId
          ? { _id: String(sessionUserId) }
          : { telegramId: sessionTelegramId }
        user = await db
          .model('Users')
          .findOneAndUpdate(userFilter, { $set: updates }, { returnDocument: 'after' })
      }
    }

    const lastCommand = hasTelegramId
      ? await db
          .model('LastCommands')
          .findOne({ userTelegramId: sessionTelegramId })
          .lean()
      : null

    let jsonCommand = mergeWithLastCommand(parseCommandPayload(command), lastCommand)

    if (message) {
      if (jsonCommand) {
        jsonCommand = { ...jsonCommand, message }
      } else if (lastCommand?.command) {
        jsonCommand = { ...lastCommand.command, message }
      } else {
        return NextResponse.json(
          { success: false, error: 'Команда для ответа не найдена' },
          { status: 400 },
        )
      }
    }

    if (!jsonCommand) {
      return NextResponse.json(
        { success: false, error: 'Не удалось определить команду для выполнения' },
        { status: 400 },
      )
    }

    const result = await executeCommand({
      userTelegramId: hasTelegramId ? sessionTelegramId : null,
      userId: sessionUserId ? String(sessionUserId) : null,
      jsonCommand,
      location: targetLocation,
      user: user?.toObject ? user.toObject() : user,
      db,
      lastCommand,
    })

    return NextResponse.json({ success: true, result }, { status: 200 })
  } catch (error) {
    console.error('Web command error', error)
    return NextResponse.json(
      { success: false, error: 'Не удалось выполнить команду' },
      { status: 500 },
    )
  }
}

