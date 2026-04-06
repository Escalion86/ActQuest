# React Query Integration Guide

## Overview

Проект использует **@tanstack/react-query v5.45.0** для:

- Кэширования данных с сервера
- Управления состоянием асинхронных операций
- Оптимистических обновлений

## Setup

### QueryClient Configuration

**File**: `/app/providers.js`

```javascript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 минут
      gcTime: 1000 * 60 * 10, // 10 минут (сборка мусора)
    },
  },
})
```

- **staleTime**: Как долго данные считаются "свежими" без перезагрузки
- **gcTime**: Как долго хранить неиспользуемые данные в кэше

## Usage Patterns

### 1. Simple Data Fetching with useQuery

**Pattern**: Загрузка данных по ID/key

```javascript
const {
  data: user,
  isLoading,
  error,
} = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchCabinetUserDetails({ userId }),
  enabled: isOpen && !!userId, // Условное выполнение
  staleTime: 1000 * 60 * 5, // Опционально переопределить
})
```

**Key Points**:

- `queryKey` - уникальный ключ для кэша. Используй массив с параметрами: `['entity', id, filter]`
- `enabled` - эффект запустится только когда условие true
- Один `queryKey` автоматически делят все компоненты (cross-component cache sharing)

**Examples in Project**:

- `UserViewModal.js` - `['user', userId]`
- `UserEditModal.js` - `['user', userId]`
- `TeamViewModal.js` - `['team', teamId]`
- `TeamEditModal.js` - `['team', teamId]`

### 2. Mutations with useOptimisticMutation Hook

**Pattern**: Сохранение данных с оптимистическими обновлениями

```javascript
const mutation = useOptimisticMutation({
  queryKey: ['user', userId],
  mutationFn: async (payload) => {
    const { json } = await requestApiJson(
      `/api/cabinet/admin/users/${userId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )
    return json?.data || payload
  },
  updateCache: (oldUser, payload) => {
    if (!oldUser) return oldUser
    return { ...oldUser, ...payload }
  },
  onSuccess: () => {
    setFeedback({ type: 'success', message: 'Saved!' })
  },
  onError: (err) => {
    setFeedback({ type: 'error', message: err?.message })
  },
})

// Использование
mutation.mutate(newPayload)
// or
mutation.mutateAsync(newPayload)
```

**Hook Location**: `/helpers/useOptimisticMutation.js`

**How It Works**:

1. `onMutate` - отменяет текущие запросы, сохраняет старые данные, обновляет кэш оптимистически
2. API call in background
3. `onError` - откатывает кэш если ошибка
4. `onSuccess` - инвалидирует кэш для свежести, вызывает callback

**Status Tracking**:

- `mutation.isPending` - показать loading state
- `mutation.isError` - есть ошибка
- `mutation.status` - 'idle' | 'pending' | 'success' | 'error'

**Examples in Project**:

- `UserEditModal.js` - updateUserMutation
- `TeamEditModal.js` - updateTeamMutation

### 3. Form Data Pattern

**When Loading Meets Editing**:

```javascript
const { data: user, isLoading } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchCabinetUserDetails({ userId }),
  enabled: isOpen && !!userId,
})

const [editingUser, setEditingUser] = useState(null)

// Merge pattern: editing state или loaded data
const initializedEditing = editingUser ?? (user ? cloneUser(user) : null)

// Form uses initializedEditing, not user directly
<input value={initializedEditing?.name} onChange={...} />
```

**Why**:

- user - React Query кэшированные данные (read-only)
- editingUser - локальное состояние формы
- initializedEditing - merge на display

### 4. Cache Invalidation

**Full invalidation** (загрукаем свежие данные):

```javascript
queryClient.invalidateQueries({ queryKey: ['user', userId] })
```

**Used in**:

- `useOptimisticMutation` при `onSuccess`
- После создания/удаления элемента
- После крупного обновления

### 5. Manual Cache Updates

**Set cache directly** (для oптимистических updates):

```javascript
queryClient.setQueryData(['user', userId], (oldUser) => ({
  ...oldUser,
  name: 'New Name',
}))
```

**Used in**:

- `onMutate` hook в optimistic updates
- Manual cache seeding

### 6. Get Current Cache

```javascript
const cachedUser = queryClient.getQueryData(['user', userId])
```

**Used in**:

- Сохранение старых данных перед обновлением
- Проверка есть ли данные в кэше

## Query Key Conventions

Используй иерархический подход:

```javascript
// Читай слева направо как путь
;['user', userId]['user'][('users', 'list', { page: 1 })][ // Specific user // All users // Paginated users
  ('user', userId, 'games')
][('team', teamId, 'members')] // User's games // Team members
```

## Best Practices

### ✅ DO:

1. **Use consistent queryKey structure**

   ```javascript
   // Good
   queryKey: ['user', userId]
   // Bad
   queryKey: ['userData_' + userId]
   ```

2. **Enable queries conditionally**

   ```javascript
   // Good - won't fetch until modal opens
   enabled: isOpen && !!userId
   // Bad - fetches even when not needed
   enabled: !!userId
   ```

3. **Use optimistic updates for better UX**

   ```javascript
   // Good
   useOptimisticMutation({ ... onMutate: () => ... })
   // Bad
   useMutation({ ... no onMutate ... })
   ```

4. **Separate form state from cached data**

   ```javascript
   // Good
   const [editingUser, setEditingUser] = useState(null)
   const { data: user } = useQuery(...)
   const merged = editingUser ?? user

   // Bad
   const [user, setUser] = useState(null)
   useEffect(() => { fetch... }, [])
   ```

5. **Clear cache on modal close**

   ```javascript
   // Good - reset local state
   const handleClose = () => {
     setEditingUser(null)
     setFeedback(null)
     onClose()
   }

   // Bad - relying on component unmount
   ```

### ❌ DON'T:

1. **Don't duplicate fetch logic**

   ```javascript
   // Bad - duplicates UserEditModal logic
   const [user, setUser] = useState(null)
   useEffect(() => {
     fetchCabinetUserDetails({ userId }).then(setUser)
   }, [userId])

   // Good - use same queryKey
   useQuery({
     queryKey: ['user', userId],
     queryFn: () => fetchCabinetUserDetails({ userId }),
   })
   ```

2. **Don't pass cached data as props**

   ```javascript
   // Bad - prop drilling defeats cache sharing
   <Modal user={selectedUser} />

   // Good - Modal uses same queryKey
   <Modal userId={selectedUserId} />
   ```

3. **Don't manually manage loading state**

   ```javascript
   // Bad
   const [isLoading, setIsLoading] = useState(false)
   useEffect(() => { setIsLoading(true); fetch(); setIsLoading(false) }, [])

   // Good - isLoading from useQuery
   const { isLoading } = useQuery(...)
   ```

4. **Don't forget error handling**

   ```javascript
   // Bad - errors ignored
   useQuery({ queryKey: [...], queryFn: () => ... })

   // Good - handle errors
   const { error } = useQuery(...)
   error && <ErrorBanner>{error.message}</ErrorBanner>
   ```

## Components Already Using React Query

### Read-Only (useQuery)

- ✅ UserViewModal.js
- ✅ UserEditModal.js (+ mutation)
- ✅ TeamViewModal.js
- ✅ TeamEditModal.js (+ mutation)

### With Optimistic Updates (useOptimisticMutation)

- ✅ UserEditModal.js - updateUserMutation
- ✅ TeamEditModal.js - updateTeamMutation

## Components to Refactor

**High Priority** (simple read operations):

- [ ] GameTeamsModal.js - team details loading
- [ ] UnifiedGameDescriptionModal.js - game details
- [ ] EntitySelectField.js - paginated search

**Medium Priority** (list operations):

- [ ] AdminUsersList - batch operations
- [ ] AdminTeamsList - batch operations

**Low Priority** (complex state):

- [ ] Main TeamsPageClient.js - controlled component
- [ ] GamesPageClient.js - complex filtering

## Debugging

### Enable React Query DevTools

```bash
npm install @tanstack/react-query-devtools
```

Then in your app:

```javascript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

export default function App() {
  return (
    <>
      <MainContent />
      <ReactQueryDevtools initialIsOpen={false} />
    </>
  )
}
```

Opens floating DevTools button in dev mode to inspect queries/mutations.

### Common Debugging

**Check in DevTools**:

1. Click DevTools → Queries tab
2. See which queries are cached
3. See queryKey hierarchy
4. Test manual invalidation

**Check in code**:

```javascript
// Log current cache
queryClient.getQueryData(['user', userId])

// Check query state
const query = queryClient.getQueryState(['user', userId])
console.log(query?.state) // { data, error, status, fetchStatus }
```

## Migration Checklist

When converting component to React Query:

- [ ] Identify current `useEffect` + `useState` pattern
- [ ] Define clear `queryKey` ([entity, id, filter...])
- [ ] Create `useQuery` hook with `queryFn`
- [ ] Remove manual state variables for data/loading/error
- [ ] Use destructured query values: `{ data, isLoading, error }`
- [ ] Test cache sharing (open modal twice, should instant load)
- [ ] Test error handling
- [ ] Test mutations with optimistic updates
- [ ] Check DevTools shows expected queries
- [ ] Delete old fetch useEffect

## Troubleshooting

### "Query not refetching"

- Check `staleTime` - might still be fresh
- Call `queryClient.invalidateQueries()`
- Check `enabled` condition

### "Different data in different components"

- Check queryKey is exactly the same
- Might be different parameters in queryKey
- Use DevTools Queries tab to verify

### "Cache not updating after mutation"

- Did you call `queryClient.invalidateQueries()`?
- Or `queryClient.setQueryData()`?
- Check onSuccess/onError callbacks

### "Optimistic update reverts on error"

- Normal behavior - rollback is intentional
- Check `onError` callback shows error message
- Could show toast instead of reverting for complex updates

## Resources

- [React Query Official Docs](https://tanstack.com/query/latest)
- [React Query Quick Start](https://tanstack.com/query/latest/docs/react/overview)
- [Common Mistakes](https://tanstack.com/query/latest/docs/react/guides/important-defaults)
