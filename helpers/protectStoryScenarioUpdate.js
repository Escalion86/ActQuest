export const STORY_SCENARIO_FIELDS = Object.freeze([
  'storyConfig',
  'storyItems',
  'storyNodes',
  'storyEdges',
  'storyEndings',
  'storyCharacters',
  'storyTopics',
  'storyInteractions',
  'storyEvidence',
  'storyAccusation',
])

const protectStoryScenarioUpdate = ({ updateData }) => {
  const safeUpdate = { ...(updateData || {}) }
  STORY_SCENARIO_FIELDS.forEach((field) => delete safeUpdate[field])
  return safeUpdate
}

export default protectStoryScenarioUpdate
