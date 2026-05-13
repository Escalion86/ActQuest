# UI паттерны и фронтенд-инварианты

## React Query и State Management

### React Query (миграция в процессе)

- Проект использует `@tanstack/react-query` через `QueryClientProvider` в `app/providers.js`.
- Текущие defaults: `staleTime` 5 минут, `gcTime` 10 минут.
- Для серверного состояния, которое переиспользуется между модалками/страницами, предпочитать `useQuery`.
- Для мутаций с оптимистичным обновлением использовать `helpers/useOptimisticMutation.js`.
- Query key должен быть стабильным: `['user', userId]`, `['team', teamId]`, `['games', { location, status }]`.
- Draft/editing state не хранить в query cache: держать локально.
- Не мигрировать крупные страницы одним PR; мигрировать по отдельным fetch/mutation-сценариям.
- Актуальный статус: `CHANGELOG-react-query.md`, `docs/react-query-roadmap.md`.

### Jotai (UI state)

- **Jotai** v2.19 — state для UI (модалки, сессия, роли); atoms в `state/`

## UI/Frontend инварианты

- Для страниц с карточкой + модалкой редактирования (`GamesPageClient.js`) черновик (`editing*`) хранить отдельно от выбранной карточки (`selected*Id`).
- Нельзя сбрасывать `editing*` в эффектах на `selected*Id`, пока открыта модалка редактирования.
- Перед изменением reset-эффектов проверять сценарий:
  - клик по карточке -> `Редактировать` -> ввод в поле.
- Если есть role preview, используйте только `moder` как роль модератора.

## Ключевые компоненты UI для работы с играми

### GamesPageClient.js

- Главный компонент управления играми в кабинете
- Логика: `canViewGameTeams`, `canManageThisGame`, `isTeamsModalReadOnly`
- Отображает окна в виде плиток (tile) или списка (list)
- Для `photo`-игр у организатора/модератора есть переход в `/cabinet/admin/photo-review?gameId=...`.

### GameTeamsModal.js

- Модаль просмотра/управления командами игры
- Параметр `isReadOnly=true` — режим просмотра для обычных пользователей
- При readonly скрывает кнопки удаления и "Добавить команду"

### UserViewModal.js & TeamMemberCard.js

- Отображают информацию о пользователе/члене команды
- **ВМЕСТО КОНТАКТОВ**: показывают `gamesCount` и `rating?.rank`
- Приватные данные скрывают

### overviewServerData.js

- Загружает данные для страницы `/cabinet` (Обзор)
- Вычисляет `personalProgressGames` — отфильтрованные сыгранные игры
- Требует `userTeamPlace > 0` для каждой игры (иначе отфильтруется)

## Стандарты модальных окон

- Для кабинетных и админских экранов использовать только общий компонент `components/Modal.js`.
- Не делать кастомные `fixed inset-0` оверлеи и ручные контейнеры модалок там, где можно использовать `Modal`.
- Закрытие модалки должно идти через `onClose` у `Modal` (крестик, `Esc`, клик по backdrop обрабатываются общим компонентом).
- Кнопки в footer оформлять через общие классы:
  - основная: `aq-modal-btn aq-modal-btn-primary`
  - вторичная: `aq-modal-btn aq-modal-btn-secondary`
- Если нужен кастомный footer, передавать его через prop `footer`, а не рисовать отдельную нижнюю панель вручную.
- Для мобильной компактной версии использовать `compactMobile` у `Modal`, а не дублировать стили контейнера.
- Исключения (нестандартные маркетинговые/публичные спец-экраны) допускаются только вне кабинетного UI и должны быть явно обоснованы.

## Контроль хода игры (Game Control)

### Общее описание

Страница мониторинга запущенной (`started`) игры в реальном времени, аналог команды `/gamestatus` из Telegram-бота.

### Архитектура

```
app/cabinet/admin/game-control/page.js          — серверная страница (auth + admin check)
components/cabinet/app-router/GameControlPageClient.js — клиентский компонент
app/api/cabinet/admin/game-status/route.js       — API-эндпоинт (GET, query: gameId)
components/cabinet/CardActionIconButton.js       — содержит GameControlCardIcon
```

### API-эндпоинт `game-status`

- **Метод:** GET, параметр `?gameId=...`
- **Доступ:** admin/dev или модератор, включённый в `game.moderators`
- **Ограничение:** только для игр в статусе `started`
- **Данные ответа:** `data.teams[]` — массив команд с полями:
  - `teamId`, `teamName`, `activeTaskIndex`, `startedTasks`
  - `findedCodesCount`, `wrongCodesCount`, `bonusCodesCount`, `penaltyCodesCount`
  - `isTeamFinished`, `isTeamOnBreak`, `isActiveTaskFinished`, `isActiveTaskFailed`
  - `sumTimeSeconds`, `currentTaskSeconds`, `breakTimeLeftSeconds`
  - `cluesReceived`, `currentPhotosCount` (для photo-квестов)
- **Сортировка:** по `activeTaskIndex` DESC → финишировавшие первыми → на перерыве → по кодам DESC
- **Источник данных:** коллекции `Games`, `GamesTeams`, `Teams`

### Клиентский компонент `GameControlPageClient`

- Авто-обновление каждые 15 сек (переключаемый чекбокс «Авто»)
- Сводка: всего команд, финишировали, в игре, на перерыве
- Карточки команд с цветовой индикацией статуса:
  - Зелёный — финиш, Жёлтый — перерыв, Красный — время вышло, Голубой — в игре
- Отображает: задание, коды, общее время, время на задании, бонусы/штрафы, подсказки

### Кнопка на карточках игр

- Добавлена в оба вида (list + tile) в `GamesPageClient.js`
- **Условие показа:** `isGameInProgressStatus(game.status) && canManageThisGame`
  - `canManageThisGame` = `canManageGameStatus(game)` проверяет: admin/dev ИЛИ создатель ИЛИ модератор игры
  - `isGameInProgressStatus` = `status === 'started'`
- **Иконка:** `GameControlCardIcon` (таблица/дашборд) из `CardActionIconButton.js`
- **Навигация:** `router.push('/cabinet/admin/game-control?gameId=${game._id}')`

### Поля GamesTeams, используемые для расчёта статуса

```javascript
{
  activeNum,       // индекс текущего задания (0-based)
  startTime[],     // массив дат старта каждого задания
  endTime[],       // массив дат завершения каждого задания
  findedCodes[],   // массив найденных кодов по заданиям
  wrongCodes[],    // массив неверных кодов по заданиям
  findedBonusCodes[],    // бонусные коды
  findedPenaltyCodes[],  // штрафные коды
  photos[],        // для photo-квестов
}
```

### Конфигурация игры (из Games)

- `taskDuration` (по умолчанию 3600) — время на задание в секундах
- `cluesDuration` (по умолчанию 1200) — интервал выдачи подсказок
- `breakDuration` (по умолчанию 0) — перерыв между заданиями

## Проверка фотоквеста (Photo Review)

### Общее описание

Отдельная кабинетная страница для проверки фото-ответов web-фотоквеста. Не перегружает `GameControl` и работает по логике "выбрать задание -> проверить все команды".

### Архитектура

```
app/cabinet/admin/photo-review/page.js                 — серверная страница (auth + admin/dev/moder)
components/cabinet/app-router/PhotoReviewPageClient.js — клиентский компонент проверки
app/api/cabinet/admin/photo-review/route.js            — GET/POST API проверки
components/location-game/GameTeamPageClient.js         — upload фото-ответов участниками для photo-игр
```

### API `photo-review`

- **GET** `/api/cabinet/admin/photo-review?gameId=...`
  - Возвращает игру, задания, команды и `photos/checks` по каждому заданию.
- **POST** `/api/cabinet/admin/photo-review`
  - Payload: `gameId`, `gameTeamId`, `taskIndex`, `checkKey`, `checked`.
  - `checkKey='accepted'` принимает основное задание.
  - `checkKey=<subTask._id>` отмечает подзадачу.
- **Доступ:** `admin/dev` или `moder`, включенный в `game.moderators`.
- **Ограничение:** только `game.type === 'photo'`.

### Инварианты

- Проверка фото не должна публиковать статус командам в процессе игры.
- Новые web-фото сохраняются как URL; Telegram `file_id` не отображать без отдельной миграции.
- После проверки финальные баллы должны попадать в результаты через `server/buildGameResultComputed.js`.

## Особенности `photo` игр (важно)

- Нельзя считать `photo` как `classic` по времени.
- Для `photo` расчет в `buildGameResultComputed` должен идти по баллам:
  - `photos[taskIndex].checks.accepted` -> `taskBonusForComplite`,
  - принятые subTasks -> бонусы subTasks,
  - штрафы/бонусы по кодам и many-wrong-codes,
  - `timeAddings` интерпретируются как корректировки очков,
  - сортировка мест: по убыванию итоговых баллов.
- Участники web-фотоквеста отправляют фото на странице прохождения `/game/[id]/process/[teamId]`.
- На одно задание можно отправлять несколько фотографий; новые web-фото хранятся как URL в `GamesTeams.photos[taskIndex].photos`.
- Старые Telegram `file_id` фотографий не считаются web-совместимыми и не требуют отображения на сайте без отдельной миграции/proxy.
- Проверка фото выполняется отдельно от `GameControl`: `/cabinet/admin/photo-review?gameId=...`.
- Проверка ориентирована на выбранное задание: сначала список фото одной команды, затем следующей; блоки команд должны быть сворачиваемыми.
- Логика проверки: `photos[taskIndex].checks.accepted` принимает основное задание; подзадачи отмечаются ключами `_id` из `task.subTasks`.
- Подзадачи должны учитываться только при принятом основном задании.
- Команды не видят статус проверки в процессе игры; статус/баллы доступны только через опубликованные результаты с учетом `hideResult`.

## iPhone Push-уведомления

- Safari на iOS не поддерживает Web Push без PWA (Home Screen)
- `usePwaNotifications.js` возвращает `isIOSDevice` и `isStandalone`
- `ProfilePageClient.js` показывает пошаговую инструкцию установки PWA для iOS

## Практика изменений

- Использовать React functional components.
- Добавлять/обновлять `PropTypes` при изменении контрактов компонентов.
- Следовать существующему стилю именования и Tailwind-паттернам проекта.
- Не создавать бинарные файлы (изображения/аудио и т.п.) в репозитории.
- **Язык:** В ответах и комментариях использовать русский язык.

## Локация пользователя (city key)

- Каноничные поля города пользователя: `currentLocation` (основное) и `accountLocation` (совместимость).
- Поле `location` в документе пользователя может содержать geo-объект (legacy для координат), его нельзя использовать как city key.
- Для безопасного определения города использовать `helpers/resolveUserCityKey.js`.
- Принудительная модалка выбора города в кабинете опирается только на строковый city key.
- API `/api/cabinet/users/location` должен обновлять одновременно `currentLocation` и `accountLocation`.
