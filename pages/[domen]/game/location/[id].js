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
]

const GameMap = ({ defaultMapState, usersWithLocation, teamsColors, game }) => {
  const [index, setIndex] = useState(0)
  const ref = useRef()
  const defaultState = {
    center: defaultMapState,
    zoom: 12,
  }
  const { tasks } = game
  console.log('tasks :>> ', tasks)

  // var dateNow = new Date()

  useEffect(() => ref?.current?.enterFullscreen(), [ref?.current])

  return (
    <div className="w-screen h-screen">
      {/* <button onClick={() => setIndex(index + 1)}>{islands[index]}</button> */}
      <YMaps ref={ref} width="100%" height="100%">
        <Map defaultState={defaultState}>
          {tasks.map(({ coordinates }) => {
            const longitude = coordinates?.longitude
            const latitude = coordinates?.latitude
            const radius = coordinates?.radius
            if (!longitude || !latitude) return null
            return <Circle geometry={[[latitude, longitude], radius || 1000]} />
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
    </div>
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

  return (
    <>
      <Head>
        <title>{`ActQuest - Расположение команд`}</title>
      </Head>
      {/* <StateLoader {...props}>
        <Header /> */}
      {result && (
        <GameMap
          {...result}
          usersWithLocation={usersWithLocation}
          teamsColors={teamsColors}
          defaultMapState={defaultMapState}
          game={game}
        />
      )}
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
