# AGENTS.md — быстрый онбординг по проекту ActQuest

## Что это за проект

ActQuest — это единый репозиторий с:
- Next.js сайтом (кабинет, админка, страницы игр),
- API-слоем (`/app/api`),
- серверной бизнес-логикой (`/server`),
- Telegram-ботом (`/telegram`).

Проект управляет автоквестами (classic/photo), командами, участниками, результатами и рейтингом.

## Язык

- В ответах и комментариях использовать русский язык.

## Основные папки

- `/app` — UI-страницы Next.js (App Router) и route handlers.
- `/app/api` — API-эндпоинты (route handlers).
- `/components` — React-компоненты.
- `/server` — серверная логика (расчеты, сервисы, обновления метрик).
- `/schemas` — Mongoose-схемы.
- `/helpers`, `/utils` — нормализация, форматирование, утилиты.
- `/telegram` — legacy/бот-флоу.

## Ключевая бизнес-логика игр

### Статусы и переходы

- Разрешенные статусы: `active`, `started`, `finished`, `closed`, `canceled`.
- `started` ставится только через запуск игры (не вручную в редакторе).
- `finished` — итог `СТОП ИГРА`.
- `closed` — финальное закрытие после проведения.
- Нельзя закрывать игру, если она не была проведена.
- При `reopen`:
  - если есть snapshots результата (`result.teams/gameTeams/teamsUsers`) -> `finished`,
  - иначе -> `active`.

### Результаты игры

- Источник истины для пересборки результата: `result.teams`, `result.gameTeams`, `result.teamsUsers`.
- `teamsPlaces` и `computed` должны строиться из snapshot’ов через:
  - `server/buildGameResultComputed.js`.
- Кнопка/доступ к результатам в кабинете ориентируется на наличие `result.computed`.
- Если snapshot’ов нет, результат пересобрать нельзя (игра пропускается в таких операциях).

### Когда формировать snapshots

- Snapshot результата нужно фиксировать на `СТОП ИГРА` (`finished`), чтобы сохранить исторический состав команд/участников.

## Рейтинг и статистика

- Основные файлы:
  - `server/updateParticipantsRatings.js`
  - `server/updateParticipantsClosedStats.js`
  - `app/api/cabinet/dev/recalculate-ratings/route.js`
- В рейтинге учитываются только `closed` + `isRated !== false`.
- Для Dev-пересчета: перед метриками нужно пересобирать `teamsPlaces` и `computed` (если есть snapshots).
- Глобальный рейтинг: без разделения по городам (location в snapshot может быть `null`).
- При равном `finalScore` место должно быть одинаковым (tie rank).
- Пропуски считаются по сезонам:
  - если участник играл в сезоне хотя бы одну игру, пропущенные игры этого сезона дают miss,
  - если не играл в сезоне ни разу, miss за сезон не начисляется.

## Особенности `photo` игр (важно)

- Нельзя считать `photo` как `classic` по времени.
- Для `photo` расчет в `buildGameResultComputed` должен идти по баллам:
  - `photos[taskIndex].checks.accepted` -> `taskBonusForComplite`,
  - принятые subTasks -> бонусы subTasks,
  - штрафы/бонусы по кодам и many-wrong-codes,
  - `timeAddings` интерпретируются как корректировки очков,
  - сортировка мест: по убыванию итоговых баллов.

## UI/Frontend инварианты

- Для страниц с карточкой + модалкой редактирования (`components/cabinet/app-router/GamesPageClient.js`) черновик (`editing*`) хранить отдельно от выбранной карточки (`selected*Id`).
- Нельзя сбрасывать `editing*` в эффектах на `selected*Id`, пока открыта модалка редактирования.
- Перед изменением reset-эффектов проверять сценарий:
  - клик по карточке -> `Редактировать` -> ввод в поле.
- Если есть role preview, используйте только `moder` как роль модератора.

## Практика изменений

- Использовать React functional components.
- Добавлять/обновлять `PropTypes` при изменении контрактов компонентов.
- Следовать существующему стилю именования и Tailwind-паттернам проекта.
- Не создавать бинарные файлы (изображения/аудио и т.п.) в репозитории.

## Работа с roadmap

- Перед началом крупной задачи проверять актуальные roadmap-документы в `docs/` (минимум `docs/roadmap.md`, а также профильные roadmap по теме задачи).
- Если в рамках работы закрыт или существенно продвинут пункт roadmap, обновлять его статус в документе:
  - `[x]` — выполнено,
  - `[~]` — в процессе,
  - `[ ]` — не начато.
- При обновлении статуса кратко синхронизировать формулировку пункта с фактической реализацией (например, актуальные пути API), чтобы roadmap не расходился с кодом.

## Что смотреть в первую очередь при новой задаче

1. `components/cabinet/app-router/GamesPageClient.js` — основной сценарий управления играми в кабинете.
2. `app/api/[location]/games/[id]/route.js` — изменение игры и статусные переходы.
3. `server/buildGameResultComputed.js` — расчет `teamsPlaces` + `computed`.
4. `server/updateParticipantsRatings.js` и `server/updateParticipantsClosedStats.js` — рейтинг и gameStats.
5. `app/api/cabinet/dev/*/route.js` — dev-операции пересчета/массового закрытия.

## Полезные команды

- `npm run dev` — запуск dev-сервера.
- `npm run lint` — линт.
- `npm run build` — production-сборка.

## Troubleshooting (быстрая диагностика)

1. Симптом: нельзя редактировать активную игру (поля не вводятся).
- Проверить: `components/cabinet/app-router/GamesPageClient.js` -> `canEditSelectedGame`, роль пользователя, `editingGame`.
- Проверить, что `editingGame` не сбрасывается эффектом на `selectedGameId` при открытой модалке.
- Проверить role preview: `helpers/useCabinetRolePreview.js` (поддержка `client/moder/admin/dev`).

2. Симптом: в прошедших играх “пусто”, но после refresh игры появляются/пропадают.
- Проверить: гидрацию фильтра города в `components/cabinet/app-router/GamesPageClient.js` (`isGamesFilterLocationHydrated`).
- Проверить API-фильтрацию: `app/api/cabinet/games-list/route.js`, `helpers/fetchGamesForCabinet.js`.
- Проверить текущий `location` фильтр и роль (hidden-игры доступны не всем).

3. Симптом: у игры нет кнопки “Результаты”.
- Проверить: наличие `result.computed` (именно это признак сформированного результата в кабинете).
- Проверить snapshots: `result.teams`, `result.gameTeams`, `result.teamsUsers`.
- Пересобрать через `buildGameResultComputed`/dev-пересчет.

4. Симптом: рейтинг пересчитан, но карточки/места выглядят неверно.
- Проверить, что игра `closed` и `isRated !== false`.
- Проверить, что `teamsPlaces` и `computed` были пересобраны из snapshots.
- Проверить, что в расчет не попали игры без snapshots результата.

5. Симптом: фотоквест имеет “странные” места/рейтинг.
- Проверить ветку `photo` в `server/buildGameResultComputed.js`.
- Убедиться, что расчет идет по баллам `photos[].checks`, а не по времени.
- Проверить корректность `timeAddings` и штрафов/бонусов.

6. Симптом: закрытие игры не обновляет `gameStats`/`rating`.
- Проверить `app/api/[location]/games/[id]/route.js` (ветка перехода в `closed`).
- Проверить вызовы `updateParticipantsClosedStats` и `updateParticipantsRatings`.
- Проверить, что `teamsPlaces` присутствует после пересборки результата.

## Pre-merge чеклист

1. Статусы и переходы
- Проверены сценарии `active -> started -> finished -> closed`, `canceled -> active`, `closed -> reopen`.
- Убедиться, что `started` нельзя выставить вручную в редакторе.

2. Редактирование игры
- Сценарий “карточка -> редактировать -> ввод в поле -> сохранить” работает.
- При открытой модалке редактирования не происходит сброса `editingGame`.

3. Результаты игры
- Для завершенной/закрытой игры при наличии snapshot формируются `result.teamsPlaces` и `result.computed`.
- Кнопка “Результаты” отображается корректно (если `computed` есть и `hideResult=false`).

4. Рейтинг и статистика
- При закрытии игры обновляются `gameStats` и `rating` участников/команд.
- Для `photo` проверен расчет мест по баллам, для `classic` — по времени.

5. Фильтры и списки
- Проверены `upcoming/past` с фильтром города и сезонным фильтром.
- В `past` корректно попадают завершенные/закрытые и просроченные активные/запущенные игры.

6. Техпроверки
- `npm run lint` без ошибок по измененным файлам.
- Нет временных `console.log`/debug-кода в финальном diff.
