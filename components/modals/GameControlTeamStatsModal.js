import { memo, useMemo } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'

const formatDateTime = (value) => {
  if (!value) return 'время не зафиксировано'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'время не зафиксировано'
  return parsed.toLocaleString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
  })
}

const formatSeconds = (value) => {
  const sec = Number(value)
  if (!Number.isFinite(sec) || sec < 0) return '—'
  const hours = Math.floor(sec / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  const seconds = sec % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
    2,
    '0',
  )}:${String(seconds).padStart(2, '0')}`
}

const formatAdjustmentValue = (value, gameType) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '—'
  if (gameType === 'photo') {
    return `${numeric} б.`
  }
  return formatSeconds(Math.abs(numeric))
}

const getStoryEffectLabel = (effect) => {
  if (!effect || typeof effect !== 'object') {
    return 'Story-эффект'
  }

  if (effect.label) {
    return effect.label
  }

  if (effect.type === 'grant_item') {
    return effect.itemId
      ? `Выдан предмет: ${effect.itemId}`
      : 'Выдан стартовый предмет'
  }
  if (effect.type === 'unlock_node') {
    return effect.nodeId
      ? `Открыта нода: ${effect.nodeId}`
      : 'Открыта стартовая нода'
  }
  if (effect.type === 'set_flag') {
    return effect.flagKey
      ? `Установлен флаг: ${effect.flagKey}`
      : 'Установлен story-флаг'
  }
  if (effect.type === 'score_modifier') {
    const delta = Number(effect.value) || 0
    return `Изменение story score: ${delta >= 0 ? '+' : ''}${delta}`
  }

  return effect.type || 'Story-эффект'
}

const CodeList = ({ title, items, tone }) => {
  const palette =
    tone === 'bonus'
      ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
      : tone === 'penalty'
        ? 'border-red-500/35 bg-red-500/10 text-red-200'
        : tone === 'wrong'
          ? 'border-amber-500/35 bg-amber-500/10 text-amber-200'
          : 'border-cyan-500/35 bg-cyan-500/10 text-cyan-200'

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      {Array.isArray(items) && items.length > 0 ? (
        <div className="space-y-1.5">
          {items.map((item, index) => (
            <div
              key={`${title}-${item.code}-${index}`}
              className="flex flex-wrap items-center gap-2 text-xs"
            >
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 font-mono ${palette}`}
              >
                {item.code}
              </span>
              <span className="text-slate-500">{formatDateTime(item.enteredAt)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">Нет данных</p>
      )}
    </div>
  )
}

CodeList.propTypes = {
  title: PropTypes.string.isRequired,
  tone: PropTypes.oneOf(['main', 'bonus', 'penalty', 'wrong']).isRequired,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      code: PropTypes.string,
      enteredAt: PropTypes.string,
    }),
  ),
}

CodeList.defaultProps = {
  items: [],
}

const PrequelAdjustmentList = ({ title, items, tone, gameType }) => {
  const palette =
    tone === 'bonus'
      ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
      : 'border-red-500/35 bg-red-500/10 text-red-200'

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      {Array.isArray(items) && items.length > 0 ? (
        <div className="space-y-1.5">
          {items.map((item, index) => (
            <div
              key={`${title}-${item.code || item.description || 'item'}-${index}`}
              className="rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 font-mono ${palette}`}
                >
                  {tone === 'bonus' ? '-' : '+'}
                  {formatAdjustmentValue(item.value, gameType)}
                </span>
                {item.code ? (
                  <span className="font-mono text-slate-300">{item.code}</span>
                ) : null}
                <span className="text-slate-500">
                  {formatDateTime(item.createdAt)}
                </span>
              </div>
              {item.description ? (
                <p className="mt-1 text-slate-400">{item.description}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">Нет данных</p>
      )}
    </div>
  )
}

PrequelAdjustmentList.propTypes = {
  title: PropTypes.string.isRequired,
  tone: PropTypes.oneOf(['bonus', 'penalty']).isRequired,
  gameType: PropTypes.oneOf(['classic', 'photo', 'story']),
  items: PropTypes.arrayOf(
    PropTypes.shape({
      code: PropTypes.string,
      description: PropTypes.string,
      value: PropTypes.number,
      createdAt: PropTypes.string,
    }),
  ),
}

PrequelAdjustmentList.defaultProps = {
  gameType: 'classic',
  items: [],
}

const GameControlTeamStatsModal = ({
  isOpen,
  onClose,
  teamName,
  stats,
  gameType,
}) => {
  const tasks = useMemo(
    () => (Array.isArray(stats?.tasks) ? stats.tasks : []),
    [stats?.tasks],
  )
  const failedTasksCount = useMemo(
    () => tasks.filter((task) => task?.isFailedTask).length,
    [tasks],
  )
  const prequel = stats?.prequel && typeof stats.prequel === 'object' ? stats.prequel : null
  const hasPrequelData =
    Boolean(prequel?.enabled) &&
    ((Array.isArray(prequel?.bonusItems) && prequel.bonusItems.length > 0) ||
      (Array.isArray(prequel?.penaltyItems) && prequel.penaltyItems.length > 0) ||
      (Array.isArray(prequel?.wrongLimitPenaltyItems) &&
        prequel.wrongLimitPenaltyItems.length > 0) ||
      (Array.isArray(prequel?.storyEffects) && prequel.storyEffects.length > 0) ||
      Number(prequel?.attemptsCount) > 0)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Статистика команды — ${teamName || 'Без названия'}`}
      compactMobile
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-3 text-center">
            <div className="text-lg font-semibold text-slate-100">
              {stats?.completedTasksCount || 0}/{stats?.totalTasksCount || 0}
            </div>
            <div className="text-xs text-slate-400">Пройдено заданий</div>
          </div>
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-center">
            <div className="text-lg font-semibold text-cyan-200">
              {stats?.completedTasksCount || 0}
            </div>
            <div className="text-xs text-slate-400">Выполнено заданий</div>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center">
            <div className="text-lg font-semibold text-amber-200">
              {failedTasksCount}
            </div>
            <div className="text-xs text-slate-400">Провалено заданий</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-600/70 bg-slate-900/40 p-3 text-center">
            <div className="text-lg font-semibold text-slate-100">
              {formatSeconds(stats?.totalTasksTimeSeconds)}
            </div>
            <div className="text-xs text-slate-400">Время на задания</div>
          </div>
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-center">
            <div className="text-lg font-semibold text-rose-200">
              +{formatSeconds(stats?.totalPenaltySeconds)}
            </div>
            <div className="text-xs text-slate-400">Штрафы (сумма)</div>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
            <div className="text-lg font-semibold text-emerald-200">
              -{formatSeconds(stats?.totalBonusSeconds)}
            </div>
            <div className="text-xs text-slate-400">Бонусы (сумма)</div>
          </div>
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 text-center">
            <div className="text-lg font-semibold text-violet-200">
              {formatSeconds(stats?.totalFinalSeconds)}
            </div>
            <div className="text-xs text-slate-400">
              Итоговое время (с учетом штрафов и бонусов)
            </div>
          </div>
        </div>

        {hasPrequelData ? (
          <section className="rounded-xl border border-violet-500/35 bg-violet-500/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-violet-100">
                  Приквел
                </h3>
                <p className="mt-1 text-xs text-violet-100/75">
                  Попыток: {Number(prequel?.attemptsCount) || 0}
                  {' · '}
                  Неверных кодов: {Number(prequel?.wrongCodesCount) || 0}
                  {' · '}
                  Пакетных штрафов: {Number(prequel?.wrongPenaltyAppliedCount) || 0}
                </p>
              </div>
              <div className="text-right text-xs text-violet-100/80">
                <div>
                  Бонусы: {formatAdjustmentValue(prequel?.bonusValue, gameType)}
                </div>
                <div>
                  Штрафы:{' '}
                  {formatAdjustmentValue(
                    (Number(prequel?.penaltyValue) || 0) +
                      (Number(prequel?.wrongPenaltyValue) || 0),
                    gameType,
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <PrequelAdjustmentList
                title="Бонусы приквела"
                tone="bonus"
                items={prequel?.bonusItems}
                gameType={gameType}
              />
              <PrequelAdjustmentList
                title="Штрафные коды приквела"
                tone="penalty"
                items={prequel?.penaltyItems}
                gameType={gameType}
              />
              <PrequelAdjustmentList
                title="Штрафы за лимит ошибок"
                tone="penalty"
                items={prequel?.wrongLimitPenaltyItems}
                gameType={gameType}
              />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Story-эффекты
                </p>
                {Array.isArray(prequel?.storyEffects) &&
                prequel.storyEffects.length > 0 ? (
                  <div className="space-y-1.5">
                    {prequel.storyEffects.map((effect, index) => (
                      <div
                        key={`${effect.type}-${effect.code || 'story'}-${index}`}
                        className="rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-xs"
                      >
                        <p className="text-slate-200">
                          {getStoryEffectLabel(effect)}
                        </p>
                        <p className="mt-1 text-slate-500">
                          {effect.code ? `Код: ${effect.code} · ` : ''}
                          {formatDateTime(effect.appliedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Нет данных</p>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {tasks.length === 0 ? (
          <p className="text-sm text-slate-500">Нет данных по заданиям.</p>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={`task-stats-${task.taskIndex}`}
                className={`rounded-xl border p-3 ${
                  task.isFailedTask
                    ? 'border-red-500/45 bg-red-950/18'
                    : 'border-slate-700/60 bg-slate-800/40'
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-100">
                    {task.taskIndex + 1}. {task.taskTitle || 'Без названия'}
                  </h4>
                  <span className="text-xs text-slate-400">
                    Время на задании: {formatSeconds(task.completedSeconds)}
                  </span>
                </div>
                <div className="mb-3 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
                  <p>Старт: {formatDateTime(task.startedAt)}</p>
                  <p>Завершение: {formatDateTime(task.endedAt)}</p>
                  {task.isFailedTask && (
                    <p className="sm:col-span-2 text-red-300">
                      {task.failedByCaptain
                        ? 'Слито капитаном досрочно'
                        : task.failedByTimeout
                          ? 'Провалено по таймеру'
                          : 'Провалено'}{' '}
                      (штраф: +{formatSeconds(task.penaltyByTaskFailureSeconds)})
                    </p>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <CodeList title="Основные коды" tone="main" items={task.mainCodes} />
                  {task.hasConfiguredBonusCodes && (
                    <CodeList
                      title="Бонусные коды"
                      tone="bonus"
                      items={task.bonusCodes}
                    />
                  )}
                  {task.hasConfiguredPenaltyCodes && (
                    <CodeList
                      title="Штрафные коды"
                      tone="penalty"
                      items={task.penaltyCodes}
                    />
                  )}
                  <CodeList title="Неверные коды" tone="wrong" items={task.wrongCodes} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

GameControlTeamStatsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  teamName: PropTypes.string,
  gameType: PropTypes.oneOf(['classic', 'photo', 'story']),
  stats: PropTypes.shape({
    completedTasksCount: PropTypes.number,
    totalTasksCount: PropTypes.number,
    totalTasksTimeSeconds: PropTypes.number,
    totalPenaltySeconds: PropTypes.number,
    totalBonusSeconds: PropTypes.number,
    totalFinalSeconds: PropTypes.number,
    totalCodesPenaltySeconds: PropTypes.number,
    totalCodesBonusSeconds: PropTypes.number,
    totalAddingsPenaltySeconds: PropTypes.number,
    totalAddingsBonusSeconds: PropTypes.number,
    totalPrequelPenaltySeconds: PropTypes.number,
    totalPrequelBonusSeconds: PropTypes.number,
    totalAcceptedCodesCount: PropTypes.number,
    totalWrongCodesCount: PropTypes.number,
    prequel: PropTypes.shape({
      enabled: PropTypes.bool,
      mode: PropTypes.string,
      isClosed: PropTypes.bool,
      closedReason: PropTypes.string,
      attemptsCount: PropTypes.number,
      wrongCodesCount: PropTypes.number,
      wrongPenaltyAppliedCount: PropTypes.number,
      bonusValue: PropTypes.number,
      penaltyValue: PropTypes.number,
      wrongPenaltyValue: PropTypes.number,
      bonusItems: PropTypes.array,
      penaltyItems: PropTypes.array,
      wrongLimitPenaltyItems: PropTypes.array,
      storyEffects: PropTypes.array,
    }),
    tasks: PropTypes.arrayOf(
      PropTypes.shape({
        taskIndex: PropTypes.number,
        taskTitle: PropTypes.string,
        startedAt: PropTypes.string,
        endedAt: PropTypes.string,
        completedSeconds: PropTypes.number,
        isFailedTask: PropTypes.bool,
        failedByCaptain: PropTypes.bool,
        failedByTimeout: PropTypes.bool,
        failedAt: PropTypes.string,
        penaltyByTaskFailureSeconds: PropTypes.number,
        hasConfiguredBonusCodes: PropTypes.bool,
        hasConfiguredPenaltyCodes: PropTypes.bool,
        mainCodes: PropTypes.array,
        bonusCodes: PropTypes.array,
        penaltyCodes: PropTypes.array,
        wrongCodes: PropTypes.array,
      }),
    ),
  }),
}

GameControlTeamStatsModal.defaultProps = {
  teamName: '',
  gameType: 'classic',
  stats: null,
}

export default memo(GameControlTeamStatsModal)
