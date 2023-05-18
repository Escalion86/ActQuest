const usersSchema = {
  telegramId: {
    type: Number,
    required: [true, 'Введите telegramId'],
    default: null,
  },
  firstName: {
    type: String,
    maxlength: [
      100,
      'Имя не может быть больше 100 символов. Или это "Напу-Амо-Хала-Она-Она-Анека-Вехи-Вехи-Она-Хивеа-Нена-Вава-Кехо-Онка-Кахе-Хеа-Леке-Еа-Она-Ней-Нана-Ниа-Кеко-Оа-Ога-Ван-Ика-Ванао"? Тут 102 буквы, можешь загуглить....',
    ],
    default: '',
  },
  secondName: {
    type: String,
    maxlength: [
      100,
      'Фамилия не может быть больше 100 символов. Или это "Напу-Амо-Хала-Она-Она-Анека-Вехи-Вехи-Она-Хивеа-Нена-Вава-Кехо-Онка-Кахе-Хеа-Леке-Еа-Она-Ней-Нана-Ниа-Кеко-Оа-Ога-Ван-Ика-Ванао"? Тут 102 буквы, можешь загуглить....',
    ],
    default: '',
  },
  gender: {
    type: String,
    default: null,
  },
  phone: {
    type: Number,
    // required: [true, 'Введите Телефон'],
    default: null,
  },
}

export default usersSchema
