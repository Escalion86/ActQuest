export const LOCATIONS = {
  // dev: {
  //   townRu: 'тестовый город',
  //   roditPadeg: 'тестового города',
  //   // location: 'https://половинкауспеха.рф',
  //   // short: 'krsk',
  //   imageFolder: 'polovinka_uspeha_dev',
  //   telegramBotName: 'polovinka_uspeha_bot',
  //   towns: [
  //     'Тест',
  //     // 'Сосновоборск',
  //     // 'Дивногорск',
  //     // 'Железногорск',
  //     // 'Дрокино',
  //     // 'Емельяново',
  //   ],
  //   hidden: true,
  // },
  krsk: {
    townRu: 'красноярск',
    roditPadeg: 'красноярского',
    // location: 'https://половинкауспеха.рф',
    // short: 'krsk',
    // imageFolder: 'polovinka_uspeha',
    // telegramBotName: 'polovinka_uspeha_bot',
    towns: [
      'Красноярск',
      'Сосновоборск',
      'Дивногорск',
      'Железногорск',
      'Дрокино',
      'Емельяново',
    ],
    hidden: false,
  },
  nrsk: {
    townRu: 'норильск',
    roditPadeg: 'норильского',
    // location: 'https://nrsk.половинкауспеха.рф',
    // short: 'nrsk',
    // imageFolder: 'polovinka_uspeha_nrsk',
    // telegramBotName: 'polovinka_uspeha_nrsk_bot',
    towns: ['Норильск', 'Талнах', 'Кайеркан', 'Оганер', 'Дудинка', 'Алыкель'],
    hidden: false,
  },
  ekb: {
    townRu: 'екатеринбург',
    roditPadeg: 'екатеринбуржского',
    // location: 'https://nrsk.половинкауспеха.рф',
    // short: 'nrsk',
    // imageFolder: 'polovinka_uspeha_ekb',
    // telegramBotName: 'polovinka_uspeha_ekb_bot',
    towns: [
      'Екатеринбург',
      'Среднеуральск',
      'Нижний Тагил',
      'Полевской',
      'Верхняя Пышма',
      'Березовский',
    ],
    hidden: false,
  },
}

export const LOCATIONS_KEYS = Object.keys(LOCATIONS).filter(
  (location) => !LOCATIONS[location].hidden
)
