import { getNounPoints } from '@helpers/getNoun'
import secondsToTimeStr from '@helpers/secondsToTimeStr'
import moment from 'moment-timezone'

const gameDescription = (game, creator) => {
  const tasksCount = game?.tasks
    ? game.tasks.filter(
        ({ canceled, isBonusTask }) => !canceled && !isBonusTask
      ).length
    : 0

  const bonusTasksCount = game?.tasks
    ? game.tasks.filter(({ canceled, isBonusTask }) => !canceled && isBonusTask)
        .length
    : 0

  const description = `<b>Игра "${game?.name}"</b>
  \n\n<b>Дата и время</b>: ${
    game.dateStart
      ? moment(game.dateStart).tz('Asia/Krasnoyarsk').format('DD.MM.yyyy H:mm')
      : '[не заданы]'
  }\n\n<b>Тип игры</b>: ${
    game.type === 'photo' ? `\u{1F4F7} Фотоквест` : `\u{1F697} Классика`
  }* (см. подробнее внизу)${
    game?.description ? `\n\n<b>Описание</b>:\n"${game?.description}"` : ''
  }${
    game?.startingPlace
      ? `\n\n<b>Время и место сбора</b>: ${game?.startingPlace}`
      : ''
  }${
    tasksCount > 0
      ? `\n\n<b>Количество заданий</b>: ${tasksCount}${
          bonusTasksCount ? ` + ${getNounBonusTasks(bonusTasksCount)}` : ''
        }`
      : ''
  }\n<b>Максимальная продолжительность одного задания</b>: ${secondsToTimeStr(
    game?.taskDuration ?? 3600
  )}\n${
    game?.cluesDuration === 0
      ? '<b>Подсказки</b>: отключены'
      : `<b>Время до подсказки</b>: ${secondsToTimeStr(
          game?.cluesDuration ?? 1200
        )}`
  }\n<b>Перерыв между заданиями</b>: ${
    !game?.breakDuration ? 'отсутствует' : secondsToTimeStr(game?.breakDuration)
  }\n<b>Штраф за невыполнение задания</b>: ${
    !game?.taskFailurePenalty
      ? 'отсутствует'
      : game.type === 'photo'
      ? getNounPoints(game?.taskFailurePenalty)
      : secondsToTimeStr(game?.taskFailurePenalty)
  }\n\n<b>Стоимость участия</b>: ${
    !game.prices || game.prices?.length === 0
      ? 'не указано'
      : game.prices.length === 1
      ? game.prices[0].price === 0
        ? 'бесплатно'
        : `${game.prices[0].price} руб.`
      : game.prices.map(({ name, price }) => `\n- ${name}: ${price} руб.`)
  }${
    creator ? `\n\n<b>Организатор игры</b>: ${creator.name}` : ''
  }\n\n* - тип игры ${
    game.type === 'photo'
      ? '"Фотоквест" - в качестве ответа на задание должно быть изображение. За каждое выполненное, а также дополнительные задания начисляются баллы. Побеждает команда набравшая больше всех баллов'
      : '"Классика" - в качестве ответа на задание должен быть какой-либо текст или набор цифр. Побеждает та команда, которая выполнит задания быстрее всех с учетом бонусов и штрафов по времени'
  }`
  return description
}

export default gameDescription
