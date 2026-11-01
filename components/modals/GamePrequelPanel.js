import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { useQueryClient } from '@tanstack/react-query'
import Modal from '@components/Modal'
import PrequelStatusIcon from '@components/PrequelStatusIcon'
import TiptapContentView from '@components/cabinet/TiptapContentView'
import formatDateInLocationTimeZone from '@helpers/formatDateInLocationTimeZone'
import requestApiJson from '@helpers/requestApiJson'
import ModalSectionTitle from './ModalSectionTitle'
import {
  buildDefaultPrequelProgress,
  isPrequelOpenForDate,
  isPrequelReadyForPlayers,
  isPrequelProgressClosedForConfig,
  isPrequelProgressExhaustedForConfig,
  normalizePrequelConfigs,
  normalizePrequelProgress,
  normalizePrequelProgresses,
  resolveDefaultPrequelForDate,
} from '@helpers/normalizePrequel'

const buildAcceptedPrequelCodeItems = (progress, source) =>
  (Array.isArray(progress?.appliedAdjustments) ? progress.appliedAdjustments : [])
    .filter((item) => item?.source === source && String(item?.code || '').trim())
    .map((item) => ({
      code: String(item.code || '').trim(),
      description: String(item.description || '').trim(),
    }))

const formatPrequelOpenAt = (value, locationKey) =>
  formatDateInLocationTimeZone(value, locationKey, {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })

const GamePrequelPanel = ({ selectedGame, isOpen }) => {
  const queryClient = useQueryClient()
  const [isPrequelHelpOpen, setIsPrequelHelpOpen] = useState(false)
  const [prequelCode, setPrequelCode] = useState('')
  const [prequelFeedback, setPrequelFeedback] = useState(null)
  const [isPrequelSubmitting, setIsPrequelSubmitting] = useState(false)
  const prequels = useMemo(
    () =>
      normalizePrequelConfigs(
        Array.isArray(selectedGame?.prequels) &&
          selectedGame.prequels.length > 0
          ? selectedGame.prequels
          : selectedGame?.prequel
            ? [selectedGame.prequel]
            : [],
        { includeCodes: false },
      ),
    [selectedGame?.prequel, selectedGame?.prequels],
  )
  const visiblePrequels = useMemo(
    () => prequels.filter((item) => item.enabled),
    [prequels],
  )
  const [activePrequelId, setActivePrequelId] = useState('')
  const [prequelNowTs, setPrequelNowTs] = useState(() => Date.now())
  const defaultPrequel = useMemo(
    () =>
      resolveDefaultPrequelForDate(visiblePrequels, new Date(prequelNowTs)),
    [prequelNowTs, visiblePrequels],
  )
  const prequel =
    visiblePrequels.find((item) => item.id === activePrequelId) ||
    defaultPrequel ||
    {}
  const isPrequelOpen = useMemo(
    () => isPrequelOpenForDate(prequel, new Date(prequelNowTs)),
    [prequel, prequelNowTs],
  )
  const isPrequelReady = useMemo(
    () => isPrequelReadyForPlayers(prequel),
    [prequel],
  )
  const hasVisiblePrequels = visiblePrequels.length > 0
  const prequelSectionTitle =
    visiblePrequels.length > 1 ? prequel.title || 'Приквел' : 'Приквел'
  const prequelOpenAtLabel = useMemo(
    () => formatPrequelOpenAt(prequel.openAt, selectedGame?.location),
    [prequel.openAt, selectedGame?.location],
  )
  const captainParticipation = useMemo(
    () =>
      (Array.isArray(selectedGame?.userParticipationTeams)
        ? selectedGame.userParticipationTeams
        : []
      ).find((entry) => Boolean(entry?.isCaptain)) || null,
    [selectedGame?.userParticipationTeams],
  )
  const captainGameTeamId =
    typeof captainParticipation?.gameTeamId === 'string'
      ? captainParticipation.gameTeamId.trim()
      : ''
  const initialPrequelProgresses = useMemo(
    () =>
      normalizePrequelProgresses(
        Array.isArray(captainParticipation?.prequelProgresses) &&
          captainParticipation.prequelProgresses.length > 0
          ? captainParticipation.prequelProgresses
          : captainParticipation?.prequelProgress
            ? [captainParticipation.prequelProgress]
            : [],
        prequels,
      ),
    [
      captainParticipation?.prequelProgress,
      captainParticipation?.prequelProgresses,
      prequels,
    ],
  )
  const [prequelProgresses, setPrequelProgresses] = useState(
    initialPrequelProgresses,
  )
  const prequelProgressById = useMemo(
    () =>
      new Map(
        prequelProgresses.map((item) => [String(item.prequelId || ''), item]),
      ),
    [prequelProgresses],
  )
  const prequelProgress = useMemo(
    () =>
      prequelProgressById.get(prequel.id) || {
        ...buildDefaultPrequelProgress(),
        prequelId: prequel.id || '',
      },
    [prequel.id, prequelProgressById],
  )
  const setPrequelProgress = useCallback(
    (nextProgress) => {
      const normalized = normalizePrequelProgress(nextProgress)
      queryClient.setQueryData(['prequel-progress', captainGameTeamId, prequel.id], normalized)
      void queryClient.invalidateQueries({ queryKey: ['cabinet-games'] })
      setPrequelProgresses((current) => {
        const index = current.findIndex(
          (item) => item.prequelId === prequel.id,
        )
        const next = [...current]
        const value = { ...normalized, prequelId: prequel.id || '' }
        if (index >= 0) next[index] = value
        else next.push(value)
        return next
      })
    },
    [prequel.id, captainGameTeamId, queryClient],
  )
  const isPrequelExhausted = useMemo(
    () => isPrequelProgressExhaustedForConfig(prequelProgress, prequel),
    [prequel, prequelProgress],
  )
  const isPrequelClosed = useMemo(
    () => isPrequelProgressClosedForConfig(prequelProgress, prequel),
    [prequel, prequelProgress],
  )
  const acceptedBonusCodeItems = useMemo(
    () => buildAcceptedPrequelCodeItems(prequelProgress, 'bonus_code'),
    [prequelProgress],
  )
  const acceptedPenaltyCodeItems = useMemo(
    () => buildAcceptedPrequelCodeItems(prequelProgress, 'penalty_code'),
    [prequelProgress],
  )

  useEffect(() => {
    setPrequelProgresses(prequels.map((config) => ({
      ...buildDefaultPrequelProgress(),
      ...initialPrequelProgresses.find((progress) => progress.prequelId === config.id),
      ...queryClient.getQueryData(['prequel-progress', captainGameTeamId, config.id]),
      prequelId: config.id,
    })))
  }, [initialPrequelProgresses, prequels, captainGameTeamId, queryClient])

  useEffect(() => {
    if (!isOpen) {
      setIsPrequelHelpOpen(false)
      setPrequelCode('')
      setPrequelFeedback(null)
      setIsPrequelSubmitting(false)
      setActivePrequelId('')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !prequel.openAt || isPrequelOpen) {
      return undefined
    }

    setPrequelNowTs(Date.now())
    const intervalId = window.setInterval(() => {
      setPrequelNowTs(Date.now())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [isOpen, isPrequelOpen, prequel.openAt])

  const canUsePrequel =
    !selectedGame?.dateStartFact &&
    Boolean(prequel.enabled) &&
    isPrequelReady &&
    isPrequelOpen &&
    Boolean(captainGameTeamId) &&
    Boolean(captainParticipation?.isCaptain) &&
    !isPrequelClosed &&
    String(selectedGame?.status || '').trim().toLowerCase() === 'active'
  const prequelStatusMessage =
    !isPrequelReady
      ? 'Приквел готовится к открытию.'
      : !isPrequelOpen
      ? `Задание приквела будет открыто ${prequelOpenAtLabel || 'в указанную дату и время'}.`
      : selectedGame?.dateStartFact || String(selectedGame?.status || '').trim().toLowerCase() !== 'active'
      ? 'После фактического старта игры ввод приквела недоступен.'
      : isPrequelExhausted
        ? 'Все доступные коды приквела для вашей команды уже найдены.'
      : isPrequelClosed
        ? 'Приквел выполнен вашей командой.'
        : 'Ввод приквела доступен только капитану зарегистрированной команды.'

  const handleSubmitPrequel = useCallback(
    async (event) => {
      event.preventDefault()
      if (!canUsePrequel || !captainGameTeamId) {
        return
      }

      const trimmedCode = prequelCode.trim()
      if (!trimmedCode) {
        setPrequelFeedback({ type: 'error', message: 'Введите код приквела' })
        return
      }

      setIsPrequelSubmitting(true)
      setPrequelFeedback(null)

      try {
        const { json } = await requestApiJson('/api/webapp/game-prequel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameTeamId: captainGameTeamId,
            prequelId: prequel.id,
            code: trimmedCode,
          }),
          fallbackMessage: 'Не удалось отправить код приквела',
        })

        setPrequelProgress(
          normalizePrequelProgress(json?.progress || buildDefaultPrequelProgress()),
        )
        setPrequelFeedback({
          type:
            json?.matchedCategory === 'wrong'
              ? 'info'
              : json?.matchedCategory === 'penalty'
                ? 'error'
                : 'success',
          message: json?.message || 'Код приквела обработан',
        })
        setPrequelCode('')
      } catch (error) {
        setPrequelFeedback({
          type: 'error',
          message: error?.message || 'Не удалось отправить код приквела',
        })
      } finally {
        setIsPrequelSubmitting(false)
      }
    },
    [
      canUsePrequel,
      captainGameTeamId,
      prequel.id,
      prequelCode,
      setPrequelProgress,
    ],
  )

  return (
    <>
        {hasVisiblePrequels && (
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 sm:p-5 dark:border-cyan-500/35 dark:bg-cyan-500/10">
            <div className="flex items-start justify-between gap-3">
              <ModalSectionTitle>{prequelSectionTitle}</ModalSectionTitle>
              <button
                type="button"
                onClick={() => setIsPrequelHelpOpen(true)}
                className="cursor-pointer text-xs font-semibold text-cyan-700 underline underline-offset-2 transition hover:text-cyan-600 dark:text-cyan-200 dark:hover:text-cyan-100"
              >
                Что такое приквел?
              </button>
            </div>
            {visiblePrequels.length > 1 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {visiblePrequels.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActivePrequelId(item.id)
                      setPrequelCode('')
                      setPrequelFeedback(null)
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      item.id === prequel.id
                        ? 'border-cyan-500 bg-cyan-600 text-white'
                        : 'border-cyan-200 bg-white text-cyan-800 dark:border-cyan-500/30 dark:bg-slate-900/70 dark:text-cyan-100'
                    }`}
                  >
                    <PrequelStatusIcon
                      prequel={item}
                      progress={prequelProgressById.get(item.id)}
                      nowTs={prequelNowTs}
                    />
                    {item.title || 'Приквел'}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="mt-3">
              <div className="border-t border-cyan-200/80 dark:border-cyan-500/20" />
              {isPrequelOpen && isPrequelReady ? (
                <TiptapContentView
                  html={prequel.descriptionRich}
                  text={prequel.description}
                  emptyText="Описание приквела не заполнено."
                  className="mt-3 text-slate-600 dark:prose-invert dark:text-slate-300"
                  textClassName="mt-3 text-sm text-slate-600 dark:text-slate-300"
                  emptyClassName="text-sm text-slate-500"
                />
              ) : (
                <p className="mt-3 text-sm font-medium text-cyan-900 dark:text-cyan-100">
                  {prequelStatusMessage}
                </p>
              )}
              <div className="mt-3 border-t border-cyan-200/80 dark:border-cyan-500/20" />
              {isPrequelOpen && Number(prequel.wrongAttemptsLimit) > 0 && (
                <p className="mt-3 text-xs text-cyan-800 dark:text-cyan-200">
                  Каждые {prequel.wrongAttemptsLimit} неверных кодов дают штраф.
                </p>
              )}
            </div>
            {canUsePrequel ? (
              <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmitPrequel}>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    value={prequelCode}
                    onChange={(event) => setPrequelCode(event.target.value)}
                    placeholder="Введите код приквела"
                    className="w-full rounded-xl border border-cyan-200 bg-white px-4 py-3 text-sm text-slate-800 focus:border-cyan-500 focus:outline-none dark:border-cyan-400/30 dark:bg-slate-900/70 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={isPrequelSubmitting}
                    className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPrequelSubmitting ? 'Отправка...' : 'Отправить код'}
                  </button>
                </div>
              </form>
            ) : isPrequelOpen ? (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                {prequelStatusMessage}
              </p>
            ) : null}

            {isPrequelOpen && prequelFeedback ? (
              <div
                className={`mt-3 rounded-xl px-3 py-2 text-sm ${
                  prequelFeedback.type === 'error'
                    ? 'border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
                    : prequelFeedback.type === 'info'
                      ? 'border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200'
                    : 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                }`}
              >
                {prequelFeedback.message}
              </div>
            ) : null}

            {isPrequelOpen ? (
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
                {Number(prequel.mainCodesCount) > 0 ? (
                  <span>
                    Основных кодов: {prequelProgress.foundMainCodes.length}/
                    {prequel.requiredMainCodesCount || prequel.mainCodesCount}
                  </span>
                ) : null}
                <span>Неверных кодов: {prequelProgress.wrongCodes.length}</span>
                {prequelProgress.completedAt ? (
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                    Выполнен
                  </span>
                ) : null}
              </div>
            ) : null}

            {isPrequelOpen && acceptedBonusCodeItems.length > 0 ? (
              <div className="mt-3">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                  Принятые бонусные коды:
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {acceptedBonusCodeItems.map((item, index) => (
                    <span
                      key={`prequel-bonus-code-${index}-${item.code}`}
                      className="inline-flex items-center rounded-full border border-emerald-300/70 bg-emerald-50/90 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-100"
                      title={item.description || undefined}
                    >
                      {item.code}
                      {item.description ? ` — ${item.description}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {isPrequelOpen && acceptedPenaltyCodeItems.length > 0 ? (
              <div className="mt-3">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                  Принятые штрафные коды:
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {acceptedPenaltyCodeItems.map((item, index) => (
                    <span
                      key={`prequel-penalty-code-${index}-${item.code}`}
                      className="inline-flex items-center rounded-full border border-rose-300/70 bg-rose-50/90 px-3 py-1 text-xs font-semibold tracking-wide text-rose-800 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-100"
                      title={item.description || undefined}
                    >
                      {item.code}
                      {item.description ? ` — ${item.description}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      <Modal
        isOpen={isPrequelHelpOpen}
        onClose={() => setIsPrequelHelpOpen(false)}
        title="Что такое приквел?"
        compactMobile
      >
        <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
          <p>
            Приквел — это дополнительное задание для всех команд,
            зарегистрированных на игру, которое доступно до фактического старта.
          </p>
          <p>
            Капитан зарегистрированной команды может вводить коды приквела прямо
            в описании игры после его открытия. Верные коды дают бонус, а
            некоторые коды или серии неверных попыток могут дать штраф.
          </p>
          <p>
            После фактического старта игры ввод приквела закрывается, а
            полученные корректировки учитываются в результате команды.
          </p>
        </div>
      </Modal>
    </>
  )
}

GamePrequelPanel.propTypes = {
  selectedGame: PropTypes.shape({
    id: PropTypes.string,
    status: PropTypes.string,
    location: PropTypes.string,
    dateStartFact: PropTypes.string,
    prequel: PropTypes.object,
    prequels: PropTypes.arrayOf(PropTypes.object),
    userParticipationTeams: PropTypes.arrayOf(PropTypes.object),
  }),
  isOpen: PropTypes.bool.isRequired,
}

export default memo(GamePrequelPanel)
