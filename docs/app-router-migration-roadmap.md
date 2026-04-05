# App Router Migration Roadmap (ActQuest)

## Легенда статусов

- [x] Выполнено
- [~] В процессе
- [ ] Не начато

Дата создания: 2026-04-03.

Статус документа: миграция завершена, документ хранится как исторический журнал этапов.

## Цель

Постепенно перевести проект с `pages` router на `app` router без простоя и без массовых регрессий в кабинете, API и авторизации.

## Ограничения и правила миграции

- Не делать «big bang» миграцию.
- (историческое) Держать `pages` и `app` параллельно до полного переноса.
- Переносить маршруты вертикальными срезами: UI + данные + API.
- Для чувствительных зон (`/cabinet`, auth, games) сначала делать пилот и наблюдаемость.

## Этапы

### Этап 0. Подготовка инфраструктуры

- [x] Создать базовый `app`-каркас (`app/layout.js`, `app/globals.css`).
- [x] Добавить пилотную страницу в `app` без конфликтов с существующими роутами.
- [x] Добавить первый route handler в `app/api` без конфликтов.
- [x] Включить обязательный smoke-check для app-роутов в pre-merge (добавлен `scripts/smokeAppRoutes.js` + npm-команда `premerge:app`).

### Этап 1. Базовые публичные страницы

- [x] Перенести не-критичные публичные страницы в `app/*` (перенесены `/`, `/legacy`, `not-found`; legacy `pages/index.js`, `pages/404.js`, `pages/legacy/index.js` удалены).
- [x] Убрать дубли стилей/метаданных между `_app/_document` и `app/layout` (legacy `_app`/`_document` удалены, базовые метаданные централизованы в `app/layout.js`).
- [x] Проверить SEO-метаданные после переноса (добавлены `metadataBase`, `openGraph`, `twitter`, `viewport.themeColor` в `app/layout.js`; page-level title сохранены).

### Этап 2. Auth в App Router

- [x] Подготовить shared-конфиг auth (`authOptions`) вне `pages/api` для использования в App Router и server-модулях (`@server/auth/authOptions`).
- [x] Перенести `NextAuth` в `app/api/auth/[...nextauth]/route.js`.
- [x] Сохранить совместимость callbackUrl и текущих flows (`login/register/recovery`) в App Router (`app/cabinet/login|register|recovery/page.js` + shared callback resolver).
- [x] Убрать временные compatibility-хаки в `pages/api/auth` (удален `pages/api/auth/[...nextauth].js`, все импорты `authOptions` переведены на `@server/auth/authOptions`).

### Этап 3. Cabinet маршруты (по одному)

- [x] Пилот app-маршрутов кабинета на отдельном префиксе (`/cabinet-app/games-upcoming`, `/cabinet-app/games-past`) с SSR-auth и загрузкой игр.
- [x] Добавить пилот read-only профиля в app (`/cabinet-app/profile`) с SSR-auth и загрузкой данных пользователя.
- [x] Добавить пилот read-only команд в app (`/cabinet-app/teams`) с SSR-auth и загрузкой команд текущего пользователя.
- [x] Добавить пилот read-only обзора кабинета в app (`/cabinet-app`) с SSR-auth и базовыми метриками.
- [x] Добавить пилот read-only админского списка пользователей в app (`/cabinet-app/admin/users`) с SSR-auth и проверкой роли администратора/разработчика.
- [x] Добавить пилот read-only админского списка команд в app (`/cabinet-app/admin/teams`) с SSR-auth и проверкой роли администратора/разработчика.
- [x] Добавить пилот read-only админского списка транзакций в app (`/cabinet-app/admin/transactions`) с SSR-auth и проверкой роли доступа к транзакциям.
- [x] Добавить пилот read-only админской статистики в app (`/cabinet-app/admin/reports`) с SSR-auth и проверкой роли администратора/разработчика.
- [x] Перенести `/cabinet/games-upcoming` в `app` (маршрут `app/cabinet/games-upcoming/page.js`, server auth + client компонент `components/cabinet/app-router/GamesPageClient`).
- [x] Перенести `/cabinet/games-past` в `app` (маршрут `app/cabinet/games-past/page.js`, server auth + client компонент `components/cabinet/app-router/GamesPageClient`).
- [x] Перенести `/cabinet/games` в `app` (маршрут `app/cabinet/games/page.js`; legacy `pages/cabinet/games.js` и временный `GamesPageBridge` удалены).
- [x] Перенести `/cabinet/profile`, `/cabinet/teams` (маршруты `app/cabinet/profile/page.js` и `app/cabinet/teams/page.js`, server auth + server data loaders + client bridges `ProfilePageClient`/`TeamsPageClient`).
- [x] Перенести `/cabinet/settings` в `app` (маршрут `app/cabinet/settings/page.js`, server auth + server load `SiteSettings`; legacy `pages/cabinet/settings.js` удалён).
- [x] Перенести `/cabinet` в `app` (маршрут `app/cabinet/page.js`, server auth + загрузка overview данных; legacy `pages/cabinet/index.js` удалён).
- [x] Перенести auth-страницы кабинета `/cabinet/login`, `/cabinet/register`, `/cabinet/recovery` в `app` (маршруты `app/cabinet/login|register|recovery/page.js`; callbackUrl flow сохранён через shared resolver).
- [x] Перенести `/cabinet/developer` в `app` (маршрут `app/cabinet/developer/page.js`; legacy `pages/cabinet/developer.js` удалён).
- [x] Перенести admin-разделы (`users`, `teams`, `reports`, `transactions`) в `app/cabinet/admin/*` (добавлены server-auth wrappers + client-компоненты, legacy `pages/cabinet/admin/*` удалены).
- [x] Перенести legacy-страницы `pages/[location]/*` в `app/[location]/*` (перенесены `/[location]/other/fifteenPuzzle`, `/[location]/other/map`, `/[location]/game/location/[id]`, `/[location]/game/map/[id]/[teamId]`, `/[location]/game/[id]`, `/[location]/game/[id]/[teamId]`, `/[location]/game/result/[id]`, `/[location]/control/[jsonCommand]`; legacy `pages/[location]/*` удалены).
- [x] Схлопнуть pilot UI-маршруты `/cabinet-app/*` в редиректы на основные `/cabinet/*`, затем удалить `/cabinet-app/*` и неиспользуемые `components/cabinet/app-pilot/*`.

### Этап 4. API миграция

- [x] Перенести `pages/api/cabinet/*` в `app/api/cabinet/*` (созданы рабочие App Router endpoints в `app/api/cabinet/*` на базе pilot-реализаций; legacy-дерево `pages/api/cabinet/*` полностью удалено).
- [x] Клиентские вызовы кабинета переключены на основные App API маршруты (`/api/cabinet/*`, `/api/public/*`, `/api/phone/verify/*`) без флага `NEXT_PUBLIC_USE_APP_API_PILOT`; временный слой `api-pilot` удалён.
- [x] Перенести `pages/api/phone/*`, `pages/api/public/*` (добавлены и включены App Router endpoints `app/api/public/site-access/route.js`, `app/api/phone/verify/precheck/route.js`, `app/api/phone/verify/start/route.js`, `app/api/phone/verify/check/route.js`, `app/api/phone/verify/finalize/route.js`; legacy `pages/api/public/site-access.js` и `pages/api/phone/verify/*` удалены).
- [x] Перенести API вне cabinet/public/phone: `pages/api/vk-id/callback.js`, `pages/api/global/auth/vk-status.js`, `pages/api/escalioncloud/*`, `pages/api/webapp/*` (все эти маршруты перенесены в `app/api/*`, legacy-файлы удалены).
- [x] Перенести location-scoped API: `pages/api/[location]/*` -> `app/api/[location]/*` (перенесены `custom`, `games/[id]`, `games/check/[id]`, `games/start/[id]`, `games/stop/[id]`, `gamesteams`, `gamesteams/[id]`, `gamesteams/process/[id]`, `teams/[id]`, `teamsusers/[id]`, `users/[id]`, `usersingame/[id]`; legacy-файлы удалены).
- [x] Сверить коды ошибок/контракты ответов (без breaking changes для frontend): добавлены автоматические контракт-чеки `scripts/verifyCabinetApiContracts.js` и `scripts/verifyLocationApiContracts.js`, включены в `premerge:app`.

### Этап 5. Декомиссия Pages Router

- [x] Удалить дублирующиеся `pages` маршруты после стабилизации.
- [x] Удалить legacy-обвязку (`_app`, `_document`) после полного переноса.
- [x] Убрать client-зависимость от `next/router` в app-ветке (переведены `CabinetLayout`, `GamesPageClient`, `TeamsPageClient`, `AdminUsersPageClient`, `CabinetDashboardPageClient`, `CabinetLoginPageClient`, `CabinetRegisterPageClient` на `next/navigation`).
- [x] Финальный регресс-прогон ключевых сценариев (auth, games, teams, admin) — выполнены технический прогон (`premerge:app`) и ручной smoke по основным экранам; незначительные баги (theme script в layout, duplicate key в TeamDescriptionModal, защита от `participantTeams` undefined в dashboard) исправлены.

## Критерии готовности к cutover

- [x] Все пользовательские и админские маршруты работают из `app`.
- [x] Все API-контракты сохранены или согласованно обновлены (в pre-merge включены автоматические чеки `verify:api-contracts` и `verify:location-api-contracts`).
- [x] Нет критичных регрессий по авторизации, сессиям и SSR/refresh сценариям (подтверждено техническим прогоном и ручным smoke).
- [~] Логи и мониторинг подтверждают стабильность в течение контрольного окна (операционный чеклист: `docs/app-router-go-live-checklist.md`).
