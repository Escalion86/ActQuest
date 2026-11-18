import { Types } from 'mongoose'
import { toStringId } from '../helpers/idAndDate.js'

export const getGameStageSummaries = async (db, games) => {
  const stageIds = [...new Set(games.map((game) => toStringId(game?.stageId)))]
    .filter((id) => id && Types.ObjectId.isValid(id))
  if (!stageIds.length) return new Map()

  const stages = await db.model('GameStages').aggregate([
    { $match: { _id: { $in: stageIds.map((id) => new Types.ObjectId(id)) } } },
    { $project: { name: 1, isReleased: { $ne: [{ $ifNull: ['$result', null] }, null] } } },
  ])

  return new Map(stages.map((stage) => [toStringId(stage._id), stage]))
}

export const getGameStageSummary = async (db, game) => {
  const stages = await getGameStageSummaries(db, [game])
  return stages.get(toStringId(game?.stageId))
}
