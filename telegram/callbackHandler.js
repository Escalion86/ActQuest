const callbackHandler = (body) => {
  const { callback_query } = body
  const { data } = callback_query
  console.log('callback body :>> ', body)

  switch (data) {
    case '/create_team':
      return 'Создание команды'
    // return createTeam()
    case '/edit_team':
      return 'Редактирование команды'
    case '/join_team':
      return 'Присоединиться к команде'
    default:
      return 'Неизвестная команда'
  }
}

export default callbackHandler
