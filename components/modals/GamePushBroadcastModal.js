'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import Modal from '@components/Modal'
import CabinetButton from '@components/cabinet/CabinetButton'
import LinkedMessageText from '@components/game/LinkedMessageText'
import NoticeBanner from '@components/NoticeBanner'
import requestApiJson from '@helpers/requestApiJson'
import extractErrorMessage from '@helpers/extractErrorMessage'

const GAME_WIDE_DIALOG_ID = '__game__'

const formatMessageDateTime = (value) => {
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

const adjustChatTextareaHeight = (textarea) => {
  if (!textarea || typeof window === 'undefined') return

  textarea.style.height = 'auto'
  const styles = window.getComputedStyle(textarea)
  const lineHeight = Number.parseFloat(styles.lineHeight) || 20
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0
  const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0
  const maxHeight = lineHeight * 5 + paddingTop + paddingBottom
  const nextHeight = Math.min(textarea.scrollHeight, maxHeight)
  textarea.style.height = `${nextHeight}px`
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
}

const fetchDialogs = async (gameId) => {
  const { json } = await requestApiJson(
    `/api/cabinet/games/${encodeURIComponent(gameId)}/messages/dialogs`,
  )
  if (!json?.success) {
    throw new Error(json?.error || 'Не удалось загрузить диалоги команд.')
  }
  return Array.isArray(json?.data?.dialogs) ? json.data.dialogs : []
}

const fetchMessages = async ({ gameId, teamId }) => {
  const params = new URLSearchParams()
  if (teamId && teamId !== GAME_WIDE_DIALOG_ID) {
    params.set('teamId', teamId)
  }
  const suffix = params.toString() ? `?${params.toString()}` : ''
  const { json } = await requestApiJson(
    `/api/cabinet/games/${encodeURIComponent(gameId)}/messages${suffix}`,
  )
  if (!json?.success) {
    throw new Error(json?.error || 'Не удалось загрузить переписку.')
  }
  return Array.isArray(json?.data?.messages) ? json.data.messages : []
}

const sendMessage = async ({ gameId, teamId, body, sendPush }) => {
  const isGameWide = teamId === GAME_WIDE_DIALOG_ID
  const { json } = await requestApiJson(
    `/api/cabinet/games/${encodeURIComponent(gameId)}/messages`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        scope: isGameWide ? 'game' : 'team',
        ...(isGameWide ? {} : { teamId }),
        body,
        sendPush,
      }),
    },
  )
  if (!json?.success) {
    throw new Error(json?.error || 'Не удалось отправить сообщение.')
  }
  return json?.data?.message || null
}

const sendGameAnnouncementPush = async ({ gameId }) => {
  const { json } = await requestApiJson(
    `/api/cabinet/games/${encodeURIComponent(gameId)}/push-broadcast`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mode: 'announce_all_users' }),
      fallbackMessage: 'Не удалось отправить анонс игры',
    },
  )

  return {
    usersMatched: Number(json?.data?.usersMatched) || 0,
    notificationsCreated: Number(json?.data?.notificationsCreated) || 0,
    pushDelivered: Number(json?.data?.pushDelivered) || 0,
  }
}

const GamePushBroadcastModal = ({
  isOpen,
  onClose,
  gameId,
  gameName,
  gameStatus,
  onFeedback,
}) => {
  const queryClient = useQueryClient()
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [sendPush, setSendPush] = useState(false)
  const [localError, setLocalError] = useState('')
  const historyListRef = useRef(null)
  const textareaRef = useRef(null)

  const dialogsQueryKey = useMemo(
    () => ['game-team-dialogs', gameId || ''],
    [gameId],
  )
  const messagesQueryKey = useMemo(
    () => ['game-team-messages', gameId || '', selectedTeamId || ''],
    [gameId, selectedTeamId],
  )

  const dialogsQuery = useQuery({
    queryKey: dialogsQueryKey,
    queryFn: () => fetchDialogs(gameId),
    enabled: Boolean(isOpen && gameId),
    refetchInterval: isOpen && !selectedTeamId ? 15000 : false,
  })

  const selectedDialog = useMemo(
    () =>
      selectedTeamId === GAME_WIDE_DIALOG_ID
        ? null
        : (dialogsQuery.data || []).find(
            (dialog) => dialog.teamId === selectedTeamId,
          ) || null,
    [dialogsQuery.data, selectedTeamId],
  )

  const messagesQuery = useQuery({
    queryKey: messagesQueryKey,
    queryFn: () => fetchMessages({ gameId, teamId: selectedTeamId }),
    enabled: Boolean(isOpen && gameId && selectedTeamId),
    refetchInterval: isOpen && selectedTeamId ? 15000 : false,
  })

  const sendMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: (createdMessage) => {
      const usersMatched = Number(createdMessage?.pushUsersMatched || 0)
      const pushDelivered = Number(createdMessage?.pushDelivered || 0)
      const feedbackMessage = sendPush
        ? `Сообщение сохранено, push: получателей ${usersMatched}, доставлено ${pushDelivered}.`
        : 'Сообщение сохранено в переписке.'

      setMessageBody('')
      setSendPush(false)
      setLocalError('')
      onFeedback?.({ type: 'success', message: feedbackMessage })
      void queryClient.invalidateQueries({ queryKey: dialogsQueryKey })
      void queryClient.invalidateQueries({ queryKey: messagesQueryKey })
    },
    onError: (error) => {
      const message = extractErrorMessage(error) || 'Не удалось отправить сообщение.'
      setLocalError(message)
      onFeedback?.({ type: 'error', message })
    },
  })

  const announcementMutation = useMutation({
    mutationFn: sendGameAnnouncementPush,
    onSuccess: ({ usersMatched, notificationsCreated, pushDelivered }) => {
      const message = `Анонс отправлен: получателей ${usersMatched}, уведомлений ${notificationsCreated}, push доставлено ${pushDelivered}.`
      setLocalError('')
      onFeedback?.({ type: 'success', message })
    },
    onError: (error) => {
      const message = extractErrorMessage(error) || 'Не удалось отправить анонс игры.'
      setLocalError(message)
      onFeedback?.({ type: 'error', message })
    },
  })

  useEffect(() => {
    if (isOpen) return
    setSelectedTeamId('')
    setMessageBody('')
    setSendPush(false)
    setLocalError('')
  }, [isOpen])

  useEffect(() => {
    if (!selectedTeamId) return undefined
    const frameId = window.requestAnimationFrame(() => {
      const list = historyListRef.current
      if (list) list.scrollTop = list.scrollHeight
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [selectedTeamId, messagesQuery.data?.length])

  useEffect(() => {
    if (!selectedTeamId) return undefined
    const frameId = window.requestAnimationFrame(() => {
      adjustChatTextareaHeight(textareaRef.current)
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [selectedTeamId, messageBody])

  const closeChat = useCallback(() => {
    setSelectedTeamId('')
    setMessageBody('')
    setSendPush(false)
    setLocalError('')
    void queryClient.invalidateQueries({ queryKey: dialogsQueryKey })
  }, [dialogsQueryKey, queryClient])

  const handleMessageChange = useCallback((event) => {
    setMessageBody(event.target.value)
    adjustChatTextareaHeight(event.target)
  }, [])

  const handleSubmit = useCallback(() => {
    const body = messageBody.trim()
    if (!body) {
      setLocalError('Введите сообщение.')
      return
    }
    if (!gameId || !selectedTeamId) {
      setLocalError('Не удалось определить получателя.')
      return
    }
    sendMutation.mutate({
      gameId,
      teamId: selectedTeamId,
      body,
      sendPush,
    })
  }, [gameId, messageBody, selectedTeamId, sendMutation, sendPush])

  const handleSendAnnouncement = useCallback(() => {
    if (!gameId) {
      const message = 'Игра для отправки анонса не найдена.'
      setLocalError(message)
      onFeedback?.({ type: 'error', message })
      return
    }

    announcementMutation.mutate({ gameId })
  }, [announcementMutation, gameId, onFeedback])

  const dialogs = dialogsQuery.data || []
  const messages = messagesQuery.data || []
  const isChatOpen = Boolean(selectedTeamId)
  const canSendAnnouncement = String(gameStatus || '').toLowerCase() === 'active'
  const modalTitle = isChatOpen
    ? selectedTeamId === GAME_WIDE_DIALOG_ID
      ? 'Сообщение всем командам'
      : selectedDialog?.teamName
        ? `Сообщение команде - ${selectedDialog.teamName}`
        : 'Сообщение команде'
    : `Переписка по игре «${gameName || 'Без названия'}»`

  const footer = isChatOpen ? (
    <>
      <CabinetButton
        type="button"
        variant="secondary"
        tone="brand"
        onClick={closeChat}
        disabled={sendMutation.isPending}
      >
        К списку
      </CabinetButton>
      <CabinetButton
        type="button"
        variant="primary"
        onClick={handleSubmit}
        disabled={sendMutation.isPending || !messageBody.trim()}
        className={sendMutation.isPending ? 'cursor-wait' : ''}
      >
        {sendMutation.isPending ? 'Отправляем...' : 'Отправить'}
      </CabinetButton>
    </>
  ) : (
    <CabinetButton type="button" variant="secondary" tone="brand" onClick={onClose}>
      Закрыть
    </CabinetButton>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={
        sendMutation.isPending || announcementMutation.isPending
          ? undefined
          : onClose
      }
      title={modalTitle}
      compactMobile
      footer={footer}
    >
      {isChatOpen ? (
        <div className="space-y-4">
          {localError ? (
            <NoticeBanner tone="error" variant="neon">
              {localError}
            </NoticeBanner>
          ) : null}
          <div
            ref={historyListRef}
            className="max-h-[55vh] space-y-3 overflow-y-auto pr-1"
          >
            {messagesQuery.isError ? (
              <NoticeBanner tone="error" variant="neon">
                {extractErrorMessage(messagesQuery.error) ||
                  'Не удалось загрузить переписку.'}
              </NoticeBanner>
            ) : null}
            {messagesQuery.isLoading && messages.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Загружаем сообщения...
              </p>
            ) : null}
            {!messagesQuery.isLoading && messages.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Сообщений пока нет.
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
                      {isAdminMessage
                        ? 'Организатор'
                        : message.createdByRole === 'liaison'
                          ? 'Связной команды'
                          : 'Капитан команды'}
                      {message.scope === 'game' ? ' · всем командам' : ''}
                    </span>
                    <span>{formatMessageDateTime(message.createdAt)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">
                    <LinkedMessageText text={message.body} />
                  </p>
                  {isAdminMessage && message.pushRequested ? (
                    <p className="mt-2 text-xs opacity-80">
                      Push: доставлено {message.pushDelivered || 0} из{' '}
                      {message.pushUsersMatched || 0}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs opacity-80">
                    {isAdminMessage
                      ? message.teamReadAt
                        ? `Прочитано командой: ${formatMessageDateTime(message.teamReadAt)}`
                        : 'Команда еще не прочитала'
                      : message.readByAdminAt
                        ? `Прочитано администратором: ${formatMessageDateTime(message.readByAdminAt)}`
                        : 'Не прочитано администратором'}
                  </p>
                </div>
              )
            })}
          </div>
          <div>
            <label
              htmlFor="game-team-message-body"
              className="block text-xs font-semibold text-slate-500 dark:text-slate-400"
            >
              Текст сообщения
            </label>
            <textarea
              id="game-team-message-body"
              ref={textareaRef}
              value={messageBody}
              onChange={handleMessageChange}
              placeholder="Введите сообщение..."
              rows={1}
              className="mt-2 w-full resize-none overflow-hidden rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-500 dark:border-slate-600/80 dark:bg-slate-900 dark:text-slate-100"
              disabled={sendMutation.isPending}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={sendPush}
              onChange={(event) => setSendPush(event.target.checked)}
              disabled={sendMutation.isPending}
              className="rounded border-slate-400 text-cyan-600 focus:ring-cyan-500/40"
            />
            Дополнительно отправить push-уведомление
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          {localError ? (
            <NoticeBanner tone="error" variant="neon">
              {localError}
            </NoticeBanner>
          ) : null}
          {canSendAnnouncement ? (
            <button
              type="button"
              onClick={handleSendAnnouncement}
              disabled={announcementMutation.isPending}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-3 text-left transition hover:border-cyan-400 hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-70 dark:border-cyan-500/35 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/18"
            >
              <span>
                <span className="block text-sm font-semibold text-cyan-900 dark:text-cyan-100">
                  Отправить анонс игры всем зарегистрированным на сайте
                </span>
                <span className="mt-1 block text-xs text-cyan-700 dark:text-cyan-200/80">
                  Push уйдёт пользователям города игры, у которых включены push-уведомления.
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-cyan-200 px-3 py-1 text-xs font-semibold text-cyan-900 dark:bg-cyan-400/20 dark:text-cyan-100">
                {announcementMutation.isPending ? 'Отправка...' : 'Анонс'}
              </span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setSelectedTeamId(GAME_WIDE_DIALOG_ID)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-left transition hover:border-amber-400 hover:bg-amber-100 dark:border-amber-500/35 dark:bg-amber-500/10 dark:hover:bg-amber-500/18"
          >
            <span>
              <span className="block text-sm font-semibold text-amber-900 dark:text-amber-100">
                Отправить сообщение всем командам
              </span>
              <span className="mt-1 block text-xs text-amber-700 dark:text-amber-200/80">
                Сообщение попадёт в переписку каждой зарегистрированной команды.
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-400/20 dark:text-amber-100">
              Всем
            </span>
          </button>

          {dialogsQuery.isError ? (
            <NoticeBanner tone="error" variant="neon">
              {extractErrorMessage(dialogsQuery.error) ||
                'Не удалось загрузить диалоги команд.'}
            </NoticeBanner>
          ) : null}
          {dialogsQuery.isLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Загружаем команды...
            </p>
          ) : null}
          {!dialogsQuery.isLoading && dialogs.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 dark:border-[#00D1FF]/20 dark:bg-[#050012]/65 dark:text-[#d7e7ff]">
              На игру пока не зарегистрированы команды.
            </p>
          ) : null}
          <div className="space-y-3">
            {dialogs.map((dialog) => {
              const unreadCount = Number(dialog.unreadCount || 0)
              const lastMessage = dialog.lastMessage
              return (
                <button
                  key={dialog.teamId}
                  type="button"
                  onClick={() => setSelectedTeamId(dialog.teamId)}
                  className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-left transition hover:border-cyan-300 hover:bg-cyan-50/70 dark:border-[#00D1FF]/20 dark:bg-[#050012]/65 dark:hover:border-[#00D1FF]/45 dark:hover:bg-[#00D1FF]/10"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-[#f3ecff]">
                        {dialog.teamName}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-xs text-slate-500 dark:text-slate-400">
                        {lastMessage
                          ? `${lastMessage.direction === 'admin_to_team' ? 'Организатор' : 'Команда'}: ${lastMessage.body}`
                          : 'Переписка ещё не начата'}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-2">
                      <span className="text-xs text-slate-400">
                        {formatMessageDateTime(dialog.lastMessageAt)}
                      </span>
                      {unreadCount > 0 ? (
                        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-rose-500 px-2 py-1 text-xs font-bold leading-none text-white">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  {unreadCount > 0 ? (
                    <span className="mt-2 block text-xs font-medium text-rose-600 dark:text-rose-300">
                      Неотвеченных сообщений: {unreadCount}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </Modal>
  )
}

GamePushBroadcastModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  gameId: PropTypes.string,
  gameName: PropTypes.string,
  gameStatus: PropTypes.string,
  onFeedback: PropTypes.func,
}

GamePushBroadcastModal.defaultProps = {
  gameId: '',
  gameName: '',
  gameStatus: '',
  onFeedback: null,
}

export default GamePushBroadcastModal
