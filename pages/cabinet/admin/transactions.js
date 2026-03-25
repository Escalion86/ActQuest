import { useCallback, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import Head from 'next/head'

import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetLayout from '@components/cabinet/CabinetLayout'
import CabinetSelectField from '@components/cabinet/CabinetSelectField'
import CabinetTextareaField from '@components/cabinet/CabinetTextareaField'
import FormSectionCard from '@components/cabinet/FormSectionCard'
import SelectableCard from '@components/cabinet/SelectableCard'
import AmountStepperInput from '@components/cabinet/AmountStepperInput'
import UserSelectField from '@components/cabinet/UserSelectField'
import GameSelectField from '@components/cabinet/GameSelectField'
import NoticeBanner from '@components/NoticeBanner'
import Modal from '@components/Modal'
import getSessionSafe from '@helpers/getSessionSafe'
import canManageTransactions from '@helpers/canManageTransactions'
import requestApiJson from '@helpers/requestApiJson'
import useCabinetRolePreview from '@helpers/useCabinetRolePreview'
import useMergedSession from '@helpers/useMergedSession'
import dbConnectGlobal from '@utils/dbConnectGlobal'

const PAGE_SIZE = 10
const INPUT_CLASS =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'

const DIR_OPTIONS = [['income', 'Доход'], ['expense', 'Расход']]
const PAY_OPTIONS = [
  ['cash', 'Наличка'],
  ['transfer', 'Перевод'],
  ['invoice', 'Оплата по счёту'],
  ['coupon', 'Купон'],
]
const STATUS_OPTIONS = [
  ['pending', 'Ожидает'],
  ['completed', 'Проведена'],
  ['canceled', 'Отменена'],
]

const defaultFilters = { direction: '', status: '' }
const defaultForm = {
  direction: 'income',
  paymentMethod: 'cash',
  amount: '100',
  userId: '',
  gameId: '',
  couponCode: '',
  comment: '',
}

const money = (value) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)

const dt = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const toAmount = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

const toQueryString = ({ offset, limit, filters }) => {
  const params = new URLSearchParams()
  params.set('offset', String(offset))
  params.set('limit', String(limit))
  if (filters.direction) params.set('direction', filters.direction)
  if (filters.status) params.set('status', filters.status)
  return params.toString()
}

const AdminTransactionsPage = ({
  session: initialSession,
  initialTransactions,
  initialHasMore,
}) => {
  const { activeSession } = useMergedSession(initialSession)
  const { effectiveRole } = useCabinetRolePreview(
    activeSession?.user?.role ?? 'client',
  )
  const isAdmin = canManageTransactions({ role: effectiveRole })

  const [transactions, setTransactions] = useState(initialTransactions)
  const [hasMore, setHasMore] = useState(Boolean(initialHasMore))
  const [isLoading, setIsLoading] = useState(false)
  const [isUpdatingId, setIsUpdatingId] = useState(null)
  const [isDeletingId, setIsDeletingId] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [filters, setFilters] = useState(defaultFilters)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [selectedUserOption, setSelectedUserOption] = useState(null)
  const [selectedGameOption, setSelectedGameOption] = useState(null)

  const isCouponFlow = form.paymentMethod === 'coupon'

  const reload = useCallback(async () => {
    const query = toQueryString({ offset: 0, limit: PAGE_SIZE, filters })
    const { json } = await requestApiJson(`/api/cabinet/admin/transactions?${query}`, {
      fallbackMessage: 'Не удалось загрузить транзакции',
    })
    setTransactions(Array.isArray(json?.data) ? json.data : [])
    setHasMore(Boolean(json?.meta?.hasMore))
  }, [filters])

  const loadMore = useCallback(async () => {
    setIsLoading(true)
    setFeedback(null)
    try {
      const query = toQueryString({
        offset: transactions.length,
        limit: PAGE_SIZE,
        filters,
      })
      const { json } = await requestApiJson(`/api/cabinet/admin/transactions?${query}`, {
        fallbackMessage: 'Не удалось загрузить ещё',
      })
      setTransactions((prev) => [
        ...prev,
        ...(Array.isArray(json?.data) ? json.data : []),
      ])
      setHasMore(Boolean(json?.meta?.hasMore))
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
    } finally {
      setIsLoading(false)
    }
  }, [filters, transactions.length])

  const handleFilterChange = useCallback(async (key, value) => {
    const nextFilters = {
      ...filters,
      [key]: value,
    }
    setFilters(nextFilters)
    setFeedback(null)
    try {
      const query = toQueryString({
        offset: 0,
        limit: PAGE_SIZE,
        filters: nextFilters,
      })
      const { json } = await requestApiJson(`/api/cabinet/admin/transactions?${query}`, {
        fallbackMessage: 'Не удалось загрузить транзакции',
      })
      setTransactions(Array.isArray(json?.data) ? json.data : [])
      setHasMore(Boolean(json?.meta?.hasMore))
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
    }
  }, [filters])

  const createTransaction = useCallback(async () => {
    setIsCreating(true)
    setFeedback(null)

    try {
      const basePayload = {
        amount: toAmount(form.amount),
        userId: form.userId.trim(),
        gameId: form.gameId.trim(),
        couponCode: form.couponCode.trim().toUpperCase(),
        comment: form.comment.trim(),
        status: 'completed',
        direction: form.direction,
        paymentMethod: form.paymentMethod,
      }

      const request = isCouponFlow && basePayload.couponCode && !basePayload.gameId
        ? {
            url: '/api/cabinet/admin/transactions/coupon/issue',
            data: {
              userId: basePayload.userId,
              couponCode: basePayload.couponCode,
              amount: basePayload.amount,
              comment: basePayload.comment,
            },
          }
        : isCouponFlow && basePayload.couponCode && basePayload.gameId
          ? {
              url: '/api/cabinet/admin/transactions/coupon/redeem',
              data: {
                userId: basePayload.userId,
                gameId: basePayload.gameId,
                couponCode: basePayload.couponCode,
                comment: basePayload.comment,
              },
            }
          : { url: '/api/cabinet/admin/transactions', data: basePayload }

      await requestApiJson(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: request.data }),
        fallbackMessage: 'Не удалось создать транзакцию',
      })

      setForm(defaultForm)
      setSelectedUserOption(null)
      setSelectedGameOption(null)
      setIsCreateModalOpen(false)
      setFeedback({ type: 'success', message: 'Транзакция создана' })
      await reload()
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
    } finally {
      setIsCreating(false)
    }
  }, [form, isCouponFlow, reload])

  const removeTransaction = useCallback(
    async (id) => {
      setIsDeletingId(id)
      setFeedback(null)
      try {
        await requestApiJson(`/api/cabinet/admin/transactions/${id}`, {
          method: 'DELETE',
          fallbackMessage: 'Не удалось удалить транзакцию',
        })
        setFeedback({ type: 'success', message: 'Транзакция удалена' })
        await reload()
      } catch (error) {
        setFeedback({ type: 'error', message: error.message })
      } finally {
        setIsDeletingId(null)
      }
    },
    [reload],
  )

  const updateStatus = useCallback(async (id, status) => {
    setIsUpdatingId(id)
    setFeedback(null)
    try {
      await requestApiJson(`/api/cabinet/admin/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { status } }),
        fallbackMessage: 'Не удалось обновить транзакцию',
      })
      setFeedback({ type: 'success', message: 'Статус транзакции обновлён' })
      await reload()
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
    } finally {
      setIsUpdatingId(null)
    }
  }, [reload])

  const modalFooter = useMemo(
    () => (
      <>
        <CabinetButton
          onClick={() => setIsCreateModalOpen(false)}
          variant="secondary"
        >
          Отмена
        </CabinetButton>
        <CabinetButton
          onClick={createTransaction}
          disabled={isCreating}
          variant="primary"
        >
          {isCreating ? 'Сохраняем...' : 'Создать'}
        </CabinetButton>
      </>
    ),
    [createTransaction, isCreating],
  )

  if (!isAdmin) {
    return null
  }

  return (
    <>
      <Head>
        <title>ActQuest — Транзакции</title>
      </Head>
      <CabinetLayout
        title="Транзакции"
        description=""
        activePage="admin"
        headerTitle="Транзакции"
        showPageTitle={false}
      >
        <FormSectionCard className="p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <CabinetSelectField
              id="transactions-filter-direction"
              label={null}
              value={filters.direction}
              onChange={(e) => handleFilterChange('direction', e.target.value)}
              containerClassName="space-y-0"
              selectClassName={INPUT_CLASS}
            >
              <option value="">Все направления</option>
              {DIR_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </CabinetSelectField>
            <CabinetSelectField
              id="transactions-filter-status"
              label={null}
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              containerClassName="space-y-0"
              selectClassName={INPUT_CLASS}
            >
              <option value="">Все статусы</option>
              {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </CabinetSelectField>
            <CabinetButton
              type="button"
              variant="secondary"
              tone="cyan"
              size="md"
              onClick={() => setIsCreateModalOpen(true)}
              className="cursor-pointer md:col-span-2 md:w-max"
            >
              Добавить
            </CabinetButton>
          </div>
        </FormSectionCard>

        {feedback ? (
          <NoticeBanner
            tone={feedback.type === 'success' ? 'success' : 'error'}
            variant="neon"
            className="mt-4"
          >
            {feedback.message}
          </NoticeBanner>
        ) : null}

        <section className="mt-6 space-y-4">
          {transactions.map((transaction) => (
            <SelectableCard key={transaction._id} className="border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-primary dark:text-slate-100">
                    {transaction.paymentMethod === 'coupon'
                      ? 'Купон'
                      : transaction.paymentMethod || 'Транзакция'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">ID: {transaction._id}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">{dt(transaction.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-semibold text-primary dark:text-slate-100">{money(transaction.amount)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">{transaction.direction} · {transaction.status}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">Баланс: {transaction.userBalanceDelta > 0 ? '+' : ''}{money(transaction.userBalanceDelta)}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-600 dark:text-slate-300 md:grid-cols-2">
                <p>Пользователь: {transaction.userId || '—'}</p>
                <p>Игра: {transaction.gameId || '—'}</p>
                <p>Способ: {transaction.paymentMethod || '—'}</p>
                <p>Купон: {transaction.couponCode || '—'}</p>
              </div>
              {transaction.comment ? <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{transaction.comment}</p> : null}
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => updateStatus(transaction._id, transaction.status === 'completed' ? 'pending' : 'completed')} disabled={isUpdatingId === transaction._id} className="cursor-pointer rounded-lg border border-cyan-300 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-cyan-500/50 dark:text-cyan-200 dark:hover:bg-cyan-500/15">{isUpdatingId === transaction._id ? 'Сохраняем...' : transaction.status === 'completed' ? 'В ожидание' : 'Провести'}</button>
                <button type="button" onClick={() => removeTransaction(transaction._id)} disabled={isDeletingId === transaction._id} className="cursor-pointer rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/15">{isDeletingId === transaction._id ? 'Удаляем...' : 'Удалить'}</button>
              </div>
            </SelectableCard>
          ))}
        </section>

        {hasMore ? (
          <div className="mt-6">
            <CabinetButton
              type="button"
              variant="secondary"
              size="md"
              onClick={loadMore}
              disabled={isLoading}
              className="cursor-pointer"
            >
              {isLoading ? 'Загружаем...' : 'Загрузить ещё'}
            </CabinetButton>
          </div>
        ) : null}

        <Modal isOpen={isCreateModalOpen} title="Добавить транзакцию" onClose={() => setIsCreateModalOpen(false)} footer={modalFooter}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">
                Сумма
              </p>
              <AmountStepperInput
                value={form.amount}
                min={0}
                step={100}
                placeholder="Сумма"
                inputClassName={`aq-amount-step-input ${INPUT_CLASS}`}
                onChange={(nextValue) =>
                  setForm((prev) => ({ ...prev, amount: nextValue }))
                }
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">
                Направление
              </p>
              <CabinetSelectField
                id="transactions-form-direction"
                label={null}
                value={form.direction}
                onChange={(e) => setForm((p) => ({ ...p, direction: e.target.value }))}
                containerClassName="space-y-0"
                selectClassName={`${INPUT_CLASS} cursor-pointer`}
              >
                {DIR_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </CabinetSelectField>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">
                Тип оплаты
              </p>
              <CabinetSelectField
                id="transactions-form-payment-method"
                label={null}
                value={form.paymentMethod}
                onChange={(e) => setForm((p) => ({ ...p, paymentMethod: e.target.value }))}
                containerClassName="space-y-0"
                selectClassName={`${INPUT_CLASS} cursor-pointer`}
              >
                {PAY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </CabinetSelectField>
            </div>
            <UserSelectField
              label="Пользователь"
              selectedOption={selectedUserOption}
              onSelect={(option) => {
                setSelectedUserOption(option)
                setForm((prev) => ({ ...prev, userId: option.id }))
              }}
              onClear={() => {
                setSelectedUserOption(null)
                setForm((prev) => ({ ...prev, userId: '' }))
              }}
            />
            <GameSelectField
              label="Игра (опционально)"
              selectedOption={selectedGameOption}
              onSelect={(option) => {
                setSelectedGameOption(option)
                setForm((prev) => ({ ...prev, gameId: option.id }))
              }}
              onClear={() => {
                setSelectedGameOption(null)
                setForm((prev) => ({ ...prev, gameId: '' }))
              }}
            />
            {isCouponFlow ? (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">
                  Код купона
                </p>
                <input className={INPUT_CLASS} placeholder="Код купона" value={form.couponCode} onChange={(e) => setForm((p) => ({ ...p, couponCode: e.target.value.toUpperCase() }))} />
              </div>
            ) : null}
            <CabinetTextareaField
              id="transactions-form-comment"
              label="Комментарий"
              value={form.comment}
              onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))}
              rows={3}
              placeholder="Комментарий"
              containerClassName="space-y-1 md:col-span-2"
              labelClassName="text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300"
              textareaClassName={INPUT_CLASS}
            />
          </div>
        </Modal>
      </CabinetLayout>
    </>
  )
}

export async function getServerSideProps(context) {
  const session = await getSessionSafe(context)
  if (!session) {
    const callbackTarget = context.resolvedUrl || '/cabinet/admin/transactions'
    return {
      redirect: {
        destination: `/cabinet/login?callbackUrl=${encodeURIComponent(callbackTarget)}`,
        permanent: false,
      },
    }
  }
  if (!canManageTransactions({ role: session?.user?.role })) {
    return { props: { session, initialTransactions: [], initialHasMore: false } }
  }

  const db = await dbConnectGlobal()
  if (!db) {
    return { props: { session, initialTransactions: [], initialHasMore: false } }
  }

  const Transactions = db.model('Transactions')
  const docs = await Transactions.find({}).sort({ createdAt: -1 }).limit(PAGE_SIZE + 1).lean()
  return {
    props: {
      session,
      initialTransactions: JSON.parse(JSON.stringify(docs.slice(0, PAGE_SIZE))),
      initialHasMore: docs.length > PAGE_SIZE,
    },
  }
}

AdminTransactionsPage.propTypes = {
  initialTransactions: PropTypes.arrayOf(PropTypes.object),
  initialHasMore: PropTypes.bool,
  session: PropTypes.object,
}

AdminTransactionsPage.defaultProps = {
  initialTransactions: [],
  initialHasMore: false,
  session: null,
}

export default AdminTransactionsPage
