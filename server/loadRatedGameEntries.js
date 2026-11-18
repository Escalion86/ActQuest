import { toStringId } from '../helpers/idAndDate.js'

const ratingEntryFields = {
  _id: 1,
  name: 1,
  dateStart: 1,
  location: 1,
  seasonId: 1,
  seasonName: 1,
  participationMode: 1,
}

const readEntries = (model, filter, fields, session) => {
  const query = model.find(filter).select(fields)
  if (session) query.session(session)
  return query.lean()
}

const compareEntries = (first, second) => {
  const firstDate = new Date(first.dateStart ?? 0).getTime() || 0
  const secondDate = new Date(second.dateStart ?? 0).getTime() || 0
  return (
    firstDate - secondDate ||
    String(first._id).localeCompare(String(second._id), 'ru')
  )
}

export const getRatingEntryTeamPlaces = (entry) => {
  const places = entry?.result?.teamsPlaces
  const entries =
    places instanceof Map ? places.entries() : Object.entries(places || {})
  const teamPlaces = new Map()
  for (const [id, place] of entries) {
    const teamId = toStringId(id)
    const numericPlace = Number(place)
    if (teamId && Number.isFinite(numericPlace)) {
      teamPlaces.set(teamId, numericPlace)
    }
  }
  return teamPlaces
}

export const loadRatedGameEntries = async ({
  db,
  location,
  seasonId,
  session,
  resultFields = ['teamsPlaces', 'teamsUsers'],
}) => {
  const scope = {
    isRated: { $ne: false },
    ...(location ? { location } : {}),
    ...(seasonId ? { seasonId } : {}),
  }
  const fields = { ...ratingEntryFields }
  for (const field of resultFields) fields[`result.${field}`] = 1
  const stages = await readEntries(
    db.model('GameStages'),
    scope,
    { ...fields, 'result.teamsPlaces': 1, fallbackGameIds: 1 },
    session,
  )
  const publishedStages = []
  const allowedGames = [{ stageId: null }]
  for (const stage of stages) {
    if (stage.result?.teamsPlaces) {
      publishedStages.push({ ...stage, stageId: stage._id })
    } else if (stage.fallbackGameIds?.length) {
      allowedGames.push({
        stageId: stage._id,
        _id: { $in: stage.fallbackGameIds },
      })
    }
  }
  const games = await readEntries(
    db.model('Games'),
    { ...scope, status: 'closed', $or: allowedGames },
    fields,
    session,
  )

  return [...games, ...publishedStages].sort(compareEntries)
}
