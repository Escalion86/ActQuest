import { postData } from '@helpers/CRUD'

const sendMessage = async ({
  chat_id,
  text,
  keyboard,
  parse_mode = 'html',
  props = {},
  callback_query,
  images,
}) => {
  if (images) {
    for (let i = 0; i < images.length; i++) {
      const photo = images[i]
      console.log('photo :>> ', photo)
      await postData(
        `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendPhoto`,
        {
          // message_id: callback_query.message.message_id,
          chat_id,
          photo,
          // parse_mode,
          // reply_markup: keyboard ? JSON.stringify(keyboard) : undefined,
          // ...props,
        },
        // null,
        // null,
        // (data) => console.log('post success', data),
        null,
        (data) => console.log('post error', data),
        true,
        null,
        true
      )
    }
  }
  if (text) {
    if (callback_query) {
      return await postData(
        `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/editMessageText`,
        {
          message_id: callback_query.message.message_id,
          chat_id,
          text,
          parse_mode,
          reply_markup: keyboard ? JSON.stringify(keyboard) : undefined,
          ...props,
        },
        // null,
        // null,
        // (data) => console.log('post success', data),
        null,
        (data) => console.log('post error', data),
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
        reply_markup: keyboard ? JSON.stringify(keyboard) : undefined,
        ...props,
      },
      null,
      // null,
      // (data) => console.log('post success', data),
      (data) => console.log('post error', data),
      true,
      null,
      true
    )
  }
  return
}

export default sendMessage
