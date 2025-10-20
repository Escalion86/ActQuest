import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'

let atomKey = 0

const isFunction = (value) => typeof value === 'function'

export const atom = (init, write) => {
  const config = { id: ++atomKey }
  if (typeof init === 'function' && write === undefined) {
    config.read = init
  } else if (typeof init === 'function' && write !== undefined) {
    config.read = init
    config.write = write
  } else {
    config.init = init
    if (write) {
      config.write = write
    }
  }

  return config
}

export const createStore = (initialEntries) => {
  const values = new Map(initialEntries ?? [])
  const listeners = new Map()
  const dependenciesMap = new Map()
  const dependentsMap = new Map()
  const mountEffects = new Map()

  const ensurePrimitive = (anAtom) => {
    if (!values.has(anAtom) && Object.prototype.hasOwnProperty.call(anAtom, 'init')) {
      const initialValue = isFunction(anAtom.init) ? anAtom.init() : anAtom.init
      values.set(anAtom, initialValue)
    }
  }

  const updateDependencies = (atomToUpdate, dependencies) => {
    const prevDependencies = dependenciesMap.get(atomToUpdate)
    if (prevDependencies) {
      for (const dependency of prevDependencies) {
        const dependents = dependentsMap.get(dependency)
        if (dependents) {
          dependents.delete(atomToUpdate)
          if (dependents.size === 0) {
            dependentsMap.delete(dependency)
          }
        }
      }
    }

    dependenciesMap.set(atomToUpdate, dependencies)
    for (const dependency of dependencies) {
      if (!dependentsMap.has(dependency)) {
        dependentsMap.set(dependency, new Set())
      }
      dependentsMap.get(dependency).add(atomToUpdate)
    }
  }

  const readAtom = (anAtom) => {
    if (anAtom.read) {
      const dependencies = new Set()
      const value = anAtom.read((dependency) => {
        dependencies.add(dependency)
        return readAtom(dependency)
      })
      updateDependencies(anAtom, dependencies)
      return value
    }

    ensurePrimitive(anAtom)
    return values.get(anAtom)
  }

  const notify = (anAtom) => {
    const subs = listeners.get(anAtom)
    if (subs) {
      for (const callback of Array.from(subs)) {
        callback()
      }
    }

    const dependents = dependentsMap.get(anAtom)
    if (dependents) {
      for (const dependent of Array.from(dependents)) {
        notify(dependent)
      }
    }
  }

  const writeAtom = (anAtom, update) => {
    if (anAtom.write) {
      return anAtom.write(readAtom, writeAtom, update)
    }

    ensurePrimitive(anAtom)
    const prev = values.get(anAtom)
    const next = isFunction(update) ? update(prev) : update
    values.set(anAtom, next)
    if (!Object.is(prev, next)) {
      notify(anAtom)
    }
    return next
  }

  const store = {
    get: readAtom,
    set: writeAtom,
    subscribe: (anAtom, callback) => {
      const mounted = listeners.get(anAtom)
      if (!mounted) {
        listeners.set(anAtom, new Set())
        if (isFunction(anAtom.onMount)) {
          const cleanup = anAtom.onMount((update) => writeAtom(anAtom, update))
          if (cleanup) {
            mountEffects.set(anAtom, cleanup)
          }
        }
      }

      listeners.get(anAtom).add(callback)

      return () => {
        const subs = listeners.get(anAtom)
        if (!subs) return
        subs.delete(callback)
        if (subs.size === 0) {
          listeners.delete(anAtom)
          const cleanup = mountEffects.get(anAtom)
          if (cleanup) {
            cleanup()
            mountEffects.delete(anAtom)
          }
        }
      }
    },
  }

  return store
}

const StoreContext = createContext(null)
let defaultStore

export const Provider = ({ store, children }) => {
  const storeRef = useRef(store)
  if (!storeRef.current) {
    storeRef.current = store ?? createStore()
  }

  const value = store ?? storeRef.current

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export const useStore = () => {
  const contextStore = useContext(StoreContext)
  if (contextStore) {
    return contextStore
  }

  if (!defaultStore) {
    defaultStore = createStore()
  }

  return defaultStore
}

export const useAtomValue = (anAtom, store = useStore()) => {
  const subscribe = useCallback((callback) => store.subscribe(anAtom, callback), [store, anAtom])
  const getSnapshot = useCallback(() => store.get(anAtom), [store, anAtom])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export const useSetAtom = (anAtom, store = useStore()) => {
  return useCallback((update) => store.set(anAtom, update), [store, anAtom])
}

export const useAtom = (anAtom) => {
  const store = useStore()
  const value = useAtomValue(anAtom, store)
  const setter = useSetAtom(anAtom, store)
  return useMemo(() => [value, setter], [value, setter])
}

export default {
  atom,
  Provider,
  createStore,
  useAtom,
  useAtomValue,
  useSetAtom,
  useStore,
}
