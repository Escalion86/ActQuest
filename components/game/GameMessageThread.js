'use client'

import PropTypes from 'prop-types'

import LinkedMessageText from '@components/game/LinkedMessageText'

export const formatGameMessageDateTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const getSenderLabel = (message) => {
  if (message.direction === 'admin_to_team') return 'Организатор'
  return message.createdByRole === 'liaison'
    ? 'Связной команды'
    : 'Капитан команды'
}

const getReadStatusText = ({ message, viewer }) => {
  const isAdminMessage = message.direction === 'admin_to_team'

  if (viewer === 'team') {
    if (isAdminMessage) {
      return message.userReadAt
        ? `Просмотрено вами: ${formatGameMessageDateTime(message.userReadAt)}`
        : 'Вы еще не просмотрели'
    }

    return message.readByAdminAt
      ? `Прочитано администратором: ${formatGameMessageDateTime(message.readByAdminAt)}`
      : 'Администратор еще не прочитал'
  }

  if (isAdminMessage) {
    return message.teamReadAt
      ? `Прочитано командой: ${formatGameMessageDateTime(message.teamReadAt)}`
      : 'Команда еще не прочитала'
  }

  return message.readByAdminAt
    ? `Прочитано администратором: ${formatGameMessageDateTime(message.readByAdminAt)}`
    : 'Не прочитано администратором'
}

export const GameMessageHistory = ({
  messages,
  isLoading,
  error,
  errorContent,
  listRef,
  viewer,
  emptyText,
  loadingText,
  showPushDelivery,
}) => (
  <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
    {errorContent}
    {error ? (
      <p className="px-3 py-2 text-sm border rounded-xl border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
        {error}
      </p>
    ) : null}
    {isLoading && messages.length === 0 ? (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {loadingText}
      </p>
    ) : null}
    {!isLoading && messages.length === 0 ? (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {emptyText}
      </p>
    ) : null}
    {messages.map((message) => {
      const isAdminMessage = message.direction === 'admin_to_team'
      return (
        <div
          key={message.id}
          className={`rounded-2xl border px-4 py-3 ${
            isAdminMessage
              ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-50'
              : 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-50'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs opacity-80">
            <span>
              {getSenderLabel(message)}
              {message.scope === 'game' ? ' · всем командам' : ''}
            </span>
            <span>{formatGameMessageDateTime(message.createdAt)}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap">
            <LinkedMessageText text={message.body} />
          </p>
          {showPushDelivery && isAdminMessage && message.pushRequested ? (
            <p className="mt-2 text-xs opacity-80">
              Push: доставлено {message.pushDelivered || 0} из{' '}
              {message.pushUsersMatched || 0}
            </p>
          ) : null}
          <p className="mt-2 text-xs opacity-80">
            {getReadStatusText({ message, viewer })}
          </p>
        </div>
      )
    })}
  </div>
)

GameMessageHistory.propTypes = {
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      body: PropTypes.string,
      createdAt: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      createdByRole: PropTypes.string,
      direction: PropTypes.string,
      pushDelivered: PropTypes.number,
      pushRequested: PropTypes.bool,
      pushUsersMatched: PropTypes.number,
      readByAdminAt: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      scope: PropTypes.string,
      teamReadAt: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      userReadAt: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }),
  ).isRequired,
  isLoading: PropTypes.bool,
  error: PropTypes.string,
  errorContent: PropTypes.node,
  listRef: PropTypes.shape({ current: PropTypes.any }),
  viewer: PropTypes.oneOf(['admin', 'team']),
  emptyText: PropTypes.string,
  loadingText: PropTypes.string,
  showPushDelivery: PropTypes.bool,
}

GameMessageHistory.defaultProps = {
  isLoading: false,
  error: '',
  errorContent: null,
  listRef: undefined,
  viewer: 'admin',
  emptyText: 'Сообщений пока нет.',
  loadingText: 'Загружаем сообщения...',
  showPushDelivery: false,
}

export const GameMessageComposer = ({
  textareaId,
  textareaRef,
  value,
  onChange,
  disabled,
  label,
  placeholder,
  sendPush,
  onSendPushChange,
  pushDisabled,
}) => (
  <div className="shrink-0 pt-4 border-t border-slate-200 dark:border-slate-700">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label
        htmlFor={textareaId}
        className="text-xs font-semibold text-slate-500 dark:text-slate-400"
      >
        {label}
      </label>
      {onSendPushChange ? (
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={sendPush}
            onChange={(event) => onSendPushChange(event.target.checked)}
            disabled={pushDisabled}
            className="rounded border-slate-400 text-cyan-600 focus:ring-cyan-500/40"
          />
          Дополнительно отправить push-уведомление
        </label>
      ) : null}
    </div>
    <textarea
      id={textareaId}
      ref={textareaRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={1}
      className="w-full px-3 py-2 mt-2 overflow-hidden text-sm transition bg-white border outline-none resize-none rounded-xl border-slate-300 text-slate-900 focus:border-cyan-500 dark:border-slate-600/80 dark:bg-slate-900 dark:text-slate-100"
      disabled={disabled}
    />
  </div>
)

GameMessageComposer.propTypes = {
  textareaId: PropTypes.string.isRequired,
  textareaRef: PropTypes.shape({ current: PropTypes.any }),
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  label: PropTypes.string,
  placeholder: PropTypes.string,
  sendPush: PropTypes.bool,
  onSendPushChange: PropTypes.func,
  pushDisabled: PropTypes.bool,
}

GameMessageComposer.defaultProps = {
  textareaRef: undefined,
  disabled: false,
  label: 'Текст сообщения',
  placeholder: 'Введите сообщение...',
  sendPush: false,
  onSendPushChange: undefined,
  pushDisabled: false,
}
