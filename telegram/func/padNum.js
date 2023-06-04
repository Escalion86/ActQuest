const padNum = (num, pad) =>
  new Array(pad).join('0').slice((pad || 2) * -1) + num

export default padNum
