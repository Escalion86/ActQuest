'use client'

import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'

const fieldClassName =
  'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60'

const normalizeArray = (value) => (Array.isArray(value) ? value : [])

const investigationDefaults = {
  startNodeId: null,
  startClockMinutes: 0,
  deadlineMinutes: 240,
  defaultTravelTimeMinutes: 10,
  defaultInteractionTimeMinutes: 10,
  accusationTimeMinutes: 10,
  allowFreeReplay: true,
  showClockToTeam: true,
  showEvidenceToTeam: true,
  autoFailOnDeadline: true,
  revealSolutionAfterFinish: false,
}

const JsonScenarioField = ({
  label,
  value,
  expectedType,
  onChange,
  disabled,
}) => {
  const [draft, setDraft] = useState(() => JSON.stringify(value, null, 2))
  const [jsonError, setJsonError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setDraft(JSON.stringify(value, null, 2))
  }, [value])

  const visibleItems = Array.isArray(value)
    ? value.filter((item) =>
        JSON.stringify(item).toLowerCase().includes(search.toLowerCase()),
      )
    : []

  const applyJson = () => {
    try {
      const parsed = JSON.parse(draft)
      const valid =
        expectedType === 'array'
          ? Array.isArray(parsed)
          : parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      if (!valid) {
        throw new Error(
          expectedType === 'array'
            ? 'Ожидается JSON-массив.'
            : 'Ожидается JSON-объект.',
        )
      }
      onChange(parsed)
      setJsonError('')
    } catch (parseError) {
      setJsonError(parseError?.message || 'Некорректный JSON')
    }
  }

  return (
    <details className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">
        {label}
        {Array.isArray(value) ? ` · ${value.length}` : ''}
      </summary>
      {Array.isArray(value) && value.length > 0 ? (
        <div className="mt-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Фильтр по названию"
            className={fieldClassName}
          />
          <div className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs text-slate-500">
            {visibleItems.slice(0, 30).map((item, index) => (
              <p key={item?.id || index}>
                {item?.title || item?.label || 'Без названия'}
              </p>
            ))}
          </div>
        </div>
      ) : null}
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={12}
        spellCheck={false}
        disabled={disabled}
        className={`${fieldClassName} mt-3 font-mono text-xs`}
      />
      {jsonError ? (
        <p className="mt-2 text-sm text-rose-600">{jsonError}</p>
      ) : null}
      <button
        type="button"
        onClick={applyJson}
        disabled={disabled}
        className="mt-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        Применить JSON
      </button>
    </details>
  )
}

JsonScenarioField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.array, PropTypes.object]).isRequired,
  expectedType: PropTypes.oneOf(['array', 'object']).isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
}

JsonScenarioField.defaultProps = { disabled: false }

const InvestigationSettings = ({ game, updateGame, disabled }) => {
  const investigation = {
    ...investigationDefaults,
    ...(game?.storyConfig?.investigation || {}),
  }
  const setInvestigationField = (field, value) =>
    updateGame((previous) => ({
      ...previous,
      storyConfig: {
        ...previous.storyConfig,
        investigation: {
          ...investigationDefaults,
          ...previous.storyConfig?.investigation,
          [field]: value,
        },
      },
    }))
  const numberFields = [
    ['startClockMinutes', 'Старт, минут от начала суток'],
    ['deadlineMinutes', 'Дедлайн, минут'],
    ['defaultTravelTimeMinutes', 'Переход, минут'],
    ['defaultInteractionTimeMinutes', 'Взаимодействие, минут'],
    ['accusationTimeMinutes', 'Обвинение, минут'],
  ]

  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-500/30 dark:bg-violet-500/5">
      <h3 className="font-semibold text-slate-900 dark:text-slate-100">
        Настройки расследования
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Игровые часы, стоимость действий и доступность интерфейса расследования.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Стартовая локация
          <select
            value={investigation.startNodeId || ''}
            disabled={disabled}
            onChange={(event) =>
              setInvestigationField('startNodeId', event.target.value || null)
            }
            className={fieldClassName}
          >
            <option value="">Выберите локацию</option>
            {normalizeArray(game?.storyNodes).map((node) => (
              <option key={node.id} value={node.id}>
                {node.title || 'Локация без названия'}
              </option>
            ))}
          </select>
        </label>
        {numberFields.map(([field, label]) => (
          <label key={field} className="grid gap-1 text-sm">
            {label}
            <input
              type="number"
              min="0"
              value={investigation[field] ?? ''}
              disabled={disabled}
              onChange={(event) =>
                setInvestigationField(
                  field,
                  event.target.value === '' ? null : Number(event.target.value),
                )
              }
              className={fieldClassName}
            />
          </label>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {[
          ['allowFreeReplay', 'Бесплатное повторное воспроизведение'],
          ['showClockToTeam', 'Показывать игровые часы'],
          ['showEvidenceToTeam', 'Показывать доску доказательств'],
          ['autoFailOnDeadline', 'Автофинал по дедлайну'],
          ['revealSolutionAfterFinish', 'Раскрывать решение после финала'],
        ].map(([field, label]) => (
          <label key={field} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(investigation[field])}
              disabled={disabled}
              onChange={(event) =>
                setInvestigationField(field, event.target.checked)
              }
            />
            {label}
          </label>
        ))}
      </div>
      <details className="mt-4 rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
        <summary className="cursor-pointer text-sm font-semibold text-slate-600 dark:text-slate-300">
          Расширенный режим: редактирование JSON
        </summary>
        <div className="mt-3 space-y-3">
          {[
            ['Персонажи', 'storyCharacters'],
            ['Темы', 'storyTopics'],
            ['Взаимодействия', 'storyInteractions'],
            ['Доказательства', 'storyEvidence'],
          ].map(([label, field]) => (
            <JsonScenarioField
              key={field}
              label={label}
              value={normalizeArray(game?.[field])}
              expectedType="array"
              disabled={disabled}
              onChange={(value) =>
                updateGame((previous) => ({ ...previous, [field]: value }))
              }
            />
          ))}
          <JsonScenarioField
            label="Финальное обвинение и варианты исхода"
            value={
              game?.storyAccusation &&
              typeof game.storyAccusation === 'object'
                ? game.storyAccusation
                : {}
            }
            expectedType="object"
            disabled={disabled}
            onChange={(value) =>
              updateGame((previous) => ({
                ...previous,
                storyAccusation: value,
              }))
            }
          />
        </div>
      </details>
    </section>
  )
}

InvestigationSettings.propTypes = {
  game: PropTypes.object.isRequired,
  updateGame: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
}

InvestigationSettings.defaultProps = { disabled: false }

const StorySettingsEditor = ({
  isOpen,
  onClose,
  game,
  updateGame,
  disabled,
}) => (
  <Modal
    isOpen={isOpen}
    title="Настройки story-игры"
    onClose={onClose}
    dialogClassName="md:max-w-5xl"
    bodyClassName="bg-slate-50/80 dark:bg-slate-950/40"
    footer={(
      <>
        <p className="mr-auto text-xs text-slate-500 dark:text-slate-400">
          Изменения сохранятся после нажатия общей кнопки «Сохранить сценарий».
        </p>
        <button
          type="button"
          onClick={onClose}
          className="aq-modal-btn aq-modal-btn-primary"
        >
          Готово
        </button>
      </>
    )}
  >
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
          Основные настройки
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
            Формат story-игры
            <select
              value={game?.storyConfig?.experienceMode || 'quest'}
              disabled={disabled}
              onChange={(event) =>
                updateGame((previous) => ({
                  ...previous,
                  storyConfig: {
                    ...previous.storyConfig,
                    experienceMode: event.target.value,
                  },
                }))
              }
              className={fieldClassName}
            >
              <option value="quest">Сюжетный квест</option>
              <option value="investigation">Цифровое расследование</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
            Название блока
            <input
              value={game?.storyConfig?.nodeLabel || 'Локация'}
              disabled={disabled}
              onChange={(event) =>
                updateGame((previous) => ({
                  ...previous,
                  storyConfig: {
                    ...previous.storyConfig,
                    nodeLabel: event.target.value,
                  },
                }))
              }
              className={fieldClassName}
            />
          </label>
          <label className="grid gap-1 text-sm text-slate-600 dark:text-slate-300">
            Режим старта
            <select
              value={game?.storyConfig?.startMode || 'common'}
              disabled={disabled}
              onChange={(event) =>
                updateGame((previous) => ({
                  ...previous,
                  storyConfig: {
                    ...previous.storyConfig,
                    startMode: event.target.value,
                  },
                }))
              }
              className={fieldClassName}
            >
              <option value="common">Общий старт</option>
              <option value="individual">Индивидуальный старт</option>
            </select>
          </label>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {[
            ['showScoreToTeam', 'Показывать баллы команде'],
            ['showInventory', 'Показывать инвентарь'],
            ['showFinalHistoryToTeam', 'Показывать историю после финала'],
            ['hideTotalNodes', 'Скрывать общее число локаций'],
            ['hideTotalItems', 'Скрывать общее число предметов'],
          ].map(([field, label]) => (
            <label
              key={field}
              className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
            >
              <input
                type="checkbox"
                checked={Boolean(game?.storyConfig?.[field])}
                disabled={disabled}
                onChange={(event) =>
                  updateGame((previous) => ({
                    ...previous,
                    storyConfig: {
                      ...previous.storyConfig,
                      [field]: event.target.checked,
                    },
                  }))
                }
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      {game?.storyConfig?.experienceMode === 'investigation' ? (
        <InvestigationSettings
          game={game}
          updateGame={updateGame}
          disabled={disabled}
        />
      ) : null}
    </div>
  </Modal>
)

StorySettingsEditor.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  game: PropTypes.object.isRequired,
  updateGame: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
}

StorySettingsEditor.defaultProps = { disabled: false }

export default StorySettingsEditor
