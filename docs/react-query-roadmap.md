# React Query Implementation Roadmap

## Current Status: ✅ Phase 1 Complete / Phase 2 Pending

Completed migration of core admin modals (4 components) + custom optimistic mutation hook. As of 2026-04-27, the remaining items below are still candidates for future bounded migrations.

---

## Phase 2: Extended Modal Coverage (Next Priority)

### Priority 1: Simple Read Operations

Time estimate: 2-3 hours

- [x] **GameTeamsModal.js** - load team details on preview
  - Migrated: `handleOpenTeamDetails` now opens fallback data immediately and detailed data loads via `useQuery`
  - Query key: `['team', teamId]`, shared with `TeamViewModal`
  - Custom `fetchCabinetTeamDetails` helper reused

- [x] **UnifiedGameDescriptionModal.js** - nested game details
  - Migrated caller: `TeamDescriptionModal` now loads nested game previews with `useQuery`
  - Query key: `['game', gameId, location]`
  - `UnifiedGameDescriptionModal` remains a presentational modal that receives the resolved game

- [x] **EntitySelectField.js** - dropdown search results
  - Migrated: manual pagination/request state replaced with `useInfiniteQuery`
  - Query key: `['entity-select', endpoint, search, queryParams]`
  - Used by `UserSelectField` and `GameSelectField`

### Priority 2: List Operations with Mutations

Time estimate: 4-6 hours

- [x] **PhotoReviewPageClient.js** - photo quest review data + check mutations
  - Migrated: manual `fetchData`/`loading`/`setData` state replaced with `useQuery`
  - Query key: `['photo-review', gameId]`
  - Mutations: task/photo checkboxes use `useMutation` with optimistic cache update and rollback on error

- [x] **GameTaskPreviewPageClient.js** - task preview data
  - Migrated: manual `fetchPreview`/`loading`/`error`/`data` state replaced with `useQuery`
  - Query key: `['game-task-preview', { gameId, draftKey, taskIndex }]`
  - Supports both saved game preview API and local draft preview through one query boundary

- [x] **GameControlPageClient.js** - live game control status
  - Migrated: manual `fetchStatus`/`setInterval`/`loading`/`error`/`data` state replaced with `useQuery`
  - Query key: `['game-control-status', gameId]`
  - Polling: `refetchInterval` controlled by the existing auto-refresh UI
  - Manual game actions still use explicit POST handlers and call `refetch()` after success

- [x] **AdminUsersList** - list query and submit mutations migrated
  - Migrated: filtered list and "load more" pagination use `useInfiniteQuery`
  - Query key: `['admin-users', { search, role, location, sortBy, withoutPhoneOnly }]`
  - Migrated: profile save, Telegram phone request, and push message submit use `useMutation`
  - Cache sync: successful profile save updates all active `admin-users` query pages through `queryClient.setQueriesData`

- [x] **AdminTeamsList** - list query and team/member mutations migrated
  - Migrated: filtered list and "load more" pagination use `useInfiniteQuery`
  - Query key: `['admin-teams', { search, visibility, location, sortBy }]`
  - Migrated: save/delete/add-member/remove-member/set-captain actions use `useMutation`
  - Cache sync: successful mutations update all active `admin-teams` query pages through `queryClient.setQueriesData`

### Priority 3: Complex Components

Time estimate: 6-8 hours

- [ ] **TeamsPageClient.js** - main teams page
  - Current: Complex controlled component
  - Challenge: Filtering affects queryKey
  - Pattern: useQuery with deps in queryKey
  - Example: `['teams', { location, search, sort }]`

- [ ] **GamesPageClient.js** - main games page
  - Similar complexity as TeamsPageClient
  - Multiple filters: status, season, location
  - Pagination support

---

## Phase 3: Advanced Patterns (Nice to Have)

### Parallel Queries

When one component needs multiple queries:

```javascript
const userQuery = useQuery(['user', userId], ...)
const gameQuery = useQuery(['game', gameId], ...)
// Both execute in parallel

// Dependent queries
const teamQuery = useQuery({
  queryKey: ['team', selectedTeam.id],  // depends on userQuery
  enabled: !!selectedTeam.id,
})
```

### Infinite Queries

For pagination/infinite scroll:

```javascript
const {
  data: games,
  fetchNextPage,
  hasNextPage,
} = useInfiniteQuery({
  queryKey: ['games'],
  queryFn: ({ pageParam = 0 }) => fetchGames({ offset: pageParam }),
  getNextPageParam: (lastPage) => lastPage.nextOffset,
})
```

### Cache Invalidation Strategies

After creating/deleting items:

```javascript
// Broad invalidation
queryClient.invalidateQueries({ queryKey: ['games'] })

// Precise invalidation
queryClient.invalidateQueries({
  queryKey: ['games', { status: 'active' }],
})

// Multiple related queries
queryClient.invalidateQueries({
  queryKey: ['teams', 'games', 'stats'],
})
```

### Persist Plugin

Save cache to localStorage:

```bash
npm install @tanstack/react-query-persist-client
```

```javascript
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

const persister = createSyncStoragePersister({
  storage: window.localStorage,
})

// In QueryClient creation
// ... with persistence options
```

---

## Phase 4: Developer Experience

### React Query DevTools

```bash
npm install @tanstack/react-query-devtools
```

Add to app for visual debugging:

- See all queries in cache
- Inspect queryKey hierarchy
- Test manual mutations
- Monitor stale/fresh status

### Testing Utilities

```bash
npm install @testing-library/react-query
```

Write tests for:

- Query caching behavior
- Optimistic updates
- Error handling
- Mutation success/error flows

### Documentation Updates

- [ ] Add React Query section to project README
- [ ] Create troubleshooting guide
- [ ] Add examples of each pattern
- [ ] Create migration template

---

## Implementation Guide by Component

### Template for List Component

```javascript
// 1. Define queryKey
const queryKey = [
  'items',
  {
    search,
    filter,
    sortBy,
    page,
  },
]

// 2. useQuery with dependencies
const { data: items, isLoading } = useQuery({
  queryKey,
  queryFn: () =>
    fetchItems({
      search,
      filter,
      sortBy,
      page,
    }),
  enabled: !!search || filter !== 'all', // don't fetch with empty search
})

// 3. For creates - useMutation with invalidation
const createMutation = useMutation({
  mutationFn: (payload) => createItem(payload),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['items'] })
  },
})

// 4. For deletes - useOptimisticMutation
const deleteMutation = useOptimisticMutation({
  queryKey, // same as useQuery
  mutationFn: (itemId) => deleteItem(itemId),
  updateCache: (oldItems, itemId) => oldItems.filter((i) => i.id !== itemId),
})
```

### Template for Form Component

```javascript
// 1. Fetch original data
const { data: entity } = useQuery({
  queryKey: ['entity', id],
  queryFn: () => fetchEntity(id),
  enabled: isOpen && !!id,
})

// 2. Separate editing state
const [editingEntity, setEditingEntity] = useState(null)

// 3. Merge strategy
const initializedEntity = editingEntity ?? (entity ? clone(entity) : null)

// 4. Update with mutation
const saveMutation = useOptimisticMutation({
  queryKey: ['entity', id],
  mutationFn: (payload) => updateEntity(id, payload),
  updateCache: (old, new) => ({ ...old, ...new }),
  onSuccess: () => {
    setEditingEntity(null)  // Clear form
    showSuccessMessage()
  },
})
```

---

## Questions to Ask When Migrating

- [ ] **Is this component fetching data?** If yes, candidate for useQuery
- [ ] **Is this component mutating data?** If yes, use useOptimisticMutation
- [ ] **What's the entity type?** (user, team, game) → Define queryKey
- [ ] **What's the unique identifier?** (id, userId) → Include in queryKey
- [ ] **Is data filtered/searched?** Include filter in queryKey: `['items', { filter, search }]`
- [ ] **Should modal share cache with page?** Use same queryKey everywhere
- [ ] **What happens on error?** Show message + rollback (handled by hook)
- [ ] **What's the happy path?** Show success message + close modal

---

## Metrics to Track

### User-Facing

- [ ] Modal open time (should be instant on reopen if cached)
- [ ] Save operation perceived latency (should feel instant with optimistic)
- [ ] Error recovery experience (smooth rollback)

### Development

- [ ] Lines of code removed (manual fetch logic)
- [ ] Components following pattern (% of total)
- [ ] Bug reduction in cache-related issues

### Performance

- [ ] API call reduction (deduplication + cache hits)
- [ ] User perceived performance (optimistic updates)
- [ ] Network traffic savings (shared cache)

---

## Potential Challenges & Solutions

| Challenge                 | Solution                                             |
| ------------------------- | ---------------------------------------------------- |
| Dependent queries         | Use `enabled` condition based on parent query data   |
| Complex filters           | Include filters in queryKey array                    |
| Pagination                | Use `useInfiniteQuery` or include page in queryKey   |
| Cross-modal sync          | Ensure same queryKey structure across components     |
| Stale data during filters | Invalidate or adjust staleTime as needed             |
| Form state vs cache       | Use separate `editingEntity` state, merge on display |

---

## Success Criteria for Each Phase

### Phase 1 (Completed) ✅

- [x] Core modals use React Query
- [x] Cache sharing works
- [x] Optimistic updates implemented
- [x] No manual fetch logic in modals

### Phase 2 (Next)

- [~] All read-only modals migrated
- [ ] Basic mutations working
- [ ] No prop drilling for data
- [ ] Documentation complete

### Phase 3

- [ ] Advanced patterns implemented
- [ ] Performance optimizations applied
- [ ] Comprehensive testing coverage

### Phase 4

- [ ] DevTools integrated
- [ ] Team trained on patterns
- [ ] Ready for scaling

---

## Resources for Developers

1. **Official**: https://tanstack.com/query/latest
2. **Setup**: See `/docs/react-query-guide.md` (local)
3. **Patterns**: Check implemented components:
   - UserEditModal.js (read + write)
   - UserViewModal.js (read only)
   - useOptimisticMutation.js (hook pattern)
4. **Help**: Ask yourself using template above

---

## Timeline Estimate

- **Phase 2**: 1-2 sprints (team of 1 developer)
- **Phase 3**: 1 sprint
- **Phase 4**: 0.5 sprint (setup) + ongoing

Total effort: **3-4 sprints** for full coverage + documentation

---

**Last Updated**: April 27, 2026  
**Owner**: Architecture Team  
**Status**: In Progress → Next Phase Ready
