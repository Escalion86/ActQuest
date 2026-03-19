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

const ClassicCar = ({
  name,
  color = '#000000',
  rowHeight,
  isDarkTheme = false,
}) => (
  <div
    className="flex flex-col items-end justify-end gap-x-2"
    style={{
      height: rowHeight,
      width: 200,
    }}
  >
    <svg
      version="1.0"
      xmlns="http://www.w3.org/2000/svg"
      // width="1280.000000pt"
      // height="640.000000pt"
      width="80.000000px"
      height="40.000000px"
      viewBox="0 0 1280.000000 640.000000"
      preserveAspectRatio="xMidYMid meet"
      style={{
        filter: isDarkTheme
          ? 'brightness(0.92) saturate(0.9) drop-shadow(0 0 7px rgba(0,209,255,0.24))'
          : undefined,
      }}
    >
      <metadata>
        Created by potrace 1.15, written by Peter Selinger 2001-2017
      </metadata>
      <g
        transform="translate(0.000000,640.000000) scale(0.100000,-0.100000)"
        fill={isDarkTheme ? '#24466f' : '#000000'}
        // stroke="none"
        style={{
          filter: isDarkTheme
            ? 'brightness(0.92) saturate(0.9) drop-shadow(0 0 7px rgba(0,209,255,0.24))'
            : undefined,
        }}
      >
        <path
          fill={color}
          stroke={isDarkTheme ? '#0b1022' : '#000000'}
          strokeWidth="200"
          strokeLinecap="round"
          d="M3565 5336 c-106 -30 -101 -26 -108 -111 -4 -42 -9 -80 -12 -85 -6
-10 -246 -105 -590 -234 -448 -167 -1052 -415 -1173 -483 -78 -43 -193 -91
-250 -104 -23 -5 -98 -14 -165 -19 -67 -6 -167 -19 -222 -30 -154 -31 -340
-49 -563 -57 l-203 -6 -43 -66 c-59 -91 -60 -95 -26 -130 37 -37 38 -65 3
-150 -25 -62 -27 -78 -31 -256 l-4 -190 -38 -32 c-91 -78 -133 -209 -134 -418
0 -194 11 -396 26 -482 13 -71 14 -74 72 -122 69 -58 130 -129 158 -184 64
-126 534 -211 1384 -250 l92 -4 -6 119 c-6 142 8 256 49 383 112 352 394 622
756 722 90 26 112 28 278 28 165 0 188 -2 278 -27 201 -56 361 -152 504 -302
140 -145 222 -293 274 -492 21 -79 24 -109 23 -279 -1 -127 -6 -214 -16 -263
l-15 -73 3006 7 c1653 4 3007 8 3009 9 1 1 -8 37 -20 81 -19 67 -22 105 -22
259 -1 166 1 187 27 279 117 421 467 736 885 797 119 17 325 7 432 -21 239
-63 453 -205 601 -399 70 -92 154 -267 185 -386 24 -88 27 -119 27 -260 1
-116 -4 -181 -16 -234 -10 -41 -16 -75 -15 -76 2 -1 62 2 133 6 266 16 458 45
525 79 48 24 97 81 127 146 l24 52 -16 157 c-15 152 -15 163 4 284 63 388 50
680 -35 802 -134 193 -526 336 -1429 519 -737 149 -1322 209 -2033 210 -228 0
-226 0 -347 85 -187 131 -1045 607 -1471 815 -383 187 -788 281 -1439 332
-208 17 -1106 16 -1400 0 -121 -7 -314 -19 -430 -27 -302 -22 -286 -22 -341
10 -140 81 -187 94 -269 71z m1885 -333 c6 -37 38 -238 71 -446 32 -209 66
-422 75 -474 9 -52 15 -96 13 -97 -11 -9 -1699 29 -1951 44 -206 13 -417 36
-485 54 -98 26 -198 119 -249 231 -35 75 -36 172 -5 255 17 45 30 61 68 86 83
54 135 80 253 127 341 136 858 230 1460 267 269 16 270 16 511 18 l227 2 12
-67z m630 47 c264 -18 777 -110 1029 -186 186 -56 445 -188 756 -387 211 -134
274 -181 250 -185 -75 -12 -133 -50 -162 -106 -19 -35 -21 -136 -4 -179 l11
-27 -907 2 -906 3 -59 160 c-110 302 -298 878 -298 916 0 6 95 2 290 -11z"
        />
        <path
          d="M2633 3125 c-223 -40 -410 -141 -568 -306 -132 -138 -213 -283 -262
-467 -22 -83 -26 -119 -26 -247 -1 -169 10 -236 65 -382 87 -230 271 -436 493
-551 85 -44 178 -78 271 -98 107 -23 312 -23 419 1 392 84 699 375 802 761 23
86 26 120 27 254 1 158 -5 199 -46 330 -98 310 -355 567 -668 669 -150 50
-354 64 -507 36z m350 -301 c249 -56 457 -247 543 -499 25 -72 28 -95 28 -220
1 -153 -15 -228 -74 -345 -94 -186 -283 -337 -485 -386 -96 -24 -268 -24 -360
0 -320 84 -544 355 -562 681 -20 359 209 673 558 765 94 24 253 26 352 4z"
        />
        <path
          d="M2600 2697 c-36 -13 -85 -36 -109 -51 l-44 -28 116 -115 c81 -82 120
-114 131 -110 14 6 16 29 16 167 0 186 6 178 -110 137z"
        />
        <path
          d="M2920 2561 c0 -139 2 -162 16 -168 11 -4 50 28 130 108 l115 114 -28
22 c-34 28 -138 70 -193 79 l-40 7 0 -162z"
        />
        <path
          d="M2282 2448 c-28 -36 -92 -191 -92 -225 0 -10 34 -13 165 -13 151 0
165 1 165 18 0 15 -206 232 -221 232 -4 0 -11 -6 -17 -12z"
        />
        <path
          d="M3222 2351 c-62 -59 -112 -115 -112 -124 0 -15 17 -17 165 -17 131 0
165 3 165 13 0 40 -69 205 -95 227 -7 6 -48 -27 -123 -99z"
        />
        <path
          d="M2781 2332 c-12 -22 11 -62 34 -62 8 0 21 10 29 22 20 28 4 58 -29
58 -13 0 -29 -8 -34 -18z"
        />
        <path
          d="M2749 2161 c-32 -33 -37 -67 -14 -110 29 -57 104 -64 151 -14 53 57
9 153 -71 153 -27 0 -44 -8 -66 -29z"
        />
        <path
          d="M2570 2125 c-26 -32 13 -81 48 -59 24 16 27 45 6 61 -23 17 -39 16
-54 -2z"
        />
        <path
          d="M3006 2124 c-20 -19 -20 -38 -2 -54 23 -19 61 -8 64 18 7 44 -32 67
-62 36z"
        />
        <path
          d="M2190 1975 c0 -29 41 -140 72 -194 l31 -53 117 117 c71 71 116 123
113 131 -4 11 -40 14 -169 14 -141 0 -164 -2 -164 -15z"
        />
        <path
          d="M3110 1972 c0 -9 51 -68 114 -131 l114 -114 31 54 c30 51 71 165 71
195 0 11 -31 14 -165 14 -151 0 -165 -1 -165 -18z"
        />
        <path
          d="M2780 1901 c-7 -15 -5 -24 8 -41 32 -40 85 -4 62 41 -14 25 -56 25
-70 0z"
        />
        <path
          d="M2562 1697 c-61 -62 -112 -115 -112 -119 0 -18 208 -108 249 -108 7
0 11 54 11 164 0 140 -2 165 -16 170 -9 3 -16 6 -17 6 -1 0 -53 -51 -115 -113z"
        />
        <path
          d="M2933 1803 c-15 -6 -19 -333 -4 -333 46 0 251 88 251 108 0 9 -223
232 -230 231 -3 0 -11 -3 -17 -6z"
        />
        <path
          d="M10700 3119 c-390 -84 -696 -376 -797 -759 -31 -117 -41 -292 -24
-411 33 -227 150 -453 318 -609 267 -250 643 -344 993 -249 117 32 283 118
380 196 487 396 518 1128 67 1560 -97 93 -166 140 -290 198 -137 64 -235 86
-407 91 -120 3 -162 0 -240 -17z m445 -313 c238 -81 409 -258 486 -506 30 -96
33 -289 5 -388 -110 -400 -513 -637 -911 -536 -149 38 -313 147 -402 267 -176
238 -203 533 -71 797 34 69 60 103 138 180 77 78 111 104 181 139 129 65 207
81 364 77 109 -3 143 -7 210 -30z"
        />
        <path
          d="M10703 2700 c-54 -19 -153 -71 -153 -80 0 -3 51 -57 114 -119 80 -80
119 -112 130 -108 14 5 16 29 16 167 l0 160 -27 -1 c-16 0 -52 -9 -80 -19z"
        />
        <path
          d="M11020 2561 c0 -139 2 -162 16 -168 22 -8 247 216 234 232 -17 20
-163 84 -207 91 l-43 7 0 -162z"
        />
        <path
          d="M10366 2424 c-29 -44 -76 -165 -76 -194 0 -19 7 -20 165 -20 126 0
165 3 165 13 0 7 -51 63 -114 126 l-114 114 -26 -39z"
        />
        <path
          d="M11313 2348 c-61 -62 -109 -119 -106 -125 6 -15 333 -19 333 -4 0 45
-88 241 -108 241 -4 0 -57 -51 -119 -112z"
        />
        <path
          d="M10882 2338 c-17 -17 -15 -32 7 -52 16 -14 23 -15 41 -6 31 17 24 64
-10 68 -14 2 -31 -3 -38 -10z"
        />
        <path
          d="M10846 2159 c-68 -81 17 -194 110 -144 89 48 56 175 -46 175 -30 0
-44 -6 -64 -31z"
        />
        <path
          d="M10670 2126 c-19 -23 -8 -61 18 -64 44 -7 67 32 36 62 -19 20 -38 20
-54 2z"
        />
        <path
          d="M11106 2127 c-21 -16 -18 -45 7 -61 37 -23 77 35 41 61 -10 7 -21 13
-24 13 -3 0 -14 -6 -24 -13z"
        />
        <path
          d="M10290 1970 c0 -29 43 -141 74 -195 l28 -48 116 116 c81 81 113 120
109 131 -6 14 -29 16 -167 16 -152 0 -160 -1 -160 -20z"
        />
        <path
          d="M11207 1978 c-3 -7 47 -66 111 -130 l116 -118 27 43 c27 44 79 177
79 203 0 12 -28 14 -164 14 -122 0 -166 -3 -169 -12z"
        />
        <path
          d="M10881 1901 c-14 -25 -5 -48 20 -56 27 -9 51 13 47 44 -4 34 -51 43
-67 12z"
        />
        <path
          d="M10662 1697 c-61 -62 -112 -115 -112 -119 0 -20 201 -108 247 -108
10 0 13 34 13 164 0 140 -2 165 -16 170 -9 3 -16 6 -17 6 -1 0 -53 -51 -115
-113z"
        />
        <path
          d="M11033 1803 c-10 -3 -13 -47 -13 -169 0 -90 4 -164 8 -164 36 0 186
61 239 98 16 10 -216 242 -234 235z"
        />
      </g>
    </svg>
    <div
      className={cn(
        '-mt-0.5 text-right whitespace-nowrap',
        isDarkTheme ? 'text-cyan-100/90' : 'text-slate-900',
      )}
      style={{
        right: 70,
        fontSize: '12px',
        textAlign: 'right',
        // width: 130,
        lineHeight: '10px',
      }}
    >
      {name ?? '???'}
    </div>
  </div>
)

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

  const wheelRadius =
    resolvedSkin === 'suv' ? 6 : resolvedSkin === 'sport' ? 5.1 : 5.4
  const bodyStroke = isDarkTheme ? '#020617' : '#0f172a'
  const wheelFill = isDarkTheme ? '#020617' : '#111827'
  const wheelStroke = isDarkTheme ? '#38bdf8' : '#0f172a'
  const glassFill = isDarkTheme
    ? 'rgba(191,219,254,0.24)'
    : 'rgba(148,163,184,0.38)'

  return (
    <div
      className="flex flex-col items-end justify-end gap-x-2"
      style={{
        height: rowHeight,
        width: 200,
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="92px"
        height="46px"
        viewBox="0 0 92 46"
        preserveAspectRatio="xMidYMid meet"
        style={{
          filter: isDarkTheme
            ? 'drop-shadow(0 0 8px rgba(14,165,233,0.36))'
            : 'drop-shadow(0 1px 2px rgba(15,23,42,0.22))',
        }}
      >
        {resolvedSkin === 'sport' && (
          <>
            <rect
              x="9"
              y="20"
              width="74"
              height="11"
              rx="6"
              fill={color}
              stroke={bodyStroke}
              strokeWidth="1.3"
            />
            <path
              d="M26 20 L35 11 H57 L66 20 Z"
              fill={color}
              stroke={bodyStroke}
              strokeWidth="1.2"
            />
            <path
              d="M81 21 L86 21 L84 17 Z"
              fill={color}
              stroke={bodyStroke}
              strokeWidth="1"
            />
            <rect
              x="38"
              y="13"
              width="16"
              height="5.8"
              rx="2"
              fill={glassFill}
            />
          </>
        )}

        {resolvedSkin === 'suv' && (
          <>
            <rect
              x="11"
              y="18"
              width="70"
              height="15.5"
              rx="7"
              fill={color}
              stroke={bodyStroke}
              strokeWidth="1.5"
            />
            <rect
              x="22"
              y="8.5"
              width="36"
              height="13"
              rx="6"
              fill={color}
              stroke={bodyStroke}
              strokeWidth="1.3"
            />
            <rect
              x="24"
              y="7"
              width="32"
              height="2.2"
              rx="1.1"
              fill={isDarkTheme ? '#7dd3fc' : '#0f172a'}
              opacity="0.8"
            />
            <rect
              x="27"
              y="11"
              width="11.5"
              height="8"
              rx="2.4"
              fill={glassFill}
            />
            <rect
              x="41.5"
              y="11"
              width="13"
              height="8"
              rx="2.4"
              fill={glassFill}
            />
          </>
        )}

        {resolvedSkin === 'van' && (
          <>
            <rect
              x="8"
              y="16"
              width="77"
              height="17"
              rx="5.5"
              fill={color}
              stroke={bodyStroke}
              strokeWidth="1.5"
            />
            <rect
              x="16"
              y="9.5"
              width="46"
              height="10.5"
              rx="3.8"
              fill={color}
              stroke={bodyStroke}
              strokeWidth="1.2"
            />
            <rect x="19" y="12" width="13" height="7" rx="2" fill={glassFill} />
            <rect
              x="34"
              y="12"
              width="11.5"
              height="7"
              rx="2"
              fill={glassFill}
            />
            <rect
              x="47.5"
              y="12"
              width="11.5"
              height="7"
              rx="2"
              fill={glassFill}
            />
          </>
        )}

        <circle
          cx="28"
          cy="33.7"
          r={wheelRadius}
          fill={wheelFill}
          stroke={wheelStroke}
          strokeWidth={isDarkTheme ? '1.4' : '1.1'}
        />
        <circle
          cx="66.2"
          cy="33.7"
          r={wheelRadius}
          fill={wheelFill}
          stroke={wheelStroke}
          strokeWidth={isDarkTheme ? '1.4' : '1.1'}
        />
        <circle
          cx="28"
          cy="33.7"
          r={wheelRadius * 0.45}
          fill={isDarkTheme ? '#0ea5e9' : '#64748b'}
          opacity="0.75"
        />
        <circle
          cx="66.2"
          cy="33.7"
          r={wheelRadius * 0.45}
          fill={isDarkTheme ? '#0ea5e9' : '#64748b'}
          opacity="0.75"
        />
      </svg>

      <div
        className={cn(
          '-mt-0.5 whitespace-nowrap text-right',
          isDarkTheme ? 'text-cyan-100/90' : 'text-slate-900',
        )}
        style={{
          right: 70,
          fontSize: '12px',
          textAlign: 'right',
          lineHeight: '10px',
        }}
      >
        {name ?? '???'}
      </div>
    </div>
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

const Time = ({ start, seconds, duration }) => {
  const [time, setTime] = useState(0)
  const [interval, setIntervalState] = useState(null)

  useEffect(() => {
    if (start) {
      setIntervalState(
        setInterval(() => {
          setTime((state) => state + seconds / (duration * 10))
        }, 100),
      )
    } else {
      clearInterval(interval)
      setIntervalState(null)
      setTime(0)
    }
  }, [start, seconds])

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
                className="px-3 py-1 transition border rounded-lg outline-none border-slate-300 bg-white/90 text-slate-800 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-300 dark:border-cyan-500/35 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-500/30"
                value={String(duration)}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                <option value={0.01}>Без демонистрации</option>
                <option value={10}>Быстро</option>
                <option value={40}>Нормально</option>
                <option value={80}>Медленно</option>
              </select>
              <button
                type="button"
                className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-cyan-300 bg-cyan-50/90 px-3 py-1 font-semibold text-cyan-700 transition hover:border-cyan-500 hover:bg-cyan-100 dark:border-[#00D1FF]/45 dark:bg-[#00D1FF]/14 dark:text-[#bdf4ff] dark:shadow-[0_0_0_1px_rgba(0,209,255,0.16),0_0_14px_rgba(0,209,255,0.2)] dark:hover:bg-[#00D1FF]/24 dark:hover:text-[#e9fbff]"
                onClick={() => setStart((state) => !state)}
              >
                {start ? 'Сброс' : 'Старт'}
              </button>
            </div>
            <div className="flex items-center justify-center gap-x-2">
              <div className="text-xs tablet:text-sm">Сортировка:</div>
              <select
                className="px-3 py-1 transition border rounded-lg outline-none border-slate-300 bg-white/90 text-slate-800 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-300 dark:border-cyan-500/35 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-500/30"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
              >
                <option value="registration">По регистрации</option>
                <option value="result">По результативности</option>
              </select>
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
              duration={duration}
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
                        duration: start ? duration : 0,
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
                        ? duration
                        : (time / maxTeamTime) * duration
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
                      ? duration
                      : (timeResult / maxTeamTime) * duration
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
                      delay={duration}
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
                      duration: start ? duration : 0,
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
                    duration: start ? duration : 0,
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
