const messageHandler = (body) => {
  const { update_id, message } = body
  const { message_id, from, chat, date, text, entities } = message
  console.log('message body :>> ', body)

  switch (text) {
    case '/create_team':
      return 'Создание команды'
    case '/edit_team':
      return 'Редактирование команды'
    case '/join_team':
      return 'Присоединиться к команде'
    default:
      return 'Неизвестная команда'
  }
}

export default messageHandler
