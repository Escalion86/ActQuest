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

export default function GameMapPageClient({ game }) {
  const containerRef = useRef(null)
  const [loadError, setLoadError] = useState('')

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
          <p className="text-sm text-slate-400">
            Отмечено заданий: {game.tasks.length}
          </p>
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
