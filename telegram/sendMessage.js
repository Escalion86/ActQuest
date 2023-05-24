import { postData } from '@helpers/CRUD'

const sendMessage = async ({
  chat_id,
  text,
  keyboard,
  props = {},
  callback_query,
}) => {
  if (callback_query) {
    return await postData(
      `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/editMessageText`,
      {
        message_id: callback_query.message.message_id,
        chat_id,
        text,
        parse_mode: 'html',
        reply_markup: keyboard ? JSON.stringify(keyboard) : undefined,
        ...props,
      },
      // null,
      // null,
      (data) => console.log('post success', data),
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
      parse_mode: 'html',
      reply_markup: keyboard ? JSON.stringify(keyboard) : undefined,
      ...props,
    },
    null,
    null,
    // (data) => console.log('post success', data),
    // (data) => console.log('post error', data),
    true,
    null,
    true
  )
}

export default sendMessage
