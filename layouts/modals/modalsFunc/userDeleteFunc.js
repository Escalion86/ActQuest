import React, { useEffect } from 'react'
import { useRecoilValue } from 'recoil'

import FormWrapper from '@components/FormWrapper'
import itemsFuncAtom from '@state/atoms/itemsFuncAtom'

const userDeleteFunc = (userId) => {
  const UserDeleteModal = ({
    closeModal,
    setOnConfirmFunc,
    setOnDeclineFunc,
    setOnShowOnCloseConfirmDialog,
    setDisableConfirm,
    setDisableDecline,
  }) => {
    // const modalsFunc = useRecoilValue(modalsFuncAtom)
    const itemsFunc = useRecoilValue(itemsFuncAtom)
    // const isLoggedUserAdmin = useRecoilValue(isLoggedUserAdminSelector)
    // const isLoggedUserDev = useRecoilValue(isLoggedUserDevSelector)
    // const isLoggedUserMember = useRecoilValue(isLoggedUserMemberSelector)

    // const user = useRecoilValue(userSelector(userId))

    // console.log('isUserHaveActions', isUserHaveActions)

    const onClickConfirm = async () => {
      closeModal()
      itemsFunc.user.delete(userId)
    }

    useEffect(() => {
      setOnConfirmFunc(onClickConfirm)
    }, [])

    return (
      <FormWrapper flex className="flex-col">
        <div className="px-2 tablet:px-3">
          Вы уверены, что хотите удалить пользователя?
        </div>

        {/* <UserName user={user} className="text-lg font-bold" /> */}
      </FormWrapper>
    )
  }

  return {
    title: 'Удаление пользователя',
    declineButtonName: 'Закрыть',
    confirmButtonName: 'Удалить',
    showConfirm: true,
    Children: UserDeleteModal,
  }
}

export default userDeleteFunc
