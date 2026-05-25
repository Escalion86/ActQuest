'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PropTypes from 'prop-types'
import { useQuery } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowsRotate,
  faMoon,
  faSun,
} from '@fortawesome/free-solid-svg-icons'

import requestApiJson from '@helpers/requestApiJson'
import Modal from '@components/Modal'
import FullscreenImageViewer from '@components/FullscreenImageViewer'
import FeedbackToast from '@components/FeedbackToast'
import {
  GameMessageComposer,
  GameMessageHistory,
} from '@components/game/GameMessageThread'
import CardActionIconButton, {
  EditCardIcon,
  TargetCardIcon,
  TeamCardIcon,
  TeamStatsCardIcon,
} from '@components/cabinet/CardActionIconButton'
import GameTasksViewModal from '@components/modals/GameTasksViewModal'
import GameControlTeamStatsModal from '@components/modals/GameControlTeamStatsModal'
import GamePushBroadcastModal from '@components/modals/GamePushBroadcastModal'

const formatTime = (totalSeconds) => {
  const sec = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const formatForcedCluesCount = (count) =>
  `${Math.max(0, Number(count) || 0)} досрочно`

const normalizeSeconds = (value, fallback = 0) => {
  const seconds = Number(value)
  return Number.isFinite(seconds) ? seconds : fallback
}

const formatMinutesRounded = (seconds) => {
  const normalizedSeconds = normalizeSeconds(seconds, 0)
  if (normalizedSeconds <= 0) return 0
  return Math.max(1, Math.round(normalizedSeconds / 60))
}

// const AUTO_REFRESH_OPTIONS = [
//   { value: 5000, label: '5 сек' },
//   { value: 10000, label: '10 сек' },
//   { value: 15000, label: '15 сек' },
//   { value: 30000, label: '30 сек' },
// ]

const normalizePhoneDigits = (value) =>
  String(value || '')
    .replace(/[^\d+]/g, '')
    .trim()

const teamStatusLabel = (team) => {
  if (team.isTeamFinished) return 'Финиш'
  if (team.isTeamOnBreak) return 'Перерыв'
  if (team.isActiveTaskFailed) return 'Время вышло'
  return 'В игре'
}

const teamStatusColor = (team) => {
  if (team.isTeamFinished) {
    return 'border-green-300 bg-green-50 dark:border-green-400/40 dark:bg-green-900/30'
  }
  if (team.isTeamOnBreak) {
    return 'border-yellow-300 bg-yellow-50 dark:border-yellow-400/40 dark:bg-yellow-900/30'
  }
  if (team.isActiveTaskFailed) {
    return 'border-red-300 bg-red-50 dark:border-red-400/40 dark:bg-red-900/30'
  }
  return 'border-cyan-200 bg-white dark:border-cyan-400/25 dark:bg-slate-800/50'
}

const adjustChatTextareaHeight = (textarea) => {
  if (!textarea) return

  textarea.style.height = 'auto'
  const styles = window.getComputedStyle(textarea)
  const lineHeight = Number.parseFloat(styles.lineHeight) || 20
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0
  const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0
  const maxHeight = lineHeight * 5 + paddingTop + paddingBottom
  const nextHeight = Math.min(textarea.scrollHeight, maxHeight)
  textarea.style.height = `${nextHeight}px`
  textarea.style.overflowY =
    textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
}

const ChatCardIcon = () => (
  <svg
    className="w-5 h-5"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4.5 5.8C4.5 4.81 5.31 4 6.3 4H13.7C14.69 4 15.5 4.81 15.5 5.8V10.4C15.5 11.39 14.69 12.2 13.7 12.2H9.1L5.7 15V12.2C5.03 12.2 4.5 11.67 4.5 11V5.8Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7.2 7.4H12.8M7.2 9.6H10.8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
)

const statusDotColor = (team) => {
  if (team.isTeamFinished) return 'bg-green-400'
  if (team.isTeamOnBreak) return 'bg-yellow-400 animate-pulse'
  if (team.isActiveTaskFailed) return 'bg-red-400'
  return 'bg-cyan-400 animate-pulse'
}

const normalizeCodeEntries = (values) =>
  (Array.isArray(values) ? values : [])
    .map((value) => {
      if (typeof value === 'string' || typeof value === 'number') {
        const code = String(value || '').trim()
        return code ? { code, description: '', image: '' } : null
      }
      if (!value || typeof value !== 'object') {
        return null
      }
      const code =
        (typeof value.code === 'string' && value.code.trim()) ||
        (typeof value.code === 'number' && Number.isFinite(value.code)
          ? String(value.code).trim()
          : '') ||
        (typeof value.value === 'string' && value.value.trim()) ||
        (typeof value.text === 'string' && value.text.trim()) ||
        ''
      if (!code) {
        return null
      }
      const description =
        typeof value.description === 'string' ? value.description.trim() : ''
      const image = typeof value.image === 'string' ? value.image.trim() : ''
      return { code, description, image }
    })
    .filter(Boolean)

const normalizeCodeKey = (value) =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value).trim().toLowerCase()
    : ''

const renderCodesBadges = (codes, tone = 'default', options = {}) => {
  const normalizedEntries = normalizeCodeEntries(codes)
  if (normalizedEntries.length === 0) {
    return <span className="text-xs text-slate-500">—</span>
  }
  const getPhotoByCode =
    typeof options.getPhotoByCode === 'function' ? options.getPhotoByCode : null
  const onCodeClick =
    typeof options.onCodeClick === 'function' ? options.onCodeClick : null

  const toneClass =
    tone === 'bonus'
      ? 'border-emerald-400 bg-emerald-100 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/12 dark:text-emerald-200'
      : tone === 'penalty'
        ? 'border-rose-400 bg-rose-100 text-rose-800 dark:border-red-500/40 dark:bg-red-500/12 dark:text-red-200'
        : tone === 'muted'
          ? 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-500/40 dark:bg-slate-500/12 dark:text-slate-300'
          : 'border-cyan-400 bg-cyan-100 text-cyan-800 dark:border-cyan-500/40 dark:bg-cyan-500/12 dark:text-cyan-200'

  return (
    <div className="flex flex-wrap gap-1.5">
      {normalizedEntries.map((entry, index) =>
        (() => {
          const photoUrl = getPhotoByCode
            ? getPhotoByCode(normalizeCodeKey(entry.code))
            : ''
          const badgeTitle = photoUrl
            ? entry.description
              ? `${entry.description} (нажмите, чтобы открыть фото)`
              : 'Нажмите, чтобы открыть фото кода'
            : entry.description || undefined
          const content = (
            <>
              {entry.code}
              {(tone === 'bonus' || tone === 'penalty' || tone === 'muted') &&
              entry.description
                ? ` — ${entry.description}`
                : ''}
            </>
          )
          const className = `inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs ${toneClass} ${
            photoUrl ? 'cursor-pointer transition hover:brightness-110' : ''
          }`

          if (photoUrl && onCodeClick) {
            return (
              <button
                key={`${entry.code}-${index}`}
                type="button"
                onClick={() => onCodeClick({ code: entry.code, photoUrl })}
                className={className}
                title={badgeTitle}
              >
                {content}
              </button>
            )
          }
          return (
            <span
              key={`${entry.code}-${index}`}
              className={className}
              title={badgeTitle}
            >
              {content}
            </span>
          )
        })(),
      )}
    </div>
  )
}

const buildCodePhotoLookup = (task) => {
  const lookup = new Map()
  if (!task || typeof task !== 'object') {
    return lookup
  }

  const mainCodes = normalizeCodeEntries(task.codes)
  const mainCodePhotos = Array.isArray(task.codePhotos) ? task.codePhotos : []
  mainCodes.forEach((entry, index) => {
    const key = normalizeCodeKey(entry.code)
    const photo =
      typeof mainCodePhotos[index] === 'string'
        ? mainCodePhotos[index].trim()
        : ''
    if (key && photo) {
      lookup.set(key, photo)
    }
  })

  normalizeCodeEntries(task.bonusCodes).forEach((entry) => {
    const key = normalizeCodeKey(entry.code)
    if (key && entry.image) {
      lookup.set(key, entry.image)
    }
  })
  normalizeCodeEntries(task.penaltyCodes).forEach((entry) => {
    const key = normalizeCodeKey(entry.code)
    if (key && entry.image) {
      lookup.set(key, entry.image)
    }
  })

  return lookup
}

const getMainCodesProgress = (team, tasks) => {
  const activeTaskIndex = Number.isInteger(team?.activeTaskIndex)
    ? team.activeTaskIndex
    : -1
  if (activeTaskIndex < 0 || !Array.isArray(tasks)) {
    return {
      remainingCodes: [],
      remainingCount: 0,
      foundCount: 0,
      requiredCount: 0,
    }
  }

  const activeTask = tasks[activeTaskIndex]
  const allMainCodes = normalizeCodeEntries(activeTask?.codes).map(
    (entry) => entry.code,
  )
  if (allMainCodes.length === 0) {
    return {
      remainingCodes: [],
      remainingCount: 0,
      foundCount: 0,
      requiredCount: 0,
    }
  }

  const requiredSource = activeTask?.numCodesToCompliteTask
  const hasExplicitRequiredCount =
    requiredSource !== null &&
    requiredSource !== undefined &&
    requiredSource !== ''
  const rawRequiredCount = Number(requiredSource)
  const requiredCount =
    hasExplicitRequiredCount && Number.isFinite(rawRequiredCount)
      ? Math.max(0, Math.min(Math.floor(rawRequiredCount), allMainCodes.length))
      : allMainCodes.length

  const foundMainCodes = new Set(
    normalizeCodeEntries(team?.findedCodes).map((entry) =>
      entry.code.trim().toLowerCase(),
    ),
  )

  const remainingAllCodes = allMainCodes.filter(
    (code) => !foundMainCodes.has(String(code).trim().toLowerCase()),
  )
  const foundCount = Math.max(allMainCodes.length - remainingAllCodes.length, 0)
  const remainingCount = Math.max(requiredCount - foundCount, 0)

  return {
    remainingCodes: remainingAllCodes,
    remainingCount,
    foundCount,
    requiredCount,
  }
}

const getRemainingCodeEntries = ({
  team,
  tasks,
  taskFieldName,
  foundEntries,
}) => {
  const activeTaskIndex = Number.isInteger(team?.activeTaskIndex)
    ? team.activeTaskIndex
    : -1
  if (activeTaskIndex < 0 || !Array.isArray(tasks)) {
    return []
  }

  const activeTask = tasks[activeTaskIndex]
  const allEntries = normalizeCodeEntries(activeTask?.[taskFieldName])
  if (allEntries.length === 0) {
    return []
  }

  const foundSet = new Set(
    normalizeCodeEntries(foundEntries).map((entry) =>
      entry.code.trim().toLowerCase(),
    ),
  )

  return allEntries.filter(
    (entry) => !foundSet.has(String(entry.code).trim().toLowerCase()),
  )
}

const buildManualCodeCandidates = (team, tasks) => {
  const { remainingCodes: remainingMainCodes } = getMainCodesProgress(
    team,
    tasks,
  )
  const remainingBonusEntries = getRemainingCodeEntries({
    team,
    tasks,
    taskFieldName: 'bonusCodes',
    foundEntries: team?.bonusCodeItems?.length
      ? team.bonusCodeItems
      : team?.bonusCodes,
  })
  const remainingPenaltyEntries = getRemainingCodeEntries({
    team,
    tasks,
    taskFieldName: 'penaltyCodes',
    foundEntries: team?.penaltyCodeItems?.length
      ? team.penaltyCodeItems
      : team?.penaltyCodes,
  })

  return [
    ...remainingMainCodes.map((code) => ({
      code: String(code || '').trim(),
      category: 'main',
      label: `[ОСН] ${String(code || '').trim()}`,
    })),
    ...remainingBonusEntries.map((entry) => ({
      code: String(entry?.code || '').trim(),
      category: 'bonus',
      label:
        entry?.description && String(entry.description).trim()
          ? `[БОН] ${String(entry.code || '').trim()} — ${String(entry.description).trim()}`
          : `[БОН] ${String(entry?.code || '').trim()}`,
    })),
    ...remainingPenaltyEntries.map((entry) => ({
      code: String(entry?.code || '').trim(),
      category: 'penalty',
      label:
        entry?.description && String(entry.description).trim()
          ? `[ШТР] ${String(entry.code || '').trim()} — ${String(entry.description).trim()}`
          : `[ШТР] ${String(entry?.code || '').trim()}`,
    })),
  ].filter((item) => Boolean(item.code))
}

const fetchGameControlStatus = async (gameId) => {
  const normalizedGameId = String(gameId || '').trim()
  if (!normalizedGameId) return null

  const { json } = await requestApiJson(
    `/api/cabinet/admin/game-status?gameId=${encodeURIComponent(normalizedGameId)}`,
    { fallbackMessage: 'Не удалось загрузить данные' },
  )

  if (!json?.success || !json?.data) {
    throw new Error(json?.error || 'Не удалось загрузить данные')
  }

  return json.data
}

const fetchStoryControlStatus = async (gameId) => {
  const normalizedGameId = String(gameId || '').trim()
  if (!normalizedGameId) return null

  const { json } = await requestApiJson(
    `/api/cabinet/admin/story-control?gameId=${encodeURIComponent(normalizedGameId)}`,
    { fallbackMessage: 'Не удалось загрузить story-контроль' },
  )

  if (!json?.success || !json?.data) {
    throw new Error(json?.error || 'Не удалось загрузить story-контроль')
  }

  return json.data
}

const storyStatusLabels = {
  not_started: 'Не стартовала',
  in_progress: 'В процессе',
  completed: 'Пройдена',
  failed: 'Провалена',
}

const formatStoryHistoryDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const StoryControlTeamCard = ({ game, team, onMutation, isMutating }) => {
  const [selectedItemId, setSelectedItemId] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState('')
  const [selectedEndingId, setSelectedEndingId] = useState('')
  const [scoreDelta, setScoreDelta] = useState('')

  const items = Array.isArray(game?.storyItems) ? game.storyItems : []
  const nodes = Array.isArray(game?.storyNodes) ? game.storyNodes : []
  const endings = Array.isArray(game?.storyEndings) ? game.storyEndings : []
  const progress = team?.progress || {}
  const inventory = Array.isArray(progress?.inventory) ? progress.inventory : []
  const activeInventory = inventory.filter((item) => item?.status === 'active')
  const consumedInventory = inventory.filter(
    (item) => item?.status === 'consumed',
  )
  const history = Array.isArray(progress?.history) ? progress.history : []
  const recentHistory = history.slice(-8).reverse()
  const availableNodeIds = Array.isArray(team?.availableNodeIds)
    ? team.availableNodeIds
    : []

  const itemsById = new Map(
    items.map((item) => [String(item?.id || ''), item]).filter(([id]) => id),
  )
  const nodesById = new Map(
    nodes.map((node) => [String(node?.id || ''), node]).filter(([id]) => id),
  )
  const endingsById = new Map(
    endings
      .map((ending) => [String(ending?.id || ''), ending])
      .filter(([id]) => id),
  )

  const selectedItem = selectedItemId || items[0]?.id || ''
  const selectedNode = selectedNodeId || nodes[0]?.id || ''
  const selectedEnding = selectedEndingId || endings[0]?.id || ''

  const run = (endpoint, payload) =>
    onMutation(endpoint, {
      teamId: team?.team?.id,
      gameTeamId: team?.team?.gameTeamId,
      ...payload,
    })

  return (
    <article className="p-4 bg-white border rounded-xl border-slate-200 dark:border-slate-700/50 dark:bg-slate-800/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {team?.team?.name || 'Команда без названия'}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {storyStatusLabels[progress?.status] || progress?.status || '—'}
            {' · '}
            Баллы: {Number(progress?.score) || 0}
            {progress?.currentEndingId
              ? ` · Финал: ${
                  endingsById.get(progress.currentEndingId)?.title ||
                  progress.currentEndingId
                }`
              : ''}
          </p>
        </div>
        <span className="px-3 py-1 text-xs font-semibold border rounded-full border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-500/35 dark:bg-cyan-500/10 dark:text-cyan-100">
          Активных локаций: {availableNodeIds.length}
        </span>
      </div>

      <div className="grid gap-3 mt-4 sm:grid-cols-2">
        <div className="p-3 border rounded-lg border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
          <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            Активные локации
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {availableNodeIds.length > 0 ? (
              availableNodeIds.map((nodeId) => (
                <span
                  key={nodeId}
                  className="rounded-full border border-cyan-300/70 bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-800 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-100"
                >
                  {nodesById.get(nodeId)?.title || nodeId}
                </span>
              ))
            ) : (
              <span className="text-sm text-slate-500">—</span>
            )}
          </div>
        </div>
        <div className="p-3 border rounded-lg border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
          <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            Инвентарь
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {activeInventory.length > 0 ? (
              activeInventory.map((entry, index) => (
                <span
                  key={`${entry.itemId}-${index}`}
                  className="rounded-full border border-emerald-300/70 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100"
                >
                  {itemsById.get(entry.itemId)?.title || entry.itemId}
                </span>
              ))
            ) : (
              <span className="text-sm text-slate-500">—</span>
            )}
          </div>
          {consumedInventory.length > 0 ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Потрачено: {consumedInventory.length}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 p-3 mt-4 border rounded-lg border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <select
            value={selectedItem}
            onChange={(event) => setSelectedItemId(event.target.value)}
            className="px-3 py-2 text-sm bg-white border rounded-lg border-slate-300 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            {items.length === 0 ? (
              <option value="">Нет предметов</option>
            ) : null}
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title || item.id}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={isMutating || !selectedItem}
            onClick={() => run('grant-item', { itemId: selectedItem })}
            className="px-3 py-2 text-sm font-semibold text-white transition rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Выдать
          </button>
          <button
            type="button"
            disabled={isMutating || !selectedItem}
            onClick={() => run('consume-item', { itemId: selectedItem })}
            className="px-3 py-2 text-sm font-semibold text-white transition rounded-lg bg-rose-600 hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Изъять
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <select
            value={selectedNode}
            onChange={(event) => setSelectedNodeId(event.target.value)}
            className="px-3 py-2 text-sm bg-white border rounded-lg border-slate-300 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            {nodes.length === 0 ? <option value="">Нет локаций</option> : null}
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.title || node.id}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={isMutating || !selectedNode}
            onClick={() => run('unlock-node', { nodeId: selectedNode })}
            className="px-3 py-2 text-sm font-semibold text-white transition rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Открыть
          </button>
          <button
            type="button"
            disabled={isMutating || !selectedNode}
            onClick={() => run('complete-node', { nodeId: selectedNode })}
            className="px-3 py-2 text-sm font-semibold text-white transition rounded-lg bg-slate-700 hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Завершить
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            type="number"
            value={scoreDelta}
            onChange={(event) => setScoreDelta(event.target.value)}
            placeholder="Баллы, например 5 или -3"
            className="px-3 py-2 text-sm bg-white border rounded-lg border-slate-300 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="button"
            disabled={isMutating || !String(scoreDelta).trim()}
            onClick={() => {
              void run('adjust-score', {
                points: Number(scoreDelta),
                reason: 'admin_score_adjustment',
              })
              setScoreDelta('')
            }}
            className="px-3 py-2 text-sm font-semibold text-white transition rounded-lg bg-amber-600 hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Изменить баллы
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <select
            value={selectedEnding}
            onChange={(event) => setSelectedEndingId(event.target.value)}
            className="px-3 py-2 text-sm bg-white border rounded-lg border-slate-300 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            {endings.length === 0 ? (
              <option value="">Нет концовок</option>
            ) : null}
            {endings.map((ending) => (
              <option key={ending.id} value={ending.id}>
                {ending.title || ending.id}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={isMutating || !selectedEnding}
            onClick={() => {
              if (
                !window.confirm('Завершить story-квест выбранной концовкой?')
              ) {
                return
              }
              void run('finish', { endingId: selectedEnding })
            }}
            className="px-3 py-2 text-sm font-semibold text-white transition rounded-lg bg-violet-600 hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Финал
          </button>
        </div>
      </div>

      {recentHistory.length > 0 ? (
        <div className="p-3 mt-4 border rounded-lg border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
          <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            История
          </p>
          <div className="mt-2 space-y-1.5">
            {recentHistory.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center text-xs gap-x-2 gap-y-1 text-slate-600 dark:text-slate-300"
              >
                <span className="font-mono text-slate-500">
                  {formatStoryHistoryDate(entry.at)}
                </span>
                <span className="font-semibold">{entry.type}</span>
                {entry.nodeId ? (
                  <span>
                    {nodesById.get(entry.nodeId)?.title || entry.nodeId}
                  </span>
                ) : null}
                {entry.itemId ? (
                  <span>
                    {itemsById.get(entry.itemId)?.title || entry.itemId}
                  </span>
                ) : null}
                {entry.endingId ? (
                  <span>
                    {endingsById.get(entry.endingId)?.title || entry.endingId}
                  </span>
                ) : null}
                {entry.points ? (
                  <span>
                    {entry.points > 0 ? '+' : ''}
                    {entry.points}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  )
}

StoryControlTeamCard.propTypes = {
  game: PropTypes.shape({
    storyItems: PropTypes.array,
    storyNodes: PropTypes.array,
    storyEndings: PropTypes.array,
  }).isRequired,
  team: PropTypes.shape({
    team: PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      gameTeamId: PropTypes.string,
    }),
    progress: PropTypes.object,
    availableNodeIds: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  onMutation: PropTypes.func.isRequired,
  isMutating: PropTypes.bool,
}

StoryControlTeamCard.defaultProps = {
  isMutating: false,
}

const StoryControlDashboard = ({
  storyData,
  isLoading,
  error,
  onRefresh,
  onMutation,
  isMutating,
}) => {
  const game = storyData?.game || {}
  const teams = Array.isArray(storyData?.teams) ? storyData.teams : []

  return (
    <div className="space-y-4">
      <div className="p-4 border rounded-xl border-violet-300 bg-violet-50 dark:border-violet-500/35 dark:bg-violet-500/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-violet-950 dark:text-violet-50">
              Story-контроль
            </h2>
            <p className="mt-1 text-sm text-violet-800 dark:text-violet-100/80">
              Команд: {teams.length} · Локаций:{' '}
              {Array.isArray(game.storyNodes) ? game.storyNodes.length : 0} ·
              Предметов:{' '}
              {Array.isArray(game.storyItems) ? game.storyItems.length : 0}
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading || isMutating}
            className="rounded-full border border-violet-300 bg-white px-3 py-1.5 text-sm font-semibold text-violet-800 transition hover:border-violet-500 hover:text-violet-950 disabled:cursor-not-allowed disabled:opacity-60 dark:border-violet-500/40 dark:bg-slate-900/70 dark:text-violet-100"
          >
            Обновить story
          </button>
        </div>
        {error ? (
          <p className="px-3 py-2 mt-3 text-sm border rounded-lg border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </p>
        ) : null}
        {isLoading && !storyData ? (
          <p className="mt-3 text-sm text-violet-800 dark:text-violet-100">
            Загружаем story-контроль...
          </p>
        ) : null}
      </div>

      {teams.length > 0 ? (
        <div className="space-y-3">
          {teams.map((team) => (
            <StoryControlTeamCard
              key={team?.team?.gameTeamId || team?.team?.id}
              game={game}
              team={team}
              onMutation={onMutation}
              isMutating={isMutating}
            />
          ))}
        </div>
      ) : !isLoading ? (
        <div className="p-8 text-center bg-white border rounded-xl border-slate-200 text-slate-600 dark:border-slate-700/50 dark:bg-slate-800/40 dark:text-slate-400">
          Нет зарегистрированных команд
        </div>
      ) : null}
    </div>
  )
}

StoryControlDashboard.propTypes = {
  storyData: PropTypes.shape({
    game: PropTypes.object,
    teams: PropTypes.array,
  }),
  isLoading: PropTypes.bool,
  error: PropTypes.string,
  onRefresh: PropTypes.func.isRequired,
  onMutation: PropTypes.func.isRequired,
  isMutating: PropTypes.bool,
}

StoryControlDashboard.defaultProps = {
  storyData: null,
  isLoading: false,
  error: '',
  isMutating: false,
}

export default function GameControlPageClient({ session: _session }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const gameId = searchParams.get('gameId')

  const [isDetailedView, setIsDetailedView] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [autoRefreshIntervalMs, setAutoRefreshIntervalMs] = useState(5000)
  const [nowTs, setNowTs] = useState(() => Date.now())
  const [isTasksViewModalOpen, setIsTasksViewModalOpen] = useState(false)
  const [selectedTeamForTaskPreviewId, setSelectedTeamForTaskPreviewId] =
    useState('')
  const [selectedTeamForStatsId, setSelectedTeamForStatsId] = useState('')
  const [selectedTeamForContactsId, setSelectedTeamForContactsId] = useState('')
  const [selectedTeamForPushId, setSelectedTeamForPushId] = useState('')
  const [isGameConversationsModalOpen, setIsGameConversationsModalOpen] =
    useState(false)
  const [selectedTeamForManualActionsId, setSelectedTeamForManualActionsId] =
    useState('')
  const [toastEvent, setToastEvent] = useState(null)
  const [wrongCodesModalData, setWrongCodesModalData] = useState(null)
  const [selectedManualCode, setSelectedManualCode] = useState('')
  const [manualActionError, setManualActionError] = useState('')
  const [manualActionLoading, setManualActionLoading] = useState(false)
  const [selectedCodePhoto, setSelectedCodePhoto] = useState(null)
  const [isFullscreenCodePhotoOpen, setIsFullscreenCodePhotoOpen] =
    useState(false)
  const [teamPushLoadingId, setTeamPushLoadingId] = useState('')
  const [teamPushMessage, setTeamPushMessage] = useState('')
  const [teamPushSendPush, setTeamPushSendPush] = useState(false)
  const [teamMessageHistory, setTeamMessageHistory] = useState([])
  const [teamMessageHistoryLoading, setTeamMessageHistoryLoading] =
    useState(false)
  const [teamMessageHistoryError, setTeamMessageHistoryError] = useState('')
  const [storyMutationLoading, setStoryMutationLoading] = useState(false)
  const teamMessageHistoryListRef = useRef(null)
  const teamPushTextareaRef = useRef(null)
  const [themeMode, setThemeMode] = useState('dark')
  const isLightTheme = themeMode === 'light'
  const {
    data,
    error: statusError,
    isLoading: loading,
    refetch: refetchStatus,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['game-control-status', gameId || ''],
    queryFn: () => fetchGameControlStatus(gameId),
    enabled: Boolean(gameId),
    refetchInterval: autoRefresh ? autoRefreshIntervalMs : false,
    refetchIntervalInBackground: true,
  })
  const error = statusError?.message || null
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null
  const isStoryGame =
    String(data?.gameType || '')
      .trim()
      .toLowerCase() === 'story'
  const {
    data: storyControlData,
    error: storyControlError,
    isLoading: storyControlLoading,
    refetch: refetchStoryControl,
  } = useQuery({
    queryKey: ['story-control-status', gameId || ''],
    queryFn: () => fetchStoryControlStatus(gameId),
    enabled: Boolean(gameId && isStoryGame),
    refetchInterval: autoRefresh && isStoryGame ? autoRefreshIntervalMs : false,
    refetchIntervalInBackground: true,
  })
  const showToast = useCallback((type, message) => {
    setToastEvent({
      id: Date.now(),
      type,
      message,
    })
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTs(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedTheme =
      window.localStorage.getItem('cabinet-theme') ||
      window.localStorage.getItem('aq-theme')
    const htmlTheme = document.documentElement.getAttribute('data-theme')
    const resolvedTheme =
      storedTheme === 'dark' || storedTheme === 'light'
        ? storedTheme
        : htmlTheme === 'dark' || htmlTheme === 'light'
          ? htmlTheme
          : document.documentElement.classList.contains('dark')
            ? 'dark'
            : 'light'
    setThemeMode(resolvedTheme)
  }, [])

  const toggleThemeMode = useCallback(() => {
    const nextTheme = themeMode === 'dark' ? 'light' : 'dark'
    setThemeMode(nextTheme)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('cabinet-theme', nextTheme)
        window.localStorage.setItem('aq-theme', nextTheme)
      } catch {
        // localStorage может быть недоступен в приватном режиме или старых WebView.
      }
    }
    document.documentElement.setAttribute('data-theme', nextTheme)
    document.documentElement.classList.toggle('dark', nextTheme === 'dark')
    document.documentElement.style.colorScheme = nextTheme
  }, [themeMode])

  const gameForTasksModal = useMemo(() => {
    const teamsList = Array.isArray(data?.teams) ? data.teams : []
    const selectedTeam = teamsList.find(
      (item) => String(item?.teamId) === selectedTeamForTaskPreviewId,
    )
    const allTasks = Array.isArray(data?.tasks) ? data.tasks : []
    const activeTaskIndex = Number.isInteger(selectedTeam?.activeTaskIndex)
      ? selectedTeam.activeTaskIndex
      : -1
    const currentTask =
      activeTaskIndex >= 0 && activeTaskIndex < allTasks.length
        ? allTasks[activeTaskIndex]
        : null
    return {
      id: String(data?.gameId || ''),
      name: selectedTeam?.teamName
        ? String(selectedTeam.teamName)
        : String(data?.gameName || ''),
      type: String(data?.gameType || 'classic'),
      tasks: currentTask ? [currentTask] : [],
    }
  }, [data, selectedTeamForTaskPreviewId])
  const selectedTeamForStats = useMemo(() => {
    const teamsList = Array.isArray(data?.teams) ? data.teams : []
    return (
      teamsList.find(
        (item) => String(item?.teamId) === selectedTeamForStatsId,
      ) || null
    )
  }, [data?.teams, selectedTeamForStatsId])
  const selectedTeamForManualActions = useMemo(() => {
    const teamsList = Array.isArray(data?.teams) ? data.teams : []
    return (
      teamsList.find(
        (item) => String(item?.teamId) === selectedTeamForManualActionsId,
      ) || null
    )
  }, [data?.teams, selectedTeamForManualActionsId])
  const selectedTeamForContacts = useMemo(() => {
    const teamsList = Array.isArray(data?.teams) ? data.teams : []
    return (
      teamsList.find(
        (item) => String(item?.teamId) === selectedTeamForContactsId,
      ) || null
    )
  }, [data?.teams, selectedTeamForContactsId])
  const selectedTeamForPush = useMemo(() => {
    if (selectedTeamForPushId === '__game__') {
      return null
    }
    const teamsList = Array.isArray(data?.teams) ? data.teams : []
    return (
      teamsList.find(
        (item) => String(item?.teamId) === selectedTeamForPushId,
      ) || null
    )
  }, [data?.teams, selectedTeamForPushId])
  const isGameWideMessageModal = selectedTeamForPushId === '__game__'
  const manualCodeCandidates = useMemo(
    () =>
      selectedTeamForManualActions
        ? buildManualCodeCandidates(selectedTeamForManualActions, data?.tasks)
        : [],
    [data?.tasks, selectedTeamForManualActions],
  )
  const gameElapsedSeconds = useMemo(() => {
    const startMs = data?.dateStartFact
      ? new Date(data.dateStartFact).getTime()
      : NaN
    if (!Number.isFinite(startMs)) {
      return null
    }
    return Math.max(0, Math.floor((nowTs - startMs) / 1000))
  }, [data?.dateStartFact, nowTs])
  const lightThemeOverrides = isLightTheme ? 'bg-slate-50 text-slate-900' : ''

  useEffect(() => {
    if (!selectedTeamForManualActionsId) {
      setSelectedManualCode('')
      setManualActionError('')
      return
    }
    const firstCode = manualCodeCandidates[0]?.code || ''
    setSelectedManualCode((prev) => (prev ? prev : firstCode))
  }, [manualCodeCandidates, selectedTeamForManualActionsId])

  const closeManualActionsModal = useCallback(() => {
    if (manualActionLoading) return
    setSelectedTeamForManualActionsId('')
    setSelectedManualCode('')
    setManualActionError('')
  }, [manualActionLoading])
  const closeTeamPushModal = useCallback(() => {
    if (teamPushLoadingId) return
    setSelectedTeamForPushId('')
    setTeamPushMessage('')
    setTeamPushSendPush(false)
    setTeamMessageHistory([])
    setTeamMessageHistoryError('')
  }, [teamPushLoadingId])

  const runManualAction = useCallback(
    async (action, code = '') => {
      if (!gameId || !selectedTeamForManualActions?.teamId) {
        return
      }
      setManualActionLoading(true)
      setManualActionError('')
      try {
        const { json } = await requestApiJson(
          '/api/cabinet/admin/game-status/action',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              gameId,
              teamId: String(selectedTeamForManualActions.teamId),
              action,
              ...(code ? { code } : {}),
            }),
          },
        )
        await refetchStatus()
        return json
      } catch (requestError) {
        setManualActionError(
          requestError?.payload?.error ||
            requestError?.message ||
            'Не удалось выполнить действие',
        )
        throw requestError
      } finally {
        setManualActionLoading(false)
      }
    },
    [gameId, refetchStatus, selectedTeamForManualActions?.teamId],
  )

  const handleApplyManualCode = useCallback(async () => {
    const nextCode = String(selectedManualCode || '').trim()
    if (!nextCode) {
      setManualActionError('Выберите код для зачёта.')
      return
    }
    if (!window.confirm(`Зачесть код «${nextCode}» этой команде?`)) {
      return
    }
    try {
      await runManualAction('apply_code', nextCode)
      showToast('success', 'Код зачислен')
    } catch {
      return
    }
  }, [runManualAction, selectedManualCode, showToast])

  const handleForceCompleteTask = useCallback(async () => {
    if (
      !window.confirm(
        'Принудительно завершить текущее задание для этой команды?',
      )
    ) {
      return
    }
    try {
      await runManualAction('force_complete')
      showToast('success', 'Задание выполнено')
      closeManualActionsModal()
    } catch {
      return
    }
  }, [closeManualActionsModal, runManualAction, showToast])

  const handleForceFailTask = useCallback(async () => {
    if (
      !window.confirm(
        'Принудительно провалить текущее задание для этой команды? На задание будет засчитано полное время.',
      )
    ) {
      return
    }
    try {
      await runManualAction('force_fail')
      showToast('warning', 'Задание провалено')
      closeManualActionsModal()
    } catch {
      return
    }
  }, [closeManualActionsModal, runManualAction, showToast])

  const handleOpenTeamPushModal = useCallback(
    (team) => {
      const teamId = String(team?.teamId || '').trim()
      if (!teamId) {
        showToast('error', 'Не удалось определить команду для отправки.')
        return
      }
      setSelectedTeamForPushId(teamId)
      setTeamPushMessage('')
      setTeamPushSendPush(false)
    },
    [showToast],
  )

  const handleOpenGameConversationsModal = useCallback(() => {
    setIsGameConversationsModalOpen(true)
  }, [])

  const handleCloseGameConversationsModal = useCallback(() => {
    setIsGameConversationsModalOpen(false)
    void refetchStatus()
  }, [refetchStatus])

  const loadTeamMessageHistory = useCallback(async () => {
    if (!gameId || !selectedTeamForPushId) return

    setTeamMessageHistoryLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedTeamForPushId !== '__game__') {
        params.set('teamId', selectedTeamForPushId)
      }
      const suffix = params.toString() ? `?${params.toString()}` : ''
      const { json } = await requestApiJson(
        `/api/cabinet/games/${encodeURIComponent(gameId)}/messages${suffix}`,
      )
      if (!json?.success) {
        throw new Error(json?.error || 'Не удалось загрузить переписку.')
      }
      setTeamMessageHistory(
        Array.isArray(json?.data?.messages) ? json.data.messages : [],
      )
      setTeamMessageHistoryError('')
    } catch (historyError) {
      setTeamMessageHistoryError(
        historyError?.payload?.error ||
          historyError?.message ||
          'Не удалось загрузить переписку.',
      )
    } finally {
      setTeamMessageHistoryLoading(false)
    }
  }, [gameId, selectedTeamForPushId])

  useEffect(() => {
    if (!selectedTeamForPushId) return
    void loadTeamMessageHistory()
  }, [loadTeamMessageHistory, selectedTeamForPushId])

  useEffect(() => {
    if (!selectedTeamForPushId) return undefined

    const intervalId = window.setInterval(() => {
      void loadTeamMessageHistory()
    }, 15000)

    return () => window.clearInterval(intervalId)
  }, [loadTeamMessageHistory, selectedTeamForPushId])

  useEffect(() => {
    if (!selectedTeamForPushId) return undefined

    const frameId = window.requestAnimationFrame(() => {
      const list = teamMessageHistoryListRef.current
      if (list) {
        list.scrollTop = list.scrollHeight
      }
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [selectedTeamForPushId, teamMessageHistory.length])

  useEffect(() => {
    if (!selectedTeamForPushId) return undefined

    const frameId = window.requestAnimationFrame(() => {
      adjustChatTextareaHeight(teamPushTextareaRef.current)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [selectedTeamForPushId, teamPushMessage])

  const handleTeamPushMessageChange = useCallback((event) => {
    setTeamPushMessage(event.target.value)
    adjustChatTextareaHeight(event.target)
  }, [])

  const handleSendTeamPush = useCallback(
    async (team) => {
      const teamId = String(team?.teamId || '').trim()
      const isGameWide = selectedTeamForPushId === '__game__'
      if (!gameId || (!isGameWide && !teamId)) {
        showToast('error', 'Не удалось определить команду для отправки.')
        return
      }

      const message = String(teamPushMessage || '').trim()
      if (!message) {
        showToast('warning', 'Сообщение не отправлено: пустой текст.')
        return
      }

      setTeamPushLoadingId(isGameWide ? '__game__' : teamId)
      try {
        const { json } = await requestApiJson(
          `/api/cabinet/games/${encodeURIComponent(gameId)}/messages`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              scope: isGameWide ? 'game' : 'team',
              ...(isGameWide ? {} : { teamId }),
              body: message,
              sendPush: teamPushSendPush,
            }),
          },
        )

        if (!json?.success) {
          showToast('error', json?.error || 'Не удалось отправить сообщение.')
          return
        }

        const createdMessage = json?.data?.message || {}
        const usersMatched = Number(createdMessage?.pushUsersMatched || 0)
        const pushDelivered = Number(createdMessage?.pushDelivered || 0)
        showToast(
          'success',
          teamPushSendPush
            ? `Сообщение сохранено, push: получателей ${usersMatched}, доставлено ${pushDelivered}.`
            : 'Сообщение сохранено в переписке.',
        )
        setTeamPushMessage('')
        setTeamPushSendPush(false)
        await loadTeamMessageHistory()
      } catch (errorRequest) {
        showToast(
          'error',
          errorRequest?.payload?.error ||
            errorRequest?.message ||
            'Не удалось отправить сообщение.',
        )
      } finally {
        setTeamPushLoadingId('')
      }
    },
    [
      gameId,
      loadTeamMessageHistory,
      selectedTeamForPushId,
      showToast,
      teamPushMessage,
      teamPushSendPush,
    ],
  )

  const runStoryControlMutation = useCallback(
    async (endpoint, payload) => {
      if (!gameId || !endpoint) return null

      setStoryMutationLoading(true)
      try {
        const { json } = await requestApiJson(
          `/api/cabinet/admin/story-control/${endpoint}`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              gameId,
              ...payload,
            }),
          },
        )

        if (!json?.success) {
          throw new Error(json?.error || 'Не удалось выполнить story-действие')
        }

        await refetchStoryControl()
        showToast('success', 'Story-состояние обновлено')
        return json.data
      } catch (mutationError) {
        showToast(
          'error',
          mutationError?.payload?.error ||
            mutationError?.message ||
            'Не удалось выполнить story-действие',
        )
        return null
      } finally {
        setStoryMutationLoading(false)
      }
    },
    [gameId, refetchStoryControl, showToast],
  )

  if (!gameId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-slate-400">Не указан ID игры</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div
        className={`flex min-h-[60vh] items-center justify-center transition-colors ${lightThemeOverrides}`}
      >
        <div className="w-8 h-8 border-2 rounded-full animate-spin border-cyan-400 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={`max-w-2xl px-4 py-8 mx-auto transition-colors ${lightThemeOverrides}`}
      >
        <div className="p-6 text-center border rounded-xl border-red-500/30 bg-red-900/20">
          <p className="mb-4 text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => refetchStatus()}
            className="px-4 py-2 text-sm transition border rounded-lg border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
          >
            Повторить
          </button>
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-4 text-sm transition text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
        >
          ← Назад
        </button>
      </div>
    )
  }

  if (!data) return null

  const {
    gameName,
    gameStatus,
    gameType,
    tasksCount,
    taskDuration,
    cluesDuration,
    breakDuration,
    teams,
  } = data
  const taskDurationMinutes = formatMinutesRounded(taskDuration)
  const cluesDurationMinutes = formatMinutesRounded(cluesDuration)
  const breakDurationMinutes = formatMinutesRounded(breakDuration)
  const totalUnreadTeamMessagesCount = teams.reduce(
    (sum, team) =>
      sum + Math.max(0, Number(team?.unreadTeamMessagesCount) || 0),
    0,
  )
  const resolvedStoryControlError = storyControlError?.message || ''
  return (
    <div
      className={`max-w-4xl px-4 py-6 mx-auto transition-colors ${lightThemeOverrides}`}
    >
      {/* Шапка */}
      <div className="flex flex-col items-start justify-between gap-3 mb-6">
        <div className="w-full">
          <div className="flex items-center w-full gap-3 mb-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="text-sm transition text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              ← Назад
            </button>
            <div className="flex items-center justify-end flex-1 gap-3">
              <button
                type="button"
                onClick={handleOpenGameConversationsModal}
                className="relative inline-flex items-center justify-center w-8 h-8 transition border rounded-full border-amber-400 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20"
                aria-label="Открыть переписку с командами"
                title="Открыть переписку с командами"
              >
                <ChatCardIcon />
                {totalUnreadTeamMessagesCount > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow ring-2 ring-slate-950">
                    {totalUnreadTeamMessagesCount > 99
                      ? '99+'
                      : totalUnreadTeamMessagesCount}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={toggleThemeMode}
                className="inline-flex items-center justify-center w-8 h-8 transition border rounded-full border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                aria-label={
                  themeMode === 'dark'
                    ? 'Включить светлую тему'
                    : 'Включить тёмную тему'
                }
                title={themeMode === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
              >
                <FontAwesomeIcon
                  icon={themeMode === 'dark' ? faSun : faMoon}
                  className="w-4 h-4"
                />
              </button>
            </div>
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 sm:text-2xl">
            {gameName}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {isStoryGame
              ? 'Story-квест'
              : gameType === 'photo'
                ? 'Фотоквест'
                : 'Автоквест'}
            {!isStoryGame ? (
              <>
                {' · '}
                {tasksCount}{' '}
                {tasksCount === 1
                  ? 'задание'
                  : tasksCount < 5
                    ? 'задания'
                    : 'заданий'}
                {' · '}
                {taskDurationMinutes} мин на задание
                {cluesDurationMinutes > 0 ? (
                  <>
                    {' · '}
                    подсказки каждые {cluesDurationMinutes} мин
                  </>
                ) : null}
                {breakDurationMinutes > 0 ? (
                  <>
                    {' · '}
                    перерыв {breakDurationMinutes} мин
                  </>
                ) : null}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center justify-end w-full gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={isDetailedView}
              onChange={(event) => setIsDetailedView(event.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/40"
            />
            Подробно
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/40"
            />
            Авто
          </label>
          {/* <select
            value={String(autoRefreshIntervalMs)}
            onChange={(event) => {
              const parsed = Number(event.target.value)
              if (Number.isFinite(parsed) && parsed > 0) {
                setAutoRefreshIntervalMs(parsed)
              }
            }}
            disabled={!autoRefresh}
            className="aq-select-game-control h-8 min-w-[82px] rounded-lg border border-slate-300 bg-white pl-2.5 text-xs text-slate-700 outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600/70 dark:bg-slate-800/70 dark:text-slate-200"
            aria-label="Интервал автообновления"
          >
            {AUTO_REFRESH_OPTIONS.map((option) => (
              <option key={option.value} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select> */}
          <button
            type="button"
            onClick={() => refetchStatus()}
            className="inline-flex items-center justify-center w-8 h-8 transition border rounded-full border-cyan-400 bg-cyan-100 text-cyan-700 hover:bg-cyan-200 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:bg-cyan-500/20"
            aria-label="Обновить"
            title="Обновить"
          >
            <FontAwesomeIcon icon={faArrowsRotate} className="w-4 h-4" />
          </button>
        </div>
      </div>

      {(lastUpdated || gameElapsedSeconds !== null) && (
        <div className="flex flex-wrap items-center mb-4 text-xs gap-x-5 gap-y-1 text-slate-600 dark:text-slate-500">
          <span>
            Время игры:{' '}
            <span className="font-mono text-slate-700 dark:text-slate-300">
              {gameElapsedSeconds !== null
                ? formatTime(gameElapsedSeconds)
                : '—'}
            </span>
          </span>
          {lastUpdated && (
            <span>
              Обновлено:{' '}
              {lastUpdated.toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          )}
        </div>
      )}

      {isStoryGame ? (
        <StoryControlDashboard
          storyData={storyControlData}
          isLoading={storyControlLoading}
          error={resolvedStoryControlError}
          onRefresh={() => {
            void refetchStoryControl()
          }}
          onMutation={runStoryControlMutation}
          isMutating={storyMutationLoading}
        />
      ) : (
        <>
          {/* Сводка */}
          <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
            <div className="p-3 text-center bg-white border rounded-xl border-slate-200 dark:border-slate-700/50 dark:bg-slate-800/60">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {teams.length}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Команд
              </div>
            </div>
            <div className="p-3 text-center border border-green-300 rounded-xl bg-green-50 dark:border-green-500/30 dark:bg-green-900/10">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {teams.filter((t) => t.isTeamFinished).length}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Финишировали
              </div>
            </div>
            <div className="p-3 text-center border rounded-xl border-cyan-300 bg-cyan-50 dark:border-cyan-500/30 dark:bg-cyan-900/10">
              <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                {
                  teams.filter(
                    (t) =>
                      !t.isTeamFinished &&
                      !t.isTeamOnBreak &&
                      !t.isActiveTaskFailed,
                  ).length
                }
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                В игре
              </div>
            </div>
            <div className="p-3 text-center border rounded-xl border-amber-300 bg-amber-50 dark:border-yellow-500/30 dark:bg-yellow-900/10">
              <div className="text-2xl font-bold text-amber-600 dark:text-yellow-400">
                {teams.filter((t) => t.isTeamOnBreak).length}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                На перерыве
              </div>
            </div>
          </div>

          {/* Команды */}
          {teams.length === 0 ? (
            <div className="p-8 text-center bg-white border rounded-xl border-slate-200 dark:border-slate-700/50 dark:bg-slate-800/40">
              <p className="text-slate-600 dark:text-slate-400">
                Нет зарегистрированных команд
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map((team, index) => {
                const activeTask =
                  Array.isArray(data?.tasks) &&
                  Number.isInteger(team?.activeTaskIndex) &&
                  team.activeTaskIndex >= 0
                    ? data.tasks[team.activeTaskIndex]
                    : null
                const codePhotoLookup = buildCodePhotoLookup(activeTask)
                const getPhotoByCode = (codeKey) =>
                  (codePhotoLookup instanceof Map
                    ? codePhotoLookup.get(codeKey)
                    : '') || ''
                const handleCodeBadgeClick = ({ code, photoUrl }) =>
                  setSelectedCodePhoto({
                    code: String(code || ''),
                    photoUrl: String(photoUrl || ''),
                  })
                const foundBonusEntries = team.bonusCodeItems?.length
                  ? team.bonusCodeItems
                  : team.bonusCodes
                const foundPenaltyEntries = team.penaltyCodeItems?.length
                  ? team.penaltyCodeItems
                  : team.penaltyCodes
                const foundMainEntries = normalizeCodeEntries(team.findedCodes)
                const mainCodesProgress = getMainCodesProgress(
                  team,
                  data?.tasks,
                )
                const remainingBonusEntries = getRemainingCodeEntries({
                  team,
                  tasks: data?.tasks,
                  taskFieldName: 'bonusCodes',
                  foundEntries: foundBonusEntries,
                })
                const remainingPenaltyEntries = getRemainingCodeEntries({
                  team,
                  tasks: data?.tasks,
                  taskFieldName: 'penaltyCodes',
                  foundEntries: foundPenaltyEntries,
                })
                const shouldShowBonusCodes =
                  normalizeCodeEntries(foundBonusEntries).length > 0 ||
                  remainingBonusEntries.length > 0
                const shouldShowPenaltyCodes =
                  normalizeCodeEntries(foundPenaltyEntries).length > 0 ||
                  remainingPenaltyEntries.length > 0

                return (
                  <div
                    key={team.teamId}
                    className={`rounded-xl border p-4 transition ${teamStatusColor(team)}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-500">
                          #{index + 1}
                        </span>
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full ${statusDotColor(team)}`}
                        />
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                          {team.teamName}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:border-slate-600/50 dark:bg-slate-700/50 dark:text-slate-300">
                          {teamStatusLabel(team)}
                        </span>
                        <CardActionIconButton
                          onClick={() => {
                            setSelectedTeamForTaskPreviewId(
                              String(team.teamId || ''),
                            )
                            setIsTasksViewModalOpen(true)
                          }}
                          label="Открыть текущее задание команды"
                          title="Текущее задание команды"
                          className="w-8 h-8"
                        >
                          <TargetCardIcon />
                        </CardActionIconButton>
                        <CardActionIconButton
                          onClick={() =>
                            setSelectedTeamForStatsId(String(team.teamId || ''))
                          }
                          label="Открыть статистику команды"
                          title="Статистика команды"
                          className="w-8 h-8"
                        >
                          <TeamStatsCardIcon />
                        </CardActionIconButton>
                        <CardActionIconButton
                          onClick={() =>
                            setSelectedTeamForContactsId(
                              String(team.teamId || ''),
                            )
                          }
                          label="Просмотр участников команды"
                          title="Участники и контакты"
                          className="w-8 h-8"
                        >
                          <TeamCardIcon />
                        </CardActionIconButton>
                        <CardActionIconButton
                          onClick={() => handleOpenTeamPushModal(team)}
                          label="Отправить сообщение команде"
                          title="Отправить сообщение команде"
                          className="relative w-8 h-8"
                          disabled={
                            teamPushLoadingId === String(team.teamId || '')
                          }
                        >
                          <ChatCardIcon />
                          {Number(team.unreadTeamMessagesCount || 0) > 0 ? (
                            <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow">
                              {Number(team.unreadTeamMessagesCount || 0) > 99
                                ? '99+'
                                : Number(team.unreadTeamMessagesCount || 0)}
                            </span>
                          ) : null}
                        </CardActionIconButton>
                        {!team.isTeamOnBreak ? (
                          <CardActionIconButton
                            onClick={() =>
                              setSelectedTeamForManualActionsId(
                                String(team.teamId || ''),
                              )
                            }
                            label="Ручные действия с кодами"
                            title="Ручные действия"
                            className="w-8 h-8"
                          >
                            <EditCardIcon />
                          </CardActionIconButton>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2 text-sm">
                      <div>
                        <span className="text-slate-600 dark:text-slate-500">
                          Задание:{' '}
                        </span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {team.isTeamFinished
                            ? 'Завершено'
                            : `${team.activeTaskIndex + 1}. ${team.currentTaskTitle || 'Без названия'}`}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-600 dark:text-slate-500">
                          Основные коды:{' '}
                        </span>
                        <span className="font-medium text-green-400">
                          {team.findedCodesCount}
                        </span>
                        {mainCodesProgress.remainingCount > 0 ? (
                          <span className="font-medium text-slate-600 dark:text-slate-400">
                            {' / '}
                            {mainCodesProgress.remainingCount}
                          </span>
                        ) : null}
                        {team.wrongCodesCount > 0 && (
                          <button
                            type="button"
                            className="ml-1 underline transition text-rose-600 decoration-dotted underline-offset-2 hover:text-rose-500 dark:text-red-400 dark:hover:text-red-300"
                            onClick={() =>
                              setWrongCodesModalData({
                                teamName: String(team.teamName || ''),
                                taskLabel: team.isTeamFinished
                                  ? 'Завершено'
                                  : `${team.activeTaskIndex + 1}. ${team.currentTaskTitle || 'Без названия'}`,
                                wrongCodes: normalizeCodeEntries(
                                  team.wrongCodes,
                                ).map((entry) => entry.code),
                              })
                            }
                          >
                            ({team.wrongCodesCount} неверн.)
                          </button>
                        )}
                        {isDetailedView && foundMainEntries.length > 0 ? (
                          <div className="mt-1">
                            {renderCodesBadges(foundMainEntries, 'default', {
                              getPhotoByCode,
                              onCodeClick: handleCodeBadgeClick,
                            })}
                          </div>
                        ) : null}
                        {isDetailedView &&
                          (() => {
                            const remainingMainCodes =
                              mainCodesProgress.remainingCodes
                            if (remainingMainCodes.length === 0) {
                              return null
                            }
                            return (
                              <div className="mt-1">
                                {renderCodesBadges(
                                  remainingMainCodes,
                                  'muted',
                                  {
                                    getPhotoByCode,
                                    onCodeClick: handleCodeBadgeClick,
                                  },
                                )}
                              </div>
                            )
                          })()}
                      </div>
                      {shouldShowBonusCodes && (
                        <div>
                          <span className="text-slate-600 dark:text-slate-500">
                            Бонусные коды:{' '}
                          </span>
                          <span className="font-medium text-emerald-400">
                            {team.bonusCodesCount}
                          </span>
                          {isDetailedView &&
                          normalizeCodeEntries(foundBonusEntries).length > 0 ? (
                            <div className="mt-1">
                              {renderCodesBadges(foundBonusEntries, 'bonus', {
                                getPhotoByCode,
                                onCodeClick: handleCodeBadgeClick,
                              })}
                            </div>
                          ) : null}
                          {isDetailedView &&
                            remainingBonusEntries.length > 0 && (
                              <div className="mt-1">
                                {renderCodesBadges(
                                  remainingBonusEntries,
                                  'muted',
                                  {
                                    getPhotoByCode,
                                    onCodeClick: handleCodeBadgeClick,
                                  },
                                )}
                              </div>
                            )}
                        </div>
                      )}
                      {shouldShowPenaltyCodes && (
                        <div>
                          <span className="text-slate-600 dark:text-slate-500">
                            Штрафные коды:{' '}
                          </span>
                          <span className="font-medium text-rose-600 dark:text-red-400">
                            {team.penaltyCodesCount}
                          </span>
                          {isDetailedView &&
                          normalizeCodeEntries(foundPenaltyEntries).length >
                            0 ? (
                            <div className="mt-1">
                              {renderCodesBadges(
                                foundPenaltyEntries,
                                'penalty',
                                {
                                  getPhotoByCode,
                                  onCodeClick: handleCodeBadgeClick,
                                },
                              )}
                            </div>
                          ) : null}
                          {isDetailedView &&
                            remainingPenaltyEntries.length > 0 && (
                              <div className="mt-1">
                                {renderCodesBadges(
                                  remainingPenaltyEntries,
                                  'muted',
                                  {
                                    getPhotoByCode,
                                    onCodeClick: handleCodeBadgeClick,
                                  },
                                )}
                              </div>
                            )}
                        </div>
                      )}
                      {!team.isTeamFinished &&
                        !team.isTeamOnBreak &&
                        !(
                          team.isTeamOnBreak &&
                          team.isBreakFinishedWaitingForNextTask
                        ) &&
                        (() => {
                          const effectiveTaskSeconds = normalizeSeconds(
                            team.currentTaskSeconds,
                          )
                          const actualTaskSeconds = normalizeSeconds(
                            team.currentTaskActualSeconds,
                            effectiveTaskSeconds,
                          )
                          const hasEarlyClueTimeShift =
                            actualTaskSeconds !== effectiveTaskSeconds

                          return (
                            <>
                              {hasEarlyClueTimeShift ? (
                                <div>
                                  <span className="text-slate-600 dark:text-slate-500">
                                    Фактически на задании:{' '}
                                  </span>
                                  <span className="font-mono font-medium text-cyan-700 dark:text-cyan-300">
                                    {formatTime(actualTaskSeconds)}
                                  </span>
                                </div>
                              ) : null}
                              <div>
                                <span className="text-slate-600 dark:text-slate-500">
                                  {hasEarlyClueTimeShift
                                    ? 'С учетом досрочных подсказок: '
                                    : 'На задании: '}
                                </span>
                                <span className="font-mono font-medium text-cyan-700 dark:text-cyan-300">
                                  {formatTime(effectiveTaskSeconds)}
                                </span>
                              </div>
                            </>
                          )
                        })()}
                      {!team.isTeamFinished &&
                        !team.isTeamOnBreak &&
                        !team.isActiveTaskFailed &&
                        (() => {
                          const elapsed = Math.max(
                            0,
                            Math.floor(team.currentTaskSeconds || 0),
                          )
                          const failRemaining = Math.max(
                            0,
                            Math.floor(taskDuration || 0) - elapsed,
                          )
                          const clueInterval = Math.max(
                            1,
                            Math.floor(cluesDuration || 0),
                          )
                          const mod = elapsed % clueInterval
                          const clueRemaining =
                            clueInterval > 0
                              ? mod === 0
                                ? clueInterval
                                : clueInterval - mod
                              : Number.POSITIVE_INFINITY
                          const canShowClueTimer =
                            Number(cluesDuration) > 0 &&
                            clueRemaining < failRemaining

                          if (canShowClueTimer) {
                            return (
                              <div>
                                <span className="text-slate-600 dark:text-slate-500">
                                  До подсказки:{' '}
                                </span>
                                <span className="font-mono font-medium text-violet-700 dark:text-violet-300">
                                  {formatTime(clueRemaining)}
                                </span>
                                {team.cluesReceived > 0 && (
                                  <span className="text-slate-600 dark:text-slate-500">
                                    {' (получено: '}
                                    {team.cluesReceived}
                                    {Number(team.forcedCluesReceived) > 0
                                      ? ` из них ${formatForcedCluesCount(team.forcedCluesReceived)}`
                                      : ''}
                                    {')'}
                                  </span>
                                )}
                              </div>
                            )
                          }

                          return (
                            <div>
                              <span className="text-slate-600 dark:text-slate-500">
                                До провала задания:{' '}
                              </span>
                              <span className="font-mono font-medium text-rose-700 dark:text-rose-300">
                                {formatTime(failRemaining)}
                              </span>
                            </div>
                          )
                        })()}
                      {team.isTeamOnBreak && team.isActiveTaskFailed ? (
                        <div className="rounded-lg border border-rose-400 bg-rose-100 px-2.5 py-1.5 text-xs font-medium text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                          {team.isActiveTaskFailedByCaptain
                            ? 'Команда слила предыдущее задание досрочно.'
                            : 'Команда провалила предыдущее задание.'}
                        </div>
                      ) : null}
                      {team.isTeamOnBreak &&
                        !team.isActiveTaskFailed &&
                        team.completedTaskSeconds > 0 && (
                          <div>
                            <span className="text-slate-600 dark:text-slate-500">
                              Предыдущее задание завершено за:{' '}
                            </span>
                            <span className="font-mono font-medium text-emerald-700 dark:text-emerald-300">
                              {formatTime(team.completedTaskSeconds)}
                            </span>
                          </div>
                        )}
                      {!team.isTeamFinished &&
                        team.isTeamOnBreak &&
                        !team.isBreakFinishedWaitingForNextTask && (
                          <div>
                            <span className="text-slate-600 dark:text-slate-500">
                              Перерыв завершится через:{' '}
                            </span>
                            <span className="font-mono font-medium text-amber-700 dark:text-yellow-300">
                              {formatTime(team.breakTimeLeftSeconds)}
                            </span>
                          </div>
                        )}
                      {team.isBreakFinishedWaitingForNextTask && (
                        <div className="rounded-lg border border-amber-400 bg-amber-100 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                          Перерыв окончен, но следующее задание еще не начато.
                        </div>
                      )}
                      {team.isTeamOnBreak &&
                        !team.isTeamFinished &&
                        Number.isInteger(team.activeTaskIndex) &&
                        team.activeTaskIndex + 1 <
                          Number(data?.tasksCount || 0) && (
                          <div>
                            <span className="text-slate-600 dark:text-slate-500">
                              Следующее задание:{' '}
                            </span>
                            <span className="font-medium text-cyan-700 dark:text-cyan-200">
                              {`${team.activeTaskIndex + 2}. ${team.nextTaskTitle || 'Без названия'}`}
                            </span>
                          </div>
                        )}
                    </div>

                    {/* Фото (для photo-квестов) */}
                    {gameType === 'photo' && team.currentPhotosCount > 0 && (
                      <div className="mt-1 text-xs text-slate-600 dark:text-slate-500">
                        Фото отправлено: {team.currentPhotosCount}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      <GameTasksViewModal
        isTasksViewModalOpen={isTasksViewModalOpen}
        handleCloseTasksViewModal={() => {
          setIsTasksViewModalOpen(false)
          setSelectedTeamForTaskPreviewId('')
        }}
        selectedGame={gameForTasksModal}
        canViewCodePhotos
        showAllTaskDetails
      />
      <GameControlTeamStatsModal
        isOpen={Boolean(selectedTeamForStatsId)}
        onClose={() => setSelectedTeamForStatsId('')}
        teamName={selectedTeamForStats?.teamName || ''}
        gameType={gameType}
        stats={selectedTeamForStats?.teamProgressStats || null}
      />
      <Modal
        isOpen={Boolean(selectedTeamForContactsId)}
        onClose={() => setSelectedTeamForContactsId('')}
        title={
          selectedTeamForContacts?.teamName
            ? `Участники — ${selectedTeamForContacts.teamName}`
            : 'Участники команды'
        }
        compactMobile
      >
        <div className="space-y-3">
          {Array.isArray(selectedTeamForContacts?.members) &&
          selectedTeamForContacts.members.length > 0 ? (
            selectedTeamForContacts.members.map((member, index) => {
              const username = String(member?.username || '')
                .trim()
                .replace(/^@+/, '')
              const phone = normalizePhoneDigits(member?.phone)
              const phoneValue = phone
                ? phone.startsWith('+')
                  ? phone
                  : `+${phone}`
                : ''
              const telegramId = String(member?.telegramId || '').trim()
              const roleNormalized = String(member?.role || '')
                .trim()
                .toLowerCase()
              const isCaptain =
                roleNormalized === 'captain' ||
                roleNormalized === 'капитан'
              return (
                <div
                  key={`${member?.id || member?.telegramId || 'member'}-${index}`}
                  className="p-3 bg-white border rounded-xl border-slate-200 dark:border-slate-700/60 dark:bg-slate-900/60"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {member?.name || 'Участник'}
                    </p>
                    {isCaptain ? (
                      <span className="rounded-full border border-emerald-500/45 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                        Капитан
                      </span>
                    ) : null}
                  </div>
                  <div className="grid gap-3 mt-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-500">Телефон</p>
                      {phoneValue ? (
                        <a
                          href={`tel:${phoneValue}`}
                          className="inline-block mt-1 text-sm text-cyan-300 underline-offset-2 hover:underline"
                        >
                          {phoneValue}
                        </a>
                      ) : (
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          Не указан
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">
                        Telegram username
                      </p>
                      {username ? (
                        <a
                          href={`https://t.me/${username}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block mt-1 text-sm text-cyan-300 underline-offset-2 hover:underline"
                        >
                          @{username}
                        </a>
                      ) : (
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          Не указан
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Telegram ID</p>
                      {telegramId ? (
                        <a
                          href={`tg://user?id=${telegramId}`}
                          className="inline-block mt-1 text-sm text-cyan-300 underline-offset-2 hover:underline"
                        >
                          {telegramId}
                        </a>
                      ) : (
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          Не указан
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">
                        Telegram по номеру телефона
                      </p>
                      {phoneValue ? (
                        <a
                          href={`https://t.me/+${phoneValue.replace(/^\+/, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block mt-1 text-sm text-cyan-300 underline-offset-2 hover:underline"
                        >
                          t.me/+{phoneValue.replace(/^\+/, '')}
                        </a>
                      ) : (
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          Не указан
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <p className="text-sm text-slate-400">Состав команды не найден.</p>
          )}
        </div>
      </Modal>
      <Modal
        isOpen={Boolean(selectedTeamForPushId)}
        onClose={closeTeamPushModal}
        title={
          isGameWideMessageModal
            ? 'Сообщение всем командам'
            : selectedTeamForPush?.teamName
              ? `Сообщение команде — ${selectedTeamForPush.teamName}`
              : 'Сообщение команде'
        }
        compactMobile
        dialogClassName="md:h-[90vh]"
        bodyClassName="flex flex-col pb-0"
        footer={
          <>
            <button
              type="button"
              onClick={closeTeamPushModal}
              className="aq-modal-btn aq-modal-btn-secondary"
              disabled={Boolean(teamPushLoadingId)}
            >
              Закрыть
            </button>
            <button
              type="button"
              onClick={() => handleSendTeamPush(selectedTeamForPush)}
              className="aq-modal-btn aq-modal-btn-primary"
              disabled={Boolean(teamPushLoadingId) || !teamPushMessage.trim()}
            >
              {teamPushLoadingId ? 'Отправляем...' : 'Отправить'}
            </button>
          </>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <GameMessageHistory
            messages={teamMessageHistory}
            isLoading={teamMessageHistoryLoading}
            error={teamMessageHistoryError}
            listRef={teamMessageHistoryListRef}
            showPushDelivery
          />
          <GameMessageComposer
            textareaId="team-push-message"
            textareaRef={teamPushTextareaRef}
            value={teamPushMessage}
            onChange={handleTeamPushMessageChange}
            disabled={Boolean(teamPushLoadingId)}
            sendPush={teamPushSendPush}
            onSendPushChange={setTeamPushSendPush}
            pushDisabled={Boolean(teamPushLoadingId)}
          />
        </div>
      </Modal>
      <GamePushBroadcastModal
        isOpen={isGameConversationsModalOpen}
        onClose={handleCloseGameConversationsModal}
        gameId={String(data?.gameId || gameId || '')}
        gameName={gameName || ''}
        gameStatus={gameStatus || ''}
        onFeedback={({ type, message }) => {
          showToast(type, message)
        }}
      />
      <Modal
        isOpen={Boolean(selectedCodePhoto?.photoUrl)}
        onClose={() => {
          setSelectedCodePhoto(null)
          setIsFullscreenCodePhotoOpen(false)
        }}
        title={
          selectedCodePhoto?.code
            ? `Фото кода: ${selectedCodePhoto.code}`
            : 'Фото кода'
        }
        compactMobile
      >
        <div className="p-3 bg-white border rounded-xl border-slate-200 dark:border-slate-700/60 dark:bg-slate-900/60">
          {selectedCodePhoto?.photoUrl ? (
            <img
              src={selectedCodePhoto.photoUrl}
              alt={selectedCodePhoto?.code || 'Фото кода'}
              className="max-h-[70vh] w-full cursor-zoom-in rounded-lg object-contain"
              draggable={false}
              onClick={() => setIsFullscreenCodePhotoOpen(true)}
            />
          ) : null}
        </div>
      </Modal>
      <FullscreenImageViewer
        isOpen={
          isFullscreenCodePhotoOpen && Boolean(selectedCodePhoto?.photoUrl)
        }
        src={selectedCodePhoto?.photoUrl || ''}
        alt={
          selectedCodePhoto?.code
            ? `Фото кода: ${selectedCodePhoto.code}`
            : 'Фото кода'
        }
        onClose={() => setIsFullscreenCodePhotoOpen(false)}
      />
      <FeedbackToast event={toastEvent} />
      <Modal
        isOpen={Boolean(wrongCodesModalData)}
        onClose={() => setWrongCodesModalData(null)}
        title={
          wrongCodesModalData?.teamName
            ? `Неверные коды — ${wrongCodesModalData.teamName}`
            : 'Неверные коды'
        }
        compactMobile
      >
        <div className="space-y-3">
          {wrongCodesModalData?.taskLabel ? (
            <p className="text-sm text-slate-400">
              Задание: {wrongCodesModalData.taskLabel}
            </p>
          ) : null}
          {Array.isArray(wrongCodesModalData?.wrongCodes) &&
          wrongCodesModalData.wrongCodes.length > 0 ? (
            <ul className="space-y-2">
              {wrongCodesModalData.wrongCodes.map((code, index) => (
                <li
                  key={`${code}-${index}`}
                  className="px-3 py-2 font-mono text-sm border rounded-lg border-rose-500/35 bg-rose-500/10 text-rose-200"
                >
                  {code}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">Нет неверных кодов.</p>
          )}
        </div>
      </Modal>
      <Modal
        isOpen={Boolean(selectedTeamForManualActionsId)}
        onClose={closeManualActionsModal}
        title={
          selectedTeamForManualActions?.teamName
            ? `Ручные действия — ${selectedTeamForManualActions.teamName}`
            : 'Ручные действия'
        }
        compactMobile
        footer={
          <>
            <button
              type="button"
              onClick={closeManualActionsModal}
              className="aq-modal-btn aq-modal-btn-secondary"
              disabled={manualActionLoading}
            >
              Закрыть
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {manualActionError ? (
            <div className="px-3 py-2 text-sm border rounded-xl border-rose-500/40 bg-rose-500/10 text-rose-200">
              {manualActionError}
            </div>
          ) : null}

          <div className="p-3 bg-white border rounded-xl border-slate-200 dark:border-slate-700/60 dark:bg-slate-900/60">
            <p className="text-xs font-semibold tracking-wide uppercase text-slate-400">
              Зачесть код команде
            </p>
            <div className="flex flex-col gap-3 mt-2 sm:flex-row sm:items-end">
              <div className="flex-1 min-w-0">
                <label className="block mb-1 text-xs text-slate-400">
                  Код из ещё не введённых
                </label>
                <select
                  value={selectedManualCode}
                  onChange={(event) =>
                    setSelectedManualCode(event.target.value)
                  }
                  className="w-full px-3 py-2 text-sm transition bg-white border rounded-lg outline-none border-slate-300 text-slate-900 focus:border-cyan-500 dark:border-slate-600/80 dark:bg-slate-800/80 dark:text-slate-100"
                  disabled={
                    manualActionLoading || manualCodeCandidates.length === 0
                  }
                >
                  {manualCodeCandidates.length === 0 ? (
                    <option value="">Нет доступных кодов</option>
                  ) : (
                    manualCodeCandidates.map((item) => (
                      <option
                        key={`${item.category}-${item.code}`}
                        value={item.code}
                      >
                        {item.label}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <button
                type="button"
                onClick={handleApplyManualCode}
                disabled={
                  manualActionLoading || manualCodeCandidates.length === 0
                }
                className="aq-modal-btn aq-modal-btn-primary"
              >
                {manualActionLoading ? 'Применяем...' : 'Зачесть код'}
              </button>
            </div>
          </div>

          <div className="p-3 border rounded-xl border-amber-500/40 bg-amber-500/10">
            <p className="text-xs font-semibold tracking-wide uppercase text-amber-200">
              Завершение задания
            </p>
            <p className="mt-1 text-sm text-amber-100/90">
              Принудительно завершает текущее задание для команды от имени
              администратора.
            </p>
            <button
              type="button"
              onClick={handleForceCompleteTask}
              disabled={
                manualActionLoading ||
                selectedTeamForManualActions?.isTeamFinished
              }
              className="mt-3 aq-modal-btn aq-modal-btn-primary"
            >
              {manualActionLoading ? 'Применяем...' : 'Выполнить задание'}
            </button>
          </div>

          <div className="p-3 border rounded-xl border-rose-500/40 bg-rose-500/10">
            <p className="text-xs font-semibold tracking-wide uppercase text-rose-200">
              Провал задания
            </p>
            <p className="mt-1 text-sm text-rose-100/90">
              Принудительно проваливает текущее задание. Команде засчитывается
              полная длительность задания, затем запускается стандартный перерыв
              (если он задан).
            </p>
            <button
              type="button"
              onClick={handleForceFailTask}
              disabled={
                manualActionLoading ||
                selectedTeamForManualActions?.isTeamFinished
              }
              className="mt-3 aq-modal-btn aq-modal-btn-primary"
            >
              {manualActionLoading ? 'Применяем...' : 'Провалить задание'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

GameControlPageClient.propTypes = {
  session: PropTypes.shape({
    user: PropTypes.object.isRequired,
  }).isRequired,
}
