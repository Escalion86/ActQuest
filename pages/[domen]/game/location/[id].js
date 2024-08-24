import { getData } from '@helpers/CRUD'
// import { getSession } from 'next-auth/react'
import Head from 'next/head'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import getSecondsBetween from '@helpers/getSecondsBetween'
// import Image from 'next/image'
import cn from 'classnames'

import {
  YMaps,
  Map,
  Placemark,
  FullscreenControl,
  ZoomControl,
} from '@pbe/react-yandex-maps'
import { useRef } from 'react'

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

const GameMap = ({ usersWithLocation }) => {
  const [index, setIndex] = useState(0)
  const ref = useRef()
  const defaultState = {
    center: [56.039911, 92.878677],
    zoom: 5,
  }

  useEffect(() => ref?.current?.enterFullscreen(), [ref?.current])

  console.log('usersWithLocation :>> ', usersWithLocation)

  return (
    <div className="w-screen h-screen">
      <button onClick={() => setIndex(index + 1)}>{islands[index]}</button>
      <YMaps ref={ref} width="100%" height="100%">
        <Map defaultState={defaultState}>
          {usersWithLocation.map(({ name, team, location }) => {
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
                  preset: islands[index], //'islands#greenDotIconWithCaption',
                  iconColor: '#aeca3b',
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

function EventPage(props) {
  const gameId = props.id
  const domen = props.domen

  const [result, setResult] = useState()

  const usersWithLocation = result?.users
    ? result.users.filter(({ location }) => location)
    : []

  useEffect(() => {
    const getGameData = async (gameId) => {
      const result = await getData('/api/usersingame/' + domen + '/' + gameId)
      if (!result) return

      setResult(result.data)
    }
    if (gameId) {
      getGameData(gameId)
    }
  }, [])

  return (
    <>
      <Head>
        <title>{`ActQuest - Расположение команд`}</title>
      </Head>
      {/* <StateLoader {...props}>
        <Header /> */}
      {result && <GameMap {...result} usersWithLocation={usersWithLocation} />}
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
