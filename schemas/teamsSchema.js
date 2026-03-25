import { TEAM_CAR_SKIN_VALUES } from '@helpers/teamCarSkins'

const teamsSchema = {
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
    default: true,
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
  gameStats: {
    type: Object,
    default: null,
  },
}

export default teamsSchema
