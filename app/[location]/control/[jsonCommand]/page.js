import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'

import executeCommand from '@server/executeCommand'
import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import resolveSessionUserFilter from '@helpers/resolveSessionUserFilter'
import { decodeCommandKeys } from 'telegram/func/commandShortcuts'
import GameControlPageClient from '@components/location-game/GameControlPageClient'

export const dynamic = 'force-dynamic'

export default async function GameControlPage({ params }) {
  const location = params?.location
  const jsonCommand = params?.jsonCommand

  if (typeof location !== 'string' || typeof jsonCommand !== 'string') {
    notFound()
  }

  const session = await getServerSession(authOptions)
  if (String(session?.user?.role || '').trim().toLowerCase() !== 'dev') {
    notFound()
  }

  const sessionUserFilter = resolveSessionUserFilter(session.user)
  if (!sessionUserFilter) {
    notFound()
  }

  const db = await dbConnectGlobal()
  if (!db) {
    return <GameControlPageClient location={location} result={{ text: 'Нет подключения к базе данных' }} />
  }

  const user = await db.model('Users').findOne(sessionUserFilter).lean()
  if (!user?.telegramId) {
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
      userTelegramId: user.telegramId,
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
