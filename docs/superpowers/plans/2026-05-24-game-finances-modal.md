# Game Finances Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Убрать финансы из просмотра игры и вынести управление ими в отдельную модалку, открываемую только с карточки игры для пользователей с правом управления игрой.

**Architecture:** Финансовый UI переносится из `GameEditModal` в новый `GameFinancesModal`, который работает с тем же draft игры из `GamesPageClient`. Кнопка открытия добавляется в action-блок карточки игры и использует уже существующую permission-модель управления игрой.

**Tech Stack:** Next.js App Router, React 19, PropTypes, существующие cabinet/modals-компоненты, Node test runner, ESLint.

---

### Task 1: Helpers и точечные тесты

**Files:**
- Modify: `helpers/cabinetGameVisibility.js`
- Create/Modify: `helpers/gameFinancesSummary.js`
- Test: `scripts/cabinetGameVisibility.test.js`
- Test: `scripts/gameFinancesSummary.test.js`

- [ ] Добавить helper для проверки доступа к кнопке финансов и helper для сводки финансов.
- [ ] Написать/обновить node-тесты на права доступа и расчёт summary.
- [ ] Запустить точечные тесты и убедиться, что они сначала покрывают новое поведение.

### Task 2: Новая модалка финансов

**Files:**
- Create: `components/modals/GameFinancesModal.js`

- [ ] Перенести блок финансового UI из `GameEditModal` в новый компонент.
- [ ] Подключить существующие handlers `handleAddFinance`, `handleFinanceChange`, `handleRemoveFinance`.
- [ ] Использовать общий `currencyFormatter` и `financesSummary`.

### Task 3: Подключение в GamesPageClient и GameModals

**Files:**
- Modify: `components/cabinet/app-router/GamesPageClient.js`
- Modify: `components/modals/GameModals.js`
- Modify: `components/cabinet/CardActionIconButton.js` (если понадобится новая иконка)

- [ ] Добавить состояние `isFinancesModalOpen` и handler открытия по карточке игры.
- [ ] Добавить круглую икон-кнопку `Финансы` в action-блок карточки.
- [ ] Подключить `GameFinancesModal` через `GameModals`.

### Task 4: Удаление старого UI финансов

**Files:**
- Modify: `components/modals/GameDescriptionModal.js`
- Modify: `components/modals/UnifiedGameDescriptionModal.js`
- Modify: `components/modals/GameEditModal.js`

- [ ] Удалить секцию финансов из просмотра игры.
- [ ] Удалить финансовый блок из общего редактора игры.
- [ ] Удалить ставшие лишними props и вычисления.

### Task 5: Проверка

**Files:**
- Verify: `components/modals/GameFinancesModal.js`
- Verify: `components/cabinet/app-router/GamesPageClient.js`
- Verify: `components/modals/GameDescriptionModal.js`

- [ ] Запустить `node --test scripts/cabinetGameVisibility.test.js scripts/gameFinancesSummary.test.js`.
- [ ] Запустить `npx eslint` по новым и затронутым файлам.
- [ ] Сверить итог против спеки: кнопка только на карточке, финансы исчезли из просмотра игры.
