export async function getServerSideProps(context) {
  const { getGamesPageServerSideProps } = await import('./games')
  return getGamesPageServerSideProps(context, 'upcoming')
}

export { default } from './games'
