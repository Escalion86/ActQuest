import createTeam from './createTeam'

const test_callback = {
  update_id: 173172137,
  callback_query: {
    id: '1121425242543370968',
    from: {
      id: 261102161,
      is_bot: false,
      first_name: 'Алексей',
      last_name: 'Белинский Иллюзионист',
      username: 'Escalion',
      language_code: 'ru',
      is_premium: true,
    },
    message: {
      message_id: 91,
      from: '[Object]',
      chat: ' [Object]',
      date: 1683689196,
      text: 'Неизвестная команда',
      reply_markup: '[Object]',
    },
    chat_instance: '3955131192076482535',
    data: '/create_team',
  },
}

const callbackHandler = (body, res) => {
  const { callback_query } = body
  const { id, from, message, data, chat_instance } = callback_query
  console.log('callback body :>> ', body)

  switch (data) {
    case '/create_team':
      // return 'Создание команды'
      return createTeam(from.id, data, res)
    case '/edit_team':
      return 'Редактирование команды'
    case '/join_team':
      return 'Присоединиться к команде'
    default:
      return 'Неизвестная команда'
  }
}

export default callbackHandler
