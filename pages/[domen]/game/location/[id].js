import { getData } from '@helpers/CRUD'
import Head from 'next/head'
import { useEffect, useMemo, useState } from 'react'

import {
  YMaps,
  Map,
  Placemark,
  FullscreenControl,
  ZoomControl,
  Circle,
} from '@pbe/react-yandex-maps'
import { useRef } from 'react'
import { PASTEL_COLORS } from '@helpers/constants'
import getSecondsBetween from '@helpers/getSecondsBetween'
import cn from 'classnames'

const townsCenter = {
  krsk: [56.012083, 92.871295],
  nrsk: [69.408366, 88.080232],
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

const GameMap = ({
  defaultMapState,
  usersWithLocation,
  teamsColors,
  game,
  showTasks,
}) => {
  const [index, setIndex] = useState(0)
  const [info, setInfo] = useState(null)
  const ref = useRef()
  const defaultState = {
    center: defaultMapState,
    zoom: 12,
  }
  const { tasks } = game

  // var dateNow = new Date()

  useEffect(() => ref?.current?.enterFullscreen(), [ref?.current])
  // {/* <button onClick={() => setIndex(index + 1)}>{islands[index]}</button> */}

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
      <YMaps ref={ref} width="100%" height="100%">
        <Map
          width="100%"
          height="100%"
          defaultState={defaultState}
          controls={[]}
          onClick={() => setInfo(null)}
        >
          {showTasks &&
            tasks.map(({ coordinates, title }, index) => {
              const longitude = coordinates?.longitude
              const latitude = coordinates?.latitude
              const radius = coordinates?.radius
              if (!longitude || !latitude) return null
              return (
                <>
                  <Circle geometry={[[latitude, longitude], radius || 1000]} />
                  <Placemark
                    onClick={() => {
                      console.log('1 :>> ', 1)
                      setInfo(
                        <div>
                          Задание №{index + 1} - "{title}"
                        </div>
                      )
                    }}
                    geometry={[latitude, longitude]}
                    properties={{
                      // balloonContent: () => (
                      //   <span onClick={() => console.log(location)}>
                      //     №{index + 1} "{title}"
                      //   </span>
                      // ),
                      iconCaption: `№${index + 1} "${title}"`,
                    }}
                    options={{
                      // islands#violetStretchyIcon islands#violetIcon
                      preset: 'islands#blueCircleDotIcon', //'islands#greenDotIconWithCaption',
                      // iconColor:
                      //   dataActualitySeconds < 60
                      //     ? teamsColors[num]
                      //     : dataActualitySeconds < 300
                      //     ? 'yellow'
                      //     : 'red',
                      controls: [],
                    }}
                  />
                </>
              )
            })}
          {usersWithLocation.map(({ name, team, location }, num) => {
            const dataActualitySeconds = getSecondsBetween(location.date)
            return (
              <Placemark
                geometry={[location.latitude, location.longitude]}
                properties={{
                  balloonContent: () => (
                    <span onClick={() => console.log(location)}>{name}</span>
                  ),
                  iconCaption: team.name,
                }}
                options={{
                  // islands#violetStretchyIcon islands#violetIcon
                  preset:
                    dataActualitySeconds < 60
                      ? islands[index]
                      : 'islands#blueAttentionIcon', //'islands#greenDotIconWithCaption',
                  iconColor:
                    dataActualitySeconds < 60
                      ? teamsColors[num]
                      : dataActualitySeconds < 300
                      ? 'yellow'
                      : 'red',
                  controls: [],
                }}
              />
            )
          })}
          <FullscreenControl />
          <ZoomControl options={{ size: 'large' }} />
        </Map>
      </YMaps>
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

function EventPage(props) {
  const gameId = props.id
  const domen = props.domen

  const [showTasks, setShowTasks] = useState(true)
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
        : townsCenter[domen] || townsCenter['krsk'],
    [!result?.users]
  )

  useEffect(() => {
    const getGameData = async (gameId) => {
      const result = await getData('/api/usersingame/' + domen + '/' + gameId)
      if (!result) return
      const teamsIds = result.data.teams.map(({ _id }) => _id)
      const teamsColorsToSet = {}
      for (let i = 0; i < teamsIds.length; i++) {
        teamsColorsToSet[teamsIds[i]] = PASTEL_COLORS[i] % PASTEL_COLORS.length
      }
      setResult(result.data)
      setTeamsColors(teamsColorsToSet)
      setInterval(async () => {
        const result = await getData('/api/usersingame/' + domen + '/' + gameId)
        if (result) setResult(result.data)
      }, 10000)
    }
    if (gameId) {
      getGameData(gameId)
    }
  }, [])

  useEffect(() => {
    const getGame = async (gameId) => {
      const result = await getData('/api/games/' + domen + '/' + gameId)
      setGame(result.data)
    }
    if (gameId) getGame(gameId)
  }, [])

  useEffect(() => {
    //   const copyrights = document.getElementsByClassName(
    //     'ymaps-2-1-79-copyrights-pane'
    //   )
    //   while(copyrights.length > 0){
    //     elements[0].parentNode.removeChild(copyrights[0]);
    // }

    setTimeout(
      () =>
        document
          .querySelectorAll('.ymaps-2-1-79-copyrights-pane')
          .forEach((el) => el.remove()),
      1000
    )
    // console.log('copyrights :>> ', copyrights)
    // copyrights[0].remove()
  }, [])

  return (
    <>
      <Head>
        <title>{`ActQuest - Расположение команд`}</title>
      </Head>
      {/* <StateLoader {...props}>
        <Header /> */}
      <div className="flex flex-col items-stretch w-screen h-screen">
        <div className="px-2 flex justify-center py-0.5 items-center">
          <label>
            <input
              type="checkbox"
              checked={showTasks}
              onChange={(e) => setShowTasks(e.target.checked)}
            />
            Показывать места заданий
          </label>
        </div>
        <div className="relative flex-1 w-full overflow-hidden">
          {result && (
            <GameMap
              {...result}
              usersWithLocation={usersWithLocation}
              teamsColors={teamsColors}
              defaultMapState={defaultMapState}
              game={game}
              showTasks={showTasks}
            />
          )}
        </div>
      </div>
      {/* </StateLoader> */}
    </>
  )
}

export default EventPage

export const getServerSideProps = async (context) => {
  // const session = await getSession({ req: context.req })

  const { params } = context
  const { id, domen } = params

  // const fetchedProps = await fetchProps(session?.user)

  return {
    props: {
      // ...fetchedProps,
      id,
      domen,
      // loggedUser: session?.user ?? null,
    },
  }
}
