export const pauseOtherAudioElements = (currentAudio) => {
  if (
    typeof document === 'undefined' ||
    typeof HTMLAudioElement === 'undefined' ||
    !(currentAudio instanceof HTMLAudioElement)
  ) {
    return
  }

  document.querySelectorAll('audio').forEach((audio) => {
    if (audio !== currentAudio && !audio.paused) {
      audio.pause()
    }
  })
}

export default pauseOtherAudioElements
