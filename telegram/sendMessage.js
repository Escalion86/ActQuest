import { postData } from '@helpers/CRUD'
import { DEV_TELEGRAM_ID } from './constants'
import splitText from '@helpers/splitText'

const sendErrorToDev = (chat_id, type, telegramToken) => async (error) => {
  return
  await postData(
    `https://api.telegram.org/bot${telegramToken}/sendMessage`,
    {
      chat_id: DEV_TELEGRAM_ID,
      text: `ОШИБКА!\ntype=${type}\nchat_id=${chat_id}\n${
        JSON.parse(error.message).description
      }`,
    },
    null,
    null,
    true,
    null,
    true
  )
}

// function splitText(text) {
//   const chunks = []
//   let i = 0
//   while (i < text.length) {
//     chunks.push(text.slice(i, Math.min(i + 4080, text.length)))
//     i += 4080
//   }
//   return chunks
// }

const sendMessage = async ({
  chat_id,
  text,
  keyboard,
  parse_mode = 'html',
  props = {},
  callback_query,
  images,
  remove_keyboard,
  location,
}) => {
  var telegramToken
  if (location === 'dev') telegramToken = process.env.TELEGRAM_DEV_TOKEN
  if (location === 'krsk') telegramToken = process.env.TELEGRAM_KRSK_TOKEN
  if (location === 'nrsk') telegramToken = process.env.TELEGRAM_NRSK_TOKEN
  if (location === 'ekb') telegramToken = process.env.TELEGRAM_EKB_TOKEN

  if (images) {
    if (images.length >= 2) {
      await postData(
        `https://api.telegram.org/bot${telegramToken}/sendMediaGroup`,
        {
          // message_id: callback_query?.message?.message_id,
          chat_id,
          media: JSON.stringify(
            images.map((image) => ({
              type: 'photo',
              media: image,
            }))
          ),
          // parse_mode,
          // reply_markup: keyboard ? JSON.stringify(keyboard) : undefined,
          // ...props,
        },
        // null,
        null,
        // (data) => console.log('post success', data),
        sendErrorToDev(chat_id, 'sendMediaGroup', telegramToken)
        // (data) => console.log('post error', data),
      )
    } else {
      const photo = images[0]
      await postData(
        `https://api.telegram.org/bot${telegramToken}/sendPhoto`,
        {
          // message_id: callback_query?.message?.message_id,
          chat_id,
          photo,
          // parse_mode,
          // reply_markup: keyboard ? JSON.stringify(keyboard) : undefined,
          // ...props,
        },
        // null,
        null,
        // (data) => console.log('post success', data),
        sendErrorToDev(chat_id, 'sendPhoto', telegramToken)
        // (data) => console.log('post error', data),
      )
    }

    if (callback_query) {
      await postData(
        `https://api.telegram.org/bot${telegramToken}/editMessageReplyMarkup`,
        {
          message_id: callback_query?.message?.message_id,
          chat_id,
          // photo,
          // parse_mode,
          // reply_markup: keyboard ? JSON.stringify(keyboard) : undefined,
          // ...props,
          link_preview_options: {
            is_disabled: true,
          },
        },
        // null,
        null,
        // (data) => console.log('post success', data),
        sendErrorToDev(chat_id, 'editMessageReplyMarkup', telegramToken)
        // (data) => console.log('post error', data),
      )
    }
    // if (images.length === 1) {
    //   const photo = images[0]
    //   // for (let i = 0; i < images.length; i++) {
    //   // const photo = images[i]
    //   console.log('photo :>> ', photo)
    //   return await postData(
    //     `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendPhoto`,
    //     {
    //       // message_id: callback_query.message.message_id,
    //       caption: text,
    //       chat_id,
    //       photo,
    //       parse_mode,
    //       reply_markup: keyboard ? JSON.stringify(keyboard) : undefined,
    //       ...props,
    //     },
    //     // null,
    //     // null,
    //     // (data) => console.log('post success', data),
    //     null,
    //     (data) => console.log('post error', data),
    //   )
    //   // }
    // }
  }

  if (text) {
    console.log('text.length :>> ', text.length)
    if (text.length > 4096) {
      const preparedText = splitText(text)
      for (let i = 0; i < preparedText.length; i++) {
        console.log('preparedText :>> ', preparedText)
        await postData(
          `https://api.telegram.org/bot${telegramToken}/sendMessage`,
          {
            message_id:
              i < preparedText.length - 1
                ? undefined
                : callback_query?.message?.message_id,
            chat_id,
            text: preparedText[i],
            parse_mode,
            reply_markup:
              i < preparedText.length - 1
                ? undefined
                : keyboard || remove_keyboard
                ? JSON.stringify({
                    ...(keyboard ?? {}),
                    // resize_keyboard: true,
                    ...(remove_keyboard ? { remove_keyboard: true } : {}),
                  })
                : undefined,
            link_preview_options: {
              is_disabled: true,
            },
            ...props,
          },
          null,
          sendErrorToDev(chat_id, 'sendMessage', telegramToken)
          // (data) => console.log('post success', data),
          // (data) => console.log('post error', data),
        )
      }
    }
    if (callback_query?.message?.message_id) {
      const reply_markup =
        keyboard || remove_keyboard
          ? JSON.stringify({
              ...(keyboard ?? {}),
              resize_keyboard: true,
              ...(remove_keyboard ? { remove_keyboard: true } : {}),
            })
          : undefined
      console.log('reply_markup :>> ', reply_markup)
      return await postData(
        `https://api.telegram.org/bot${telegramToken}/editMessageText`,
        {
          message_id: callback_query?.message?.message_id,
          chat_id,
          text,
          parse_mode,
          reply_markup,
          link_preview_options: {
            is_disabled: true,
          },
          ...props,
        },
        null,
        // (data) => console.log('post success', data),
        // null,
        sendErrorToDev(chat_id, 'editMessageText', telegramToken)
      )
    }

    const reply_markup =
      keyboard || remove_keyboard
        ? JSON.stringify({
            ...(keyboard ?? {}),
            resize_keyboard: true,
            ...(remove_keyboard ? { remove_keyboard: true } : {}),
          })
        : undefined

    for (let j = 0; j < Object.keys(keyboard ?? {}).length; j++) {
      const e = keyboard[Object.keys(keyboard ?? {})[j]]
      console.log('e :>> ', e)
    }

    return await postData(
      `https://api.telegram.org/bot${telegramToken}/sendMessage`,
      {
        chat_id,
        text,
        parse_mode,
        reply_markup,
        link_preview_options: {
          is_disabled: true,
        },
        ...props,
      },
      null,
      sendErrorToDev(chat_id, 'sendMessage', telegramToken)
      // (data) => console.log('post success', data),
      // (data) => console.log('post error', data),
    )
  }
  return
}

export default sendMessage
