// import { getSession } from 'next-auth/react'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'

import { useEffect } from 'react'
import loggedUserAtom from '@state/atoms/loggedUserAtom'
import usersAtom from '@state/atoms/usersAtom'
import itemsFuncAtom from '@state/atoms/itemsFuncAtom'
import itemsFuncGenerator from '@state/itemsFuncGenerator'
import LoadingSpinner from '@components/LoadingSpinner'
import userEditSelector from '@state/selectors/userEditSelector'
import userDeleteSelector from '@state/selectors/userDeleteSelector'
import setLoadingSelector from '@state/selectors/setLoadingSelector'
import setNotLoadingSelector from '@state/selectors/setNotLoadingSelector'
import setErrorSelector from '@state/selectors/setErrorSelector'
import setNotErrorSelector from '@state/selectors/setNotErrorSelector'
import { modalsFuncAtom } from '@state/atoms'
import loggedUserActiveRoleAtom from '@state/atoms/loggedUserActiveRoleAtom'
import loggedUserActiveStatusAtom from '@state/atoms/loggedUserActiveStatusAtom'
import isSiteLoadingAtom from '@state/atoms/isSiteLoadingAtom'
import ModalsPortal from '@layouts/modals/ModalsPortal'
import DeviceCheck from './DeviceCheck'
import cn from 'classnames'
import useSnackbar from '@helpers/useSnackbar'
import windowDimensionsAtom from '@state/atoms/windowDimensionsAtom'
import { useMemo } from 'react'
import addModalSelector from '@state/selectors/addModalSelector'
import addErrorModalSelector from '@state/selectors/addErrorModalSelector'
// import snackbarAtom from '@state/atoms/snackbarAtom'
import { useRouter } from 'next/router'
import modalsFuncGenerator from '@layouts/modals/modalsFuncGenerator'
import isBrowserNeedToBeUpdate from '@helpers/browserCheck'
import { postData } from '@helpers/CRUD'
import browserVer from '@helpers/browserVer'
import modeAtom from '@state/atoms/modeAtom'
import TopInfo from './TopInfo'

const StateLoader = (props) => {
  if (props.error && Object.keys(props.error).length > 0)
    console.log('props.error', props.error)

  const snackbar = useSnackbar()

  const router = useRouter()

  const [modalsFunc, setModalsFunc] = useRecoilState(modalsFuncAtom)

  const [isSiteLoading, setIsSiteLoading] = useRecoilState(isSiteLoadingAtom)

  const [mode, setMode] = useRecoilState(modeAtom)

  const [loggedUser, setLoggedUser] = useRecoilState(loggedUserAtom)
  const [loggedUserActiveRole, setLoggedUserActiveRole] = useRecoilState(
    loggedUserActiveRoleAtom
  )
  const [loggedUserActiveStatus, setLoggedUserActiveStatus] = useRecoilState(
    loggedUserActiveStatusAtom
  )

  const setUsersState = useSetRecoilState(usersAtom)
  const setUser = useSetRecoilState(userEditSelector)
  const deleteUser = useSetRecoilState(userDeleteSelector)

  const setItemsFunc = useSetRecoilState(itemsFuncAtom)
  const setLoadingCard = useSetRecoilState(setLoadingSelector)
  const setNotLoadingCard = useSetRecoilState(setNotLoadingSelector)
  const setErrorCard = useSetRecoilState(setErrorSelector)
  const setNotErrorCard = useSetRecoilState(setNotErrorSelector)
  const setWindowDimensions = useSetRecoilState(windowDimensionsAtom)

  const addModal = useSetRecoilState(addModalSelector)
  const addErrorModal = useSetRecoilState(addErrorModalSelector)

  const itemsFunc = useMemo(
    () =>
      itemsFuncGenerator({
        setLoading: setIsSiteLoading,
        addErrorModal,
        setLoadingCard,
        setNotLoadingCard,
        setErrorCard,
        setNotErrorCard,
        setUser,
        deleteUser,
        snackbar,
        loggedUser,
      }),
    []
  )

  useEffect(() => {
    setModalsFunc(modalsFuncGenerator(addModal, itemsFunc, router, loggedUser))
  }, [loggedUser])

  useEffect(() => {
    function handleResize() {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    setItemsFunc(itemsFunc)

    if (!loggedUserActiveRole || props.loggedUser?.role !== loggedUser?.role)
      setLoggedUserActiveRole(props.loggedUser?.role ?? 'client')
    if (!loggedUserActiveStatus || props.loggedUser?.role !== 'dev')
      setLoggedUserActiveStatus(props.loggedUser?.status ?? 'novice')
    setLoggedUser(props.loggedUser)
    setUsersState(props.users)
    setMode(props.mode ?? 'production')
    // setSnackbar(snackbar)
    setIsSiteLoading(false)
  }, [])

  useEffect(() => {
    if (props.isCabinet && !isSiteLoading) {
      const url = isBrowserNeedToBeUpdate()
      if (url) modalsFunc.browserUpdate(url)
    }
  }, [props.isCabinet, isSiteLoading])

  useEffect(() => {
    if (loggedUser) {
      postData(
        `/api/loginhistory`,
        {
          userId: loggedUser._id,
          browser: browserVer(true),
        },
        null,
        null,
        false,
        null,
        true
      )
    }
  }, [loggedUser])

  return (
    <div className={cn('relative', props.className)}>
      {isSiteLoading ? (
        <div className="w-full h-screen">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="relative w-full bg-white">
          {mode === 'development' && <TopInfo />}
          <DeviceCheck right />
          {props.children}
        </div>
      )}
      <ModalsPortal />
    </div>
  )
}

export default StateLoader
