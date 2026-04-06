# ActQuest Architecture

## Data Management with React Query

As of April 7, 2026, ActQuest uses **@tanstack/react-query** for centralized data fetching and caching.

### Why React Query?

- **Automatic Caching** - Data cached and reused across components
- **Optimistic Updates** - Changes appear instantly, rollback on error
- **Cache Sharing** - Multiple components use same data without duplicating fetches
- **Developer Experience** - Less boilerplate, more readable code
- **Performance** - Reduced API calls through deduplication and smart caching

### Core Architecture

```
┌─────────────────────────────────────────────────────┐
│ App (providers.js)                                  │
│ ├─ QueryClientProvider (staleTime: 5min)            │
│ ├─ SessionProvider                                  │
│ └─ JotaiProvider                                    │
└────────────────────────────────┬────────────────────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
        ┌───────▼────────┐  ┌────▼────────┐  ┌──▼──────────┐
        │ useQuery       │  │ useMutation │  │ useJotai    │
        │ (read-only)    │  │ (mutations) │  │ (app state) │
        └───────┬────────┘  └────┬────────┘  └─────────────┘
                │                │
        ┌───────▼────────────────▼────────┐
        │ Centralized Cache                │
        │ ├─ ['user', userId]              │
        │ ├─ ['team', teamId]              │
        │ └─ [entity, id, filters...]      │
        └──────────────────────────────────┘
```

## Query Key Convention

```javascript
// Single entity by ID
;['user', userId][('team', teamId)][('game', gameId)][
  // Filtered/paginated lists
  ('users', { role: 'admin', page: 1 })
][('games', { status: 'active', location: 'msk' })][
  // Nested resources
  ('user', userId, 'games')
][('team', teamId, 'members')]
```

## Data Flow

### Reading Data (useQuery)

```
Component Mounts
     ↓
useQuery({ queryKey: ['user', userId], ... })
     ↓
Is data in cache?
  ├─ YES (and fresh) → Return cached data immediately
  ├─ YES (stale) → Return cached + refetch in background
  └─ NO → Fetch from API
     ↓
Cache updated
     ↓
Component renders with data
```

### Writing Data (useMutation + Optimistic)

```
User clicks Save
     ↓
updateMutation.mutate(payload)
     ↓
onMutate:
  ├─ Cancel in-flight requests
  ├─ Save old data for rollback
  └─ Update cache optimistically
     ↓
API call in background
     ↓
API responds?
  ├─ SUCCESS → onSuccess (invalidate for fresh data)
  └─ ERROR → onError (rollback cache to old data)
     ↓
Component re-renders with result
```

## Component Patterns

### Pattern 1: Read-Only Modal

```javascript
const UserViewModal = ({ userId, isOpen, onClose }) => {
  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchCabinetUserDetails({ userId }),
    enabled: isOpen && !!userId,
    staleTime: 1000 * 60 * 5,
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {isLoading && <Loading />}
      {error && <Error error={error} />}
      {user && <UserDisplay user={user} />}
    </Modal>
  )
}
```

### Pattern 2: Form Modal with Optimistic Updates

```javascript
const UserEditModal = ({ userId, isOpen, onClose }) => {
  // Data from cache
  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchCabinetUserDetails({ userId }),
    enabled: isOpen && !!userId,
  })

  // Form state separate from cache
  const [editingUser, setEditingUser] = useState(null)
  const initializedUser = editingUser ?? (user ? cloneUser(user) : null)

  // Optimistic mutation
  const saveUser = useOptimisticMutation({
    queryKey: ['user', userId],
    mutationFn: (payload) => updateUser(userId, payload),
    updateCache: (old, new) => ({ ...old, ...new }),
    onSuccess: () => {
      showSuccess()
      setEditingUser(null)
    },
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <form onSubmit={(e) => {
        e.preventDefault()
        saveUser.mutate({
          name: initializedUser.name,
          // ... other fields
        })
      }}>
        <input
          value={initializedUser?.name}
          onChange={(e) => setEditingUser({
            ...editingUser,
            name: e.target.value
          })}
        />
        <button disabled={saveUser.isPending}>
          {saveUser.isPending ? 'Saving...' : 'Save'}
        </button>
      </form>
    </Modal>
  )
}
```

## File Organization

### Data Fetching

```
/helpers/
  ├─ fetchCabinetUserDetails.js      (API call functions)
  ├─ fetchCabinetTeamDetails.js
  ├─ fetchCabinetGameDetails.js
  ├─ useOptimisticMutation.js        (React Query hooks)
  └─ ...
```

### Components Using React Query

```
/components/
  ├─ cabinet/
  │  ├─ modals/
  │  │  ├─ UserViewModal.js          (useQuery)
  │  │  ├─ UserEditModal.js          (useQuery + mutation)
  │  │  ├─ TeamViewModal.js          (useQuery)
  │  │  └─ TeamEditModal.js          (useQuery + mutation)
  │  └─ app-router/
  │     └─ AdminUsersPageClient.js   (modal consumer)
  └─ ...
```

## Cache Lifetime

### Default Configuration

- **staleTime**: 5 minutes
  - Data considered "fresh" for 5 minutes
  - No refetch during this window unless explicitly invalidated
- **gcTime**: 10 minutes (garbage collection time)
  - Unused data kept for 10 minutes
  - Provides snappy cache hits if user revisits

### When Cache Updates

```
1. Component unmounts → data kept for 10 min
2. New component mounts with same queryKey → instant load
3. 5 min passes → data marked as stale
4. User interacts → background refetch triggered
5. 10 min passes with no usage → data cleared from memory
```

## Performance Characteristics

### API Call Reduction

**Before React Query** (manual fetch):

```
Open UserViewModal    → API call
Close modal           → -
Open UserViewModal    → API call again
(2 calls for same data)
```

**After React Query** (with caching):

```
Open UserViewModal    → API call
Close modal           → data cached
Open UserViewModal    → instant from cache
(1 call for same data)
```

### Cross-Component Sharing

**Before** (prop drilling):

```
Page fetches user data → passes to UserViewModal → passes to child
↓ Complex prop threading, easy to break

After** (React Query):
```

UserViewModal uses queryKey ['user', userId]
UserEditModal uses queryKey ['user', userId]
→ Automatically share same cached data
→ No prop passing needed

````

## State Management

### Where State Lives

| State Type | Location | Tool | Why |
|-----------|----------|------|-----|
| Server data (user, team) | React Query cache | useQuery | Fresh, shared, cached |
| Form editing state | Component | useState | Local, not global |
| Global UI state (theme) | Jotai | useAtom | Persistent, shared |
| Request state | React Query | useMutation | Built-in loading/error |

### Example: User Edit Form
```javascript
const [editingUser, setEditingUser] = useState(null)        // Form state
const { data: user } = useQuery(...)                        // Server state
const mutation = useOptimisticMutation(...)                 // Request state
const theme = useAtomValue(themeAtom)                       // Global state

const initializedUser = editingUser ?? user                 // Display merge
````

## Error Handling

### Query Errors

```javascript
const { data, error, isError } = useQuery(...)

{isError && <ErrorBanner>{error.message}</ErrorBanner>}
```

### Mutation Errors

```javascript
const mutation = useMutation({
  mutationFn: updateUser,
  onError: (err) => {
    showErrorMessage(err.message)
    // Cache auto-rolled back by useOptimisticMutation
  },
})
```

## Testing Strategy

### Testing useQuery

```javascript
// Mock the API function
jest.mock('@helpers/fetchCabinetUserDetails')

// Test components
expect(screen.queryByText('Loading')).toBeInTheDocument()
await waitFor(() => {
  expect(screen.queryByText('John Doe')).toBeInTheDocument()
})
```

### Testing Mutations

```javascript
// Test optimistic update
user.mutate({ name: 'New Name' })
expect(screen.getByDisplayValue('New Name')).toBeInTheDocument()

// Test rollback on error
expect(screen.getByDisplayValue('Old Name')).toBeInTheDocument()
```

## Debugging

### with React Query DevTools

```bash
npm install @tanstack/react-query-devtools
```

In app:

```javascript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

;<ReactQueryDevtools initialIsOpen={false} />
```

Debugging features:

- See all cached queries
- Inspect query state
- Manual invalidation
- Mutation tracking

### In Code

```javascript
// Get current cache
const cached = queryClient.getQueryData(['user', userId])
console.log('Cached user:', cached)

// Check query state
const state = queryClient.getQueryState(['user', userId])
console.log('Query status:', state?.state?.status) // 'success', 'error', 'loading'
```

## Next Steps

See `/docs/react-query-roadmap.md` for:

- Phase 2: more modal optimization
- Phase 3: list mutations
- Phase 4: advanced patterns

---

**Last Updated**: April 7, 2026  
**Version**: 1.0.0  
**Stability**: Production Ready
