const getNoun = (number, one, two, five, withNumber = true) => {
  const nmbr = Number(number)
  if (typeof nmbr !== 'number' || Number.isNaN(nmbr)) return ''
  let n = Math.abs(nmbr)
  let res
  n %= 100
  if (n >= 5 && n <= 20) {
    res = five
  } else {
    n %= 10
    if (n === 1) {
      res = one
    } else if (n >= 2 && n <= 4) {
      res = two
    } else res = five
  }
  return (withNumber ? nmbr + ' ' : '') + res
}

export default getNoun

export const getNounCodes = (number) => getNoun(number, 'код', 'кода', 'кодов')

export const getNounWrongCodes = (number) =>
  getNoun(number, 'неверный код', 'неверных кода', 'неверных кодов')

export const getNounEvents = (number) =>
  getNoun(number, 'мероприятие', 'мероприятия', 'мероприятий')

export const getNounBirthdays = (number) =>
  getNoun(number, 'день рождения', 'дня рождения', 'дней рождения')

export const getNounAdditionalBlocks = (number) =>
  getNoun(number, 'доп. блок', 'доп. блока', 'доп. блоков')

export const getNounServices = (number) =>
  getNoun(number, 'услуга', 'услуги', 'услуг')

export const getNounUsers = (number) =>
  getNoun(number, 'пользователь', 'пользователя', 'пользователей')

export const getNounDirections = (number) =>
  getNoun(number, 'направление', 'направления', 'направлений')

export const getNounReviews = (number) =>
  getNoun(number, 'отзыв', 'отзыва', 'отзывов')

export const getNounPayments = (number) =>
  getNoun(number, 'транзакция', 'транзакции', 'транзакций')

export const getNounDays = (number) => getNoun(number, 'день', 'дня', 'дней')

export const getNounHours = (number) => getNoun(number, 'час', 'часа', 'часов')

export const getNounMinutes = (number) =>
  getNoun(number, 'минута', 'минуты', 'минут')

export const getNounAges = (number) => getNoun(number, 'год', 'года', 'лет')

export const getNounQuestions = (number) =>
  getNoun(number, 'вопрос', 'вопроса', 'вопросов')

export const getNounServicesUsers = (number) =>
  getNoun(number, 'заявка', 'заявки', 'заявок')

export const getNounTeams = (number) =>
  getNoun(number, 'команда', 'команды', 'команд')

export const getNounTasks = (number) =>
  getNoun(number, 'задание', 'задания', 'заданий')

export const getNounBonusTasks = (number) =>
  getNoun(number, 'бонусное', 'бонусных', 'бонусных')

export const getNounPoints = (number) =>
  getNoun(number, 'балл', 'балла', 'баллов')
