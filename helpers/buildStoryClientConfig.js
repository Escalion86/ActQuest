export const buildStoryClientConfig = (game) => {
  if (game?.type !== 'story') return null

  return {
    experienceMode:
      game?.storyConfig?.experienceMode === 'investigation'
        ? 'investigation'
        : 'quest',
  }
}

export default buildStoryClientConfig
