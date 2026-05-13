# AGENTS.md — быстрый онбординг по проекту ActQuest

## Что это за проект

ActQuest — это единый репозиторий с:

- Next.js сайтом (кабинет, админка, страницы игр),
- API-слоем (`/app/api`),
- серверной бизнес-логикой (`/server`),
- Telegram-ботом (`/telegram`).

Проект управляет автоквестами (classic/photo/story), командами, участниками, результатами и рейтингом.

## Стек технологий

- **Next.js 16** (App Router, React 19), **Mongoose 9**, **MongoDB 7**
- **State**: Jotai (custom реализация в `lib/jotai/`), React Query v5 (миграция в процессе)
- **CSS**: Tailwind CSS v4, dark mode via `class`
- **Auth**: NextAuth.js (Telegram, VK One Tap, телефон, пароль)
- **Push**: `web-push` (PWA Service Worker)
- **Файлы**: EscalionCloud (внешний сервис загрузки)
- **HTML**: `sanitize-html` — XSS-защита rich-text контента
- **Тесты**: отсутствуют (только smoke-скрипты в `scripts/`)

## Основные папки

- `/app` — UI-страницы Next.js (App Router) и route handlers.
  - `/app/cabinet` — кабинет пользователя (games, teams, profile)
  - `/app/cabinet/admin` — админка (game-control, photo-review, story-editor)
  - `/app/[location]` — динамические роуты по городам
  - `/app/api` — API-эндпоинты (route handlers)
- `/components` — React-компоненты.
  - `/components/cabinet` — компоненты кабинета
  - `/components/cabinet/app-router` — основные страницы кабинета (client components)
- `/server` — серверная логика (расчеты, сервисы, обновления метрик).
  - `buildGameResultComputed.js` — расчет результатов из snapshots
  - `storyEngine.js` — движок сюжетных квестов
  - `updateParticipantsRatings.js` — обновление рейтинга
  - `updateParticipantsClosedStats.js` — статистика после закрытия
- `/schemas` — Mongoose-схемы (gamesSchema, teamsSchema, usersSchema, и т.д.)
- `/helpers`, `/utils` — нормализация, форматирование, утилиты.
  - `fetchGamesForCabinet.js` — **КРИТИЧНО** для работы с историей и snapshot'ами
  - `resolveUserCityKey.js` — безопасное определение города пользователя
- `/telegram` — legacy/бот-флоу.
- `/state` — Jotai atoms (UI state, сессия, роли).
- `/docs` — документация, roadmap'ы.

## Структура документации

Для упрощения навигации документация разбита на несколько файлов:

### [Логика игр](docs/game-logic.md)
- Типы игр (classic/photo/story)
- База данных (краткий обзор коллекций)
- Статусы и переходы игр
- Результаты игры и структура `result`
- Рейтинг и статистика
- Корпоративные заказы
- Скрытые игры и видимость
- Создание игры, удаление команд

### [Story Engine](docs/story-engine.md)
- Подробная архитектура сюжетных квестов
- Story Items, Nodes, Edges, Endings
- Story Progress и API
- Графический редактор

### [UI паттерны](docs/ui-patterns.md)
- React Query и State Management
- UI/Frontend инварианты
- Ключевые компоненты (GamesPageClient, GameTeamsModal, и т.д.)
- Стандарты модальных окон
- Контроль хода игры (Game Control)
- Проверка фотоквеста (Photo Review)
- Локация пользователя

### [Troubleshooting](docs/troubleshooting.md)
- Системы логирования и debug-флаги
- Быстрая диагностика (8 симптомов + решения)
- Частые нюансы работы с snapshot'ами
- Практические задачи и решения
- Pre-merge чеклист
- Техдолг и известные проблемы

## Что смотреть в первую очередь при новой задаче

1. `helpers/fetchGamesForCabinet.js` — **КРИТИЧНО** при работе с историей и snapshot'ами
2. `components/cabinet/app-router/GamesPageClient.js` — основной сценарий управления играми
3. `app/cabinet/_lib/overviewServerData.js` — загрузка и фильтрация игр для Обзора
4. `app/api/[location]/games/[id]/route.js` — изменение игры и статусные переходы
5. `server/buildGameResultComputed.js` — расчет `teamsPlaces` + `computed` из snapshot'ов
6. `server/updateParticipantsRatings.js` и `server/updateParticipantsClosedStats.js` — рейтинг и gameStats
7. `app/api/cabinet/dev/*/route.js` — dev-операции пересчета/массового закрытия
8. `server/storyEngine.js` — движок сюжетных квестов (для story-игр)

## Полезные команды

- `npm run dev` — запуск dev-сервера.
- `npm run lint` — линт (покрывает `app/` и часть `components/cabinet/`).
- `npm run build` — production-сборка.
- `npm run smoke:app` — проверка основных роутов.
- `npm run verify:api-contracts` — проверка API-контрактов кабинета.

## Работа с roadmap

- Перед началом крупной задачи проверять актуальные roadmap-документы в `docs/` (минимум `docs/roadmap.md`, а также профильные roadmap по теме задачи).
- Для диагностики и расследования инцидентов использовать `docs/logging-and-debug.md` как источник по debug-флагам и префиксам логов.
- Если в рамках работы закрыт или существенно продвинут пункт roadmap, обновлять его статус в документе:
  - `[x]` — выполнено,
  - `[~]` — в процессе,
  - `[ ]` — не начато.
- При обновлении статуса кратко синхронизировать формулировку пункта с фактической реализацией (например, актуальные пути API), чтобы roadmap не расходился с кодом.

## Практика изменений

- Использовать React functional components.
- Добавлять/обновлять `PropTypes` при изменении контрактов компонентов.
- Следовать существующему стилю именования и Tailwind-паттернам проекта.
- Не создавать бинарные файлы (изображения/аудио и т.п.) в репозитории.
- **Язык:** В ответах и комментариях использовать русский язык.
