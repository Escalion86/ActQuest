import PropTypes from 'prop-types'

const formatDate = (value) => {
  if (!value) return ''

  try {
    return new Date(value).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (error) {
    return value
  }
}

const NotificationsCard = ({
  notifications,
  hasUnread,
  isExpanded,
  onToggle,
  onRefresh,
  onMarkAllRead,
  isLoading,
  error,
  pushState,
}) => {
  const {
    isSupported,
    isSubscribed,
    isProcessing,
    permission,
    error: pushError,
    subscribe,
    unsubscribe,
    canControl,
    isConfigured,
  } = pushState || {}

  const renderPushStatus = () => {
    if (!isSupported) {
      return 'Ваш браузер не поддерживает push-уведомления. Используйте последнюю версию Chrome, Safari или Firefox.'
    }

    if (!isConfigured) {
      return 'Push-уведомления выключены на стороне сервера. Укажите переменные окружения WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY и WEB_PUSH_CONTACT, затем перезапустите сервер.'
    }

    if (!canControl) {
      return 'Войдите через Telegram, чтобы управлять push-уведомлениями.'
    }

    if (permission === 'denied') {
      return 'Уведомления заблокированы в настройках браузера. Разрешите их вручную, чтобы получать сообщения.'
    }

    if (isSubscribed) {
      return 'Push-уведомления включены. Вы будете получать сообщения от ActQuest даже при закрытом приложении.'
    }

    if (permission === 'default') {
      return 'Разрешите показ уведомлений, чтобы получать важные сообщения от ActQuest.'
    }

    return 'Push-уведомления сейчас отключены.'
  }

  const handleSubscriptionToggle = async () => {
    if (!pushState || !canControl || !isSupported || !isConfigured) {
      return
    }

    if (isSubscribed) {
      await unsubscribe()
    } else {
      const result = await subscribe()
      if (result?.success) {
        onRefresh()
      }
    }
  }

  const subscriptionButtonLabel = isSubscribed
    ? 'Отключить уведомления'
    : 'Включить уведомления'

  const subscriptionButtonDisabled =
    !pushState ||
    !isSupported ||
    !isConfigured ||
    !canControl ||
    permission === 'denied' ||
    isProcessing

  return (
    <section className="p-6 bg-white shadow-lg rounded-3xl dark:bg-slate-900 dark:border dark:border-slate-800 dark:shadow-slate-950/40">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h4 className="text-lg font-semibold text-primary dark:text-white">
              Уведомления
            </h4>
            {hasUnread ? (
              <span className="inline-flex items-center px-3 py-1 text-xs font-semibold text-white bg-red-500 rounded-full">
                Новые
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-slate-300">
            {renderPushStatus()}
          </p>
          {pushError ? (
            <p className="mt-2 text-sm text-red-600 dark:text-red-300">
              {pushError}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col flex-none gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleSubscriptionToggle}
            className="px-4 py-2 text-sm font-semibold transition rounded-full border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-500/30 dark:text-blue-200 dark:bg-blue-500/10 dark:hover:bg-blue-500/20"
            disabled={subscriptionButtonDisabled}
          >
            {isProcessing ? 'Обработка…' : subscriptionButtonLabel}
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="px-4 py-2 text-sm font-semibold transition rounded-full border border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
          >
            {isExpanded ? 'Скрыть список' : 'Показать список'}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="px-4 py-2 text-sm font-semibold transition rounded-full border border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
            disabled={isLoading}
          >
            Обновить
          </button>
          <button
            type="button"
            onClick={onMarkAllRead}
            className="px-4 py-2 text-sm font-semibold transition rounded-full border border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
            disabled={isLoading || !notifications?.some((item) => !item.readAt)}
          >
            Прочитано
          </button>
        </div>
      </div>

      {error ? (
        <div className="px-4 py-3 mt-4 text-sm text-red-600 rounded-2xl bg-red-50 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {isExpanded ? (
        <div className="mt-5">
          {isLoading ? (
            <div className="flex items-center justify-center px-4 py-6 text-sm text-gray-500 border border-dashed rounded-2xl border-gray-300 dark:border-slate-700 dark:text-slate-300">
              Загрузка уведомлений…
            </div>
          ) : notifications?.length ? (
            <ul className="flex flex-col gap-3">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={`p-4 border rounded-2xl transition-colors ${
                    notification.readAt
                      ? 'border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                      : 'border-blue-200 bg-blue-50 dark:border-blue-400/40 dark:bg-blue-500/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h5 className="text-base font-semibold text-gray-800 dark:text-slate-100">
                        {notification.title || 'Уведомление'}
                      </h5>
                      <p className="mt-1 text-sm leading-relaxed text-gray-600 whitespace-pre-line dark:text-slate-300">
                        {notification.body}
                      </p>
                    </div>
                    <span className="flex-none text-xs font-medium text-gray-500 dark:text-slate-400">
                      {formatDate(notification.createdAt)}
                    </span>
                  </div>
                  {notification.data?.url ? (
                    <a
                      href={notification.data.url}
                      className="inline-flex items-center gap-2 mt-3 text-sm font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                    >
                      Открыть
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        className="w-4 h-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17.25 6.75 21 3m0 0h-5.25M21 3v5.25M3 21l6.75-6.75m0 0L3 7.5m6.75 6.75H3"
                        />
                      </svg>
                    </a>
                  ) : null}
                  {!notification.readAt ? (
                    <span className="inline-flex px-2 py-1 mt-3 text-xs font-semibold text-blue-700 bg-blue-100 rounded-full dark:bg-blue-500/20 dark:text-blue-200">
                      Не прочитано
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center justify-center px-4 py-6 text-sm text-gray-500 border border-dashed rounded-2xl border-gray-300 dark:border-slate-700 dark:text-slate-300">
              Уведомлений пока нет.
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}

NotificationsCard.propTypes = {
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string,
      body: PropTypes.string,
      data: PropTypes.object,
      readAt: PropTypes.string,
      createdAt: PropTypes.string,
    })
  ),
  hasUnread: PropTypes.bool,
  isExpanded: PropTypes.bool,
  onToggle: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired,
  onMarkAllRead: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  error: PropTypes.string,
  pushState: PropTypes.shape({
    isSupported: PropTypes.bool,
    isSubscribed: PropTypes.bool,
    isProcessing: PropTypes.bool,
    permission: PropTypes.string,
    error: PropTypes.string,
    subscribe: PropTypes.func,
    unsubscribe: PropTypes.func,
    canControl: PropTypes.bool,
    isConfigured: PropTypes.bool,
  }),
}

NotificationsCard.defaultProps = {
  notifications: [],
  hasUnread: false,
  isExpanded: false,
  isLoading: false,
  error: null,
  pushState: {
    isSupported: false,
    isSubscribed: false,
    isProcessing: false,
    permission: 'default',
    error: null,
    subscribe: () => {},
    unsubscribe: () => {},
    canControl: false,
    isConfigured: false,
  },
}

export default NotificationsCard
