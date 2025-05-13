import { getData } from '@helpers/CRUD'
import fetchGameTeamByGameIdAndTeamId from '@server/fetchGameTeamByGameIdAndTeamId'
import Head from 'next/head'
import { useEffect, useState } from 'react'

function MapPage(props) {
  // const gameId = props.id
  // const teamId = props.teamId
  // const location = props.location
  const imageUrl = props.imageUrl
  const error = props.error

  return (
    <>
      <Head>
        <title>{`ActQuest - Игра`}</title>
      </Head>
      {/* <StateLoader {...props}>
        <Header /> */}
      {imageUrl ? (
        <img src={imageUrl} alt="map" />
      ) : error ? (
        'Ошибка!!!'
      ) : (
        'Вы не нашли ни одного кусочка карты'
      )}
      {/* {game && <GameBlock game={game} />} */}
      {/* </StateLoader> */}
    </>
  )
}

export default MapPage

export const getServerSideProps = async (context) => {
  // const session = await getSession({ req: context.req })

  const { params } = context
  const { id, location, teamId } = params

  const gameTeam = await fetchGameTeamByGameIdAndTeamId(location, id, teamId)
  // console.log('gameTeam :>> ', gameTeam)
  let findedBonusCodes = 0
  if (gameTeam && gameTeam[0]?.findedBonusCodes?.length > 0) {
    for (const bonusCodes of gameTeam[0].findedBonusCodes) {
      console.log('bonusCodes :>> ', bonusCodes)
      if (bonusCodes !== null && typeof bonusCodes === 'object') {
        if (
          bonusCodes.find((code) =>
            ['101', '177', '814', '001', '318', '228', '119'].includes(code)
          )
        ) {
          findedBonusCodes++
        }
      }
    }
  }
  if (!gameTeam) {
    return {
      props: {
        // ...fetchedProps,
        id,
        location,
        teamId,
        imageUrl: '',
        error: 'error',
        // loggedUser: session?.user ?? null,
      },
    }
  }
  const imageFileName =
    findedBonusCodes === 0 || !findedBonusCodes
      ? null
      : findedBonusCodes === 1
      ? '1rshjgfjs'
      : findedBonusCodes === 2
      ? '2voiejfn'
      : findedBonusCodes === 3
      ? '3rkvopise'
      : findedBonusCodes === 4
      ? '4qlciepsd'
      : findedBonusCodes === 5
      ? '5alcutpd'
      : findedBonusCodes === 6
      ? '6bkdlrw'
      : findedBonusCodes === 7
      ? '7lltislw'
      : '8bkblhep'

  return {
    props: {
      // ...fetchedProps,
      id,
      location,
      teamId,
      imageUrl: imageFileName
        ? 'https://actquest.ru/img/map/' + imageFileName + '.png'
        : '',
      // loggedUser: session?.user ?? null,
    },
  }
}
