import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import PrequelStatusIcon from '@components/PrequelStatusIcon'
import CopyableId from '@components/cabinet/CopyableId'
import TiptapContentView from '@components/cabinet/TiptapContentView'
import UserTeamCard from '@components/cabinet/cards/UserTeamCard'
import formatDateInLocationTimeZone from '@helpers/formatDateInLocationTimeZone'
import requestApiJson from '@helpers/requestApiJson'
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
import { LOCATIONS } from '@server/serverConstants'
import ModalSection from './ModalSection'
import ModalSectionTitle from './ModalSectionTitle'

const resolveLocationLabel = (locationKey) => {
  const normalized =
    typeof locationKey === 'string' ? locationKey.trim().toLowerCase() : ''
  if (!normalized) {
    return 'Не указан'
  }
  const townRu = LOCATIONS?.[normalized]?.townRu
  if (typeof townRu !== 'string' || !townRu.trim()) {
    return locationKey
  }
  return townRu.charAt(0).toUpperCase() + townRu.slice(1)
}

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

const GameDescriptionModal = ({
  selectedGame,
  isDescriptionModalOpen,
  handleCloseDescriptionModal,
  gameTypeLabel,
  plannedStartLabel,
  canViewRestrictedGameInfo,
  canViewGameResults,
  handleOpenResultsModal,
  onOpenTeam,
  participationSummaryLabel,
  canJoinGame,
  canEnterGame,
  canCancelRegistration,
  onJoinGame,
  onEnterGame,
  onCancelRegistration,
  isRegistrationSubmitting,
  taskDurationLabel,
  cluesDurationLabel,
  clueModeDetails,
  breakDurationLabel,
  taskFailurePenaltyLabel,
  manyCodesLimitLabel,
  manyCodesPenaltyLabel,
  taskCountLabel,
  currencyFormatter,
}) => {
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
  const hasVisiblePrequels = visiblePrequels.some((item) =>
    isPrequelReadyForPlayers(item),
  )
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
    [prequel.id],
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
    setPrequelProgresses(initialPrequelProgresses)
  }, [initialPrequelProgresses])

  useEffect(() => {
    if (!isDescriptionModalOpen) {
      setIsPrequelHelpOpen(false)
      setPrequelCode('')
      setPrequelFeedback(null)
      setIsPrequelSubmitting(false)
      setActivePrequelId('')
    }
  }, [isDescriptionModalOpen])

  useEffect(() => {
    if (!isDescriptionModalOpen || !prequel.openAt || isPrequelOpen) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setPrequelNowTs(Date.now())
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [isDescriptionModalOpen, isPrequelOpen, prequel.openAt])

  const canUsePrequel =
    Boolean(prequel.enabled) &&
    isPrequelReady &&
    isPrequelOpen &&
    Boolean(captainGameTeamId) &&
    Boolean(captainParticipation?.isCaptain) &&
    !isPrequelClosed &&
    String(selectedGame?.status || '').trim().toLowerCase() === 'active'
  const prequelStatusMessage =
    !isPrequelOpen
      ? `Задание приквела будет открыто ${prequelOpenAtLabel || 'в указанную дату и время'}.`
      : String(selectedGame?.status || '').trim().toLowerCase() !== 'active'
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
      <Modal
        isOpen={isDescriptionModalOpen}
        title={`Игра — ${selectedGame?.name || 'Без названия'}`}
        onClose={handleCloseDescriptionModal}
      >
        {selectedGame ? (
          <div className="space-y-6">
        <ModalSection className="p-4 sm:p-5">
          <ModalSectionTitle>Общая информация</ModalSectionTitle>
          {selectedGame.image && (
            <img
              src={selectedGame.image}
              alt="Обложка игры"
              className="mt-4 max-h-[60vh] w-full rounded-xl object-contain"
            />
          )}
          <div className="mt-3 text-sm text-slate-700 dark:text-slate-300">
            <span className="font-semibold">Город проведения:</span>{' '}
            {resolveLocationLabel(selectedGame.location)}
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Тип игры
              </dt>
              <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                {gameTypeLabel}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Плановое начало
              </dt>
              <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                {plannedStartLabel}
              </dd>
            </div>
            {canViewRestrictedGameInfo && selectedGame?.id ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  ID
                </dt>
                <dd className="mt-1">
                  <CopyableId id={selectedGame.id} label="Game ID" />
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Место старта
              </dt>
              <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                {selectedGame.startingPlace || 'Не указано'}
              </dd>
            </div>
            {(canViewRestrictedGameInfo || selectedGame.showFinishingPlace) && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Финиш
                </dt>
                <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {selectedGame.finishingPlace || 'Не указан'}
                </dd>
              </div>
            )}
            {canViewRestrictedGameInfo && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Показывать место окончания
                </dt>
                <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {selectedGame.showFinishingPlace ? 'Да' : 'Нет'}
                </dd>
              </div>
            )}
            {canViewRestrictedGameInfo && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Индивидуальный старт
                </dt>
                <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {selectedGame.individualStart ? 'Да' : 'Нет'}
                </dd>
              </div>
            )}
            {canViewRestrictedGameInfo && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Показывать организатора
                </dt>
                <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {selectedGame.showCreator ? 'Да' : 'Нет'}
                </dd>
              </div>
            )}
            {canViewRestrictedGameInfo && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Публиковать задания в кабинете
                </dt>
                <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {selectedGame.showTasks
                    ? selectedGame.showTasksAudience === 'participants'
                      ? 'Только участникам'
                      : 'Всем'
                    : 'Нет'}
                </dd>
              </div>
            )}
            {taskCountLabel ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Количество заданий
                </dt>
                <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {taskCountLabel}
                </dd>
              </div>
            ) : null}
            {canViewRestrictedGameInfo && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Показывать результаты
                </dt>
                <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {!selectedGame.hideResult ? 'Да' : 'Нет'}
                </dd>
              </div>
            )}
            {selectedGame.showCreator && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Контакт организатора
                </dt>
                <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {selectedGame?.creator?.name?.trim()
                    ? selectedGame.creator.name
                    : selectedGame?.creator?.username?.trim()
                      ? `@${selectedGame.creator.username}`
                      : 'Не указан'}
                  {selectedGame?.creator?.username?.trim() &&
                  selectedGame?.creator?.name?.trim() ? (
                    <>
                      {' '}
                      (
                      <a
                        href={`https://t.me/${selectedGame.creator.username.trim()}`}
                        target="_blank"
                        rel="noreferrer"
                        className="cursor-pointer text-cyan-700 underline underline-offset-2 transition hover:text-cyan-600 dark:text-cyan-200 dark:hover:text-cyan-100"
                      >
                        @{selectedGame.creator.username.trim()}
                      </a>
                      )
                    </>
                  ) : null}
                  {selectedGame?.creator?.phone?.trim() ? (
                    <>
                      <br />
                      <a
                        href={`tel:${selectedGame.creator.phone.trim()}`}
                        className="cursor-pointer text-cyan-700 underline underline-offset-2 transition hover:text-cyan-600 dark:text-cyan-200 dark:hover:text-cyan-100"
                      >
                        {selectedGame.creator.phone.trim()}
                      </a>
                    </>
                  ) : null}
                </dd>
              </div>
            )}
          </dl>
          {(participationSummaryLabel ||
            canJoinGame ||
            canEnterGame ||
            canCancelRegistration) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {participationSummaryLabel && (
                <span className="inline-flex items-center rounded-full border border-emerald-300/70 bg-emerald-50/90 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/12 dark:text-emerald-200">
                  {participationSummaryLabel}
                </span>
              )}
              {canEnterGame && (
                <button
                  type="button"
                  onClick={onEnterGame}
                  className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-emerald-300/70 bg-emerald-50/80 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-500 hover:bg-emerald-100 dark:border-emerald-400/50 dark:bg-emerald-500/12 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
                >
                  Зайти в игру
                </button>
              )}
              {canJoinGame && (
                <button
                  type="button"
                  onClick={onJoinGame}
                  disabled={isRegistrationSubmitting}
                  className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-cyan-300/70 bg-cyan-50/85 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:border-cyan-500 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#00D1FF]/45 dark:bg-[#00D1FF]/14 dark:text-[#bdf4ff] dark:hover:bg-[#00D1FF]/24"
                >
                  Присоединиться к игре
                </button>
              )}
              {canCancelRegistration && (
                <button
                  type="button"
                  onClick={onCancelRegistration}
                  disabled={isRegistrationSubmitting}
                  className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-rose-300/70 bg-rose-50/80 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-500 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-400/50 dark:bg-rose-500/12 dark:text-rose-200 dark:hover:bg-rose-500/20"
                >
                  Снять команду с игры
                </button>
              )}
            </div>
          )}
        </ModalSection>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 dark:border-slate-700 dark:bg-slate-800/60">
          <ModalSectionTitle>Описание</ModalSectionTitle>
          <div className="mt-3">
            <TiptapContentView
              html={selectedGame.descriptionRich}
              text={selectedGame.description}
              emptyText="Описание для этой игры не заполнено."
              className="text-slate-600 dark:prose-invert dark:text-slate-300"
              textClassName="text-sm text-slate-600 dark:text-slate-300"
              emptyClassName="text-sm text-slate-500"
            />
          </div>
        </div>

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
              {isPrequelOpen ? (
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

        {canViewGameResults && (
          <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 sm:p-5 shadow-sm dark:border-cyan-500/35 dark:bg-cyan-500/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <ModalSectionTitle>Результаты игры</ModalSectionTitle>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Игра завершена, можно открыть итоговую таблицу команд.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenResultsModal}
                className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Посмотреть результаты
              </button>
            </div>
          </section>
        )}

        {canViewGameResults &&
          Array.isArray(selectedGame?.result?.teams) &&
          selectedGame.result.teams.length > 0 && (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5 shadow-sm dark:border-emerald-500/35 dark:bg-emerald-500/10">
              <ModalSectionTitle className="mb-4">
                Команды участников
              </ModalSectionTitle>
              <ul className="space-y-3">
                {selectedGame.result.teams.map((team) => (
                  <li key={team?.id || team?.teamId}>
                    <button
                      type="button"
                      onClick={() => onOpenTeam?.(team)}
                      className="w-full text-left hover:opacity-80 transition-opacity focus:outline-none"
                    >
                      <UserTeamCard
                        team={{
                          id: team?.id || team?.teamId || '',
                          name: team?.name || team?.teamName || 'Без названия',
                          image: team?.image || '',
                          isCaptain: false,
                          gamesCount: Number(team?.gamesCount) || 0,
                        }}
                        onOpen={onOpenTeam}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

        <ModalSection className="p-4 sm:p-5">
          <ModalSectionTitle>Параметры проведения</ModalSectionTitle>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Длительность задания
              </dt>
              <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                {taskDurationLabel}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Интервал подсказок
              </dt>
              <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                {cluesDurationLabel}
              </dd>
            </div>
            {canViewRestrictedGameInfo && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Режим досрочной подсказки
                </dt>
                <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {clueModeDetails.modeLabel}
                  <br />
                  <span className="text-xs text-slate-500">
                    {clueModeDetails.valueLabel}
                  </span>
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Перерыв между заданиями
              </dt>
              <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                {breakDurationLabel}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Штраф за невыполненное задание
              </dt>
              <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                {taskFailurePenaltyLabel}
              </dd>
            </div>
            {canViewRestrictedGameInfo && manyCodesLimitLabel && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Лимит неверных кодов
                </dt>
                <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {manyCodesLimitLabel}
                </dd>
              </div>
            )}
            {canViewRestrictedGameInfo && manyCodesPenaltyLabel && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Штраф за превышение лимита
                </dt>
                <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {manyCodesPenaltyLabel}
                </dd>
              </div>
            )}
          </dl>
        </ModalSection>

        <ModalSection className="p-4 sm:p-5">
          <ModalSectionTitle>Опции для капитана</ModalSectionTitle>
          <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${selectedGame.allowCaptainForceClue ? 'bg-emerald-500' : 'bg-slate-400'}`}
                aria-hidden="true"
              />
              <span>
                Капитан{' '}
                {selectedGame.allowCaptainForceClue ? 'может' : 'не может'}{' '}
                запрашивать подсказку
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${selectedGame.allowCaptainFailTask ? 'bg-emerald-500' : 'bg-slate-400'}`}
                aria-hidden="true"
              />
              <span>
                Капитан{' '}
                {selectedGame.allowCaptainFailTask ? 'может' : 'не может'}{' '}
                провалить задание
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${selectedGame.allowCaptainFinishBreak ? 'bg-emerald-500' : 'bg-slate-400'}`}
                aria-hidden="true"
              />
              <span>
                Капитан{' '}
                {selectedGame.allowCaptainFinishBreak ? 'может' : 'не может'}{' '}
                завершать перерыв
              </span>
            </li>
          </ul>
        </ModalSection>

        <ModalSection className="p-4 sm:p-5">
          <ModalSectionTitle>Стоимость участия</ModalSectionTitle>
          {selectedGame.prices?.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {selectedGame.prices.map((price) => (
                <li
                  key={price.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/80"
                >
                  <span className="text-slate-600 dark:text-slate-200">
                    {price.name || 'Без названия'}
                  </span>
                  <span className="aq-modal-item-title font-semibold">
                    {currencyFormatter.format(Number(price.price) || 0)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Стоимость участия не указана.
            </p>
          )}
        </ModalSection>
      </div>
    ) : (
      <p className="text-sm text-slate-500">
        Выберите игру из списка слева, чтобы просмотреть детали.
      </p>
    )}
      </Modal>
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

GameDescriptionModal.propTypes = {
  selectedGame: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    finishingPlace: PropTypes.string,
    showFinishingPlace: PropTypes.bool,
    status: PropTypes.string,
    location: PropTypes.string,
    showTasks: PropTypes.bool,
    showTasksAudience: PropTypes.oneOf(['all', 'participants']),
    prequel: PropTypes.object,
    prequels: PropTypes.arrayOf(PropTypes.object),
    userParticipationTeams: PropTypes.arrayOf(
      PropTypes.shape({
        teamId: PropTypes.string,
        gameTeamId: PropTypes.string,
        teamName: PropTypes.string,
        isCaptain: PropTypes.bool,
        prequelProgress: PropTypes.object,
        prequelProgresses: PropTypes.arrayOf(PropTypes.object),
      }),
    ),
  }),
  isDescriptionModalOpen: PropTypes.bool.isRequired,
  handleCloseDescriptionModal: PropTypes.func.isRequired,
  gameTypeLabel: PropTypes.string.isRequired,
  plannedStartLabel: PropTypes.string.isRequired,
  canViewRestrictedGameInfo: PropTypes.bool.isRequired,
  canViewGameResults: PropTypes.bool.isRequired,
  handleOpenResultsModal: PropTypes.func.isRequired,
  onOpenTeam: PropTypes.func,
  participationSummaryLabel: PropTypes.string,
  canJoinGame: PropTypes.bool,
  canEnterGame: PropTypes.bool,
  canCancelRegistration: PropTypes.bool,
  onJoinGame: PropTypes.func,
  onEnterGame: PropTypes.func,
  onCancelRegistration: PropTypes.func,
  isRegistrationSubmitting: PropTypes.bool,
  taskDurationLabel: PropTypes.string.isRequired,
  cluesDurationLabel: PropTypes.string.isRequired,
  clueModeDetails: PropTypes.shape({
    modeLabel: PropTypes.string.isRequired,
    valueLabel: PropTypes.string.isRequired,
  }).isRequired,
  breakDurationLabel: PropTypes.string.isRequired,
  taskFailurePenaltyLabel: PropTypes.string.isRequired,
  manyCodesLimitLabel: PropTypes.string,
  manyCodesPenaltyLabel: PropTypes.string,
  taskCountLabel: PropTypes.string,
  currencyFormatter: PropTypes.instanceOf(Intl.NumberFormat).isRequired,
}

GameDescriptionModal.defaultProps = {
  selectedGame: null,
  participationSummaryLabel: '',
  canJoinGame: false,
  canEnterGame: false,
  canCancelRegistration: false,
  onJoinGame: undefined,
  onEnterGame: undefined,
  onCancelRegistration: undefined,
  onOpenTeam: undefined,
  isRegistrationSubmitting: false,
  manyCodesLimitLabel: null,
  manyCodesPenaltyLabel: null,
  taskCountLabel: '',
}

export default memo(GameDescriptionModal)
