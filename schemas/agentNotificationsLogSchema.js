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
  },
  gameTeamId: {
    type: String,
    default: null,
    trim: true,
  },
  teamId: {
    type: String,
    default: null,
    trim: true,
  },
  agentUserId: {
    type: String,
    required: true,
    index: true,
    trim: true,
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
