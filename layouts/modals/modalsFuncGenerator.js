import reviewFunc from './modalsFunc/reviewFunc'
import userFunc from './modalsFunc/userFunc'
import additionalBlockFunc from './modalsFunc/additionalBlockFunc'

import userViewFunc from './modalsFunc/userViewFunc'
import errorFunc from './modalsFunc/errorFunc'
import selectUsersFunc from './modalsFunc/selectUsersFunc'
import jsonFunc from './modalsFunc/jsonFunc'
import cropImageFunc from './modalsFunc/cropImageFunc'
import notificationsTelegramFunc from './modalsFunc/notificationsTelegramFunc'
import userDeleteFunc from './modalsFunc/userDeleteFunc'
import userLoginHistoryFunc from './modalsFunc/userLoginHistoryFunc'

const modalsFuncGenerator = (addModal, itemsFunc, router, loggedUser) => {
  const fixEventStatus = (eventId, status) => {
    itemsFunc.event.set({ _id: eventId, status }, false, true)
  }

  const event_signUpToReserveAfterError = (eventId, error) => {
    // console.log('loggedUser', loggedUser)
    // if (!loggedUser?._id)
    //   addModal({
    //     title: 'Необходимо зарегистрироваться и авторизироваться',
    //     text: 'Для записи на мероприятие, необходимо сначала зарегистрироваться, а затем авторизироваться на сайте',
    //     confirmButtonName: 'Зарегистрироваться / Авторизироваться',
    //     onConfirm: () => router.push('/login', '', { shallow: true }),
    //   })
    // else {
    addModal({
      title: `Запись в резерв на мероприятие`,
      text: `К сожалению не удалось записаться на мероприятие в основной состав, так как ${error}. Однако вы можете записаться на мероприятие в резерв, и как только место освободиться вы будете приняты в основной состав. Записаться в резерв на мероприятие?`,
      confirmButtonName: `Записаться в резерв`,
      onConfirm: () => {
        itemsFunc.event.signUp(eventId, loggedUser?._id, 'reserve')
      },
    })
    // }
  }

  return {
    add: addModal,
    confirm: ({
      title = 'Отмена изменений',
      text = 'Вы уверены, что хотите закрыть окно без сохранения изменений?',
      onConfirm,
    }) =>
      addModal({
        title,
        text,
        onConfirm,
      }),
    minimalSize: () =>
      addModal({
        title: 'Маленький размер фотографии',
        text: 'Фотография слишком маленькая. Размер должен быть не менее 100x100',
        confirmButtonName: `Понятно`,
        showConfirm: true,
        showDecline: false,
      }),
    browserUpdate: (url) =>
      addModal({
        title: 'Устаревшая версия браузера',
        text: `Необходимо обновить браузер. Некоторые функции сайта могут не работать. Пожалуйста обновите браузер.\n\nТекущая версия браузера: ${navigator.userAgent}`,
        confirmButtonName: `Обновить`,
        showConfirm: true,
        showDecline: true,
        onConfirm: () => router.push(url, ''),
      }),
    custom: addModal,
    cropImage: (...data) => addModal(cropImageFunc(...data)),
    error: (data) => addModal(errorFunc(data)),
    json: (data) => addModal(jsonFunc(data)),
    selectUsers: (
      itemsId,
      filterRules,
      onChange,
      exceptedIds,
      maxUsers,
      canSelectNone,
      modalTitle
    ) =>
      addModal(
        selectUsersFunc(
          itemsId,
          filterRules,
          onChange,
          exceptedIds,
          maxUsers,
          canSelectNone,
          modalTitle
        )
      ),
    review: {
      add: (reviewId) => addModal(reviewFunc(reviewId, true)),
      edit: (reviewId) => addModal(reviewFunc(reviewId)),
      delete: (reviewId) =>
        addModal({
          title: 'Удаление отзыва',
          text: 'Вы уверены, что хотите удалить отзыв?',
          onConfirm: async () => itemsFunc.review.delete(reviewId),
        }),
    },
    user: {
      add: (userId) => addModal(userFunc(userId, true)),
      edit: (userId) => addModal(userFunc(userId)),
      delete: (userId) =>
        addModal(
          userDeleteFunc(userId)
          //   {
          //   title: 'Удаление пользователя',
          //   text: 'Вы уверены, что хотите удалить пользователя?',
          //   onConfirm: async () => itemsFunc.user.delete(userId),
          // }
        ),
      view: (userId) => addModal(userViewFunc(userId)),
    },
    additionalBlock: {
      add: (additionalBlockId) =>
        addModal(additionalBlockFunc(additionalBlockId, true)),
      edit: (additionalBlockId) =>
        addModal(additionalBlockFunc(additionalBlockId)),
      delete: (additionalBlockId) =>
        addModal({
          title: 'Удаление дополнительного блока',
          text: 'Вы уверены, что хотите удалить дополнительный блок?',
          onConfirm: async () =>
            itemsFunc.additionalBlock.delete(additionalBlockId),
        }),
    },
    notifications: {
      telegram: () => addModal(notificationsTelegramFunc()),
    },
    loginHistory: {
      user: (userId) => addModal(userLoginHistoryFunc(userId)),
    },
  }
}

export default modalsFuncGenerator
