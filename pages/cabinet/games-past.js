export async function getServerSideProps(context) {
  const { getGamesPageServerSideProps } = await import('./games')
  return getGamesPageServerSideProps(context, 'past')
}

export { default } from './games'
