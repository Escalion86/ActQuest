import birthDateToAge from '@helpers/birthDateToAge'
import { postData } from '@helpers/CRUD'
import getUserFullName from '@helpers/getUserFullName'
import isUserAdmin from '@helpers/isUserAdmin'
// import isUserQuestionnaireFilled from '@helpers/isUserQuestionnaireFilled'
// import Histories from '@models/Histories'
// import Users from '@models/Users'
import dbConnect from '@utils/dbConnect'

function transformQuery(query) {
  const processSingleValue = (key, value) => {
    // Добавляем проверку на отсутствие ключа (на случай корневого уровня)
    if (!key) return value

    const lowercasedKey = key.toLowerCase()

    // Обработка ObjectId
    if (lowercasedKey === '_id') {
      try {
        return new mongoose.Types.ObjectId(value)
      } catch (e) {
        throw new Error(`Invalid ObjectId: ${value}`)
      }
    }

    // Обработка дат
    if (
      lowercasedKey === 'createdat' ||
      lowercasedKey === 'updatedat' ||
      lowercasedKey.includes('date')
    ) {
      const date = new Date(value)
      if (isNaN(date.getTime())) throw new Error(`Invalid Date: ${value}`)
      return date
    }

    // Обработка boolean
    if (value === 'true') return true
    if (value === 'false') return false

    return value
  }

  const buildNestedStructure = (keys, value, ctx) => {
    const [currentKey, ...restKeys] = keys

    if (restKeys.length === 0) {
      // Изменения здесь: добавляем проверку на оператор $in
      if (currentKey === '$in' && !Array.isArray(ctx[currentKey])) {
        ctx[currentKey] = []
      }

      if (Array.isArray(ctx[currentKey])) {
        ctx[currentKey].push(processSingleValue(currentKey, value))
      } else {
        ctx[currentKey] = processSingleValue(currentKey, value)
      }
      return
    }

    if (!ctx[currentKey]) {
      ctx[currentKey] = !isNaN(restKeys[0]) ? [] : {}
    }

    buildNestedStructure(restKeys, value, ctx[currentKey])
  }

  const result = {}

  for (const [rawKey, rawValue] of Object.entries(query)) {
    const keys = rawKey.split(/\[|\]/g).filter((k) => k !== '')
    const values = Array.isArray(rawValue) ? rawValue : [rawValue]

    for (const val of values) {
      buildNestedStructure(keys, val, result)
    }
  }

  // Специальная обработка для массивов $in
  const processInOperator = (obj, parentKey) => {
    for (const key in obj) {
      if (key === '$in' && Array.isArray(obj[key])) {
        obj[key] = obj[key].map((item) => processSingleValue(parentKey, item))
      } else if (typeof obj[key] === 'object') {
        processInOperator(obj[key], key)
      }
    }
  }

  processInOperator(result, '')

  return result
}

export default async function handler(Schema, req, res, params = null) {
  const { query, method, body } = req

  const id = query?.id
  const location = query?.location
  const querySelect = query?.select // array
  const querySort = query?.sort
  const queryLimit = query?.limit
  const isCountReturn = !!query?.countReturn

  if (!location) {
    return res
      ?.status(400)
      .json({ success: false, error: 'No location in query' })
  }

  delete query.location
  delete query.select
  delete query.sort
  delete query.limit
  delete query.countReturn

  console.log('querySelect :>> ', querySelect)

  const db = await dbConnect(location)

  let data

  const selectOpts = querySelect ? querySelect.split(',') : { password: 0 }

  switch (method) {
    case 'GET':
      try {
        if (id) {
          data = await db.model(Schema).findById(id).select(selectOpts)
          if (!data) {
            return res?.status(400).json({ success: false })
          }
          return res?.status(200).json({ success: true, data })
        } else if (Object.keys(query).length > 0) {
          const preparedQuery = transformQuery(query)
          for (const [key, value] of Object.entries(preparedQuery)) {
            if (isJson(value)) preparedQuery[key] = JSON.parse(value)
            // if (value === 'true') preparedQuery[key] = true
            // if (value === 'false') preparedQuery[key] = false
          }
          // console.log('querySort :>> ', querySort)
          data = isCountReturn
            ? await db
                .model(Schema)
                .find(preparedQuery)
                .limit(queryLimit)
                .count()
            : await db
                .model(Schema)
                .find(preparedQuery)
                .select(selectOpts)
                .limit(queryLimit)
                .sort(querySort)

          if (!data) {
            return res?.status(400).json({ success: false })
          }
          return res?.status(200).json({ success: true, data })
        } else if (params) {
          data = isCountReturn
            ? await db.model(Schema).find(params).limit(queryLimit).count()
            : await db
                .model(Schema)
                .find(params)
                .select(selectOpts)
                .limit(queryLimit)
                .sort(querySort)
          if (!data) {
            return res?.status(400).json({ success: false })
          }
          return res?.status(200).json({ success: true, data })
        } else {
          data = isCountReturn
            ? await db.model(Schema).find().limit(queryLimit).count()
            : await db
                .model(Schema)
                .find()
                .select(selectOpts)
                .limit(queryLimit)
                .sort(querySort)
          return res?.status(200).json({ success: true, data })
        }
      } catch (error) {
        console.log(error)
        return res?.status(400).json({ success: false, error })
      }
      break
    case 'POST':
      try {
        if (id) {
          return res
            ?.status(400)
            .json({ success: false, error: 'No need to set Id' })
        } else {
          const clearedBody = { ...body.data }
          delete clearedBody._id
          data = await db.model(Schema).create(clearedBody)
          if (!data) {
            return res?.status(400).json({ success: false })
          }
          // await Histories.create({
          //   schema: Schema.collection.collectionName,
          //   action: 'add',
          //   data,
          //   userId: body.userId,
          // })

          return res?.status(201).json({ success: true, data })
        }
      } catch (error) {
        console.log(error)
        return res?.status(400).json({ success: false, error })
      }
      break
    case 'PUT':
      try {
        if (id) {
          data = await db.model(Schema).findById(id)
          // console.log('Schema', Schema.collection.collectionName)
          // console.log('typeof', typeof Schema.collection.collectionName)
          if (!data) {
            return res?.status(400).json({ success: false })
          }

          // // Если это пользователь обновляет анкету, то после обновления оповестим о результате через телеграм
          // const afterUpdateNeedToNotificate =
          //   // body.userId === id &&
          //   Schema === Users && !isUserQuestionnaireFilled(data)

          data = await db.model(Schema).findByIdAndUpdate(id, body.data, {
            new: true,
            runValidators: true,
          })

          if (!data) {
            return res?.status(400).json({ success: false })
          }

          // await Histories.create({
          //   schema: Schema.collection.collectionName,
          //   action: 'updete',
          //   data,
          //   userId: body.userId,
          // })

          if (afterUpdateNeedToNotificate) {
            const users = await db.model('Users').find({})
            const usersTelegramIds = users
              .filter(
                (user) =>
                  isUserAdmin(user) &&
                  user.notifications?.get('telegram').active &&
                  user.notifications?.get('telegram')?.id
              )
              .map((user) => user.notifications?.get('telegram')?.id)
            await Promise.all(
              usersTelegramIds.map(async (telegramId) => {
                const fullUserName = getUserFullName(data)
                await postData(
                  `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
                  {
                    chat_id: telegramId,
                    text: `Пользователь с номером +${
                      data.phone
                    } заполнил анкету:\n - Полное имя: ${fullUserName}\n - Пол: ${
                      data.gender === 'male' ? 'Мужчина' : 'Женщина'
                    }\n - Дата рождения: ${birthDateToAge(
                      data.birthday,
                      true,
                      true,
                      true
                    )}`,
                    parse_mode: 'html',
                  },
                  (data) => console.log('data', data),
                  (data) => console.log('error', data),
                  true,
                  null,
                  true
                )
                if (data.images && data.images[0]) {
                  await postData(
                    `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMediaGroup`,
                    {
                      chat_id: telegramId,
                      media: JSON.stringify(
                        data.images.map((photo) => {
                          return {
                            type: 'photo',
                            media: photo,
                            // caption: 'Наденька',
                            // "parse_mode": "optional (you can delete this parameter) the parse mode of the caption"
                          }
                        })
                      ),
                      // reply_markup:
                      //   req.headers.origin.substr(0, 5) === 'https'
                      //     ? JSON.stringify({
                      //         inline_keyboard: [
                      //           [
                      //             {
                      //               text: 'Открыть пользователя',
                      //               url: req.headers.origin + '/user/' + eventId,
                      //             },
                      //           ],
                      //         ],
                      //       })
                      //     : undefined,
                    },
                    (data) => console.log('data', data),
                    (data) => console.log('error', data),
                    true,
                    null,
                    true
                  )
                  // await postData(
                  //   `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendPhoto`,
                  //   {
                  //     chat_id: telegramId,
                  //     photo: data.images[0],
                  //     caption: fullUserName,
                  //     // reply_markup:
                  //     //   req.headers.origin.substr(0, 5) === 'https'
                  //     //     ? JSON.stringify({
                  //     //         inline_keyboard: [
                  //     //           [
                  //     //             {
                  //     //               text: 'Открыть пользователя',
                  //     //               url: req.headers.origin + '/user/' + eventId,
                  //     //             },
                  //     //           ],
                  //     //         ],
                  //     //       })
                  //     //     : undefined,
                  //   },
                  //   (data) => console.log('data', data),
                  //   (data) => console.log('error', data),
                  //   true
                  // )
                }
              })
            )
          }

          return res?.status(200).json({ success: true, data })
        } else {
          return res?.status(400).json({ success: false, error: 'No Id' })
        }
      } catch (error) {
        console.log(error)
        return res?.status(400).json({ success: false })
      }
      break
    case 'DELETE':
      try {
        if (params) {
          data = await db.model(Schema).deleteMany(params)
          if (!data) {
            return res?.status(400).json({ success: false })
          }
          // await Histories.create({
          //   schema: Schema.collection.collectionName,
          //   action: 'updete',
          //   data,
          //   userId: body.userId,
          // })
          return res?.status(200).json({ success: true, data })
        } else if (id) {
          data = await db.model(Schema).findById(id)
          if (!data) {
            return res?.status(400).json({ success: false })
          }
          data = await db.model(Schema).deleteOne({
            _id: id,
          })
          if (!data) {
            return res?.status(400).json({ success: false })
          }
          // await Histories.create({
          //   schema: Schema.collection.collectionName,
          //   action: 'updete',
          //   data,
          //   userId: body.userId,
          // })
          return res?.status(200).json({ success: true, data })
        } else if (body?.params) {
          data = await db.model(Schema).deleteMany({
            _id: { $in: body.params },
          })
          if (!data) {
            return res?.status(400).json({ success: false })
          }
          // await Histories.create({
          //   schema: Schema.collection.collectionName,
          //   action: 'updete',
          //   data,
          //   userId: body.userId,
          // })
          return res?.status(200).json({ success: true, data })
        } else {
          return res?.status(400).json({ success: false })
        }
      } catch (error) {
        console.log(error)
        return res?.status(400).json({ success: false, error })
      }
      break
    default:
      return res?.status(400).json({ success: false })
      break
  }
}
