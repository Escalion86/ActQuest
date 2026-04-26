# Google Integration Checklist (GSC + GA4 + GBP)

## Цель

- Подключить Google-канал как вторичный источник SEO-аналитики и локального спроса.
- Получать те же продуктовые сигналы, что и в Яндекс.Метрике.

## 1) Google Search Console (обязательно)

1. Добавить ресурс домена (лучше `Domain property`).
2. Подтвердить право на домен (DNS TXT).
3. Отправить sitemap:
- `https://actquest.ru/sitemap.xml`
4. Проверить индексирование ключевых URL:
- `/krsk`
- `/nrsk`
- `/ekb`
- `/articles`
- `/articles/*`
5. Проверить Coverage:
- нет массовых `Crawled - currently not indexed` на city/article страницах.

## 2) GA4 (обязательно)

## Env и подключение

- Добавить в прод env:
- `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX`
- В коде GA4 включается только если env задан.
- В dev без env GA4 отключён.

## Проверка после деплоя

1. Открыть Realtime в GA4.
2. Пройти путь:
- открыть city-страницу;
- клик `Записаться`;
- клик `Чат проекта`;
- клик по телефону;
- прокрутить страницу >75%.
3. Убедиться, что события приходят под именами `aq_*`.

## 3) Google Business Profile (локальное SEO)

1. Проверить карточки бренда/городов.
2. Проставить корректные ссылки на city-страницы.
3. Синхронизировать NAP с сайтом:
- имя;
- телефон;
- график;
- описание.
4. Добавить свежие фото и регулярно отвечать на отзывы.

## 4) События (должны совпадать с Яндекс)

- `aq_view_city_page`
- `aq_view_article`
- `aq_scroll_75`
- `aq_click_register`
- `aq_click_chat`
- `aq_click_phone`
- `aq_click_schedule`

## 5) Минимальный weekly-отчёт (Google)

1. Переходы из Organic Search.
2. CTR и показы по city-кластерам в GSC.
3. Конверсии по событиям `aq_click_register`, `aq_click_chat`, `aq_click_phone`.
4. Топ-страницы входа и их вовлечённость.
