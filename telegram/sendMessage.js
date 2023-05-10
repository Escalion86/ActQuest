import { postData } from '@helpers/CRUD'

const sendMessage = async ({ chat_id, text, keyboard }) => {
  return await postData(
    `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
    {
      chat_id,
      text,
      parse_mode: 'html',
      reply_markup: keyboard ? JSON.stringify(keyboard) : undefined,
    },
    null,
    null,
    // (data) => console.log('data', data),
    // (data) => console.log('error', data),
    true,
    null,
    true
  )
}

export default sendMessage
