import { getData } from '@helpers/CRUD'
// import { getSession } from 'next-auth/react'
import Head from 'next/head'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import getSecondsBetween from '@helpers/getSecondsBetween'
// import Image from 'next/image'
import cn from 'classnames'

import { YMaps, Map, Placemark } from '@pbe/react-yandex-maps'

const GameMap = ({ usersWithLocation }) => {
  const defaultState = {
    center: [56.039911, 92.878677],
    zoom: 5,
  }

  return (
    <YMaps className="w-screen h-screen">
      <Map defaultState={defaultState}>
        {usersWithLocation.map(({ name, team, location }) => (
          <Placemark
            geometry={[location.latitude, location.longitude]}
            properties={{
              balloonContent: () => (
                <span onClick={() => console.log(location)}>{name}</span>
              ),
              iconCaption: team.name,
            }}
            options={{
              preset: 'islands#greenDotIconWithCaption',
              iconColor: '#aeca3b',
              controls: [],
            }}
          />
        ))}
      </Map>
    </YMaps>
  )
}

function EventPage(props) {
  const gameId = props.id
  const domen = props.domen

  const [result, setResult] = useState()

  const usersWithLocation = result?.users
    ? result.users.filter(({ location }) => location)
    : []
  console.log('usersWithLocation :>> ', usersWithLocation)

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
