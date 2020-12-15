module.exports = {
  send(userId, msg, extra) {
    bot.telegram.sendMessage(userId, msg, { parse_mode: "html", ...extra })
  },

  edit(ctx, msg, extra) {
    try {
      ctx.deleteMessage()
      ctx.replyWithHTML(msg, extra)
    } catch {
      ctx.replyWithHTML(msg, extra)
    }
  },

  delLast(ctx) {
    ctx.deleteMessage()
  }
}