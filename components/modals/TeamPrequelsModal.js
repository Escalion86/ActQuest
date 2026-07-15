'use client'

import { memo, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import Modal from '@components/Modal'
import NoticeBanner from '@components/NoticeBanner'
import requestApiJson from '@helpers/requestApiJson'
import {
  buildDefaultPrequelProgress,
  resolveRequiredPrequelMainCodesCount,
} from '@helpers/normalizePrequel'

const getEndpoint = (gameId, gameTeamId) =>
  `/api/cabinet/games/${encodeURIComponent(gameId)}/teams/${encodeURIComponent(gameTeamId)}/prequels`

const normalizeCode = (value) => String(value || '').trim().toLowerCase()

const TeamPrequelsModal = ({
  gameId,
  gameTeamId,
  teamName,
  isOpen,
  onClose,
  onUpdated,
}) => {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const queryKey = useMemo(
    () => ['team-prequels', gameId, gameTeamId],
    [gameId, gameTeamId],
  )
  const query = useQuery({
    queryKey,
    enabled: isOpen && Boolean(gameId) && Boolean(gameTeamId),
    queryFn: async () => {
      const { json } = await requestApiJson(getEndpoint(gameId, gameTeamId), {
        fallbackMessage: 'Не удалось загрузить приквелы команды',
      })
      return json?.data || { prequels: [], progresses: [] }
    },
  })

  const mutation = useMutation({
    mutationFn: async (payload) => {
      const { json } = await requestApiJson(getEndpoint(gameId, gameTeamId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        fallbackMessage: 'Не удалось изменить приквел команды',
      })
      return json
    },
    onSuccess: async () => {
      setError('')
      await queryClient.invalidateQueries({ queryKey })
      if (typeof onUpdated === 'function') await onUpdated()
    },
    onError: (nextError) => {
      setError(nextError?.message || 'Не удалось изменить приквел команды')
    },
  })

  const prequels = Array.isArray(query.data?.prequels)
    ? query.data.prequels
    : []
  const progresses = Array.isArray(query.data?.progresses)
    ? query.data.progresses
    : []

  const activateCode = (prequelId, code) => {
    if (
      !window.confirm(
        `Активировать код «${code?.code || 'без названия'}» для команды? Отменить действие будет нельзя.`,
      )
    ) return
    mutation.mutate({ action: 'activate_code', prequelId, codeId: code.id })
  }

  const completePrequel = (prequel) => {
    if (
      !window.confirm(
        `Засчитать «${prequel.title || 'Приквел'}» выполненным и начислить бонус? Отменить действие будет нельзя.`,
      )
    ) return
    mutation.mutate({ action: 'complete', prequelId: prequel.id })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Приквелы — ${teamName || 'Команда'}`}
    >
      <div className="space-y-4">
        {error || query.error ? (
          <NoticeBanner tone="error" variant="neon">
            {error || query.error?.message}
          </NoticeBanner>
        ) : null}
        {query.isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Загружаем результаты приквелов…
          </p>
        ) : prequels.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-300">
            У игры нет настроенных приквелов.
          </p>
        ) : (
          prequels.map((prequel) => {
            const progress =
              progresses.find((item) => item.prequelId === prequel.id) || {
                ...buildDefaultPrequelProgress(),
                prequelId: prequel.id,
              }
            const found = new Set(
              [
                ...progress.foundMainCodes,
                ...progress.foundBonusCodes,
                ...progress.foundPenaltyCodes,
              ].map(normalizeCode),
            )
            const requiredMain = resolveRequiredPrequelMainCodesCount(prequel)
            const codeGroups = [
              { label: 'Основные коды', items: prequel.mainCodes || [], tone: 'cyan' },
              { label: 'Бонусные коды', items: prequel.bonusCodes || [], tone: 'emerald' },
              { label: 'Штрафные коды', items: prequel.penaltyCodes || [], tone: 'rose' },
            ].filter((group) => group.items.length > 0)

            return (
              <section
                key={prequel.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/70"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {prequel.title || 'Приквел'}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                      {progress.completedAt
                        ? `Выполнен ${new Date(progress.completedAt).toLocaleString('ru-RU')}`
                        : 'Не выполнен'}
                      {requiredMain > 0
                        ? ` · Основных кодов ${progress.foundMainCodes.length}/${requiredMain}`
                        : ''}
                      {` · Неверных попыток ${progress.wrongCodes.length}`}
                    </p>
                  </div>
                  {!progress.completedAt ? (
                    <button
                      type="button"
                      disabled={mutation.isPending}
                      onClick={() => completePrequel(prequel)}
                      className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                    >
                      Засчитать выполненным
                    </button>
                  ) : (
                    <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                      Выполнен
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-3">
                  {codeGroups.map((group) => (
                    <div key={group.label}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                        {group.label}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {group.items.map((code) => {
                          const isFound = found.has(normalizeCode(code.code))
                          return (
                            <button
                              key={code.id}
                              type="button"
                              disabled={isFound || Boolean(progress.completedAt) || mutation.isPending}
                              onClick={() => activateCode(prequel.id, code)}
                              title={code.description || 'Активировать код'}
                              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-default ${
                                isFound
                                  ? 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-100'
                                  : 'border-slate-300 bg-white text-slate-700 hover:border-violet-400 hover:bg-violet-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
                              }`}
                            >
                              {isFound ? '✓ ' : ''}{code.code || 'Код'}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {progress.appliedAdjustments.length > 0 ? (
                  <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/70 dark:text-slate-200">
                    Корректировки: {progress.appliedAdjustments.map((item) =>
                      `${item.type === 'bonus' ? '−' : '+'}${Math.abs(Number(item.value) || 0)}${item.description ? ` (${item.description})` : ''}`,
                    ).join(', ')}
                  </div>
                ) : null}
              </section>
            )
          })
        )}
      </div>
    </Modal>
  )
}

TeamPrequelsModal.propTypes = {
  gameId: PropTypes.string,
  gameTeamId: PropTypes.string,
  teamName: PropTypes.string,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onUpdated: PropTypes.func,
}

TeamPrequelsModal.defaultProps = {
  gameId: '',
  gameTeamId: '',
  teamName: '',
  onUpdated: null,
}

export default memo(TeamPrequelsModal)
