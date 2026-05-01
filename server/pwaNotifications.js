let cachedWebPush
let cachedConfig

const loadWebPush = () => {
  if (cachedWebPush !== undefined) {
    return cachedWebPush
  }

  try {
    // eslint-disable-next-line no-eval
    const dynamicRequire = eval('typeof require !== "undefined" ? require : null')

    if (dynamicRequire) {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      cachedWebPush = dynamicRequire('web-push')
    } else {
      cachedWebPush = null
    }
  } catch (error) {
    console.warn(
      'Модуль "web-push" не установлен. Уведомления будут сохраняться, но push-оповещения отправлены не будут.'
    )
    cachedWebPush = null
  }

  return cachedWebPush
}

const ensureConfig = () => {
  if (cachedConfig) {
    return cachedConfig
  }

  const webpush = loadWebPush()

  if (!webpush) {
    cachedConfig = { isReady: false, reason: 'MODULE_UNAVAILABLE' }
    return cachedConfig
  }

  const publicKey =
    process.env.WEB_PUSH_PUBLIC_KEY || process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY
  const contact = process.env.WEB_PUSH_CONTACT || process.env.WEB_PUSH_CONTACT_EMAIL

  if (!publicKey || !privateKey || !contact) {
    cachedConfig = {
      isReady: false,
      reason: 'MISSING_ENVIRONMENT',
      publicKey: publicKey || null,
      hasPrivateKey: Boolean(privateKey),
    }
    return cachedConfig
  }

  const subject =
    contact.startsWith('mailto:') || contact.startsWith('https://') || contact.startsWith('http://')
      ? contact
      : `mailto:${contact}`

  webpush.setVapidDetails(subject, publicKey, privateKey)

  cachedConfig = {
    isReady: true,
    publicKey,
    subject,
  }

  return cachedConfig
}

const buildPushPayload = ({
  notification,
  notificationDoc,
}) => {
  const baseUrl = notification?.url || '/cabinet?tab=notifications'

  return {
    title: notification?.title || notificationDoc?.title || 'ActQuest',
    body: notification?.body || notificationDoc?.body || '',
    tag: notification?.tag || notificationDoc?.tag || undefined,
    data: {
      ...(notification?.data || {}),
      notificationId: notificationDoc?._id?.toString?.(),
      url: baseUrl,
      location: notificationDoc?.location,
    },
    icon: notification?.icon,
    badge: notification?.badge,
    vibrate: notification?.vibrate,
  }
}

const mapSubscriptionForSending = (subscription) => {
  if (!subscription) return null

  const endpoint = subscription.endpoint
  const p256dh = subscription?.keys?.p256dh
  const auth = subscription?.keys?.auth

  if (!endpoint || !p256dh || !auth) {
    return null
  }

  const mapped = {
    endpoint,
    keys: { p256dh, auth },
  }

  if (subscription.expirationTime) {
    mapped.expirationTime = subscription.expirationTime
  }

  return mapped
}

const sendToUserSubscriptions = async ({ db, user, notification, notificationDoc }) => {
  const webpush = loadWebPush()
  const config = ensureConfig()

  if (!webpush || !config.isReady) {
    return { delivered: 0, removed: 0 }
  }

  const subscriptions = Array.isArray(user.pushSubscriptions)
    ? user.pushSubscriptions
    : []

  if (!subscriptions.length) {
    return { delivered: 0, removed: 0 }
  }

  const payload = JSON.stringify(buildPushPayload({ notification, notificationDoc }))
  const invalidEndpoints = []
  let delivered = 0

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const mapped = mapSubscriptionForSending(subscription)

      if (!mapped) {
        return
      }

      try {
        await webpush.sendNotification(mapped, payload)
        delivered += 1
      } catch (error) {
        const statusCode = error?.statusCode || error?.status || error?.status_code

        if (statusCode === 404 || statusCode === 410 || statusCode === 400) {
          invalidEndpoints.push(mapped.endpoint)
        } else {
          console.error('Web push send error', error)
        }
      }
    })
  )

  if (invalidEndpoints.length > 0) {
    try {
      if (!user?._id) {
        return { delivered, removed: invalidEndpoints.length }
      }

      await db.model('Users').updateOne(
        { _id: user._id },
        {
          $pull: {
            pushSubscriptions: {
              endpoint: { $in: invalidEndpoints },
            },
          },
        }
      )
    } catch (error) {
      console.error('Failed to cleanup invalid subscriptions', error)
    }
  }

  return { delivered, removed: invalidEndpoints.length }
}

export const ensureWebPushConfigured = () => ensureConfig()

export const broadcastNotificationToUsers = async ({ db, users, notification }) => {
  const targetUsers = (Array.isArray(users) ? users : []).filter((user) =>
    Boolean(user?._id),
  )

  if (targetUsers.length === 0) {
    return {
      created: 0,
      delivered: 0,
      removed: 0,
      config: ensureConfig(),
    }
  }

  const Notifications = db.model('Notifications')
  const now = new Date()

  const resolvedLocation = notification?.location || notification?.data?.location || 'global'

  const notificationDocs = await Notifications.insertMany(
    targetUsers.map((user) => ({
      userId: String(user._id),
      location: resolvedLocation,
      title: notification?.title || 'ActQuest',
      body: notification?.body || '',
      data: {
        ...(notification?.data || {}),
        location: resolvedLocation,
      },
      tag: notification?.tag || null,
      createdAt: now,
      updatedAt: now,
    }))
  )

  const config = ensureConfig()

  if (!config.isReady) {
    return {
      created: notificationDocs.length,
      delivered: 0,
      removed: 0,
      config,
    }
  }

  let delivered = 0
  let removed = 0

  await Promise.all(
    notificationDocs.map((doc, index) => {
      const targetUser =
        targetUsers[index] ||
        targetUsers.find((item) => String(item?._id) === String(doc.userId))

      if (!targetUser) {
        return Promise.resolve()
      }

      return sendToUserSubscriptions({
        db,
        user: targetUser,
        notification,
        notificationDoc: doc,
      }).then((result) => {
        delivered += result.delivered
        removed += result.removed
      })
    })
  )

  return {
    created: notificationDocs.length,
    delivered,
    removed,
    config,
  }
}
