const { Telegraf } = require("telegraf")

const dotenv = require("dotenv")
dotenv.config()

const { TOKEN, KEY } = process.env
const bot = new Telegraf(TOKEN)
const dbName = "alarm-clock-telegram-bot"

const msg = require("./modules/msg.js")
const check = require("./modules/check.js")
const m = require("./modules/m.js")
const rnd = require("./modules/rnd.js")
const materials = require("./materials.json")

const { MongoClient } = require('mongodb')
const uri = `mongodb+srv://Node:${KEY}@cluster0-ttfss.mongodb.net/${dbName}?retryWrites=true&w=majority`
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true })

const intervals = []
const timeouts = []
process.on("uncaughtException", console.log)

async function setAlarmClocks() {
  timeouts.forEach(timeout => clearTimeout(timeout))
  const candidates = await users.find({ alarmClock: { $exists: true } }).toArray()

  candidates.forEach(user => {
    const userAlarmTime = user.alarmClock
    const userTimezone = user.timezone
    const now = new Date
    now.setHours(now.getHours() + userTimezone)
    const next = new Date(now.getFullYear(), now.getMonth(),
      now.getDate() + (now.getHours() >= userAlarmTime), userAlarmTime)
    const timeout = next - now

    const timeout2 = setTimeout(() => {
      let id

      let interval = setInterval(() => {
        msg.del(user.userId, id)
        bot.telegram.sendMessage(user.userId, "🕓 <b>Пора вставать!</b>", {
          parse_mode: "html",
          reply_markup: m.build([
            m.cbb("СТОП!", "stop_alarm_clock")
          ]).reply_markup,
        }).then(message => {
          id = message.message_id
          intervals.find(u => u.userId == user.userId).lastMsgId = message.message_id
        })
      }, 1500)

      intervals.push({
        userId: user.userId,
        interval
      })

      setTimeout(() => {
        const interval = intervals.find(u => u.userId == user.userId)

        if (interval) {
          msg.del(user.userId, interval.lastMsgId)
          clearInterval(interval.interval)
          sendMotivationVideo(user.firstName, user.userId)
        }

        setAlarmClocks()
      }, 30000)
    }, timeout)

    timeouts.push(timeout2)
  })
}

bot.action("stop_alarm_clock", async ctx => {
  const userId = ctx.from.id

  check.candidate({ userId }, async () => {
    const interval = intervals.find(user => user.userId == userId)

    if (interval) {
      msg.del(userId, interval.lastMsgId)
      clearInterval(interval.interval)
      sendMotivationVideo(ctx.from.first_name, userId)
    }

    setAlarmClocks()
  }, ctx)
})

function sendMotivationVideo(firstName, userId) {
  const material = materials[rnd(0, materials.length)]

  msg.send(userId, `
👋 <b>Доброе утро, ${firstName}!</b>
Ваше расслабляющее видео: ${material}.
  `)
}

function displayUserTimezone(ctx, user) {
  const date = new Date
  const userDate = new Date
  userDate.setHours(date.getHours() + user.timezone)
  const min = date.getMinutes().toString().padStart(2, 0)

  msg.edit(ctx, `
🕘 <b>Сверим часы!</b>
У меня сейчас <b>${date.getHours()}:${min}</b>, а у тебя?
Выбрано время: <b>${userDate.getHours()}:${min}</b>.
    `, m.build(
    [
      [
        m.cbb("+1ч", `set_user_timezone_1`),
        m.cbb("+2ч", `set_user_timezone_2`),
        m.cbb("-1ч", `set_user_timezone_-1`),
        m.cbb("-2ч", `set_user_timezone_-2`)
      ],
      [
        m.cbb("✅ Подтвердить", "create_alarm_clock")
      ]
    ]
  ))
}

bot.command("start", async ctx => {
  const userId = ctx.from.id
  const firstName = ctx.from.first_name

  async function startFn(user) {
    let text

    if (user.alarmClock) text = `⏰ Ваш будильник в <b>${user.alarmClock}:00</b>.`
    else text = `⏰ У вас ещё нет будильника...`

    msg.edit(ctx, `👋 Привет, <b>${firstName}</b>!\n${text}`, !user.alarmClock ?
      m.build([m.cbb("🆕 Создать будильник", "get_user_timezone")]) : m.build(
        [[
          m.cbb("✏️ Изменить будильник", "create_alarm_clock"),
          m.cbb("🗑 Удалить будильник", "confirm_delete_alarm_clock")
        ]]
      ))
  }

  check.candidate({ userId }, startFn, async () => {
    await users.insertOne({
      userId,
      firstName,
      timezone: 2,
      alarmClock: null
    })

    startFn({})
  })
})

bot.action("menu", async ctx => {
  const userId = ctx.from.id
  const firstName = ctx.from.first_name

  check.candidate({ userId }, async user => {
    let text

    if (user.alarmClock) text = `⏰ Ваш будильник в <b>${user.alarmClock}:00</b>.`
    else text = `⏰ У вас ещё нет будильника...`

    msg.edit(ctx, `👋 Привет, <b>${firstName}</b>!\n${text}`, !user.alarmClock ?
      m.build([m.cbb("🆕 Создать будильник", "get_user_timezone")]) : m.build(
        [
          [m.cbb("✏️ Изменить будильник", "create_alarm_clock")],
          [m.cbb("🗑 Удалить будильник", "confirm_delete_alarm_clock")]
        ]
      ))
  }, ctx)
})

bot.action("confirm_delete_alarm_clock", async ctx => {
  const userId = ctx.from.id

  check.candidate({ userId }, async () => {
    msg.edit(ctx, `❓ Вы уверены, что хотите удалить будильник?`, m.build(
      [[
        m.cbb("Да, удалить!", "delete_alarm_clock"),
        m.cbb("Нет, отменить!", "menu")
      ]]
    ))
  })
})

bot.action("delete_alarm_clock", async ctx => {
  const userId = ctx.from.id

  check.candidate({ userId }, async () => {
    await users.updateOne({ userId }, {
      $set: {
        alarmClock: null
      }
    })

    msg.edit(ctx, `✅ Вы успешно удалили будильник`, m.build(
      [[
        m.cbb("⬅️ Назад", "menu")
      ]]
    ))
  })
})

bot.action(/set_user_timezone_(.*)/, async ctx => {
  const userId = ctx.from.id

  check.candidate({ userId }, async user => {
    await users.updateOne({ userId }, {
      $inc: {
        timezone: +ctx.match[1]
      }
    })

    displayUserTimezone(ctx, { timezone: user.timezone + +ctx.match[1] })
  }, ctx)
})

bot.action("get_user_timezone", async ctx => {
  const userId = ctx.from.id

  check.candidate({ userId }, async user => displayUserTimezone(ctx, user), ctx)
})

bot.action("create_alarm_clock", async ctx => {
  const userId = ctx.from.id

  check.candidate({ userId }, async user => {
    msg.edit(ctx, `
🆕 <b>${user.alarmClock ? "Смена" : "Создание"} будильника</b>
Выберите время, на которое
хотите установить будильник.
${user.alarmClock ? `На данный момент, у вас
установлен будильник на <b>${user.alarmClock}:00</b>.` : ""}
      `, m.build(
      [
        [
          m.cbb("5:00", "set_alarm_clock_5"),
          m.cbb("6:00", "set_alarm_clock_6"),
          m.cbb("7:00", "set_alarm_clock_7"),
          m.cbb("8:00", "set_alarm_clock_8"),
          m.cbb("9:00", "set_alarm_clock_9"),
        ],
        [
          m.cbb("❌ Отменить", "menu")
        ]
      ]
    ))
  }, ctx)
})

bot.action(/set_alarm_clock_(.*)/, async ctx => {
  const userId = ctx.from.id

  check.candidate({ userId }, async () => {
    const time = +ctx.match[1]

    await users.updateOne({ userId }, {
      $set: {
        alarmClock: time
      }
    })

    msg.edit(ctx, `✅ Вы успешно установили будильник на <b>${time}:00</b>.`, m.build(
      [m.cbb("⬅️ Назад", "menu")]))
    setAlarmClocks()
  }, ctx)
})

client.connect(() => {
  global.users = client.db(dbName).collection("users")
  global.bot = bot

  bot.launch()
  setAlarmClocks()
})