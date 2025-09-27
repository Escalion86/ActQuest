import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import dbConnect from '@utils/dbConnect'
import executeCommand from '@server/executeCommand'
import { decodeCommandKeys } from 'telegram/func/commandShortcuts'
import { numToCommand } from 'telegram/commands/commandsArray'

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)

  if (!session?.user?.telegramId) {
    return res.status(401).json({ success: false, error: 'Необходимо войти через Telegram' })
  }

  const { location, command, message } = req.body || {}
  const targetLocation = location || session.user.location

  if (!targetLocation) {
    return res
      .status(400)
      .json({ success: false, error: 'Не удалось определить игровую площадку' })
  }

  try {
    const db = await dbConnect(targetLocation)
    if (!db) {
      return res
        .status(400)
        .json({ success: false, error: 'Указана неизвестная игровая площадка' })
    }

    const telegramId = session.user.telegramId

    let user = await db.model('Users').findOne({ telegramId })

    if (!user) {
      const name = session.user?.name || session.user?.username || 'Участник'
      user = await db.model('Users').create({
        telegramId,
        name,
        username: session.user?.username ?? null,
        photoUrl: session.user?.photoUrl ?? null,
        languageCode: session.user?.languageCode ?? null,
        isPremium: session.user?.isPremium ?? false,
      })
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
      if (session.user?.languageCode && session.user.languageCode !== user.languageCode) {
        updates.languageCode = session.user.languageCode
      }
      if (typeof session.user?.isPremium === 'boolean' && session.user.isPremium !== user.isPremium) {
        updates.isPremium = session.user.isPremium
      }

      if (Object.keys(updates).length > 0) {
        user = await db
          .model('Users')
          .findOneAndUpdate({ telegramId }, { $set: updates }, { new: true })
      }
    }

    const lastCommand = await db
      .model('LastCommands')
      .findOne({ userTelegramId: telegramId })
      .lean()

    let jsonCommand = mergeWithLastCommand(parseCommandPayload(command), lastCommand)

    if (message) {
      if (jsonCommand) {
        jsonCommand = { ...jsonCommand, message }
      } else if (lastCommand?.command) {
        jsonCommand = { ...lastCommand.command, message }
      } else {
        return res.status(400).json({ success: false, error: 'Команда для ответа не найдена' })
      }
    }

    if (!jsonCommand) {
      return res
        .status(400)
        .json({ success: false, error: 'Не удалось определить команду для выполнения' })
    }

    const result = await executeCommand({
      userTelegramId: telegramId,
      jsonCommand,
      location: targetLocation,
      user: user?.toObject ? user.toObject() : user,
      db,
      lastCommand,
    })

    return res.status(200).json({ success: true, result })
  } catch (error) {
    console.error('Web command error', error)
    return res.status(500).json({ success: false, error: 'Не удалось выполнить команду' })
  }
}
