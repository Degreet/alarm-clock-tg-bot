module.exports = function rnd(min, max) {
  return Math.floor(Math.random() * (max - min) + min)
}