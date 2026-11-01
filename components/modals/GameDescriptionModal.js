import { memo, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useQuery } from '@tanstack/react-query'

import Modal from '@components/Modal'
import CopyableId from '@components/cabinet/CopyableId'
import TiptapContentView from '@components/cabinet/TiptapContentView'
import UserTeamCard from '@components/cabinet/cards/UserTeamCard'
import requestApiJson from '@helpers/requestApiJson'
import getTelegramUserHref from '@helpers/getTelegramUserHref'
import { LOCATIONS } from '@server/serverConstants'
import GamePrequelPanel from './GamePrequelPanel'
import ModalSection from './ModalSection'
import ModalSectionTitle from './ModalSectionTitle'

const REVIEW_TAG_LABELS = {
  interesting_tasks: 'Интересные задания',
  atmosphere: 'Атмосфера',
  organization: 'Организация',
  story: 'Сюжет',
  route_and_locations: 'Маршрут и локации',
  teamwork: 'Командная игра',
  unexpected_moments: 'Неожиданные моменты',
  actors: 'Актёры',
}

const getReviewCountLabel = (count) => {
  const numeric = Math.max(0, Math.trunc(Number(count) || 0))
  const modulo100 = numeric % 100
  const modulo10 = numeric % 10
  if (modulo100 >= 11 && modulo100 <= 14) return `${numeric} оценок`
  if (modulo10 === 1) return `${numeric} оценка`
  if (modulo10 >= 2 && modulo10 <= 4) return `${numeric} оценки`
  return `${numeric} оценок`
}

const toRatingOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 1 && numeric <= 10
    ? numeric
    : null
}

const formatReviewDate = (value) => {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(date)
}

const loadPublishedGameReviews = async (gameId) => {
  const { json } = await requestApiJson(
    `/api/cabinet/games/${encodeURIComponent(gameId)}/published-reviews`,
    { fallbackMessage: 'Не удалось загрузить отзывы' },
  )
  return json?.data || { items: [], meta: {} }
}

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
  const [isReviewsOpen, setIsReviewsOpen] = useState(false)
  useEffect(() => {
    if (!isDescriptionModalOpen) setIsReviewsOpen(false)
  }, [isDescriptionModalOpen])
  const normalizedGameStatus = String(selectedGame?.status || '')
    .trim()
    .toLowerCase()
  const isGameCompleted =
    normalizedGameStatus === 'finished' || normalizedGameStatus === 'closed'

  const publishedReviewsQuery = useQuery({
    queryKey: ['published-game-reviews', selectedGame?.id],
    queryFn: () => loadPublishedGameReviews(selectedGame.id),
    enabled: Boolean(
      isDescriptionModalOpen && isGameCompleted && selectedGame?.id,
    ),
    staleTime: 60_000,
  })

  const publishedReviewsData = publishedReviewsQuery.data || {
    items: [],
    meta: {},
  }
  const publishedReviews = Array.isArray(publishedReviewsData.items)
    ? publishedReviewsData.items
    : []
  const reviewsCount = Math.max(
    0,
    Number(
      publishedReviewsData.meta?.reviewsCount ?? selectedGame?.reviewsCount,
    ) || 0,
  )
  const averageRating = toRatingOrNull(
    publishedReviewsData.meta?.averageRating ??
      selectedGame?.reviewAverageRating,
  )
  const averageDifficultyRating = toRatingOrNull(
    publishedReviewsData.meta?.averageDifficultyRating ??
      selectedGame?.reviewAverageDifficultyRating,
  )


  return (
    <>
      <Modal
        isOpen={isDescriptionModalOpen && !isReviewsOpen}
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
                  {selectedGame.hideResult ? 'Не показывать' : selectedGame.showResultAudience === 'participants' ? 'Только участникам' : 'Всем'}
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
                        href={getTelegramUserHref(
                          selectedGame.creator.username,
                          { type: 'username' },
                        )}
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
                  {selectedGame?.participationMode === 'player'
                    ? 'Зарегистрироваться на игру'
                    : 'Присоединиться к игре'}
                </button>
              )}
              {canCancelRegistration && (
                <button
                  type="button"
                  onClick={onCancelRegistration}
                  disabled={isRegistrationSubmitting}
                  className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-rose-300/70 bg-rose-50/80 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-500 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-400/50 dark:bg-rose-500/12 dark:text-rose-200 dark:hover:bg-rose-500/20"
                >
                  {selectedGame?.participationMode === 'player'
                    ? 'Отменить регистрацию'
                    : 'Снять команду с игры'}
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

        {isGameCompleted ? (
          <ModalSection className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <ModalSectionTitle>Отзывы</ModalSectionTitle>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-800 dark:border-amber-400/45 dark:bg-amber-500/12 dark:text-amber-100">
                    {averageRating ?? '—'} ★
                  </span>
                  <span className="inline-flex items-center rounded-full border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-bold text-violet-800 dark:border-violet-400/45 dark:bg-violet-500/12 dark:text-violet-100">
                    {averageDifficultyRating ?? '—'} ◈
                  </span>
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {getReviewCountLabel(reviewsCount)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReviewsOpen(true)}
                className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-cyan-400 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-100 dark:border-cyan-500/45 dark:bg-cyan-500/12 dark:text-cyan-100 dark:hover:bg-cyan-500/20"
              >
                Посмотреть отзывы
              </button>
            </div>
          </ModalSection>
        ) : null}

        <GamePrequelPanel
          key={selectedGame?.id}
          selectedGame={selectedGame}
          isOpen={isDescriptionModalOpen}
        />

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
        isOpen={isDescriptionModalOpen && isGameCompleted && isReviewsOpen}
        onClose={() => setIsReviewsOpen(false)}
        title={`Отзывы — ${selectedGame?.name || 'игра'}`}
        dialogClassName="md:max-w-3xl"
      >
        {publishedReviewsQuery.isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Загружаем отзывы…
          </p>
        ) : publishedReviewsQuery.isError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-200">
            {publishedReviewsQuery.error?.message ||
              'Не удалось загрузить отзывы'}
          </div>
        ) : publishedReviews.length > 0 ? (
          <div className="space-y-4">
            {publishedReviews.map((review) => (
              <article
                key={review.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-amber-700 dark:text-amber-200">
                      {review.overallRating} ★
                    </span>
                    {review.difficultyRating ? (
                      <span className="font-bold text-violet-700 dark:text-violet-200">
                        {review.difficultyRating} ◈
                      </span>
                    ) : null}
                    {review.isOwn && review.moderationStatus === 'pending' ? (
                      <span className="rounded-full border border-cyan-300 bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">
                        Ваш отзыв · на модерации
                      </span>
                    ) : null}
                    {review.isOwn && review.moderationStatus === 'rejected' ? (
                      <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                        Ваш отзыв · не опубликован
                      </span>
                    ) : null}
                    {review.isRatingIncluded === false ? (
                      <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-700/70 dark:text-slate-200">
                        Не учитывается в рейтинге
                      </span>
                    ) : null}
                  </div>
                  {formatReviewDate(review.createdAt) ? (
                    <time className="text-xs text-slate-500 dark:text-slate-400">
                      {formatReviewDate(review.createdAt)}
                    </time>
                  ) : null}
                </div>

                {Array.isArray(review.tags) && review.tags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {review.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-300"
                      >
                        {REVIEW_TAG_LABELS[tag] || tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                {review.likedText ? (
                  <div className="mt-3 text-sm text-slate-700 dark:text-slate-200">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      Понравилось
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">
                      {review.likedText}
                    </p>
                  </div>
                ) : null}

                {review.improvementText ? (
                  <div className="mt-3 text-sm text-slate-700 dark:text-slate-200">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                      Можно улучшить
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">
                      {review.improvementText}
                    </p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Пока нет отзывов, разрешённых к публикации.
          </p>
        )}
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
    showResultAudience: PropTypes.oneOf(['all', 'participants']),
    prequel: PropTypes.object,
    prequels: PropTypes.arrayOf(PropTypes.object),
    reviewAverageRating: PropTypes.number,
    reviewAverageDifficultyRating: PropTypes.number,
    reviewsCount: PropTypes.number,
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
