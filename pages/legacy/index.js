import Head from 'next/head'
import LegacyHomePage from '@components/public/LegacyHomePage'

const Home = () => {
  return (
    <>
      <Head>
        <title>ActQuest</title>
      </Head>
      <LegacyHomePage />
    </>
  )
}

export default Home
