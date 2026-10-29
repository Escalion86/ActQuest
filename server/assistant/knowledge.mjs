// Редактируемый серверный FAQ. Менять факты только после сверки с указанными источниками.
// Ссылки локальные; модель не создаёт тексты, URL, тарифы или действия пользователя.
export const FAQ_SOURCES = Object.freeze([
  {
    id: 'about', title: 'Что такое автоквест', href: '/articles/kak-prohodit-avtokvest-actquest',
    text: 'Автоквест ActQuest — городская игра с загадками и поиском кодов. В классическом квесте важна скорость, в фотоквесте — баллы за фото, в сюжетном — прохождение истории.',
    evidence: 'app/_lib/seoArticles.js; docs/game-logic.md: Типы игр',
  },
  {
    id: 'register', title: 'Как записаться', href: '/cabinet/games-upcoming',
    text: 'Войдите в кабинет и выберите игру. Команду записывает капитан, на индивидуальную игру можно записаться без команды. Выберите игру ниже и спросите «Как записаться?» — подскажу следующий шаг.',
    evidence: 'docs/game-logic.md: Индивидуальное участие; components/cabinet/app-router/GamesPageClient.js',
  },
  {
    id: 'no-team', title: 'Если нет команды', href: '/cabinet/teams',
    text: 'Для индивидуальной игры команда не нужна. Для командной — создайте свою или найдите команду в кабинете. Вступление может быть свободным, по заявке капитану или закрытым.',
    evidence: 'docs/game-logic.md: Teams, Индивидуальное участие',
  },
  {
    id: 'prepare', title: 'Как подготовиться', href: '/articles/autokvest-norilsk-beginners-guide',
    text: 'Опыт не обязателен. Прочитайте правила игры и распределите роли в команде. Для автоквеста нужен автомобиль; что взять и где собраться — смотрите в описании игры или спросите организатора.',
    evidence: 'app/_lib/cityLandingPages.js: FAQ Красноярск; app/_lib/seoArticles.js: beginners guide',
  },
  {
    id: 'organizer', title: 'Связаться с организатором', href: '/zakazat-avtokvest',
    text: 'По конкретной игре напишите в городской чат на главной. Для отдельной или корпоративной игры оставьте заявку на странице «Заказать автоквест».',
    evidence: 'app/zakazat-avtokvest/page.js; components/public/Index2PageClient.js: homepageChatButtons',
  },
  {
    id: 'schedule', title: 'Ближайшие игры', href: '/cabinet/games-upcoming',
    text: 'Ближайшие игры вашего города — ниже. Стоимость и условия участия смотрите в описании игры.',
    evidence: 'app/_lib/cityLandingPages.js: getUpcomingGamesByLocation; docs/game-logic.md: видимость',
  },
])
