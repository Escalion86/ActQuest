# AGENTS.md — онбординг по проекту ActQuest

## Что это за проект

ActQuest — монорепозиторий Next.js-приложения, API-слоя, серверной игровой
логики и legacy Telegram-бота для автоквестов.

Проект управляет автоквестами `classic`, `photo`, `story`: играми, заданиями,
командами, участниками, капитанскими действиями, результатами, рейтингом и
админским контролем хода игры.

## Стек

- **Next.js 16**, App Router, **React 19**
- **Mongoose 9**, **MongoDB 7**
- **State**: Jotai в `lib/jotai/`, React Query v5
- **CSS**: Tailwind CSS v4, dark mode через `class`
- **Auth**: NextAuth.js (Telegram, VK One Tap, телефон, пароль)
- **Push**: `web-push`, PWA Service Worker
- **Файлы**: EscalionCloud
- **HTML**: `sanitize-html` для rich-text контента
- **Тесты**: полноценных тестов нет, есть smoke/verify-скрипты в `scripts/`

## Актуальная ветка игрового процесса

Основная разработка игрового движка ведётся в web/cabinet-ветке:

- экран команды: `components/location-game/GameTeamPageClient.js`;
- состояние задания команды: `server/getTeamGameTaskState.js`;
- web API задания: `app/api/webapp/game-task/route.js`;
- админский контроль игры: `app/api/cabinet/admin/game-status/route.js`;
- результат и места: `server/buildGameResultComputed.js`;
- интерактивная таблица результата: `app/[location]/game/result/[id]/page.js`.

Telegram-ветка игрового процесса (`telegram/`, `server/gameProcess.js` и
связанные Telegram-команды) считается legacy. Новую функциональность нужно
проектировать и проверять в web/cabinet-ветке. Telegram-код можно учитывать
как историческую справку, но не как обязательный источник поведения для новых
изменений.

## Основные папки

- `/app` — App Router страницы и route handlers.
  - `/app/cabinet` — кабинет пользователя.
  - `/app/cabinet/admin` — админка.
  - `/app/[location]` — публичные городские роуты.
  - `/app/api` — API-эндпоинты.
- `/components` — React-компоненты.
  - `/components/location-game` — web-экран команды в игре.
  - `/components/cabinet/app-router` — основные страницы кабинета и админки.
  - `/components/modals` — модальные окна игр, команд, результата.
- `/server` — серверная бизнес-логика.
  - `getTeamGameTaskState.js` — состояние текущего задания команды.
  - `webGameProcess.js` — обработка ввода ответа в web-ветке.
  - `buildGameResultComputed.js` — расчет `teamsPlaces` и `result.computed`.
  - `storyEngine.js` — движок story-квестов.
  - `updateParticipantsRatings.js` и `updateParticipantsClosedStats.js` —
    рейтинг и закрытая статистика.
- `/schemas` — Mongoose-схемы.
- `/helpers`, `/utils` — нормализация, форматирование, общие утилиты.
- `/telegram` — legacy Telegram-бот и историческая игровая логика.
- `/state` — Jotai atoms.
- `/docs` — документация, roadmap, troubleshooting.

## Документация

- `docs/game-logic.md` — типы игр, статусы, результаты, рейтинг, видимость.
- `docs/story-engine.md` — архитектура story-квестов.
- `docs/ui-patterns.md` — React Query, UI-инварианты, Game Control, Photo Review.
- `docs/troubleshooting.md` — диагностика, snapshot'ы, pre-merge чеклист.
- `docs/logging-and-debug.md` — debug-флаги и префиксы логов.
- `docs/roadmap.md` и профильные roadmap — проверять перед крупными задачами.

## Что смотреть в первую очередь

Для задач по текущей игре команды:

1. `server/getTeamGameTaskState.js`
2. `components/location-game/GameTeamPageClient.js`
3. `app/api/webapp/game-task/route.js`
4. `server/webGameProcess.js`

Для админского контроля игры:

1. `app/api/cabinet/admin/game-status/route.js`
2. `components/cabinet/app-router/GameControlPageClient.js`
3. `components/modals/GameControlTeamStatsModal.js`
4. `app/api/cabinet/admin/game-status/action/route.js`

Для результатов, мест, рейтинга и истории:

1. `helpers/fetchGamesForCabinet.js` — критично для истории и snapshot'ов.
2. `server/buildGameResultComputed.js`
3. `app/[location]/game/result/[id]/page.js`
4. `server/updateParticipantsRatings.js`
5. `server/updateParticipantsClosedStats.js`
6. `app/api/cabinet/dev/*/route.js`

Для управления играми в кабинете:

1. `components/cabinet/app-router/GamesPageClient.js`
2. `components/modals/GameEditModal.js`
3. `app/api/[location]/games/[id]/route.js`
4. `app/cabinet/_lib/overviewServerData.js`

## Игровые инварианты web-ветки

- Перерыв определяется сервером в `getTeamGameTaskState.js`.
- Источники перерыва:
  - задание выполнено и от `endTime` прошло меньше `breakDuration`;
  - время задания истекло: от `startTime` прошло от `taskDuration` до
    `taskDuration + breakDuration`;
  - задание слито капитаном: есть `taskFailures.failedAt`, и от него прошло
    меньше `breakDuration`.
- Слитое капитаном задание не получает `endTime`; в результатах оно считается
  невыполненным с длительностью `taskDuration`.
- Капитанские действия должны проверяться на сервере, даже если кнопка скрыта в UI.
- Новые time-based механики должны синхронно обновлять:
  - экран команды;
  - API состояния задания;
  - админский Game Control;
  - `buildGameResultComputed`;
  - интерактивную таблицу и анимацию результата.

## Полезные команды

- `npm run dev` — dev-сервер.
- `npm run lint` — линт.
- `npm run build` — production-сборка.
- `npm run smoke:app` — smoke-проверка основных роутов.
- `npm run verify:api-contracts` — проверка API-контрактов кабинета.

## Работа с roadmap

- Перед крупной задачей проверять `docs/roadmap.md` и профильные roadmap.
- Для диагностики использовать `docs/logging-and-debug.md`.
- Если задача закрыла или заметно продвинула пункт roadmap, обновить статус:
  - `[x]` — выполнено;
  - `[~]` — в процессе;
  - `[ ]` — не начато.
- При обновлении roadmap синхронизировать формулировку с фактическими путями API
  и текущей реализацией.

## Практика изменений

- Использовать React functional components.
- Добавлять или обновлять `PropTypes` при изменении контрактов компонентов.
- Следовать существующему стилю именования и Tailwind-паттернам проекта.
- Не создавать бинарные файлы в репозитории.
- Не опираться на Telegram legacy как на обязательное поведение для новых web-задач.
- **Язык:** в ответах и комментариях использовать русский язык.
