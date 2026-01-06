import os
import json
import random
from datetime import datetime, timedelta, time
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters, ContextTypes

load_dotenv()
BOT_TOKEN = os.getenv('BOT_TOKEN')
DATA_FILE = 'data.json'
DEFAULT_YEAR = 2026

# Motivatsiya so'zlari
MOTIVATIONAL_QUOTES = [
    "💪 Bugun qilayotgan kichik harakating ertaga katta natijaga aylanadi, shuning uchun sekin bo‘lsa ham to‘xtamasdan davom et."

"🔥 Hech kim kelib seni o‘zgartirib bermaydi, hayotingni yaxshilash faqat o‘zingning qaroring va harakatingga bog‘liq."

"🚀 Mukammal vaqtni kutma, aynan hozir boshlangan ish eng to‘g‘ri tanlov bo‘lishi mumkin."

"🧠 Fikrlash tarzing o‘zgarsa, qarorlaring o‘zgaradi, qarorlaring o‘zgarsa butun hayoting boshqacha yo‘lga kiradi."

"⏳ Vaqt juda qimmat, uni to‘g‘ri ishlatgan inson hech qachon yo‘qotmaydi."

"🏆 Yutish hech qachon tasodif bo‘lmaydi, bu har kuni qilingan intizomli mehnatning natijasidir."

"⚡ Charchayotganing rivojlanayotganing belgisi, lekin charchoqni bahona qilib to‘xtab qolma."

"🧱 Qiyinchiliklar seni sindirish uchun emas, balki ichingdagi kuchni uyg‘otish uchun keladi."

"🌱 Har kuni ozgina yaxshilanish ham katta o‘zgarishga olib keladi, faqat izchil bo‘l."

"🪞 Sening eng katta raqibing kechagi o‘zing, bugun undan kuchliroq bo‘lishga harakat qil."

"🔑 Bahona izlaganlar sabab topadi, natija istaganlar esa yo‘l topadi."

"🕰️ Bugun sabr qilgan inson ertaga pushaymon bo‘lmaydi, chunki u o‘z ustida ishlagan bo‘ladi."

"🧭 Maqsadsiz harakat seni charchatadi, aniq yo‘l esa seni kuchli qiladi."

"🌤️ Bugun qiyin bo‘lishi mumkin, lekin aynan shu kunlar kelajakdagi g‘ururingni yaratadi."

"🏔️ Oson yo‘l hamma uchun ochiq, lekin cho‘qqiga faqat sabr qilganlar chiqadi."

"🔄 Agar natija o‘zgarmayotgan bo‘lsa, demak harakatni o‘zgartirish vaqti kelgan."

"💼 O‘zingga sarflagan vaqt va kuch hech qachon bekorga ketmaydi, bu eng foydali investitsiya."

"🧩 Hayotingdagi har bir sinov seni keyingi bosqichga tayyorlaydi, agar taslim bo‘lmasang."

"🌙 Bugun ko‘pchilik uxlayotgan paytda qilgan mehnating ertaga seni boshqalardan ajratib turadi."

"🔥 Kuchli bo‘lish uchun hamma narsa oson bo‘lishi shart emas, ba’zan og‘riq ham o‘stiradi."

"🧠 Fikrlaringni nazorat qil, chunki ular sening kayfiyating va harakatingni boshqaradi."

"🚦 To‘xtab qolish eng xavfli qaror, sekin yurish esa baribir oldinga harakatdir."

"🛠️ Bugun qurgan poydevoring ertaga mustahkam hayot bo‘lib qaytadi, shuni unutma."

"🌍 Boshqalarning fikri bilan yashasang, hech qachon o‘zing bo‘la olmaysan."

"💥 Taslim bo‘lish eng oson yo‘l, lekin afsus ham aynan shu yo‘ldan keladi."

"🕊️ O‘zingni kechagi xatolaring bilan emas, bugungi harakating bilan bahola."

"📈 Natija darrov ko‘rinmasligi mumkin, lekin u albatta keladi."

"🔒 Intizom bo‘lmagan joyda barqaror natija bo‘lmaydi, buni yodda tut."

"🎯 Aniq maqsad bo‘lmasa, kuch ham behuda ketadi."

"⚙️ Har kuni qilinadigan kichik odatlar katta hayotni yaratadi, aynan shu sirni tushun."

"🌞 Har tong yangi imkoniyat bilan keladi, faqat uni ko‘ra bilish kerak."

"🪜 Har bir qadam seni yuqoriga olib chiqmasligi mumkin, lekin baribir oldinga siljitadi."

"🧠 O‘zingga ishonishni o‘rgan, chunki sendan boshqa hech kim buni sen uchun qilmaydi."

"🛑 Bugun yo‘q deyishni bilgan inson ertaga o‘ziga rahmat aytadi."

"🌊 Hayot seni sinab ko‘rishi mumkin, lekin taslim bo‘lish sening tanloving."

"🔥 Ichingdagi imkoniyatlar sen o‘ylagandan ancha katta, faqat ularni uyg‘ot."

"🧭 Yo‘ldan adashganing mag‘lubiyat emas, to‘xtab qolganing mag‘lubiyat."

"⏰ Ertaga boshlayman degan fikr ko‘pincha hech qachon degan ma’noni anglatadi."

"🏗️ Bugun qiyin bo‘lsa ham mehnat qil, ertaga oson hayot shu yerda quriladi."

"🌟 Sabr bilan qilingan mehnat har doim o‘z mevasini beradi, kech bo‘lsa ham."

"🪨 Qattiq bo‘lish shart emas, bardoshli bo‘lish yetarli."

"🔄 O‘zgarish qo‘rqinchli tuyulishi mumkin, lekin rivoj aynan shu yerda boshlanadi."

"📚 Bilimingni oshirishga sarflagan har bir daqiqa kelajakda seni kuchli qiladi."

"🧗 Har bir cho‘qqi avval qiyin ko‘rinadi, lekin chiqib bo‘lmas degani emas."

"💡 Aql bilan qilingan harakat kuchsiz mehnatdan ustun bo‘ladi."

"🧱 Bugungi qiyinchiliklar seni sindirmasa, ertaga hech narsa sindira olmaydi."

"🚶 Sekin bo‘lsa ham oldinga yur, orqaga qaytishdan ko‘ra ming marta yaxshi."

"🛡️ O‘zingni bahona bilan emas, mehnating bilan himoya qil."

"🔑 Hayotingdagi eng muhim qaror taslim bo‘lmaslik, buni unutma."

" Bugun o‘z ustingda ishlagan inson ertaga boshqalarga ilhom bo‘ladi."
]

# O'tgan vazifalar uchun qo'shimcha eslatmalar
OVERDUE_REMINDERS = [
    "🔔 Vazifani bajarmaysizmi? Vaqti o'tib ketdi! Bajarib qo'ying, maqsadingizga yaqinlashasiz 💪",
    "⚠️ {desc} hali bajarilmagan. Endi bajaring, keyin osonlashadi! 🚀",
    "😊 Vazifangiz kutmoqda: {desc}. Bajarmaysizmi? Harakat qiling, muvaffaqiyat yaqin! 🌟",
    "📌 {desc} vaqti o'tgan. Bajarib qo'ying, keyin dam oling! 😌"
]

# Xabarlar
MSG_WELCOME = "Assalomu Alaykum Todo botimizga xush kelibsiz" \
"Iltimos ismingizni kiriting"
MSG_ALREADY_REG = "😊 Salom, {name}! Bugun ham maqsadlar sari birga vazifa bajaramiz degan umid qilaman 💪"
MSG_BOT_INFO = (
  "🚀 Daily TODO   — zamonaviy va aqlli vazifa menejeri hamda motivator!\n\n"
"🕒 Yilni  samarali rejalashtiring.\n"
"Siz faqat oy, kun va vaqtni kiritasiz — bot qolganini o‘zi aniqlaydi ⏰\n\n"
"🔥 Mavjud buyruqlar va ularning vazifalari:\n\n"
"/addtask — Yangi vazifa qo‘shish ➕\n"
"Vazifa nomi, sana va vaqtni tez va oson kiritish imkoniyati.\n\n"
"/tasks — Barcha vazifalar ro‘yxati 📋\n"
"Bajarilgan va bajarilmagan vazifalar ko‘rinadi.\n"
"Bajarilmagan vazifalar uchun qulay tugmalar mavjud.\n\n"
"/today — Bugungi vazifalar 📅\n"
"Bugun bajarilishi kerak bo‘lgan ishlar va eslatmalar.\n\n"
"/tomorrow — Ertangi vazifalar 🗓️\n"
"Ertangi rejalaringiz va tezkor vazifa qo‘shish imkoniyati.\n\n"
"/weekly — Haftalik hisobot 📊\n"
"So‘nggi 7 kunlik faoliyatingiz tahlili.\n\n"
"/stats — Statistika 📈\n"
"Umumiy vazifalar, bajarilgan ishlar va samaradorlik ko‘rsatkichlari.\n\n"
"/motivation — Motivatsiya 🌟\n"
"Kunni ilhom bilan davom ettirish uchun motivatsion xabarlar.\n\n"
"/help — Yordam ❓\n"
"Botdan foydalanish bo‘yicha to‘liq qo‘llanma.\n\n"




"💬 Takliflaringiz, fikrlaringiz yoki qandaydir muammo bo‘lsa — bemalol yozing 😊\n"
"👉 @otabekovsanjarbek\n"
"Sizning har bir xabaringiz biz uchun muhim va botni yanada qulay qilishga yordam beradi 🚀"

)
MSG_TASK_DESC = "✏️ Vazifa tavsifini kiriting:"
MSG_TASK_DATE_TIME = "📆 Oy-kun va vaqtni yozing (MM-DD HH:MM):\nMisol: 01-15 14:30"
MSG_TASK_ADDED = "✅ Vazifa qo'shildi!\n📌 {desc}\n🕓 {dt}"
MSG_REMINDER = "🔔 Eslatma! Vaqti keldi:\n📌 {desc}\n\nBajardingizmi?"
MSG_DONE = "🎉 Ajoyib! Vazifa bajarildi! Davom eting 🔥"
MSG_NOT_DONE = "😔 Keyingi safar albatta! Ishonamiz sizga 💪"
MSG_NO_TASKS = "😌 Hozircha vazifa yo'q. Yangi qo'shing!"
MSG_TASKS_HEADER = "📋 Vazifalaringiz:"
MSG_TODAY_HEADER = "📅 Bugungi vazifalar ({date}):"
MSG_TODAY_REMINDER = "⚠️ Bugun bajarilmagan vazifalar bor!\n\n{list}\nMuvaffaqiyatli kun! 🚀"
MSG_NO_TODAY = "🎯 Bugun vazifa yo'q — dam olishingiz mumkin!"
MSG_TOMORROW_HEADER = "🗓️ Ertangi vazifalar ({date}):"
MSG_NO_TOMORROW = "🛌 Ertaga vazifa yo'q — hozir qo'shishingiz mumkin!"
MSG_TOMORROW_ADD = "🗓️ Ertangi vazifa qo'shmoqchimisiz?\n\n✏️ Tavsifni yozing:"
MSG_INVALID_FORMAT = "❌ Noto'g'ri format. MM-DD HH:MM ko'rinishida yozing.\nMisol: 02-10 09:00"
MSG_PAST_TIME = "⏰ Bu vaqt o'tib ketgan. Kelajakdagi vaqtni tanlang."
MSG_NOT_REGISTERED = "🚫 Avval /start bilan ro'yxatdan o'ting."
MSG_STATS = (
    "📈 Statistika:\n\n"
    "Jami vazifalar: {total} 📝\n"
    "Bajarilgan: {done} ✅\n"
    "Bajarilmagan: {not_done} ❌\n"
    "Bugun bajarilmagan: {today} 🎯\n\n"
    "Har bir qadam muhim! 🌟"
)
MSG_EXTRA_MOTIVATION = "🌟 Motivatsiya:\n{quote}"

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"users": {}}

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

# === BUYRUQLAR ===
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.message.from_user.id)
    data = load_data()
    if user_id not in data["users"]:
        context.user_data['state'] = 'name'
        await update.message.reply_text(MSG_WELCOME)
    else:
        name = data["users"][user_id]["name"]
        await update.message.reply_text(MSG_ALREADY_REG.format(name=name) + "\n\n" + MSG_BOT_INFO)

async def addtask(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.message.from_user.id)
    data = load_data()
    if user_id not in data["users"]:
        await update.message.reply_text(MSG_NOT_REGISTERED)
        return
    context.user_data['state'] = 'task_desc'
    context.user_data['tomorrow_add'] = False
    await update.message.reply_text(MSG_TASK_DESC)

async def tasks_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.message.from_user.id)
    data = load_data()
    if user_id not in data["users"]:
        await update.message.reply_text(MSG_NOT_REGISTERED)
        return

    tasks = data["users"][user_id]["tasks"]
    if not tasks:
        await update.message.reply_text(MSG_NO_TASKS)
        return

    await update.message.reply_text(MSG_TASKS_HEADER)

    # Har bir bajarilmagan vazifa uchun alohida xabar + tugmalar
    for idx, task in enumerate(tasks):
        task_dt = datetime.strptime(task["datetime"], "%Y-%m-%d %H:%M")
        time_str = task_dt.strftime("%m-%d %H:%M")
        status_emoji = "✅" if task["done"] else "⏳"
        text = f"{status_emoji} <b>{task['description']}</b>\n🕓 {time_str}"

        if not task["done"]:
            keyboard = InlineKeyboardMarkup([[
                InlineKeyboardButton("✅ Bajardim", callback_data=f"done_{user_id}_{idx}"),
                InlineKeyboardButton("❌ Bajarmadim", callback_data=f"notdone_{user_id}_{idx}")
            ]])
            await update.message.reply_text(text, reply_markup=keyboard, parse_mode='HTML')
        else:
            await update.message.reply_text(text, parse_mode='HTML')

async def today_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.message.from_user.id)
    data = load_data()
    if user_id not in data["users"]:
        await update.message.reply_text(MSG_NOT_REGISTERED)
        return

    today_str = datetime.now().strftime("%Y-%m-%d")
    pending_today = [t for t in data["users"][user_id]["tasks"] if t["datetime"].startswith(today_str) and not t["done"]]

    if pending_today:
        msg_list = ""
        for t in pending_today:
            msg_list += f"⏰ {t['datetime'][11:]} — {t['description']}\n"
        await update.message.reply_text(MSG_TODAY_REMINDER.format(list=msg_list))

    all_today = [t for t in data["users"][user_id]["tasks"] if t["datetime"].startswith(today_str)]
    if not all_today:
        await update.message.reply_text(MSG_NO_TODAY)
        return

    msg = MSG_TODAY_HEADER.format(date=today_str[5:10]) + "\n\n"
    for t in all_today:
        status = "✅" if t["done"] else "⏳"
        msg += f"{status} {t['description']} — {t['datetime'][11:]}\n"
    await update.message.reply_text(msg)

async def tomorrow_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.message.from_user.id)
    data = load_data()
    if user_id not in data["users"]:
        await update.message.reply_text(MSG_NOT_REGISTERED)
        return

    tomorrow = (datetime.now() + timedelta(days=1))
    tomorrow_str = tomorrow.strftime("%Y-%m-%d")
    tomorrow_date_display = tomorrow.strftime("%m-%d")

    tasks = [t for t in data["users"][user_id]["tasks"] if t["datetime"].startswith(tomorrow_str)]
    if tasks:
        msg = MSG_TOMORROW_HEADER.format(date=tomorrow_date_display) + "\n\n"
        for t in tasks:
            status = "✅" if t["done"] else "⏳"
            msg += f"{status} {t['description']} — {t['datetime'][11:]}\n"
        await update.message.reply_text(msg)
    else:
        await update.message.reply_text(MSG_NO_TOMORROW)

    await update.message.reply_text(MSG_TOMORROW_ADD)
    context.user_data['state'] = 'task_desc'
    context.user_data['tomorrow_add'] = True
    context.user_data['fixed_date'] = tomorrow_date_display

async def weekly_report(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.message.from_user.id)
    data = load_data()
    if user_id not in data["users"]:
        await update.message.reply_text(MSG_NOT_REGISTERED)
        return

    now = datetime.now()
    start_of_week = now - timedelta(days=now.weekday())
    end_of_week = start_of_week + timedelta(days=6)

    week_tasks = [t for t in data["users"][user_id]["tasks"]
                  if start_of_week <= datetime.strptime(t["datetime"], "%Y-%m-%d %H:%M") <= end_of_week]

    if not week_tasks:
        await update.message.reply_text("😔 Bu haftaga vazifa yo'q.")
        return

    msg = "📊 Haftalik hisobot:\n\n"
    done_count = sum(1 for t in week_tasks if t["done"])
    for t in week_tasks:
        status = "✅" if t["done"] else "❌"
        msg += f"{status} {t['description']} — {t['datetime'][5:16]}\n"
    msg += f"\n📈 Natija: {done_count}/{len(week_tasks)} ta bajarildi!"
    await update.message.reply_text(msg)

async def stats_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.message.from_user.id)
    data = load_data()
    if user_id not in data["users"]:
        await update.message.reply_text(MSG_NOT_REGISTERED)
        return
    tasks = data["users"][user_id]["tasks"]
    total = len(tasks)
    done = sum(1 for t in tasks if t["done"])
    not_done = total - done
    today_count = len([t for t in tasks if t["datetime"].startswith(datetime.now().strftime("%Y-%m-%d")) and not t["done"]])
    await update.message.reply_text(MSG_STATS.format(total=total, done=done, not_done=not_done, today=today_count))

async def motivation_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    quote = random.choice(MOTIVATIONAL_QUOTES)
    await update.message.reply_text(MSG_EXTRA_MOTIVATION.format(quote=quote))

async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(MSG_BOT_INFO)

# === XABAR ISHLOVCHI ===
async def message_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.message.from_user.id)
    text = update.message.text.strip()
    state = context.user_data.get('state')
    if not state:
        return

    data = load_data()
    if state == 'name':
        data["users"][user_id] = {"name": text, "tasks": [], "logs": []}
        save_data(data)
        context.user_data.pop('state')
        await update.message.reply_text(f"🎉 Ro'yxatdan o'tdingiz, {text}!\n\n" + MSG_BOT_INFO)
        return

    if state == 'task_desc':
        context.user_data['task_desc'] = text
        context.user_data['state'] = 'task_datetime'
        if context.user_data.get('tomorrow_add'):
            tomorrow = (datetime.now() + timedelta(days=1)).strftime("%m-%d")
            await update.message.reply_text(f"📆 Ertangi sana: {tomorrow}\n\nVaqtni kiriting (HH:MM):")
        else:
            await update.message.reply_text(MSG_TASK_DATE_TIME)
        return

    if state == 'task_datetime':
        try:
            if context.user_data.get('tomorrow_add'):
                time_part = text
                date_part = context.user_data['fixed_date']
            else:
                parts = text.split()
                if len(parts) != 2:
                    raise ValueError
                date_part, time_part = parts

            full_date_str = f"{DEFAULT_YEAR}-{date_part}"
            full_dt_str = f"{full_date_str} {time_part}"
            full_dt = datetime.strptime(full_dt_str, "%Y-%m-%d %H:%M")
            if full_dt < datetime.now():
                raise ValueError("past")

            task = {
                "description": context.user_data['task_desc'],
                "datetime": full_dt_str,
                "done": False,
                "reminded": False,
                "last_overdue_reminder": None
            }
            data["users"][user_id]["tasks"].append(task)
            save_data(data)
            await update.message.reply_text(MSG_TASK_ADDED.format(desc=task["description"], dt=task["datetime"]))
            context.user_data.clear()
        except ValueError as e:
            if str(e) == "past":
                await update.message.reply_text(MSG_PAST_TIME)
            else:
                await update.message.reply_text(MSG_INVALID_FORMAT)

# === CALLBACK ===
async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data_parts = query.data.split('_')
    action = data_parts[0]
    user_id = data_parts[1]
    task_index = int(data_parts[2])

    data = load_data()
    user = data["users"].get(user_id)
    if user and task_index < len(user["tasks"]):
        task = user["tasks"][task_index]
        if action == 'done':
            task["done"] = True
            await query.edit_message_text(text=query.message.text + "\n\n🎉 Bajarildi! Ajoyib ish!", parse_mode='HTML')
        elif action == 'notdone':
            await query.edit_message_text(text=query.message.text + "\n\n😔 Keyingi safar! Ishonamiz sizga 💪", parse_mode='HTML')
        save_data(data)

# === ESLATMA VA QO'SHIMCHA ESLATMA ===
async def check_reminders(context: ContextTypes.DEFAULT_TYPE):
    data = load_data()
    now = datetime.now()
    for user_id, user in data["users"].items():
        for idx, task in enumerate(user["tasks"]):
            if task["done"]:
                continue
            task_dt = datetime.strptime(task["datetime"], "%Y-%m-%d %H:%M")
            if task_dt <= now:
                # Birinchi eslatma
                if not task.get("reminded", False):
                    keyboard = InlineKeyboardMarkup([[
                        InlineKeyboardButton("✅ Bajardim", callback_data=f"done_{user_id}_{idx}"),
                        InlineKeyboardButton("❌ Bajarmadim", callback_data=f"notdone_{user_id}_{idx}")
                    ]])
                    await context.bot.send_message(
                        chat_id=int(user_id),
                        text=MSG_REMINDER.format(desc=task["description"]),
                        reply_markup=keyboard
                    )
                    task["reminded"] = True
                    task["last_overdue_reminder"] = now.strftime("%Y-%m-%d %H:%M:%S")
                    save_data(data)

                # Har soatda qo'shimcha eslatma
                else:
                    last_str = task.get("last_overdue_reminder")
                    if last_str:
                        last_reminder = datetime.strptime(last_str, "%Y-%m-%d %H:%M:%S")
                        if now >= last_reminder + timedelta(hours=1):
                            msg = random.choice(OVERDUE_REMINDERS).format(desc=task["description"])
                            keyboard = InlineKeyboardMarkup([[
                                InlineKeyboardButton("✅ Bajardim", callback_data=f"done_{user_id}_{idx}"),
                                InlineKeyboardButton("❌ Bajarmadim", callback_data=f"notdone_{user_id}_{idx}")
                            ]])
                            await context.bot.send_message(
                                chat_id=int(user_id),
                                text=msg,
                                reply_markup=keyboard
                            )
                            task["last_overdue_reminder"] = now.strftime("%Y-%m-%d %H:%M:%S")
                            save_data(data)

# === ERTALABKI MOTIVATSIYA ===
async def send_daily_motivation(context: ContextTypes.DEFAULT_TYPE):
    data = load_data()
    for user_id in data["users"]:
        quote = random.choice(MOTIVATIONAL_QUOTES)
        await context.bot.send_message(
            chat_id=int(user_id),
            text=f"☀️ Ertalabki motivatsiya:\n\n{quote}\n\nBugun yangi g'alabalarga tayyor bo'ling! 🚀"
        )

# === MAIN ===
if __name__ == '__main__':
    application = Application.builder().token(BOT_TOKEN).build()

    application.add_handler(CommandHandler('start', start))
    application.add_handler(CommandHandler('addtask', addtask))
    application.add_handler(CommandHandler('tasks', tasks_cmd))
    application.add_handler(CommandHandler('today', today_cmd))
    application.add_handler(CommandHandler('tomorrow', tomorrow_cmd))
    application.add_handler(CommandHandler('weekly', weekly_report))
    application.add_handler(CommandHandler('stats', stats_cmd))
    application.add_handler(CommandHandler('motivation', motivation_cmd))
    application.add_handler(CommandHandler('help', help_cmd))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, message_handler))
    application.add_handler(CallbackQueryHandler(callback_handler))

    job_queue = application.job_queue
    job_queue.run_repeating(check_reminders, interval=30, first=5)
    job_queue.run_daily(send_daily_motivation, time=time(6, 0))

    print("🤖 To'liq zamonaviy TodoBot ishga tushdi!")
    application.run_polling()