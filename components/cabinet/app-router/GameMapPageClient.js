'use client'

import Link from 'next/link'
import PropTypes from 'prop-types'
import { useEffect, useRef, useState } from 'react'

const YMAPS_SCRIPT_ID = 'yandex-maps-2-script'
const YMAPS_SCRIPT_SRC = 'https://api-maps.yandex.ru/2.1/?lang=ru_RU'

const loadYMapsScript = () =>
  new Promise((resolve, reject) => {
    if (window.ymaps) {
      resolve(window.ymaps)
      return
    }

    const handleLoad = () => resolve(window.ymaps)
    const handleError = () => reject(new Error('Не удалось загрузить Yandex Maps'))
    const existingScript = document.getElementById(YMAPS_SCRIPT_ID)

    if (existingScript) {
      existingScript.addEventListener('load', handleLoad, { once: true })
      existingScript.addEventListener('error', handleError, { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = YMAPS_SCRIPT_ID
    script.src = YMAPS_SCRIPT_SRC
    script.async = true
    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })
    document.body.appendChild(script)
  })

const waitForYMapsReady = (ymaps) =>
  new Promise((resolve) => ymaps.ready(resolve))

const EARTH_RADIUS_KM = 6371.0088

const toRadians = (degrees) => (degrees * Math.PI) / 180

const getDistanceKm = (from, to) => {
  const latitudeDelta = toRadians(to.latitude - from.latitude)
  const longitudeDelta = toRadians(to.longitude - from.longitude)
  const fromLatitude = toRadians(from.latitude)
  const toLatitude = toRadians(to.latitude)
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2

  return (
    2 *
    EARTH_RADIUS_KM *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  )
}

const getBearing = (from, to) => {
  const fromLatitude = toRadians(from.latitude)
  const toLatitude = toRadians(to.latitude)
  const longitudeDelta = toRadians(to.longitude - from.longitude)
  const x = Math.sin(longitudeDelta) * Math.cos(toLatitude)
  const y =
    Math.cos(fromLatitude) * Math.sin(toLatitude) -
    Math.sin(fromLatitude) *
      Math.cos(toLatitude) *
      Math.cos(longitudeDelta)

  return (Math.atan2(x, y) * 180) / Math.PI - 90
}

const getSegmentCenter = (from, to) => [
  (from.latitude + to.latitude) / 2,
  (from.longitude + to.longitude) / 2,
]

const formatDistanceKm = (distanceKm) => {
  if (distanceKm < 0.1) return `${distanceKm.toFixed(2)} км`
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} км`
  return `${Math.round(distanceKm)} км`
}

const getLinearSegments = (tasks) =>
  tasks.flatMap((task, index) => {
    const nextTask = tasks[index + 1]
    if (!nextTask || nextTask.number !== task.number + 1) return []

    const distanceKm = getDistanceKm(task, nextTask)
    if (distanceKm < 0.001) return []

    return [
      {
        from: task,
        to: nextTask,
        center: getSegmentCenter(task, nextTask),
        distanceLabel: formatDistanceKm(distanceKm),
        rotation: getBearing(task, nextTask).toFixed(1),
      },
    ]
  })

const getTotalDistanceKm = (tasks) =>
  tasks.reduce((totalDistance, task, index) => {
    if (index === 0) return totalDistance
    return totalDistance + getDistanceKm(tasks[index - 1], task)
  }, 0)

export default function GameMapPageClient({ game }) {
  const containerRef = useRef(null)
  const [loadError, setLoadError] = useState('')
  const totalDistanceLabel =
    game.taskDistributionMode === 'linear' && game.hasAllTaskCoordinates
      ? formatDistanceKm(getTotalDistanceKm(game.tasks))
      : null

  useEffect(() => {
    let active = true
    let map = null

    const setupMap = async () => {
      const ymaps = await loadYMapsScript()
      await waitForYMapsReady(ymaps)

      if (!active || !containerRef.current) return

      map = new ymaps.Map(
        containerRef.current,
        {
          center: game.center,
          zoom: 12,
          controls: ['zoomControl', 'fullscreenControl'],
        },
        { suppressMapOpenBlock: true },
      )

      if (game.taskDistributionMode === 'linear') {
        const directionLayout = ymaps.templateLayoutFactory.createClass(
          '<div style="position:relative;width:26px;height:26px;transform:translate(-50%,-50%);white-space:nowrap;pointer-events:none">' +
            '<span aria-hidden="true" style="display:inline-flex;height:26px;width:26px;align-items:center;justify-content:center;border:2px solid #fff;border-radius:9999px;background:#0891b2;color:#fff;font-size:20px;font-weight:800;line-height:1;box-shadow:0 2px 8px rgba(15,23,42,.35);transform:rotate({{ properties.rotation }}deg)">&#10140;</span>' +
            '<span style="position:absolute;left:30px;top:50%;transform:translateY(-50%);border:1px solid rgba(8,145,178,.55);border-radius:9999px;background:rgba(255,255,255,.94);padding:3px 7px;color:#0f172a;font:600 12px/1.2 Arial,sans-serif;box-shadow:0 2px 8px rgba(15,23,42,.25)">{{ properties.distanceLabel }}</span>' +
            '</div>',
        )

        getLinearSegments(game.tasks).forEach((segment) => {
          const fromPoint = [segment.from.latitude, segment.from.longitude]
          const toPoint = [segment.to.latitude, segment.to.longitude]
          const hintContent = `№${segment.from.number} → №${segment.to.number} · ${segment.distanceLabel}`

          map.geoObjects.add(
            new ymaps.Polyline(
              [fromPoint, toPoint],
              { hintContent },
              {
                strokeColor: '#0891b2',
                strokeOpacity: 0.82,
                strokeWidth: 4,
                zIndex: 120,
              },
            ),
          )
          map.geoObjects.add(
            new ymaps.Placemark(
              segment.center,
              {
                distanceLabel: segment.distanceLabel,
                rotation: segment.rotation,
              },
              {
                iconLayout: directionLayout,
                iconShape: {
                  type: 'Rectangle',
                  coordinates: [
                    [-48, -16],
                    [48, 16],
                  ],
                },
                interactiveZIndex: false,
                zIndex: 220,
              },
            ),
          )
        })
      }

      game.tasks.forEach((task) => {
        const point = [task.latitude, task.longitude]
        const placemark = new ymaps.Placemark(
          point,
          {
            iconCaption: `№${task.number} ${task.title}`,
            balloonContentHeader: `Задание №${task.number}`,
            balloonContentBody: task.title,
          },
          { preset: 'islands#blueCircleDotIcon' },
        )

        map.geoObjects.add(placemark)

        if (task.radius > 0) {
          map.geoObjects.add(
            new ymaps.Circle(
              [point, task.radius],
              {},
              {
                fillColor: '#00d1ff22',
                strokeColor: '#0284c7',
                strokeOpacity: 0.8,
                strokeWidth: 2,
              },
            ),
          )
        }
      })

      if (game.tasks.length > 1) {
        map.setBounds(map.geoObjects.getBounds(), {
          checkZoomRange: true,
          zoomMargin: 48,
        })
      } else if (game.tasks.length === 1) {
        map.setCenter([game.tasks[0].latitude, game.tasks[0].longitude], 15)
      }
    }

    setupMap().catch((error) => {
      console.error('Failed to initialize admin game map', error)
      if (active) setLoadError('Не удалось загрузить карту. Попробуйте обновить страницу.')
    })

    return () => {
      active = false
      map?.destroy()
    }
  }, [game])

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">Карта заданий: {game.name}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
            <p>Отмечено заданий: {game.tasks.length}</p>
            {totalDistanceLabel ? (
              <p>
                Суммарная дистанция:{' '}
                <span className="font-medium text-slate-200">
                  {totalDistanceLabel}
                </span>
              </p>
            ) : null}
          </div>
        </div>
        <Link
          href="/cabinet/games"
          className="rounded-lg border border-cyan-400/50 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-400/10"
        >
          Вернуться к играм
        </Link>
      </header>

      <div className="relative min-h-[520px] flex-1">
        {loadError ? (
          <div className="flex h-full min-h-[520px] items-center justify-center p-6 text-center text-rose-200">
            {loadError}
          </div>
        ) : (
          <div ref={containerRef} className="absolute inset-0" />
        )}
      </div>
    </main>
  )
}

GameMapPageClient.propTypes = {
  game: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    taskDistributionMode: PropTypes.oneOf(['linear', 'random']).isRequired,
    hasAllTaskCoordinates: PropTypes.bool.isRequired,
    center: PropTypes.arrayOf(PropTypes.number).isRequired,
    tasks: PropTypes.arrayOf(
      PropTypes.shape({
        number: PropTypes.number.isRequired,
        title: PropTypes.string.isRequired,
        latitude: PropTypes.number.isRequired,
        longitude: PropTypes.number.isRequired,
        radius: PropTypes.number.isRequired,
      }),
    ).isRequired,
  }).isRequired,
}
