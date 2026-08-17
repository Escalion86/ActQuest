import { TEAM_CAR_SKIN_VALUES } from '@helpers/teamCarSkins'
import normalizeIdForStorage from '@helpers/normalizeIdForStorage'

const teamsSchema = {
  kind: {
    type: String,
    enum: ['regular', 'personal'],
    default: 'regular',
  },
  ownerUserId: {
    type: String,
    default: null,
    trim: true,
    set: normalizeIdForStorage,
  },
  systemManaged: {
    type: Boolean,
    default: false,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  name_lowered: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  image: {
    type: String,
    default: null,
    trim: true,
  },
  open: {
    type: Boolean,
    default: false,
  },
  location: {
    type: String,
    default: null,
    trim: true,
  },
  carSkin: {
    type: String,
    enum: TEAM_CAR_SKIN_VALUES,
    default: 'classic',
  },
  rating: {
    type: Object,
    default: null,
  },
  ratingsByLocation: {
    type: Object,
    default: {},
  },
  ratingsBySeason: {
    type: Object,
    default: {},
  },
  gameStats: {
    type: Object,
    default: null,
  },
}

export default teamsSchema
