const omitCodeValue = (value) => {
  if (!value || typeof value !== 'object') {
    return value
  }
  const { code: _code, ...safeValue } = value
  return safeValue
}

const sanitizePrequel = (prequel, now = new Date()) => {
  if (!prequel || typeof prequel !== 'object') return prequel
  const openAt = prequel?.openAt ? new Date(prequel.openAt) : null
  const isOpen = !openAt || Number.isNaN(openAt.getTime()) || openAt <= now
  const mainCodes = Array.isArray(prequel.mainCodes) ? prequel.mainCodes : []
  const bonusCodes = Array.isArray(prequel.bonusCodes) ? prequel.bonusCodes : []
  const penaltyCodes = Array.isArray(prequel.penaltyCodes)
    ? prequel.penaltyCodes
    : []

  return {
    ...prequel,
    mainCodesCount: mainCodes.length,
    bonusCodesCount: bonusCodes.length,
    penaltyCodesCount: penaltyCodes.length,
    mainCodes: [],
    bonusCodes: bonusCodes.map(omitCodeValue),
    penaltyCodes: penaltyCodes.map(omitCodeValue),
    ...(!isOpen
      ? { description: '', descriptionRich: '', descriptionMedia: [] }
      : {}),
  }
}

// Публичные страницы используют общую информацию об игре и данные результата,
// но правильные ответы должны приходить участникам только через game-task state.
const sanitizeGameForPublicRead = (game) => {
  const source = game?.toObject ? game.toObject() : game
  if (!source || typeof source !== 'object') {
    return source
  }

  const normalizedStatus = String(source.status || '').trim().toLowerCase()
  const isFinished = normalizedStatus === 'finished' || normalizedStatus === 'closed'
  const tasks = (Array.isArray(source.tasks) ? source.tasks : []).map((task) => ({
    ...task,
    codesCount: Array.isArray(task?.codes) ? task.codes.length : 0,
    codes: [],
    codePhotos: [],
    bonusCodes: (Array.isArray(task?.bonusCodes) ? task.bonusCodes : []).map(
      omitCodeValue,
    ),
    penaltyCodes: (Array.isArray(task?.penaltyCodes) ? task.penaltyCodes : []).map(
      omitCodeValue,
    ),
    ...(!isFinished
      ? {
          cluesCount: Array.isArray(task?.clues) ? task.clues.length : 0,
          clues: [],
          howToSolve: '',
          postMessage: '',
          postMessageRich: '',
          postMessageMedia: [],
        }
      : {}),
  }))

  const storyNodes = (Array.isArray(source.storyNodes) ? source.storyNodes : []).map(
    (node) => ({
      ...node,
      codesCount: Array.isArray(node?.codes) ? node.codes.length : 0,
      codes: [],
      ...(!isFinished
        ? {
            cluesCount: Array.isArray(node?.clues) ? node.clues.length : 0,
            clues: [],
          }
        : {}),
    }),
  )

  const prequels = (
    Array.isArray(source.prequels) && source.prequels.length > 0
      ? source.prequels
      : source.prequel
        ? [source.prequel]
        : []
  ).map((item) => sanitizePrequel(item))
  const prequel = prequels[0] || sanitizePrequel(source.prequel)
  const storyAccusation = source?.storyAccusation || {}

  return {
    ...source,
    tasks,
    storyNodes,
    storyCharacters: [],
    storyTopics: [],
    storyInteractions: [],
    storyEvidence: [],
    storyAccusation: {
      enabled: storyAccusation?.enabled === true,
      minSelectableEvidence:
        Number(storyAccusation?.minSelectableEvidence) || 0,
      maxSelectableEvidence:
        Number(storyAccusation?.maxSelectableEvidence) || 0,
    },
    prequel,
    prequels,
  }
}

export default sanitizeGameForPublicRead
