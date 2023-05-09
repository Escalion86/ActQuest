const messageHandler = (message) => {
  switch (message) {
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
