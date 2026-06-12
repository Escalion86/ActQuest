import { memo, useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import AmountStepperInput, {
  DEFAULT_MONEY_INPUT_CLASS_NAME,
} from '@components/cabinet/AmountStepperInput'
import CabinetSelectField from '@components/cabinet/CabinetSelectField'
import NoticeBanner from '@components/NoticeBanner'
import requestApiJson from '@helpers/requestApiJson'

const amountInputClassName = DEFAULT_MONEY_INPUT_CLASS_NAME

const formatMoney = (amountRaw) => {
  const amount = Number(amountRaw)
  if (!Number.isFinite(amount)) {
    return '0 ₽'
  }

  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(amount)
}

const formatDateTime = (value) => {
  if (!value) return 'Дата не указана'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Дата не указана'
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const formatDateInputValue = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const pad = (part) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const getMemberDisplayName = (member) => {
  const name =
    typeof member?.name === 'string'
      ? member.name.trim()
      : typeof member?.user?.name === 'string'
        ? member.user.name.trim()
        : ''
  const username =
    typeof member?.username === 'string'
      ? member.username.trim()
      : typeof member?.user?.username === 'string'
        ? member.user.username.trim()
        : ''
  const phone =
    typeof member?.phone === 'string'
      ? member.phone.trim()
      : typeof member?.user?.phone === 'string'
        ? member.user.phone.trim()
        : ''
  const userId = typeof member?.userId === 'string' ? member.userId.trim() : ''

  const primaryName = name || (username ? `@${username}` : '')
  if (primaryName && phone) {
    return `${primaryName} · ${phone}`
  }
  return primaryName || phone || userId || 'Участник без имени'
}

const normalizeTarget = (target) =>
  target
    ? {
        gameTeamId: String(target.gameTeamId || ''),
        teamId: String(target.teamId || ''),
        teamName: String(target.teamName || 'Без названия'),
        paidGame: Boolean(target.paidGame),
        members: Array.isArray(target.members)
          ? target.members.filter((member) => member?.userId)
          : [],
        totalPaid: Number(target.totalPaid) || 0,
      }
    : null

const TeamGamePaymentsModal = ({
  isOpen,
  onClose,
  selectedGame,
  target,
  updatingPaidGameTeamIds = [],
  onPaidGameChange,
  onPaymentsChanged,
}) => {
  const [localTarget, setLocalTarget] = useState(() => normalizeTarget(target))
  const [transactions, setTransactions] = useState([])
  const [totalPaid, setTotalPaid] = useState(0)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTogglingPaidGame, setIsTogglingPaidGame] = useState(false)
  const [draft, setDraft] = useState({
    amount: '',
    paidAt: formatDateInputValue(),
    userId: '',
    paymentMethod: 'transfer',
  })

  const loadPayments = useCallback(
    async (nextTarget) => {
      if (!selectedGame?.id || !nextTarget?.gameTeamId) {
        return
      }

      setIsLoading(true)
      setError('')

      try {
        const params = new URLSearchParams({
          scope: 'payments',
          gameTeamId: String(nextTarget.gameTeamId),
        })
        const { json } = await requestApiJson(
          `/api/cabinet/games/${encodeURIComponent(String(selectedGame.id))}/teams?${params.toString()}`,
          {
            fallbackMessage: 'Не удалось загрузить оплаты команды',
          },
        )
        const data = json?.data ?? {}
        setTransactions(Array.isArray(data.transactions) ? data.transactions : [])
        setTotalPaid(Number(data.totalPaid) || 0)
        setLocalTarget((prev) =>
          prev
            ? {
                ...prev,
                paidGame: Boolean(data.paidGame),
              }
            : prev,
        )
      } catch (loadError) {
        setError(loadError?.message || 'Не удалось загрузить оплаты команды')
      } finally {
        setIsLoading(false)
      }
    },
    [selectedGame?.id],
  )

  useEffect(() => {
    if (!isOpen) {
      setLocalTarget(null)
      setTransactions([])
      setTotalPaid(0)
      setError('')
      setIsLoading(false)
      setIsCreateOpen(false)
      setIsSaving(false)
      setIsTogglingPaidGame(false)
      setDraft({
        amount: '',
        paidAt: formatDateInputValue(),
        userId: '',
        paymentMethod: 'transfer',
      })
      return
    }

    const nextTarget = normalizeTarget(target)
    setLocalTarget(nextTarget)
    setTransactions([])
    setTotalPaid(Number(nextTarget?.totalPaid) || 0)
    setError('')
    setIsCreateOpen(false)
    loadPayments(nextTarget)
  }, [isOpen, loadPayments, target])

  const handleClose = useCallback(() => {
    if (isSaving || isTogglingPaidGame) {
      return
    }
    onClose()
  }, [isSaving, isTogglingPaidGame, onClose])

  const handleOpenCreate = useCallback(() => {
    const members = Array.isArray(localTarget?.members) ? localTarget.members : []
    setDraft({
      amount: '',
      paidAt: formatDateInputValue(),
      userId: members[0]?.userId ? String(members[0].userId) : '',
      paymentMethod: 'transfer',
    })
    setError('')
    setIsCreateOpen(true)
  }, [localTarget?.members])

  const handleCloseCreate = useCallback(() => {
    if (isSaving) {
      return
    }
    setIsCreateOpen(false)
  }, [isSaving])

  const handleSavePayment = useCallback(async () => {
    if (!selectedGame?.id || !localTarget?.gameTeamId) {
      setError('Не передан идентификатор игры или команды')
      return
    }

    const amount = Number(draft.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Сумма оплаты должна быть больше нуля')
      return
    }
    if (!draft.userId) {
      setError('Выберите игрока, который внёс оплату')
      return
    }
    const paidAt = new Date(draft.paidAt)
    if (!Number.isFinite(paidAt.getTime())) {
      setError('Укажите корректную дату внесения оплаты')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const { json } = await requestApiJson(
        `/api/cabinet/games/${encodeURIComponent(String(selectedGame.id))}/teams`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_team_payment',
            gameTeamId: localTarget.gameTeamId,
            userId: draft.userId,
            amount,
            paidAt: paidAt.toISOString(),
            paymentMethod: draft.paymentMethod || 'transfer',
          }),
          fallbackMessage: 'Не удалось создать оплату команды',
        },
      )
      const data = json?.data ?? {}
      setTransactions(Array.isArray(data.transactions) ? data.transactions : [])
      setTotalPaid(Number(data.totalPaid) || 0)
      setIsCreateOpen(false)
      await onPaymentsChanged?.({
        gameTeamId: localTarget.gameTeamId,
        totalPaid: Number(data.totalPaid) || 0,
      })
    } catch (saveError) {
      setError(saveError?.message || 'Не удалось создать оплату команды')
    } finally {
      setIsSaving(false)
    }
  }, [
    draft.amount,
    draft.paidAt,
    draft.paymentMethod,
    draft.userId,
    localTarget?.gameTeamId,
    onPaymentsChanged,
    selectedGame?.id,
  ])

  const handleTogglePaidGame = useCallback(
    async (event) => {
      if (!selectedGame?.id || !localTarget?.gameTeamId) {
        return
      }
      const paidGame = Boolean(event.target.checked)
      setLocalTarget((prev) => (prev ? { ...prev, paidGame } : prev))
      setIsTogglingPaidGame(true)
      setError('')

      try {
        if (typeof onPaidGameChange === 'function') {
          await onPaidGameChange({
            gameTeamId: localTarget.gameTeamId,
            paidGame,
          })
        } else {
          await requestApiJson(
            `/api/cabinet/games/${encodeURIComponent(String(selectedGame.id))}/teams`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'update_paid_game',
                gameTeamId: localTarget.gameTeamId,
                paidGame,
              }),
              fallbackMessage: 'Не удалось обновить флаг оплаты игры',
            },
          )
        }
        await onPaymentsChanged?.({
          gameTeamId: localTarget.gameTeamId,
          paidGame,
        })
      } catch (toggleError) {
        setLocalTarget((prev) => (prev ? { ...prev, paidGame: !paidGame } : prev))
        setError(toggleError?.message || 'Не удалось обновить флаг оплаты игры')
      } finally {
        setIsTogglingPaidGame(false)
      }
    },
    [
      localTarget?.gameTeamId,
      onPaidGameChange,
      onPaymentsChanged,
      selectedGame?.id,
    ],
  )

  const members = Array.isArray(localTarget?.members) ? localTarget.members : []
  const isPaidGameUpdating =
    isTogglingPaidGame ||
    updatingPaidGameTeamIds.includes(String(localTarget?.gameTeamId || ''))

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={`Оплата команды «${localTarget?.teamName || 'Без названия'}»`}
        footer={
          <button
            type="button"
            className="aq-modal-btn aq-modal-btn-secondary"
            onClick={handleClose}
            disabled={isSaving || isTogglingPaidGame}
          >
            Закрыть
          </button>
        }
      >
        <div className="space-y-4">
          {error ? (
            <NoticeBanner tone="error" variant="neon">
              {error}
            </NoticeBanner>
          ) : null}
          <div className="flex flex-col gap-3 p-3 border rounded-xl border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/70 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
              <input
                type="checkbox"
                checked={Boolean(localTarget?.paidGame)}
                disabled={!localTarget?.gameTeamId || isPaidGameUpdating}
                onChange={handleTogglePaidGame}
                className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-400 dark:border-slate-600"
              />
              Команда оплатила игру
            </label>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Сумма: {formatMoney(totalPaid)}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Транзакции
            </h3>
            <button
              type="button"
              onClick={handleOpenCreate}
              disabled={isLoading || members.length === 0}
              className="inline-flex items-center justify-center text-lg font-semibold leading-none transition border rounded-lg h-9 w-9 border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:border-emerald-400/65 dark:hover:bg-emerald-500/20"
              aria-label="Добавить оплату"
              title="Добавить оплату"
            >
              +
            </button>
          </div>

          {isLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Загружаем оплаты…
            </p>
          ) : transactions.length > 0 ? (
            <ul className="space-y-2">
              {transactions.map((transaction) => {
                const member = members.find(
                  (item) =>
                    String(item?.userId || '') ===
                    String(transaction?.userId || ''),
                )
                return (
                  <li
                    key={transaction._id}
                    className="p-3 bg-white border rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/80"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {getMemberDisplayName(member)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDateTime(
                            transaction.paidAt || transaction.createdAt,
                          )}
                        </p>
                      </div>
                      <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">
                        {formatMoney(transaction.amount)}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Для этой команды ещё нет транзакций оплаты.
            </p>
          )}
          {members.length === 0 ? (
            <p className="text-xs text-amber-600 dark:text-amber-200">
              В команде нет участников с привязанным пользователем, поэтому
              добавить оплату нельзя.
            </p>
          ) : null}
        </div>
      </Modal>
      <Modal
        isOpen={isCreateOpen}
        onClose={handleCloseCreate}
        title="Добавление оплаты"
        footer={
          <>
            <button
              type="button"
              className="aq-modal-btn aq-modal-btn-secondary"
              onClick={handleCloseCreate}
              disabled={isSaving}
            >
              Отмена
            </button>
            <button
              type="button"
              className={`aq-modal-btn aq-modal-btn-primary ${isSaving ? 'cursor-wait' : ''}`}
              onClick={handleSavePayment}
              disabled={isSaving}
            >
              {isSaving ? 'Сохранение…' : 'Создать'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? (
            <NoticeBanner tone="error" variant="neon">
              {error}
            </NoticeBanner>
          ) : null}
          <div className="flex gap-x-2">
            <div>
              <label
                htmlFor="team-payment-amount"
                className="text-sm font-semibold text-slate-700 dark:text-slate-100"
              >
                Сумма
              </label>
              <AmountStepperInput
                id="team-payment-amount"
                value={draft.amount}
                min={0}
                step={100}
                placeholder="Сумма"
                className="mt-2 max-w-none"
                inputClassName={amountInputClassName}
                onChange={(nextValue) =>
                  setDraft((prev) => ({
                    ...prev,
                    amount: nextValue,
                  }))
                }
              />
            </div>
            <div>
              <label
                htmlFor="team-payment-paid-at"
                className="text-sm font-semibold text-slate-700 dark:text-slate-100"
              >
                Дата внесения
              </label>
              <input
                id="team-payment-paid-at"
                type="datetime-local"
                value={draft.paidAt}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    paidAt: event.target.value,
                  }))
                }
                className="w-full px-4 py-2 mt-2 text-sm bg-white border rounded-xl border-slate-200 text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="team-payment-user"
              className="text-sm font-semibold text-slate-700 dark:text-slate-100"
            >
              Игрок
            </label>
            <select
              id="team-payment-user"
              value={draft.userId}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  userId: event.target.value,
                }))
              }
              className="w-full px-4 py-2 mt-2 text-sm bg-white border rounded-xl border-slate-200 text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
            >
              <option value="">Выберите игрока</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {getMemberDisplayName(member)}
                </option>
              ))}
            </select>
          </div>
          <CabinetSelectField
            id="team-payment-method"
            label="Способ оплаты"
            value={draft.paymentMethod}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                paymentMethod: event.target.value,
              }))
            }
            labelClassName="text-sm font-semibold text-slate-700 dark:text-slate-100"
            selectClassName="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
          >
            <option value="transfer">Перевод</option>
            <option value="cash">Наличные</option>
            <option value="invoice">Счёт</option>
          </CabinetSelectField>
        </div>
      </Modal>
    </>
  )
}

const memberShape = PropTypes.shape({
  userId: PropTypes.string,
  name: PropTypes.string,
  username: PropTypes.string,
  phone: PropTypes.string,
  user: PropTypes.shape({
    name: PropTypes.string,
    username: PropTypes.string,
    phone: PropTypes.string,
  }),
})

TeamGamePaymentsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  selectedGame: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }),
  target: PropTypes.shape({
    gameTeamId: PropTypes.string,
    teamId: PropTypes.string,
    teamName: PropTypes.string,
    paidGame: PropTypes.bool,
    totalPaid: PropTypes.number,
    members: PropTypes.arrayOf(memberShape),
  }),
  updatingPaidGameTeamIds: PropTypes.arrayOf(PropTypes.string),
  onPaidGameChange: PropTypes.func,
  onPaymentsChanged: PropTypes.func,
}

TeamGamePaymentsModal.defaultProps = {
  selectedGame: null,
  target: null,
  updatingPaidGameTeamIds: [],
  onPaidGameChange: null,
  onPaymentsChanged: null,
}

export default memo(TeamGamePaymentsModal)
