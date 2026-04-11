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

const GameControlTeamStatsModal = ({ isOpen, onClose, teamName, stats }) => {
  const tasks = useMemo(
    () => (Array.isArray(stats?.tasks) ? stats.tasks : []),
    [stats?.tasks],
  )

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
              {stats?.totalAcceptedCodesCount || 0}
            </div>
            <div className="text-xs text-slate-400">Принятых кодов</div>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center">
            <div className="text-lg font-semibold text-amber-200">
              {stats?.totalWrongCodesCount || 0}
            </div>
            <div className="text-xs text-slate-400">Неверных попыток</div>
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
                      Провалено (штраф: +{formatSeconds(task.penaltyByTaskFailureSeconds)})
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
    totalAcceptedCodesCount: PropTypes.number,
    totalWrongCodesCount: PropTypes.number,
    tasks: PropTypes.arrayOf(
      PropTypes.shape({
        taskIndex: PropTypes.number,
        taskTitle: PropTypes.string,
        startedAt: PropTypes.string,
        endedAt: PropTypes.string,
        completedSeconds: PropTypes.number,
        isFailedTask: PropTypes.bool,
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
  stats: null,
}

export default memo(GameControlTeamStatsModal)
