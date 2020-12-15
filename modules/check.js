const msg = require("./msg.js")

module.exports = {
  async candidate(dataFind, successFn, failFn) {
    const candidate = await users.findOne(dataFind)

    if (candidate) {
      successFn(candidate)
    } else {
      if (typeof failFn == "function") {
        failFn(dataFind)
      } else {
        const ctx = failFn
        msg.edit(ctx, `Ошибка. Введите /start`)
      }
    }
  }
}