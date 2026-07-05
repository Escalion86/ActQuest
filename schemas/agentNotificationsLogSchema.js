import normalizeIdForStorage from '@helpers/normalizeIdForStorage'

const agentNotificationsLogSchema = {
  eventKey: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
  },
  gameId: {
    type: String,
    required: true,
    index: true,
    trim: true,
    set: normalizeIdForStorage,
  },
  gameTeamId: {
    type: String,
    default: null,
    trim: true,
    set: normalizeIdForStorage,
  },
  teamId: {
    type: String,
    default: null,
    trim: true,
    set: normalizeIdForStorage,
  },
  agentUserId: {
    type: String,
    required: true,
    index: true,
    trim: true,
    set: normalizeIdForStorage,
  },
  taskIndex: {
    type: Number,
    default: null,
  },
  storyNodeId: {
    type: String,
    default: null,
    trim: true,
  },
  eventType: {
    type: String,
    required: true,
    enum: ['previous_task', 'current_task', 'task_completed', 'all_teams_passed'],
  },
}

export default agentNotificationsLogSchema
