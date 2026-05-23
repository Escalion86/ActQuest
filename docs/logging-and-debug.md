# Логирование и debug в ActQuest

Документ фиксирует текущие системы логирования, их префиксы и env-флаги.

## 1) Session/Auth debug

- Префикс логов: `[session-debug]`
- Где используется:
  - `server/auth/authOptions.js`
  - `helpers/getSessionSafe.js`
  - `app/api/cabinet/games-list/route.js`
  - `components/cabinet/CabinetLayout.js`
  - `helpers/requestApiJson.js` (клиентский контур API-запросов)
- Флаги включения:
  - сервер: `SESSION_DEBUG=1`
  - клиент: `NEXT_PUBLIC_SESSION_DEBUG=1`
- Где смотреть:
  - серверные логи процесса Next.js (stdout/stderr)
  - browser console (для клиентских сообщений)

## 2) Debug принудительного выбора города

- Префиксы:
  - клиент: `[force-location][client]`
  - сервер: `[force-location][server]`
- Где используется:
  - `components/cabinet/CabinetLayout.js`
  - `app/api/cabinet/users/location/route.js`
- Флаги включения:
  - сервер: `FORCE_LOCATION_DEBUG=1` (или `SESSION_DEBUG=1`)
  - клиент: `NEXT_PUBLIC_FORCE_LOCATION_DEBUG=1` (или `NEXT_PUBLIC_SESSION_DEBUG=1`)
- Ключевые события:
  - клиент: `state`, `submit_start`, `submit_response`, `forced_location_set`, `session_update_success/error`, `submit_finish`
  - сервер: `request_received`, `try_filter`, `updated_by_filter`, `user_not_found`, `exception`

## 3) Error-level логирование

- Основные точки `console.error`:
  - `server/auth/authOptions.js`
  - `helpers/getSessionSafe.js`
  - `app/api/cabinet/users/location/route.js`
  - `components/cabinet/CabinetLayout.js`
- Рекомендация:
  - в production обязательно собирать и хранить stdout/stderr (PM2/systemd/docker logging driver),
  - при расследовании инцидента включать debug-флаги только на время диагностики.

## 4) Debug игрового экрана команды

- Префикс логов: `[game-task-debug]`
- Где используется:
  - `app/api/webapp/game-task/route.js`
  - `server/getTeamGameTaskState.js`
- Флаги включения:
  - сервер: `GAME_TASK_DEBUG=1`
  - также включается через `SESSION_DEBUG=1`
- Что пишет:
  - идентификаторы пользователя из сессии (`globalUserId`, `telegramId`)
  - параметры запроса `game-task`
  - как разрешилось membership-сопоставление (`matchedBy`, совпавшие записи)
  - итоговый `taskState` и captain actions

## 5) Практика включения debug

Минимальный набор для проблем авторизации/локации:

```bash
SESSION_DEBUG=1
FORCE_LOCATION_DEBUG=1
GAME_TASK_DEBUG=1
NEXT_PUBLIC_SESSION_DEBUG=1
NEXT_PUBLIC_FORCE_LOCATION_DEBUG=1
```

После диагностики флаги нужно выключить.
