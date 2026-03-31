import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import PropTypes from 'prop-types'
import { LOCATIONS } from '@server/serverConstants'

const ACCESS_KEY = 'aq_index2_access_open'
const FIRST_ANSWER_KEY = 'aq_index2_first_answer'
const REACTION_MS_KEY = 'aq_index2_reaction_ms'
const MAP_SECRET_FOUND_KEY = 'aq_index2_map_secret_found'
const MAP_GAME_COMPLETE_KEY = 'aq_index2_map_game_complete'
const MAP_GAME_PATH_KEY = 'aq_index2_map_game_path'
const MAP_GAME_SEGMENTS_KEY = 'aq_index2_map_game_segments'
const ARCHIVE_IMAGE_KEY = 'aq_index2_archive_image'
const PROCESS_ORDER_SOLVED_KEY = 'aq_index2_process_order_solved'
const SCENARIO_FALLBACK_DONE_KEY = 'aq_index2_scenario_fallback_done'

const preludeLines = [
  'подключение...',
  'поиск сигнала...',
  'доступ к архиву города...',
  'найден наблюдатель',
]

const validAnswers = ['улицы', 'улица']
const riddleHints = [
  'Подсказка 01: это не люди и не здания, а то, что их связывает.',
  'Подсказка 02: у этого есть названия, но обычно ты их не замечаешь.',
]

const mapPoints = [
  { id: 'a', top: '24%', left: '28%' },
  { id: 'b', top: '42%', left: '60%' },
  { id: 'c', top: '63%', left: '46%' },
  { id: 'd', top: '35%', left: '78%' },
  { id: 'e', top: '70%', left: '22%' },
]
const promoPoint = { top: '58%', left: '88%' }
const PROMO_POINT_ID = 'promo'
const PATH_START_POINT_ID = 'c'

const flowRows = [
  { id: 'drive', text: 'Ты едешь — и не знаешь куда' },
  { id: 'search', text: 'Ты ищешь — и не уверен, что правильно' },
  { id: 'find', text: 'Ты находишь — и начинаешь сомневаться' },
  { id: 'understand', text: 'Ты понимаешь — слишком поздно' },
]
const flowCorrectOrder = flowRows.map((row) => row.id)
const getShuffledFlowRows = () => [
  flowRows[1],
  flowRows[3],
  flowRows[0],
  flowRows[2],
]
const PRELUDE_LINE_DELAY_MS = 1400
const PRELUDE_TO_ENTRY_DELAY_MS = 1300
const GAME_ACCESS_CHECK_DELAY_MS = 5000
const ARCHIVE_SLIDE_INTERVAL_MS = 4200
const ARCHIVE_REALITY_SWAP_MS = 10000
const PROCESS_GRAB_HOLD_MS = 1600
const ARCHIVE_SLED_SRC = '/img/sled.png'
const ARCHIVE_SLED_HOLD_MS = 1000
const ARCHIVE_SLED_HOLD_MOVE_TOLERANCE_PX = 12

const normalize = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[.!?,:;-]/g, '')
const parsePercent = (value) =>
  Number.parseFloat(String(value).replace('%', ''))

const normalizeExternalUrl = (value) => {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

const orientation = (p, q, r) => {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y)
  if (Math.abs(val) < 0.0001) return 0
  return val > 0 ? 1 : 2
}

const segmentsIntersect = (a1, a2, b1, b2) => {
  const o1 = orientation(a1, a2, b1)
  const o2 = orientation(a1, a2, b2)
  const o3 = orientation(b1, b2, a1)
  const o4 = orientation(b1, b2, a2)
  return o1 !== o2 && o3 !== o4
}

const scenarioLocations = Object.entries(LOCATIONS)
  .filter(([, value]) => !value.hidden)
  .map(([key, value]) => ({
    key,
    title: value?.townRu
      ? value.townRu[0].toUpperCase() + value.townRu.slice(1)
      : key.toUpperCase(),
  }))
const scenarioLocationTitleByKey = scenarioLocations.reduce((acc, item) => {
  acc[item.key] = item.title
  return acc
}, {})

const FlowRow = ({
  text,
  visible,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onClick,
  isGrabbed,
  isLocked,
}) => (
  <button
    type="button"
    onPointerDown={onPointerDown}
    onPointerUp={onPointerUp}
    onPointerLeave={onPointerLeave}
    onClick={onClick}
    className={`w-full cursor-default rounded-2xl border bg-white/5 px-5 py-4 text-left text-xl font-semibold text-slate-100 transition-all duration-700 ${
      visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
    } ${
      isLocked
        ? 'border-[#00D1FF]/35 shadow-[0_0_18px_rgba(0,209,255,0.2)]'
        : isGrabbed
          ? 'border-[#7A00FF]/65 shadow-[0_0_24px_rgba(122,0,255,0.28)]'
          : 'border-white/10'
    }`}
  >
    {text}
  </button>
)

FlowRow.propTypes = {
  text: PropTypes.string.isRequired,
  visible: PropTypes.bool.isRequired,
  onPointerDown: PropTypes.func,
  onPointerUp: PropTypes.func,
  onPointerLeave: PropTypes.func,
  onClick: PropTypes.func,
  isGrabbed: PropTypes.bool,
  isLocked: PropTypes.bool,
}

FlowRow.defaultProps = {
  onPointerDown: undefined,
  onPointerUp: undefined,
  onPointerLeave: undefined,
  onClick: undefined,
  isGrabbed: false,
  isLocked: false,
}

const TypewriterText = ({ text, className, speed, resetKey }) => {
  const [printed, setPrinted] = useState('')

  useEffect(() => {
    if (!text) {
      setPrinted('')
      return
    }

    setPrinted('')
    let index = 0
    let timer = null

    const nextDelay = (char) => {
      const jitter = Math.floor(Math.random() * 18) - 6
      const base = Math.max(20, speed + jitter)
      if (char === ',' || char === ';' || char === ':') return base + 90
      if (char === '.' || char === '!' || char === '?' || char === '\n')
        return base + 160
      return base
    }

    const tick = () => {
      index += 1
      setPrinted(text.slice(0, index))
      if (index >= text.length) {
        return
      }
      timer = setTimeout(() => tick(), nextDelay(text[index - 1]))
    }

    timer = setTimeout(() => tick(), speed)

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [text, speed, resetKey])

  return <p className={className}>{printed}</p>
}

TypewriterText.propTypes = {
  text: PropTypes.string.isRequired,
  className: PropTypes.string,
  speed: PropTypes.number,
  resetKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
}

TypewriterText.defaultProps = {
  className: '',
  speed: 34,
  resetKey: '',
}

const ScenarioCard = ({
  locations,
  selectedLocation,
  onLocationChange,
  nearestGame,
  isLoadingGame,
  accessState,
  onAccessClick,
  isAccessGlitch,
  isFallbackMode,
  isFallbackConfirmed,
  onFallbackConfirm,
}) => {
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)
  const [isLocationModalGlitch, setIsLocationModalGlitch] = useState(false)
  const [locationModalGlitchFrame, setLocationModalGlitchFrame] = useState(0)
  const glitchTimerRef = useRef(null)

  const selectedLocationTitle =
    locations.find((locationItem) => locationItem.key === selectedLocation)
      ?.title || 'Выбери город'

  const openLocationModal = () => {
    setIsLocationModalOpen(true)
    setIsLocationModalGlitch(true)

    if (glitchTimerRef.current) {
      clearTimeout(glitchTimerRef.current)
    }
    glitchTimerRef.current = setTimeout(() => {
      setIsLocationModalGlitch(false)
      glitchTimerRef.current = null
    }, 800)
  }

  useEffect(() => {
    return () => {
      if (glitchTimerRef.current) {
        clearTimeout(glitchTimerRef.current)
        glitchTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!isLocationModalGlitch) {
      setLocationModalGlitchFrame(0)
      return
    }

    const frameTimer = setInterval(() => {
      setLocationModalGlitchFrame((prev) => (prev + 1) % 8)
    }, 90)

    return () => clearInterval(frameTimer)
  }, [isLocationModalGlitch])

  useEffect(() => {
    if (!isLocationModalOpen) return

    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        setIsLocationModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isLocationModalOpen])

  const glitchModalStyles = [
    {
      transform: 'translateX(0px)',
      filter: 'none',
      boxShadow: '0 0 0 1px rgba(0,209,255,0.2), 0 0 56px rgba(122,0,255,0.3)',
    },
    {
      transform: 'translateX(-8px)',
      filter: 'hue-rotate(24deg) brightness(1.45) contrast(1.2)',
      boxShadow:
        '-6px 0 0 rgba(255,0,102,0.38), 6px 0 0 rgba(0,225,255,0.4), 0 0 64px rgba(0,209,255,0.4)',
    },
    {
      transform: 'translateX(10px)',
      filter: 'hue-rotate(-28deg) brightness(1.5) contrast(1.24)',
      boxShadow:
        '-8px 0 0 rgba(255,0,102,0.42), 8px 0 0 rgba(0,225,255,0.42), 0 0 70px rgba(122,0,255,0.42)',
    },
    {
      transform: 'translateX(-5px)',
      filter: 'hue-rotate(18deg) brightness(1.32) contrast(1.14)',
      boxShadow:
        '-4px 0 0 rgba(255,0,102,0.26), 4px 0 0 rgba(0,225,255,0.26), 0 0 52px rgba(0,209,255,0.3)',
    },
    {
      transform: 'translateX(6px)',
      filter: 'hue-rotate(-16deg) brightness(1.36) contrast(1.16)',
      boxShadow:
        '-5px 0 0 rgba(255,0,102,0.3), 5px 0 0 rgba(0,225,255,0.32), 0 0 56px rgba(122,0,255,0.34)',
    },
    {
      transform: 'translateX(-3px)',
      filter: 'hue-rotate(10deg) brightness(1.18)',
      boxShadow:
        '0 0 0 1px rgba(0,209,255,0.28), 0 0 45px rgba(122,0,255,0.28)',
    },
    {
      transform: 'translateX(2px)',
      filter: 'hue-rotate(-8deg) brightness(1.12)',
      boxShadow:
        '0 0 0 1px rgba(0,209,255,0.24), 0 0 40px rgba(122,0,255,0.24)',
    },
    {
      transform: 'translateX(0px)',
      filter: 'none',
      boxShadow: '0 0 0 1px rgba(0,209,255,0.2), 0 0 56px rgba(122,0,255,0.3)',
    },
  ]

  const glitchOverlayOpacity = [0.1, 0.92, 0.45, 0.78, 0.32, 0.66, 0.2, 0]
  const glitchOverlayX = [0, -8, 9, -6, 6, -3, 2, 0]
  const glitchBarsOpacity = [0, 0.96, 0.55, 0.74, 0.38, 0.52, 0.18, 0]
  const glitchBarsY = [0, -8, 6, -5, 4, -3, 2, 0]

  return (
    <>
      {isLocationModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsLocationModalOpen(false)
            }
          }}
        >
          <div
            className="scenario-city-modal relative z-10 w-full max-w-md rounded-3xl border border-[#00D1FF]/35 bg-gradient-to-br from-[#140328] to-[#060111] p-5 shadow-[0_0_0_1px_rgba(0,209,255,0.2),0_0_56px_rgba(122,0,255,0.3)]"
            data-glitch-active={isLocationModalGlitch ? '1' : '0'}
            style={
              isLocationModalGlitch
                ? glitchModalStyles[locationModalGlitchFrame]
                : undefined
            }
          >
            {isLocationModalGlitch && (
              <>
                <div
                  className="scenario-city-glitch-overlay"
                  style={{
                    opacity: glitchOverlayOpacity[locationModalGlitchFrame],
                    transform: `translateX(${glitchOverlayX[locationModalGlitchFrame]}px)`,
                  }}
                />
                <div
                  className="scenario-city-glitch-bars"
                  style={{
                    opacity: glitchBarsOpacity[locationModalGlitchFrame],
                    transform: `translateY(${glitchBarsY[locationModalGlitchFrame]}px)`,
                  }}
                />
              </>
            )}
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[#9dd9ff]">
                Выбор локации
              </p>
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(false)}
                className="cursor-pointer rounded-lg border border-white/20 px-2 py-1 text-xs uppercase tracking-[0.1em] text-slate-200 transition hover:bg-white/10"
              >
                Закрыть
              </button>
            </div>
            <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
              {locations.map((locationItem) => {
                const isActive = locationItem.key === selectedLocation
                return (
                  <button
                    key={locationItem.key}
                    type="button"
                    onClick={() => {
                      onLocationChange(locationItem.key)
                      setIsLocationModalOpen(false)
                    }}
                    className={`w-full cursor-pointer rounded-xl border px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.06em] transition ${
                      isActive
                        ? 'border-[#00D1FF]/65 bg-[#00D1FF]/14 text-[#c7f7ff]'
                        : 'border-white/15 bg-white/5 text-slate-200 hover:border-[#7A00FF]/55 hover:bg-[#7A00FF]/12'
                    }`}
                  >
                    {locationItem.title}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <article className="group rounded-3xl border border-[#7A00FF]/40 bg-gradient-to-br from-[#17002f] to-[#0b001a] p-6 shadow-[0_0_0_1px_rgba(122,0,255,0.2),0_0_45px_rgba(0,209,255,0.08)] transition duration-400 hover:shadow-[0_0_0_1px_rgba(122,0,255,0.8),0_0_55px_rgba(122,0,255,0.25)]">
        <h3 className="text-2xl font-semibold text-white">Сценарий</h3>
        <p className="mt-3 text-sm text-slate-300">
          Выбери интересующее тебя место.
        </p>

        <p className="mt-4 block text-xs uppercase tracking-[0.12em] text-[#9dd9ff]">
          Город
        </p>
        <button
          type="button"
          onClick={openLocationModal}
          className="mt-2 flex w-full cursor-pointer items-center justify-between rounded-xl border border-[#00D1FF]/35 bg-[#080017]/70 px-3 py-2 text-sm text-white transition hover:border-[#00D1FF]/70 hover:bg-[#00D1FF]/8"
        >
          <span>{selectedLocationTitle}</span>
          <span className="text-xs uppercase tracking-[0.1em] text-[#8bdfff]">
            Изменить
          </span>
        </button>

        <div className="p-3 mt-4 border rounded-xl border-white/10 bg-black/20">
          {isLoadingGame ? (
            <p className="text-sm text-slate-300">Поиск ближайшей игры...</p>
          ) : isFallbackMode ? (
            <p className="text-sm text-slate-300">
              В этом цикле активных запусков нет. Зафиксируй город и подтверди
              готовность.
            </p>
          ) : nearestGame ? (
            <>
              <p className="text-sm font-semibold text-white">
                {nearestGame.name}
              </p>
              <p className="mt-1 text-xs text-slate-300">
                {nearestGame.dateLabel}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-300">
              Сигнал принят. Скоро здесь появится новое задание.
            </p>
          )}
        </div>

        {isFallbackMode && (
          <>
            <p
              className={`mt-3 text-xs uppercase tracking-[0.12em] ${
                isFallbackConfirmed ? 'text-[#9dffd5]' : 'text-[#9dd9ff]'
              }`}
            >
              {isFallbackConfirmed
                ? 'готовность подтверждена'
                : 'ожидание подтверждения'}
            </p>
            <button
              type="button"
              onClick={onFallbackConfirm}
              disabled={isFallbackConfirmed}
              className={`mt-3 cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                isFallbackConfirmed
                  ? 'border-[#00D1FF]/35 bg-[#00D1FF]/8 text-[#9ccedf] cursor-not-allowed'
                  : 'border-[#00D1FF]/55 bg-[#00D1FF]/14 text-[#baf3ff] hover:bg-[#00D1FF]/22'
              }`}
            >
              Подтвердить готовность
            </button>
          </>
        )}

        {!isFallbackMode && nearestGame && (
          <>
            <p
              className={`mt-3 text-xs uppercase tracking-[0.12em] ${
                accessState === 'allowed'
                  ? 'text-[#9dffd5]'
                  : accessState === 'denied' || accessState === 'patience'
                    ? 'text-[#ff9ea8]'
                    : 'text-[#9dd9ff]'
              }`}
            >
              {accessState === 'allowed'
                ? 'доступ разрешен'
                : accessState === 'patience'
                  ? 'терпение...'
                  : accessState === 'denied'
                    ? 'доступ не разрешен'
                    : 'проверка...'}
            </p>
            <button
              type="button"
              onClick={onAccessClick}
              className={`mt-3 cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                accessState === 'allowed'
                  ? 'border-[#00D1FF]/55 bg-[#00D1FF]/14 text-[#baf3ff] hover:bg-[#00D1FF]/22'
                  : 'border-[#7A00FF]/45 bg-[#7A00FF]/10 text-[#e5d8ff] hover:bg-[#7A00FF]/18'
              } ${isAccessGlitch ? 'scenario-access-glitch border-red-400/80 bg-red-600/20 text-[#ffd8de]' : ''}`}
            >
              Открыть доступ
            </button>
          </>
        )}
      </article>
    </>
  )
}

ScenarioCard.propTypes = {
  locations: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
    }),
  ).isRequired,
  selectedLocation: PropTypes.string.isRequired,
  onLocationChange: PropTypes.func.isRequired,
  nearestGame: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    dateLabel: PropTypes.string.isRequired,
  }),
  isLoadingGame: PropTypes.bool.isRequired,
  accessState: PropTypes.oneOf([
    'idle',
    'checking',
    'denied',
    'allowed',
    'patience',
  ]).isRequired,
  onAccessClick: PropTypes.func.isRequired,
  isAccessGlitch: PropTypes.bool.isRequired,
  isFallbackMode: PropTypes.bool,
  isFallbackConfirmed: PropTypes.bool,
  onFallbackConfirm: PropTypes.func,
}

ScenarioCard.defaultProps = {
  nearestGame: null,
  isFallbackMode: false,
  isFallbackConfirmed: false,
  onFallbackConfirm: undefined,
}

const Index2Page = () => {
  const router = useRouter()
  const [stage, setStage] = useState('prelude')
  const [visiblePrelude, setVisiblePrelude] = useState(0)
  const [entryReady, setEntryReady] = useState(false)
  const [entryGlitch, setEntryGlitch] = useState(false)

  const [answer, setAnswer] = useState('')
  const [riddleError, setRiddleError] = useState('')
  const [riddlePhase, setRiddlePhase] = useState('question')
  const [riddleClosing, setRiddleClosing] = useState(false)
  const [submittedRiddleAnswer, setSubmittedRiddleAnswer] = useState('')
  const [wrongAttempts, setWrongAttempts] = useState(0)
  const [inputGlitch, setInputGlitch] = useState(false)
  const [answerStartedAt, setAnswerStartedAt] = useState(null)

  const [activePointId, setActivePointId] = useState(null)
  const [secretFound, setSecretFound] = useState(false)
  const [specialPointNote, setSpecialPointNote] = useState('')
  const [mapObserverUnlocked, setMapObserverUnlocked] = useState(false)
  const [mapTouchedPointIds, setMapTouchedPointIds] = useState([])
  const [keyboardEasterMessage, setKeyboardEasterMessage] = useState('')
  const [gamePath, setGamePath] = useState([])
  const [gameSegments, setGameSegments] = useState([])
  const [isDrawingPath, setIsDrawingPath] = useState(false)
  const [gameCursor, setGameCursor] = useState(null)
  const [gameComplete, setGameComplete] = useState(false)
  const [gameStatus, setGameStatus] = useState('')
  const [selectedScenarioLocation, setSelectedScenarioLocation] = useState(
    scenarioLocations[0]?.key ?? '',
  )
  const [nearestScenarioGame, setNearestScenarioGame] = useState(null)
  const [isNearestScenarioGameLoading, setIsNearestScenarioGameLoading] =
    useState(false)
  const [isScenarioFallbackMode, setIsScenarioFallbackMode] = useState(false)
  const [isScenarioFallbackConfirmed, setIsScenarioFallbackConfirmed] =
    useState(false)
  const [scenarioAccessState, setScenarioAccessState] = useState('idle')
  const [scenarioAccessGlitch, setScenarioAccessGlitch] = useState(false)
  const [processRowsState, setProcessRowsState] = useState(() =>
    getShuffledFlowRows(),
  )
  const [grabbedProcessRowId, setGrabbedProcessRowId] = useState(null)
  const [isProcessOrderLocked, setIsProcessOrderLocked] = useState(false)
  const [archiveSlides, setArchiveSlides] = useState([])
  const [archiveSlideIndex, setArchiveSlideIndex] = useState(0)
  const [isArchiveLoading, setIsArchiveLoading] = useState(false)
  const [isArchiveRealityShifted, setIsArchiveRealityShifted] = useState(false)
  const [isArchiveRealityGlitch, setIsArchiveRealityGlitch] = useState(false)
  const [isArchiveRealityInView, setIsArchiveRealityInView] = useState(false)
  const [archiveImageErrors, setArchiveImageErrors] = useState({})
  const [archiveImage, setArchiveImage] = useState('')
  const [archiveDragActive, setArchiveDragActive] = useState(false)
  const [archiveStatus, setArchiveStatus] = useState('')
  const [sledDragGhost, setSledDragGhost] = useState(null)
  const [projectChatUrl, setProjectChatUrl] = useState('')
  const [visibleFlowCount, setVisibleFlowCount] = useState(0)
  const transitionTimeoutRef = useRef(null)
  const inputGlitchTimeoutRef = useRef(null)
  const mapContainerRef = useRef(null)
  const archiveRealityLineRef = useRef(null)
  const archiveDropZoneRef = useRef(null)
  const gamePathRef = useRef([])
  const gameSegmentsRef = useRef([])
  const mapIdleTimeoutRef = useRef(null)
  const mapHoverStartRef = useRef(0)
  const keyboardBufferRef = useRef('')
  const keyboardMessageTimeoutRef = useRef(null)
  const scenarioAccessTimerRef = useRef(null)
  const scenarioDeniedTimerRef = useRef(null)
  const archiveRealityTimerRef = useRef(null)
  const archiveRealityGlitchTimerRef = useRef(null)
  const processGrabTimerRef = useRef(null)
  const archiveSledPointerIdRef = useRef(null)
  const archiveSledPendingPointerIdRef = useRef(null)
  const archiveSledPendingPointerTypeRef = useRef('')
  const archiveSledHoldStartPointRef = useRef({ x: 0, y: 0 })
  const archiveSledLastPointRef = useRef({ x: 0, y: 0 })
  const archiveSledHoldTimerRef = useRef(null)
  const archiveSledDragElementRef = useRef(null)
  const pageOverflowRestoreRef = useRef({ body: '', html: '' })

  const displayAnswer = useMemo(() => normalize(answer), [answer])
  const selectedKey = useMemo(() => {
    if (!answer) return validAnswers[0]
    return normalize(answer) || validAnswers[0]
  }, [answer])
  const mapActivityHint = useMemo(() => {
    if (!activePointId) return 'Некоторые точки уже ждут тебя'
    if (mapTouchedPointIds.length >= 3) return 'ты начинаешь видеть связи'
    if (mapObserverUnlocked) return 'здесь что-то произошло'
    if (activePointId === 'c') return 'здесь что-то было'
    return 'точка активна'
  }, [activePointId, mapObserverUnlocked, mapTouchedPointIds.length])
  const gamePoints = useMemo(
    () => [
      ...mapPoints,
      { id: PROMO_POINT_ID, top: promoPoint.top, left: promoPoint.left },
    ],
    [],
  )
  const gamePointById = useMemo(
    () =>
      gamePoints.reduce((acc, point) => {
        acc[point.id] = {
          x: parsePercent(point.left),
          y: parsePercent(point.top),
        }
        return acc
      }, {}),
    [gamePoints],
  )
  const telemetrySteps = useMemo(
    () => [
      { id: 'secret', label: 'скрытая точка найдена', done: secretFound },
      { id: 'path', label: 'маршрут собран', done: gameComplete },
      {
        id: 'archive',
        label: 'след оставлен',
        done: Boolean(archiveImage),
      },
      {
        id: 'scenario',
        label: 'доступ к сценарию подтвержден',
        done: scenarioAccessState === 'allowed',
      },
      {
        id: 'order',
        label: 'последовательность восстановлена',
        done: isProcessOrderLocked,
      },
    ],
    [
      archiveImage,
      gameComplete,
      isProcessOrderLocked,
      scenarioAccessState,
      secretFound,
    ],
  )
  const telemetryDoneCount = useMemo(
    () => telemetrySteps.filter((step) => step.done).length,
    [telemetrySteps],
  )
  const telemetryProgressPercent = useMemo(() => {
    if (!telemetrySteps.length) return 0
    return Math.round((telemetryDoneCount / telemetrySteps.length) * 100)
  }, [telemetryDoneCount, telemetrySteps.length])
  const isTelemetryComplete = useMemo(
    () =>
      telemetrySteps.length > 0 && telemetryDoneCount >= telemetrySteps.length,
    [telemetryDoneCount, telemetrySteps],
  )

  useEffect(() => {
    const isOpen =
      typeof window !== 'undefined' && localStorage.getItem(ACCESS_KEY) === '1'

    if (isOpen) {
      setStage('main')
      return
    }

    const lineTimer = setInterval(() => {
      setVisiblePrelude((prev) => {
        const next = prev + 1
        if (next >= preludeLines.length) {
          clearInterval(lineTimer)
          setTimeout(() => {
            setStage('entry')
            setTimeout(() => setEntryReady(true), 2000)
          }, PRELUDE_TO_ENTRY_DELAY_MS)
        }
        return Math.min(next, preludeLines.length)
      })
    }, PRELUDE_LINE_DELAY_MS)

    return () => clearInterval(lineTimer)
  }, [])

  useEffect(() => {
    if (stage !== 'riddle') return

    setAnswerStartedAt(Date.now())
    setRiddleError('')
    setRiddlePhase('question')
    setRiddleClosing(false)
    setSubmittedRiddleAnswer('')
    setWrongAttempts(0)
    setInputGlitch(false)
    setSpecialPointNote('')
    setMapObserverUnlocked(false)
    setMapTouchedPointIds([])
    setKeyboardEasterMessage('')
    setGamePath([])
    setGameSegments([])
    setIsDrawingPath(false)
    setGameCursor(null)
    setGameComplete(false)
    setGameStatus('')
    setNearestScenarioGame(null)
    setIsNearestScenarioGameLoading(false)
    setIsScenarioFallbackMode(false)
    setIsScenarioFallbackConfirmed(false)
    setScenarioAccessState('idle')
    setScenarioAccessGlitch(false)
    setProcessRowsState(getShuffledFlowRows())
    setGrabbedProcessRowId(null)
    setIsProcessOrderLocked(false)
  }, [stage])

  useEffect(() => {
    if (secretFound) return
    setGamePath([])
    setGameSegments([])
    setIsDrawingPath(false)
    setGameCursor(null)
    setGameComplete(false)
    setGameStatus('')
  }, [secretFound])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedArchiveImage = localStorage.getItem(ARCHIVE_IMAGE_KEY) || ''
    if (savedArchiveImage) {
      setArchiveImage(savedArchiveImage)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current)
        transitionTimeoutRef.current = null
      }
      if (inputGlitchTimeoutRef.current) {
        clearTimeout(inputGlitchTimeoutRef.current)
        inputGlitchTimeoutRef.current = null
      }
      if (mapIdleTimeoutRef.current) {
        clearTimeout(mapIdleTimeoutRef.current)
        mapIdleTimeoutRef.current = null
      }
      if (keyboardMessageTimeoutRef.current) {
        clearTimeout(keyboardMessageTimeoutRef.current)
        keyboardMessageTimeoutRef.current = null
      }
      if (scenarioAccessTimerRef.current) {
        clearTimeout(scenarioAccessTimerRef.current)
        scenarioAccessTimerRef.current = null
      }
      if (scenarioDeniedTimerRef.current) {
        clearTimeout(scenarioDeniedTimerRef.current)
        scenarioDeniedTimerRef.current = null
      }
      if (archiveRealityTimerRef.current) {
        clearInterval(archiveRealityTimerRef.current)
        archiveRealityTimerRef.current = null
      }
      if (archiveRealityGlitchTimerRef.current) {
        clearTimeout(archiveRealityGlitchTimerRef.current)
        archiveRealityGlitchTimerRef.current = null
      }
      if (processGrabTimerRef.current) {
        clearTimeout(processGrabTimerRef.current)
        processGrabTimerRef.current = null
      }
      window.removeEventListener('pointermove', handleArchiveSledPointerMove)
      window.removeEventListener('pointerup', handleArchiveSledPointerEnd)
      window.removeEventListener('pointercancel', handleArchiveSledPointerEnd)
      window.removeEventListener('touchmove', handleArchiveSledTouchMove)
      window.removeEventListener('touchend', handleArchiveSledTouchEnd)
      window.removeEventListener('touchcancel', handleArchiveSledTouchEnd)
      clearArchiveSledDrag()
    }
  }, [])

  useEffect(() => {
    if (stage !== 'main') return

    const savedOrderSolved =
      typeof window !== 'undefined' &&
      localStorage.getItem(PROCESS_ORDER_SOLVED_KEY) === '1'
    if (savedOrderSolved) {
      setProcessRowsState(flowRows)
      setIsProcessOrderLocked(true)
    } else {
      setProcessRowsState(getShuffledFlowRows())
      setIsProcessOrderLocked(false)
    }
    setGrabbedProcessRowId(null)

    if (typeof window !== 'undefined') {
      const savedSecret = localStorage.getItem(MAP_SECRET_FOUND_KEY) === '1'
      const savedComplete = localStorage.getItem(MAP_GAME_COMPLETE_KEY) === '1'

      if (savedSecret) {
        setSecretFound(true)
      }

      if (savedComplete) {
        try {
          const savedPath = JSON.parse(
            localStorage.getItem(MAP_GAME_PATH_KEY) || '[]',
          )
          const savedSegments = JSON.parse(
            localStorage.getItem(MAP_GAME_SEGMENTS_KEY) || '[]',
          )
          if (Array.isArray(savedPath) && Array.isArray(savedSegments)) {
            setSecretFound(true)
            setGamePath(savedPath)
            setGameSegments(savedSegments)
            gamePathRef.current = savedPath
            gameSegmentsRef.current = savedSegments
            setGameComplete(true)
            setGameStatus('Маршрут подтвержден.')
          }
        } catch {
          // ignore corrupted local state
        }
      }
    }

    setVisibleFlowCount(0)
    const timer = setInterval(() => {
      setVisibleFlowCount((prev) => {
        if (prev >= flowRows.length) {
          clearInterval(timer)
          return prev
        }
        return prev + 1
      })
    }, 420)

    return () => clearInterval(timer)
  }, [stage])

  useEffect(() => {
    if (stage !== 'main') return
    if (isProcessOrderLocked) return

    const isCorrect = processRowsState.every(
      (row, index) => row.id === flowCorrectOrder[index],
    )
    if (isCorrect) {
      setIsProcessOrderLocked(true)
      setGrabbedProcessRowId(null)
      if (typeof window !== 'undefined') {
        localStorage.setItem(PROCESS_ORDER_SOLVED_KEY, '1')
      }
    }
  }, [isProcessOrderLocked, processRowsState, stage])

  useEffect(() => {
    if (stage !== 'main') return

    let cancelled = false
    const now = Date.now()

    const checkUpcomingGames = async () => {
      try {
        const hasUpcomingByLocation = await Promise.all(
          scenarioLocations.map(async (locationItem) => {
            const params = new URLSearchParams({
              collection: 'games',
              location: locationItem.key,
              sort: 'dateStart',
              limit: '120',
              select: '_id,dateStart,status,hidden',
            })

            const response = await fetch(
              `/api/${locationItem.key}/custom?${params.toString()}`,
            )
            const json = await response.json()
            const list = Array.isArray(json?.data) ? json.data : []
            if (!response.ok || !list.length) return false

            return list
              .filter((item) => !item?.hidden)
              .filter((item) =>
                ['active', 'started'].includes(
                  String(item?.status || '').toLowerCase(),
                ),
              )
              .some((item) => {
                const startTs = item?.dateStart
                  ? new Date(item.dateStart).getTime()
                  : 0
                return Number.isFinite(startTs) && startTs >= now
              })
          }),
        )

        if (cancelled) return
        const hasUpcoming = hasUpcomingByLocation.some(Boolean)
        setIsScenarioFallbackMode(!hasUpcoming)
      } catch {
        if (!cancelled) {
          setIsScenarioFallbackMode(false)
        }
      }
    }

    checkUpcomingGames()

    return () => {
      cancelled = true
    }
  }, [stage])

  useEffect(() => {
    if (stage !== 'main' || !selectedScenarioLocation) return
    if (isScenarioFallbackMode) {
      setIsNearestScenarioGameLoading(false)
      setNearestScenarioGame(null)
      setScenarioAccessGlitch(false)
      const isDone =
        typeof window !== 'undefined' &&
        localStorage.getItem(SCENARIO_FALLBACK_DONE_KEY) === '1'
      setIsScenarioFallbackConfirmed(isDone)
      setScenarioAccessState(isDone ? 'allowed' : 'idle')
      return
    }

    let cancelled = false
    const now = Date.now()

    const fetchNearestGame = async () => {
      setIsNearestScenarioGameLoading(true)
      setNearestScenarioGame(null)
      setScenarioAccessState('idle')
      setScenarioAccessGlitch(false)

      if (scenarioAccessTimerRef.current) {
        clearTimeout(scenarioAccessTimerRef.current)
        scenarioAccessTimerRef.current = null
      }
      if (scenarioDeniedTimerRef.current) {
        clearTimeout(scenarioDeniedTimerRef.current)
        scenarioDeniedTimerRef.current = null
      }

      try {
        const params = new URLSearchParams({
          collection: 'games',
          location: selectedScenarioLocation,
          sort: 'dateStart',
          limit: '120',
          select: '_id,name,dateStart,status,hidden',
        })

        const response = await fetch(
          `/api/${selectedScenarioLocation}/custom?${params.toString()}`,
        )
        const json = await response.json()
        const list = Array.isArray(json?.data) ? json.data : []

        if (!response.ok || !list.length || cancelled) {
          setNearestScenarioGame(null)
          setScenarioAccessState('idle')
          return
        }

        const normalized = list
          .filter((item) => !item?.hidden)
          .filter((item) =>
            ['active', 'started'].includes(
              String(item?.status || '').toLowerCase(),
            ),
          )
          .map((item) => {
            const id =
              typeof item?._id === 'string' ? item._id : String(item?._id || '')
            const startTs = item?.dateStart
              ? new Date(item.dateStart).getTime()
              : 0
            return {
              id,
              name: item?.name || 'Без названия',
              dateStart: Number.isFinite(startTs) ? startTs : 0,
            }
          })
          .filter((item) => item.id)
          .sort((a, b) => a.dateStart - b.dateStart)

        const upcoming = normalized.find((item) => item.dateStart >= now)
        const nearest = upcoming || normalized[0] || null

        if (!nearest || cancelled) {
          setNearestScenarioGame(null)
          setScenarioAccessState('idle')
          return
        }

        setNearestScenarioGame({
          ...nearest,
          dateLabel: nearest.dateStart
            ? new Date(nearest.dateStart).toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Дата уточняется',
        })
        setScenarioAccessState('checking')
        scenarioAccessTimerRef.current = setTimeout(() => {
          if (cancelled) return
          setScenarioAccessState('allowed')
          scenarioAccessTimerRef.current = null
        }, GAME_ACCESS_CHECK_DELAY_MS)
      } catch {
        if (!cancelled) {
          setNearestScenarioGame(null)
          setScenarioAccessState('idle')
        }
      } finally {
        if (!cancelled) {
          setIsNearestScenarioGameLoading(false)
        }
      }
    }

    fetchNearestGame()

    return () => {
      cancelled = true
    }
  }, [isScenarioFallbackMode, selectedScenarioLocation, stage])

  useEffect(() => {
    if (stage !== 'main' || !selectedScenarioLocation) return

    let cancelled = false

    const fetchProjectChatUrl = async () => {
      try {
        const params = new URLSearchParams({
          collection: 'sitesettings',
          limit: '1',
          select: 'chatUrl',
        })
        const response = await fetch(
          `/api/${selectedScenarioLocation}/custom?${params.toString()}`,
        )
        const json = await response.json()

        if (!response.ok || cancelled) {
          if (!cancelled) setProjectChatUrl('')
          return
        }

        const settingsDoc = Array.isArray(json?.data)
          ? json.data[0]
          : json?.data
        const nextUrl = normalizeExternalUrl(settingsDoc?.chatUrl)
        if (!cancelled) {
          setProjectChatUrl(nextUrl)
        }
      } catch {
        if (!cancelled) {
          setProjectChatUrl('')
        }
      }
    }

    fetchProjectChatUrl()

    return () => {
      cancelled = true
    }
  }, [selectedScenarioLocation, stage])

  useEffect(() => {
    if (stage !== 'main') return

    let cancelled = false

    const fetchArchiveSlides = async () => {
      setIsArchiveLoading(true)
      setArchiveSlideIndex(0)

      try {
        const fetchGamesByLocation = async (locationKey) => {
          const params = new URLSearchParams({
            collection: 'games',
            location: locationKey,
            sort: '-dateEndFact',
            limit: '120',
            select:
              '_id,name,image,location,dateStart,dateEndFact,status,hidden',
          })
          const response = await fetch(
            `/api/${locationKey}/custom?${params.toString()}`,
          )
          const json = await response.json()
          if (!response.ok) return []
          return Array.isArray(json?.data) ? json.data : []
        }

        const allLocationsLists = await Promise.all(
          scenarioLocations.map((locationItem) =>
            fetchGamesByLocation(locationItem.key),
          ),
        )
        if (cancelled) return

        const items = allLocationsLists
          .flat()
          .filter((item) => !item?.hidden)
          .map((item) => {
            const image =
              typeof item?.image === 'string' ? item.image.trim() : ''
            const startTs = item?.dateStart
              ? new Date(item.dateStart).getTime()
              : 0
            const endTs = item?.dateEndFact
              ? new Date(item.dateEndFact).getTime()
              : 0
            const status = String(item?.status || '').toLowerCase()
            const locationKey =
              typeof item?.location === 'string'
                ? item.location.trim().toLowerCase()
                : ''

            return {
              id: String(item?._id || ''),
              name: item?.name || 'Игра',
              image,
              dateTs: endTs || startTs || 0,
              locationTitle: scenarioLocationTitleByKey[locationKey] || '',
              isFinished: status === 'finished',
            }
          })
          .filter((item) => item.id && item.image && item.isFinished)
          .sort((a, b) => b.dateTs - a.dateTs)
          .slice(0, 8)
          .map((item) => ({
            ...item,
            dateLabel: item.dateTs
              ? new Date(item.dateTs).toLocaleDateString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })
              : '',
          }))

        if (!cancelled) setArchiveSlides(items)
      } catch {
        if (!cancelled) {
          setArchiveSlides([])
        }
      } finally {
        if (!cancelled) {
          setIsArchiveLoading(false)
        }
      }
    }

    fetchArchiveSlides()

    return () => {
      cancelled = true
    }
  }, [stage])

  useEffect(() => {
    if (stage !== 'main' || archiveSlides.length <= 1) return

    const timer = setInterval(() => {
      setArchiveSlideIndex((prev) => (prev + 1) % archiveSlides.length)
    }, ARCHIVE_SLIDE_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [archiveSlides.length, stage])

  useEffect(() => {
    setArchiveImageErrors({})
  }, [archiveSlides])

  useEffect(() => {
    if (stage !== 'main') return

    const target = archiveRealityLineRef.current
    if (
      !target ||
      typeof window === 'undefined' ||
      !('IntersectionObserver' in window)
    ) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        setIsArchiveRealityInView(Boolean(entry?.isIntersecting))
      },
      {
        threshold: 0.55,
      },
    )

    observer.observe(target)

    return () => {
      observer.disconnect()
      setIsArchiveRealityInView(false)
    }
  }, [stage])

  useEffect(() => {
    if (stage !== 'main' || !isArchiveRealityInView) return

    archiveRealityTimerRef.current = setInterval(() => {
      setIsArchiveRealityShifted((prev) => !prev)
      setIsArchiveRealityGlitch(true)

      if (archiveRealityGlitchTimerRef.current) {
        clearTimeout(archiveRealityGlitchTimerRef.current)
      }
      archiveRealityGlitchTimerRef.current = setTimeout(() => {
        setIsArchiveRealityGlitch(false)
        archiveRealityGlitchTimerRef.current = null
      }, 280)
    }, ARCHIVE_REALITY_SWAP_MS)

    return () => {
      if (archiveRealityTimerRef.current) {
        clearInterval(archiveRealityTimerRef.current)
        archiveRealityTimerRef.current = null
      }
      if (archiveRealityGlitchTimerRef.current) {
        clearTimeout(archiveRealityGlitchTimerRef.current)
        archiveRealityGlitchTimerRef.current = null
      }
    }
  }, [isArchiveRealityInView, stage])

  useEffect(() => {
    if (stage !== 'main') return

    const onKeyDown = (event) => {
      const key = event.key
      if (key.length !== 1 && key !== ' ' && key !== 'Backspace') return

      if (key === 'Backspace') {
        keyboardBufferRef.current = keyboardBufferRef.current.slice(0, -1)
      } else {
        keyboardBufferRef.current = (
          keyboardBufferRef.current + key.toLowerCase()
        ).slice(-24)
      }

      const normalizedBuffer = keyboardBufferRef.current
        .replace(/\s+/g, ' ')
        .trim()
      let msg = ''
      if (normalizedBuffer.includes('кто ты')) {
        msg = 'вопрос не в этом'
      } else if (normalizedBuffer.includes('игра')) {
        msg = 'она уже идет'
      }

      if (msg) {
        setKeyboardEasterMessage(msg)
        if (keyboardMessageTimeoutRef.current) {
          clearTimeout(keyboardMessageTimeoutRef.current)
        }
        keyboardMessageTimeoutRef.current = setTimeout(() => {
          setKeyboardEasterMessage('')
          keyboardMessageTimeoutRef.current = null
        }, 2800)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [stage])

  useEffect(() => {
    gamePathRef.current = gamePath
  }, [gamePath])

  useEffect(() => {
    gameSegmentsRef.current = gameSegments
  }, [gameSegments])

  const handleEntryClick = () => {
    if (!entryReady) return

    setEntryGlitch(true)
    setTimeout(() => {
      setEntryGlitch(false)
      setStage('riddle')
    }, 330)
  }

  const openRiddleReveal = (finalAnswer) => {
    if (answerStartedAt && typeof window !== 'undefined') {
      localStorage.setItem(
        REACTION_MS_KEY,
        String(Date.now() - answerStartedAt),
      )
    }

    setRiddleError('')
    setSubmittedRiddleAnswer(finalAnswer)
    setRiddleClosing(true)
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current)
    }
    transitionTimeoutRef.current = setTimeout(() => {
      setRiddleClosing(false)
      setRiddlePhase('reveal')
    }, 320)
  }

  const handleAnswerSubmit = (event) => {
    event.preventDefault()
    const normalized = displayAnswer

    if (!normalized) {
      setRiddleError('Введите любой ответ, чтобы продолжить проверку.')
      return
    }

    if (validAnswers.includes(normalized)) {
      openRiddleReveal(normalized)
      return
    }

    setRiddleError('Слишком поверхностно.\nСмотри внимательнее.')
    setWrongAttempts((prev) => prev + 1)
    setAnswer('')
    setInputGlitch(true)
    if (inputGlitchTimeoutRef.current) {
      clearTimeout(inputGlitchTimeoutRef.current)
    }
    inputGlitchTimeoutRef.current = setTimeout(() => {
      setInputGlitch(false)
      inputGlitchTimeoutRef.current = null
    }, 280)
  }

  const handleGiveUp = () => {
    openRiddleReveal(validAnswers[0])
  }

  const handleScenarioAccessClick = () => {
    if (!nearestScenarioGame) return

    if (scenarioAccessState !== 'allowed') {
      setScenarioAccessGlitch(true)
      setScenarioAccessState('patience')

      if (scenarioAccessTimerRef.current) {
        clearTimeout(scenarioAccessTimerRef.current)
      }
      scenarioAccessTimerRef.current = setTimeout(() => {
        setScenarioAccessState('allowed')
        scenarioAccessTimerRef.current = null
      }, GAME_ACCESS_CHECK_DELAY_MS)

      if (scenarioDeniedTimerRef.current) {
        clearTimeout(scenarioDeniedTimerRef.current)
      }
      scenarioDeniedTimerRef.current = setTimeout(() => {
        setScenarioAccessGlitch(false)
        scenarioDeniedTimerRef.current = null
      }, 550)
      return
    }

    const callbackUrl = `/cabinet/games?gameId=${encodeURIComponent(nearestScenarioGame.id)}`
    router.push(`/cabinet/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  const handleScenarioFallbackConfirm = () => {
    if (!isScenarioFallbackMode || isScenarioFallbackConfirmed) return
    setIsScenarioFallbackConfirmed(true)
    setScenarioAccessState('allowed')
    if (typeof window !== 'undefined') {
      localStorage.setItem(SCENARIO_FALLBACK_DONE_KEY, '1')
    }
  }

  const getRelativeMapPoint = (clientX, clientY) => {
    const mapElement = mapContainerRef.current
    if (!mapElement) return null
    const rect = mapElement.getBoundingClientRect()
    if (!rect.width || !rect.height) return null

    const x = ((clientX - rect.left) / rect.width) * 100
    const y = ((clientY - rect.top) / rect.height) * 100
    return { x, y }
  }

  const getNearestPointId = (x, y) => {
    const mapElement = mapContainerRef.current
    if (!mapElement) return null

    const rect = mapElement.getBoundingClientRect()
    if (!rect.width || !rect.height) return null

    let nearest = null
    let minDistance = Number.POSITIVE_INFINITY

    gamePoints.forEach((point) => {
      const px = (parsePercent(point.left) / 100) * rect.width
      const py = (parsePercent(point.top) / 100) * rect.height
      const cx = (x / 100) * rect.width
      const cy = (y / 100) * rect.height
      const dist = Math.hypot(px - cx, py - cy)
      if (dist < minDistance) {
        minDistance = dist
        nearest = point.id
      }
    })

    const snapDistance =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(hover: none) and (pointer: coarse)').matches
        ? 40
        : 28

    return minDistance <= snapDistance ? nearest : null
  }

  const captureMapPointer = (pointerId) => {
    if (typeof pointerId !== 'number') return
    const mapElement = mapContainerRef.current
    if (!mapElement?.setPointerCapture) return
    try {
      mapElement.setPointerCapture(pointerId)
    } catch {
      // ignore capture errors on unsupported browsers
    }
  }

  const releaseMapPointer = (pointerId) => {
    if (typeof pointerId !== 'number') return
    const mapElement = mapContainerRef.current
    if (!mapElement?.releasePointerCapture) return
    try {
      mapElement.releasePointerCapture(pointerId)
    } catch {
      // ignore release errors on unsupported browsers
    }
  }

  const restartPathGame = (message) => {
    setGamePath([])
    setGameSegments([])
    gamePathRef.current = []
    gameSegmentsRef.current = []
    setIsDrawingPath(false)
    setGameCursor(null)
    setGameComplete(false)
    setGameStatus(message)
  }

  const appendPointToPath = (nextPointId) => {
    if (!secretFound || gameComplete) return
    const currentPath = gamePathRef.current
    const currentSegments = gameSegmentsRef.current

    if (!currentPath.length) return
    const startId = currentPath[0]
    const isClosingToStart = nextPointId === startId
    const requiredUniqueCount = gamePoints.length
    const visitedUniqueCount = new Set(currentPath).size

    if (currentPath.includes(nextPointId) && !isClosingToStart) {
      restartPathGame('Маршрут отклонен.')
      return
    }

    if (isClosingToStart) {
      if (startId !== PATH_START_POINT_ID) {
        restartPathGame('Маршрут отклонен.')
        return
      }
      if (visitedUniqueCount !== requiredUniqueCount) {
        restartPathGame('Маршрут отклонен.')
        return
      }
      if (currentPath[currentPath.length - 1] === startId) {
        return
      }
    }

    const fromId = currentPath[currentPath.length - 1]
    const newSegment = { from: fromId, to: nextPointId }
    const a1 = gamePointById[newSegment.from]
    const a2 = gamePointById[newSegment.to]

    const hasCrossing = currentSegments.some((segment) => {
      const b1 = gamePointById[segment.from]
      const b2 = gamePointById[segment.to]
      const sharesEndpoint =
        segment.from === newSegment.from ||
        segment.from === newSegment.to ||
        segment.to === newSegment.from ||
        segment.to === newSegment.to
      if (sharesEndpoint) return false
      return segmentsIntersect(a1, a2, b1, b2)
    })

    if (hasCrossing) {
      restartPathGame('Маршрут отклонен.')
      return
    }

    const nextSegments = [...currentSegments, newSegment]
    const nextPath = [...currentPath, nextPointId]
    gameSegmentsRef.current = nextSegments
    gamePathRef.current = nextPath
    setGameSegments(nextSegments)
    setGamePath(nextPath)

    if (isClosingToStart) {
      setIsDrawingPath(false)
      setGameCursor(null)
      setGameComplete(true)
      setGameStatus('Маршрут собран. Доступ к следующему уровню открыт.')
      if (typeof window !== 'undefined') {
        localStorage.setItem(MAP_GAME_COMPLETE_KEY, '1')
        localStorage.setItem(MAP_GAME_PATH_KEY, JSON.stringify(nextPath))
        localStorage.setItem(
          MAP_GAME_SEGMENTS_KEY,
          JSON.stringify(nextSegments),
        )
      }
    }
  }

  const handlePointPointerDown = (pointId, event) => {
    if (!secretFound || gameComplete) return

    if (event.cancelable) {
      event.preventDefault()
    }
    event.stopPropagation()
    if (event.currentTarget?.setPointerCapture) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // ignore capture errors on unsupported browsers
      }
    }
    captureMapPointer(event.pointerId)
    const rel = getRelativeMapPoint(event.clientX, event.clientY)
    if (!rel) return

    if (pointId !== PATH_START_POINT_ID) {
      setGameStatus('Сигнал не принят.')
      return
    }

    setGameStatus('')
    setGamePath([pointId])
    setGameSegments([])
    gamePathRef.current = [pointId]
    gameSegmentsRef.current = []
    setGameComplete(false)
    setIsDrawingPath(true)
    setGameCursor(rel)
  }

  const markObserverFromBehavior = () => {
    if (mapObserverUnlocked) return
    setMapObserverUnlocked(true)
  }

  const handleMapPointerEnter = () => {
    mapHoverStartRef.current = Date.now()
    if (mapIdleTimeoutRef.current) {
      clearTimeout(mapIdleTimeoutRef.current)
    }
    mapIdleTimeoutRef.current = setTimeout(() => {
      markObserverFromBehavior()
      mapIdleTimeoutRef.current = null
    }, 5600)
  }

  const handleMapPointerMove = (event) => {
    if (!secretFound) return
    if (isDrawingPath && event.cancelable) {
      event.preventDefault()
    }
    const rel = getRelativeMapPoint(event.clientX, event.clientY)
    if (!rel) return

    if (!mapObserverUnlocked && mapHoverStartRef.current) {
      if (Date.now() - mapHoverStartRef.current > 6500) {
        markObserverFromBehavior()
      }
    }

    if (mapIdleTimeoutRef.current) {
      clearTimeout(mapIdleTimeoutRef.current)
    }
    mapIdleTimeoutRef.current = setTimeout(() => {
      markObserverFromBehavior()
      mapIdleTimeoutRef.current = null
    }, 5600)

    if (!isDrawingPath || gameComplete) return
    setGameCursor(rel)

    const nearestId = getNearestPointId(rel.x, rel.y)
    if (!nearestId) return
    if (gamePath.length && nearestId === gamePath[gamePath.length - 1]) return
    if (nearestId === PROMO_POINT_ID && !secretFound) return

    appendPointToPath(nearestId)
  }

  const handleMapPointerUp = (event) => {
    releaseMapPointer(event?.pointerId)
    if (!isDrawingPath) return
    if (gameComplete) return
    restartPathGame('Линия оборвалась.')
  }

  const handleMapPointerCancel = (event) => {
    releaseMapPointer(event?.pointerId)
    if (!isDrawingPath || gameComplete) return
    restartPathGame('Линия оборвалась.')
  }

  const handleMapPointerLeave = (event) => {
    if (event?.pointerType === 'mouse') {
      releaseMapPointer(event?.pointerId)
    }
    if (mapIdleTimeoutRef.current) {
      clearTimeout(mapIdleTimeoutRef.current)
      mapIdleTimeoutRef.current = null
    }
    mapHoverStartRef.current = 0
    if (event?.pointerType === 'mouse') {
      handleMapPointerUp(event)
    }
  }

  const handleRiddleContinue = () => {
    const canonicalAnswer = validAnswers[0]
    const resultAnswer = submittedRiddleAnswer || canonicalAnswer

    if (typeof window !== 'undefined') {
      localStorage.setItem(ACCESS_KEY, '1')
      localStorage.setItem(FIRST_ANSWER_KEY, resultAnswer)
    }

    setAnswer(canonicalAnswer)
    setStage('main')
  }

  const handleResetProgress = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(FIRST_ANSWER_KEY)
      localStorage.removeItem(REACTION_MS_KEY)
      localStorage.removeItem(MAP_SECRET_FOUND_KEY)
      localStorage.removeItem(MAP_GAME_COMPLETE_KEY)
      localStorage.removeItem(MAP_GAME_PATH_KEY)
      localStorage.removeItem(MAP_GAME_SEGMENTS_KEY)
      localStorage.removeItem(ARCHIVE_IMAGE_KEY)
      localStorage.removeItem(PROCESS_ORDER_SOLVED_KEY)
    }

    setStage('prelude')
    setVisiblePrelude(0)
    setEntryReady(false)
    setEntryGlitch(false)
    setAnswer('')
    setRiddleError('')
    setRiddlePhase('question')
    setRiddleClosing(false)
    setSubmittedRiddleAnswer('')
    setWrongAttempts(0)
    setInputGlitch(false)
    setSpecialPointNote('')
    setMapObserverUnlocked(false)
    setMapTouchedPointIds([])
    setKeyboardEasterMessage('')
    setGamePath([])
    setGameSegments([])
    setIsDrawingPath(false)
    setGameCursor(null)
    setGameComplete(false)
    setGameStatus('')
    setNearestScenarioGame(null)
    setIsNearestScenarioGameLoading(false)
    setScenarioAccessState('idle')
    setScenarioAccessGlitch(false)
    setProcessRowsState(getShuffledFlowRows())
    setGrabbedProcessRowId(null)
    setIsProcessOrderLocked(false)
    setArchiveImage('')
    setArchiveDragActive(false)
    setArchiveStatus('')
    setSecretFound(false)
    setVisibleFlowCount(0)
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current)
      transitionTimeoutRef.current = null
    }
    if (inputGlitchTimeoutRef.current) {
      clearTimeout(inputGlitchTimeoutRef.current)
      inputGlitchTimeoutRef.current = null
    }
    if (scenarioAccessTimerRef.current) {
      clearTimeout(scenarioAccessTimerRef.current)
      scenarioAccessTimerRef.current = null
    }
    if (scenarioDeniedTimerRef.current) {
      clearTimeout(scenarioDeniedTimerRef.current)
      scenarioDeniedTimerRef.current = null
    }
    if (processGrabTimerRef.current) {
      clearTimeout(processGrabTimerRef.current)
      processGrabTimerRef.current = null
    }

    const lineTimer = setInterval(() => {
      setVisiblePrelude((prev) => {
        const next = prev + 1
        if (next >= preludeLines.length) {
          clearInterval(lineTimer)
          setTimeout(() => {
            setStage('entry')
            setTimeout(() => setEntryReady(true), 2000)
          }, PRELUDE_TO_ENTRY_DELAY_MS)
        }
        return Math.min(next, preludeLines.length)
      })
    }, PRELUDE_LINE_DELAY_MS)
  }

  const persistArchiveImage = (dataUrl) => {
    setArchiveImage(dataUrl)
    setArchiveStatus('')
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ARCHIVE_IMAGE_KEY, dataUrl)
      } catch {
        setArchiveStatus(
          'Не удалось сохранить файл: превышен лимит локального хранилища.',
        )
      }
    }
  }

  const isPointInsideArchiveDropZone = (clientX, clientY) => {
    const zoneRect = archiveDropZoneRef.current?.getBoundingClientRect?.()
    if (!zoneRect) return false
    return (
      clientX >= zoneRect.left &&
      clientX <= zoneRect.right &&
      clientY >= zoneRect.top &&
      clientY <= zoneRect.bottom
    )
  }

  const clearArchiveSledHoldTimer = () => {
    if (archiveSledHoldTimerRef.current) {
      clearTimeout(archiveSledHoldTimerRef.current)
      archiveSledHoldTimerRef.current = null
    }
  }

  const detachArchiveSledPointerListeners = () => {
    window.removeEventListener('pointermove', handleArchiveSledPointerMove)
    window.removeEventListener('pointerup', handleArchiveSledPointerEnd)
    window.removeEventListener('pointercancel', handleArchiveSledPointerEnd)
  }

  const detachArchiveSledTouchListeners = () => {
    window.removeEventListener('touchmove', handleArchiveSledTouchMove)
    window.removeEventListener('touchend', handleArchiveSledTouchEnd)
    window.removeEventListener('touchcancel', handleArchiveSledTouchEnd)
  }

  const clearArchiveSledDrag = () => {
    clearArchiveSledHoldTimer()
    archiveSledPendingPointerIdRef.current = null
    archiveSledPendingPointerTypeRef.current = ''
    const pointerId = archiveSledPointerIdRef.current
    const dragElement = archiveSledDragElementRef.current
    if (
      dragElement &&
      typeof pointerId === 'number' &&
      dragElement.releasePointerCapture
    ) {
      try {
        dragElement.releasePointerCapture(pointerId)
      } catch {
        // ignore release errors
      }
    }
    archiveSledPointerIdRef.current = null
    archiveSledDragElementRef.current = null
    if (typeof document !== 'undefined') {
      document.body.style.overflow = pageOverflowRestoreRef.current.body
      document.documentElement.style.overflow =
        pageOverflowRestoreRef.current.html
    }
    setArchiveDragActive(false)
    setSledDragGhost(null)
  }

  const startArchiveSledDrag = (pointerId, pointerType) => {
    if (typeof pointerId !== 'number') return
    archiveSledPointerIdRef.current = pointerId
    const dragElement = archiveSledDragElementRef.current
    if (dragElement?.setPointerCapture) {
      try {
        dragElement.setPointerCapture(pointerId)
      } catch {
        // ignore capture errors
      }
    }
    setSledDragGhost({
      x: archiveSledLastPointRef.current.x,
      y: archiveSledLastPointRef.current.y,
    })
    setArchiveDragActive(false)
    setArchiveStatus('')
    if (typeof document !== 'undefined' && pointerType !== 'mouse') {
      pageOverflowRestoreRef.current = {
        body: document.body.style.overflow,
        html: document.documentElement.style.overflow,
      }
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    }
  }

  const handleArchiveSledPointerMove = (event) => {
    archiveSledLastPointRef.current = { x: event.clientX, y: event.clientY }

    if (archiveSledPendingPointerIdRef.current === event.pointerId) {
      const dx = event.clientX - archiveSledHoldStartPointRef.current.x
      const dy = event.clientY - archiveSledHoldStartPointRef.current.y
      if (Math.hypot(dx, dy) > ARCHIVE_SLED_HOLD_MOVE_TOLERANCE_PX) {
        clearArchiveSledHoldTimer()
        archiveSledPendingPointerIdRef.current = null
        archiveSledPendingPointerTypeRef.current = ''
        archiveSledDragElementRef.current = null
        setArchiveDragActive(false)
        setSledDragGhost(null)
        detachArchiveSledPointerListeners()
      }
      return
    }

    if (archiveSledPointerIdRef.current !== event.pointerId) return
    if (event.cancelable) {
      event.preventDefault()
    }
    const isInside = isPointInsideArchiveDropZone(event.clientX, event.clientY)
    setArchiveDragActive(isInside)
    setSledDragGhost({ x: event.clientX, y: event.clientY })
  }

  const handleArchiveSledPointerEnd = (event) => {
    if (archiveSledPendingPointerIdRef.current === event.pointerId) {
      clearArchiveSledHoldTimer()
      archiveSledPendingPointerIdRef.current = null
      archiveSledPendingPointerTypeRef.current = ''
      archiveSledDragElementRef.current = null
      setArchiveDragActive(false)
      setSledDragGhost(null)
      detachArchiveSledPointerListeners()
      return
    }

    if (archiveSledPointerIdRef.current !== event.pointerId) return

    const isInside = isPointInsideArchiveDropZone(event.clientX, event.clientY)
    if (isInside) {
      persistArchiveImage(ARCHIVE_SLED_SRC)
    }
    clearArchiveSledDrag()
    detachArchiveSledPointerListeners()
  }

  const handleArchiveSledPointerDown = (event) => {
    if (event.pointerType !== 'mouse') return
    if (event.button !== 0) return
    if (event.cancelable) {
      event.preventDefault()
    }

    archiveSledDragElementRef.current = event.currentTarget
    archiveSledLastPointRef.current = { x: event.clientX, y: event.clientY }
    archiveSledHoldStartPointRef.current = {
      x: event.clientX,
      y: event.clientY,
    }
    setArchiveDragActive(false)
    setArchiveStatus('')

    if (event.pointerType === 'mouse') {
      startArchiveSledDrag(event.pointerId, event.pointerType)
    } else {
      archiveSledPendingPointerIdRef.current = event.pointerId
      archiveSledPendingPointerTypeRef.current = event.pointerType
      clearArchiveSledHoldTimer()
      archiveSledHoldTimerRef.current = setTimeout(() => {
        if (archiveSledPendingPointerIdRef.current !== event.pointerId) return
        archiveSledPendingPointerIdRef.current = null
        startArchiveSledDrag(
          event.pointerId,
          archiveSledPendingPointerTypeRef.current,
        )
        archiveSledPendingPointerTypeRef.current = ''
      }, ARCHIVE_SLED_HOLD_MS)
    }

    window.addEventListener('pointermove', handleArchiveSledPointerMove)
    window.addEventListener('pointerup', handleArchiveSledPointerEnd)
    window.addEventListener('pointercancel', handleArchiveSledPointerEnd)
  }

  const getTouchByIdentifier = (touchList, identifier) =>
    Array.from(touchList || []).find((touch) => touch.identifier === identifier)

  const handleArchiveSledTouchMove = (event) => {
    const pendingId = archiveSledPendingPointerIdRef.current
    if (typeof pendingId === 'number') {
      const pendingTouch = getTouchByIdentifier(event.touches, pendingId)
      if (!pendingTouch) return
      archiveSledLastPointRef.current = {
        x: pendingTouch.clientX,
        y: pendingTouch.clientY,
      }

      const dx = pendingTouch.clientX - archiveSledHoldStartPointRef.current.x
      const dy = pendingTouch.clientY - archiveSledHoldStartPointRef.current.y
      if (Math.hypot(dx, dy) > ARCHIVE_SLED_HOLD_MOVE_TOLERANCE_PX) {
        clearArchiveSledHoldTimer()
        archiveSledPendingPointerIdRef.current = null
        archiveSledPendingPointerTypeRef.current = ''
        archiveSledDragElementRef.current = null
        setArchiveDragActive(false)
        setSledDragGhost(null)
        detachArchiveSledTouchListeners()
      }
      return
    }

    const activeId = archiveSledPointerIdRef.current
    if (typeof activeId !== 'number') return
    const activeTouch = getTouchByIdentifier(event.touches, activeId)
    if (!activeTouch) return

    if (event.cancelable) {
      event.preventDefault()
    }
    const { clientX, clientY } = activeTouch
    const isInside = isPointInsideArchiveDropZone(clientX, clientY)
    setArchiveDragActive(isInside)
    setSledDragGhost({ x: clientX, y: clientY })
  }

  const handleArchiveSledTouchEnd = (event) => {
    const pendingId = archiveSledPendingPointerIdRef.current
    if (typeof pendingId === 'number') {
      const pendingTouch = getTouchByIdentifier(event.changedTouches, pendingId)
      if (!pendingTouch) return
      clearArchiveSledHoldTimer()
      archiveSledPendingPointerIdRef.current = null
      archiveSledPendingPointerTypeRef.current = ''
      archiveSledDragElementRef.current = null
      setArchiveDragActive(false)
      setSledDragGhost(null)
      detachArchiveSledTouchListeners()
      return
    }

    const activeId = archiveSledPointerIdRef.current
    if (typeof activeId !== 'number') return
    const activeTouch = getTouchByIdentifier(event.changedTouches, activeId)
    if (!activeTouch) return

    const isInside = isPointInsideArchiveDropZone(
      activeTouch.clientX,
      activeTouch.clientY,
    )
    if (isInside) {
      persistArchiveImage(ARCHIVE_SLED_SRC)
    }
    clearArchiveSledDrag()
    detachArchiveSledTouchListeners()
  }

  const handleArchiveSledTouchStart = (event) => {
    const touch = event.touches?.[0]
    if (!touch) return
    if (event.cancelable) {
      event.preventDefault()
    }

    archiveSledDragElementRef.current = event.currentTarget
    archiveSledLastPointRef.current = { x: touch.clientX, y: touch.clientY }
    archiveSledHoldStartPointRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    }
    archiveSledPendingPointerIdRef.current = touch.identifier
    archiveSledPendingPointerTypeRef.current = 'touch'
    setArchiveDragActive(false)
    setArchiveStatus('')

    clearArchiveSledHoldTimer()
    archiveSledHoldTimerRef.current = setTimeout(() => {
      if (archiveSledPendingPointerIdRef.current !== touch.identifier) return
      archiveSledPendingPointerIdRef.current = null
      startArchiveSledDrag(touch.identifier, 'touch')
      archiveSledPendingPointerTypeRef.current = ''
    }, ARCHIVE_SLED_HOLD_MS)

    window.addEventListener('touchmove', handleArchiveSledTouchMove, {
      passive: false,
    })
    window.addEventListener('touchend', handleArchiveSledTouchEnd, {
      passive: false,
    })
    window.addEventListener('touchcancel', handleArchiveSledTouchEnd, {
      passive: false,
    })
  }

  const handleProcessRowPointerDown = (rowId) => {
    if (isProcessOrderLocked) return
    if (processGrabTimerRef.current) {
      clearTimeout(processGrabTimerRef.current)
    }
    processGrabTimerRef.current = setTimeout(() => {
      setGrabbedProcessRowId(rowId)
      processGrabTimerRef.current = null
    }, PROCESS_GRAB_HOLD_MS)
  }

  const clearProcessGrabTimer = () => {
    if (processGrabTimerRef.current) {
      clearTimeout(processGrabTimerRef.current)
      processGrabTimerRef.current = null
    }
  }

  const handleProcessRowClick = (targetRowId) => {
    if (isProcessOrderLocked) return
    if (!grabbedProcessRowId) return

    if (grabbedProcessRowId === targetRowId) {
      setGrabbedProcessRowId(null)
      return
    }

    setProcessRowsState((prev) => {
      const from = prev.findIndex((row) => row.id === grabbedProcessRowId)
      const to = prev.findIndex((row) => row.id === targetRowId)
      if (from < 0 || to < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setGrabbedProcessRowId(null)
  }

  return (
    <>
      <Head>
        <title>ActQuest | Index2</title>
      </Head>

      <div className="relative min-h-screen overflow-hidden bg-[#0B001A] text-slate-100">
        <div className="absolute inset-0 pointer-events-none">
          <div className="bg-orb bg-orb-1 absolute -left-16 top-8 h-64 w-64 rounded-full bg-[#7A00FF]/25 blur-3xl" />
          <div className="bg-orb bg-orb-2 absolute right-0 top-1/3 h-72 w-72 rounded-full bg-[#00D1FF]/15 blur-3xl" />
          <div className="bg-orb bg-orb-3 absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#1A0033] blur-3xl" />
        </div>

        {stage === 'prelude' && (
          <section className="relative z-10 flex flex-col justify-center w-full max-w-5xl min-h-screen px-6 mx-auto">
            <div className="space-y-3 font-mono text-sm uppercase tracking-[0.16em] text-[#b9a8da] md:text-base">
              {preludeLines.slice(0, visiblePrelude).map((line) => (
                <p key={line} className="animate-fade-in">
                  {line}
                </p>
              ))}
            </div>
          </section>
        )}

        {stage === 'entry' && (
          <section
            className={`relative z-10 flex min-h-screen items-center justify-center px-6 ${entryGlitch ? 'animate-glitch' : ''}`}
          >
            <div className="w-full max-w-4xl text-center">
              <p className="text-sm uppercase tracking-[0.2em] text-[#00D1FF]">
                Первая дверь
              </p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight text-white md:text-6xl">
                ГОРОД УЖЕ НАЧАЛ ИГРУ
                <br />
                ТЫ — ЕЩЕ НЕТ
              </h1>
              <button
                type="button"
                onClick={handleEntryClick}
                disabled={!entryReady}
                className={`mt-10 rounded-2xl border px-8 py-3 text-sm font-semibold uppercase tracking-[0.18em] transition ${
                  entryReady
                    ? 'cursor-pointer border-[#7A00FF] bg-[#7A00FF]/10 text-[#e9d6ff] shadow-[0_0_24px_rgba(122,0,255,0.35)] hover:bg-[#7A00FF]/20'
                    : 'cursor-not-allowed border-white/20 bg-white/5 text-slate-400'
                }`}
              >
                Войти
              </button>
            </div>
          </section>
        )}

        {stage === 'riddle' && (
          <section className="relative z-10 flex items-center w-full max-w-3xl min-h-screen px-6 mx-auto">
            {riddlePhase === 'question' && (
              <div
                className={`w-full rounded-3xl border border-white/15 bg-[#120726]/85 p-8 backdrop-blur-xl transition-all duration-300 ${
                  riddleClosing
                    ? 'scale-95 opacity-0 blur-[2px]'
                    : 'scale-100 opacity-100'
                }`}
              >
                <p className="text-xs uppercase tracking-[0.18em] text-[#00D1FF]">
                  Проверка наблюдателя
                </p>
                <h2 className="mt-4 text-2xl leading-relaxed text-slate-100 md:text-3xl">
                  Город пишет свою историю линиями.
                  <br />
                  Ты движешься по ним, не замечая названий.
                  <br />
                  Что это?
                </h2>

                <form className="mt-8 space-y-4" onSubmit={handleAnswerSubmit}>
                  <input
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder="Введи ответ"
                    className={`w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-[#00D1FF]/70 ${
                      inputGlitch ? 'input-glitch border-red-300/60' : ''
                    }`}
                  />
                  <button
                    type="submit"
                    className="cursor-pointer rounded-xl border border-[#00D1FF]/50 bg-[#00D1FF]/10 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-[#b9f5ff] transition hover:bg-[#00D1FF]/20"
                  >
                    Ответить
                  </button>
                </form>

                {riddleError && (
                  <TypewriterText
                    text={riddleError}
                    resetKey={wrongAttempts}
                    speed={68}
                    className="typewriter-machine mt-5 whitespace-pre-line text-sm leading-relaxed text-[#ffb0b0]"
                  />
                )}

                {wrongAttempts >= 1 && (
                  <div className="mt-4 rounded-xl border border-[#00D1FF]/25 bg-[#00D1FF]/8 px-4 py-3">
                    <TypewriterText
                      text={riddleHints[0]}
                      speed={56}
                      className="typewriter-machine text-[11px] uppercase tracking-[0.14em] text-[#8fdcff]"
                    />
                  </div>
                )}

                {wrongAttempts >= 2 && (
                  <div className="mt-3 rounded-xl border border-[#7A00FF]/30 bg-[#7A00FF]/10 px-4 py-3">
                    <TypewriterText
                      text={riddleHints[1]}
                      speed={56}
                      className="typewriter-machine text-[11px] uppercase tracking-[0.14em] text-[#d6c5ff]"
                    />
                  </div>
                )}

                {wrongAttempts >= 3 && (
                  <button
                    type="button"
                    onClick={handleGiveUp}
                    className="mt-4 cursor-pointer rounded-xl border border-[#7A00FF]/50 bg-[#7A00FF]/10 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-[#e9d6ff] transition hover:bg-[#7A00FF]/20"
                  >
                    Я сдаюсь
                  </button>
                )}
              </div>
            )}

            {riddlePhase === 'reveal' && (
              <div className="w-full animate-fade-in rounded-3xl border border-[#00D1FF]/35 bg-[#0e0722]/90 p-8 shadow-[0_0_28px_rgba(0,209,255,0.12)] backdrop-blur-xl">
                <p className="text-xs uppercase tracking-[0.18em] text-[#00D1FF]">
                  Ответ распознан
                </p>
                <h3 className="mt-4 text-2xl font-semibold leading-relaxed text-white md:text-3xl">
                  Улицы — линии памяти города:
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-200">
                  по ним проходят маршруты, встречи и следы людей. Через улицы
                  город рассказывает свою историю.
                </p>
                <button
                  type="button"
                  onClick={handleRiddleContinue}
                  className="mt-7 cursor-pointer rounded-xl border border-[#00D1FF]/50 bg-[#00D1FF]/10 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-[#b9f5ff] transition hover:bg-[#00D1FF]/20"
                >
                  Продолжить
                </button>
              </div>
            )}
          </section>
        )}

        {stage === 'main' && (
          <main className="relative z-10 pb-20 main-enter">
            <header className="border-b border-white/10 bg-black/15 backdrop-blur-sm">
              <div className="flex items-center justify-between w-full max-w-6xl px-4 py-4 mx-auto">
                <p className="text-lg font-semibold tracking-wide text-[#d7c3ff]">
                  ActQuest
                </p>
                <div className="flex items-center gap-3">
                  <Link
                    href="/cabinet/login"
                    className="px-4 py-2 text-sm font-semibold transition border cursor-pointer rounded-xl border-white/20 text-slate-100 hover:bg-white/10"
                  >
                    Войти
                  </Link>
                  <button
                    type="button"
                    onClick={handleResetProgress}
                    className="cursor-pointer rounded-xl border border-[#7A00FF]/40 px-4 py-2 text-sm font-semibold text-[#d7c3ff] transition hover:bg-[#7A00FF]/15"
                  >
                    Сбросить прогресс
                  </button>
                </div>
              </div>
            </header>

            <section className="w-full max-w-6xl px-4 mx-auto mt-4 reveal-a">
              <div className="rounded-2xl border border-[#00D1FF]/35 bg-[#00D1FF]/8 px-4 py-3 font-mono text-xs uppercase tracking-[0.14em] text-[#baf3ff]">
                <p>наблюдатель подтверждён</p>
                <p className="mt-1">уровень доступа: базовый</p>
                <p className="mt-1 text-[#d8c8ff]">ключ: {selectedKey}</p>
              </div>
            </section>

            {keyboardEasterMessage && (
              <section className="w-full max-w-6xl px-4 mx-auto mt-3">
                <div className="rounded-xl border border-[#7A00FF]/35 bg-[#7A00FF]/10 px-4 py-2 font-mono text-xs uppercase tracking-[0.12em] text-[#ddceff]">
                  {keyboardEasterMessage}
                </div>
              </section>
            )}

            <section className="grid w-full max-w-6xl gap-8 px-4 mx-auto reveal-b pt-14 lg:grid-cols-12 xl:gap-10">
              <div className="lg:col-span-7">
                <p className="text-xs uppercase tracking-[0.18em] text-[#00D1FF]/85">
                  доступ к интерфейсу
                </p>
                <div className="flex justify-center mt-4 lg:justify-start car-neon-flicker">
                  <img
                    src="/logo_title.png?v=20260317-1"
                    alt="ActQuest"
                    className="logo-float h-auto w-full max-w-[340px] md:max-w-[420px]"
                  />
                </div>
                <p className="mt-3 text-sm uppercase tracking-[0.16em] text-[#9dd9ff] text-center lg:text-left">
                  город оживает в твоем маршруте
                </p>
                <p className="max-w-xl mt-4 text-lg text-slate-300">
                  Ты только что это доказал. Ты уже видел их, просто не замечал.
                </p>
                <Link
                  href="/cabinet/login?mode=register"
                  className="mt-8 inline-flex cursor-pointer rounded-2xl border border-[#00D1FF]/50 bg-[#00D1FF]/10 px-6 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-[#bbf5ff] transition hover:bg-[#00D1FF]/20"
                >
                  Начать игру
                </Link>
              </div>

              <div className="lg:col-span-5 lg:pt-8">
                <div
                  ref={mapContainerRef}
                  onPointerEnter={handleMapPointerEnter}
                  onPointerMove={handleMapPointerMove}
                  onPointerUp={handleMapPointerUp}
                  onPointerCancel={handleMapPointerCancel}
                  onPointerLeave={handleMapPointerLeave}
                  className="panel-breathe relative h-[340px] overflow-hidden rounded-3xl border border-white/15 bg-[radial-gradient(circle_at_20%_20%,rgba(122,0,255,0.26),transparent_35%),radial-gradient(circle_at_80%_75%,rgba(0,209,255,0.22),transparent_30%),linear-gradient(140deg,#16032c_0%,#0b001a_45%,#130024_100%)] p-4 lg:h-[390px] xl:h-[430px]"
                  style={{
                    touchAction: isDrawingPath ? 'none' : 'pan-y',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                  }}
                >
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-300">
                    Карта города
                  </p>

                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    {gameSegments.map((segment) => {
                      const from = gamePointById[segment.from]
                      const to = gamePointById[segment.to]
                      return (
                        <line
                          key={`${segment.from}-${segment.to}`}
                          x1={`${from.x}%`}
                          y1={`${from.y}%`}
                          x2={`${to.x}%`}
                          y2={`${to.y}%`}
                          stroke="#00D1FF"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeOpacity="0.95"
                        />
                      )
                    })}
                    {isDrawingPath && gamePath.length > 0 && gameCursor && (
                      <line
                        x1={`${gamePointById[gamePath[gamePath.length - 1]].x}%`}
                        y1={`${gamePointById[gamePath[gamePath.length - 1]].y}%`}
                        x2={`${gameCursor.x}%`}
                        y2={`${gameCursor.y}%`}
                        stroke="#7A00FF"
                        strokeWidth="2"
                        strokeDasharray="5 5"
                        strokeLinecap="round"
                        strokeOpacity="0.9"
                      />
                    )}
                  </svg>

                  {mapPoints.map((point) => (
                    <button
                      key={point.id}
                      type="button"
                      onPointerDown={(event) =>
                        handlePointPointerDown(point.id, event)
                      }
                      onMouseEnter={() => setActivePointId(point.id)}
                      onMouseLeave={() => setActivePointId(null)}
                      onClick={() => {
                        setMapTouchedPointIds((prev) =>
                          prev.includes(point.id) ? prev : [...prev, point.id],
                        )
                        if (point.id === 'c') {
                          setSpecialPointNote(
                            'фрагмент истории: здесь начался чей-то маршрут. подробности откроются позже.',
                          )
                        }
                      }}
                      className={`absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border border-[#00D1FF] bg-[#00D1FF]/35 shadow-[0_0_14px_rgba(0,209,255,0.9)] transition hover:scale-125 ${
                        point.id === 'c' ? 'animate-ping-light' : ''
                      } ${
                        gamePath.includes(point.id)
                          ? 'border-[#8BFFB7] bg-[#8BFFB7]/45 shadow-[0_0_18px_rgba(139,255,183,0.95)]'
                          : ''
                      }`}
                      style={{
                        top: point.top,
                        left: point.left,
                        touchAction: 'none',
                      }}
                      aria-label="map point"
                      draggable={false}
                    >
                      <span className="sr-only">map point</span>
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setSecretFound(true)
                      if (typeof window !== 'undefined') {
                        localStorage.setItem(MAP_SECRET_FOUND_KEY, '1')
                      }
                    }}
                    className="absolute w-10 h-10 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 cursor-pointer"
                    style={{
                      top: promoPoint.top,
                      left: promoPoint.left,
                      touchAction: 'none',
                    }}
                    aria-label="secret zone"
                    draggable={false}
                  />

                  {secretFound && (
                    <button
                      type="button"
                      onPointerDown={(event) =>
                        handlePointPointerDown(PROMO_POINT_ID, event)
                      }
                      onClick={() => {
                        setMapTouchedPointIds((prev) =>
                          prev.includes(PROMO_POINT_ID)
                            ? prev
                            : [...prev, PROMO_POINT_ID],
                        )
                      }}
                      aria-label="promo point"
                      className={`absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border border-[#FF4FD8] bg-[#FF4FD8]/35 shadow-[0_0_16px_rgba(255,79,216,0.9)] animate-pulse-light ${
                        gamePath.includes(PROMO_POINT_ID)
                          ? 'border-[#8BFFB7] bg-[#8BFFB7]/45 shadow-[0_0_18px_rgba(139,255,183,0.95)]'
                          : ''
                      }`}
                      style={{
                        top: promoPoint.top,
                        left: promoPoint.left,
                        touchAction: 'none',
                      }}
                      draggable={false}
                    />
                  )}

                  {mapObserverUnlocked && (
                    <p className="pointer-events-none absolute right-4 top-10 whitespace-pre-line text-[11px] uppercase tracking-[0.12em] text-[#9ccfff]/80">
                      {'ты не просто смотришь\nты ищешь'}
                    </p>
                  )}

                  <p className="absolute text-xs bottom-3 left-4 text-slate-400">
                    {mapActivityHint}
                  </p>
                </div>

                {secretFound && gameStatus && (
                  <div className="mt-3 rounded-xl border border-[#7A00FF]/35 bg-[#7A00FF]/10 px-4 py-3 text-xs uppercase tracking-[0.08em] text-[#e5d8ff]">
                    {gameStatus}
                  </div>
                )}

                {specialPointNote && (
                  <div className="mt-3 rounded-xl border border-[#7A00FF]/35 bg-[#7A00FF]/10 px-4 py-3 text-xs uppercase tracking-[0.08em] text-[#e5d8ff]">
                    {specialPointNote}
                  </div>
                )}
              </div>
            </section>

            <section className="w-full max-w-6xl px-4 mx-auto mt-12 reveal-c">
              <p className="text-xs uppercase tracking-[0.18em] text-[#00D1FF]/85">
                процесс
              </p>
              <div className="grid items-start gap-6 mt-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-stretch">
                <div className="grid gap-3 md:max-w-xl">
                  {processRowsState.map((row, index) => (
                    <FlowRow
                      key={row.id}
                      text={row.text}
                      visible={index < visibleFlowCount}
                      onPointerDown={() => handleProcessRowPointerDown(row.id)}
                      onPointerUp={clearProcessGrabTimer}
                      onPointerLeave={clearProcessGrabTimer}
                      onClick={() => handleProcessRowClick(row.id)}
                      isGrabbed={grabbedProcessRowId === row.id}
                      isLocked={isProcessOrderLocked}
                    />
                  ))}
                </div>

                <aside className="block">
                  <div className="rounded-2xl border border-[#00D1FF]/25 bg-gradient-to-b from-[#0f0222]/85 to-[#090015]/85 p-4 shadow-[0_0_0_1px_rgba(0,209,255,0.12),0_0_24px_rgba(0,209,255,0.08)]">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#9dd9ff]">
                      телеметрия маршрута
                    </p>
                    <div className="h-2 mt-3 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#7A00FF] to-[#00D1FF] transition-all duration-700"
                        style={{ width: `${telemetryProgressPercent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-[0.12em] text-[#bdefff]">
                      синхронизация: {telemetryProgressPercent}%
                    </p>

                    <div className="mt-4 space-y-2">
                      {telemetrySteps.map((step) => (
                        <div
                          key={step.id}
                          className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2"
                        >
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              step.done
                                ? 'bg-[#00D1FF] shadow-[0_0_10px_rgba(0,209,255,0.9)]'
                                : 'bg-white/20'
                            }`}
                          />
                          <p className="text-xs text-slate-300">{step.label}</p>
                        </div>
                      ))}
                    </div>

                    <p className="mt-4 border-t border-white/10 pt-3 text-xs uppercase tracking-[0.1em] text-[#d0c2ff]">
                      {isTelemetryComplete
                        ? 'протокол завершен'
                        : 'поиск скрытых сигналов...'}
                    </p>
                    {isTelemetryComplete ? (
                      <div className="mt-3 rounded-xl border border-[#00D1FF]/30 bg-[#00D1FF]/10 px-3 py-2 text-xs uppercase tracking-[0.1em] text-[#c8f8ff]">
                        бонус-код: OBSERVER-07
                      </div>
                    ) : null}
                  </div>
                </aside>
              </div>
            </section>

            <section className="w-full max-w-6xl px-4 mx-auto mt-12 reveal-d">
              <p className="text-xs uppercase tracking-[0.18em] text-[#00D1FF]/85">
                архив
              </p>
              <div className="relative mt-4 border rounded-3xl border-white/10 bg-white/5 p-7 md:p-10">
                <img
                  src={ARCHIVE_SLED_SRC}
                  alt="След автомобиля"
                  className="absolute -top-20 -right-30 z-20 h-auto w-[18rem] rotate-[-50deg] touch-none tablet:rotate-[-60deg] opacity-95 tablet:-top-35 tablet:-right-22 tablet:w-[28rem]"
                  draggable={false}
                  onPointerDown={handleArchiveSledPointerDown}
                  onTouchStart={handleArchiveSledTouchStart}
                  onContextMenu={(event) => event.preventDefault()}
                  style={{
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                    WebkitUserDrag: 'none',
                  }}
                />
                <div className="grid gap-8">
                  <div>
                    <p className="text-3xl leading-tight text-white md:text-4xl">
                      Это не экскурсия
                      <br />
                      <span
                        ref={archiveRealityLineRef}
                        className={`inline-block transition-all duration-500 ${isArchiveRealityGlitch ? 'archive-reality-glitch' : ''}`}
                      >
                        {isArchiveRealityShifted
                          ? 'Это последствия'
                          : 'Это следы'}
                      </span>
                    </p>
                    <p className="max-w-2xl mt-6 text-lg leading-relaxed text-slate-300">
                      Они не думали, что их запомнят.
                      <br />
                      Но город запомнил.
                    </p>
                  </div>

                  <div className="relative w-full max-w-[340px] mx-auto overflow-hidden rounded-2xl border border-[#00D1FF]/25 bg-[#080018]/70 aspect-square">
                    <div className="relative w-full h-full">
                      {isArchiveLoading && (
                        <div className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-[0.14em] text-[#9dd9ff]">
                          загрузка архива...
                        </div>
                      )}

                      {!isArchiveLoading && archiveSlides.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_25%_35%,rgba(122,0,255,0.26),transparent_45%),radial-gradient(circle_at_75%_70%,rgba(0,209,255,0.18),transparent_40%),linear-gradient(140deg,#140325_0%,#090015_100%)] px-6 text-center">
                          <p className="text-sm uppercase tracking-[0.14em] text-[#b8e9ff]/90">
                            Архив прогревается. Скоро здесь появятся следы
                            прошедших игр.
                          </p>
                        </div>
                      )}

                      {archiveSlides.map((slide, index) => (
                        <div
                          key={slide.id}
                          className={`absolute inset-0 transition-opacity duration-1000 ${
                            index === archiveSlideIndex
                              ? 'opacity-100'
                              : 'pointer-events-none opacity-0'
                          }`}
                        >
                          {archiveImageErrors[slide.id] ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_25%_35%,rgba(122,0,255,0.30),transparent_45%),radial-gradient(circle_at_75%_70%,rgba(0,209,255,0.20),transparent_40%),linear-gradient(140deg,#140325_0%,#090015_100%)] px-6 text-center">
                              <p className="text-xs uppercase tracking-[0.14em] text-[#b8e9ff]/90">
                                Фрагмент архива недоступен
                              </p>
                            </div>
                          ) : (
                            <img
                              src={slide.image}
                              alt={slide.name}
                              className="object-cover w-full h-full"
                              onError={() =>
                                setArchiveImageErrors((prev) =>
                                  prev[slide.id]
                                    ? prev
                                    : { ...prev, [slide.id]: true },
                                )
                              }
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#050012]/85 via-[#050012]/20 to-transparent" />
                          <div className="absolute px-3 py-2 border bottom-10 left-3 right-3 rounded-xl border-white/15 bg-black/30 backdrop-blur-sm">
                            <p className="text-sm font-semibold text-white">
                              {slide.name}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.08em] text-[#9fd9ff]">
                              {[slide.dateLabel, slide.locationTitle || '']
                                .filter(Boolean)
                                .join(' • ')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {archiveSlides.length > 1 && (
                      <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center justify-center gap-2 rounded-full bg-black/35 px-2.5 py-1 backdrop-blur-sm">
                        {archiveSlides.map((slide, index) => (
                          <button
                            key={`dot-${slide.id}`}
                            type="button"
                            onClick={() => setArchiveSlideIndex(index)}
                            className={`h-2.5 w-2.5 cursor-pointer rounded-full transition ${
                              index === archiveSlideIndex
                                ? 'bg-[#00D1FF] shadow-[0_0_10px_rgba(0,209,255,0.95)]'
                                : 'bg-white/25 hover:bg-white/45'
                            }`}
                            aria-label="archive slide"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div
                  ref={archiveDropZoneRef}
                  className={`mt-8 cursor-help rounded-2xl border border-dashed bg-black/20 p-4 outline-none transition ${
                    archiveDragActive
                      ? 'archive-drop-glow border-[#00D1FF] bg-[#00D1FF]/10'
                      : 'border-white/20 hover:border-[#7A00FF]/65 hover:bg-[#7A00FF]/8'
                  }`}
                  aria-label="Зона архива для загрузки изображения"
                >
                  <p className="text-sm uppercase tracking-[0.14em] text-[#bfeeff]">
                    Оставь и ты след здесь
                  </p>
                  {archiveImage && (
                    <div className="mt-4">
                      <div className="rounded-xl border border-[#00D1FF]/35 bg-[#070014]/65 px-4 py-4">
                        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#c8f8ff]">
                          След принят
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-[#bfe6ff]">
                          Ты заметил связь там, где другие видят случайность.
                          Маршрут активирован. Город уже отвечает тебе.
                        </p>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-[#bfe6ff]">
                        Ты всегда можешь создать свою игру и задать свои
                        правила. Осталось найти лишь того, кто подскажет тебе
                        как.
                      </p>
                    </div>
                  )}

                  {archiveStatus && (
                    <p className="mt-3 text-xs uppercase tracking-[0.1em] text-[#9fd9ff]">
                      {archiveStatus}
                    </p>
                  )}
                </div>
                {sledDragGhost && (
                  <img
                    src={ARCHIVE_SLED_SRC}
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none fixed z-[9999] h-auto w-32 -translate-x-1/2 -translate-y-1/2 rotate-[-50deg] opacity-90"
                    style={{
                      left: `${sledDragGhost.x}px`,
                      top: `${sledDragGhost.y}px`,
                    }}
                  />
                )}
              </div>
            </section>

            <section className="w-full max-w-6xl px-4 mx-auto mt-12 reveal-e">
              <p className="text-xs uppercase tracking-[0.18em] text-[#00D1FF]/85">
                сценарий
              </p>
              <div className="grid items-start gap-6 mt-4 lg:grid-cols-2">
                <div className="w-full lg:max-w-lg">
                  <ScenarioCard
                    locations={scenarioLocations}
                    selectedLocation={selectedScenarioLocation}
                    onLocationChange={setSelectedScenarioLocation}
                    nearestGame={nearestScenarioGame}
                    isLoadingGame={isNearestScenarioGameLoading}
                    accessState={scenarioAccessState}
                    onAccessClick={handleScenarioAccessClick}
                    isAccessGlitch={scenarioAccessGlitch}
                    isFallbackMode={isScenarioFallbackMode}
                    isFallbackConfirmed={isScenarioFallbackConfirmed}
                    onFallbackConfirm={handleScenarioFallbackConfirm}
                  />
                </div>

                <aside className="block">
                  <div className="relative flex h-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-[#0f0222]/35 to-[#090015]/25 p-2">
                    <img
                      src="/car_title.png"
                      alt="ActQuest car"
                      className="object-contain w-full h-full car-neon-flicker"
                    />
                  </div>
                </aside>
              </div>
            </section>

            <section className="w-full max-w-6xl px-4 mx-auto reveal-f mt-14">
              <div className="panel-breathe rounded-3xl border border-[#7A00FF]/35 bg-gradient-to-r from-[#120124] to-[#1a0033] p-8 text-center shadow-[0_0_55px_rgba(122,0,255,0.16)]">
                <p className="text-sm uppercase tracking-[0.18em] text-[#bfa0ff]/85">
                  инициализация
                </p>
                <h2 className="mt-3 text-4xl font-semibold text-white">
                  Ты уже начал
                  <br />
                  Осталось это принять
                </h2>
                {selectedKey.includes('улиц') && (
                  <p className="mt-4 text-sm uppercase tracking-[0.14em] text-[#d8c8ff]">
                    улицы — это только начало
                  </p>
                )}
                <Link
                  href="/cabinet/login?mode=register"
                  className="cta-pulse mt-8 inline-flex cursor-pointer rounded-2xl border border-[#00D1FF]/40 bg-[#00D1FF]/10 px-7 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[#baf3ff] transition hover:bg-[#00D1FF]/20"
                >
                  Начать игру
                </Link>
                {projectChatUrl ? (
                  <div className="mt-4">
                    <a
                      href={projectChatUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex cursor-pointer rounded-xl border border-[#7A00FF]/45 bg-[#7A00FF]/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#d9c7ff] transition hover:bg-[#7A00FF]/20"
                    >
                      Чат проекта
                    </a>
                  </div>
                ) : null}
              </div>
            </section>
          </main>
        )}
      </div>

      <style jsx>{`
        .main-enter {
          animation: mainAppear 0.45s ease-out;
        }

        .reveal-a,
        .reveal-b,
        .reveal-c,
        .reveal-d,
        .reveal-e,
        .reveal-f {
          opacity: 0;
          transform: translateY(10px);
          animation: sectionReveal 0.65s ease-out forwards;
        }

        .reveal-a {
          animation-delay: 80ms;
        }
        .reveal-b {
          animation-delay: 130ms;
        }
        .reveal-c {
          animation-delay: 180ms;
        }
        .reveal-d {
          animation-delay: 230ms;
        }
        .reveal-e {
          animation-delay: 280ms;
        }
        .reveal-f {
          animation-delay: 330ms;
        }

        .logo-float {
          animation: logoFloat 6.5s ease-in-out infinite;
          will-change: transform;
        }

        .panel-breathe {
          animation: panelBreathe 4.5s ease-in-out infinite;
        }

        .cta-pulse {
          animation: ctaPulse 2.8s ease-in-out infinite;
        }

        .car-neon-flicker {
          animation: carNeonFlicker 3.6s ease-in-out infinite;
        }

        .car-neon-shimmer {
          background:
            radial-gradient(
              circle at 22% 32%,
              rgba(0, 209, 255, 0.18),
              transparent 34%
            ),
            radial-gradient(
              circle at 76% 60%,
              rgba(122, 0, 255, 0.22),
              transparent 38%
            ),
            linear-gradient(
              118deg,
              transparent 0%,
              rgba(255, 255, 255, 0.08) 44%,
              rgba(0, 209, 255, 0.14) 50%,
              rgba(122, 0, 255, 0.12) 56%,
              transparent 100%
            );
          mix-blend-mode: screen;
          opacity: 0.22;
          transform: translateX(-18%);
          animation: carNeonShimmer 5.2s ease-in-out infinite;
        }

        .animate-fade-in {
          animation: fadeIn 0.5s ease;
        }

        .animate-glitch {
          animation: glitch 0.33s linear;
        }

        .bg-orb {
          will-change: transform;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          animation-direction: alternate;
        }

        .bg-orb-1 {
          animation-name: orbFloatOne;
          animation-duration: 13s;
        }

        .bg-orb-2 {
          animation-name: orbFloatTwo;
          animation-duration: 16s;
        }

        .bg-orb-3 {
          animation-name: orbFloatThree;
          animation-duration: 18s;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes mainAppear {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes sectionReveal {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes logoFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }

        @keyframes panelBreathe {
          0%,
          100% {
            box-shadow:
              0 0 0 1px rgba(255, 255, 255, 0.12),
              0 0 0 rgba(0, 209, 255, 0);
          }
          50% {
            box-shadow:
              0 0 0 1px rgba(255, 255, 255, 0.2),
              0 0 24px rgba(0, 209, 255, 0.14);
          }
        }

        @keyframes ctaPulse {
          0%,
          100% {
            box-shadow: 0 0 0 rgba(0, 209, 255, 0);
          }
          50% {
            box-shadow: 0 0 22px rgba(0, 209, 255, 0.22);
          }
        }

        @keyframes carNeonFlicker {
          0%,
          100% {
            filter: brightness(1) saturate(1);
          }
          18% {
            filter: brightness(1.08) saturate(1.08);
          }
          32% {
            filter: brightness(0.98) saturate(0.95);
          }
          54% {
            filter: brightness(1.12) saturate(1.12);
          }
          72% {
            filter: brightness(1.02) saturate(1.02);
          }
        }

        @keyframes carNeonShimmer {
          0% {
            opacity: 0.16;
            transform: translateX(-20%);
          }
          50% {
            opacity: 0.3;
            transform: translateX(18%);
          }
          100% {
            opacity: 0.16;
            transform: translateX(-20%);
          }
        }

        @keyframes glitch {
          0% {
            filter: hue-rotate(0deg);
            transform: translateX(0);
          }
          20% {
            filter: hue-rotate(25deg);
            transform: translateX(-2px);
          }
          40% {
            filter: hue-rotate(-35deg);
            transform: translateX(2px);
          }
          60% {
            filter: hue-rotate(15deg);
            transform: translateX(-1px);
          }
          100% {
            filter: hue-rotate(0deg);
            transform: translateX(0);
          }
        }

        .archive-drop-glow {
          animation: archivePulse 0.8s ease-in-out infinite alternate;
          box-shadow:
            0 0 0 1px rgba(0, 209, 255, 0.4),
            0 0 24px rgba(0, 209, 255, 0.22);
        }

        @keyframes archivePulse {
          from {
            box-shadow:
              0 0 0 1px rgba(0, 209, 255, 0.3),
              0 0 18px rgba(0, 209, 255, 0.16);
          }
          to {
            box-shadow:
              0 0 0 1px rgba(0, 209, 255, 0.6),
              0 0 34px rgba(122, 0, 255, 0.22);
          }
        }

        @keyframes orbFloatOne {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          100% {
            transform: translate3d(18px, -14px, 0) scale(1.06);
          }
        }

        @keyframes orbFloatTwo {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          100% {
            transform: translate3d(-22px, 16px, 0) scale(1.08);
          }
        }

        @keyframes orbFloatThree {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          100% {
            transform: translate3d(14px, -12px, 0) scale(1.05);
          }
        }

        .typewriter-machine {
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            Liberation Mono,
            Courier New,
            monospace;
          letter-spacing: 0.03em;
          text-shadow: 0 0 10px rgba(255, 90, 110, 0.2);
          position: relative;
        }

        .typewriter-machine::after {
          content: '_';
          margin-left: 0.18rem;
          color: rgba(255, 208, 208, 0.95);
          animation: caretBlink 0.9s steps(1, end) infinite;
        }

        @keyframes caretBlink {
          0%,
          45% {
            opacity: 1;
          }
          46%,
          100% {
            opacity: 0;
          }
        }

        .input-glitch {
          animation: inputGlitchBurst 280ms linear 1;
        }

        .scenario-city-modal {
          animation: scenarioCityModalEnter 220ms ease-out 1;
          overflow: hidden;
          transition:
            transform 90ms linear,
            filter 90ms linear,
            box-shadow 90ms linear;
        }

        .scenario-city-modal-glitch {
          outline: 1px solid rgba(0, 209, 255, 0.55);
        }

        .scenario-city-glitch-overlay {
          position: absolute;
          inset: 0;
          border-radius: 1.5rem;
          pointer-events: none;
          z-index: 1;
          background:
            repeating-linear-gradient(
              180deg,
              rgba(0, 209, 255, 0.12) 0,
              rgba(0, 209, 255, 0.12) 2px,
              rgba(0, 0, 0, 0) 2px,
              rgba(0, 0, 0, 0) 6px
            ),
            linear-gradient(
              90deg,
              rgba(255, 70, 160, 0.16),
              rgba(0, 209, 255, 0.14)
            );
        }

        .scenario-city-glitch-bars {
          position: absolute;
          inset: 0;
          border-radius: 1.5rem;
          pointer-events: none;
          z-index: 2;
          background:
            linear-gradient(
              90deg,
              rgba(255, 0, 92, 0.14),
              rgba(0, 234, 255, 0.14)
            ),
            repeating-linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.1) 0,
              rgba(255, 255, 255, 0.1) 1px,
              rgba(0, 0, 0, 0) 1px,
              rgba(0, 0, 0, 0) 7px
            );
        }

        .scenario-access-glitch {
          animation: scenarioAccessGlitch 450ms linear 1;
        }

        .archive-reality-glitch {
          animation: archiveRealityGlitch 280ms linear 1;
        }

        @keyframes inputGlitchBurst {
          0% {
            transform: translateX(0);
            filter: hue-rotate(0deg);
          }
          20% {
            transform: translateX(-3px);
            filter: hue-rotate(22deg);
          }
          40% {
            transform: translateX(3px);
            filter: hue-rotate(-20deg);
          }
          60% {
            transform: translateX(-2px);
            filter: hue-rotate(15deg);
          }
          100% {
            transform: translateX(0);
            filter: hue-rotate(0deg);
          }
        }

        @keyframes scenarioAccessGlitch {
          0% {
            transform: translateX(0);
            filter: hue-rotate(0deg) brightness(1);
          }
          20% {
            transform: translateX(-2px);
            filter: hue-rotate(20deg) brightness(1.25);
          }
          45% {
            transform: translateX(2px);
            filter: hue-rotate(-24deg) brightness(1.35);
          }
          70% {
            transform: translateX(-1px);
            filter: hue-rotate(8deg) brightness(1.15);
          }
          100% {
            transform: translateX(0);
            filter: hue-rotate(0deg) brightness(1);
          }
        }

        @keyframes archiveRealityGlitch {
          0% {
            transform: translateX(0);
            filter: hue-rotate(0deg) brightness(1);
          }
          25% {
            transform: translateX(-2px);
            filter: hue-rotate(18deg) brightness(1.22);
          }
          55% {
            transform: translateX(2px);
            filter: hue-rotate(-24deg) brightness(1.28);
          }
          100% {
            transform: translateX(0);
            filter: hue-rotate(0deg) brightness(1);
          }
        }

        @keyframes scenarioCityModalEnter {
          0% {
            opacity: 0;
            transform: scale(0.97) translateY(6px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </>
  )
}

export default Index2Page
