import { getData } from '@helpers/CRUD'
// import { getSession } from 'next-auth/react'
import Head from 'next/head'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import getSecondsBetween from '@helpers/getSecondsBetween'
// import Image from 'next/image'
import cn from 'classnames'

import { YMaps, Map, Placemark } from '@pbe/react-yandex-maps'

const GameMap = () => {
  const defaultState = {
    center: [55.751574, 37.573856],
    zoom: 5,
  }

  return (
    <YMaps>
      <Map defaultState={defaultState}>
        <Placemark geometry={[55.684758, 37.738521]} />
      </Map>
    </YMaps>
  )
}

function EventPage(props) {
  const gameId = props.id
  const domen = props.domen

  const [game, setGame] = useState()
  const [gameTeams, setGameTeams] = useState()
  const [teams, setTeams] = useState()
  const [users, setUsers] = useState()

  useEffect(() => {
    const getGame = async (gameId) => {
      const game = await getData('/api/games/' + domen + '/' + gameId)
      if (!game) return
      const gameTeams = await getData(
        '/api/gamesteams/' + domen + '/' + gameId,
        { gameId }
      )
      const teamsIDs = gameTeams.map((gameTeam) => gameTeam.teamId)
      setGame(game.data)
      setGameTeams(gameTeams)
    }
    if (gameId) {
      getGame(gameId)
    }
  }, [])

  return (
    <>
      <Head>
        <title>{`ActQuest - Расположение команд`}</title>
      </Head>
      {/* <StateLoader {...props}>
        <Header /> */}
      {game && <GameMap game={game} />}
      {/* </StateLoader> */}
    </>
  )
}

export default EventPage

export const getServerSideProps = async (context) => {
  // const session = await getSession({ req: context.req })

  const { params } = context
  const { id } = params

  // const fetchedProps = await fetchProps(session?.user)

  return {
    props: {
      // ...fetchedProps,
      id,
      // loggedUser: session?.user ?? null,
    },
  }
}