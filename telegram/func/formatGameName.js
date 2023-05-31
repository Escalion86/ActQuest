import moment from 'moment-timezone'

const formatGameName = (game) =>
  `${moment(game.dateStart).tz('Asia/Krasnoyarsk').format('DD.MM')} "${
    game.name
  }"`

export default formatGameName
