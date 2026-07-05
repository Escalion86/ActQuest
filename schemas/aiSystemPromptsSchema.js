import normalizeIdForStorage from '@helpers/normalizeIdForStorage'

const aiSystemPromptsSchema = {
  userId: {
    type: String,
    required: true,
    index: true,
    set: normalizeIdForStorage,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },
  promptMd: {
    type: String,
    required: true,
    trim: true,
    maxlength: 20000,
  },
  section: {
    type: String,
    default: 'task_rich_editor',
    trim: true,
    maxlength: 100,
    index: true,
  },
}

export default aiSystemPromptsSchema
