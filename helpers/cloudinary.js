import isObject from './isObject'

export const deleteImage = async (publicId, resource_type = 'image') => {
  try {
    const res = await fetch('/api/cloudimages', {
      method: 'DELETE',
      // headers: {
      //   Accept: contentType,
      //   'Content-Type': contentType,
      // },
      body: JSON.stringify({ publicId, resource_type }),
    })

    // Throw error with status code in case Fetch API req failed
    if (!res.ok) {
      throw new Error(res.status)
    }
  } catch (error) {
    // setMessage('Failed to update on ' + url)
  }
}

// TODO Adding delete not used images
export const deleteImages = async (arrayOfImagesUrls, callback = null) => {
  if (callback) callback()
}

export const sendImage = async (
  image,
  callback,
  folder = null,
  imageName = null,
  project = 'polovinka_uspeha'
) => {
  if (isObject(image)) {
    const formData = new FormData()
    // console.log('folder', folder)
    formData.append('project', project)
    formData.append('folder', folder)
    // formData.append('password', 'cloudtest')
    formData.append('files', image)

    return await fetch(
      // 'https://api.cloudinary.com/v1_1/escalion-ru/image/upload',
      'https://api.escalioncloud.ru/api',
      {
        method: 'POST',
        body: formData,
        //  JSON.stringify({
        //   file: image,
        //   fileName: imageName ?? 'test.jpg',
        //   folder: 'events',
        // })
        // dataType: 'json',
        // headers: {
        //   'Content-Type': 'application/json',
        // 'Content-Type': "multipart/form-data"
        // },
      }
    )
      .then((response) => response.json())
      .then((data) => {
        console.log('data', data)
        // if (data.secure_url !== '') {
        // if (callback) callback(data.secure_url)
        // return data.secure_url
        // }
        if (callback) callback(data)
      })
      .catch((err) => console.error('ERROR', err))
  }
}
