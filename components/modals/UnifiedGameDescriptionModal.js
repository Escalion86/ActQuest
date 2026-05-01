import { memo, useMemo } from 'react'
import PropTypes from 'prop-types'

import GameDescriptionModal from '@components/modals/GameDescriptionModal'
import formatDateInLocationTimeZone from '@helpers/formatDateInLocationTimeZone'
import getGameStatusLabel from '@helpers/getGameStatusLabel'

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
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        maximumFractionDigits: 0,
      }),
    [],
  )

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

  const financesSummary = useMemo(() => {
    if (!selectedGame?.finances) {
      return { income: 0, expense: 0, balance: 0 }
    }

    const { income, expense } = selectedGame.finances.reduce(
      (acc, entry) => {
        if (entry.type === 'expense') {
          acc.expense += Number(entry.sum) || 0
        } else {
          acc.income += Number(entry.sum) || 0
        }
        return acc
      },
      { income: 0, expense: 0 },
    )

    return { income, expense, balance: income - expense }
  }, [selectedGame?.finances])

  const balanceClass =
    financesSummary.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'

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
      currencyFormatter={currencyFormatter}
      financesSummary={financesSummary}
      balanceClass={balanceClass}
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
