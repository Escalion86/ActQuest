# ActQuest

ActQuest — монорепозиторий Next.js-приложения, API-слоя, серверной игровой
логики и legacy Telegram-бота для автоквестов.

## Актуальная ветка игрового процесса

Основная разработка игрового движка ведётся в web/cabinet-ветке:

- экран команды: `components/location-game/GameTeamPageClient.js`;
- состояние задания команды: `server/getTeamGameTaskState.js`;
- web API задания: `app/api/webapp/game-task/route.js`;
- админский контроль игры: `app/api/cabinet/admin/game-status/route.js`.

Telegram-ветка игрового процесса (`telegram/`, `server/gameProcess.js` и
связанные Telegram-команды) считается legacy. Новую функциональность нужно
проектировать и проверять в web/cabinet-ветке. Telegram-код можно учитывать
как историческую справку, но не как обязательный источник поведения для новых
изменений.
