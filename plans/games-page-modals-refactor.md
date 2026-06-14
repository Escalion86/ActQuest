# Рефакторинг модальных окон GamesPage

## Проблема

`GamesPageClient.js` (~8200 строк) и `GameModals.js` (~850 строк) перегружены:

- Огромное количество пропсов дублируется между модальными окнами
- `GameEditModal` содержит логику и для игры, и для заданий
- Сложно поддерживать и вносить изменения

## Цель

Разделить на три независимых модальных окна:

1. **GameEditModal** — редактирование игры (основные настройки)
2. **GameTasksEditModal** — редактирование заданий
3. **GameStatusModal** — смена статуса (уже существует отдельно)

## Новая структура

```
components/
├── cabinet/
│   └── app-router/
│       └── GamesPageClient.js          # Упрощённый (~2000 строк)
├── modals/
│   ├── game-edit/
│   │   ├── GameEditModal.js            # Редактирование игры
│   │   └── sections/
│   │       ├── GameBasicInfoSection.js
│   │       ├── GameSettingsSection.js
│   │       └── GameModeratorsSection.js
│   ├── game-tasks/
│   │   ├── GameTasksEditModal.js       # Редактирование заданий
│   │   └── sections/
│   │       ├── TaskItem.js
│   │       ├── TaskCodesSection.js
│   │       └── TaskCluesSection.js
│   ├── game-status/
│   │   └── GameStatusModal.js          # Смена статуса (уже есть)
│   └── GameModals.js                   # Фасад (~150 строк)
```

## План реализации

### Шаг 1: Создание структуры папок

- [ ] Создать `components/modals/game-edit/sections/`
- [ ] Создать `components/modals/game-tasks/sections/`

### Шаг 2: Выделение GameEditModal

- [ ] Создать `components/modals/game-edit/GameEditModal.js`
- [ ] Перенести логику редактирования основных настроек игры
- [ ] Убрать логику заданий

### Шаг 3: Выделение GameTasksEditModal

- [ ] Создать `components/modals/game-tasks/GameTasksEditModal.js`
- [ ] Перенести логику редактирования заданий
- [ ] Сделать независимым от GameEditModal

### Шаг 4: Обновление GameModals

- [ ] Превратить в тонкий фасад
- [ ] Убрать дублирование пропсов

### Шаг 5: Рефакторинг GamesPageClient

- [ ] Вынести состояние в кастомные хуки
- [ ] Уменьшить размер компонента

### Шаг 6: Тестирование

- [ ] Проверить работу всех модальных окон
- [ ] Проверить сохранение изменений
- [ ] Проверить валидацию

## Детали реализации

### GameEditModal (новое расположение: `components/modals/game-edit/GameEditModal.js`)

**Ответственность:**

- Основная информация об игре (название, тип, город, дата)
- Описание игры
- Настройки заданий (длительность, подсказки, штрафы)
- Модераторы и агенты
- Приквел

**Пропсы:**

```js
{
  isOpen,
  onClose,
  game,                    // Редактируемая игра
  onSave,                  // Функция сохранения
  isSaving,
  canEdit,
  location,
  availableModerators,
  availableAgents,
  availableOrganizers,
  editGameSeasons,
  isEditGameSeasonsLoading,
  onCreateSeason,
}
```

### GameTasksEditModal (новое расположение: `components/modals/game-tasks/GameTasksEditModal.js`)

**Ответственность:**

- Список заданий
- Редактирование каждого задания (заголовок, описание, коды, подсказки)
- Перетаскивание заданий
- Перетаскивание подсказок
- Бонусные и штрафные коды
- Координаты

**Пропсы:**

```js
{
  isOpen,
  onClose,
  game,                    // Редактируемая игра
  onSave,                  // Функция сохранения
  isSaving,
  canEdit,
  expandedTaskIds,
  onToggleTaskExpansion,
  onAddTask,
  onRemoveTask,
  onReorderTask,
  onUpdateTask,
  onSaveAndOpenTaskPreview,
}
```

### GameStatusModal (уже существует: `components/modals/GameStatusModal.js`)

**Без изменений** — уже является отдельным компонентом.

### GameModals (фасад: `components/modals/GameModals.js`)

**Новая роль:**

- Тонкая обёртка для подключения всех модалок
- Принимает минимальный набор пропсов от `GamesPageClient`
- Распределяет данные по дочерним компонентам

**Пропсы:**

```js
{
  selectedGame,
  editGame,
  modalsState,             // { isEditModalOpen, isTasksModalOpen, ... }
  modalsHandlers,          // { onCloseEditModal, onCloseTasksModal, ... }
  gameEditConfig,          // Конфигурация для GameEditModal
  gameTasksConfig,         // Конфигурация для GameTasksEditModal
  gameStatusConfig,        // Конфигурация для GameStatusModal
}
```

## Миграция

### Этап 1: Создание новых компонентов

1. Создать новые файлы модалок
2. Перенести логику из старых компонентов
3. Протестировать в изоляции

### Этап 2: Интеграция

1. Обновить `GameModals.js` для использования новых компонентов
2. Обновить `GamesPageClient.js`
3. Протестировать интеграцию

### Этап 3: Очистка

1. Удалить старый код
2. Проверить что ничего не сломалось

## Ожидаемые результаты

- `GamesPageClient.js`: ~8200 → ~2000 строк
- `GameModals.js`: ~850 → ~150 строк
- `GameEditModal.js`: ~4400 → ~1500 строк (только настройки игры)
- `GameTasksEditModal.js`: ~1500 строк (только задания)
- Упрощение поддержки и добавления новых функций
