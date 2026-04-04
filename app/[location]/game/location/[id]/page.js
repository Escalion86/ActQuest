'use client'

import { getData } from '@helpers/CRUD'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PASTEL_COLORS } from '@helpers/constants'
import getSecondsBetween from '@helpers/getSecondsBetween'
import cn from 'classnames'
import NeonCheckbox from '@components/NeonCheckbox'

const townsCenter = {
  krsk: [56.012083, 92.871295],
  nrsk: [69.408366, 88.080232],
  ekb: [56.839425, 60.611462],
}

const islands = [
  'islands#blueIcon',
  'islands#darkGreenIcon',
  'islands#blueStretchyIcon',
  'islands#darkGreenStretchyIcon',
  'islands#blueDotIcon',
  'islands#darkGreenDotIcon',
  'islands#blueCircleIcon',
  'islands#darkGreenCircleIcon',
  'islands#blueCircleDotIcon',
  'islands#darkGreenCircleDotIcon',
  'islands#blueAirportIcon',
  'islands#blueAttentionIcon',
  'islands#blueHomeCircleIcon',
  'islands#blueScienceCircleIcon',
  'islands#geolocationIcon',
  'islands#blueClusterIcons',
  'islands#invertedBlueClusterIcons',
  'islands#violetClusterIcons',
]

const YMAPS_SCRIPT_ID = 'yandex-maps-2-script'
const YMAPS_SCRIPT_SRC = 'https://api-maps.yandex.ru/2.1/?lang=ru_RU'

const loadYMapsScript = () =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Yandex Maps доступен только в браузере'))
      return
    }

    if (window.ymaps) {
      resolve(window.ymaps)
      return
    }

    const existingScript = document.getElementById(YMAPS_SCRIPT_ID)
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.ymaps))
      existingScript.addEventListener('error', () =>
        reject(new Error('Не удалось загрузить Yandex Maps')),
      )
      return
    }

    const script = document.createElement('script')
    script.id = YMAPS_SCRIPT_ID
    script.src = YMAPS_SCRIPT_SRC
    script.async = true
    script.onload = () => resolve(window.ymaps)
    script.onerror = () =>
      reject(new Error('Не удалось загрузить Yandex Maps'))
    document.body.appendChild(script)
  })

const GameMap = ({
  defaultMapState,
  usersWithLocation,
  teamsColors,
  game,
  showTasks,
  showTeams,
}) => {
  const index = 0
  const [info, setInfo] = useState(null)
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const ymapsRef = useRef(null)
  const tasks = game?.tasks

  useEffect(() => {
    let active = true

    const setupMap = async () => {
      if (!mapContainerRef.current) return
      const ymaps = await loadYMapsScript()
      if (!active || !ymaps) return

      ymaps.ready(() => {
        if (!active || mapRef.current || !mapContainerRef.current) return

        ymapsRef.current = ymaps
        mapRef.current = new ymaps.Map(
          mapContainerRef.current,
          {
            center: defaultMapState,
            zoom: 12,
            controls: [],
          },
          { suppressMapOpenBlock: true },
        )

        mapRef.current.controls.add(
          new ymaps.control.FullscreenControl({ float: 'right' }),
        )
        mapRef.current.controls.add(
          new ymaps.control.ZoomControl({ size: 'large', float: 'right' }),
        )
        mapRef.current.events.add('click', () => setInfo(null))
      })
    }

    setupMap().catch((error) => {
      console.error('Failed to initialize Yandex map', error)
    })

    return () => {
      active = false
      if (mapRef.current) {
        mapRef.current.destroy()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const ymaps = ymapsRef.current
    if (!map || !ymaps || !game) return

    map.geoObjects.removeAll()
    map.setCenter(defaultMapState)

    if (showTasks && Array.isArray(tasks)) {
      tasks.forEach(({ coordinates, title }, taskIndex) => {
        const longitude = coordinates?.longitude
        const latitude = coordinates?.latitude
        const radius = coordinates?.radius
        if (!longitude || !latitude) return

        const circle = new ymaps.Circle(
          [[latitude, longitude], radius || 5],
          {},
          { fillOpacity: 0.12, strokeWidth: 2 },
        )
        map.geoObjects.add(circle)

        const placemark = new ymaps.Placemark(
          [latitude, longitude],
          {
            iconCaption: `№${taskIndex + 1} "${title}"`,
          },
          {
            preset: 'islands#blueCircleDotIcon',
          },
        )

        placemark.events.add('click', () => {
          setInfo(
            <div>
              Задание №{taskIndex + 1} - "{title}"
            </div>,
          )
        })
        map.geoObjects.add(placemark)
      })
    }

    if (showTeams) {
      usersWithLocation.forEach(({ team, location }, num) => {
        const latitude = location?.latitude
        const longitude = location?.longitude
        if (!latitude || !longitude) return

        const dataActualitySeconds = getSecondsBetween(location.date)
        const preset =
          dataActualitySeconds < 60
            ? islands[index]
            : 'islands#blueAttentionIcon'
        const iconColor =
          dataActualitySeconds < 60
            ? teamsColors?.[num]
            : dataActualitySeconds < 300
              ? 'yellow'
              : 'red'

        const placemark = new ymaps.Placemark(
          [latitude, longitude],
          {
            iconCaption: team?.name || 'Команда',
          },
          {
            preset,
            iconColor,
          },
        )
        map.geoObjects.add(placemark)
      })
    }
  }, [
    defaultMapState,
    game,
    index,
    showTasks,
    showTeams,
    tasks,
    teamsColors,
    usersWithLocation,
  ])

  if (!game) return null
  // <button onClick={() => setIndex((prev) => (prev + 1) % islands.length)}>{islands[index]}</button>

  return (
    <>
      <div
        className={cn(
          'absolute z-50 bottom-0 right-0 max-w-48 p-2 bg-gray-200 rounded-tl text-sm tablet:text-lg',
          info ? 'duration-500 h-auto' : 'duration-0 h-0'
        )}
      >
        {info}
      </div>
      <div ref={mapContainerRef} className="w-full h-full" />
    </>
  )
}

const calcMapCenter = (usersWithLocation) => {
  var minLatitude
  var maxLatitude
  var minLongitude
  var maxLongitude
  for (let i = 0; i < usersWithLocation.length; i++) {
    const { location } = usersWithLocation[i]
    const { latitude, longitude } = location
    if (!minLatitude || latitude < minLatitude) {
      minLatitude = latitude
    }
    if (!maxLatitude || latitude > maxLatitude) {
      maxLatitude = latitude
    }
    if (!minLongitude || longitude < minLongitude) {
      minLongitude = longitude
    }
    if (!maxLongitude || longitude > maxLongitude) {
      maxLongitude = longitude
    }
  }
  return [(minLatitude + maxLatitude) / 2, (minLongitude + maxLongitude) / 2]
}

function EventPage({ params }) {
  const gameId = params?.id
  const location = params?.location

  const [showTasks, setShowTasks] = useState(true)
  const [showTeams, setShowTeams] = useState(true)
  const [result, setResult] = useState()
  const [teamsColors, setTeamsColors] = useState()
  const [game, setGame] = useState()

  const usersWithLocation = result?.users
    ? result.users.filter(
        ({ location, roleInTeam }) => roleInTeam === 'capitan' && location
      )
    : []

  const defaultMapState = useMemo(
    () =>
      usersWithLocation.length > 0
        ? calcMapCenter(usersWithLocation)
        : townsCenter[location] || townsCenter['krsk'],
    [usersWithLocation, location]
  )

  useEffect(() => {
    let intervalId = null

    const getGameData = async (gameId) => {
      const result = await getData(
        '/api/' + location + '/usersingame/' + gameId
      )
      if (!result) return
      const teamsIds = result.data.teams.map(({ _id }) => _id)
      const teamsColorsToSet = {}
      for (let i = 0; i < teamsIds.length; i++) {
        teamsColorsToSet[i] = PASTEL_COLORS[i % PASTEL_COLORS.length]
      }
      setResult(result.data)
      setTeamsColors(teamsColorsToSet)
      intervalId = setInterval(async () => {
        const result = await getData(
          '/api/' + location + '/usersingame/' + gameId
        )
        if (result) setResult(result.data)
      }, 10000)
    }
    if (gameId) {
      getGameData(gameId)
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [gameId, location])

  useEffect(() => {
    const getGameEffect = async (gameId) => {
      const result = await getData('/api/' + location + '/games/' + gameId)
      setGame(result.data)
    }
    if (gameId) getGameEffect(gameId)
  }, [gameId, location])

  return (
    <>
      <div className="flex flex-col items-stretch w-screen h-screen">
        <div>
          <div className="flex items-center justify-center gap-4 px-2 py-0.5">
            <NeonCheckbox
              id="location-map-show-tasks"
              checked={showTasks}
              onChange={(event) => setShowTasks(event.target.checked)}
              label="Локации"
            />
            <NeonCheckbox
              id="location-map-show-teams"
              checked={showTeams}
              onChange={(event) => setShowTeams(event.target.checked)}
              label="Команды"
            />
          </div>
        </div>
        <div className="relative flex-1 w-full overflow-hidden">
          {result && game && (
            <GameMap
              {...result}
              usersWithLocation={usersWithLocation}
              teamsColors={teamsColors}
              defaultMapState={defaultMapState}
              game={game}
              showTasks={showTasks}
              showTeams={showTeams}
            />
          )}
        </div>
      </div>
    </>
  )
}

export default EventPage
