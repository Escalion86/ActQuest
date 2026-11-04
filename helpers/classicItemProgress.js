const codeKey = (value) => String(value ?? '').trim().toLowerCase()
export const getClassicItemStage = (team, task, index) => team?.classicProgress?.stages?.find((entry) => entry.stageId === String(task?.stageKey || task?._id || task?.id || index))
export const getVirtualMainCodesCount = (team, task, index) => Math.max(0, Number(getClassicItemStage(team, task, index)?.virtualCodes) || 0)
export const getClassicFoundMainCodesCount = (team, task, index) => new Set((team?.findedCodes?.[index] || []).map(codeKey)).size + getVirtualMainCodesCount(team, task, index)

export const getClassicPenaltyCandidates = (game, team, task, index) => {
  const stage = getClassicItemStage(team, task, index)
  const waived = new Set((stage?.waivedPenalties || []).map((entry) => entry.key))
  const found = new Set((team?.findedPenaltyCodes?.[index] || []).map(codeKey))
  const penalties = (task?.penaltyCodes || []).filter((entry) => found.has(codeKey(entry.code)) && Number(entry.penalty) > 0)
    .map((entry) => ({ key: `code:${codeKey(entry.code)}`, name: `Штрафной код ${entry.code}`, seconds: Number(entry.penalty) }))
  const limit = Number(game?.manyCodesPenalty?.[0]) || 0
  const seconds = Number(game?.manyCodesPenalty?.[1]) || 0
  if (limit > 0 && seconds > 0) {
    const batches = Math.floor((team?.wrongCodes?.[index]?.length || 0) / limit)
    for (let batch = 1; batch <= batches; batch++) penalties.push({ key: `wrong:${batch}`, name: `Подбор кода: штраф №${batch}`, seconds })
  }
  return penalties.filter((entry) => !waived.has(entry.key))
}
