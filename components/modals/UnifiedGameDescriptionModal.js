import { memo, useMemo } from 'react'
import PropTypes from 'prop-types'

import GameDescriptionModal from '@components/modals/GameDescriptionModal'
import formatDateInLocationTimeZone from '@helpers/formatDateInLocationTimeZone'
import {
  buildGameTaskCountLabel,
  getVisibleGameTaskCounts,
} from '@helpers/gameTaskCounts'

const GAME_TYPE_OPTIONS = [
  { value: 'classic', label: 'Классика' },
  { value: 'photo', label: 'Фотоквест' },
]

const CLUE_EARLY_MODE_OPTIONS = [
  { value: 'time', label: 'Добавить время до следующей подсказки' },
  { value: 'penalty', label: 'Штраф организатора за подсказку' },
]

const toMinutes = (seconds) => {
  const numeric = Number(seconds)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0
  }
  return Math.round(numeric / 60)
}

const UnifiedGameDescriptionModal = ({
  selectedGame,
  isOpen,
  onClose,
  canViewRestrictedGameInfo,
  canViewGameResults,
  onOpenResults,
  onOpenTeam,
}) => {
  const gameTypeLabel = useMemo(() => {
    const option = GAME_TYPE_OPTIONS.find(
      (item) => item.value === selectedGame?.type,
    )
    return option?.label ?? selectedGame?.type ?? '—'
  }, [selectedGame?.type])

  const plannedStartLabel = useMemo(() => {
    if (!selectedGame?.dateStart) {
      return 'Дата не назначена'
    }

    return formatDateInLocationTimeZone(selectedGame.dateStart, selectedGame.location, {
      dateStyle: 'full',
      timeStyle: 'short',
    })
  }, [selectedGame?.dateStart, selectedGame?.location])

  const taskDurationLabel = useMemo(() => {
    if (!selectedGame) {
      return '—'
    }

    if (selectedGame.type === 'photo') {
      const value = Number(selectedGame.taskDuration) || 0
      return value > 0 ? `${value} баллов` : 'Без базового бонуса'
    }

    const minutes = toMinutes(selectedGame.taskDuration)
    return minutes > 0 ? `${minutes} мин` : 'Без ограничения'
  }, [selectedGame])

  const cluesDurationLabel = useMemo(() => {
    if (!selectedGame) {
      return '—'
    }

    const minutes = toMinutes(selectedGame.cluesDuration)
    return minutes > 0 ? `Каждые ${minutes} мин` : 'Подсказки отключены'
  }, [selectedGame])

  const clueModeDetails = useMemo(() => {
    if (!selectedGame) {
      return { modeLabel: '—', valueLabel: '—' }
    }

    const option = CLUE_EARLY_MODE_OPTIONS.find(
      (item) => item.value === selectedGame.clueEarlyAccessMode,
    )
    const minutes = toMinutes(selectedGame.clueEarlyPenalty)

    if (selectedGame.clueEarlyAccessMode === 'penalty') {
      return {
        modeLabel: option?.label ?? '—',
        valueLabel:
          minutes > 0 ? `Штраф ${minutes} мин` : 'Штраф не применяется',
      }
    }

    return {
      modeLabel: option?.label ?? '—',
      valueLabel:
        minutes > 0
          ? `После подсказки добавляется ${minutes} мин ожидания`
          : 'Без дополнительного времени',
    }
  }, [selectedGame])

  const breakDurationLabel = useMemo(() => {
    if (!selectedGame) {
      return '—'
    }

    const minutes = toMinutes(selectedGame.breakDuration)
    return minutes > 0 ? `${minutes} мин` : 'Без перерывов'
  }, [selectedGame])

  const taskFailurePenaltyLabel = useMemo(() => {
    if (!selectedGame) {
      return '—'
    }

    if (selectedGame.type === 'photo') {
      const value = Number(selectedGame.taskFailurePenalty) || 0
      return value > 0 ? `${value} баллов` : 'Штраф отсутствует'
    }

    const minutes = toMinutes(selectedGame.taskFailurePenalty)
    return minutes > 0 ? `${minutes} мин` : 'Штраф отсутствует'
  }, [selectedGame])

  const manyCodesLimitLabel = useMemo(() => {
    if (!selectedGame || selectedGame.type === 'photo') {
      return null
    }

    const limit = Number(selectedGame.manyCodesPenalty?.[0]) || 0
    return limit > 0 ? `${limit} попыток` : 'Лимит не задан'
  }, [selectedGame])

  const manyCodesPenaltyLabel = useMemo(() => {
    if (!selectedGame || selectedGame.type === 'photo') {
      return null
    }

    const seconds = Number(selectedGame.manyCodesPenalty?.[1]) || 0
    const minutes = toMinutes(seconds)
    return minutes > 0 ? `${minutes} мин` : 'Без штрафа'
  }, [selectedGame])

  const taskCountLabel = useMemo(
    () => buildGameTaskCountLabel(getVisibleGameTaskCounts(selectedGame)),
    [selectedGame],
  )

  return (
    <GameDescriptionModal
      selectedGame={selectedGame}
      isDescriptionModalOpen={isOpen}
      handleCloseDescriptionModal={onClose}
      gameTypeLabel={gameTypeLabel}
      plannedStartLabel={plannedStartLabel}
      canViewRestrictedGameInfo={canViewRestrictedGameInfo}
      canViewGameResults={canViewGameResults}
      handleOpenResultsModal={
        typeof onOpenResults === 'function' ? onOpenResults : () => {}
      }
      onOpenTeam={onOpenTeam}
      taskDurationLabel={taskDurationLabel}
      cluesDurationLabel={cluesDurationLabel}
      clueModeDetails={clueModeDetails}
      breakDurationLabel={breakDurationLabel}
      taskFailurePenaltyLabel={taskFailurePenaltyLabel}
      manyCodesLimitLabel={manyCodesLimitLabel}
      manyCodesPenaltyLabel={manyCodesPenaltyLabel}
      taskCountLabel={taskCountLabel}
    />
  )
}

UnifiedGameDescriptionModal.propTypes = {
  selectedGame: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    status: PropTypes.string,
    type: PropTypes.string,
    dateStart: PropTypes.string,
    showTasksAudience: PropTypes.oneOf(['all', 'participants']),
    showTasksCountInGame: PropTypes.bool,
    tasks: PropTypes.array,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  canViewRestrictedGameInfo: PropTypes.bool,
  canViewGameResults: PropTypes.bool,
  onOpenResults: PropTypes.func,
  onOpenTeam: PropTypes.func,
}

UnifiedGameDescriptionModal.defaultProps = {
  selectedGame: null,
  canViewRestrictedGameInfo: true,
  canViewGameResults: false,
  onOpenResults: undefined,
  onOpenTeam: undefined,
}

export default memo(UnifiedGameDescriptionModal)
