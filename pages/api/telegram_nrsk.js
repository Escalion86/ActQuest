// import { postData } from '@helpers/CRUD'
import dbConnect from '@utils/dbConnect'
import callbackHandler from 'telegram/callbackHandler'
import locationHandler from 'telegram/locationHandler'
import messageHandler from 'telegram/messageHandler'

export default async function handler(req, res) {
  const { query, method, body } = req

  if (method === 'POST') {
    try {
      await dbConnect('nrsk')
      if (body?.callback_query) {
        // Принимаем команду
        const result = await callbackHandler(body, res, 'nrsk')
      } else if (body?.message) {
        // Пользователь написал текст
        const result = await messageHandler(body, res, 'nrsk')
      } else if (body?.edited_message) {
        if (body.edited_message?.location) {
          const result = await locationHandler(body.edited_message, res, 'nrsk')
        }
      }

      return res?.status(200).json({ success: true })
    } catch (error) {
      console.log(error)
      return res?.status(400).json({ success: false, error })
    }
  }
  return res?.status(400).json({ success: false, error: 'Wrong method' })
}
