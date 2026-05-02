# Roadmap ActQuest (технический)

## Легенда статусов

- [x] Выполнено
- [~] В процессе
- [ ] Не начато

Актуализация статусов по коду: 2026-04-15.

## Последняя проверка

Дата: 2026-04-15

Ключевые файлы-источники статусов:
- `app/api/auth/[...nextauth]/route.js`
- `server/auth/authOptions.js`
- `helpers/resolveUserCityKey.js`
- `helpers/authenticatePhoneUser.js`
- `helpers/authenticateVkUser.js`
- `helpers/authenticateTelegramUser.js`
- `app/api/phone/verify/start/route.js`
- `app/api/phone/verify/precheck/route.js`
- `app/api/phone/verify/check/route.js`
- `app/api/phone/verify/finalize/route.js`
- `components/cabinet/ImagesInput.js`
- `components/modals/GameEditModal.js`
- `app/api/escalioncloud/route.js`
- `schemas/usersSchema.js`
- `helpers/normalizeUserProfile.js`
- `helpers/getUserAvatarSrc.js`
- `helpers/fetchGamesForCabinet.js`
- `helpers/fetchTeamsForCabinet.js`
- `app/api/cabinet/teams/route.js`
- `app/api/cabinet/teams/[id]/route.js`
- `app/api/cabinet/teams/members/route.js`
- `app/api/cabinet/teams/members/[id]/route.js`
- `app/api/cabinet/games/[gameId]/teams/route.js`
- `app/api/cabinet/games/[gameId]/push-broadcast/route.js`
- `app/api/cabinet/users/location/route.js`
- `components/cabinet/CabinetLayout.js`
- `components/cabinet/app-router/GamesPageClient.js`
- `helpers/getSessionSafe.js`
- `helpers/requestApiJson.js`
- `docs/app-router-migration-roadmap.md`
- `docs/seo-roadmap-yandex-google.md`
- `docs/telegram-city-chat-bot-flow.md`
- `app/layout.js`
- `app/api/health/route.js`
- `app/api/[location]/*`

Шаблон обновления:
- Обновить дату в этом блоке.
- Проверить реализацию по списку ключевых файлов (и добавить новые, если менялась архитектура).
- Для каждого пункта roadmap проставить статус:
  - `[x]` — завершено и работает в коде,
  - `[~]` — реализовано частично/зависит от следующих шагов,
  - `[ ]` — не начато.
- Если формулировка пункта устарела, синхронизировать её с фактическими путями/модулями.

## Цели на ближайшие 1-2 спринта

- [~] Полная миграция регистрации от Telegram-only на телефон/OTP.
- [x] Добавление входа через VK (One Tap).
- [x] Интеграция загрузки изображений через escalioncloud.ru.
- [x] Миграция Next.js `pages` -> `app` router завершена (App Router является единственным роутером проекта, legacy `pages/*` и `pages/api/*` удалены, рабочие маршруты и API обслуживаются через `app/*` и `app/api/*`).
- [~] Сформирован и утверждён SEO roadmap с приоритетом Яндекса и отдельным треком Google (`docs/seo-roadmap-yandex-google.md`), реализация задач P1/P2 запланирована на ближайшие спринты.

## Спринт 1: Основа новой аутентификации

- [~] Добавить новые поля в схему пользователя: `phone`, `vkId`, `primaryAuthMethod`, `isPhoneVerified`.
- [x] Сохранить `telegramId` для обратной совместимости, но не требовать его как обязательного.
- [~] Сделать API для регистрации/верификации по телефону (`/app/api/phone/verify/*`).
- [~] Реализовать канал подтверждения телефона (сейчас: reverse call через TelefonIP; SMS как отдельный канал не внедрён).
- [~] Обновить `server`/`helpers`/`schemas` для поиска пользователя по `phone` и `vkId`, а не только `telegramId`.
- [ ] Написать unit-тесты для нового flow и fallback для старых аккаунтов.

## Спринт 2: VK + UI + миграция данных

- [x] Интегрировать VK One Tap: кнопка на странице авторизации + endpoint для обмена `vk_token`.
- [x] Реализовать создание/логин через `vkId`.
- [~] Добавить UI: форма телефона + OTP, кнопка VK.
- [~] Миграция: перенос данных из `telegramId`-аккаунтов в `phone` при наличии номера, иначе сохранить `telegramId`.
- [x] Обновить серверный middleware авторизации JWT для мульти-идентификаторов.
- [x] Обновить `normalizeUserProfile` и `getUserAvatarSrc` для нового формата.

## Спринт 3: Escalioncloud и квесты

- [x] Добавить скачивание/загрузку файлов через escalioncloud API.
- [x] Реализовать upload UI для афиш/картинок в квестах.
- [x] Сохранить URL в `schemas` (`game.image`, `task.images`, `clue.images` и related поля).
- [~] Перевести описание задания на rich-text редактор (TipTap): форматирование + inline медиа (`taskRich`, `taskMedia`) с web-readonly рендером; добавлен общий readonly-компонент для описания игры, заданий и подсказок.
- [~] Реализовать web-фотоквест: отправка нескольких фото-ответов участниками через страницу прохождения, отдельная проверка фото по заданиям в кабинете, публикация статуса проверки только через результаты игры.
- [~] Перепроверить ограничения по размерам/типам файлов (добавлена серверная диагностика отказов upload и явное сообщение для HEIC/HEIF).
- [ ] Автоматическое удаление старых временных изображений (если нужно).

## Дополнительные важные улучшения

- [~] Поддержка мульти-методной авторизации: одна учетная запись может иметь телефон + VK + Telegram.
- [~] Страница "Профиль" с миграцией Telegram -> телефон (добавлена подтверждаемая смена номера через reverse call, дальнейшая UX-доработка в процессе).
- [~] Роль "админ" + панель управления квестами, заданиями, отчетами (добавлен раздел "События сайта" с хронологией ключевых действий).
- [x] Принудительный выбор города в кабинете стабилизирован: API обновляет `currentLocation` + `accountLocation`, а city key в сессии определяется через `resolveUserCityKey` (без использования geo-объекта `location`).
- [x] Добавлены safe-обертки для localStorage в критичных экранах (главная публичная страница и кабинетные фильтры) для лучшей совместимости со старыми Safari/iOS.
- [x] Уточнена логика кнопки "Результаты": для `admin/dev` и модератора игры кнопка доступна всегда при `finished|closed` и наличии `result.computed`; для обычных пользователей учитывается `hideResult`.
- [~] SEO-направление вынесено в отдельный roadmap (городские посадочные, техническая индексация, локальное SEO, контент и ссылочный профиль) с KPI и этапами внедрения.
- [~] Telegram-поток в городские чаты: единый чат/бот проекта с шагом выбора города и переводом пользователя в нужный городской чат (Красноярск/Норильск/Екатеринбург), с трекингом переходов.
  - MVP в коде: `app/api/telegram_project/route.js` (start/deep-link/callback flow).
  - Детализация сценария и реализации: `docs/telegram-city-chat-bot-flow.md`.
  - Осталось: продуктовый трекинг переходов по городам (события в БД/дашборде).
- [ ] Система офлайн QR-билетов, привязанных к квесту и пользователю.
- [~] Сценарий заказной/корпоративной игры: публичная заявка `/zakazat-avtokvest`, API `POST /api/corporate-orders`, админский список `/cabinet/admin/game-orders`, конвертация заявки в скрытую игру.
- [ ] Аналитика: среднее время выполнения, средний балл, heatmap по локациям.

## Критерии завершения

- [~] Новой регистрацией можно пользоваться без Telegram.
- [x] Старые пользователи с Telegram продолжают работать (fallback).
- [x] VK-авторизация проходит и создает/восстанавливает аккаунт.
- [x] Изображения успешно загружаются и отображаются в UI.
- [ ] Есть базовые тесты для новых эндпоинтов.

## Приоритеты

- `P1`:
  - Закрыть auth-flow до production-ready: финализировать phone/OTP сценарий и миграцию Telegram-only -> phone.
  - Обновить `normalizeUserProfile` и `getUserAvatarSrc` под текущую модель пользователя.
  - Добавить базовые unit/integration тесты для auth и новых API эндпоинтов.
- `P2`:
  - Завершить проверку и фиксацию ограничений upload (типы/размеры).
  - Реализовать автоочистку временных/устаревших изображений.
- `P3`:
  - Продуктовые улучшения из backlog: QR-билеты, расширенная аналитика, дополнительные админ-фичи.
