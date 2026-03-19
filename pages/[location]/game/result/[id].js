import { getData } from '@helpers/CRUD'
// import { getSession } from 'next-auth/react'
import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import getSecondsBetween from '@helpers/getSecondsBetween'
// import Image from 'next/image'
import cn from 'classnames'
import { PASTEL_COLORS } from '@helpers/constants'
import { normalizeTeamCarSkin } from '@helpers/teamCarSkins'
import ClassicCar from '@components/cars/ClassicCar'
import SportCar from '@components/cars/SportCar'
import SuvCar from '@components/cars/SuvCar'
import VanCar from '@components/cars/VanCar'

const CYBER_CAR_COLORS = [
  '#68e8ff',
  '#ff7fe6',
  '#7dffb8',
  '#ffd166',
  '#9aa8ff',
  '#ff8f8f',
  '#81fff0',
  '#c9ff6f',
  '#ffb3ff',
  '#9fffd7',
]

const Car = ({
  name,
  color = '#000000',
  rowHeight,
  isDarkTheme = false,
  skin = 'classic',
}) => {
  const resolvedSkin = normalizeTeamCarSkin(skin)

  if (resolvedSkin === 'classic') {
    return (
      <ClassicCar
        name={name}
        color={color}
        rowHeight={rowHeight}
        isDarkTheme={isDarkTheme}
      />
    )
  }
  if (resolvedSkin === 'sport') {
    return (
      <SportCar
        name={name}
        color={color}
        rowHeight={rowHeight}
        isDarkTheme={isDarkTheme}
      />
    )
  }

  if (resolvedSkin === 'suv') {
    return (
      <SuvCar
        name={name}
        color={color}
        rowHeight={rowHeight}
        isDarkTheme={isDarkTheme}
      />
    )
  }

  return (
    <VanCar
      name={name}
      color={color}
      rowHeight={rowHeight}
      isDarkTheme={isDarkTheme}
    />
  )
}

const toHHMMSS = (sec, noHours = false) => {
  const tempSec = Math.abs(sec)
  var sec_num = parseInt(tempSec, 10) // don't forget the second param
  var hours = Math.floor(sec_num / 3600)
  var minutes = Math.floor((sec_num - hours * 3600) / 60)
  var seconds = sec_num - hours * 3600 - minutes * 60

  if (hours < 10) {
    hours = '0' + hours
  }
  if (minutes < 10) {
    minutes = '0' + minutes
  }
  if (seconds < 10) {
    seconds = '0' + seconds
  }
  return (
    (sec < 0 ? '-' : '') +
    (noHours && hours === '00' ? '' : hours + ':') +
    minutes +
    ':' +
    seconds
  )
}

const normalizeId = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  if (typeof value.toString === 'function') {
    const stringValue = value.toString()
    return stringValue && stringValue !== '[object Object]' ? stringValue : ''
  }

  return ''
}

const Time = ({ start, seconds, duration, forceFinish = false }) => {
  const [time, setTime] = useState(0)
  const [interval, setIntervalState] = useState(null)

  useEffect(() => {
    if (forceFinish) {
      if (interval) {
        clearInterval(interval)
        setIntervalState(null)
      }
      setTime(seconds)
      return
    }

    if (start) {
      const safeDuration = Number(duration) > 0 ? Number(duration) : 0.01
      setIntervalState(
        setInterval(() => {
          setTime((state) => state + seconds / (safeDuration * 10))
        }, 100),
      )
    } else {
      clearInterval(interval)
      setIntervalState(null)
      setTime(0)
    }
  }, [start, seconds, duration, forceFinish])

  useEffect(() => {
    if (interval && time >= seconds) {
      setTime(seconds)
      clearInterval(interval)
      setIntervalState(null)
    }
  }, [time, seconds, interval])

  return <div>{toHHMMSS(time)}</div>
}

const TimeResult = ({
  start,
  delay,
  timeResult,
  color,
  penalty,
  bonus,
  addings, // Не используется
  adjustments,
  rowHeight,
  isBonusTask,
  ...props
}) => {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)
  const penaltySeconds = Number.isFinite(Number(penalty))
    ? Math.max(0, Number(penalty))
    : 0
  const bonusSeconds = Number.isFinite(Number(bonus))
    ? Math.max(0, Number(bonus))
    : 0
  const hasAdjustmentsData =
    Array.isArray(adjustments) && adjustments.length > 0
  const hasAnyAdjustment =
    hasAdjustmentsData || penaltySeconds > 0 || bonusSeconds > 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{
        opacity: start ? [0, 0, 1, 1] : 0,
      }}
      transition={{
        // type: 'just',
        ease: 'linear',
        // type: 'spring',
        // stiffness: 1,
        // duration: start ? duration : 0,
        delay: start ? delay : 0,
      }}
      className={cn(
        'flex flex-col font-bold w-[120px] items-center justify-center',
        isBonusTask
          ? 'text-gray-800 dark:text-slate-300'
          : color === 'red'
            ? 'text-red-600 dark:text-rose-300'
            : color === 'blue'
              ? 'text-blue-700 dark:text-cyan-300'
              : color === 'green'
                ? 'text-green-800 dark:text-emerald-300'
                : 'text-slate-800 dark:text-slate-200',
      )}
      style={{
        height: rowHeight,
        minHeight: rowHeight,
      }}
      {...props}
    >
      {isBonusTask ? '---' : toHHMMSS(timeResult)}
      {hasAnyAdjustment && (
        <div className="relative flex -mb-[9px] -mt-1.5 text-xs font-normal">
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-x-2 rounded-md border border-slate-300/70 bg-white/75 px-1.5 py-0.5 transition hover:bg-white dark:border-cyan-500/30 dark:bg-[#0a1730]/70 dark:hover:bg-[#0f1f3f]"
            onClick={(event) => {
              event.stopPropagation()
              setIsTooltipOpen((state) => !state)
            }}
            title="Показать бонусы и штрафы"
          >
            <span className="text-red-600 dark:text-rose-300">
              {toHHMMSS(penaltySeconds, true)}
            </span>
            <span className="text-green-800 dark:text-emerald-300">
              {toHHMMSS(bonusSeconds, true)}
            </span>
          </button>
          {isTooltipOpen && (
            <div className="absolute left-1/2 top-full z-30 mt-1.5 w-56 -translate-x-1/2 rounded-lg border border-cyan-300/60 bg-white/95 p-2 text-left text-[11px] text-slate-700 shadow-lg dark:border-cyan-500/35 dark:bg-[#07122a]/96 dark:text-slate-200">
              <p className="mb-1 font-semibold text-slate-800 dark:text-slate-100">
                Учтённые бонусы и штрафы
              </p>
              {hasAdjustmentsData ? (
                <ul className="space-y-1">
                  {adjustments.map((item, index) => {
                    const secondsValue = Number(item?.seconds)
                    const type = item?.type === 'bonus' ? 'bonus' : 'penalty'
                    const display =
                      item?.display || toHHMMSS(Math.abs(secondsValue), true)
                    const description =
                      item?.description || item?.name || 'Корректировка'
                    return (
                      <li
                        key={`${type}-${index}-${description}`}
                        className="flex items-start gap-1.5"
                      >
                        <span
                          className={cn(
                            'mt-0.5 inline-flex h-1.5 w-1.5 rounded-full',
                            type === 'bonus' ? 'bg-emerald-500' : 'bg-rose-500',
                          )}
                        />
                        <span>
                          <span
                            className={cn(
                              'font-mono',
                              type === 'bonus'
                                ? 'text-emerald-700 dark:text-emerald-300'
                                : 'text-rose-700 dark:text-rose-300',
                            )}
                          >
                            {display}
                          </span>{' '}
                          <span>{description}</span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <div className="space-y-1">
                  <p className="text-rose-700 dark:text-rose-300">
                    Штрафы: {toHHMMSS(penaltySeconds, true)}
                  </p>
                  <p className="text-emerald-700 dark:text-emerald-300">
                    Бонусы: {toHHMMSS(bonusSeconds, true)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

const GameBlock = ({ game, isDarkTheme }) => {
  if (!game) return null
  const [start, setStart] = useState(false)
  const [duration, setDuration] = useState(40) //totalSeconds / 100
  const [isForceFinished, setIsForceFinished] = useState(false)
  const [sortMode, setSortMode] = useState('result')

  const { result, tasks } = game
  if (!result) return <div>Результаты игры не сформированы</div>

  const gameTeams = Array.isArray(result?.gameTeams) ? result.gameTeams : []
  const teamsUsers = Array.isArray(result?.teamsUsers) ? result.teamsUsers : []
  const teams = Array.isArray(result?.teams) ? result.teams : []
  const computed =
    result?.computed && typeof result.computed === 'object'
      ? result.computed
      : null
  const computedTeams = Array.isArray(computed?.teams) ? computed.teams : []
  const computedByTeamId = new Map(
    computedTeams.map((teamResult) => [
      normalizeId(teamResult?.teamId),
      teamResult,
    ]),
  )
  const teamById = new Map(
    teams.map((team) => [normalizeId(team?._id ?? team?.id), team]),
  )

  const gameTeamsWithTeamsBase = gameTeams.map((gameTeam, index) => {
    const teamId = normalizeId(gameTeam?.teamId)
    return {
      ...gameTeam,
      registrationOrder: index,
      team: teamById.get(teamId),
      computedTeam: computedByTeamId.get(teamId) || null,
    }
  })
  const gameTeamsWithTeams = useMemo(() => {
    const sorted = [...gameTeamsWithTeamsBase]

    if (sortMode === 'registration') {
      sorted.sort((a, b) => {
        if (a.registrationOrder !== b.registrationOrder) {
          return a.registrationOrder - b.registrationOrder
        }
        return (a?.team?.name || '').localeCompare(
          (b?.team?.name || '').trim(),
          'ru',
        )
      })
      return sorted
    }

    sorted.sort((a, b) => {
      const aPlace = Number(a?.computedTeam?.place)
      const bPlace = Number(b?.computedTeam?.place)
      const aHasPlace = Number.isFinite(aPlace)
      const bHasPlace = Number.isFinite(bPlace)

      if (aHasPlace && bHasPlace && aPlace !== bPlace) {
        return aPlace - bPlace
      }
      if (aHasPlace && !bHasPlace) {
        return -1
      }
      if (!aHasPlace && bHasPlace) {
        return 1
      }

      return (a?.team?.name || '').localeCompare(
        (b?.team?.name || '').trim(),
        'ru',
      )
    })

    return sorted
  }, [gameTeamsWithTeamsBase, sortMode])

  const totalSeconds = getSecondsBetween(game.dateStartFact, game.dateEndFact)

  const tableTitleHeight = 60
  const rowHeight = 60
  // const breakDuration = game.breakDuration ?? 0
  const tasksCount = tasks?.length ?? 0
  const taskDuration = game.taskDuration ?? 3600
  const cluesDuration = game.cluesDuration ?? 1200
  const breakDuration = Number(game.breakDuration) || 0
  const taskFailurePenalty = game.taskFailurePenalty ?? 0
  const isTeamFinishedForAnimation = ({ computedTeam, endTime, activeNum }) => {
    if (computedTeam && typeof computedTeam.hasStopGame === 'boolean') {
      return !computedTeam.hasStopGame
    }

    const numericActiveNum = Number(activeNum)
    if (Number.isFinite(numericActiveNum) && numericActiveNum >= tasksCount) {
      return true
    }

    if (Array.isArray(endTime) && tasksCount > 0 && endTime[tasksCount - 1]) {
      return true
    }

    return false
  }

  const teamsAnimateSteps = gameTeamsWithTeams.map(({ startTime, endTime }) => {
    const tempResult = []
    for (let i = 0; i < tasksCount; i++) {
      const prevSum = i === 0 ? 0 : tempResult[i - 1]
      const task = tasks[i]
      if (task.canceled || task.isBonusTask) tempResult.push(prevSum)
      else if (!endTime[i] || !startTime[i])
        tempResult.push(prevSum + taskDuration)
      else
        tempResult.push(prevSum + getSecondsBetween(startTime[i], endTime[i]))
      // if (breakDuration > 0 && i < tasksCount - 1)
      //   tempResult.push(tempResult[i] + breakDuration)
    }

    return tempResult
  })

  const teamsFinishFlags = gameTeamsWithTeams.map((item) =>
    isTeamFinishedForAnimation({
      computedTeam: item?.computedTeam || null,
      endTime: item?.endTime,
      activeNum: item?.activeNum,
    }),
  )

  const teamTotalTimes = teamsAnimateSteps.map((steps) => {
    if (!Array.isArray(steps) || steps.length === 0) {
      return 0
    }
    return Number(steps[steps.length - 1]) || 0
  })

  const finishedTeamTimes = teamTotalTimes.filter(
    (time, index) =>
      teamsFinishFlags[index] && Number.isFinite(time) && time > 0,
  )
  const allTeamTimes = teamTotalTimes.filter(
    (time) => Number.isFinite(time) && time > 0,
  )
  const maxTeamTime =
    (finishedTeamTimes.length > 0
      ? Math.max(...finishedTeamTimes)
      : allTeamTimes.length > 0
        ? Math.max(...allTeamTimes)
      : 0) || 1
  const animationSeconds = Math.round(maxTeamTime)
  const animationDuration = isForceFinished ? 0 : duration

  const preparedTeamsAnimateSteps = teamsAnimateSteps.map((item) =>
    item.map((el) => {
      const clamped = Math.min(Number(el) || 0, maxTeamTime)
      return (clamped * 0.99) / maxTeamTime
    }),
  )

  const teamsTaskPenalty = gameTeamsWithTeams.map(
    (
      { computedTeam, findedPenaltyCodes, startTime, endTime, wrongCodes },
      index,
    ) => {
      if (computedTeam && Array.isArray(computedTeam.taskResults)) {
        return (tasks ?? []).map((_, taskIndex) => {
          const value = Number(
            computedTeam.taskResults?.[taskIndex]?.penaltySeconds,
          )
          return Number.isFinite(value) ? value : 0
        })
      }

      const tempResult = Array(tasksCount).fill(0)
      if (findedPenaltyCodes?.length > 0) {
        for (let i = 0; i < findedPenaltyCodes.length; i++) {
          if (findedPenaltyCodes[i]?.length > 0) {
            const codes = findedPenaltyCodes[i].map((code) =>
              code.toLowerCase(),
            )
            const penalty = tasks[i].penaltyCodes
              .filter(({ code }) => {
                return codes.includes(code.toLowerCase())
              })
              .reduce((sum, { penalty }) => sum + penalty, 0)
            tempResult[i] += penalty
          }
        }
      }
      if (taskFailurePenalty) {
        for (let i = 0; i < tasksCount; i++) {
          if (!tasks[i].isBonusTask && (!endTime[i] || !startTime[i])) {
            tempResult[i] += taskFailurePenalty
          }
        }
      }
      if (
        typeof game.manyCodesPenalty === 'object' &&
        game.manyCodesPenalty[0] > 0 &&
        typeof wrongCodes === 'object' &&
        wrongCodes !== null
      ) {
        const [maxCodes, penaltyForMaxCodes] = game.manyCodesPenalty
        for (let i = 0; i < tasksCount; i++) {
          if (
            typeof wrongCodes[i] === 'object' &&
            wrongCodes[i] !== null &&
            wrongCodes[i].length >= maxCodes
          ) {
            tempResult[i] +=
              Math.floor(wrongCodes[i].length / maxCodes) * penaltyForMaxCodes
          }
        }
      }
      return tempResult
    },
  )

  const teamsTaskBonus = gameTeamsWithTeams.map(
    ({ computedTeam, findedBonusCodes }, index) => {
      if (computedTeam && Array.isArray(computedTeam.taskResults)) {
        return (tasks ?? []).map((_, taskIndex) => {
          const value = Number(
            computedTeam.taskResults?.[taskIndex]?.bonusSeconds,
          )
          return Number.isFinite(value) ? value : 0
        })
      }

      const tempResult = []
      if (findedBonusCodes?.length > 0) {
        for (let i = 0; i < findedBonusCodes.length; i++) {
          if (findedBonusCodes[i]?.length > 0) {
            const codes = findedBonusCodes[i].map((code) => code.toLowerCase())
            const bonus = tasks[i].bonusCodes
              .filter(({ code }) => {
                return codes.includes(code.toLowerCase())
              })
              .reduce((sum, { bonus }) => sum + bonus, 0)
            tempResult.push(bonus)
          } else {
            tempResult.push(0)
          }
        }
      }
      return tempResult
    },
  )
  const teamsTaskAdjustments = gameTeamsWithTeams.map(({ computedTeam }) => {
    if (computedTeam && Array.isArray(computedTeam.taskResults)) {
      return (tasks ?? []).map((_, taskIndex) => {
        const taskAdjustments =
          computedTeam.taskResults?.[taskIndex]?.adjustments
        return Array.isArray(taskAdjustments) ? taskAdjustments : []
      })
    }

    return Array.from({ length: tasksCount }, () => [])
  })

  const totalPenalty = gameTeamsWithTeams.map(({ computedTeam }, index) => {
    if (computedTeam) {
      return (
        (Number(computedTeam.failurePenaltySeconds) || 0) +
        (Number(computedTeam.codePenaltySeconds) || 0) +
        (Number(computedTeam.manyWrongCodePenaltySeconds) || 0)
      )
    }
    return teamsTaskPenalty[index].reduce((sum, penalty) => sum + penalty, 0)
  })
  const totalBonus = gameTeamsWithTeams.map(({ computedTeam }, index) => {
    if (computedTeam) {
      return Number(computedTeam.codeBonusSeconds) || 0
    }
    return teamsTaskBonus[index].reduce((sum, bonus) => sum + bonus, 0)
  })
  const totalAddings = gameTeamsWithTeams.map(
    ({ computedTeam, timeAddings = [] }) => {
      if (computedTeam) {
        return Number(computedTeam.addingsSeconds) || 0
      }
      return timeAddings.reduce((acc, { time }) => acc + time, 0)
    },
  )

  const totalTeamsTime = gameTeamsWithTeams.map(({ computedTeam }, index) => {
    if (computedTeam) {
      return Number(computedTeam.baseSeconds) || 0
    }
    const timeArray = teamsAnimateSteps[index] || []
    return timeArray[timeArray.length - 1]
  })

  const totalTeamsTimeWithBonusAndPenalty = gameTeamsWithTeams.map(
    ({ computedTeam }, index) => {
      if (computedTeam) {
        return Number(computedTeam.finalSeconds) || 0
      }
      const totalTime = totalTeamsTime[index]
      return (
        totalTime +
        totalPenalty[index] -
        totalBonus[index] +
        totalAddings[index]
      )
    },
  )

  const fallbackPlaces = totalTeamsTimeWithBonusAndPenalty.map(
    (time) =>
      totalTeamsTimeWithBonusAndPenalty.filter((totalTime) => totalTime <= time)
        .length,
  )
  const orderPlaces = gameTeamsWithTeams.map(({ computedTeam }, index) => {
    const computedPlace = Number(computedTeam?.place)
    if (Number.isFinite(computedPlace)) {
      return computedPlace
    }
    return fallbackPlaces[index]
  })

  const stapWidth = 120
  const animateSteps = Array.from(
    { length: tasksCount + 1 },
    (_, i) => i * stapWidth,
  )
  animateSteps.push(animateSteps[animateSteps.length - 1] + 450)
  const tableBorderColor = isDarkTheme
    ? 'rgba(0, 209, 255, 0.26)'
    : 'rgba(15, 23, 42, 0.18)'

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-100 text-slate-900 dark:bg-[#040812] dark:text-slate-100">
      <div className="relative z-50 px-2 pb-2 pt-14 md:px-4">
        <div className="mx-auto w-fit rounded-3xl border border-slate-200/80 bg-white/82 p-3 shadow-[0_12px_38px_rgba(2,8,23,0.18)] backdrop-blur-sm dark:border-[#00D1FF]/34 dark:bg-[#070015]/86 dark:shadow-[0_0_0_1px_rgba(0,209,255,0.16),0_0_24px_rgba(122,0,255,0.16),0_24px_52px_rgba(0,0,0,0.6)]">
          <div className="h-[30px] text-center text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {game.name}
          </div>
          <div className="flex flex-col items-center mt-2 mb-2 gap-y-2">
            <div className="flex items-center justify-center gap-x-2">
              <div className="text-xs tablet:text-sm">
                Скорость демонстрации:
              </div>
              <select
                className="cursor-pointer px-3 py-1 transition border rounded-lg outline-none border-slate-300 bg-white/90 text-slate-800 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-300 dark:border-cyan-500/35 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-500/30"
                value={String(duration)}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                <option value={0.01}>Без демонистрации</option>
                <option value={10}>Быстро</option>
                <option value={40}>Нормально</option>
                <option value={80}>Медленно</option>
              </select>
            </div>
            <div className="flex items-center justify-center gap-x-2">
              <div className="text-xs tablet:text-sm">Сортировка:</div>
              <select
                className="cursor-pointer px-3 py-1 transition border rounded-lg outline-none border-slate-300 bg-white/90 text-slate-800 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-300 dark:border-cyan-500/35 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-500/30"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
              >
                <option value="registration">По регистрации</option>
                <option value="result">По результативности</option>
              </select>
            </div>
            <div className="mt-1 flex items-center justify-center gap-x-2">
              <button
                type="button"
                className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-cyan-300 bg-cyan-50/90 px-5 py-2 text-base font-semibold text-cyan-700 transition hover:border-cyan-500 hover:bg-cyan-100 dark:border-[#00D1FF]/45 dark:bg-[#00D1FF]/14 dark:text-[#bdf4ff] dark:shadow-[0_0_0_1px_rgba(0,209,255,0.16),0_0_14px_rgba(0,209,255,0.2)] dark:hover:bg-[#00D1FF]/24 dark:hover:text-[#e9fbff]"
                onClick={() => {
                  if (start) {
                    setStart(false)
                    setIsForceFinished(false)
                    return
                  }

                  setIsForceFinished(false)
                  setStart(true)
                }}
              >
                {start ? 'Сброс' : 'Старт'}
              </button>
              {start && !isForceFinished ? (
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-violet-300 bg-violet-50/90 px-5 py-2 text-base font-semibold text-violet-700 transition hover:border-violet-500 hover:bg-violet-100 dark:border-[#7A00FF]/45 dark:bg-[#7A00FF]/16 dark:text-[#ddc8ff] dark:shadow-[0_0_0_1px_rgba(122,0,255,0.18),0_0_14px_rgba(122,0,255,0.22)] dark:hover:bg-[#7A00FF]/24 dark:hover:text-[#f0e5ff]"
                  onClick={() => setIsForceFinished(true)}
                >
                  Финишировать
                </button>
              ) : null}
            </div>
          </div>
          <div className="flex justify-center mb-3 font-semibold gap-x-1 text-slate-800 dark:text-slate-100">
            <div>
              {breakDuration > 0
                ? 'Время игры (без учета перерывов):'
                : 'Время игры:'}
            </div>
            <Time
              start={start}
              seconds={animationSeconds}
              duration={animationDuration}
              forceFinish={isForceFinished}
            />
          </div>
        </div>
      </div>
      <div className="relative z-50 px-2 pb-8 overflow-x-auto md:px-4">
        <div className="mx-auto w-fit">
          <div
            className="rounded-2xl border border-slate-300/70 bg-white/85 text-slate-800 shadow-[0_10px_26px_rgba(2,8,23,0.14)] -translate-x-[20%] tablet:-translate-x-[10%] laptop:translate-x-0 -translate-y-[19%] tablet:-translate-y-[12%] laptop:translate-y-0 scale-[60%] tablet:scale-75 laptop:scale-100 dark:border-[#00D1FF]/32 dark:bg-[#060d20]/92 dark:text-slate-100 dark:shadow-[0_0_0_1px_rgba(0,209,255,0.14),0_0_26px_rgba(0,209,255,0.12),0_22px_42px_rgba(0,0,0,0.55)]"
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'nowrap',
              height: gameTeamsWithTeams.length * rowHeight + 100,
            }}
          >
            <div
              style={{
                height: '100%',
                width: 200,
                minWidth: 200,
                borderRight: `1px solid ${tableBorderColor}`,
              }}
            >
              <div
                style={{
                  borderRight: `1px solid ${tableBorderColor}`,
                  height: '100%',
                  width: '100%',
                }}
              >
                <div
                  className="flex flex-col items-center bg-slate-100/75 px-1 font-bold dark:bg-[#081226]/95"
                  style={{
                    width: '100%',
                    borderBottom: `1px solid ${tableBorderColor}`,
                    lineHeight: '10px',
                    fontSize: '12px',
                    textAlign: 'center',
                    height: tableTitleHeight,
                    minHeight: tableTitleHeight,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    // marginBottom: tableTitleHeight - 40,
                  }}
                >
                  Команды
                </div>
                {gameTeamsWithTeams.map(({ team }, index) => {
                  return (
                    <motion.div
                      key={'order' + index}
                      animate={{
                        opacity: start ? [0, 0, 1] : 0,
                      }}
                      transition={{
                        ease: 'linear',
                        duration: start ? animationDuration : 0,
                        times: start ? [0, 0.99, 1] : 0,
                      }}
                      className="flex items-center justify-center w-full text-lg leading-5 text-center text-slate-900 dark:text-slate-100"
                      style={{
                        height: rowHeight,
                        minHeight: rowHeight,
                      }}
                    >
                      {/* <Image
                    height={30}
                    width={30}
                    src={`/img/medals/${place}.svg`}
                  /> */}
                      {team?.name}
                    </motion.div>
                  )
                })}
              </div>
            </div>
            {tasks.map(({ title, isBonusTask }, index) => (
              <div
                key={'task' + index}
                style={{
                  height: '100%',
                  width: 120,
                  minWidth: 120,
                }}
              >
                <div
                  style={{
                    borderRight: `1px solid ${tableBorderColor}`,
                    height: '100%',
                    width: '100%',
                  }}
                >
                  <div
                    className="flex flex-col items-center justify-center gap-1 bg-slate-100/75 px-1 leading-3 dark:bg-[#081226]/95"
                    style={{
                      width: '100%',
                      borderBottom: `1px solid ${tableBorderColor}`,
                      fontSize: '12px',
                      textAlign: 'center',
                      height: tableTitleHeight,
                      minHeight: tableTitleHeight,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      // marginBottom: tableTitleHeight - 40,
                    }}
                  >
                    <span>{title}</span>
                    {isBonusTask ? (
                      <span className="inline-flex items-center rounded-md border border-violet-300 bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-violet-700 dark:border-[#7A00FF]/50 dark:bg-[#7A00FF]/18 dark:text-[#e4d7ff]">
                        БОНУСНОЕ
                      </span>
                    ) : null}
                  </div>
                  {teamsAnimateSteps.map((timeResults, i) => {
                    const time = timeResults[index]
                    const timeResult =
                      time - (index > 0 ? timeResults[index - 1] : 0)
                    const delay =
                      time / maxTeamTime > 1
                        ? animationDuration
                        : (time / maxTeamTime) * animationDuration
                    const clues =
                      cluesDuration > 0
                        ? Math.floor(timeResult / cluesDuration)
                        : null

                    return (
                      <TimeResult
                        key={'team' + i + 'task' + index}
                        start={start}
                        delay={delay}
                        timeResult={timeResult}
                        isBonusTask={isBonusTask}
                        color={
                          timeResult >= taskDuration
                            ? 'red'
                            : clues === 0
                              ? 'green'
                              : clues === 1
                                ? 'blue'
                                : ''
                        }
                        penalty={teamsTaskPenalty[i][index]}
                        bonus={teamsTaskBonus[i][index]}
                        adjustments={teamsTaskAdjustments[i][index]}
                        rowHeight={rowHeight}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
            <div
              style={{
                height: '100%',
                width: 30,
                minWidth: 30,
              }}
            >
              {/* <div
        className="absolute top-0 bottom-0 w-full bg-repeat opacity-30"
        style={{
          background: 'url("/img/asfalt.jpg")',
          backgroundSize: '10%',
          // backgroundColor: '#000000',
          // backgroundOpacity: 2,
          // filter: 'alpha(opacity=60)',
        }}
      /> */}
              <div
                className="bg-repeat"
                style={{
                  borderRight: `1px solid ${tableBorderColor}`,
                  height: '100%',
                  width: '100%',
                  background: 'url("/img/finish.jpg")',
                  backgroundSize: '34%',
                  opacity: isDarkTheme ? 0.58 : 1,
                  filter: isDarkTheme
                    ? 'saturate(0.7) brightness(0.75)'
                    : undefined,
                }}
              />
            </div>
            <div
              style={{
                height: '100%',
                width: 120,
                minWidth: 120,
              }}
            >
              <div
                style={{
                  borderRight: `1px solid ${tableBorderColor}`,
                  height: '100%',
                  width: '100%',
                }}
              >
                <div
                  className="bg-slate-100/75 px-1 font-bold dark:bg-[#081226]/95"
                  style={{
                    width: '100%',
                    borderBottom: `1px solid ${tableBorderColor}`,
                    lineHeight: '10px',
                    fontSize: '12px',
                    textAlign: 'center',
                    height: tableTitleHeight,
                    minHeight: tableTitleHeight,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    // marginBottom: tableTitleHeight - 40,
                  }}
                >
                  РЕЗУЛЬТАТ
                </div>
                {totalTeamsTime.map((timeResult, index) => {
                  const delay =
                    timeResult / maxTeamTime > 1
                      ? animationDuration
                      : (timeResult / maxTeamTime) * animationDuration
                  return (
                    <TimeResult
                      key={'team' + index + 'result'}
                      start={start}
                      delay={delay}
                      timeResult={timeResult}
                      penalty={
                        totalPenalty[index] +
                        (totalAddings[index] > 0 ? totalAddings[index] : 0)
                      }
                      bonus={
                        totalBonus[index] -
                        (totalAddings[index] < 0 ? totalAddings[index] : 0)
                      }
                      addings={totalAddings[index]}
                      rowHeight={rowHeight}
                    />
                  )
                })}
              </div>
            </div>
            <div
              style={{
                height: '100%',
                width: 120,
                minWidth: 120,
              }}
            >
              <div
                style={{
                  borderRight: `1px solid ${tableBorderColor}`,
                  height: '100%',
                  width: '100%',
                }}
              >
                <div
                  className="flex flex-col items-center bg-slate-100/75 px-1 font-bold dark:bg-[#081226]/95"
                  style={{
                    width: '100%',
                    borderBottom: `1px solid ${tableBorderColor}`,
                    lineHeight: '10px',
                    fontSize: '12px',
                    textAlign: 'center',
                    height: tableTitleHeight,
                    minHeight: tableTitleHeight,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    // marginBottom: tableTitleHeight - 40,
                  }}
                >
                  ИТОГО
                  <span className="text-xs leading-[10px]">
                    с учетом бонусов и штрафов
                  </span>
                  <span className="text-xs leading-[10px] text-rose-700 dark:text-rose-300">
                    (отставание от предыдущего)
                  </span>
                </div>
                {totalTeamsTimeWithBonusAndPenalty.map((timeResult, index) => {
                  // const delay =
                  //   totalTeamsTime[index] / totalSeconds > 1
                  //     ? duration
                  //     : (totalTeamsTime[index] / totalSeconds) * duration
                  const order = orderPlaces[index]
                  const prevOrderTeamIndex =
                    orderPlaces[index] > 1
                      ? orderPlaces.findIndex((o) => o === order - 1)
                      : 0
                  const prevTime =
                    totalTeamsTimeWithBonusAndPenalty[prevOrderTeamIndex]
                  return (
                    <TimeResult
                      key={'team' + index + 'result'}
                      start={start}
                      delay={animationDuration}
                      timeResult={timeResult}
                      rowHeight={rowHeight}
                      penalty={
                        orderPlaces[index] > 1
                          ? timeResult - prevTime
                          : undefined
                      }
                    />
                  )
                })}
              </div>
            </div>
            <div
              className="flex flex-col items-end"
              style={{
                height: '100%',
                width: 240,
                minWidth: 240,
                paddingTop: tableTitleHeight,
                // borderRight: '1px solid',
              }}
            >
              {orderPlaces.map((place, index) => {
                // if (place === 1 || place === 2 || place === 3)
                // const time =
                //   preparedTeamsAnimateSteps[index][
                //     preparedTeamsAnimateSteps[index].length - 1
                //   ] > 0.99
                //     ? 0.99
                //     : preparedTeamsAnimateSteps[index][
                //         preparedTeamsAnimateSteps[index].length - 1
                //       ]
                return (
                  <motion.div
                    key={'order' + index}
                    animate={{
                      opacity: start ? [0, 0, 1] : 0,
                    }}
                    transition={{
                      // type: 'just',
                      ease: 'linear',
                      // type: 'spring',
                      // stiffness: 1,
                      duration: start ? animationDuration : 0,
                      times: start ? [0, 0.99, 1] : 0,
                    }}
                    className={cn(
                      'w-[50px] flex items-center justify-center',
                      place <= 3 ? 'font-bold text-4xl' : 'text-3xl',
                    )}
                    style={{
                      height: rowHeight,
                      minHeight: rowHeight,
                    }}
                  >
                    {/* <Image
                      height={30}
                      width={30}
                      src={`/img/medals/${place}.svg`}
                    /> */}
                    {place}
                  </motion.div>
                )
                // return <div className="min-h-[50px]" />
              })}
            </div>
            {gameTeamsWithTeams.map(({ team }, index) => {
              const finalStep =
                preparedTeamsAnimateSteps[index][
                  preparedTeamsAnimateSteps[index].length - 1
                ] * 1.01
              return (
                <motion.div
                  key={'car' + index}
                  className="z-10 flex items-center"
                  style={{
                    position: 'absolute',
                    top: rowHeight * index + tableTitleHeight + 2,
                  }}
                  animate={{
                    x: start ? animateSteps : 0,
                  }}
                  transition={{
                    // type: 'just',
                    ease: 'linear',
                    // type: 'spring',
                    // stiffness: 1,
                    duration: start ? animationDuration : 0,
                    times: start
                      ? [
                          0,
                          ...preparedTeamsAnimateSteps[index],
                          finalStep > 1 ? 1 : finalStep,
                        ]
                      : 0,
                  }}
                >
                  <Car
                    name={team?.name}
                    color={
                      isDarkTheme
                        ? CYBER_CAR_COLORS[index % CYBER_CAR_COLORS.length]
                        : PASTEL_COLORS[index]
                    }
                    skin={team?.carSkin}
                    rowHeight={rowHeight}
                    isDarkTheme={isDarkTheme}
                  />
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
      <div
        className="absolute top-0 bottom-0 w-full bg-repeat opacity-20 dark:opacity-18"
        style={{
          background: 'url("/img/asfalt.jpg")',
          backgroundSize: '10%',
          // backgroundColor: '#000000',
          // backgroundOpacity: 2,
          // filter: 'alpha(opacity=60)',
        }}
      />
    </div>
  )
}

function ResultPage(props) {
  const gameId = props.id
  const location = props.location

  const [game, setGame] = useState()
  const [isDarkTheme, setIsDarkTheme] = useState(false)

  const applyTheme = (theme) => {
    if (typeof document === 'undefined') {
      return
    }

    const root = document.documentElement
    const isDark = theme === 'dark'
    root.setAttribute('data-theme', isDark ? 'dark' : 'light')
    root.classList.toggle('dark', isDark)
    root.style.colorScheme = isDark ? 'dark' : 'light'
  }

  useEffect(() => {
    const getGameEffect = async (gameId) => {
      const game = await getData('/api/' + location + '/games/' + gameId)
      setGame(game.data)
    }
    if (gameId) getGameEffect(gameId)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const root = document.documentElement
    const isDark =
      root.getAttribute('data-theme') === 'dark' ||
      root.classList.contains('dark')
    setIsDarkTheme(isDark)
  }, [])

  const handleToggleTheme = () => {
    const nextIsDarkTheme = !isDarkTheme
    const nextTheme = nextIsDarkTheme ? 'dark' : 'light'
    setIsDarkTheme(nextIsDarkTheme)
    applyTheme(nextTheme)

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('cabinet-theme', nextTheme)
    }
  }

  return (
    <>
      <Head>
        <title>{`ActQuest - Игра`}</title>
      </Head>
      <div className="fixed left-3 top-3 z-[120] md:left-5 md:top-5">
        <Link
          href="/cabinet"
          className="inline-flex items-center justify-center rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
        >
          Вернуться в кабинет
        </Link>
      </div>
      <div className="fixed right-3 top-3 z-[120] md:right-5 md:top-5">
        <button
          type="button"
          onClick={handleToggleTheme}
          className="inline-flex items-center justify-center rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
        >
          {isDarkTheme ? 'Светлая тема' : 'Тёмная тема'}
        </button>
      </div>
      {/* <StateLoader {...props}>
        <Header /> */}
      {game && <GameBlock game={game} isDarkTheme={isDarkTheme} />}
      {/* </StateLoader> */}
    </>
  )
}

export default ResultPage

// export const getStaticPaths = async () => {
//   console.log('getStaticPaths fetching...')
//   const courses = await fetchingCourses(null, 'http://localhost:3000')
//   const chapters = await fetchingChapters(null, 'http://localhost:3000')
//   const lectures = await fetchingLectures(null, 'http://localhost:3000')

//   let paths = []
//   courses.forEach((course) => {
//     const courseChapters = chapters.filter(
//       (chapter) => chapter.courseId === course._id
//     )
//     courseChapters.forEach((chapter) => {
//       const chapterLectures = lectures.filter(
//         (lecture) => lecture.chapterId === chapter._id
//       )
//       chapterLectures.forEach((lecture) =>
//         paths.push(`/course/${course._id}/${lecture._id}`)
//       )
//     })
//   })

//   console.log('paths', paths)

//   return {
//     paths,
//     fallback: true,
//   }
// }

export const getServerSideProps = async (context) => {
  // const session = await getSession({ req: context.req })

  const { params } = context
  const { id, location } = params

  // const fetchedProps = await fetchProps(session?.user)

  return {
    props: {
      // ...fetchedProps,
      id,
      location,
      // loggedUser: session?.user ?? null,
    },
  }
}
