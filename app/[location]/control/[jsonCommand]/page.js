import { notFound } from 'next/navigation'

import executeCommand from '@server/executeCommand'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { decodeCommandKeys } from 'telegram/func/commandShortcuts'
import GameControlPageClient from '@components/location-game/GameControlPageClient'

export const dynamic = 'force-dynamic'

export default async function GameControlPage({ params }) {
  const location = params?.location
  const jsonCommand = params?.jsonCommand

  if (typeof location !== 'string' || typeof jsonCommand !== 'string') {
    notFound()
  }

  const db = await dbConnectGlobal()
  if (!db) {
    return <GameControlPageClient location={location} result={{ text: 'Нет подключения к базе данных' }} />
  }

  const user = await db.model('Users').findOne({ telegramId: 261102161 }).lean()
  if (!user) {
    return <GameControlPageClient location={location} result={{ text: 'Пользователь не найден' }} />
  }

  let cmd
  try {
    cmd = decodeCommandKeys(JSON.parse(jsonCommand))
  } catch {
    cmd = { c: jsonCommand }
  }

  const lastCmd = await db
    .model('LastCommands')
    .findOne({
      userTelegramId: 261102161,
    })
    .lean()

  if (lastCmd) {
    cmd = { ...lastCmd.command, ...cmd }
  }

  const result = await executeCommand({
    userTelegramId: user.telegramId,
    jsonCommand: cmd,
    location,
    user,
    db,
    lastCommand: lastCmd,
  })

  return (
    <GameControlPageClient
      location={location}
      result={JSON.parse(JSON.stringify(result || {}))}
    />
  )
}
