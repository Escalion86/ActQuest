import {
  getDuplicateCodeKindsLabel,
  getTaskDuplicateCodeConflicts,
} from './getTaskDuplicateCodeConflicts.js'
import {
  getTimedCluesCount,
  normalizeClueEarlyAccessFrom,
} from './clueEarlyAccess.js'
import { getRequiredMainCodesValidationError } from './classicGameRules.js'

const stripHtmlToPlainText = (value) =>
  String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r?\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const hasMeaningfulRichMarkup = (value) => {
  const rich = String(value || '')
  if (!rich.trim()) {
    return false
  }

  if (
    /<(img|video|audio|iframe|figure|svg|table|code|pre|blockquote|ul|ol|li|h[1-6])\b/i.test(
      rich,
    )
  ) {
    return true
  }

  // TipTap кастомные node-рендеры (аудио/видео/изображения и т.п.)
  if (
    /\b(node-image|node-video|node-audio|node-audio-message|node-audioMessage|react-renderer)\b/i.test(
      rich,
    )
  ) {
    return true
  }

  return false
}

const hasMediaItems = (value) =>
  Array.isArray(value) &&
  value.some((item) => {
    if (!item || typeof item !== 'object') {
      return false
    }
    const type = typeof item.type === 'string' ? item.type.trim() : ''
    const url = typeof item.url === 'string' ? item.url.trim() : ''
    const path = typeof item.path === 'string' ? item.path.trim() : ''
    return Boolean(type && (url || path))
  })

const isTaskDescriptionFilled = (task) => {
  const plain = typeof task?.task === 'string' ? task.task.trim() : ''
  if (plain) {
    return true
  }

  const rich = typeof task?.taskRich === 'string' ? task.taskRich.trim() : ''
  if (stripHtmlToPlainText(rich)) {
    return true
  }

  if (hasMeaningfulRichMarkup(rich)) {
    return true
  }

  return hasMediaItems(task?.taskMedia)
}

const getEmptyCodePositions = (codes) =>
  (Array.isArray(codes) ? codes : []).reduce((positions, code, index) => {
    if (typeof code !== 'string' || code.trim() === '') {
      positions.push(index + 1)
    }
    return positions
  }, [])

const normalizeStoryId = (value) =>
  value === null || value === undefined ? '' : String(value).trim()

const getDuplicateStoryIds = (items) => {
  const seen = new Set()
  const duplicates = new Set()

  ;(Array.isArray(items) ? items : []).forEach((item) => {
    const id = normalizeStoryId(item?.id)
    if (!id) return
    if (seen.has(id)) duplicates.add(id)
    seen.add(id)
  })

  return Array.from(duplicates)
}

const appendStoryIdErrors = ({ errors, label, values }) => {
  const items = Array.isArray(values) ? values : []
  const emptyIdsCount = items.filter((item) => !normalizeStoryId(item?.id)).length
  if (emptyIdsCount > 0) {
    errors.push(`Заполните идентификаторы ${label}: ${emptyIdsCount}.`)
  }
  const duplicates = getDuplicateStoryIds(items)
  if (duplicates.length > 0) {
    errors.push(`Дублируются идентификаторы ${label}: ${duplicates.join(', ')}.`)
  }
}

const validateStoryReferences = ({
  errors,
  values,
  allowedIds,
  label,
}) => {
  ;(Array.isArray(values) ? values : []).forEach((value) => {
    const id = normalizeStoryId(value)
    if (id && !allowedIds.has(id)) {
      errors.push(`${label}: ссылка «${id}» не существует.`)
    }
  })
}

const storyRequirementsCanBeMet = ({
  requirements,
  completedNodeIds,
  activeItemIds,
}) => {
  const requiredNodeIds = (Array.isArray(
    requirements?.requiredNodeIds ?? requirements?.requiredCompletedNodeIds,
  )
    ? requirements.requiredNodeIds ?? requirements.requiredCompletedNodeIds
    : []
  )
    .map(normalizeStoryId)
    .filter(Boolean)
  const requiredItemIds = (Array.isArray(requirements?.requiredItemIds)
    ? requirements.requiredItemIds
    : []
  )
    .map(normalizeStoryId)
    .filter(Boolean)
  const enabledInputsCount =
    requiredNodeIds.filter((id) => completedNodeIds.has(id)).length +
    requiredItemIds.filter((id) => activeItemIds.has(id)).length
  const totalInputsCount = requiredNodeIds.length + requiredItemIds.length

  if (totalInputsCount === 0) return true

  if (requirements?.requiredInputMode === 'any') {
    return enabledInputsCount > 0
  }

  if (requirements?.requiredInputMode === 'count') {
    const requiredCount = Math.max(
      1,
      Math.trunc(Number(requirements?.requiredInputCount) || 1),
    )
    return enabledInputsCount >= Math.min(requiredCount, totalInputsCount)
  }

  return (
    requiredNodeIds.every((id) => completedNodeIds.has(id)) &&
    requiredItemIds.every((id) => activeItemIds.has(id))
  )
}

const getPotentialPrequelStoryEffects = (game) =>
  (
    Array.isArray(game?.prequels) && game.prequels.length > 0
      ? game.prequels
      : game?.prequel
        ? [game.prequel]
        : []
  )
    .filter((prequel) => prequel?.enabled)
    .flatMap((prequel) => [
      ...(Array.isArray(prequel?.wrongAttemptsStoryEffects)
        ? prequel.wrongAttemptsStoryEffects
        : []),
      ...(Array.isArray(prequel?.completionBonus?.storyEffects)
        ? prequel.completionBonus.storyEffects
        : []),
      ...(Array.isArray(prequel?.bonusCodes) ? prequel.bonusCodes : []).flatMap(
        (code) => (Array.isArray(code?.storyEffects) ? code.storyEffects : []),
      ),
      ...(Array.isArray(prequel?.penaltyCodes)
        ? prequel.penaltyCodes
        : []
      ).flatMap((code) =>
        Array.isArray(code?.storyEffects) ? code.storyEffects : [],
      ),
    ])

export const getStoryReachabilityReport = (game) => {
  const nodes = Array.isArray(game?.storyNodes) ? game.storyNodes : []
  const endings = Array.isArray(game?.storyEndings) ? game.storyEndings : []
  const reachableNodeIds = new Set()
  const completedNodeIds = new Set()
  const activeItemIds = new Set()
  const explicitlyUnlockedNodeIds = new Set()
  const executableEffectKeys = new Set()

  getPotentialPrequelStoryEffects(game).forEach((effect) => {
    if (effect?.type === 'grant_item') {
      const itemId = normalizeStoryId(effect?.itemId)
      if (itemId) activeItemIds.add(itemId)
    }
    if (effect?.type === 'unlock_node') {
      const nodeId = normalizeStoryId(effect?.nodeId)
      if (nodeId) explicitlyUnlockedNodeIds.add(nodeId)
    }
  })

  let changed = true
  while (changed) {
    changed = false

    nodes.forEach((node) => {
      const nodeId = normalizeStoryId(node?.id)
      if (!nodeId || reachableNodeIds.has(nodeId)) return

      const visibility = node?.visibility || {}
      const hasRequirements =
        (Array.isArray(visibility?.requiredNodeIds) &&
          visibility.requiredNodeIds.some((id) => normalizeStoryId(id))) ||
        (Array.isArray(visibility?.requiredItemIds) &&
          visibility.requiredItemIds.some((id) => normalizeStoryId(id)))
      const isReachable =
        Boolean(visibility?.startVisible) ||
        explicitlyUnlockedNodeIds.has(nodeId) ||
        (!hasRequirements && visibility?.hiddenUntilUnlocked === false) ||
        (hasRequirements &&
          storyRequirementsCanBeMet({
            requirements: visibility,
            completedNodeIds,
            activeItemIds,
          }))

      if (isReachable) {
        reachableNodeIds.add(nodeId)
        changed = true
      }
    })

    nodes.forEach((node) => {
      const nodeId = normalizeStoryId(node?.id)
      if (!reachableNodeIds.has(nodeId)) return

      const effects = [
        ...(Array.isArray(node?.codes)
          ? node.codes.map((effect) => ({ effect, kind: 'code' }))
          : []),
        ...(Array.isArray(node?.actions)
          ? node.actions.map((effect) => ({ effect, kind: 'action' }))
          : []),
      ]
      effects.forEach(({ effect, kind }) => {
        const effectKey = `${nodeId}:${kind}:${normalizeStoryId(effect?.id)}`
        const grantedItemIds = new Set(
          (Array.isArray(effect?.grantsItemIds) ? effect.grantsItemIds : [])
            .map(normalizeStoryId)
            .filter(Boolean),
        )
        const requiredItemIds = [
          ...(Array.isArray(effect?.requiredItemIds)
            ? effect.requiredItemIds
            : []),
          ...(Array.isArray(effect?.consumesItemIds)
            ? effect.consumesItemIds.filter(
                (itemId) => !grantedItemIds.has(normalizeStoryId(itemId)),
              )
            : []),
        ]
        if (
          executableEffectKeys.has(effectKey) ||
          !storyRequirementsCanBeMet({
            requirements: { requiredItemIds },
            completedNodeIds,
            activeItemIds,
          })
        ) {
          return
        }

        executableEffectKeys.add(effectKey)
        ;(Array.isArray(effect?.grantsItemIds)
          ? effect.grantsItemIds
          : []
        ).forEach((itemId) => {
          const normalizedItemId = normalizeStoryId(itemId)
          if (normalizedItemId && !activeItemIds.has(normalizedItemId)) {
            activeItemIds.add(normalizedItemId)
            changed = true
          }
        })
        ;(Array.isArray(effect?.unlocksNodeIds)
          ? effect.unlocksNodeIds
          : []
        ).forEach((unlockedNodeId) => {
          const normalizedNodeId = normalizeStoryId(unlockedNodeId)
          if (
            normalizedNodeId &&
            !explicitlyUnlockedNodeIds.has(normalizedNodeId)
          ) {
            explicitlyUnlockedNodeIds.add(normalizedNodeId)
            changed = true
          }
        })
        const completesNode =
          kind === 'code'
            ? effect?.completesNode !== false
            : Boolean(effect?.completesNode)
        if (completesNode && !completedNodeIds.has(nodeId)) {
          completedNodeIds.add(nodeId)
          changed = true
        }
      })
    })
  }

  const reachableEndingIds = new Set()
  nodes.forEach((node) => {
    const nodeId = normalizeStoryId(node?.id)
    if (!reachableNodeIds.has(nodeId)) return

    const effects = [
      ...(Array.isArray(node?.codes)
        ? node.codes.map((effect) => ({ effect, kind: 'code' }))
        : []),
      ...(Array.isArray(node?.actions)
        ? node.actions.map((effect) => ({ effect, kind: 'action' }))
        : []),
    ]
    effects.forEach(({ effect, kind }) => {
      const endingId = normalizeStoryId(effect?.endingId)
      if (!endingId) return
      const effectKey = `${nodeId}:${kind}:${normalizeStoryId(effect?.id)}`
      if (!executableEffectKeys.has(effectKey)) return
      const ending = endings.find(
        (item) => normalizeStoryId(item?.id) === endingId,
      )
      if (
        ending &&
        storyRequirementsCanBeMet({
          requirements: ending?.conditions,
          completedNodeIds,
          activeItemIds,
        })
      ) {
        reachableEndingIds.add(endingId)
      }
    })
  })

  return {
    reachableNodeIds: Array.from(reachableNodeIds),
    reachableEndingIds: Array.from(reachableEndingIds),
    unreachableNodeIds: nodes
      .map((node) => normalizeStoryId(node?.id))
      .filter((id) => id && !reachableNodeIds.has(id)),
    unreachableEndingIds: endings
      .filter((ending) => !ending?.manualOnly)
      .map((ending) => normalizeStoryId(ending?.id))
      .filter((id) => id && !reachableEndingIds.has(id)),
  }
}

const getInvestigationValidationErrors = (game) => {
  if (game?.storyConfig?.experienceMode !== 'investigation') return []

  const errors = []
  const config = game?.storyConfig?.investigation || {}
  const nodes = Array.isArray(game?.storyNodes) ? game.storyNodes : []
  const items = Array.isArray(game?.storyItems) ? game.storyItems : []
  const endings = Array.isArray(game?.storyEndings) ? game.storyEndings : []
  const characters = Array.isArray(game?.storyCharacters)
    ? game.storyCharacters
    : []
  const topics = Array.isArray(game?.storyTopics) ? game.storyTopics : []
  const interactions = Array.isArray(game?.storyInteractions)
    ? game.storyInteractions
    : []
  const evidence = Array.isArray(game?.storyEvidence) ? game.storyEvidence : []
  const accusation = game?.storyAccusation || {}
  const motives = Array.isArray(accusation?.motives) ? accusation.motives : []
  const outcomes = Array.isArray(accusation?.outcomes)
    ? accusation.outcomes
    : []

  ;[
    ['персонажей расследования', characters],
    ['тем расследования', topics],
    ['взаимодействий расследования', interactions],
    ['доказательств расследования', evidence],
    ['мотивов расследования', motives],
    ['исходов обвинения', outcomes],
  ].forEach(([label, values]) => appendStoryIdErrors({ errors, label, values }))

  const makeIds = (values) =>
    new Set(values.map((item) => normalizeStoryId(item?.id)).filter(Boolean))
  const nodeIds = makeIds(nodes)
  const itemIds = makeIds(items)
  const endingIds = makeIds(endings)
  const characterIds = makeIds(characters)
  const topicIds = makeIds(topics)
  const interactionIds = makeIds(interactions)
  const evidenceIds = makeIds(evidence)
  const motiveIds = makeIds(motives)
  const startNodeId = normalizeStoryId(config?.startNodeId)
  const deadlineMinutes = Number(config?.deadlineMinutes)

  if (!startNodeId || !nodeIds.has(startNodeId)) {
    errors.push('Расследование: выберите существующую стартовую локацию.')
  }
  if (!Number.isFinite(deadlineMinutes) || deadlineMinutes <= 0) {
    errors.push('Расследование: дедлайн должен быть положительным числом минут.')
  }

  characters.forEach((character, index) => {
    const label = `Персонаж ${index + 1}`
    if (!normalizeStoryId(character?.title)) {
      errors.push(`${label}: не указано имя.`)
    }
    const defaultNodeId = normalizeStoryId(character?.defaultNodeId)
    if (defaultNodeId && !nodeIds.has(defaultNodeId)) {
      errors.push(`${label}: локация «${defaultNodeId}» не существует.`)
    }
  })
  topics.forEach((topic, index) => {
    if (!normalizeStoryId(topic?.title)) {
      errors.push(`Тема ${index + 1}: не указано название.`)
    }
  })
  evidence.forEach((item, index) => {
    if (!normalizeStoryId(item?.title)) {
      errors.push(`Доказательство ${index + 1}: не указано название.`)
    }
  })

  const interactionCombinations = new Set()
  interactions.forEach((interaction, index) => {
    const label = `Взаимодействие ${index + 1}`
    const locationId = normalizeStoryId(interaction?.locationId)
    const characterId = normalizeStoryId(interaction?.characterId)
    const topicId = normalizeStoryId(interaction?.topicId)
    if (!nodeIds.has(locationId)) {
      errors.push(`${label}: локация «${locationId}» не существует.`)
    }
    if (characterId && !characterIds.has(characterId)) {
      errors.push(`${label}: персонаж «${characterId}» не существует.`)
    }
    if (topicId && !topicIds.has(topicId)) {
      errors.push(`${label}: тема «${topicId}» не существует.`)
    }
    if (!normalizeStoryId(interaction?.label)) {
      errors.push(`${label}: не указано название.`)
    }
    const timeCost = Number(interaction?.timeCostMinutes)
    if (!Number.isFinite(timeCost) || timeCost < 0) {
      errors.push(`${label}: стоимость времени должна быть неотрицательным числом.`)
    }
    const combination = [
      locationId,
      characterId,
      topicId,
      normalizeStoryId(interaction?.kind) || 'question',
    ].join(':')
    if (interaction?.repeatable !== true && interactionCombinations.has(combination)) {
      errors.push(`${label}: сочетание локации, персонажа, темы и типа дублируется.`)
    }
    interactionCombinations.add(combination)

    const references = [
      ['requiredItemIds', itemIds, 'предмет'],
      ['requiredEvidenceIds', evidenceIds, 'доказательство'],
      ['requiredTopicIds', topicIds, 'тема'],
      ['requiredCharacterIds', characterIds, 'персонаж'],
      ['requiredInteractionIds', interactionIds, 'взаимодействие'],
    ]
    references.forEach(([field, allowedIds, referenceLabel]) =>
      validateStoryReferences({
        errors,
        values: interaction?.conditions?.[field],
        allowedIds,
        label: `${label}, ${referenceLabel}`,
      }),
    )
    ;[
      ['grantsItemIds', itemIds, 'выдаваемый предмет'],
      ['consumesItemIds', itemIds, 'расходуемый предмет'],
      ['grantsEvidenceIds', evidenceIds, 'открываемое доказательство'],
      ['unlocksNodeIds', nodeIds, 'открываемая локация'],
      ['unlocksCharacterIds', characterIds, 'открываемый персонаж'],
      ['unlocksTopicIds', topicIds, 'открываемая тема'],
    ].forEach(([field, allowedIds, referenceLabel]) =>
      validateStoryReferences({
        errors,
        values: interaction?.effects?.[field],
        allowedIds,
        label: `${label}, ${referenceLabel}`,
      }),
    )
    const endingId = normalizeStoryId(interaction?.effects?.endingId)
    if (endingId && !endingIds.has(endingId)) {
      errors.push(`${label}: концовка «${endingId}» не существует.`)
    }
    const hasAudio = (Array.isArray(interaction?.media)
      ? interaction.media
      : []
    ).some((media) => media?.type === 'audio')
    if (hasAudio && !normalizeStoryId(interaction?.responseRich)) {
      errors.push(`${label}: для аудио обязателен текстовый ответ.`)
    }
  })

  if (accusation?.enabled !== true) {
    errors.push('Расследование: включите финальное обвинение.')
    return errors
  }
  const requiredNodeId = normalizeStoryId(accusation?.requiredNodeId)
  const unlockTopicId = normalizeStoryId(accusation?.unlockTopicId)
  if (!nodeIds.has(requiredNodeId)) {
    errors.push('Обвинение: финальная локация не существует.')
  }
  if (!topicIds.has(unlockTopicId)) {
    errors.push('Обвинение: финальная тема не существует.')
  }
  validateStoryReferences({
    errors,
    values: accusation?.culpritCharacterIds,
    allowedIds: characterIds,
    label: 'Обвинение, подозреваемый',
  })
  validateStoryReferences({
    errors,
    values: accusation?.availability?.requiredEvidenceIds,
    allowedIds: evidenceIds,
    label: 'Обвинение, обязательное доказательство',
  })
  validateStoryReferences({
    errors,
    values: accusation?.availability?.requiredInteractionIds,
    allowedIds: interactionIds,
    label: 'Обвинение, обязательное взаимодействие',
  })
  const correctCulpritId = normalizeStoryId(accusation?.correctCulpritId)
  const correctMotiveId = normalizeStoryId(accusation?.correctMotiveId)
  if (
    !(Array.isArray(accusation?.culpritCharacterIds)
      ? accusation.culpritCharacterIds
      : []
    )
      .map(normalizeStoryId)
      .includes(correctCulpritId)
  ) {
    errors.push('Обвинение: правильный подозреваемый отсутствует в вариантах.')
  }
  if (!motiveIds.has(correctMotiveId)) {
    errors.push('Обвинение: правильный мотив отсутствует в вариантах.')
  }
  ;['fallbackEndingId', 'timeoutEndingId'].forEach((field) => {
    const endingId = normalizeStoryId(accusation?.[field])
    if (!endingIds.has(endingId)) {
      errors.push(`Обвинение: концовка «${endingId || field}» не существует.`)
    }
  })
  outcomes.forEach((outcome, index) => {
    const label = `Исход обвинения ${index + 1}`
    const endingId = normalizeStoryId(outcome?.endingId)
    if (!endingIds.has(endingId)) {
      errors.push(`${label}: концовка «${endingId}» не существует.`)
    }
    validateStoryReferences({
      errors,
      values: outcome?.conditions?.requiredEvidenceIds,
      allowedIds: evidenceIds,
      label,
    })
  })

  const obtainableEvidenceIds = new Set(
    interactions.flatMap((interaction) =>
      Array.isArray(interaction?.effects?.grantsEvidenceIds)
        ? interaction.effects.grantsEvidenceIds.map(normalizeStoryId)
        : [],
    ),
  )
  const requiredOutcomeEvidenceIds = new Set(
    outcomes.flatMap((outcome) =>
      Array.isArray(outcome?.conditions?.requiredEvidenceIds)
        ? outcome.conditions.requiredEvidenceIds.map(normalizeStoryId)
        : [],
    ),
  )
  requiredOutcomeEvidenceIds.forEach((id) => {
    if (id && !obtainableEvidenceIds.has(id)) {
      errors.push(`Расследование: доказательство «${id}» нельзя получить.`)
    }
  })
  const hasSuccessOutcome = outcomes.some((outcome) => {
    const ending = endings.find(
      (item) => normalizeStoryId(item?.id) === normalizeStoryId(outcome?.endingId),
    )
    return ending && ['success', 'secret'].includes(ending?.type)
  })
  if (!hasSuccessOutcome) {
    errors.push('Расследование: отсутствует достижимый успешный исход обвинения.')
  }

  return errors
}

export const getStoryValidationErrors = (game) => {
  const errors = []
  const nodes = Array.isArray(game?.storyNodes) ? game.storyNodes : []
  const items = Array.isArray(game?.storyItems) ? game.storyItems : []
  const endings = Array.isArray(game?.storyEndings) ? game.storyEndings : []
  const nodeIds = new Set(nodes.map((node) => normalizeStoryId(node?.id)).filter(Boolean))
  const itemIds = new Set(items.map((item) => normalizeStoryId(item?.id)).filter(Boolean))
  const endingIds = new Set(
    endings.map((ending) => normalizeStoryId(ending?.id)).filter(Boolean),
  )
  const manualOnlyEndingIds = new Set(
    endings
      .filter((ending) => ending?.manualOnly)
      .map((ending) => normalizeStoryId(ending?.id))
      .filter(Boolean),
  )

  if (nodes.length === 0) {
    errors.push('Добавьте хотя бы одну story-локацию.')
  } else if (!nodes.some((node) => Boolean(node?.visibility?.startVisible))) {
    errors.push('Отметьте хотя бы одну story-локацию как стартовую.')
  }

  if (endings.length === 0) {
    errors.push('Добавьте хотя бы одну концовку story-квеста.')
  }

  ;[
    ['локаций', nodes],
    ['предметов', items],
    ['концовок', endings],
  ].forEach(([label, values]) => {
    appendStoryIdErrors({ errors, label, values })
  })

  items.forEach((item, itemIndex) => {
    if (!normalizeStoryId(item?.title)) {
      errors.push(`Предмет ${itemIndex + 1}: не указано название.`)
    }
  })

  nodes.forEach((node, nodeIndex) => {
    const nodeLabel = `Локация ${nodeIndex + 1}${node?.title ? ` «${node.title}»` : ''}`
    if (!normalizeStoryId(node?.title)) {
      errors.push(`${nodeLabel}: не указано название.`)
    }

    validateStoryReferences({
      errors,
      values: node?.visibility?.requiredNodeIds,
      allowedIds: nodeIds,
      label: `${nodeLabel}, условия открытия`,
    })
    validateStoryReferences({
      errors,
      values: node?.visibility?.requiredItemIds,
      allowedIds: itemIds,
      label: `${nodeLabel}, условия открытия`,
    })

    const inputsCount =
      (Array.isArray(node?.visibility?.requiredNodeIds)
        ? node.visibility.requiredNodeIds.length
        : 0) +
      (Array.isArray(node?.visibility?.requiredItemIds)
        ? node.visibility.requiredItemIds.length
        : 0)
    if (
      node?.visibility?.requiredInputMode === 'count' &&
      Number(node?.visibility?.requiredInputCount) > inputsCount
    ) {
      errors.push(
        `${nodeLabel}: требуемое количество входов больше числа настроенных входов.`,
      )
    }

    const codes = Array.isArray(node?.codes) ? node.codes : []
    appendStoryIdErrors({ errors, label: `кодов (${nodeLabel})`, values: codes })
    const normalizedCodes = new Set()
    codes.forEach((code, codeIndex) => {
      const codeLabel = `${nodeLabel}, код ${codeIndex + 1}`
      const normalizedCode = normalizeStoryId(code?.code).toLowerCase()
      if (!normalizedCode) {
        errors.push(`${codeLabel}: код не заполнен.`)
      } else if (normalizedCodes.has(normalizedCode)) {
        errors.push(`${codeLabel}: код дублируется в этой локации.`)
      }
      normalizedCodes.add(normalizedCode)
      validateStoryReferences({
        errors,
        values: code?.requiredItemIds,
        allowedIds: itemIds,
        label: codeLabel,
      })
      validateStoryReferences({
        errors,
        values: code?.grantsItemIds,
        allowedIds: itemIds,
        label: codeLabel,
      })
      validateStoryReferences({
        errors,
        values: code?.consumesItemIds,
        allowedIds: itemIds,
        label: codeLabel,
      })
      validateStoryReferences({
        errors,
        values: code?.unlocksNodeIds,
        allowedIds: nodeIds,
        label: codeLabel,
      })
      const endingId = normalizeStoryId(code?.endingId)
      if (endingId && !endingIds.has(endingId)) {
        errors.push(`${codeLabel}: концовка «${endingId}» не существует.`)
      } else if (endingId && manualOnlyEndingIds.has(endingId)) {
        errors.push(
          `${codeLabel}: концовка «${endingId}» помечена как доступная только организатору.`,
        )
      }
    })

    const actions = Array.isArray(node?.actions) ? node.actions : []
    appendStoryIdErrors({
      errors,
      label: `действий (${nodeLabel})`,
      values: actions,
    })
    actions.forEach((action, actionIndex) => {
      const actionLabel = `${nodeLabel}, действие ${actionIndex + 1}`
      if (!normalizeStoryId(action?.label)) {
        errors.push(`${actionLabel}: не указано название.`)
      }
      ;['requiredItemIds', 'grantsItemIds', 'consumesItemIds'].forEach((field) =>
        validateStoryReferences({
          errors,
          values: action?.[field],
          allowedIds: itemIds,
          label: actionLabel,
        }),
      )
      validateStoryReferences({
        errors,
        values: action?.unlocksNodeIds,
        allowedIds: nodeIds,
        label: actionLabel,
      })
      const endingId = normalizeStoryId(action?.endingId)
      if (endingId && !endingIds.has(endingId)) {
        errors.push(`${actionLabel}: концовка «${endingId}» не существует.`)
      } else if (endingId && manualOnlyEndingIds.has(endingId)) {
        errors.push(
          `${actionLabel}: концовка «${endingId}» помечена как доступная только организатору.`,
        )
      }
    })

    appendStoryIdErrors({
      errors,
      label: `подсказок (${nodeLabel})`,
      values: node?.clues,
    })
  })

  ;[
    ['кодов story-квеста', nodes.flatMap((node) => node?.codes || [])],
    ['действий story-квеста', nodes.flatMap((node) => node?.actions || [])],
    ['подсказок story-квеста', nodes.flatMap((node) => node?.clues || [])],
  ].forEach(([label, values]) => {
    const duplicates = getDuplicateStoryIds(values)
    if (duplicates.length > 0) {
      errors.push(`Дублируются глобальные идентификаторы ${label}: ${duplicates.join(', ')}.`)
    }
  })

  endings.forEach((ending, endingIndex) => {
    const endingLabel = `Концовка ${endingIndex + 1}`
    if (!normalizeStoryId(ending?.title)) {
      errors.push(`${endingLabel}: не указано название.`)
    }
    validateStoryReferences({
      errors,
      values: ending?.conditions?.requiredItemIds,
      allowedIds: itemIds,
      label: endingLabel,
    })
    validateStoryReferences({
      errors,
      values: ending?.conditions?.requiredCompletedNodeIds,
      allowedIds: nodeIds,
      label: endingLabel,
    })
  })

  if (game?.storyConfig?.experienceMode === 'investigation') {
    errors.push(...getInvestigationValidationErrors(game))
  } else {
    const reachability = getStoryReachabilityReport(game)
    if (reachability.unreachableNodeIds.length > 0) {
      errors.push(
        `Недостижимые story-локации: ${reachability.unreachableNodeIds.join(', ')}.`,
      )
    }
    if (reachability.unreachableEndingIds.length > 0) {
      errors.push(
        `Недостижимые концовки story-квеста: ${reachability.unreachableEndingIds.join(', ')}.`,
      )
    }
  }

  return errors
}

export const getGameValidationErrors = (game) => {
  const errors = []
  const safeGame = game && typeof game === 'object' ? game : {}

  if (!safeGame.startingPlace) {
    errors.push('Не указано время и место сбора.')
  }

  if (!safeGame.finishingPlace) {
    errors.push('Не указано место сбора после игры.')
  }

  if (safeGame.type === 'story') {
    return [...errors, ...getStoryValidationErrors(safeGame)]
  }

  const taskDuration = Number(safeGame.taskDuration ?? 3600) || 3600
  const cluesDuration = Number(safeGame.cluesDuration ?? 1200) || 0
  const cluesNeeded = getTimedCluesCount(taskDuration, cluesDuration)
  const activeTasks = Array.isArray(safeGame.tasks)
    ? safeGame.tasks.filter((task) => !task?.canceled)
    : []

  if (taskDuration - cluesDuration < 0) {
    errors.push('Время до подсказки больше, чем длительность задания.')
  }

  if (safeGame.allowCaptainForceClue !== false) {
    const clueEarlyAccessFrom =
      safeGame.clueEarlyAccessFrom === null ||
      safeGame.clueEarlyAccessFrom === undefined
        ? 1
        : normalizeClueEarlyAccessFrom(safeGame.clueEarlyAccessFrom, 0)

    if (
      cluesNeeded < 1 ||
      clueEarlyAccessFrom < 1 ||
      clueEarlyAccessFrom > cluesNeeded
    ) {
      errors.push(
        cluesNeeded > 0
          ? `Номер первой доступной досрочно подсказки должен быть от 1 до ${cluesNeeded}.`
          : 'Для досрочного получения подсказок задайте интервал меньше продолжительности задания или отключите эту возможность.',
      )
    }
  }

  if (activeTasks.length === 0) {
    errors.push('Добавьте хотя бы одно активное задание.')
    return errors
  }

  activeTasks.forEach((task, index) => {
    const taskLabel = `Задание ${index + 1}`

    if (!task?.title) {
      errors.push(`${taskLabel}: не указано название.`)
    }

    if (!isTaskDescriptionFilled(task)) {
      errors.push(`${taskLabel}: не заполнено описание задания.`)
    }

    if (safeGame.type !== 'photo') {
      const rawTaskCodes = Array.isArray(task?.codes) ? task.codes : []
      const taskCodes = rawTaskCodes.filter(
        (code) => typeof code === 'string' && code.trim() !== '',
      )
      const taskCodesLength = taskCodes.length
      const emptyCodePositions = getEmptyCodePositions(rawTaskCodes)

      if (!taskCodesLength) {
        errors.push(`${taskLabel}: не добавлен ни один код.`)
      }

      if (emptyCodePositions.length > 0) {
        errors.push(
          `${taskLabel}: заполните пустые основные коды №${emptyCodePositions.join(', ')}.`,
        )
      }

      const requiredCodesError = getRequiredMainCodesValidationError(task)
      if (requiredCodesError) {
        errors.push(`${taskLabel}: ${requiredCodesError}`)
      }
    }

    const duplicateCodeConflicts = getTaskDuplicateCodeConflicts(task)
    duplicateCodeConflicts.forEach((conflict) => {
      errors.push(
        `${taskLabel}: код «${conflict.code}» дублируется в ${getDuplicateCodeKindsLabel(conflict.kinds)}.`
      )
    })

    if (cluesDuration > 0) {
      const cluesCount = Array.isArray(task?.clues) ? task.clues.length : 0
      if (cluesCount < cluesNeeded) {
        errors.push(
          `${taskLabel}: недостаточно подсказок (${cluesCount}/${cluesNeeded}).`
        )
      }
    }
  })

  return errors
}

const isGameHaveErrors = (game) => getGameValidationErrors(game).length > 0

export default isGameHaveErrors
