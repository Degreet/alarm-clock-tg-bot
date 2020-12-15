const { Markup, Extra } = require("telegraf")

module.exports = {
  build(markup) {
    return Extra.markup(Markup.inlineKeyboard(markup))
  },

  cbb(text, action) {
    return Markup.callbackButton(text, action)
  }
}