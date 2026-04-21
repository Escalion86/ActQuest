# Telegram Bot Flow: Чат Проекта -> Выбор Города -> Переход В Городской Чат

## Статус внедрения

- [~] MVP реализован:
  - endpoint `app/api/telegram_project/route.js`;
  - сценарии `/start`, deep-link (`city_krsk|city_nrsk|city_ekb`), callback `project_city:*`;
  - источники chat URL: `SiteSettings.chatUrlsByLocation` + env fallback.
- [ ] Не завершено:
  - трекинг событий в БД/дашборде;
  - финальная UX-интеграция ссылок на бота проекта во все целевые CTA.

## Цель

- Дать единый вход в Telegram-экосистему ActQuest.
- На первом экране предложить выбор города.
- Переводить пользователя в нужный городской чат (Красноярск, Норильск, Екатеринбург).
- Собирать аналитику переходов по городам.

## Контекст текущего проекта

- В проекте уже есть Telegram webhook routes по локациям:
  - `app/api/telegram_krsk/route.js`
  - `app/api/telegram_nrsk/route.js`
  - `app/api/telegram_ekb/route.js`
- Обработка идёт через `telegramCRUD` и legacy bot-слой в `telegram/*`.
- Для новой точки входа нужен отдельный проектный бот (не привязанный к одной локации).

## Рекомендуемая архитектура

1. Отдельный бот проекта:
- Пример: `@ActQuestProjectBot` (название уточнить).
- Отдельный токен: `TELEGRAM_PROJECT_TOKEN`.

2. Отдельный webhook endpoint:
- Новый route: `app/api/telegram_project/route.js`.
- Обработчик вызывает `telegramCRUD(req, res, 'project')` или отдельный обработчик project-flow.

3. Конфиг городов для бота:
- Единый конфиг (вынести в `helpers`/`server`), например:
  - `krsk`: title + `chatUrl`
  - `nrsk`: title + `chatUrl`
  - `ekb`: title + `chatUrl`
- Источник URL чатов:
  - либо из `Settings` в БД,
  - либо из env на старте,
  - либо гибрид (env fallback).

## UX сценарий

## Entry points

1. `/start` без параметров:
- Бот присылает приветствие + inline keyboard с городами.

2. `/start city_krsk|city_nrsk|city_ekb` (deep-link):
- Бот сразу открывает сценарий выбранного города:
  - подтверждение выбора;
  - кнопка `Перейти в чат`.

3. Кнопка "Чат проекта" на сайте:
- Ведёт на бота проекта.
- Для city-страниц можно использовать deep-link:
  - `...start=city_krsk`
  - `...start=city_nrsk`
  - `...start=city_ekb`

## Основной сценарий (без deep-link)

1. Пользователь открывает бота и нажимает `/start`.
2. Бот отправляет сообщение:
- "Выберите город, чтобы перейти в чат сообщества."
3. Inline keyboard:
- `Красноярск`
- `Норильск`
- `Екатеринбург`
4. Пользователь нажимает город.
5. Бот:
- сохраняет выбор (state + аналитика),
- присылает кнопку `Перейти в чат <город>`,
- дополнительно показывает кнопку `Выбрать другой город`.

## Callback/command протокол

Рекомендуемый формат callback data:
- `project_city:krsk`
- `project_city:nrsk`
- `project_city:ekb`

Дополнительные действия:
- `project_city:change`
- `project_help`

Рекомендуемый deep-link payload:
- `city_krsk`
- `city_nrsk`
- `city_ekb`

## Состояния (минимум)

`ProjectBotSession` (можно в отдельной коллекции, либо в Users как вложенное поле):

- `telegramId`
- `lastSelectedCity` (`krsk|nrsk|ekb|null`)
- `lastEntrySource` (`start|deeplink|button|site`)
- `lastInteractionAt`
- `counters`:
  - `citySelectCount`
  - `chatOpenClicks`

## Аналитика (обязательно)

События:
- `project_bot_start`
- `project_city_selected`
- `project_chat_link_sent`
- `project_chat_link_clicked` (приближённо, по нажатию callback)
- `project_city_changed`

Поля события:
- `telegramId`
- `cityKey`
- `source` (`start/deeplink/site`)
- `timestamp`
- `payload`

Куда писать:
- В `SiteEvents` (если уже используется),
- либо в отдельную легковесную коллекцию `BotEvents`.

## Ошибки и fallback

1. У города не настроен `chatUrl`:
- ответ: "Чат города временно недоступен, попробуйте позже."
- логировать ошибку c cityKey.

2. Невалидный deep-link payload:
- показать стандартный выбор города.

3. Telegram API timeout/send error:
- ретрай 1 раз;
- лог в error-level с cityKey и telegramId.

4. Пользователь без выбора города нажал "перейти":
- принудительно вернуть к шагу выбора города.

## Безопасность и ограничения

- Не хранить персональные данные сверх необходимого.
- Ограничить rate на стартовые команды (минимальная антиспам-защита).
- Все внешние chat URLs валидировать как `https://t.me/...`.

## Технический план внедрения (MVP)

1. Создать endpoint:
- `app/api/telegram_project/route.js`.

2. Добавить project-mode обработку:
- распознавание `/start` и deep-link payload;
- callback router для `project_city:*`.

3. Добавить конфиг city->chatUrl:
- загрузка из БД/Settings;
- fallback из env.

4. Добавить event logging.

5. Добавить CTA на сайте:
- общая кнопка "Чат проекта" на главной;
- deep-link версии для city-страниц.

6. Smoke-check:
- `/start` -> выбор города;
- deep-link -> сразу нужный город;
- смена города;
- пустой/невалидный payload.

## Критерии готовности

- Работает сценарий выбора города в боте проекта.
- Пользователь из 1-2 кликов попадает в чат своего города.
- Есть лог событий по выбору города и кликам.
- Есть fallback при отсутствии chat URL.
- На сайте есть рабочая ссылка на бота проекта (и city deep-link при необходимости).
