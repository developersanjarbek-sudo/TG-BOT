const fs = require('fs');
const path = require('path');
const { Telegraf, Markup, session } = require('telegraf');
const dotenv = require('dotenv');
const cron = require('node-cron');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');

dayjs.extend(customParseFormat);

dotenv.config();
const BOT_TOKEN = process.env.BOT_TOKEN;
const DATA_FILE = 'data.json';
const DEFAULT_YEAR = 2026;

// Motivatsiya so'zlari
const MOTIVATIONAL_QUOTES = [
    "💪 Bugun qilayotgan kichik harakating ertaga katta natijaga aylanadi, shuning uchun sekin bo‘lsa ham to‘xtamasdan davom et.",
    "🔥 Hech kim kelib seni o‘zgartirib bermaydi, hayotingni yaxshilash faqat o‘zingning qaroring va harakatingga bog‘liq.",
    "🚀 Mukammal vaqtni kutma, aynan hozir boshlangan ish eng to‘g‘ri tanlov bo‘lishi mumkin.",
    "🧠 Fikrlash tarzing o‘zgarsa, qarorlaring o‘zgaradi, qarorlaring o‘zgarsa butun hayoting boshqacha yo‘lga kiradi.",
    "⏳ Vaqt juda qimmat, uni to‘g‘ri ishlatgan inson hech qachon yo‘qotmaydi.",
    "🏆 Yutish hech qachon tasodif bo‘lmaydi, bu har kuni qilingan intizomli mehnatning natijasidir.",
    "⚡ Charchayotganing rivojlanayotganing belgisi, lekin charchoqni bahona qilib to‘xtab qolma.",
    "🧱 Qiyinchiliklar seni sindirish uchun emas, balki ichingdagi kuchni uyg‘otish uchun keladi.",
    "🌱 Har kuni ozgina yaxshilanish ham katta o‘zgarishga olib keladi, faqat izchil bo‘l.",
    "🪞 Sening eng katta raqibing kechagi o‘zing, bugun undan kuchliroq bo‘lishga harakat qil.",
    "🔑 Bahona izlaganlar sabab topadi, natija istaganlar esa yo‘l topadi.",
    "🕰️ Bugun sabr qilgan inson ertaga pushaymon bo‘lmaydi, chunki u o‘z ustida ishlagan bo‘ladi.",
    "🧭 Maqsadsiz harakat seni charchatadi, aniq yo‘l esa seni kuchli qiladi.",
    "🌤️ Bugun qiyin bo‘lishi mumkin, lekin aynan shu kunlar kelajakdagi g‘ururingni yaratadi.",
    "🏔️ Oson yo‘l hamma uchun ochiq, lekin cho‘qqiga faqat sabr qilganlar chiqadi.",
    "🔄 Agar natija o‘zgarmayotgan bo‘lsa, demak harakatni o‘zgartirish vaqti kelgan.",
    "💼 O‘zingga sarflagan vaqt va kuch hech qachon bekorga ketmaydi, bu eng foydali investitsiya.",
    "🧩 Hayotingdagi har bir sinov seni keyingi bosqichga tayyorlaydi, agar taslim bo‘lmasang.",
    "🌙 Bugun ko‘pchilik uxlayotgan paytda qilgan mehnating ertaga seni boshqalardan ajratib turadi.",
    "🔥 Kuchli bo‘lish uchun hamma narsa oson bo‘lishi shart emas, ba’zan og‘riq ham o‘stiradi.",
    "🧠 Fikrlaringni nazorat qil, chunki ular sening kayfiyating va harakatingni boshqaradi.",
    "🚦 To‘xtab qolish eng xavfli qaror, sekin yurish esa baribir oldinga harakatdir.",
    "🛠️ Bugun qurgan poydevoring ertaga mustahkam hayot bo‘lib qaytadi, shuni unutma.",
    "🌍 Boshqalarning fikri bilan yashasang, hech qachon o‘zing bo‘la olmaysan.",
    "💥 Taslim bo‘lish eng oson yo‘l, lekin afsus ham aynan shu yo‘ldan keladi.",
    "🕊️ O‘zingni kechagi xatolaring bilan emas, bugungi harakating bilan bahola.",
    "📈 Natija darrov ko‘rinmasligi mumkin, lekin u albatta keladi.",
    "🔒 Intizom bo‘lmagan joyda barqaror natija bo‘lmaydi, buni yodda tut.",
    "🎯 Aniq maqsad bo‘lmasa, kuch ham behuda ketadi.",
    "⚙️ Har kuni qilinadigan kichik odatlar katta hayotni yaratadi, aynan shu sirni tushun.",
    "🌞 Har tong yangi imkoniyat bilan keladi, faqat uni ko‘ra bilish kerak.",
    "🪜 Har bir qadam seni yuqoriga olib chiqmasligi mumkin, lekin baribir oldinga siljitadi.",
    "🧠 O‘zingga ishonishni o‘rgan, chunki sendan boshqa hech kim buni sen uchun qilmaydi.",
    "🛑 Bugun yo‘q deyishni bilgan inson ertaga o‘ziga rahmat aytadi.",
    "🌊 Hayot seni sinab ko‘rishi mumkin, lekin taslim bo‘lish sening tanloving.",
    "🔥 Ichingdagi imkoniyatlar sen o‘ylagandan ancha katta, faqat ularni uyg‘ot.",
    "🧭 Yo‘ldan adashganing mag‘lubiyat emas, to‘xtab qolganing mag‘lubiyat.",
    "⏰ Ertaga boshlayman degan fikr ko‘pincha hech qachon degan ma’noni anglatadi.",
    "🏗️ Bugun qiyin bo‘lsa ham mehnat qil, ertaga oson hayot shu yerda quriladi.",
    "🌟 Sabr bilan qilingan mehnat har doim o‘z mevasini beradi, kech bo‘lsa ham.",
    "🪨 Qattiq bo‘lish shart emas, bardoshli bo‘lish yetarli.",
    "🔄 O‘zgarish qo‘rqinchli tuyulishi mumkin, lekin rivoj aynan shu yerda boshlanadi.",
    "📚 Bilimingni oshirishga sarflagan har bir daqiqa kelajakda seni kuchli qiladi.",
    "🧗 Har bir cho‘qqi avval qiyin ko‘rinadi, lekin chiqib bo‘lmas degani emas.",
    "💡 Aql bilan qilingan harakat kuchsiz mehnatdan ustun bo‘ladi.",
    "🧱 Bugungi qiyinchiliklar seni sindirmasa, ertaga hech narsa sindira olmaydi.",
    "🚶 Sekin bo‘lsa ham oldinga yur, orqaga qaytishdan ko‘ra ming marta yaxshi.",
    "🛡️ O‘zingni bahona bilan emas, mehnating bilan himoya qil.",
    "🔑 Hayotingdagi eng muhim qaror taslim bo‘lmaslik, buni unutma.",
    " Bugun o‘z ustingda ishlagan inson ertaga boshqalarga ilhom bo‘ladi."
];

// O'tgan vazifalar uchun qo'shimcha eslatmalar
const OVERDUE_REMINDERS = [
    "🔔 Vazifani bajarmaysizmi? Vaqti o'tib ketdi! Bajarib qo'ying, maqsadingizga yaqinlashasiz 💪",
    "⚠️ {desc} hali bajarilmagan. Endi bajaring, keyin osonlashadi! 🚀",
    "😊 Vazifangiz kutmoqda: {desc}. Bajarmaysizmi? Harakat qiling, muvaffaqiyat yaqin! 🌟",
    "📌 {desc} vaqti o'tgan. Bajarib qo'ying, keyin dam oling! 😌"
];

// Xabarlar
const MSG_WELCOME = "Assalomu Alaykum Todo botimizga xush kelibsiz\nIltimos ismingizni kiriting";
const MSG_ALREADY_REG = "😊 Salom, {name}! Bugun ham maqsadlar sari birga vazifa bajaramiz degan umid qilaman 💪";
const MSG_BOT_INFO = (
    "🚀 Daily TODO   — zamonaviy va aqlli vazifa menejeri hamda motivator!\n\n" +
    "🕒 Yilni  samarali rejalashtiring.\n" +
    "Siz faqat oy, kun va vaqtni kiritasiz — bot qolganini o‘zi aniqlaydi ⏰\n\n" +
    "🔥 Mavjud buyruqlar va ularning vazifalari:\n\n" +
    "/addtask — Yangi vazifa qo‘shish ➕\n" +
    "Vazifa nomi, sana va vaqtni tez va oson kiritish imkoniyati.\n\n" +
    "/tasks — Barcha vazifalar ro‘yxati 📋\n" +
    "Bajarilgan va bajarilmagan vazifalar ko‘rinadi.\n" +
    "Bajarilmagan vazifalar uchun qulay tugmalar mavjud.\n\n" +
    "/today — Bugungi vazifalar 📅\n" +
    "Bugun bajarilishi kerak bo‘lgan ishlar va eslatmalar.\n\n" +
    "/tomorrow — Ertangi vazifalar 🗓️\n" +
    "Ertangi rejalaringiz va tezkor vazifa qo‘shish imkoniyati.\n\n" +
    "/weekly — Haftalik hisobot 📊\n" +
    "So‘nggi 7 kunlik faoliyatingiz tahlili.\n\n" +
    "/stats — Statistika 📈\n" +
    "Umumiy vazifalar, bajarilgan ishlar va samaradorlik ko‘rsatkichlari.\n\n" +
    "/motivation — Motivatsiya 🌟\n" +
    "Kunni ilhom bilan davom ettirish uchun motivatsion xabarlar.\n\n" +
    "/help — Yordam ❓\n" +
    "Botdan foydalanish bo‘yicha to‘liq qo‘llanma.\n\n" +
    "💬 Takliflaringiz, fikrlaringiz yoki qandaydir muammo bo‘lsa — bemalol yozing 😊\n" +
    "👉 @otabekovsanjarbek\n" +
    "Sizning har bir xabaringiz biz uchun muhim va botni yanada qulay qilishga yordam beradi 🚀"
);
const MSG_TASK_DESC = "✏️ Vazifa tavsifini kiriting:";
const MSG_TASK_DATE_TIME = "📆 Oy-kun va vaqtni yozing (MM.DD HH:MM):\nMisol: 01.15 14:30";
const MSG_TASK_ADDED = "✅ Vazifa qo'shildi!\n📌 {desc}\n🕓 {dt}";
const MSG_REMINDER = "🔔 Eslatma! Vaqti keldi:\n📌 {desc}\n\nBajardingizmi?";
const MSG_DONE = "🎉 Ajoyib! Vazifa bajarildi! Davom eting 🔥";
const MSG_NOT_DONE = "😔 Keyingi safar albatta! Ishonamiz sizga 💪";
const MSG_NO_TASKS = "😌 Hozircha vazifa yo'q. Yangi qo'shing!";
const MSG_TASKS_HEADER = "📋 Vazifalaringiz:";
const MSG_TODAY_HEADER = "📅 Bugungi vazifalar ({date}):";
const MSG_TODAY_REMINDER = "⚠️ Bugun bajarilmagan vazifalar bor!\n\n{list}\nMuvaffaqiyatli kun! 🚀";
const MSG_NO_TODAY = "🎯 Bugun vazifa yo'q — dam olishingiz mumkin!";
const MSG_TOMORROW_HEADER = "🗓️ Ertangi vazifalar ({date}):";
const MSG_NO_TOMORROW = "🛌 Ertaga vazifa yo'q — hozir qo'shishingiz mumkin!";
const MSG_TOMORROW_ADD = "🗓️ Ertangi vazifa qo'shmoqchimisiz?\n\n✏️ Tavsifni yozing:";
const MSG_INVALID_FORMAT = "❌ Noto'g'ri format. MM.DD HH:MM ko'rinishida yozing.\nMisol: 02.10 09:00";
const MSG_PAST_TIME = "⏰ Bu vaqt o'tib ketgan. Kelajakdagi vaqtni tanlang.";
const MSG_NOT_REGISTERED = "🚫 Avval /start bilan ro'yxatdan o'ting.";
const MSG_STATS = (
    "📈 Statistika:\n\n" +
    "Jami vazifalar: {total} 📝\n" +
    "Bajarilgan: {done} ✅\n" +
    "Bajarilmagan: {not_done} ❌\n" +
    "Bugun bajarilmagan: {today} 🎯\n\n" +
    "Har bir qadam muhim! 🌟"
);
const MSG_EXTRA_MOTIVATION = "🌟 Motivatsiya:\n{quote}";

function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
    return { users: {} };
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 4), 'utf-8');
}

const bot = new Telegraf(BOT_TOKEN);
bot.use(session({ defaultSession: () => ({}) }));

// === BUYRUQLAR ===
bot.command('start', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    if (!data.users[userId]) {
        ctx.session.state = 'name';
        await ctx.reply(MSG_WELCOME);
    } else {
        const name = data.users[userId].name;
        await ctx.reply(MSG_ALREADY_REG.replace('{name}', name) + "\n\n" + MSG_BOT_INFO);
    }
});

bot.command('addtask', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    if (!data.users[userId]) {
        await ctx.reply(MSG_NOT_REGISTERED);
        return;
    }
    ctx.session.state = 'task_desc';
    ctx.session.tomorrow_add = false;
    await ctx.reply(MSG_TASK_DESC);
});

bot.command('tasks', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    if (!data.users[userId]) {
        await ctx.reply(MSG_NOT_REGISTERED);
        return;
    }

    const tasks = data.users[userId].tasks || [];
    if (tasks.length === 0) {
        await ctx.reply(MSG_NO_TASKS);
        return;
    }

    await ctx.reply(MSG_TASKS_HEADER);

    for (let idx = 0; idx < tasks.length; idx++) {
        const task = tasks[idx];
        const taskDt = dayjs(task.datetime, 'YYYY-MM-DD HH:mm');
        const timeStr = taskDt.format('MM.DD HH:mm');
        const statusEmoji = task.done ? '✅' : '⏳';
        const text = `${statusEmoji} <b>${task.description}</b>\n🕓 ${timeStr}`;

        if (!task.done) {
            const keyboard = Markup.inlineKeyboard([
                Markup.button.callback('✅ Bajardim', `done_${userId}_${idx}`),
                Markup.button.callback('❌ Bajarmadim', `notdone_${userId}_${idx}`)
            ]);
            await ctx.replyWithHTML(text, keyboard);
        } else {
            await ctx.replyWithHTML(text);
        }
    }
});

bot.command('today', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    if (!data.users[userId]) {
        await ctx.reply(MSG_NOT_REGISTERED);
        return;
    }

    const todayStr = dayjs().format('YYYY-MM-DD');
    const todayDisplay = dayjs().format('MM.DD');
    const pendingToday = data.users[userId].tasks.filter(t => t.datetime.startsWith(todayStr) && !t.done);

    if (pendingToday.length > 0) {
        let msgList = '';
        for (const t of pendingToday) {
            msgList += `⏰ ${t.datetime.slice(11)} — ${t.description}\n`;
        }
        await ctx.reply(MSG_TODAY_REMINDER.replace('{list}', msgList));
    }

    const allToday = data.users[userId].tasks.filter(t => t.datetime.startsWith(todayStr));
    if (allToday.length === 0) {
        await ctx.reply(MSG_NO_TODAY);
        return;
    }

    let msg = MSG_TODAY_HEADER.replace('{date}', todayDisplay) + "\n\n";
    for (const t of allToday) {
        const status = t.done ? '✅' : '⏳';
        msg += `${status} ${t.description} — ${t.datetime.slice(11)}\n`;
    }
    await ctx.reply(msg);
});

bot.command('tomorrow', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    if (!data.users[userId]) {
        await ctx.reply(MSG_NOT_REGISTERED);
        return;
    }

    const tomorrow = dayjs().add(1, 'day');
    const tomorrowStr = tomorrow.format('YYYY-MM-DD');
    const tomorrowDateDisplay = tomorrow.format('MM.DD');

    const tasks = data.users[userId].tasks.filter(t => t.datetime.startsWith(tomorrowStr));
    if (tasks.length > 0) {
        let msg = MSG_TOMORROW_HEADER.replace('{date}', tomorrowDateDisplay) + "\n\n";
        for (const t of tasks) {
            const status = t.done ? '✅' : '⏳';
            msg += `${status} ${t.description} — ${t.datetime.slice(11)}\n`;
        }
        await ctx.reply(msg);
    } else {
        await ctx.reply(MSG_NO_TOMORROW);
    }

    await ctx.reply(MSG_TOMORROW_ADD);
    ctx.session.state = 'task_desc';
    ctx.session.tomorrow_add = true;
    ctx.session.fixed_date = tomorrowDateDisplay;
});

bot.command('weekly', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    if (!data.users[userId]) {
        await ctx.reply(MSG_NOT_REGISTERED);
        return;
    }

    const now = dayjs();
    const startOfWeek = now.subtract(now.day(), 'day'); // Assuming Monday start, adjust if needed
    const endOfWeek = startOfWeek.add(6, 'day');

    const weekTasks = data.users[userId].tasks.filter(t => {
        const taskDt = dayjs(t.datetime, 'YYYY-MM-DD HH:mm');
        return taskDt.isAfter(startOfWeek.subtract(1, 'second')) && taskDt.isBefore(endOfWeek.add(1, 'second'));
    });

    if (weekTasks.length === 0) {
        await ctx.reply("😔 Bu haftaga vazifa yo'q.");
        return;
    }

    let msg = "📊 Haftalik hisobot:\n\n";
    let doneCount = 0;
    for (const t of weekTasks) {
        const status = t.done ? '✅' : '❌';
        const timeStr = dayjs(t.datetime).format('MM.DD HH:mm');
        msg += `${status} ${t.description} — ${timeStr}\n`;
        if (t.done) doneCount++;
    }
    msg += `\n📈 Natija: ${doneCount}/${weekTasks.length} ta bajarildi!`;
    await ctx.reply(msg);
});

bot.command('stats', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    if (!data.users[userId]) {
        await ctx.reply(MSG_NOT_REGISTERED);
        return;
    }
    const tasks = data.users[userId].tasks || [];
    const total = tasks.length;
    const done = tasks.filter(t => t.done).length;
    const notDone = total - done;
    const todayStr = dayjs().format('YYYY-MM-DD');
    const todayCount = tasks.filter(t => t.datetime.startsWith(todayStr) && !t.done).length;
    await ctx.reply(MSG_STATS
        .replace('{total}', total)
        .replace('{done}', done)
        .replace('{not_done}', notDone)
        .replace('{today}', todayCount)
    );
});

bot.command('motivation', async (ctx) => {
    const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
    await ctx.reply(MSG_EXTRA_MOTIVATION.replace('{quote}', quote));
});

bot.command('help', async (ctx) => {
    await ctx.reply(MSG_BOT_INFO);
});

// === XABAR ISHLOVCHI ===
bot.on('text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return; // Commands handled separately
    const userId = ctx.from.id.toString();
    const text = ctx.message.text.trim();
    const state = ctx.session.state;
    if (!state) return;

    const data = loadData();
    if (state === 'name') {
        data.users[userId] = { name: text, tasks: [], logs: [] };
        saveData(data);
        delete ctx.session.state;
        await ctx.reply(`🎉 Ro'yxatdan o'tdingiz, ${text}!\n\n` + MSG_BOT_INFO);
        return;
    }

    if (state === 'task_desc') {
        ctx.session.task_desc = text;
        ctx.session.state = 'task_datetime';
        if (ctx.session.tomorrow_add) {
            const tomorrow = dayjs().add(1, 'day').format('MM.DD');
            await ctx.reply(`📆 Ertangi sana: ${tomorrow}\n\nVaqtni kiriting (HH:MM):`);
        } else {
            await ctx.reply(MSG_TASK_DATE_TIME);
        }
        return;
    }

    if (state === 'task_datetime') {
        try {
            let datePart, timePart;
            if (ctx.session.tomorrow_add) {
                timePart = text;
                datePart = ctx.session.fixed_date;
            } else {
                const parts = text.split(' ');
                if (parts.length !== 2) throw new Error('format');
                datePart = parts[0];
                timePart = parts[1];
            }

            // Sana formatini MM.DD dan MM-DD ga o'zgartirish (saqlash uchun ichki format)
            const normalizedDatePart = datePart.replace('.', '-');
            const fullDateStr = `${DEFAULT_YEAR}-${normalizedDatePart}`;
            const fullDtStr = `${fullDateStr} ${timePart}`;
            const fullDt = dayjs(fullDtStr, 'YYYY-MM-DD HH:mm');
            if (!fullDt.isValid()) throw new Error('format');
            if (fullDt.isBefore(dayjs())) throw new Error('past');

            const task = {
                description: ctx.session.task_desc,
                datetime: fullDtStr,
                done: false,
                reminded: false,
                last_overdue_reminder: null
            };
            data.users[userId].tasks.push(task);
            saveData(data);
            const displayDt = fullDt.format('MM.DD HH:mm');
            await ctx.reply(MSG_TASK_ADDED.replace('{desc}', task.description).replace('{dt}', displayDt));
            ctx.session = {};
        } catch (e) {
            if (e.message === 'past') {
                await ctx.reply(MSG_PAST_TIME);
            } else {
                await ctx.reply(MSG_INVALID_FORMAT);
            }
        }
    }
});

// === CALLBACK ===
bot.on('callback_query', async (ctx) => {
    const query = ctx.callbackQuery;
    await ctx.answerCbQuery(); // Telegraf v4 uchun to'g'ri

    const dataParts = query.data.split('_');
    const action = dataParts[0];
    const userId = dataParts[1];
    const taskIndex = parseInt(dataParts[2]);

    if (!userId || isNaN(taskIndex)) return;

    const data = loadData();
    const user = data.users[userId];
    if (!user || taskIndex >= user.tasks.length) return;

    const task = user.tasks[taskIndex];
    const taskDt = dayjs(task.datetime, 'YYYY-MM-DD HH:mm');
    const formattedDt = taskDt.format('MM.DD HH:mm'); // Nuqta bilan

    if (action === 'done') {
        task.done = true;
        await ctx.editMessageText(
            query.message.text.replace(/⏳/, '✅') + `\n🕓 ${formattedDt}\n\n🎉 Bajarildi! Ajoyib ish!`,
            { parse_mode: 'HTML' }
        );
        await ctx.reply(MSG_DONE);
    } else if (action === 'notdone') {
        await ctx.editMessageText(
            query.message.text + `\n🕓 ${formattedDt}\n\n😔 Keyingi safar! Ishonamiz sizga 💪`,
            { parse_mode: 'HTML' }
        );
        await ctx.reply(MSG_NOT_DONE);
    }
    saveData(data);
});

// === ESLATMA VA QO'SHIMCHA ESLATMA ===
async function checkReminders() {
    const data = loadData();
    const now = dayjs();
    for (const userId in data.users) {
        const user = data.users[userId];
        for (let idx = 0; idx < user.tasks.length; idx++) {
            const task = user.tasks[idx];
            if (task.done) continue;
            const taskDt = dayjs(task.datetime, 'YYYY-MM-DD HH:mm');
            if (taskDt.isBefore(now) || taskDt.isSame(now)) {
                // Birinchi eslatma
                if (!task.reminded) {
                    const keyboard = Markup.inlineKeyboard([
                        Markup.button.callback('✅ Bajardim', `done_${userId}_${idx}`),
                        Markup.button.callback('❌ Bajarmadim', `notdone_${userId}_${idx}`)
                    ]);
                    await bot.telegram.sendMessage(
                        userId,
                        MSG_REMINDER.replace('{desc}', task.description),
                        keyboard
                    );
                    task.reminded = true;
                    task.last_overdue_reminder = now.format('YYYY-MM-DD HH:mm:ss');
                    saveData(data);
                } else {
                    // Har soatda qo'shimcha eslatma
                    const lastStr = task.last_overdue_reminder;
                    if (lastStr) {
                        const lastReminder = dayjs(lastStr, 'YYYY-MM-DD HH:mm:ss');
                        if (now.isAfter(lastReminder.add(1, 'hour'))) {
                            const msg = OVERDUE_REMINDERS[Math.floor(Math.random() * OVERDUE_REMINDERS.length)].replace('{desc}', task.description);
                            const keyboard = Markup.inlineKeyboard([
                                Markup.button.callback('✅ Bajardim', `done_${userId}_${idx}`),
                                Markup.button.callback('❌ Bajarmadim', `notdone_${userId}_${idx}`)
                            ]);
                            await bot.telegram.sendMessage(
                                userId,
                                msg,
                                keyboard
                            );
                            task.last_overdue_reminder = now.format('YYYY-MM-DD HH:mm:ss');
                            saveData(data);
                        }
                    }
                }
            }
        }
    }
}

// === ERTALABKI MOTIVATSIYA ===
async function sendDailyMotivation() {
    const data = loadData();
    for (const userId in data.users) {
        const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
        await bot.telegram.sendMessage(
            userId,
            `☀️ Ertalabki motivatsiya:\n\n${quote}\n\nBugun yangi g'alabalarga tayyor bo'ling! 🚀`
        );
    }
}

// Scheduling
setInterval(checkReminders, 30 * 1000); // Every 30 seconds
cron.schedule('0 6 * * *', sendDailyMotivation); // Daily at 6:00

console.log("🤖 To'liq zamonaviy TodoBot ishga tushdi!");
bot.launch();

// Handle graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));