# План: Переместить кнопку "Переписка с командами" влево

## Задача

На странице Game Control (`/cabinet/admin/game-control`) кнопка "Переписка с командами" (chat) должна располагаться слева от кнопки смены темы (sun/moon).

## Текущая структура шапки

Файл: `components/cabinet/app-router/GameControlPageClient.js`

```
<div className="flex flex-wrap items-start justify-between gap-3 mb-6">
  <div className="flex-1">
    <div className="flex items-center w-full gap-3 mb-2">
      <button>← Назад</button>
      <button onClick={toggleThemeMode} className="ml-auto">🌙/☀️</button>
    </div>
    <h1>...</h1>
    <p>...</p>
  </div>
  <div className="flex items-center gap-3">
    <label>Подробно</label>
    <label>Авто</label>
    <select>...</select>
    <button onClick={handleOpenGameConversationsModal}>💬</button>  <!-- ЗДЕСЬ -->
    <button onClick={refetchStatus}>🔄</button>
  </div>
</div>
```

## Целевая структура

```
<div className="flex flex-wrap items-start justify-between gap-3 mb-6">
  <div className="flex-1">
    <div className="flex items-center w-full gap-3 mb-2">
      <button>← Назад</button>
      <button onClick={handleOpenGameConversationsModal}>💬</button>  <!-- СЮДА -->
      <button onClick={toggleThemeMode}>🌙/☀️</button>  <!-- Без ml-auto -->
    </div>
    <h1>...</h1>
    <p>...</p>
  </div>
  <div className="flex items-center gap-3">
    <label>Подробно</label>
    <label>Авто</label>
    <select>...</select>
    <!-- Кнопка переписки удалена -->
    <button onClick={refetchStatus}>🔄</button>
  </div>
</div>
```

## Шаги реализации

### 1. Добавить кнопку переписки перед кнопкой смены темы

**Файл:** `components/cabinet/app-router/GameControlPageClient.js`
**Строки:** 1422-1446

Добавить кнопку с `handleOpenGameConversationsModal` перед кнопкой `toggleThemeMode`.

### 2. Убрать `ml-auto` у кнопки смены темы

**Строка:** 1433

Изменить класс с:

```
className="inline-flex items-center justify-center w-8 h-8 ml-auto transition border rounded-full ..."
```

на:

```
className="inline-flex items-center justify-center w-8 h-8 transition border rounded-full ..."
```

### 3. Удалить кнопку переписки из правого блока

**Строки:** 1520-1535

Удалить весь блок:

```jsx
<button
  type="button"
  onClick={handleOpenGameConversationsModal}
  className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-400 bg-amber-100 text-amber-800 transition hover:bg-amber-200 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20"
  aria-label="Открыть переписку с командами"
  title="Открыть переписку с командами"
>
  <ChatCardIcon />
  {totalUnreadTeamMessagesCount > 0 ? (
    <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow ring-2 ring-slate-950">
      {totalUnreadTeamMessagesCount > 99 ? '99+' : totalUnreadTeamMessagesCount}
    </span>
  ) : null}
</button>
```

## Результат

Кнопка "Переписка с командами" будет отображаться слева от кнопки смены темы в одной строке с кнопкой "← Назад".
