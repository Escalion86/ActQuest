import { useCallback, useEffect, useRef, useState } from 'react'

import urlBase64ToUint8Array from './urlBase64ToUint8Array'

const DEBUG_STORAGE_KEY = 'aq-push-debug'
const DEBUG_NAMESPACE = '[push-debug]'

const INITIAL_STATE = {
  isSupported: false,
  permission: typeof window !== 'undefined' && window.Notification
    ? window.Notification.permission
    : 'default',
  isSubscribed: false,
  isProcessing: false,
  error: null,
}

const resolveDebugPreference = () => {
  if (typeof window === 'undefined') {
    return false
  }

  const debugApi = window.__aqPushDebug

  if (debugApi && typeof debugApi.enabled === 'boolean') {
    return debugApi.enabled
  }

  try {
    const stored = window.localStorage?.getItem(DEBUG_STORAGE_KEY)

    if (stored === '1' || stored === 'true') {
      return true
    }

    if (stored === '0' || stored === 'false') {
      return false
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`${DEBUG_NAMESPACE} Не удалось прочитать настройку из localStorage`, error)
  }

  return false
}

const createDebugLogger = () => {
  const getEnabled = () => {
    if (typeof window === 'undefined') {
      return false
    }

    const debugApi = window.__aqPushDebug

    if (debugApi && typeof debugApi.enabled === 'boolean') {
      return debugApi.enabled
    }

    return resolveDebugPreference()
  }

  return (...args) => {
    if (!getEnabled()) {
      return
    }

    const now = new Date().toISOString()
    // eslint-disable-next-line no-console
    console.debug(DEBUG_NAMESPACE, now, ...args)
  }
}

const resolveApplicationServerKey = () => {
  if (typeof process === 'undefined') {
    return null
  }

  const fromEnv = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY || null

  if (typeof fromEnv !== 'string') {
    return null
  }

  const trimmed = fromEnv.trim()

  return trimmed.length > 0 ? trimmed : null
}

const usePwaNotifications = ({ location, session }) => {
  const initialApplicationServerKey = resolveApplicationServerKey()

  const [state, setState] = useState(() => ({ ...INITIAL_STATE }))
  const [applicationServerKey, setApplicationServerKey] = useState(
    initialApplicationServerKey
  )
  const [configStatus, setConfigStatus] = useState('loading')
  const [configError, setConfigError] = useState(null)
  const [isServerConfigured, setIsServerConfigured] = useState(
    Boolean(initialApplicationServerKey)
  )
  const abortControllerRef = useRef(null)
  const debugNoticeShownRef = useRef(false)

  const isClient = typeof window !== 'undefined'
  const isSupported =
    isClient &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window

  const debugLogRef = useRef(createDebugLogger())

  const updateState = useCallback((patch) => {
    setState((prev) => ({ ...prev, ...patch }))
  }, [])

  const syncSubscriptionState = useCallback(async () => {
    if (!isSupported || !session) {
      updateState({
        isSupported,
        isSubscribed: false,
        permission: isClient && window.Notification ? window.Notification.permission : 'default',
      })
      return
    }

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      const nextState = {
        isSupported,
        isSubscribed: Boolean(subscription),
        permission: window.Notification.permission,
      }

      debugLogRef.current('syncSubscriptionState:success', nextState)

      updateState(nextState)
    } catch (error) {
      debugLogRef.current('syncSubscriptionState:error', {
        message: error?.message,
      })
      updateState({
        isSupported,
        isSubscribed: false,
        permission: window.Notification.permission,
        error: error?.message || 'Не удалось определить состояние уведомлений',
      })
    }
  }, [isSupported, isClient, session, updateState])

  useEffect(() => {
    updateState({ isSupported })
  }, [isSupported, updateState])

  useEffect(() => {
    if (typeof window !== 'undefined' && !debugNoticeShownRef.current) {
      debugNoticeShownRef.current = true
      debugLogRef.current('init', { mode: process.env.MODE ?? process.env.NODE_ENV })

      if (!window.__aqPushDebug?.suppressIntro) {
        const introMessage =
          'ActQuest push debug: вызовите window.__aqPushDebug.logSnapshot(), чтобы получить текущее состояние уведомлений. ' +
          'Используйте window.__aqPushDebug.enable(true), чтобы включить подробные логи.'
        // eslint-disable-next-line no-console
        console.info(introMessage)
      }
    }
  }, [])

  useEffect(() => {
    if (!isClient) {
      return
    }

    if (configStatus !== 'loading') {
      return
    }

    let isActive = true
    const controller = new AbortController()

    const loadConfig = async () => {
      try {
        const response = await fetch('/api/webapp/push/config', {
          signal: controller.signal,
        })

        if (!response.ok) {
          const data = await response.json().catch(() => null)
          throw new Error(data?.error || 'Не удалось загрузить настройки уведомлений')
        }

        const data = await response.json()

        if (!isActive) {
          return
        }

        setApplicationServerKey(data?.publicKey || null)
        const resolvedConfigured =
          typeof data?.isConfigured === 'boolean'
            ? data.isConfigured
            : Boolean(data?.publicKey)
        setIsServerConfigured(resolvedConfigured)
        setConfigStatus('success')
        setConfigError(null)

        debugLogRef.current('config:success', {
          isConfigured: resolvedConfigured,
          hasPublicKey: Boolean(data?.publicKey),
        })
      } catch (error) {
        if (!isActive || controller.signal.aborted) {
          return
        }

        console.error('Push config load error', error)
        setConfigStatus('error')
        setConfigError(error?.message || 'Не удалось проверить настройки уведомлений')
        debugLogRef.current('config:error', {
          message: error?.message,
        })
      }
    }

    loadConfig()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [configStatus, isClient])

  useEffect(() => {
    syncSubscriptionState()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [location, session, syncSubscriptionState])

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      updateState({ error: 'Ваш браузер не поддерживает push-уведомления.' })
      return { success: false }
    }

    if (!session) {
      updateState({ error: 'Авторизуйтесь через Telegram, чтобы включить уведомления.' })
      return { success: false }
    }

    if (configStatus === 'loading') {
      updateState({ error: 'Проверяем настройки уведомлений. Попробуйте ещё раз чуть позже.' })
      return { success: false }
    }

    if (!applicationServerKey) {
      updateState({ error: 'Публичный ключ для уведомлений не настроен.' })
      return { success: false }
    }

    debugLogRef.current('subscribe:start', {
      location,
      permission: Notification.permission,
    })

    updateState({ isProcessing: true, error: null })

    try {
      const permission = await Notification.requestPermission()

      if (permission !== 'granted') {
        debugLogRef.current('subscribe:permission-denied', {
          permission,
        })
        updateState({
          isProcessing: false,
          permission,
          isSubscribed: false,
          error:
            permission === 'denied'
              ? 'Уведомления запрещены в настройках браузера.'
              : 'Разрешите показ уведомлений, чтобы получать оповещения.',
        })
        return { success: false }
      }

      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(applicationServerKey),
        })
      }

      const payload = {
        location,
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent,
      }

      abortControllerRef.current = new AbortController()

      const response = await fetch('/api/webapp/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: abortControllerRef.current.signal,
      })

      const data = await response.json().catch(() => null)

      if (!response.ok || data?.success === false) {
        await subscription.unsubscribe().catch(() => null)
        throw new Error(data?.error || 'Не удалось сохранить подписку на уведомления')
      }

      updateState({
        isSubscribed: true,
        permission: Notification.permission,
        error: null,
      })

      debugLogRef.current('subscribe:success', {
        endpoint: subscription.endpoint,
        permission: Notification.permission,
        serverResponse: data,
      })

      return { success: true }
    } catch (error) {
      console.error('Subscribe push error', error)
      updateState({
        isSubscribed: false,
        permission: Notification.permission,
        error: error?.message || 'Не удалось включить push-уведомления',
      })
      debugLogRef.current('subscribe:error', {
        message: error?.message,
      })
      return { success: false, error }
    } finally {
      abortControllerRef.current = null
      updateState({ isProcessing: false })

      try {
        await syncSubscriptionState()
      } catch (syncError) {
        console.error('Sync after subscribe failed', syncError)
        debugLogRef.current('subscribe:sync-error', {
          message: syncError?.message,
        })
      }

      debugLogRef.current('subscribe:finished', {
        permission: Notification.permission,
      })
    }
  }, [
    applicationServerKey,
    isSupported,
    location,
    session,
    syncSubscriptionState,
    updateState,
  ])

  const unsubscribe = useCallback(async () => {
    if (!isSupported) {
      updateState({ error: 'Уведомления не поддерживаются этим браузером.' })
      return { success: false }
    }

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        updateState({ isSubscribed: false })
        return { success: true }
      }

      debugLogRef.current('unsubscribe:start', {
        endpoint: subscription.endpoint,
      })

      updateState({ isProcessing: true, error: null })

      const endpoint = subscription.endpoint

      abortControllerRef.current = new AbortController()

      const response = await fetch('/api/webapp/push/subscribe', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ location, endpoint }),
        signal: abortControllerRef.current.signal,
      })

      const data = await response.json().catch(() => null)

      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || 'Не удалось удалить подписку на уведомления')
      }

      await subscription.unsubscribe().catch(() => null)

      updateState({
        isSubscribed: false,
        permission: Notification.permission,
      })

      debugLogRef.current('unsubscribe:success', {
        endpoint,
        permission: Notification.permission,
      })

      return { success: true }
    } catch (error) {
      console.error('Unsubscribe push error', error)
      updateState({
        error: error?.message || 'Не удалось отключить push-уведомления',
      })
      debugLogRef.current('unsubscribe:error', {
        message: error?.message,
      })
      return { success: false, error }
    } finally {
      abortControllerRef.current = null
      updateState({ isProcessing: false })

      try {
        await syncSubscriptionState()
      } catch (syncError) {
        console.error('Sync after unsubscribe failed', syncError)
      }
    }
  }, [isSupported, location, syncSubscriptionState, updateState])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const snapshot = {
      state: {
        isSupported: state.isSupported,
        permission: state.permission,
        isSubscribed: state.isSubscribed,
        isProcessing: state.isProcessing,
        error: state.error,
      },
      configStatus,
      configError,
      isServerConfigured,
      hasApplicationServerKey: Boolean(applicationServerKey),
      location,
      sessionTelegramId: session?.user?.telegramId ?? null,
      abortControllerPending: Boolean(abortControllerRef.current),
    }

    const previous = window.__aqPushDebug || {}

    const api = {
      ...previous,
      enabled:
        typeof previous.enabled === 'boolean'
          ? previous.enabled
          : resolveDebugPreference(),
      enable(value = true) {
        this.enabled = Boolean(value)
        try {
          if (this.enabled) {
            window.localStorage?.setItem(DEBUG_STORAGE_KEY, '1')
          } else {
            window.localStorage?.setItem(DEBUG_STORAGE_KEY, '0')
          }
        } catch (error) {
          console.warn(`${DEBUG_NAMESPACE} Не удалось сохранить настройку`, error)
        }
        const status = this.enabled ? 'включены' : 'отключены'
        console.info(`${DEBUG_NAMESPACE} Подробные логи ${status}`)
        return this.enabled
      },
      disable() {
        return this.enable(false)
      },
      toggle() {
        return this.enable(!this.enabled)
      },
      getSnapshot() {
        return {
          ...snapshot,
          state: { ...snapshot.state },
        }
      },
      logSnapshot() {
        const nextSnapshot = this.getSnapshot()
        console.groupCollapsed(`${DEBUG_NAMESPACE} snapshot`, new Date().toISOString())
        console.table(nextSnapshot.state)
        console.log({
          configStatus: nextSnapshot.configStatus,
          configError: nextSnapshot.configError,
          isServerConfigured: nextSnapshot.isServerConfigured,
          hasApplicationServerKey: nextSnapshot.hasApplicationServerKey,
          location: nextSnapshot.location,
          sessionTelegramId: nextSnapshot.sessionTelegramId,
          abortControllerPending: nextSnapshot.abortControllerPending,
        })
        console.groupEnd()
        return nextSnapshot
      },
      abortPending() {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
          return true
        }
        return false
      },
    }

    window.__aqPushDebug = api
    debugLogRef.current = createDebugLogger()
  }, [
    applicationServerKey,
    configError,
    configStatus,
    isServerConfigured,
    location,
    session,
    state,
  ])

  return {
    ...state,
    isConfigured:
      configStatus === 'success'
        ? Boolean(isServerConfigured)
        : Boolean(applicationServerKey),
    configStatus,
    configError,
    canControl: Boolean(isSupported && session),
    subscribe,
    unsubscribe,
  }
}

export default usePwaNotifications
