import { postData } from '@helpers/CRUD'
import { DEV_TELEGRAM_ID } from './constants'

const sendErrorToDev = (chat_id, type) => async (error) => {
  return

  await postData(
    `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
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

function splitText(text) {
  const chunks = []
  let i = 0
  while (i < text.length) {
    chunks.push(text.slice(i, Math.min(i + 4096, text.length)))
    i += 4096
  }
  return chunks
}

const sendMessage = async ({
  chat_id,
  text,
  keyboard,
  parse_mode = 'html',
  props = {},
  callback_query,
  images,
  remove_keyboard,
}) => {
  if (images) {
    for (let i = 0; i < images.length; i++) {
      const photo = images[i]
      await postData(
        `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendPhoto`,
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
        sendErrorToDev(chat_id, 'sendPhoto'),
        // (data) => console.log('post error', data),
        true,
        null,
        true
      )
    }
    if (callback_query) {
      await postData(
        `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/editMessageReplyMarkup`,
        {
          message_id: callback_query?.message?.message_id,
          chat_id,
          // photo,
          // parse_mode,
          // reply_markup: keyboard ? JSON.stringify(keyboard) : undefined,
          // ...props,
        },
        // null,
        null,
        // (data) => console.log('post success', data),
        sendErrorToDev(chat_id, 'editMessageReplyMarkup'),
        // (data) => console.log('post error', data),
        true,
        null,
        true
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
    //     true,
    //     null,
    //     true
    //   )
    //   // }
    // }
  }

  if (text) {
    if (text.length > 4096) {
      const preparedText = splitText(text)
      for (let i = 0; i < preparedText.length; i++) {
        await postData(
          `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
          {
            chat_id,
            text,
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
            ...props,
          },
          null,
          sendErrorToDev(chat_id, 'sendMessage'),
          // (data) => console.log('post success', data),
          // (data) => console.log('post error', data),
          true,
          null,
          true
        )
      }
    }
    if (callback_query?.message?.message_id) {
      return await postData(
        `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/editMessageText`,
        {
          message_id: callback_query?.message?.message_id,
          chat_id,
          text,
          parse_mode,
          reply_markup:
            keyboard || remove_keyboard
              ? JSON.stringify({
                  ...(keyboard ?? {}),
                  resize_keyboard: true,
                  ...(remove_keyboard ? { remove_keyboard: true } : {}),
                })
              : undefined,
          ...props,
        },
        null,
        // (data) => console.log('post success', data),
        // null,
        sendErrorToDev(chat_id, 'editMessageText'),
        true,
        null,
        true
      )
    }

    return await postData(
      `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
      {
        chat_id,
        text,
        parse_mode,
        reply_markup:
          keyboard || remove_keyboard
            ? JSON.stringify({
                ...(keyboard ?? {}),
                // resize_keyboard: true,
                ...(remove_keyboard ? { remove_keyboard: true } : {}),
              })
            : undefined,
        ...props,
      },
      null,
      sendErrorToDev(chat_id, 'sendMessage'),
      // (data) => console.log('post success', data),
      // (data) => console.log('post error', data),
      true,
      null,
      true
    )
  }
  return
}

export default sendMessage
