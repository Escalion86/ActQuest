# Roadmap ActQuest (технический)

## Легенда статусов

- [x] Выполнено
- [~] В процессе
- [ ] Не начато

Актуализация статусов по коду: 2026-04-04.

## Последняя проверка

Дата: 2026-04-03

Ключевые файлы-источники статусов:
- `pages/api/auth/[...nextauth].js`
- `server/auth/authOptions.js`
- `helpers/authenticatePhoneUser.js`
- `helpers/authenticateVkUser.js`
- `helpers/authenticateTelegramUser.js`
- `pages/api/phone/verify/start.js`
- `pages/api/phone/verify/precheck.js`
- `pages/api/phone/verify/check.js`
- `pages/api/phone/verify/finalize.js`
- `components/cabinet/ImagesInput.js`
- `components/modals/GameEditModal.js`
- `pages/api/escalioncloud/index.js`
- `schemas/usersSchema.js`
- `helpers/normalizeUserProfile.js`
- `helpers/getUserAvatarSrc.js`
- `docs/app-router-migration-roadmap.md`
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
- [~] Подготовка поэтапной миграции Next.js `pages` -> `app` router (создан roadmap, пилотный app-каркас; публичные маршруты `/`, `/legacy` и `not-found` переведены в `app`; реальные маршруты `/cabinet`, `/cabinet/login`, `/cabinet/register`, `/cabinet/recovery`, `/cabinet/games`, `/cabinet/games-upcoming`, `/cabinet/games-past`, `/cabinet/profile`, `/cabinet/teams`, `/cabinet/settings`, `/cabinet/developer`, `/cabinet/admin/users`, `/cabinet/admin/teams`, `/cabinet/admin/reports`, `/cabinet/admin/transactions` и `/cabinet/admin` переведены в `app`; legacy `pages/index.js`, `pages/404.js`, `pages/legacy/index.js`, `pages/cabinet/admin/*`, `pages/cabinet/index.js`, `pages/cabinet/login.js`, `pages/cabinet/register.js`, `pages/cabinet/recovery.js`, `pages/cabinet/games.js`, `pages/cabinet/settings.js`, `pages/cabinet/developer.js`, `pages/[location]/*`, `pages/_app.js`, `pages/_document.js` удалены; дополнительно перенесены `pages/api/vk-id/callback.js`, `pages/api/global/auth/vk-status.js`, `pages/api/escalioncloud/*`, `pages/api/webapp/*`, `pages/api/[location]/*`; критичные API переведены в `app/api/*` для auth/public/phone/cabinet/location; клиентские вызовы идут только на основные `/api/*`, временные fallback-слои `/api-pilot/*` и `/cabinet-app/*` удалены; служебные маршруты миграции `/legacy-pilot` и `/migration-check` удалены; App Router является единственным роутером проекта).

## Спринт 1: Основа новой аутентификации

- [~] Добавить новые поля в схему пользователя: `phone`, `vkId`, `primaryAuthMethod`, `isPhoneVerified`.
- [x] Сохранить `telegramId` для обратной совместимости, но не требовать его как обязательного.
- [~] Сделать API для регистрации/верификации по телефону (`/pages/api/phone/verify/*`).
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
- [~] Перепроверить ограничения по размерам/типам файлов (добавлена серверная диагностика отказов upload и явное сообщение для HEIC/HEIF).
- [ ] Автоматическое удаление старых временных изображений (если нужно).

## Дополнительные важные улучшения

- [~] Поддержка мульти-методной авторизации: одна учетная запись может иметь телефон + VK + Telegram.
- [~] Страница "Профиль" с миграцией Telegram -> телефон (добавлена подтверждаемая смена номера через reverse call, дальнейшая UX-доработка в процессе).
- [ ] Роль "админ" + панель управления квестами, заданиями, отчетами.
- [ ] Система офлайн QR-билетов, привязанных к квесту и пользователю.
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
