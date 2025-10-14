import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import urlBase64ToUint8Array from './urlBase64ToUint8Array'

const INITIAL_STATE = {
  isSupported: false,
  permission: typeof window !== 'undefined' && window.Notification
    ? window.Notification.permission
    : 'default',
  isSubscribed: false,
  isProcessing: false,
  error: null,
}

const resolveApplicationServerKey = () => {
  if (typeof process === 'undefined') {
    return null
  }

  return (
    process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ||
    process.env.WEB_PUSH_PUBLIC_KEY ||
    null
  )
}

const usePwaNotifications = ({ location, session }) => {
  const [state, setState] = useState(() => ({ ...INITIAL_STATE }))
  const abortControllerRef = useRef(null)

  const applicationServerKey = useMemo(() => resolveApplicationServerKey(), [])

  const isClient = typeof window !== 'undefined'
  const isSupported =
    isClient &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window

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

      updateState({
        isSupported,
        isSubscribed: Boolean(subscription),
        permission: window.Notification.permission,
      })
    } catch (error) {
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

    if (!applicationServerKey) {
      updateState({ error: 'Публичный ключ для уведомлений не настроен.' })
      return { success: false }
    }

    updateState({ isProcessing: true, error: null })

    try {
      const permission = await Notification.requestPermission()

      if (permission !== 'granted') {
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

      if (!response.ok) {
        await subscription.unsubscribe().catch(() => null)
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Не удалось сохранить подписку на уведомления')
      }

      updateState({
        isProcessing: false,
        isSubscribed: true,
        permission: Notification.permission,
        error: null,
      })

      return { success: true }
    } catch (error) {
      console.error('Subscribe push error', error)
      updateState({
        isProcessing: false,
        isSubscribed: false,
        permission: Notification.permission,
        error: error?.message || 'Не удалось включить push-уведомления',
      })
      return { success: false, error }
    } finally {
      abortControllerRef.current = null
    }
  }, [applicationServerKey, isSupported, location, session, updateState])

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

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Не удалось удалить подписку на уведомления')
      }

      await subscription.unsubscribe().catch(() => null)

      updateState({
        isProcessing: false,
        isSubscribed: false,
        permission: Notification.permission,
      })

      return { success: true }
    } catch (error) {
      console.error('Unsubscribe push error', error)
      updateState({
        isProcessing: false,
        error: error?.message || 'Не удалось отключить push-уведомления',
      })
      return { success: false, error }
    } finally {
      abortControllerRef.current = null
    }
  }, [isSupported, location, updateState])

  return {
    ...state,
    isConfigured: Boolean(applicationServerKey),
    canControl: Boolean(isSupported && session),
    subscribe,
    unsubscribe,
  }
}

export default usePwaNotifications
