import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@server/auth/authOptions'
import dbConnectGlobal from '@utils/dbConnectGlobal'
import { toStringId } from '@helpers/idAndDate'

const isDeveloperRole = (role) => {
  return role?.trim().toLowerCase() === 'dev'
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || !isDeveloperRole(session.user.role)) {
      return NextResponse.json(
        { error: 'Доступ запрещён: требуется роль разработчика' },
        { status: 403 },
      )
    }

    const { userId } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId не указан' }, { status: 400 })
    }

    const db = await dbConnectGlobal()
    if (!db) {
      return NextResponse.json(
        { error: 'Ошибка подключения к БД' },
        { status: 500 },
      )
    }

    // Найти целевого пользователя
    const UsersModel = db.model('Users')
    const targetUser = await UsersModel.findById(userId)
      .select({
        _id: 1,
        globalUserId: 1,
        name: 1,
        username: 1,
        phone: 1,
        role: 1,
        accountLocation: 1,
        currentLocation: 1,
        telegramId: 1,
        vkId: 1,
      })
      .lean()

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 404 },
      )
    }

    // Запретить разработчикам просматривать друг друга без логирования
    if (isDeveloperRole(targetUser.role)) {
      return NextResponse.json(
        { error: 'Нельзя просматривать кабинет другого разработчика' },
        { status: 403 },
      )
    }

    // Вернуть данные целевого пользователя и установить куку
    const response = NextResponse.json({
      success: true,
      message: `Переключены на просмотр кабинета пользователя: ${targetUser.name || targetUser.username}`,
      targetUser,
    })

    // Установить специальную куку для impersonate режима
    // Формат: dev-impersonate-{developerUserId}={targetUserId}|{timestamp}
    const impersonateValue = `${targetUser._id?.toString() || userId}|${Date.now()}`
    response.cookies.set('dev-impersonate', impersonateValue, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 2, // 2 часа
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Ошибка в impersonate-user:', error)
    return NextResponse.json(
      { error: error?.message || 'Внутренняя ошибка сервера' },
      { status: 500 },
    )
  }
}

// Эндпоинт для выхода из режима impersonate
export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions)

    // Проверка: либо обычный разработчик (role === 'dev'),
    // либо разработчик в режиме impersonate (isDeveloperImpersonating === true)
    const isDeveloper = isDeveloperRole(session?.user?.role)
    const isDeveloperImpersonating =
      session?.user?.isDeveloperImpersonating === true

    if (!session?.user || (!isDeveloper && !isDeveloperImpersonating)) {
      return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
    }

    const response = NextResponse.json({
      success: true,
      message: 'Выход из режима просмотра',
    })

    // Удалить куку
    response.cookies.delete('dev-impersonate')

    return response
  } catch (error) {
    console.error('Ошибка при выходе из impersonate:', error)
    return NextResponse.json(
      { error: error?.message || 'Внутренняя ошибка сервера' },
      { status: 500 },
    )
  }
}
