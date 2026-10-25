import normalizeTelegramId from './normalizeTelegramId.js'
import { toStringId } from './idAndDate.js'

// Telegram ID не создаёт отдельного участника и не определяет владельца
// исторического результата. Старые снимки требуют явного восстановления userId.
export default function assertParticipantUserIds(games) {
  const missing = []
  for (const game of games || []) {
    for (const member of game?.result?.teamsUsers || []) {
      if (!toStringId(member?.userId) && normalizeTelegramId(member?.userTelegramId)) {
        missing.push({ gameId: toStringId(game._id), membershipId: toStringId(member._id) })
      }
    }
  }
  if (missing.length) throw Object.assign(new Error(
    'В исторических участниках отсутствует userId. Пересчёт отменён: восстановите userId в снимках результатов.',
  ), { code: 'PARTICIPANT_USER_ID_REQUIRED', missing })
}
