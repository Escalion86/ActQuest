const omitCodeValue = (value) => {
  if (!value || typeof value !== 'object') {
    return value
  }
  const { code: _code, ...safeValue } = value
  return safeValue
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

  const prequel =
    source.prequel && typeof source.prequel === 'object'
      ? {
          ...source.prequel,
          bonusCodes: (Array.isArray(source.prequel.bonusCodes)
            ? source.prequel.bonusCodes
            : []
          ).map(omitCodeValue),
          penaltyCodes: (Array.isArray(source.prequel.penaltyCodes)
            ? source.prequel.penaltyCodes
            : []
          ).map(omitCodeValue),
        }
      : source.prequel

  return {
    ...source,
    tasks,
    storyNodes,
    prequel,
  }
}

export default sanitizeGameForPublicRead
