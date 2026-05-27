import { useCallback, useMemo, useState } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'

const normalizeText = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

const extractDigits = (value) =>
  typeof value === 'string' ? value.replace(/\D/g, '') : ''

const getMembersCount = (team) =>
  Number.isFinite(team?.membersCount)
    ? team.membersCount
    : Array.isArray(team?.members)
      ? team.members.length
      : 0

const buildTeamSearchIndex = (team) => {
  const members = Array.isArray(team?.members) ? team.members : []
  const parts = [
    team?.id,
    team?.name,
    team?.description,
    ...members.flatMap((member) => [
      member?.name,
      member?.username,
      member?.phone,
      member?.telegramId,
    ]),
  ]

  return parts
    .map((value) => normalizeText(String(value || '')))
    .filter(Boolean)
    .join(' ')
}

const matchesTeamSearch = (team, query) => {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) {
    return true
  }

  const textIndex = buildTeamSearchIndex(team)
  if (textIndex.includes(normalizedQuery)) {
    return true
  }

  const queryDigits = extractDigits(normalizedQuery)
  if (!queryDigits) {
    return false
  }

  const members = Array.isArray(team?.members) ? team.members : []
  const phoneDigits = members
    .map((member) => extractDigits(String(member?.phone || '')))
    .filter(Boolean)

  return phoneDigits.some((digits) => digits.includes(queryDigits))
}

const TeamSelectField = ({
  label,
  teams,
  selectedTeamId,
  onSelect,
  onClear,
  disabled,
  placeholder,
  modalTitle,
  searchPlaceholder,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selectedTeam = useMemo(
    () =>
      (Array.isArray(teams) ? teams : []).find((team) => team?.id === selectedTeamId) ??
      null,
    [selectedTeamId, teams],
  )

  const filteredTeams = useMemo(() => {
    const items = Array.isArray(teams) ? teams : []
    return items.filter((team) => matchesTeamSearch(team, search))
  }, [search, teams])

  const openModal = useCallback(() => {
    setSearch('')
    setIsModalOpen(true)
  }, [])

  const handleSelect = useCallback(
    (team) => {
      if (!team?.id) {
        return
      }

      onSelect?.(team.id)
      setIsModalOpen(false)
    },
    [onSelect],
  )

  const selectedLabel = selectedTeam?.name || placeholder
  const selectedMeta = selectedTeam
    ? `${getMembersCount(selectedTeam)} участ.`
    : ''

  return (
    <div className="space-y-1.5">
      {label ? (
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">
          {label}
        </p>
      ) : null}
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={openModal}
          disabled={disabled}
          className={`min-h-[44px] flex-1 rounded-xl border px-3 py-2 text-left transition ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900`}
        >
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {selectedLabel}
          </p>
          {selectedMeta ? (
            <p className="truncate text-xs text-slate-500 dark:text-slate-300">
              {selectedMeta}
            </p>
          ) : null}
        </button>
        {selectedTeam ? (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="h-[44px] w-[44px] cursor-pointer rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            aria-label="Сбросить выбор команды"
          >
            x
          </button>
        ) : null}
      </div>

      <Modal
        isOpen={isModalOpen}
        title={modalTitle}
        onClose={() => setIsModalOpen(false)}
        footer={
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            className="aq-modal-btn aq-modal-btn-secondary"
          >
            Закрыть
          </button>
        }
      >
        <div className="space-y-3">
          <input
            className={INPUT_CLASS}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
          />

          <div className="space-y-2">
            {filteredTeams.map((team) => {
              const membersCount = getMembersCount(team)
              const memberNames = (Array.isArray(team?.members) ? team.members : [])
                .map((member) => member?.name || member?.username || '')
                .filter(Boolean)
                .slice(0, 3)
                .join(', ')

              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => handleSelect(team)}
                  className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-cyan-400 hover:bg-cyan-50 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-cyan-500/50 dark:hover:bg-cyan-500/10"
                >
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {team.name || 'Без названия'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    ID: {team.id} · Участников: {membersCount}
                  </p>
                  {memberNames ? (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                      {memberNames}
                    </p>
                  ) : null}
                </button>
              )
            })}
          </div>

          {filteredTeams.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Ничего не найдено
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  )
}

TeamSelectField.propTypes = {
  label: PropTypes.string,
  teams: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string,
      description: PropTypes.string,
      membersCount: PropTypes.number,
      members: PropTypes.arrayOf(
        PropTypes.shape({
          name: PropTypes.string,
          username: PropTypes.string,
          phone: PropTypes.string,
          telegramId: PropTypes.string,
        }),
      ),
    }),
  ),
  selectedTeamId: PropTypes.string,
  onSelect: PropTypes.func,
  onClear: PropTypes.func,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string,
  modalTitle: PropTypes.string,
  searchPlaceholder: PropTypes.string,
}

TeamSelectField.defaultProps = {
  label: 'Команда',
  teams: [],
  selectedTeamId: '',
  onSelect: undefined,
  onClear: undefined,
  disabled: false,
  placeholder: 'Выбрать команду',
  modalTitle: 'Выбор команды',
  searchPlaceholder:
    'Поиск по ID команды, названию, имени участника или телефону',
}

export default TeamSelectField
