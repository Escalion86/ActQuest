import CabinetRegisterPage, { getServerSideProps as getRegisterServerSideProps } from './register'

export async function getServerSideProps(context) {
  const nextQuery = {
    ...(context?.query || {}),
    intent: 'recovery',
  }

  return getRegisterServerSideProps({
    ...context,
    query: nextQuery,
  })
}

export default CabinetRegisterPage
