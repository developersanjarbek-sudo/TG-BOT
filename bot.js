const fs = require('fs');
const path = require('path');
const https = require('https');
const { Telegraf, Markup, session } = require('telegraf');
const dotenv = require('dotenv');
const cron = require('node-cron');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
const express = require('express');
const crypto = require('crypto');
const LOCALES = require('./locales');

// Konfiguratsiya
dayjs.extend(customParseFormat);
dayjs.extend(isSameOrBefore);
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Xavfsizlik: ADMIN_ID va BOT_TOKEN terminalda ko'rsatilmaydi

// Doimiy o'zgaruvchilar
const XP_PER_TASK = 15;
const XP_PER_HABIT = 10;
const DAILY_BONUS_XP = 50;
const LEVELS = {
    1: { xp: 0, name: "🌱 Yangi" },
    2: { xp: 200, name: "🥉 Boshlovchi" },
    3: { xp: 500, name: "🥈 Faol" },
    4: { xp: 1000, name: "🥇 Mutaxassis" },
    5: { xp: 2000, name: "💎 Afsona" }
};

const SHOP_ITEMS = {
    statistics: { name: '📊 Pro Statistika', price: 100, desc: "Barcha bajarilgan ishlar statistikasi va grafiklar" },
    habits: { name: '🔄 Odatlar Trekeri', price: 300, desc: "Har kuni takrorlanuvchi odatlar, streak va bildirishnomalar" },
    motivation: { name: '🔥 Motivatsiya Moduli', price: 50, desc: "Har kuni ertalab motivatsion xabar va maslahatlar" },
    priorities: { name: '🚨 Prioritetlar', price: 150, desc: "Vazifalarga prioritet berish va tartiblash" },
    categories: { name: '🏷 Kategoriyalar', price: 200, desc: "Vazifalarni kategoriyalarga bo'lish" },
    reminders: { name: '🔔 Kengaytirilgan Eslatmalar', price: 250, desc: "Bir necha eslatma va takroriy bildirishnomalar" },
    goals: { name: '🎯 Maqsadlar Trekeri', price: 400, desc: "Uzoq muddatli maqsadlarni kuzatish" },
    pomodoro: { name: '⏱ Pomodoro Taymer', price: 120, desc: "Vaqt boshqaruv usuli" },
    notes: { name: '📝 Eslatmalar', price: 80, desc: "Shaxsiy eslatmalar saqlash" },
    calendar: { name: '🗓 Kalendar Integratsiyasi', price: 300, desc: "Vazifalarni kalendarga bog'lash" },
    custom_reminders: { name: '🛎 Shaxsiy Eslatmalar', price: 180, desc: "Moslashtirilgan eslatmalar" },
    progress_reports: { name: '📈 Taraqqiyot Hisobotlari', price: 220, desc: "Haftalik/oylik hisobotlar" },
    achievements: { name: '🏆 Yutuqlar', price: 100, desc: "Yutuqlar tizimi" },
    social_sharing: { name: '📤 Ijtimoiy Ulashish', price: 90, desc: "Yutuqlarni ulashish va botni do'stlarga uzatish" },
    custom_themes: { name: '🎨 Shaxsiy Temalar', price: 140, desc: "Bot interfeysini moslashtirish" },
    ai_tips: { name: '🤖 AI Maslahatlar', price: 250, desc: "AI orqali maslahatlar olish" },
    voice_notes: { name: '🎤 Ovozli Eslatmalar', price: 150, desc: "Ovozli xabarlarni saqlash va eslatish" },
    integration_apps: { name: '🔗 Ilovalar Integratsiyasi', price: 400, desc: "Boshqa ilovalar bilan bog'lanish" },
    goal_chat: { name: '🎭 Anonim Maqsadlar Chati', price: 500, desc: "Global anonim chat" }
};

function generateAnonId(userId) {
    const today = dayjs().format('YYYY-MM-DD');
    const hash = crypto.createHash('md5').update(userId + today).digest('hex');
    return 'User#' + hash.substring(0, 4).toUpperCase();
}

// --- EXPRESS SERVER ---
const app = express();
app.get('/', (req, res) => {
    const data = loadData();
    const userCount = Object.keys(data.users || {}).length;
    res.send(`Bot is running! Users: ${userCount}. Time: ${dayjs().format()}`);
});
app.listen(PORT, () => {
    console.log(`🚀 Server ${PORT}-portda ishlamoqda...`);
});

// --- MA'LUMOTLAR BAZASI ---
function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        const defaultData = { users: {}, settings: {} };
        fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 4));
        return defaultData;
    }
    try {
        const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        if (!parsed.users) parsed.users = {};
        if (!parsed.settings) parsed.settings = {};

        return parsed;
    } catch (e) {
        console.error('Data file parse error:', e);
        return { users: {}, settings: {} };
    }
}

function saveData(data) {
    if (!data.users) data.users = {};
    if (!data.settings) data.settings = {};
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 4), 'utf-8');
}

// --- BOTNI SOZLASH ---
const bot = new Telegraf(BOT_TOKEN);
// Xatolikni ushlash (Global Error Handler)
bot.catch((err, ctx) => {
    console.error(`Unhandled error while processing ${ctx.updateType}`, err);
    // Agar xatolik "query is older than 48 hours" yoki "message is not modified" bo'lsa, ularni ignor qilish mumkin
    if (err.description && (err.description.includes('query is too old') || err.description.includes('query ID is invalid'))) {
        return; // Jimgina o'tkazib yuboramiz
    }
    // Foydalanuvchiga xabar berish (ixtiyoriy)
    try {
        if (ctx.updateType === 'callback_query') {
            ctx.answerCbQuery('Xatolik yuz berdi, iltimos qaytadan urining.').catch(() => { });
        }
    } catch (e) {
        console.error('Error reporting error to user:', e);
    }
});

// Xavfsiz answerCbQuery
const safeAnswerCbQuery = async (ctx, text, alert = false) => {
    try {
        await ctx.answerCbQuery(text, { show_alert: alert });
    } catch (e) {
        console.error('Failed to answer callback query:', e.message);
    }
};

bot.use(session());

// --- YORDAMCHI FUNKSIYALAR ---
function getText(lang, key, params = {}) {
    const keys = key.split('.');
    let value = LOCALES[lang] || LOCALES['uz'];
    for (const k of keys) {
        value = value ? value[k] : null;
    }
    if (!value) {
        // Fallback to uz
        value = LOCALES['uz'];
        for (const k of keys) {
            value = value ? value[k] : null;
        }
    }
    if (!value) return key; // Keyning o'zini qaytarish

    Object.keys(params).forEach(p => {
        value = value.replace(new RegExp(`{${p}}`, 'g'), params[p]);
    });
    return value;
}

function hasSocialSharingFeature(user) {
    return user && Array.isArray(user.unlocked) && user.unlocked.includes('social_sharing');
}

function withProtectContentForUser(user, extra = {}, userId = null) {
    const options = { ...extra };
    // Admin uchun protect_content qo'shilmaydi
    if (userId && isAdmin(userId)) {
        return options;
    }
    if (!hasSocialSharingFeature(user)) {
        options.protect_content = true;
    }
    return options;
}

function withProtectContentForCtx(ctx, extra = {}) {
    const data = loadData();
    const userId = ctx.from && ctx.from.id ? ctx.from.id.toString() : null;
    const user = userId && data.users ? data.users[userId] : null;
    // Admin uchun protect_content qo'shilmaydi
    if (userId && isAdmin(userId)) {
        return extra;
    }
    return withProtectContentForUser(user, extra, userId);
}

function isAdmin(userId) {
    if (!ADMIN_ID) {
        return false;
    }
    // Ikkala tomonni ham string ga o'tkazib solishtiramiz
    const userIdStr = String(userId).trim();
    const adminIdStr = String(ADMIN_ID).trim();
    return userIdStr === adminIdStr;
}

function getUserLevel(xp) {
    let currentLevel = LEVELS[1];
    for (const level in LEVELS) {
        if (xp >= LEVELS[level].xp) currentLevel = LEVELS[level];
    }
    return currentLevel;
}

async function safeEdit(ctx, text, extra) {
    try {
        // editMessageText protect_content qo'llab-quvvatlamaydi, lekin extra ichida qolsa ham xato bermaydi
        await ctx.editMessageText(text, extra);
    } catch (e) {
        if (e.description && e.description.includes('message is not modified')) return;
        await ctx.reply(text, withProtectContentForCtx(ctx, extra || {}));
    }
}

async function deleteUserMsg(ctx) {
    try {
        if (ctx.message) await ctx.deleteMessage(ctx.message.message_id);
    } catch (e) { }
}

// --- ASOSIY MENYU ---
// --- ASOSIY MENYU ---
async function showMainMenu(ctx) {
    const userId = ctx.from.id.toString();
    const data = loadData();
    let user = data.users[userId];

    if (!user) {
        return ctx.reply("Iltimos, qaytadan /start ni bosing.");
    }

    if (user.blocked) return ctx.reply("🚫 Siz admin tomonidan bloklangansiz.");

    if (!user.settings) user.settings = { notifications: true, language: 'uz' };
    const lang = user.settings.language || 'uz';

    const level = getUserLevel(user.xp);
    const todayStr = dayjs().format('YYYY-MM-DD');
    const todayTasks = (user.tasks || []).filter(t => t.datetime.startsWith(todayStr));
    const pendingCount = todayTasks.filter(t => !t.done).length;

    const lastBonus = user.lastBonusDate || '';
    const bonusAvailable = lastBonus !== todayStr;

    const levelName = getText(lang, `levels.${Object.keys(LEVELS).find(k => LEVELS[k].name === level.name) || 1}`) || level.name;
    const theme = user.settings.theme || 'light';
    const themeEmoji = theme === 'dark' ? '🌑' : '☀️';

    let text = `${themeEmoji} ` + getText(lang, 'greeting', { name: user.name }) + "\n\n";
    text += getText(lang, 'level_prefix', { level: levelName }) + "\n";
    text += getText(lang, 'xp_prefix', { xp: user.xp }) + "\n";
    text += getText(lang, 'tasks_today', { count: pendingCount }) + "\n\n";

    if (bonusAvailable) {
        text += getText(lang, 'bonus_available') + "\n\n";
    }

    const t = (k) => getText(lang, `buttons.${k}`);

    const buttons = [
        [Markup.button.callback(t('add_task'), 'add_task')],
        [Markup.button.callback(t('today'), 'view_today'), Markup.button.callback(t('all_tasks'), 'view_all')],
        bonusAvailable ? [Markup.button.callback(t('get_bonus').replace('{xp}', DAILY_BONUS_XP), 'get_daily_bonus')] : [],
        [Markup.button.callback(t('shop'), 'view_shop'), Markup.button.callback(t('profile'), 'view_profile')],
        [Markup.button.callback(t('settings'), 'view_settings')]
    ];

    const unlocked = user.unlocked || [];

    // Dynamic Module Buttons
    const moduleActions = {
        statistics: 'view_statistics',
        habits: 'view_habits',
        motivation: 'view_motivation',
        priorities: 'view_priorities',
        categories: 'view_categories',
        reminders: 'view_reminders',
        goals: 'view_goals',
        pomodoro: 'view_pomodoro',
        notes: 'view_notes',
        calendar: 'view_calendar',
        custom_reminders: 'view_custom_reminders',
        progress_reports: 'view_progress_reports',
        achievements: 'view_achievements',
        social_sharing: 'view_social_sharing',
        custom_themes: 'view_custom_themes',
        ai_tips: 'view_ai_tips',
        voice_notes: 'view_voice_notes',
        integration_apps: 'view_integration_apps',
        goal_chat: 'enter_goal_chat'
    };

    let moduleRow = [];
    Object.keys(SHOP_ITEMS).forEach(key => {
        if (unlocked.includes(key)) {
            const action = moduleActions[key] || 'noop';
            const name = getText(lang, `shop.items.${key}.name`);
            moduleRow.push(Markup.button.callback(name, action));
            if (moduleRow.length === 2) {
                buttons.splice(buttons.length - 2, 0, moduleRow); // Insert before Settings/Contact
                moduleRow = [];
            }
        }
    });
    if (moduleRow.length > 0) buttons.splice(buttons.length - 2, 0, moduleRow);

    // Contact Admin
    buttons.push([Markup.button.url(getText(lang, 'contact_admin'), `tg://user?id=${ADMIN_ID}`)]);

    if (isAdmin(userId)) {
        buttons.push([Markup.button.callback(t('admin_panel'), 'admin_panel')]);
    }

    const cleanButtons = buttons.filter(row => row.length > 0);

    if (ctx.callbackQuery) {
        await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(cleanButtons) });
    } else {
        await ctx.reply(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(cleanButtons) });
    }
}

// --- START BUYRUG'I ---
// --- START BUYRUG'I ---
bot.start(async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();

    if (!data.users) data.users = {};

    // Bot username ni olish
    let botUsername = '';
    try {
        const botInfo = await ctx.telegram.getMe();
        botUsername = botInfo.username;
    } catch (e) {
        botUsername = ctx.botInfo?.username || '';
    }

    if (!data.users[userId]) {
        // REFERRAL CHECK
        if (ctx.startPayload && ctx.startPayload.startsWith('ref_')) {
            const refId = ctx.startPayload.replace('ref_', '');
            if (data.users[refId] && refId !== userId) {
                data.users[refId].xp += 30; // 30 XP Bonus
                bot.telegram.sendMessage(refId, `🎉 <b>Do'stingiz qo'shildi!</b>\nSizga 30 XP berildi!`, { parse_mode: 'HTML' }).catch(() => { });
                // Log referral? Maybe later.
            }
        }

        ctx.session = { state: 'register' };
        await ctx.reply(getText('uz', 'registration.welcome'), withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
    } else {
        if (!data.users[userId].settings) data.users[userId].settings = { notifications: true, language: 'uz', theme: 'light' };
        if (data.users[userId].blocked) {
            const lang = data.users[userId].settings.language || 'uz';
            return ctx.reply(getText(lang, 'registration.blocked'));
        }
        saveData(data);
        await showMainMenu(ctx);
    }
});

// --- PROFIL ---
bot.action('view_profile', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId] || {};
    const settings = user.settings || { language: 'uz' };
    const lang = settings.language;

    const level = getUserLevel(user.xp || 0);
    const unlocked = user.unlocked || [];
    const levelKey = Object.keys(LEVELS).find(k => LEVELS[k].xp === level.xp) || 1; // Assuming lookup works
    const levelName = getText(lang, `levels.${levelKey}`) || level.name;

    let text = getText(lang, 'profile.title') + "\n\n";
    text += `${getText(lang, 'profile.name')}: ${user.name || getText(lang, 'profile.unknown')}\n`;
    text += `${getText(lang, 'profile.level')}: ${levelName}\n`;
    text += `XP: ${user.xp || 0}\n`;
    text += `${getText(lang, 'profile.joined')}: ${dayjs(user.joinedAt).format('DD.MM.YYYY') || getText(lang, 'profile.unknown')}\n\n`;

    const unlockedNames = unlocked.map(k => {
        return `- ` + getText(lang, `shop.items.${k}.name`);
    });

    text += `${getText(lang, 'profile.unlocked')}:\n${unlockedNames.length ? unlockedNames.join('\n') : getText(lang, 'profile.none')}`;

    await safeEdit(ctx, text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(getText(lang, 'buttons.back_main'), 'main_menu')]])
    });
});

// --- SOZLAMALAR ---
// --- SOZLAMALAR ---
// --- SOZLAMALAR ---
bot.action('view_settings', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.settings) {
        user.settings = { notifications: true, language: 'uz', noEscapeMode: false, weeklyAnalysis: true };
        saveData(data);
    }
    const lang = user.settings.language || 'uz';

    let text = getText(lang, 'settings.title') + "\n\n";
    text += `${getText(lang, 'settings.notifications')}: ${user.settings.notifications ? getText(lang, 'settings.on') : getText(lang, 'settings.off')}\n`;
    text += `${getText(lang, 'settings.language')}: ${(user.settings.language || 'uz').toUpperCase()}\n`;
    text += `${getText(lang, 'noEscape.title')}: ${user.settings.noEscapeMode ? getText(lang, 'noEscape.enabled') : getText(lang, 'noEscape.disabled')}`;

    const buttons = [
        [Markup.button.callback(getText(lang, 'settings.toggle_notif'), 'toggle_notifications')],
        [Markup.button.callback(getText(lang, 'settings.change_lang'), 'change_language')],
        [Markup.button.callback(`${getText(lang, 'noEscape.title')} ${user.settings.noEscapeMode ? '✅' : '❌'}`, 'toggle_no_escape')],
        [Markup.button.callback(getText(lang, 'buttons.back_main'), 'main_menu')]
    ];

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('toggle_notifications', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    user.settings.notifications = !user.settings.notifications;
    saveData(data);
    const lang = user.settings.language || 'uz';
    const status = user.settings.notifications ? getText(lang, 'settings.on') : getText(lang, 'settings.off');
    await ctx.answerCbQuery(getText(lang, 'settings.notifications') + ' ' + status);
    await bot.handleUpdate({
        ...ctx.update,
        callback_query: {
            ...ctx.callbackQuery,
            data: 'view_settings'
        }
    });
});

bot.action('toggle_no_escape', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    if (!user.settings.noEscapeMode) user.settings.noEscapeMode = false;
    user.settings.noEscapeMode = !user.settings.noEscapeMode;
    saveData(data);
    const lang = user.settings.language || 'uz';
    const status = user.settings.noEscapeMode ? getText(lang, 'noEscape.enabled') : getText(lang, 'noEscape.disabled');
    await ctx.answerCbQuery(getText(lang, 'noEscape.title') + ': ' + status);
    await bot.handleUpdate({
        ...ctx.update,
        callback_query: {
            ...ctx.callbackQuery,
            data: 'view_settings'
        }
    });
});

bot.action('change_language', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const lang = user.settings.language || 'uz';

    // Instead of awaiting text input, we show inline buttons
    // ctx.session = { state: 'await_language' }; // No longer needed

    await safeEdit(ctx, getText(lang, 'settings.choose_lang'), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('🇺🇿 O\'zbekcha', 'set_lang_uz')],
            [Markup.button.callback('🇬🇧 English', 'set_lang_en')],
            [Markup.button.callback('🇷🇺 Русский', 'set_lang_ru')],
            [Markup.button.callback(getText(lang, 'buttons.back'), 'view_settings')]
        ])
    });
});

bot.action(/set_lang_(.*)/, async (ctx) => {
    const newLang = ctx.match[1];
    const userId = ctx.from.id.toString();
    const data = loadData();

    if (!data.users[userId].settings) data.users[userId].settings = {};
    data.users[userId].settings.language = newLang;
    saveData(data);

    await ctx.answerCbQuery(getText(newLang, 'settings.lang_updated'));
    await bot.handleUpdate({
        ...ctx.update,
        callback_query: {
            ...ctx.callbackQuery,
            data: 'view_settings' // Refresh settings view
        }
    });
});

// --- VAZIFA QO'SHISH ---
// --- VAZIFA QO'SHISH ---
bot.action('add_task', async (ctx) => {
    ctx.session = { state: 'await_task_desc' };
    const userId = ctx.from.id.toString();
    const data = loadData();
    const settings = data.users[userId]?.settings || { language: 'uz' };
    await safeEdit(ctx, getText(settings.language, 'tasks.add_prompt'), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(getText(settings.language, 'common.cancel'), 'main_menu')]])
    });
});

// --- KUNLIK BONUS ---
bot.action('get_daily_bonus', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const today = dayjs().format('YYYY-MM-DD');
    const settings = data.users[userId]?.settings || { language: 'uz' };
    const lang = settings.language;

    if (data.users[userId].lastBonusDate !== today) {
        data.users[userId].lastBonusDate = today;
        data.users[userId].xp += DAILY_BONUS_XP;
        saveData(data);
        await ctx.answerCbQuery(getText(lang, 'common.bonus_received', { xp: DAILY_BONUS_XP }));
        await showMainMenu(ctx);
    } else {
        await ctx.answerCbQuery(getText(lang, 'common.bonus_already'));
    }
});

// --- VAZIFALAR KO'RISH ---
// --- VAZIFALAR KO'RISH ---
async function viewTasks(ctx, filter = 'all', page = 0) {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const tasks = user.tasks || [];
    const settings = user.settings || { language: 'uz' };
    const lang = settings.language;

    let filteredTasks = [];
    let title = "";
    const today = dayjs().format('YYYY-MM-DD');

    if (filter === 'today') {
        filteredTasks = tasks.filter(t => t.datetime.startsWith(today));
        title = getText(lang, 'tasks.today_title');
    } else {
        filteredTasks = tasks;
        title = getText(lang, 'tasks.all_title');
    }

    if (filteredTasks.length === 0) {
        return safeEdit(ctx, `${title}\n\n${getText(lang, 'common.no_tasks')}`, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.callback(getText(lang, 'buttons.back_main'), 'main_menu')]])
        });
    }

    const PER_PAGE = 5;
    const totalPages = Math.ceil(filteredTasks.length / PER_PAGE);
    const start = page * PER_PAGE;
    const currentTasks = filteredTasks.slice(start, start + PER_PAGE);

    let text = `<b>${title}</b> (Sahifa ${page + 1}/${totalPages})\n\n`;
    const buttons = [];

    currentTasks.forEach((task) => {
        const realIndex = tasks.findIndex(t => t === task);
        const status = task.done ? '✅' : '⏳';
        const time = dayjs(task.datetime).format('DD.MM HH:mm');
        text += `${status} <b>${task.desc}</b>\n⏰ ${time}\n`;

        if (!task.done) {
            buttons.push([
                Markup.button.callback(getText(lang, 'common.do'), `do_${realIndex}`),
                Markup.button.callback(getText(lang, 'common.delete'), `del_${realIndex}`)
            ]);
        } else {
            buttons.push([Markup.button.callback(getText(lang, 'common.delete_bin'), `del_${realIndex}`)]);
        }
    });

    const navRow = [];
    if (page > 0) navRow.push(Markup.button.callback('⬅️', `list_${filter}_${page - 1}`));
    if (page < totalPages - 1) navRow.push(Markup.button.callback('➡️', `list_${filter}_${page + 1}`));

    if (navRow.length > 0) buttons.push(navRow);
    buttons.push([Markup.button.callback(getText(lang, 'buttons.back_main'), 'main_menu')]);

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
}

// --- DO'KON ---
// --- DO'KON ---
bot.action('view_shop', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const unlocked = user.unlocked || [];
    const settings = user.settings || { language: 'uz' };
    const lang = settings.language;

    let text = getText(lang, 'shop.title', { xp: user.xp }) + "\n\n";
    const buttons = [];

    text += getText(lang, 'shop.locked_section') + "\n\n";
    for (const [key, item] of Object.entries(SHOP_ITEMS)) {
        const name = getText(lang, `shop.items.${key}.name`);
        const desc = getText(lang, `shop.items.${key}.desc`);
        if (!unlocked.includes(key)) {
            text += `🔹 <b>${name}</b>\n💰 ${item.price} XP | ${desc}\n\n`;
            buttons.push([Markup.button.callback(getText(lang, 'shop.buy_btn', { name, price: item.price }), `buy_${key}`)]);
        }
    }

    text += getText(lang, 'shop.unlocked_section') + "\n\n";
    for (const [key, item] of Object.entries(SHOP_ITEMS)) {
        const name = getText(lang, `shop.items.${key}.name`);
        const desc = getText(lang, `shop.items.${key}.desc`);
        if (unlocked.includes(key)) {
            text += `✅ <b>${name}</b> - ${desc}\n\n`;
            buttons.push([Markup.button.callback(getText(lang, 'shop.bought_btn', { name }), 'noop')]);
        }
    }

    buttons.push([Markup.button.callback(getText(lang, 'buttons.back_main'), 'main_menu')]);
    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

// --- ODATLAR TREKERI ---
// --- ODATLAR TREKERI ---
bot.action('view_habits', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const settings = user.settings || { language: 'uz' };
    const lang = settings.language;

    if (!user.unlocked.includes('habits')) return ctx.answerCbQuery(getText(lang, 'common.premium'));

    if (!user.habits) user.habits = [];

    let text = getText(lang, 'modules.habits.title') + "\n\n";
    const buttons = [];

    user.habits.forEach((habit, idx) => {
        const status = habit.doneToday ? '✅' : '🔴';
        text += `${status} ${habit.name} (${getText(lang, 'modules.habits.streak')}: ${habit.streak || 0})\n`;
        if (!habit.doneToday) {
            buttons.push([Markup.button.callback(getText(lang, 'modules.habits.done'), `habit_do_${idx}`)]);
        }
    });

    buttons.push([Markup.button.callback(getText(lang, 'modules.habits.add_btn'), 'add_habit')]);
    buttons.push([Markup.button.callback(getText(lang, 'buttons.back_main'), 'main_menu')]);

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('add_habit', async (ctx) => {
    ctx.session = { state: 'await_habit_name' };
    const userId = ctx.from.id.toString();
    const data = loadData();
    const settings = data.users[userId]?.settings || { language: 'uz' };
    await safeEdit(ctx, getText(settings.language, 'modules.habits.add_prompt'), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(getText(settings.language, 'buttons.back'), 'view_habits')]])
    });
});



// --- MOTIVATSIYA MODULI ---
bot.action('view_motivation', async (ctx) => {
    await ctx.answerCbQuery();
    await safeEdit(ctx, "🔥 <b>Motivatsiya Moduli</b>\n\nBu modul har kuni soat 08:00 da sizga motivatsion xabar va maslahat yuboradi.\n\n✅ <b>Status:</b> Faol\n\nKuting, ertaga ertalab xabar keladi!", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Bosh menyu', 'main_menu')]])
    });
});

// --- PRO STATISTIKA ---
bot.action('view_statistics', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const settings = user.settings || { language: 'uz' };
    const lang = settings.language;

    if (!user.unlocked.includes('statistics')) return ctx.answerCbQuery(getText(lang, 'common.premium'));

    const tasks = user.tasks || [];
    const doneTasks = tasks.filter(t => t.done).length;
    const totalTasks = tasks.length;

    // Kunlik statistika
    const today = dayjs().format('YYYY-MM-DD');
    const dailyDone = tasks.filter(t => t.done && t.datetime.startsWith(today)).length;

    // Haftalik statistika
    const weekStart = dayjs().startOf('week').format('YYYY-MM-DD');
    const weeklyDone = tasks.filter(t => t.done && t.datetime >= weekStart).length;

    // Oylik statistika
    const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');
    const monthlyDone = tasks.filter(t => t.done && t.datetime >= monthStart).length;

    // Eng faol kun va vaqt
    const taskDates = tasks.map(t => dayjs(t.datetime).format('YYYY-MM-DD'));
    const mostActiveDay = taskDates.sort((a, b) =>
        taskDates.filter(v => v === a).length - taskDates.filter(v => v === b).length
    ).pop();

    const taskTimes = tasks.map(t => dayjs(t.datetime).format('HH'));
    const mostActiveTime = taskTimes.sort((a, b) =>
        taskTimes.filter(v => v === a).length - taskTimes.filter(v => v === b).length
    ).pop();

    // Oddiy matnli grafik (misol uchun)
    const dailyGraph = getText(lang, 'modules.statistics.daily') + ': ' + '█'.repeat(dailyDone) + '░'.repeat(10 - dailyDone);
    const weeklyGraph = getText(lang, 'modules.statistics.weekly') + ': ' + '█'.repeat(weeklyDone / 7) + '░'.repeat(10 - weeklyDone / 7); // Fix logic later if needed
    const monthlyGraph = getText(lang, 'modules.statistics.monthly') + ': ' + '█'.repeat(monthlyDone / 30) + '░'.repeat(10 - monthlyDone / 30);

    let text = getText(lang, 'modules.statistics.title') + "\n\n";
    text += `${getText(lang, 'modules.statistics.completed')}: ${doneTasks} / ${totalTasks}\n`;
    text += `${dailyGraph}\n`;
    text += `${weeklyGraph}\n`;
    text += `${monthlyGraph}\n`;
    text += `${getText(lang, 'modules.statistics.active_day')}: ${mostActiveDay || getText(lang, 'modules.statistics.none')}\n`;
    text += `${getText(lang, 'modules.statistics.active_time')}: ${mostActiveTime || getText(lang, 'modules.statistics.none')} h\n`;

    await safeEdit(ctx, text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(getText(lang, 'buttons.back_main'), 'main_menu')]])
    });
});

// --- PRIORITETLAR ---
// --- PRIORITETLAR ---
bot.action('view_priorities', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const settings = user.settings || { language: 'uz' };
    const lang = settings.language;

    if (!user.unlocked.includes('priorities')) return ctx.answerCbQuery(getText(lang, 'common.premium'));

    // Vazifalarga prioritet qo'shish logikasi
    if (!user.tasks.every(t => t.hasOwnProperty('priority'))) {
        user.tasks.forEach(t => t.priority = t.priority || 'normal');
        saveData(data);
    }

    let text = getText(lang, 'modules.priorities.title') + "\n\n";
    const highPriorityTasks = user.tasks.filter(t => t.priority === 'high' && !t.done);
    const normalPriorityTasks = user.tasks.filter(t => t.priority === 'normal' && !t.done);
    text += `${getText(lang, 'modules.priorities.high')}:\n${highPriorityTasks.map(t => `- ${t.desc}`).join('\n') || getText(lang, 'profile.none')}\n\n`;
    text += `${getText(lang, 'modules.priorities.normal')}:\n${normalPriorityTasks.map(t => `- ${t.desc}`).join('\n') || getText(lang, 'profile.none')}\n\n`;
    text += getText(lang, 'modules.priorities.info');

    const buttons = [[Markup.button.callback(getText(lang, 'buttons.back_main'), 'main_menu')]];

    await safeEdit(ctx, text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons)
    });
});

// --- KATEGORIYALAR ---
// --- KATEGORIYALAR ---
bot.action('view_categories', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const settings = user.settings || { language: 'uz' };
    const lang = settings.language;

    if (!user.unlocked.includes('categories')) return ctx.answerCbQuery(getText(lang, 'common.premium'));

    if (!user.categories) user.categories = [];

    let text = getText(lang, 'modules.categories.title') + "\n\n";
    user.categories.forEach(cat => {
        const tasksInCat = user.tasks.filter(t => t.category === cat);
        text += `- ${cat} (${tasksInCat.length} vazifa)\n`;
    });

    const buttons = [
        [Markup.button.callback(getText(lang, 'modules.categories.add_btn'), 'add_category')],
        [Markup.button.callback(getText(lang, 'modules.categories.filter_btn'), 'filter_categories')],
        [Markup.button.callback(getText(lang, 'buttons.back_main'), 'main_menu')]
    ];

    await safeEdit(ctx, text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons)
    });
});

bot.action('add_category', async (ctx) => {
    ctx.session = { state: 'await_category_name' };
    const userId = ctx.from.id.toString();
    const data = loadData();
    const settings = data.users[userId]?.settings || { language: 'uz' };
    await safeEdit(ctx, getText(settings.language, 'modules.categories.add_prompt'), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(getText(settings.language, 'buttons.back'), 'view_categories')]])
    });
});

bot.action('filter_categories', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const settings = user.settings || { language: 'uz' };
    const lang = settings.language;
    const buttons = user.categories.map(cat => [Markup.button.callback(cat, `filter_cat_${cat}`)]);
    buttons.push([Markup.button.callback(getText(lang, 'buttons.back'), 'view_categories')]);
    await safeEdit(ctx, getText(lang, 'modules.categories.select'), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons)
    });
});

bot.action(/filter_cat_(.*)/, async (ctx) => {
    const category = ctx.match[1];
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const settings = user.settings || { language: 'uz' };
    const lang = settings.language;
    const filteredTasks = user.tasks.filter(t => t.category === category);
    let text = getText(lang, 'modules.categories.tasks_in', { category }) + "\n\n";
    filteredTasks.forEach(t => {
        text += `${t.done ? '✅' : '⏳'} ${t.desc}\n`;
    });
    await safeEdit(ctx, text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(getText(lang, 'buttons.back'), 'view_categories')]])
    });
});

// --- KENGAYTIRILGAN ESLATMALAR ---
bot.action('view_reminders', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.unlocked.includes('reminders')) return ctx.answerCbQuery("⚠️ Premium!");

    if (!user.advancedReminders) user.advancedReminders = [];

    let text = `🔔 <b>Kengaytirilgan Eslatmalar</b>\n\n`;
    user.advancedReminders.forEach((rem, idx) => {
        text += `${idx + 1}. ${rem.desc} - Vaqtlar: ${rem.times.join(', ')}\n`;
    });

    const buttons = [
        [Markup.button.callback('➕ Bir nechta eslatma qo\'shish', 'add_advanced_reminder')],
        [Markup.button.callback('🔙', 'main_menu')]
    ];

    await safeEdit(ctx, text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons)
    });
});

bot.action('add_advanced_reminder', async (ctx) => {
    ctx.session = { state: 'await_advanced_reminder_desc' };
    await safeEdit(ctx, "🔔 <b>Vazifa nomini kiriting:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'view_reminders')]])
    });
});

bot.action('set_reminder_interval', async (ctx) => {
    ctx.session = { state: 'await_reminder_interval' };
    await safeEdit(ctx, "🔔 <b>Eslatma intervalini kiriting (daqiqalarda):</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'view_reminders')]])
    });
});

// --- MAQSADLAR TREKERI ---
// --- MAQSADLAR TREKERI ---
bot.action('view_goals', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const settings = user.settings || { language: 'uz' };
    const lang = settings.language;

    if (!user.unlocked.includes('goals')) return ctx.answerCbQuery(getText(lang, 'common.premium'));

    if (!user.goals) user.goals = [];

    let text = getText(lang, 'modules.goals.title') + "\n\n";
    const buttons = [];

    user.goals.forEach((goal, idx) => {
        const subTasks = goal.subTasks || [];
        const doneSubTasks = subTasks.filter(st => st.done).length;
        const progress = subTasks.length > 0 ? Math.round((doneSubTasks / subTasks.length) * 100) : 0;
        text += `${goal.name} - Progress: ${progress}%\n`;
        buttons.push([Markup.button.callback(`📈 ${getText(lang, 'modules.goals.update')}: ${goal.name}`, `update_goal_${idx}`)]);
    });

    buttons.push([Markup.button.callback(getText(lang, 'modules.goals.add_btn'), 'add_goal')]);
    buttons.push([Markup.button.callback(getText(lang, 'buttons.back_main'), 'main_menu')]);

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('add_goal', async (ctx) => {
    ctx.session = { state: 'await_goal_name' };
    const userId = ctx.from.id.toString();
    const data = loadData();
    const settings = data.users[userId]?.settings || { language: 'uz' };
    await safeEdit(ctx, getText(settings.language, 'modules.goals.add_prompt'), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(getText(settings.language, 'buttons.back'), 'view_goals')]])
    });
});

bot.action(/update_goal_(\d+)/, async (ctx) => {
    const idx = parseInt(ctx.match[1]);
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    if (!user || !user.goals) {
        return safeAnswerCbQuery(ctx, "Ma'lumot topilmadi.");
    }
    const settings = user.settings || { language: 'uz' };
    const lang = settings.language;
    const goal = user.goals[idx];

    if (!goal) {
        return safeAnswerCbQuery(ctx, "Maqsad topilmadi.");
    }

    let text = `🎯 <b>${goal.name}</b> - Kichik vazifalar:\n\n`;
    goal.subTasks.forEach((st, stIdx) => {
        text += `${st.done ? '✅' : '⏳'} ${st.desc} [do_sub_${idx}_${stIdx}]\n`;
    });
    const buttons = goal.subTasks.map((st, stIdx) => [Markup.button.callback(`${st.done ? '✅' : '⏳'} ${st.desc}`, `do_sub_${idx}_${stIdx}`)]);
    buttons.push([Markup.button.callback(getText(lang, 'modules.goals.subtask_add'), `add_sub_${idx}`)]);
    buttons.push([Markup.button.callback(getText(lang, 'buttons.back'), 'view_goals')]);
    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action(/do_sub_(\d+)_(\d+)/, async (ctx) => {
    const goalIdx = parseInt(ctx.match[1]);
    const subIdx = parseInt(ctx.match[2]);
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const settings = user.settings || { language: 'uz' };
    const lang = settings.language;
    const goal = user.goals[goalIdx];
    goal.subTasks[subIdx].done = !goal.subTasks[subIdx].done;
    saveData(data);
    await ctx.answerCbQuery(getText(lang, 'modules.goals.updated'));
    await bot.handleUpdate({
        ...ctx.update,
        callback_query: {
            ...ctx.callbackQuery,
            data: `update_goal_${goalIdx}`
        }
    });
});

bot.action(/add_sub_(\d+)/, async (ctx) => {
    const idx = parseInt(ctx.match[1]);
    const userId = ctx.from.id.toString();
    const data = loadData();
    const settings = data.users[userId]?.settings || { language: 'uz' };
    ctx.session = { state: 'await_sub_task', goalIdx: idx };
    await safeEdit(ctx, getText(settings.language, 'modules.goals.subtask_prompt'), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(getText(settings.language, 'buttons.back'), `update_goal_${idx}`)]])
    });
});

// --- POMODORO TAYMER ---
// --- POMODORO TAYMER ---
bot.action('view_pomodoro', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const settings = user.settings || { language: 'uz' };
    const lang = settings.language;

    if (!user.unlocked.includes('pomodoro')) return ctx.answerCbQuery(getText(lang, 'common.premium'));

    if (!user.pomodoro) user.pomodoro = { cycles: 0, active: false };

    let text = getText(lang, 'modules.pomodoro.title') + "\n\n";
    text += getText(lang, 'modules.pomodoro.info') + "\n";
    text += `${getText(lang, 'modules.pomodoro.cycles')}: ${user.pomodoro.cycles}\n`;

    const buttons = [
        [Markup.button.callback(getText(lang, 'modules.pomodoro.start'), 'start_pomodoro')],
        [Markup.button.callback(getText(lang, 'buttons.back_main'), 'main_menu')]
    ];

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('start_pomodoro', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const settings = user.settings || { language: 'uz' };
    const lang = settings.language;

    if (user.pomodoro.active) return ctx.answerCbQuery(getText(lang, 'modules.pomodoro.active'));
    user.pomodoro.active = true;
    saveData(data);
    await ctx.answerCbQuery(getText(lang, 'modules.pomodoro.started'));
    setTimeout(async () => {
        user.pomodoro.active = false;
        user.pomodoro.cycles += 1;
        saveData(data);
        await ctx.reply(getText(lang, 'modules.pomodoro.finished', { cycles: user.pomodoro.cycles }));
    }, 25 * 60 * 1000);
});

// --- ESLATMALAR ---
// --- ESLATMALAR ---
bot.action('view_notes', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const settings = user.settings || { language: 'uz' };
    const lang = settings.language;

    if (!user.unlocked.includes('notes')) return ctx.answerCbQuery(getText(lang, 'common.premium'));

    if (!user.notes) user.notes = [];

    let text = getText(lang, 'modules.notes.title') + "\n\n";
    const buttons = [];

    if (user.notes.length === 0) {
        text += getText(lang, 'modules.notes.empty') + "\n";
    } else {
        user.notes.forEach((note, idx) => {
            text += `${idx + 1}. ${note.text}\n`;
            buttons.push([
                Markup.button.callback(getText(lang, 'common.edit'), `edit_note_${idx}`),
                Markup.button.callback(getText(lang, 'common.delete_bin'), `del_note_${idx}`)
            ]);
        });
    }

    buttons.push([Markup.button.callback(getText(lang, 'modules.notes.add_btn'), 'add_note')]);
    buttons.push([Markup.button.callback(getText(lang, 'buttons.back_main'), 'main_menu')]);

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('add_note', async (ctx) => {
    ctx.session = { state: 'await_note_text' };
    const userId = ctx.from.id.toString();
    const data = loadData();
    const settings = data.users[userId]?.settings || { language: 'uz' };
    await safeEdit(ctx, getText(settings.language, 'modules.notes.add_prompt'), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(getText(settings.language, 'buttons.back'), 'view_notes')]])
    });
});



// Eslatmani tahrirlash uchun qo'shimcha
bot.action(/edit_note_(\d+)/, async (ctx) => {
    const idx = parseInt(ctx.match[1]);
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.unlocked.includes('notes')) return safeAnswerCbQuery(ctx, "⚠️ Premium!", true);
    if (!user.notes || !user.notes[idx]) return safeAnswerCbQuery(ctx, "❌ Eslatma topilmadi!", true);

    ctx.session = { state: 'await_edit_note', noteIdx: idx };
    await safeEdit(ctx, `📝 <b>Yangi matnni kiriting:</b>\n\nHozirgi: ${user.notes[idx].text}`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'view_notes')]])
    });
});

// Eslatmani o'chirish
bot.action(/del_note_(\d+)/, async (ctx) => {
    const idx = parseInt(ctx.match[1]);
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.unlocked.includes('notes')) return safeAnswerCbQuery(ctx, "⚠️ Premium!", true);
    if (!user.notes || !user.notes[idx]) return safeAnswerCbQuery(ctx, "❌ Eslatma topilmadi!", true);

    user.notes.splice(idx, 1);
    saveData(data);
    await ctx.answerCbQuery('🗑 Eslatma o\'chirildi');
    await bot.action('view_notes', ctx);
});

// --- KALENDAR INTEGRATSIYASI ---
bot.action('view_calendar', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.unlocked.includes('calendar')) return ctx.answerCbQuery("⚠️ Premium!");

    if (!user.calendarEvents) user.calendarEvents = [];

    let text = `🗓 <b>Kalendar Integratsiyasi</b>\n\n`;
    text += `Bugun: ${dayjs().format('DD.MM.YYYY')}\n\n`;
    user.tasks.forEach(t => {
        if (user.calendarEvents.includes(t.datetime)) {
            text += `✅ ${t.desc} - Kalendarda\n`;
        } else {
            text += `⏳ ${t.desc} - Kalendarga qo'shilmagan\n`;
        }
    });

    const buttons = [
        [Markup.button.callback('➕ Vazifani kalendarga qo\'shish', 'add_to_calendar')],
        [Markup.button.callback('🔙', 'main_menu')]
    ];

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('add_to_calendar', async (ctx) => {
    ctx.session = { state: 'await_calendar_task' };
    await safeEdit(ctx, "🗓 <b>Vazifa nomini kiriting (kalendarga qo'shish uchun):</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'view_calendar')]])
    });
});

// --- SHAXSIY ESLATMALAR ---
bot.action('view_custom_reminders', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.unlocked.includes('custom_reminders')) return safeAnswerCbQuery(ctx, "⚠️ Premium!", true);

    if (!user.custom_reminders) user.custom_reminders = [];

    let text = `🛎 <b>Shaxsiy Eslatmalar</b>\n\n`;
    user.custom_reminders.forEach((rem, idx) => {
        const timeStr = rem.datetime ? `📅 ${rem.datetime}` : `⏰ ${rem.time} (Har kuni)`;
        const statusStr = rem.sent ? ' ✅' : '';
        text += `${rem.desc} - ${timeStr}${statusStr}\n`;
    });

    const buttons = [
        [Markup.button.callback('➕ Shaxsiy eslatma qo\'yish', 'add_custom_reminder')],
        [Markup.button.callback('🔙', 'main_menu')]
    ];

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('add_custom_reminder', async (ctx) => {
    ctx.session = { state: 'await_custom_reminder_desc' };
    await safeEdit(ctx, "🛎 <b>Eslatma nomini kiriting:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'view_custom_reminders')]])
    });
});

// --- TARAQQIYOT HISOBOTLARI ---
bot.action('view_progress_reports', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.unlocked.includes('progress_reports')) return ctx.answerCbQuery("⚠️ Premium!");

    const weekStart = dayjs().startOf('week').format('YYYY-MM-DD');
    const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');

    const weeklyDone = user.tasks.filter(t => t.done && t.datetime >= weekStart).length;
    const monthlyDone = user.tasks.filter(t => t.done && t.datetime >= monthStart).length;

    let text = `📈 <b>Taraqqiyot Hisobotlari</b>\n\n`;
    text += `Haftalik natijalar: ${weeklyDone} vazifa bajarildi\n`;
    text += `Oylik natijalar: ${monthlyDone} vazifa bajarildi\n`;
    text += `Rivoj: XP +${user.xp}, Daraja: ${getUserLevel(user.xp).name}\n`;

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'main_menu')]]) });
});

// --- YUTUQLAR ---
bot.action('view_achievements', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.unlocked.includes('achievements')) return ctx.answerCbQuery("⚠️ Premium!");

    if (!user.achievements) user.achievements = [];

    const doneTasks = user.tasks.filter(t => t.done).length;
    const totalXP = user.xp || 0;
    const habits = user.habits || [];
    const maxStreak = habits.length > 0 ? Math.max(...habits.map(h => h.streak || 0)) : 0;
    let newAchievement = null;

    // Avtomatik yutuqlar
    if (doneTasks >= 10 && !user.achievements.includes('10 vazifa')) {
        user.achievements.push('10 vazifa');
        newAchievement = '🏆 10 vazifa bajarildi!';
    }
    if (doneTasks >= 50 && !user.achievements.includes('50 vazifa')) {
        user.achievements.push('50 vazifa');
        newAchievement = '🏆 50 vazifa bajarildi!';
    }
    if (doneTasks >= 100 && !user.achievements.includes('100 vazifa')) {
        user.achievements.push('100 vazifa');
        newAchievement = '🏆 100 vazifa bajarildi!';
    }
    if (totalXP >= 500 && !user.achievements.includes('500 XP')) {
        user.achievements.push('500 XP');
        newAchievement = '🏆 500 XP to\'plandi!';
    }
    if (totalXP >= 1000 && !user.achievements.includes('1000 XP')) {
        user.achievements.push('1000 XP');
        newAchievement = '🏆 1000 XP to\'plandi!';
    }
    if (maxStreak >= 7 && !user.achievements.includes('7 kun streak')) {
        user.achievements.push('7 kun streak');
        newAchievement = '🏆 7 kunlik streak!';
    }
    if (maxStreak >= 30 && !user.achievements.includes('30 kun streak')) {
        user.achievements.push('30 kun streak');
        newAchievement = '🏆 30 kunlik streak!';
    }
    if (user.unlocked && user.unlocked.length >= 5 && !user.achievements.includes('5 funksiya')) {
        user.achievements.push('5 funksiya');
        newAchievement = '🏆 5 ta funksiya ochildi!';
    }
    if (user.unlocked && user.unlocked.length >= 10 && !user.achievements.includes('10 funksiya')) {
        user.achievements.push('10 funksiya');
        newAchievement = '🏆 10 ta funksiya ochildi!';
    }

    if (newAchievement) {
        saveData(data);
        await ctx.reply(newAchievement);
    }

    let text = `🏆 <b>Yutuqlar</b>\n\n`;
    if (user.achievements.length === 0) {
        text += `📭 Hozircha yutuqlar yo'q. Vazifalarni bajarib, yutuqlarni oching!\n`;
    } else {
        user.achievements.forEach(ach => {
            text += `✅ ${ach}\n`;
        });
        text += `\n📊 Jami: ${user.achievements.length} ta yutuq`;
    }

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'main_menu')]]) });
});

// --- IJTIMOIY ULASHISH ---
bot.action('view_social_sharing', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.unlocked.includes('social_sharing')) {
        await ctx.answerCbQuery();
        return safeEdit(ctx, "📤 <b>Ijtimoiy ulashish</b> funksiyasi premium hisoblanadi.\n\nUni ishlatish uchun avval do'kondan <b>📤 Ijtimoiy Ulashish</b> funksiyasini sotib oling.", {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.callback('🛒 Do\'konga o\'tish', 'view_shop')], [Markup.button.callback('🔙 Bosh menyu', 'main_menu')]])
        });
    }

    let text = `📤 <b>Ijtimoiy Ulashish</b>\n\n`;
    text += `Sizning referal havolangiz:\n`;
    const inviteLink = `https://t.me/${ctx.botInfo.username}?start=ref_${userId}`;
    text += `<code>${inviteLink}</code>\n\n`;
    text += `1. Do'stingizga yuboring.\n`;
    text += `2. Do'stingiz botga "Start" bossin.\n`;
    text += `3. Sizga <b>+30 XP</b> beriladi!\n\n`;

    if (!user.achievements) user.achievements = [];
    if (!user.tasks) user.tasks = [];
    saveData(data); // <--- MUHIM: O'zgarishlarni saqlash

    text += `Yutuq: ${user.achievements.length}\n`;
    text += `Statistika: ${user.tasks.filter(t => t.done).length} vazifa`;

    const buttons = [
        [Markup.button.callback('📤 Natijani ulashish', 'share_result')],
        [Markup.button.url('Do\'stga yuborish', `https://t.me/share/url?url=${inviteLink}&text=Salom!%20Men%20bu%20botda%20rivojlanyapman.%20Sen%20ham%20qo%27shil!`)],
        [Markup.button.callback('🔙', 'main_menu')]
    ];

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('share_result', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    if (!user.unlocked.includes('social_sharing')) {
        await ctx.answerCbQuery('📤 Ulashish uchun avval do\'kondan Ijtimoiy Ulashish funksiyasini sotib oling.');
        return;
    }

    // Xavfsizlik uchun tekshirish
    if (!user.achievements) user.achievements = [];

    const shareText = `Mening natijam: ${user.xp} XP, ${user.achievements.length} yutuq!`;
    await ctx.reply(shareText, withProtectContentForCtx(ctx));
    await ctx.answerCbQuery('📤 Ulashildi!');
});

// --- SHARE COMMAND (foydalanuvchi ulashmoqchi bo'lsa) ---
bot.command('share', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user) {
        await ctx.reply("⚠️ Avval /start buyrug'ini bosing.", withProtectContentForCtx(ctx));
        return;
    }

    if (user.unlocked && user.unlocked.includes('social_sharing')) {
        // Social sharing ochilgan bo'lsa, bevosita modulga olib boramiz
        await bot.action('view_social_sharing', ctx);
    } else {
        await ctx.reply(
            "📤 Siz hozircha natijalarni ulasha olmaysiz.\n\nIjtimoiy ulashish uchun do'kondan <b>📤 Ijtimoiy Ulashish</b> funksiyasini sotib oling.",
            withProtectContentForCtx(ctx, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([[Markup.button.callback('🛒 Do\'konga o\'tish', 'view_shop')]])
            })
        );
    }
});

// --- SHAXSIY TEMALAR ---
bot.action('view_custom_themes', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.unlocked.includes('custom_themes')) return ctx.answerCbQuery("⚠️ Premium!");

    const theme = user.settings.theme || 'light';
    let text = `🎨 <b>Shaxsiy Temalar</b>\n\nTanlangan tema: <b>${theme === 'dark' ? 'Qora 🌑' : 'Oq ☀️'}</b>\n\n`;
    text += `⚠️ <i>Eslatma: Telegram botlari ilova fonini o'zgartira olmaydi. Bu sozlama botdagi xabarlar uslubini (masalan, sarlavha emojilarini) o'zgartiradi.</i>`;

    const buttons = [
        [Markup.button.callback(`${theme === 'dark' ? '✅ ' : ''}Qora Tema 🌑`, 'set_theme_dark')],
        [Markup.button.callback(`${theme === 'light' ? '✅ ' : ''}Oq Tema ☀️`, 'set_theme_light')],
        [Markup.button.callback('🔙', 'main_menu')]
    ];

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('set_theme_dark', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    data.users[userId].settings.theme = 'dark';
    saveData(data);
    await ctx.answerCbQuery('Qora tema o\'rnatildi.');
    await bot.action('view_custom_themes', ctx);
});

bot.action('set_theme_light', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    data.users[userId].settings.theme = 'light';
    saveData(data);
    await ctx.answerCbQuery('Oq tema o\'rnatildi.');
    await bot.action('view_custom_themes', ctx);
});

// --- AI MASLAHATLAR ---
bot.action('view_ai_tips', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.unlocked.includes('ai_tips')) return ctx.answerCbQuery("⚠️ Premium!");

    const doneTasks = user.tasks.filter(t => t.done).length;
    let tip = '🤖 AI maslahat: Har kuni vazifa qo\'shing va XP to\'plang!';
    if (doneTasks > 10) tip = '🤖 AI maslahat: Siz faolsiz, endi maqsadlarga e\'tibor bering!';

    let text = `🤖 <b>AI Maslahatlar</b>\n\n${tip}\n\nStatistika asosida tahlil: ${doneTasks} vazifa bajarilgan.`;

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'main_menu')]]) });
});










// --- KENGAYTIRILGAN ANALITIKA ---
bot.action('view_advanced_analytics', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.unlocked.includes('advanced_analytics')) return ctx.answerCbQuery("⚠️ Premium!");

    const tasks = user.tasks || [];
    const habits = user.habits || [];
    const doneTasks = tasks.filter(t => t.done);
    const pendingTasks = tasks.filter(t => !t.done);

    // Statistika
    const today = dayjs().format('YYYY-MM-DD');
    const weekStart = dayjs().startOf('week').format('YYYY-MM-DD');
    const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');

    const todayDone = doneTasks.filter(t => t.datetime.startsWith(today)).length;
    const weekDone = doneTasks.filter(t => t.datetime >= weekStart).length;
    const monthDone = doneTasks.filter(t => t.datetime >= monthStart).length;

    // Prioritetlar bo'yicha
    const highPriority = tasks.filter(t => t.priority === 'high').length;
    const normalPriority = tasks.filter(t => t.priority === 'normal').length;

    // Kategoriyalar bo'yicha
    const categories = user.categories || [];
    const categoryStats = categories.map(cat => ({
        name: cat,
        count: tasks.filter(t => t.category === cat).length
    }));

    // Odatlar statistikasi
    const totalStreak = habits.reduce((sum, h) => sum + (h.streak || 0), 0);
    const avgStreak = habits.length > 0 ? (totalStreak / habits.length).toFixed(1) : 0;

    // Eng faol vaqtlar
    const hourStats = {};
    doneTasks.forEach(t => {
        const hour = dayjs(t.datetime).format('HH');
        hourStats[hour] = (hourStats[hour] || 0) + 1;
    });
    const mostActiveHour = Object.keys(hourStats).sort((a, b) => hourStats[b] - hourStats[a])[0] || 'Yo\'q';

    let text = `🔍 <b>Kengaytirilgan Analitika</b>\n\n`;
    text += `📊 <b>Umumiy statistika:</b>\n`;
    text += `• Bajarilgan vazifalar: ${doneTasks.length}\n`;
    text += `• Qolgan vazifalar: ${pendingTasks.length}\n`;
    text += `• Jami vazifalar: ${tasks.length}\n`;
    text += `• Odatlar: ${habits.length}\n\n`;

    text += `📅 <b>Vaqt bo'yicha:</b>\n`;
    text += `• Bugun: ${todayDone} vazifa\n`;
    text += `• Hafta: ${weekDone} vazifa\n`;
    text += `• Oy: ${monthDone} vazifa\n\n`;

    if (user.unlocked.includes('priorities')) {
        text += `🚨 <b>Prioritetlar:</b>\n`;
        text += `• Yuqori: ${highPriority}\n`;
        text += `• Normal: ${normalPriority}\n\n`;
    }

    if (user.unlocked.includes('categories') && categoryStats.length > 0) {
        text += `🏷 <b>Kategoriyalar:</b>\n`;
        categoryStats.forEach(stat => {
            text += `• ${stat.name}: ${stat.count} vazifa\n`;
        });
        text += `\n`;
    }

    if (habits.length > 0) {
        text += `🔄 <b>Odatlar:</b>\n`;
        text += `• O'rtacha streak: ${avgStreak} kun\n`;
        text += `• Jami streak: ${totalStreak} kun\n\n`;
    }

    text += `⏰ <b>Eng faol vaqt:</b> ${mostActiveHour}:00 soat\n`;
    text += `💎 <b>Jami XP:</b> ${user.xp || 0}\n`;
    text += `🔰 <b>Daraja:</b> ${getUserLevel(user.xp || 0).name}\n`;

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'main_menu')]]) });
});

// --- IL ovalar INTEGRATSIYASI ---
bot.action('view_integration_apps', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.unlocked.includes('integration_apps')) return safeAnswerCbQuery(ctx, "⚠️ Premium!", true);

    if (!user.integrations) user.integrations = [];

    let text = `🔗 <b>Ilovalar Integratsiyasi (Simulyatsiya)</b>\n\n`;
    text += `⚠️ <b>Eslatma:</b> Bu bot hozircha tashqi API (Google, Notion) lar bilan to'g'ridan-to'g'ri bog'lanmaydi. Bu funksiya faqat siz qaysi ilovalarni ishlatayotganingizni qayd qilib borish uchun.\n\n`;
    const buttons = [];

    if (!user.integrations || user.integrations.length === 0) {
        text += `📭 Hozircha ulangan ilovalar yo'q.\n\n`;
        text += `Quyidagilarni "ulash" (belgilash) mumkin:\n`;
        text += `• Google Calendar\n`;
        text += `• Notion\n`;
        text += `• Trello\n`;
        text += `• Todoist\n`;
    } else {
        text += `✅ <b>Siz kuzatayotgan ilovalar:</b>\n`;
        user.integrations.forEach((app, idx) => {
            text += `${idx + 1}. ${app}\n`;
            buttons.push([Markup.button.callback(`🔌 ${app} ni o'chirish`, `remove_integration_${idx}`)]);
        });
        text += `\nUshbu ilovalardagi o'zgarishlarni qo'lda kiritib borishingizni tavsiya qilamiz.`;
    }

    buttons.push([Markup.button.callback('➕ Ilovani ulash', 'add_integration')]);
    buttons.push([Markup.button.callback('🔙', 'main_menu')]);

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('add_integration', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    const buttons = [
        [Markup.button.callback('📅 Google Calendar', 'integration_google_calendar')],
        [Markup.button.callback('📝 Notion', 'integration_notion')],
        [Markup.button.callback('📋 Trello', 'integration_trello')],
        [Markup.button.callback('✅ Todoist', 'integration_todoist')],
        [Markup.button.callback('➕ Boshqa ilova', 'integration_custom')],
        [Markup.button.callback('🔙', 'view_integration_apps')]
    ];

    await safeEdit(ctx, "🔗 <b>Ilovani tanlang:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons)
    });
});

bot.action(/integration_(.*)/, async (ctx) => {
    const appName = ctx.match[1].replace(/_/g, ' ');
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (appName === 'custom') {
        ctx.session = { state: 'await_integration_app' };
        await safeEdit(ctx, "🔗 <b>Ilova nomini kiriting:</b>", {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'view_integration_apps')]])
        });
        return;
    }

    if (!user.integrations) user.integrations = [];
    if (!user.integrations.includes(appName)) {
        user.integrations.push(appName);
        saveData(data);
        await ctx.answerCbQuery(`✅ ${appName} ulandi!`);
        await bot.action('view_integration_apps', ctx);
    } else {
        await ctx.answerCbQuery(`⚠️ ${appName} allaqachon ulangan!`);
    }
});

bot.action(/remove_integration_(\d+)/, async (ctx) => {
    const idx = parseInt(ctx.match[1]);
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    // Xavfsizlik
    if (!user.integrations) user.integrations = [];

    if (user.integrations && user.integrations[idx]) {
        const appName = user.integrations[idx];
        user.integrations.splice(idx, 1);
        saveData(data);
        await ctx.answerCbQuery(`🔌 ${appName} o'chirildi`);
        await bot.action('view_integration_apps', ctx);
    } else {
        await ctx.answerCbQuery("❌ Topilmadi!");
    }
});

// --- OVOZLI ESLATMALAR ---
bot.action('view_voice_notes', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.unlocked.includes('voice_notes')) return ctx.answerCbQuery("⚠️ Premium!");

    if (!user.voiceNotes) user.voiceNotes = [];

    let text = `🎤 <b>Ovozli Eslatmalar</b>\n\n`;
    const buttons = [];

    if (!user.voiceNotes || user.voiceNotes.length === 0) {
        text += `📭 Hozircha ovozli eslatmalar yo'q.\n`;
        text += `Ovozli xabar yuborib, eslatma qo'yishingiz mumkin.\n`;
    } else {
        user.voiceNotes.forEach((vn, idx) => {
            text += `${idx + 1}. 🎤 Ovozli eslatma\n`;
            text += `   ⏰ Vaqt: ${vn.time}\n`;
            if (vn.desc) text += `   📝 ${vn.desc}\n`;
            text += `\n`;
            buttons.push([
                Markup.button.callback(`🗑 O'chirish`, `del_voice_note_${idx}`)
            ]);
        });
    }

    buttons.push([Markup.button.callback('➕ Ovozli xabar yuborish', 'add_voice_note')]);
    buttons.push([Markup.button.callback('🔙', 'main_menu')]);

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('add_voice_note', async (ctx) => {
    ctx.session = { state: 'await_voice_note' };
    await safeEdit(ctx, "🎤 <b>Ovozli eslatmani yuboring (voice message):</b>\n\nYoki matnli eslatma qo'shish uchun /skip ni bosing.", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('📝 Matnli eslatma qo\'shish', 'add_text_voice_note')],
            [Markup.button.callback('🔙', 'view_voice_notes')]
        ])
    });
});

bot.action('add_text_voice_note', async (ctx) => {
    ctx.session = { state: 'await_voice_note_desc' };
    await safeEdit(ctx, "📝 <b>Eslatma matnini kiriting:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'view_voice_notes')]])
    });
});

bot.action(/del_voice_note_(\d+)/, async (ctx) => {
    const idx = parseInt(ctx.match[1]);
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.unlocked.includes('voice_notes')) return ctx.answerCbQuery("⚠️ Premium!");
    if (!user.voiceNotes || !user.voiceNotes[idx]) return ctx.answerCbQuery("❌ Topilmadi!");

    user.voiceNotes.splice(idx, 1);
    saveData(data);
    await ctx.answerCbQuery('🗑 Ovozli eslatma o\'chirildi');
    await bot.action('view_voice_notes', ctx);
});

// --- ADMIN PANEL ---
bot.action('admin_panel', async (ctx) => {
    if (!isAdmin(ctx.from.id.toString())) return;

    const data = loadData();
    const userCount = Object.keys(data.users).length;

    let text = `🛡️ <b>Admin Panel</b>\n\n`;
    text += `👥 Users: ${userCount}\n`;
    text += `Time: ${dayjs().format('HH:mm')}\n`;

    const buttons = [
        [Markup.button.callback('💾 Backup', 'admin_backup')],
        [Markup.button.callback('📢 Broadcast', 'admin_broadcast')],
        [Markup.button.callback('🚫 Ban/Unban', 'admin_ban_menu')],
        [Markup.button.callback('🎁 XP Gift', 'admin_gift_xp')],
        [Markup.button.callback('👥 View Users', 'admin_view_users')],
        [Markup.button.callback('📊 User Analytics', 'admin_user_analytics')],
        [Markup.button.callback('⚙️ Bot Settings', 'admin_bot_settings')],
        [Markup.button.callback('🎁 Mass XP', 'admin_mass_xp')],
        [Markup.button.callback('🚫 Ban List', 'admin_ban_list')],
        [Markup.button.callback('📜 Logs', 'admin_logs')],
        [Markup.button.callback('🛒 Update Shop', 'admin_update_shop')],
        [Markup.button.callback('🔔 Send Notif', 'admin_send_notif')],
        [Markup.button.callback('📋 View User Tasks', 'admin_view_user_tasks')],
        [Markup.button.callback('🔄 Reset User', 'admin_reset_user')],
        [Markup.button.callback('💾 Backup/Restore', 'admin_backup_restore')],
        [Markup.button.callback(getText('uz', 'admin.clear_db_btn'), 'admin_clear_db_confirm')],
        [Markup.button.callback('🔙 Chiqish', 'main_menu')]
    ];

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

// --- ADMIN BACKUP ---
bot.action('admin_backup', async (ctx) => {
    if (!isAdmin(ctx.from.id.toString())) return;
    await ctx.replyWithDocument({ source: DATA_FILE, filename: 'backup.json' }, withProtectContentForCtx(ctx));
    await ctx.answerCbQuery('✅ Backup yuklandi');
});

// --- ADMIN CLEAR DB ---
bot.action('admin_clear_db_confirm', async (ctx) => {
    if (!isAdmin(ctx.from.id.toString())) return;
    await safeEdit(ctx, getText('uz', 'admin.clear_db_confirm'), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ HA, O\'CHIRISH', 'admin_clear_db_yes')],
            [Markup.button.callback('❌ Bekor qilish', 'admin_panel')]
        ])
    });
});

bot.action('admin_clear_db_yes', async (ctx) => {
    if (!isAdmin(ctx.from.id.toString())) return;
    const userId = ctx.from.id.toString();
    const data = loadData();
    const adminUser = data.users[userId];

    const newData = { users: {}, settings: {} };
    if (adminUser) {
        newData.users[userId] = adminUser; // Adminni saqlab qolamiz
    }

    saveData(newData);
    await ctx.answerCbQuery('✅');
    await ctx.reply(getText('uz', 'admin.clear_db_success'));
    await showMainMenu(ctx);
});

// --- ADMIN BROADCAST ---
bot.action('admin_broadcast', async (ctx) => {
    if (!isAdmin(ctx.from.id.toString())) return;
    ctx.session = { state: 'admin_broadcast_msg' };
    await safeEdit(ctx, "📢 <b>Barchaga xabar kiriting:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_panel')]])
    });
});

// --- ADMIN BAN MENU ---
bot.action('admin_ban_menu', async (ctx) => {
    if (!isAdmin(ctx.from.id.toString())) return;
    ctx.session = { state: 'admin_ban_user' };
    await safeEdit(ctx, "🚫 <b>User ID kiriting (ban/unban):</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_panel')]])
    });
});

// --- ADMIN GIFT XP ---
bot.action('admin_gift_xp', async (ctx) => {
    if (!isAdmin(ctx.from.id.toString())) return;
    const data = loadData();
    const buttons = [];
    for (const [uid, user] of Object.entries(data.users)) {
        buttons.push([Markup.button.callback(`${user.name} (${uid})`, `gift_select_${uid}`)]);
    }
    buttons.push([Markup.button.callback('🔙', 'admin_panel')]);
    await safeEdit(ctx, "🎁 <b>User tanlang:</b>", { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action(/gift_select_(\d+)/, async (ctx) => {
    const targetId = ctx.match[1];
    ctx.session = { state: 'admin_gift_xp_amount', targetId };
    await safeEdit(ctx, `🎁 <b>${targetId} ga XP miqdorini kiriting:</b>`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_gift_xp')]]) });
});

// --- ADMIN VIEW USERS ---
bot.action('admin_view_users', async (ctx) => {
    if (!isAdmin(ctx.from.id.toString())) return;
    const data = loadData();
    const users = Object.entries(data.users);

    if (users.length === 0) {
        return safeEdit(ctx, "👥 <b>Users</b>\n\n📭 Hozircha foydalanuvchilar yo'q.", {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_panel')]])
        });
    }

    let text = `👥 <b>Users</b> (Jami: ${users.length})\n\n`;
    const buttons = [];

    // Har bir foydalanuvchini ko'rsatish
    users.forEach(([uid, user], idx) => {
        const tasksCount = (user.tasks || []).length;
        const doneTasks = (user.tasks || []).filter(t => t.done).length;
        const unlockedCount = (user.unlocked || []).length;
        text += `${idx + 1}. <b>${user.name}</b>\n`;
        text += `   ID: ${uid}\n`;
        text += `   💎 XP: ${user.xp || 0}\n`;
        text += `   📋 Vazifalar: ${doneTasks}/${tasksCount}\n`;
        text += `   🔓 Funksiyalar: ${unlockedCount}\n`;
        text += `   🚫 ${user.blocked ? 'Bloklangan' : 'Faol'}\n\n`;

        buttons.push([
            Markup.button.callback(`👤 ${user.name}`, `admin_user_detail_${uid}`)
        ]);
    });

    buttons.push([Markup.button.callback('🔙', 'admin_panel')]);

    await safeEdit(ctx, text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons)
    });
});

// Foydalanuvchi tafsilotlari
bot.action(/admin_user_detail_(\d+)/, async (ctx) => {
    const userId = ctx.match[1];
    const data = loadData();
    const user = data.users[userId];

    if (!user) {
        return ctx.answerCbQuery("❌ Foydalanuvchi topilmadi!");
    }

    const tasks = user.tasks || [];
    const habits = user.habits || [];
    const unlocked = user.unlocked || [];

    let text = `👤 <b>${user.name}</b>\n\n`;
    text += `🆔 ID: ${userId}\n`;
    text += `💎 XP: ${user.xp || 0}\n`;
    text += `🔰 Daraja: ${getUserLevel(user.xp || 0).name}\n`;
    text += `📋 Vazifalar: ${tasks.length} (${tasks.filter(t => t.done).length} bajarilgan)\n`;
    text += `🔄 Odatlar: ${habits.length}\n`;
    text += `🔓 Funksiyalar: ${unlocked.length}\n`;
    text += `📅 Qo'shilgan: ${dayjs(user.joinedAt).format('DD.MM.YYYY HH:mm')}\n`;
    text += `🚫 Holat: ${user.blocked ? 'Bloklangan' : 'Faol'}\n\n`;

    if (unlocked.length > 0) {
        text += `<b>Ochilgan funksiyalar:</b>\n`;
        unlocked.forEach(key => {
            text += `• ${SHOP_ITEMS[key]?.name || key}\n`;
        });
    }

    const buttons = [
        [Markup.button.callback('🎁 XP berish', `gift_select_${userId}`)],
        [Markup.button.callback(user.blocked ? '✅ Unban' : '🚫 Ban', `admin_toggle_ban_${userId}`)],
        [Markup.button.callback('🔄 Reset', `admin_reset_confirm_${userId}`)],
        [Markup.button.callback('🔙', 'admin_view_users')]
    ];

    await safeEdit(ctx, text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons)
    });
});

bot.action(/admin_toggle_ban_(\d+)/, async (ctx) => {
    const targetId = ctx.match[1];
    const data = loadData();

    if (!data.users[targetId]) {
        return ctx.answerCbQuery("❌ Foydalanuvchi topilmadi!");
    }

    data.users[targetId].blocked = !data.users[targetId].blocked;
    saveData(data);

    const status = data.users[targetId].blocked ? 'bloklandi' : 'chiqarildi';
    await ctx.answerCbQuery(`✅ ${status}!`);
    await bot.action(`admin_user_detail_${targetId}`, ctx);
});

bot.action(/admin_reset_confirm_(\d+)/, async (ctx) => {
    const targetId = ctx.match[1];
    ctx.session = { state: 'admin_reset_confirm', targetId };
    await safeEdit(ctx, `🔄 <b>${targetId} ni reset qilishni tasdiqlaysizmi?</b>\n\nBarcha ma'lumotlar o'chiriladi!`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ Ha, reset qilish', `admin_reset_yes_${targetId}`)],
            [Markup.button.callback('❌ Bekor qilish', `admin_user_detail_${targetId}`)]
        ])
    });
});

bot.action(/admin_reset_yes_(\d+)/, async (ctx) => {
    const targetId = ctx.match[1];
    const data = loadData();
    const user = data.users[targetId];

    if (!user) {
        return ctx.answerCbQuery("❌ Foydalanuvchi topilmadi!");
    }

    data.users[targetId] = {
        name: user.name,
        xp: 0,
        tasks: [],
        habits: [],
        unlocked: [],
        blocked: false,
        joinedAt: new Date(),
        settings: { notifications: true, language: 'uz' }
    };
    saveData(data);

    await ctx.answerCbQuery('✅ Reset qilindi!');
    await bot.action(`admin_user_detail_${targetId}`, ctx);
});

// --- ADMIN USER ANALYTICS ---
bot.action('admin_user_analytics', async (ctx) => {
    if (!isAdmin(ctx.from.id.toString())) return;
    const data = loadData();
    const users = Object.values(data.users);
    const userCount = users.length;

    if (userCount === 0) {
        return safeEdit(ctx, "📊 <b>User Analytics</b>\n\n📭 Hozircha foydalanuvchilar yo'q.", {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_panel')]])
        });
    }

    let totalXP = 0;
    let totalTasks = 0;
    let doneTasks = 0;
    let totalHabits = 0;
    let blockedCount = 0;
    const unlockedStats = {};

    for (const user of users) {
        totalXP += user.xp || 0;
        const tasks = user.tasks || [];
        totalTasks += tasks.length;
        doneTasks += tasks.filter(t => t.done).length;
        totalHabits += (user.habits || []).length;
        if (user.blocked) blockedCount++;

        (user.unlocked || []).forEach(key => {
            unlockedStats[key] = (unlockedStats[key] || 0) + 1;
        });
    }

    const averageXP = (totalXP / userCount).toFixed(2);
    const averageTasks = (totalTasks / userCount).toFixed(1);
    const completionRate = totalTasks > 0 ? ((doneTasks / totalTasks) * 100).toFixed(1) : 0;

    let text = `📊 <b>User Analytics</b>\n\n`;
    text += `👥 <b>Umumiy:</b>\n`;
    text += `• Jami foydalanuvchilar: ${userCount}\n`;
    text += `• Faol: ${userCount - blockedCount}\n`;
    text += `• Bloklangan: ${blockedCount}\n\n`;

    text += `💎 <b>XP:</b>\n`;
    text += `• Jami XP: ${totalXP}\n`;
    text += `• O'rtacha XP: ${averageXP}\n\n`;

    text += `📋 <b>Vazifalar:</b>\n`;
    text += `• Jami vazifalar: ${totalTasks}\n`;
    text += `• Bajarilgan: ${doneTasks}\n`;
    text += `• O'rtacha: ${averageTasks} vazifa/foydalanuvchi\n`;
    text += `• Bajarilish foizi: ${completionRate}%\n\n`;

    text += `🔄 Odatlar: ${totalHabits}\n\n`;

    if (Object.keys(unlockedStats).length > 0) {
        text += `🔓 <b>Eng mashhur funksiyalar:</b>\n`;
        const sorted = Object.entries(unlockedStats).sort((a, b) => b[1] - a[1]).slice(0, 5);
        sorted.forEach(([key, count]) => {
            text += `• ${SHOP_ITEMS[key]?.name || key}: ${count} ta\n`;
        });
    }

    await safeEdit(ctx, text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_panel')]])
    });
});

// --- ADMIN BOT SETTINGS ---
bot.action('admin_bot_settings', async (ctx) => {
    if (!isAdmin(ctx.from.id.toString())) return;
    const data = loadData();
    let text = `⚙️ <b>Bot Sozlamalari</b>\n\n`;
    text += `Global XP per task: ${XP_PER_TASK}\n`; // Masalan, o'zgartirish mumkin

    const buttons = [
        [Markup.button.callback('XP ni o\'zgartirish', 'change_global_xp')],
        [Markup.button.callback('🔙', 'admin_panel')]
    ];

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('change_global_xp', async (ctx) => {
    ctx.session = { state: 'admin_change_global_xp' };
    await safeEdit(ctx, "⚙️ <b>Yangi XP miqdorini kiriting:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_bot_settings')]])
    });
});

// --- ADMIN MASS XP ---
bot.action('admin_mass_xp', async (ctx) => {
    if (!isAdmin(ctx.from.id.toString())) return;
    ctx.session = { state: 'admin_mass_xp' };
    await safeEdit(ctx, "🎁 <b>Barchaga XP miqdorini kiriting:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_panel')]])
    });
});

// --- ADMIN BAN LIST ---
bot.action('admin_ban_list', async (ctx) => {
    if (!isAdmin(ctx.from.id.toString())) return;
    const data = loadData();
    const banned = Object.entries(data.users).filter(([_, u]) => u.blocked).map(([id, u]) => `${id}: ${u.name}`);
    let text = `🚫 <b>Ban List</b>\n\n${banned.join('\n') || 'Yo\'q'}`;
    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_panel')]]) });
});

// --- ADMIN LOGS ---
bot.action('admin_logs', async (ctx) => {
    if (!isAdmin(ctx.from.id.toString())) return;

    const data = loadData();
    const users = Object.values(data.users);
    const userCount = users.length;
    const today = dayjs().format('YYYY-MM-DD');

    // Statistika
    let text = `📜 <b>Bot Logs va Statistika</b>\n\n`;
    text += `📅 Sana: ${dayjs().format('DD.MM.YYYY HH:mm')}\n\n`;

    text += `👥 <b>Foydalanuvchilar:</b>\n`;
    text += `• Jami: ${userCount}\n`;
    text += `• Faol: ${users.filter(u => !u.blocked).length}\n`;
    text += `• Bloklangan: ${users.filter(u => u.blocked).length}\n\n`;

    // Bugungi faollik
    const todayTasks = users.reduce((sum, u) => {
        const tasks = (u.tasks || []).filter(t => t.datetime.startsWith(today));
        return sum + tasks.length;
    }, 0);

    text += `📋 <b>Bugungi faollik:</b>\n`;
    text += `• Vazifalar: ${todayTasks}\n\n`;

    // Eng faol foydalanuvchilar
    const topUsers = users
        .sort((a, b) => (b.xp || 0) - (a.xp || 0))
        .slice(0, 5);

    if (topUsers.length > 0) {
        text += `🏆 <b>Top 5 foydalanuvchi:</b>\n`;
        topUsers.forEach((u, idx) => {
            text += `${idx + 1}. ${u.name} - ${u.xp || 0} XP\n`;
        });
    }

    // Fayl logs
    let fileLogs = '';
    try {
        const logFiles = ['bot_logs.txt', 'logs.txt', 'error.log'];
        for (const logFile of logFiles) {
            if (fs.existsSync(logFile)) {
                const content = fs.readFileSync(logFile, 'utf-8');
                if (content) {
                    fileLogs = content.split('\n').slice(-20).join('\n'); // Oxirgi 20 qator
                    break;
                }
            }
        }
    } catch (e) {
        fileLogs = 'Log fayllari topilmadi.';
    }

    if (fileLogs) {
        text += `\n📄 <b>Oxirgi loglar:</b>\n<code>${fileLogs}</code>`;
    }

    await safeEdit(ctx, text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_panel')]])
    });
});

// --- ADMIN UPDATE SHOP ---
bot.action('admin_update_shop', async (ctx) => {
    if (!isAdmin(ctx.from.id.toString())) return;
    ctx.session = { state: 'admin_update_shop_item' };
    await safeEdit(ctx, "🛒 <b>Item key:price:desc kiriting (masalan: newitem:100:Yangi desc):</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_panel')]])
    });
});

// --- ADMIN SEND NOTIF ---
bot.action('admin_send_notif', async (ctx) => {
    if (!isAdmin(ctx.from.id.toString())) return;
    ctx.session = { state: 'admin_send_notif' };
    await safeEdit(ctx, "🔔 <b>Notif xabarini kiriting:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_panel')]])
    });
});

// --- ADMIN VIEW USER TASKS ---
bot.action('admin_view_user_tasks', async (ctx) => {
    if (!isAdmin(ctx.from.id.toString())) return;
    ctx.session = { state: 'admin_view_user_tasks' };
    await safeEdit(ctx, "📋 <b>User ID kiriting:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_panel')]])
    });
});

// --- ADMIN RESET USER ---
bot.action('admin_reset_user', async (ctx) => {
    if (!isAdmin(ctx.from.id.toString())) return;
    ctx.session = { state: 'admin_reset_user' };
    await safeEdit(ctx, "🔄 <b>User ID kiriting:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_panel')]])
    });
});

// --- ADMIN BACKUP RESTORE ---
bot.action('admin_backup_restore', async (ctx) => {
    if (!isAdmin(ctx.from.id.toString())) return;
    ctx.session = { state: 'admin_restore_backup' };
    await safeEdit(ctx, "💾 <b>Backup faylini yuklang (document):</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_panel')]])
    });
});

// --- ACTION HANDLERS ---
bot.action('main_menu', (ctx) => showMainMenu(ctx));
bot.action('view_today', (ctx) => viewTasks(ctx, 'today'));
bot.action('view_all', (ctx) => viewTasks(ctx, 'all'));

bot.action(/list_(.*)_(\d+)/, (ctx) => {
    const filter = ctx.match[1];
    const page = parseInt(ctx.match[2]);
    viewTasks(ctx, filter, page);
});

bot.action(/do_(\d+)/, async (ctx) => {
    const index = parseInt(ctx.match[1]);
    const userId = ctx.from.id.toString();
    const data = loadData();
    if (data.users[userId].tasks[index]) {
        data.users[userId].tasks[index].done = true;
        data.users[userId].xp += XP_PER_TASK;
        saveData(data);
        await ctx.answerCbQuery(`🎉 +${XP_PER_TASK} XP`);
        viewTasks(ctx, 'today');
    }
});

bot.action(/del_(\d+)/, async (ctx) => {
    const index = parseInt(ctx.match[1]);
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const lang = user.settings?.language || 'uz';

    if (user.settings?.noEscapeMode) {
        return ctx.answerCbQuery(getText(lang, 'noEscape.cannot_delete'), { show_alert: true });
    }

    if (data.users[userId].tasks[index]) {
        data.users[userId].tasks.splice(index, 1);
        saveData(data);
        await ctx.answerCbQuery(getText(lang, 'common.delete'));
        viewTasks(ctx, 'all');
    }
});

bot.action(/buy_(.*)/, async (ctx) => {
    const key = ctx.match[1];
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const item = SHOP_ITEMS[key];
    const lang = user.settings?.language || 'uz';

    if (user.unlocked && user.unlocked.includes(key)) {
        return ctx.answerCbQuery("⚠️ Siz bu funksiyani allaqachon sotib olgansiz!");
    }

    if (user.xp >= item.price) {
        user.xp -= item.price;
        if (!user.unlocked) user.unlocked = [];
        user.unlocked.push(key);
        saveData(data);
        await ctx.answerCbQuery(`✅ ${item.name} olindi!`);
        await ctx.reply(`🎉 ${item.name} ochildi!`);
        await showMainMenu(ctx);
    } else {
        await ctx.answerCbQuery(`❌ XP yetarli emas!`);
    }
});

bot.action(/habit_do_(\d+)/, async (ctx) => {
    const idx = parseInt(ctx.match[1]);
    const userId = ctx.from.id.toString();
    const data = loadData();

    if (data.users[userId].habits[idx] && !data.users[userId].habits[idx].doneToday) {
        data.users[userId].habits[idx].doneToday = true;
        data.users[userId].habits[idx].streak = (data.users[userId].habits[idx].streak || 0) + 1;
        data.users[userId].xp += XP_PER_HABIT;
        saveData(data);
        await ctx.answerCbQuery(`✅ +${XP_PER_HABIT} XP`);
        await bot.action('view_habits', ctx);
    }
});

bot.action('noop', async (ctx) => await ctx.answerCbQuery(''));

// Vazifa qo'shish handlers (Kategoriya va Difficulty va Time)
bot.action(/select_cat_(.*)/, async (ctx) => {
    const category = ctx.match[1];
    ctx.session.temp_task_category = category;
    ctx.session.state = 'await_task_difficulty_select';

    const userId = ctx.from.id.toString();
    const data = loadData();
    const lang = data.users[userId]?.settings?.language || 'uz';

    const buttons = [
        [Markup.button.callback(getText(lang, 'difficulty.level_1'), 'select_diff_1')],
        [Markup.button.callback(getText(lang, 'difficulty.level_2'), 'select_diff_2')],
        [Markup.button.callback(getText(lang, 'difficulty.level_3'), 'select_diff_3')],
        [Markup.button.callback(getText(lang, 'difficulty.level_4'), 'select_diff_4')],
        [Markup.button.callback(getText(lang, 'difficulty.level_5'), 'select_diff_5')]
    ];

    await safeEdit(ctx, getText(lang, 'difficulty.prompt'), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons)
    });
});

bot.action(/select_diff_(.*)/, async (ctx) => {
    const difficulty = parseInt(ctx.match[1]);
    ctx.session.temp_task_difficulty = difficulty;
    ctx.session.state = 'await_task_time';

    const userId = ctx.from.id.toString();
    const data = loadData();
    const lang = data.users[userId]?.settings?.language || 'uz';

    await ctx.reply(`🕒 <b>"${ctx.session.temp_task_desc}"</b> qachon? Format:  01.07 09:00`, withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
});

bot.action(/task_category_(.*)/, async (ctx) => {
    const category = ctx.match[1];
    ctx.session.temp_task_category = category;
    ctx.session.state = 'await_task_time';
    await ctx.answerCbQuery(`🏷 Kategoriya: ${category}`);
    await ctx.reply(`🕒 <b>"${ctx.session.temp_task_desc}"</b> qachon? Format:  01.07 09:00`, withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
});

bot.action('task_new_category', async (ctx) => {
    ctx.session.state = 'await_task_category_name';
    await ctx.answerCbQuery();
    await ctx.reply("🏷 <b>Yangi kategoriya nomini kiriting:</b>", withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
});

bot.action('task_skip_options', async (ctx) => {
    ctx.session.state = 'await_task_time';
    await ctx.answerCbQuery('⏭ O\'tkazib yuborildi');
    await ctx.reply(`🕒 <b>"${ctx.session.temp_task_desc}"</b> qachon? Format:  01.07 09:00`, withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
});

bot.action('enter_goal_chat', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const lang = user.settings?.language || 'uz';

    if (user.blocked) return ctx.answerCbQuery(getText(lang, 'registration.blocked'));

    if (!user.unlocked || !user.unlocked.includes('goal_chat')) {
        return ctx.answerCbQuery(getText(lang, 'shop.locked_section'), { show_alert: true });
    }

    if (user.chatBanExpires && dayjs(user.chatBanExpires).isAfter(dayjs())) {
        return ctx.reply(getText(lang, 'goalChat.banned', { time: dayjs(user.chatBanExpires).format('DD.MM HH:mm') }), withProtectContentForCtx(ctx));
    }

    user.state = 'goal_chat';
    saveData(data);
    const anonId = generateAnonId(userId);
    await safeAnswerCbQuery(ctx);
    await ctx.reply(getText(lang, 'goalChat.joined', { anonId }), withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
});

// --- GOAL CHAT LOGIC ---
async function handleGoalChatMessage(ctx, sender, text, data) {
    const senderId = ctx.from.id.toString();
    const anonId = generateAnonId(senderId);
    const time = dayjs().format('HH:mm');

    // Broadcast
    const tasks = [];
    for (const [uid, user] of Object.entries(data.users)) {
        if (user.state === 'goal_chat') {
            const uLang = user.settings?.language || 'uz';
            const msg = getText(uLang, 'goalChat.msg_template', {
                anonId,
                time,
                text
            });
            tasks.push(bot.telegram.sendMessage(uid, msg, { parse_mode: 'HTML' }).catch(() => { }));
        }
    }

    // Admin Monitor
    if (ADMIN_ID && ADMIN_ID !== senderId) {
        const adminMsg = getText('uz', 'goalChat.admin_msg_template', { text: `\n<a href="tg://user?id=${senderId}">${sender.name}</a> (${anonId}):\n${text}` });
        tasks.push(bot.telegram.sendMessage(ADMIN_ID, adminMsg, { parse_mode: 'HTML' }).catch(() => { }));
    }

    await Promise.all(tasks);
}

// Commands
bot.command('goalchat', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const lang = user.settings?.language || 'uz';

    if (user.blocked) return;

    if (!user.unlocked || !user.unlocked.includes('goal_chat')) {
        return ctx.reply(getText(lang, 'shop.locked_section') + ' ' + (SHOP_ITEMS['goal_chat']?.name || 'Goal Chat'), withProtectContentForCtx(ctx));
    }

    if (user.chatBanExpires && dayjs(user.chatBanExpires).isAfter(dayjs())) {
        return ctx.reply(getText(lang, 'goalChat.banned', { time: dayjs(user.chatBanExpires).format('DD.MM HH:mm') }), withProtectContentForCtx(ctx));
    }

    user.state = 'goal_chat';
    saveData(data);
    const anonId = generateAnonId(userId);
    await ctx.reply(getText(lang, 'goalChat.joined', { anonId }), withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
});

bot.command('chiqish', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const lang = user.settings?.language || 'uz';

    if (user.state === 'goal_chat') {
        user.state = null;
        user.unlocked = user.unlocked.filter(k => k !== 'goal_chat');
        saveData(data);
        await ctx.reply(getText(lang, 'goalChat.left'), withProtectContentForCtx(ctx));
    } else {
        await ctx.reply('You are not in the chat.', withProtectContentForCtx(ctx));
    }
});

bot.command('unban', async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const args = ctx.message.text.split(' ');
    const targetId = args[1];
    if (!targetId) return ctx.reply('/unban [userId]');

    const data = loadData();
    if (data.users[targetId]) {
        data.users[targetId].chatBanExpires = null;
        saveData(data);
        ctx.reply(`✅ ${targetId} unbanned.`);
    } else {
        ctx.reply('User not found.');
    }
});

bot.command('clearchat', async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const data = loadData();
    let count = 0;
    for (const [uid, user] of Object.entries(data.users)) {
        if (user.state === 'goal_chat') {
            bot.telegram.sendMessage(uid, '🧹 <b>Chat tozalandi (Admin)</b>', { parse_mode: 'HTML' }).catch(() => { });
            count++;
        }
    }
    ctx.reply(`✅ Cleared msg sent to ${count} users.`);
});

bot.command('simuser', async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const text = ctx.message.text.split(' ').slice(1).join(' ') || "Salom, bu test xabar!";
    const fakeUser = { name: "Test User" };

    // Mock ctx with a fake user ID to generate a different Anon ID
    const mockCtx = {
        from: { id: 123456789 }, // Fake ID
        telegram: bot.telegram
    };

    const data = loadData();
    await handleGoalChatMessage(mockCtx, fakeUser, text, data);
    ctx.reply("✅ Test xabar yuborildi.");
});

// --- TEXT INPUT HANDLER ---
bot.on('text', async (ctx) => {
    if (ctx.message.text.startsWith('/start')) return;

    const userId = ctx.from.id.toString();
    const text = ctx.message.text.trim();
    const data = loadData();

    await deleteUserMsg(ctx);

    if (!ctx.session) ctx.session = {};
    if (!data.users[userId] && ctx.session.state !== 'register') {
        return ctx.reply("⚠️ /start bosing.", withProtectContentForCtx(ctx));
    }

    if (ctx.session.state === 'register') {
        data.users[userId] = {
            name: text,
            xp: 0,
            tasks: [],
            habits: [],
            unlocked: [],
            blocked: false,
            joinedAt: new Date(),
            settings: { notifications: true, language: 'uz' }
        };
        saveData(data);
        ctx.session.state = null;
        await ctx.reply(`🎉 Ro'yxatdan o'tdingiz, ${text}!`, withProtectContentForCtx(ctx));
        await showMainMenu(ctx);
        return;
    }

    if (ctx.session.state === 'await_task_desc') {
        ctx.session.temp_task_desc = text;
        const data = loadData();
        const lang = data.users[userId]?.settings?.language || 'uz';

        ctx.session.state = 'await_task_category_select';

        const categories = ['work', 'study', 'personal', 'other'];
        const buttons = [];
        let row = [];
        categories.forEach((cat, idx) => {
            row.push(Markup.button.callback(getText(lang, `categories_list.${cat}`), `select_cat_${cat}`));
            if (row.length === 2) {
                buttons.push(row);
                row = [];
            }
        });
        if (row.length > 0) buttons.push(row);

        await safeEdit(ctx, getText(lang, 'categories_list.prompt'), {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard(buttons)
        });
        return;
    }

    if (ctx.session.state === 'await_task_time') {
        let datetime;
        if (/^\d{1,2}[:.]\d{2}$/.test(text.replace('.', ':'))) {
            datetime = dayjs(`${dayjs().format('YYYY-MM-DD')} ${text.replace('.', ':')}`, 'YYYY-MM-DD HH:mm');
        } else {
            const parts = text.split(' ');
            if (parts.length >= 2) {
                const datePart = parts[0].replace('.', '-');
                datetime = dayjs(`${new Date().getFullYear()}-${datePart} ${parts[1]}`, 'YYYY-MM-DD HH:mm');
            }
        }

        if (ctx.session.last_msg_id) ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.last_msg_id).catch(() => { });

        if (!datetime || !datetime.isValid()) {
            const err = await ctx.reply("❌ Format xato. Qayta.", withProtectContentForCtx(ctx));
            ctx.session.last_msg_id = err.message_id;
            return;
        }

        const newTask = {
            desc: ctx.session.temp_task_desc,
            datetime: datetime.format('YYYY-MM-DD HH:mm'),
            done: false,
            reminded: false,
            priority: (ctx.session.temp_task_difficulty >= 4) ? 'high' : 'normal',
            category: ctx.session.temp_task_category || 'other',
            difficulty: ctx.session.temp_task_difficulty || 3,
            status: 'active',
            createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
            postponeCount: 0
        };
        data.users[userId].tasks.push(newTask);
        // Session o'zgaruvchilarini tozalash
        ctx.session.temp_task_priority = null;
        ctx.session.temp_task_category = null;
        ctx.session.temp_task_difficulty = null;
        ctx.session.temp_task_desc = null;
        saveData(data);
        ctx.session.state = null;
        await ctx.reply(`✅ Saqlandi!`, withProtectContentForCtx(ctx));
        await showMainMenu(ctx);
        return;
    }

    if (ctx.session.state === 'await_habit_name') {
        if (!data.users[userId].habits) data.users[userId].habits = [];
        data.users[userId].habits.push({
            name: text,
            streak: 0,
            doneToday: false
        });
        saveData(data);
        ctx.session.state = null;
        await ctx.reply(`✅ Yangi odat qo'shildi! Har kuni eslatiladi.`, withProtectContentForCtx(ctx));
        await bot.action('view_habits', ctx);
        return;
    }

    if (ctx.session.state === 'await_language') {
        const lang = text.toLowerCase();
        if (['uz', 'en', 'ru'].includes(lang)) {
            data.users[userId].settings.language = lang;
            saveData(data);
            await ctx.reply(`🌐 Til o'zgartirildi: ${lang.toUpperCase()}`, withProtectContentForCtx(ctx));
        } else {
            await ctx.reply("❌ Uz/En/Ru dan birini.", withProtectContentForCtx(ctx));
        }
        ctx.session.state = null;
        await bot.action('view_settings', ctx);
        return;
    }

    if (ctx.session.state === 'await_category_name') {
        if (!data.users[userId].categories) data.users[userId].categories = [];
        data.users[userId].categories.push(text);
        saveData(data);
        ctx.session.state = null;
        await ctx.reply(`✅ Kategoriya qo'shildi! Vazifalarni kategoriya bilan saqlash mumkin.`, withProtectContentForCtx(ctx));
        await bot.action('view_categories', ctx);
        return;
    }

    if (ctx.session.state === 'await_task_category_name') {
        if (!data.users[userId].categories) data.users[userId].categories = [];
        if (!data.users[userId].categories.includes(text)) {
            data.users[userId].categories.push(text);
        }
        ctx.session.temp_task_category = text;
        ctx.session.state = 'await_task_time';
        saveData(data);
        await ctx.reply(`✅ Kategoriya qo'shildi va tanlandi!\n🕒 <b>"${ctx.session.temp_task_desc}"</b> qachon? Format:  01.07 09:00`, withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
        return;
    }

    if (ctx.session.state === 'await_reminder_interval') {
        const interval = parseInt(text);
        if (!isNaN(interval)) {
            data.users[userId].settings.reminder_interval = interval;
            saveData(data);
            await ctx.reply(`✅ Interval o'rnatildi: ${interval} daqiqa`, withProtectContentForCtx(ctx));
        } else {
            await ctx.reply("❌ Raqam kiriting.", withProtectContentForCtx(ctx));
        }
        ctx.session.state = null;
        await bot.action('view_reminders', ctx);
        return;
    }

    if (ctx.session.state === 'await_advanced_reminder_desc') {
        ctx.session.temp_rem_desc = text;
        ctx.session.state = 'await_advanced_reminder_times';
        await ctx.reply(`🔔 <b>Bir nechta vaqtni kiriting (HH:mm,HH:mm):</b>`, withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
        return;
    }

    if (ctx.session.state === 'await_advanced_reminder_times') {
        const times = text.split(',');
        if (!data.users[userId].advancedReminders) data.users[userId].advancedReminders = [];
        data.users[userId].advancedReminders.push({ desc: ctx.session.temp_rem_desc, times });
        saveData(data);
        ctx.session.state = null;
        await ctx.reply(`✅ Bir nechta eslatma qo'shildi! Belgilangan vaqtlarda eslatiladi.`, withProtectContentForCtx(ctx));
        await bot.action('view_reminders', ctx);
        return;
    }

    if (ctx.session.state === 'await_goal_name') {
        if (!data.users[userId].goals) data.users[userId].goals = [];
        data.users[userId].goals.push({ name: text, subTasks: [], progress: 0 });
        saveData(data);
        ctx.session.state = null;
        await ctx.reply(`✅ Uzoq muddatli maqsad qo'shildi! Kichik vazifalarga bo'linadi.`, withProtectContentForCtx(ctx));
        await bot.action('view_goals', ctx);
        return;
    }

    if (ctx.session.state === 'await_sub_task') {
        const idx = ctx.session.goalIdx;
        if (!data.users[userId].goals[idx].subTasks) data.users[userId].goals[idx].subTasks = [];
        data.users[userId].goals[idx].subTasks.push({ desc: text, done: false });
        saveData(data);
        ctx.session.state = null;
        await ctx.reply(`✅ Kichik vazifa qo'shildi!`, withProtectContentForCtx(ctx));
        await bot.action(`update_goal_${idx}`, ctx);
        return;
    }

    if (ctx.session.state === 'await_note_text') {
        if (!data.users[userId].notes) data.users[userId].notes = [];
        data.users[userId].notes.push({ text });
        saveData(data);
        ctx.session.state = null;
        await ctx.reply(`✅ Eslatma saqlandi! Keyin ko'rish va tahrirlash mumkin.`, withProtectContentForCtx(ctx));
        await bot.action('view_notes', ctx);
        return;
    }

    if (ctx.session.state === 'await_edit_note') {
        const idx = ctx.session.noteIdx;
        data.users[userId].notes[idx].text = text;
        saveData(data);
        ctx.session.state = null;
        await ctx.reply(`✅ Eslatma tahrirlandi!`, withProtectContentForCtx(ctx));
        await bot.action('view_notes', ctx);
        return;
    }

    if (ctx.session.state === 'await_calendar_task') {
        const task = data.users[userId].tasks.find(t => t.desc === text);
        if (task) {
            if (!data.users[userId].calendarEvents.includes(task.datetime)) {
                data.users[userId].calendarEvents.push(task.datetime);
                saveData(data);
                await ctx.reply(`✅ Vazifa kalendarga qo'shildi! Vaqt to'qnashuvlari ogohlantiriladi.`, withProtectContentForCtx(ctx));
            } else {
                await ctx.reply(`⚠️ Allaqachon qo'shilgan.`, withProtectContentForCtx(ctx));
            }
        } else {
            await ctx.reply(`❌ Vazifa topilmadi.`, withProtectContentForCtx(ctx));
        }
        ctx.session.state = null;
        await bot.action('view_calendar', ctx);
        return;
    }

    if (ctx.session.state === 'await_custom_reminder_desc') {
        ctx.session.temp_rem_desc = text;
        ctx.session.state = 'await_custom_reminder_time';
        await ctx.reply(`🛎 <b>Eslatma vaqtini kiriting:</b>\n\nFormatlar:\n• <code>09:00</code> (Har kuni)\n• <code>08.01 15:00</code> (Aniq sana va vaqt)`, withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
        return;
    }

    if (ctx.session.state === 'await_custom_reminder_time') {
        ctx.session.temp_rem_input = text;
        ctx.session.state = 'await_custom_reminder_text';
        await ctx.reply(`🛎 <b>Maxsus matnni kiriting:</b>`, withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
        return;
    }

    if (ctx.session.state === 'await_custom_reminder_text') {
        if (!data.users[userId].custom_reminders) data.users[userId].custom_reminders = [];

        // Parse input
        let newRem = { desc: ctx.session.temp_rem_desc, customText: text };

        // Sana bormi tekshiramiz
        if (ctx.session.temp_rem_input.includes(' ') || ctx.session.temp_rem_input.includes('.')) {
            // Date parsing logic (Taskdagidek)
            let datetime;
            if (/^\d{1,2}[:.]\d{2}$/.test(ctx.session.temp_rem_input.replace('.', ':'))) {
                // Faqat soat bo'lsa (lekin bu branchga kirmasligi kerak kunlik bo'lsa) - baribir check
                newRem.time = ctx.session.temp_rem_input.replace('.', ':');
            } else {
                const parts = ctx.session.temp_rem_input.split(' ');
                if (parts.length >= 2) {
                    const datePart = parts[0].replace('.', '-'); // 08-01
                    // Yilni qo'shamiz
                    datetime = dayjs(`${new Date().getFullYear()}-${datePart} ${parts[1]}`, 'YYYY-MM-DD HH:mm');
                    if (datetime.isValid()) {
                        newRem.datetime = datetime.format('YYYY-MM-DD HH:mm');
                    }
                }
            }
        }

        if (!newRem.datetime && !newRem.time) {
            // Fallback to time if parsing failed or simple HH:mm
            newRem.time = ctx.session.temp_rem_input.replace('.', ':');
        }

        data.users[userId].custom_reminders.push(newRem);
        saveData(data);
        ctx.session.state = null;

        const timeStr = newRem.datetime ? `📅 ${newRem.datetime}` : `⏰ ${newRem.time} (Har kuni)`;
        await ctx.reply(`✅ Shaxsiy eslatma qo'shildi!\n${timeStr}`, withProtectContentForCtx(ctx));
        await bot.action('view_custom_reminders', ctx);
        return;
    }

    if (ctx.session.state === 'await_voice_note_text') {
        ctx.session.temp_voice_desc = text;
        ctx.session.state = 'await_voice_time';
        await ctx.reply(`⏰ <b>Eslatma vaqtini kiriting:</b>\n\nFormatlar:\n• <code>09:00</code> (Har kuni)\n• <code>08.01 15:00</code> (Aniq sana va vaqt)`, withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
        return;
    }

    if (ctx.session.state === 'await_voice_time') {
        const input = text;
        if (!data.users[userId].voiceNotes) data.users[userId].voiceNotes = [];

        let newVoice = {
            voiceId: ctx.session.temp_voice_id,
            desc: ctx.session.temp_voice_desc || null
        };

        // Sana bormi tekshiramiz
        if (input.includes(' ') || input.includes('.')) {
            let datetime;
            const parts = input.split(' ');
            if (parts.length >= 2) {
                const datePart = parts[0].replace('.', '-');
                datetime = dayjs(`${new Date().getFullYear()}-${datePart} ${parts[1]}`, 'YYYY-MM-DD HH:mm');
                if (datetime.isValid()) {
                    newVoice.datetime = datetime.format('YYYY-MM-DD HH:mm');
                }
            }
        }

        if (!newVoice.datetime) {
            newVoice.time = input.replace('.', ':');
        }

        data.users[userId].voiceNotes.push(newVoice);
        saveData(data);
        ctx.session.state = null;
        ctx.session.temp_voice_id = null;
        ctx.session.temp_voice_desc = null;

        const timeStr = newVoice.datetime ? `📅 ${newVoice.datetime}` : `⏰ ${newVoice.time} (Har kuni)`;
        await ctx.reply(`✅ Ovozli eslatma saqlandi!\n${timeStr}`, withProtectContentForCtx(ctx));
        await bot.action('view_voice_notes', ctx);
        return;
    }

    if (ctx.session.state === 'admin_broadcast_msg' && isAdmin(userId)) {
        const users = Object.keys(data.users);
        if (users.length === 0) {
            ctx.session.state = null;
            return ctx.reply("❌ Foydalanuvchilar yo'q.", withProtectContentForCtx(ctx));
        }

        let sent = 0;
        let failed = 0;
        const msg = await ctx.reply(`🚀 ${users.length} kishiga yuborilmoqda...`, withProtectContentForCtx(ctx));

        for (const uid of users) {
            try {
                await bot.telegram.sendMessage(uid, `📢 <b>ADMIN XABARI:</b>\n\n${text}`, { parse_mode: 'HTML' });
                sent++;
            } catch (e) {
                failed++;
            }
        }

        ctx.session.state = null;
        await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => { });
        await ctx.reply(`✅ <b>Natija:</b>\n\n✅ Yuborildi: ${sent}\n❌ Xato: ${failed}\n📊 Jami: ${users.length}`, withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
        await bot.action('admin_panel', ctx);
        return;
    }

    if (ctx.session.state === 'admin_ban_user' && isAdmin(userId)) {
        const targetId = text;
        if (data.users[targetId]) {
            data.users[targetId].blocked = !data.users[targetId].blocked;
            saveData(data);
            const status = data.users[targetId].blocked ? 'bloklandi' : 'chiqarildi';
            await ctx.reply(`✅ ${targetId} ${status}!`, withProtectContentForCtx(ctx));
        } else {
            await ctx.reply("❌ Topilmadi.", withProtectContentForCtx(ctx));
        }
        ctx.session.state = null;
        await bot.action('admin_panel', ctx);
        return;
    }

    if (ctx.session.state === 'admin_gift_xp_amount' && isAdmin(userId)) {
        const amount = parseInt(text);
        const targetId = ctx.session.targetId;
        if (!isNaN(amount) && data.users[targetId]) {
            data.users[targetId].xp += amount;
            saveData(data);
            await ctx.reply(`✅ ${targetId} ga ${amount} XP!`, withProtectContentForCtx(ctx));
            bot.telegram.sendMessage(targetId, `🎁 Admin ${amount} XP sovg'a qildi!`).catch(() => { });
        } else {
            await ctx.reply("❌ Xato.", withProtectContentForCtx(ctx));
        }
        ctx.session.state = null;
        await bot.action('admin_panel', ctx);
        return;
    }

    if (ctx.session.state === 'admin_change_global_xp' && isAdmin(userId)) {
        const newXP = parseInt(text);
        if (!isNaN(newXP)) {
            data.settings.global_xp_per_task = newXP;
            saveData(data);
            await ctx.reply(`✅ Global XP o'zgartirildi: ${newXP}`, withProtectContentForCtx(ctx));
        }
        ctx.session.state = null;
        await bot.action('admin_bot_settings', ctx);
        return;
    }

    if (ctx.session.state === 'admin_mass_xp' && isAdmin(userId)) {
        const amount = parseInt(text);
        if (!isNaN(amount)) {
            for (const uid in data.users) {
                data.users[uid].xp += amount;
            }
            saveData(data);
            await ctx.reply(`✅ Barchaga ${amount} XP!`, withProtectContentForCtx(ctx));
        }
        ctx.session.state = null;
        await bot.action('admin_panel', ctx);
        return;
    }

    if (ctx.session.state === 'admin_update_shop_item' && isAdmin(userId)) {
        const parts = text.split(':');
        if (parts.length >= 3) {
            const key = parts[0].trim();
            const price = parseInt(parts[1]);
            const desc = parts.slice(2).join(':').trim(); // Desc ichida ':' bo'lishi mumkin

            if (!key || isNaN(price) || price < 0) {
                await ctx.reply("❌ Format xato. Key va price to'g'ri bo'lishi kerak.", withProtectContentForCtx(ctx));
                return;
            }

            const name = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            SHOP_ITEMS[key] = { name, price, desc };

            await ctx.reply(`✅ Item qo'shildi/yangilandi:\n\n<b>${name}</b>\n💰 ${price} XP\n📝 ${desc}`, withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
        } else {
            await ctx.reply("❌ Format xato.\n\nTo'g'ri format: key:price:desc\nMasalan: new_feature:150:Yangi funksiya", withProtectContentForCtx(ctx));
            return;
        }
        ctx.session.state = null;
        await bot.action('admin_panel', ctx);
        return;
    }

    if (ctx.session.state === 'admin_send_notif' && isAdmin(userId)) {
        const users = Object.keys(data.users).filter(uid => {
            const user = data.users[uid];
            return !user.blocked && user.settings && user.settings.notifications !== false;
        });

        if (users.length === 0) {
            ctx.session.state = null;
            return ctx.reply("❌ Bildirishnomalar yoqilgan foydalanuvchilar yo'q.", withProtectContentForCtx(ctx));
        }

        let sent = 0;
        let failed = 0;
        const msg = await ctx.reply(`🔔 ${users.length} kishiga bildirishnoma yuborilmoqda...`, withProtectContentForCtx(ctx));

        for (const uid of users) {
            try {
                await bot.telegram.sendMessage(uid, `🔔 <b>Bildirishnoma:</b>\n\n${text}`, { parse_mode: 'HTML' });
                sent++;
            } catch (e) {
                failed++;
            }
        }

        ctx.session.state = null;
        await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => { });
        await ctx.reply(`✅ <b>Natija:</b>\n\n✅ Yuborildi: ${sent}\n❌ Xato: ${failed}\n📊 Jami: ${users.length}`, withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
        await bot.action('admin_panel', ctx);
        return;
    }

    if (ctx.session.state === 'admin_view_user_tasks' && isAdmin(userId)) {
        const targetId = text.trim();
        if (data.users[targetId]) {
            const user = data.users[targetId];
            const tasks = user.tasks || [];
            const doneTasks = tasks.filter(t => t.done);
            const pendingTasks = tasks.filter(t => !t.done);

            let text = `📋 <b>${user.name} vazifalari</b>\n\n`;
            text += `📊 Statistika:\n`;
            text += `• Jami: ${tasks.length}\n`;
            text += `• Bajarilgan: ${doneTasks.length}\n`;
            text += `• Qolgan: ${pendingTasks.length}\n\n`;

            if (tasks.length === 0) {
                text += `📭 Vazifalar yo'q.`;
            } else {
                text += `<b>Bajarilgan:</b>\n`;
                doneTasks.slice(0, 10).forEach(t => {
                    text += `✅ ${t.desc}\n`;
                });
                if (doneTasks.length > 10) text += `... va yana ${doneTasks.length - 10} ta\n\n`;

                text += `<b>Qolgan:</b>\n`;
                pendingTasks.slice(0, 10).forEach(t => {
                    const time = dayjs(t.datetime).format('DD.MM HH:mm');
                    text += `⏳ ${t.desc} (${time})\n`;
                });
                if (pendingTasks.length > 10) text += `... va yana ${pendingTasks.length - 10} ta`;
            }

            await safeEdit(ctx, text, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('👤 Foydalanuvchi ma\'lumotlari', `admin_user_detail_${targetId}`)],
                    [Markup.button.callback('🔙', 'admin_panel')]
                ])
            });
        } else {
            await ctx.reply("❌ Foydalanuvchi topilmadi.", withProtectContentForCtx(ctx));
        }
        ctx.session.state = null;
        return;
    }

    if (ctx.session.state === 'admin_reset_user' && isAdmin(userId)) {
        const targetId = text;
        if (data.users[targetId]) {
            data.users[targetId] = { name: data.users[targetId].name, xp: 0, tasks: [], habits: [], unlocked: [], blocked: false, joinedAt: new Date(), settings: { notifications: true, language: 'uz' } };
            saveData(data);
            await ctx.reply(`✅ ${targetId} reset qilindi.`, withProtectContentForCtx(ctx));
        } else {
            await ctx.reply("❌ User topilmadi.", withProtectContentForCtx(ctx));
        }
        ctx.session.state = null;
        await bot.action('admin_panel', ctx);
        return;
    }

    // --- SABAB YOZISH UCHUN HANDLER (No-Escape Mode) ---
    if (ctx.session.state === 'await_task_reason') {
        const userId = ctx.from.id.toString();
        const data = loadData();
        const taskIdx = ctx.session.taskIdx;
        const reason = text.trim().substring(0, 200); // Maksimum 200 belgi

        if (!data.users[userId] || !data.users[userId].tasks[taskIdx]) {
            ctx.session.state = null;
            return ctx.reply(getText(data.users[userId]?.settings?.language || 'uz', 'common.error'));
        }

        const lang = data.users[userId].settings?.language || 'uz';
        const task = data.users[userId].tasks[taskIdx];

        task.reason = reason;
        task.status = 'missed';
        task.reasonDate = dayjs().format('YYYY-MM-DD HH:mm');

        saveData(data);
        await deleteUserMsg(ctx);
        await ctx.reply(getText(lang, 'noEscape.reason_saved'), withProtectContentForCtx(ctx));
        ctx.session.state = null;
        await showMainMenu(ctx);
        return;
    }

    // --- GOAL CHAT FALLBACK ---
    if (data.users[userId]?.state === 'goal_chat') {
        const user = data.users[userId];
        const lang = user.settings?.language || 'uz';

        if (ctx.message.forward_date || ctx.message.forward_from || ctx.message.forward_from_chat) {
            user.chatBanExpires = dayjs().add(7, 'day').format();
            user.state = null; // Kick
            saveData(data);
            await ctx.reply(getText(lang, 'goalChat.violation', { duration: '1 hafta' }), withProtectContentForCtx(ctx));
            if (ADMIN_ID) {
                const anonId = generateAnonId(userId);
                bot.telegram.sendMessage(ADMIN_ID, `🚫 <b>VIOLATION:</b> ${anonId} (ID: ${userId}) forwarded message. Banned.`);
            }
            return;
        }

        await handleGoalChatMessage(ctx, user, text, data);
        return;
    }
});

// --- VOICE HANDLER FOR OVOZLI ESLATMALAR ---
bot.on('voice', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    if (ctx.session.state === 'await_voice_note') {
        const voiceFileId = ctx.message.voice.file_id;
        ctx.session.temp_voice_id = voiceFileId;
        ctx.session.state = 'await_voice_time';
        await ctx.reply(`🎤 <b>Ovoz saqlandi. Eslatma vaqtini kiriting:</b>\n\nFormatlar:\n• <code>09:00</code> (Har kuni)\n• <code>08.01 15:00</code> (Aniq sana va vaqt)`, withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
    }
});



// --- DOCUMENT HANDLER FOR RESTORE ---
bot.on('document', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (ctx.session.state === 'admin_restore_backup' && isAdmin(userId)) {
        const fileId = ctx.message.document.file_id;
        const fileName = ctx.message.document.file_name || 'backup.json';

        if (!fileName.endsWith('.json')) {
            await ctx.reply('❌ Faqat JSON fayllar qabul qilinadi!', withProtectContentForCtx(ctx));
            return;
        }

        try {
            const file = await ctx.telegram.getFile(fileId);
            const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

            // Backup faylini yuklab olish
            const backupData = await new Promise((resolve, reject) => {
                https.get(fileUrl, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(new Error('JSON parse xatosi'));
                        }
                    });
                }).on('error', reject);
            });

            // Ma'lumotlarni tekshirish
            if (!backupData.users || !backupData.settings) {
                await ctx.reply('❌ Backup fayli noto\'g\'ri formatda!', withProtectContentForCtx(ctx));
                return;
            }

            // Eski backup yaratish
            const backupFileName = `backup_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.json`;
            fs.writeFileSync(backupFileName, JSON.stringify(loadData(), null, 4));

            // Yangi ma'lumotlarni yozish
            fs.writeFileSync(DATA_FILE, JSON.stringify(backupData, null, 4));

            await ctx.reply(`✅ Backup restore qilindi!\n\n📁 Eski backup: ${backupFileName}\n👥 Foydalanuvchilar: ${Object.keys(backupData.users).length}`, withProtectContentForCtx(ctx));
            ctx.session.state = null;
            await bot.action('admin_panel', ctx);
        } catch (e) {
            await ctx.reply(`❌ Xato: ${e.message}`, withProtectContentForCtx(ctx));
        }
    }
});

// Vaqtni flexible parse qilish uchun funksiya
function parseDateTime(dateTimeStr) {
    // Turli formatlarni sinab ko'rish
    const formats = [
        'YYYY-MM-DD HH:mm',
        'YYYY-MM-DDTHH:mm',
        'YYYY-MM-DDTHH:mm:ss',
        'YYYY-MM-DD HH:mm:ss'
    ];
    for (const format of formats) {
        const parsed = dayjs(dateTimeStr, format);
        if (parsed.isValid()) {
            return parsed;
        }
    }
    // Fallback - dayjs ning o'zi parse qilsin
    return dayjs(dateTimeStr);
}

// --- CRON JOBS ---
// Eslatmalar
cron.schedule('* * * * *', async () => {
    const data = loadData();
    const now = dayjs();
    const currentMinute = now.format('YYYY-MM-DD HH:mm'); // Joriy minut aniq
    let changed = false;

    console.log(`[CRON] Eslatmalar tekshirilmoqda: ${currentMinute}`);

    for (const [userId, user] of Object.entries(data.users)) {
        if (user.blocked || !user.settings || !user.settings.notifications) continue;

        // 1. One-time Tasks
        if (user.tasks) {
            for (const task of user.tasks) {
                if (!task.done && !task.reminded) {
                    const tTime = parseDateTime(task.datetime);
                    const taskMinute = tTime.format('YYYY-MM-DD HH:mm');

                    // Aniq vaqtida YOKI o'tgan vaqtda (lekin 24 soatdan ko'p emas) eslatma yuborish
                    if (tTime.isValid() && tTime.isSameOrBefore(now, 'minute') && tTime.isAfter(now.subtract(24, 'hour'))) {
                        console.log(`[REMINDER] Task topildi: "${task.desc}" - Vaqti: ${taskMinute} - User: ${userId}`);
                        try {
                            await bot.telegram.sendMessage(userId, `🔔 <b>Eslatma!</b>\n${task.desc}`, withProtectContentForUser(user, { parse_mode: 'HTML' }, userId));
                            task.reminded = true;
                            changed = true;
                        } catch (e) {
                            console.error(`Failed to send task reminder to ${userId}:`, e);
                            // Agar user bloklagan bo'lsa, qayta urinmaslik uchun reminded=true qilish mumkin,
                            // lekin tarmoq xatosi bo'lsa keyingi safar urinib ko'radi.
                            if (e.response && e.response.error_code === 403) {
                                task.reminded = true; // User bloklagan, qayta urinma
                                changed = true;
                            }
                        }
                    }
                }

                // No-Escape Mode check
                if (user.settings.noEscapeMode && !task.done && task.status !== 'missed' && task.status !== 'postponed') {
                    const tTime = parseDateTime(task.datetime);
                    if (tTime.isBefore(now) && !task.noEscapeTriggered) {
                        const lang = user.settings.language || 'uz';
                        const buttons = [
                            [Markup.button.callback(getText(lang, 'noEscape.postpone_10min'), `postpone_${user.tasks.indexOf(task)}_10min`)],
                            [Markup.button.callback(getText(lang, 'noEscape.postpone_1hour'), `postpone_${user.tasks.indexOf(task)}_1hour`)],
                            [Markup.button.callback(getText(lang, 'noEscape.postpone_tomorrow'), `postpone_${user.tasks.indexOf(task)}_tomorrow`)],
                            [Markup.button.callback(getText(lang, 'noEscape.write_reason'), `write_reason_${user.tasks.indexOf(task)}`)]
                        ];

                        try {
                            await bot.telegram.sendMessage(userId, getText(lang, 'noEscape.task_not_done', { title: task.desc }) + '\n' + getText(lang, 'noEscape.choose'), {
                                parse_mode: 'HTML',
                                ...Markup.inlineKeyboard(buttons)
                            });
                            task.noEscapeTriggered = true;
                            changed = true;
                        } catch (e) {
                            console.error('NoEscape Send error:', e);
                        }
                    }
                }
            }
        }

        const todayStr = now.format('YYYY-MM-DD');

        // 2. Custom reminders (One-time va Recurring)
        if (user.custom_reminders) {
            for (const rem of user.custom_reminders) {
                // A) One-time datetime eslatma (aniq sana va vaqt)
                if (rem.datetime) {
                    if (!rem.sent) {
                        const remTime = parseDateTime(rem.datetime);
                        console.log(`[CUSTOM_REMINDER] Tekshirilmoqda: "${rem.desc || rem.customText}" - Vaqti: ${rem.datetime} - User: ${userId}`);
                        // Vaqti kelgan va 24 soatdan ko'p o'tmagan bo'lsa
                        if (remTime.isSameOrBefore(now, 'minute') && remTime.isAfter(now.subtract(24, 'hour'))) {
                            try {
                                await bot.telegram.sendMessage(userId, `🛎 <b>Shaxsiy eslatma:</b>\n${rem.customText}`, withProtectContentForUser(user, { parse_mode: 'HTML' }, userId));
                                rem.sent = true;
                                changed = true;
                            } catch (e) {
                                console.error('Custom reminder (datetime) error:', e);
                                if (e.response && e.response.error_code === 403) {
                                    rem.sent = true;
                                    changed = true;
                                }
                            }
                        }
                    }
                }
                // B) Recurring (Har kuni) eslatma
                else if (rem.time) {
                    const [h, m] = rem.time.split(':').map(Number);
                    const remTime = dayjs().hour(h).minute(m).second(0);

                    // Agar bugun yuborilmagan bo'lsa va vaqti kelgan bo'lsa
                    if (rem.lastSent !== todayStr && remTime.isSameOrBefore(now, 'minute')) {
                        try {
                            await bot.telegram.sendMessage(userId, `🛎 <b>Shaxsiy eslatma:</b>\n${rem.customText}`, withProtectContentForUser(user, { parse_mode: 'HTML' }, userId));
                            rem.lastSent = todayStr;
                            changed = true;
                        } catch (e) {
                            console.error('Custom reminder (recurring) error:', e);
                        }
                    }
                }
            }
        }

        // 3. Advanced reminders (Recurring)
        if (user.advancedReminders) {
            user.advancedReminders.forEach(rem => {
                // Bu yerda biroz murakkab, chunki bir nechta vaqt bor. 
                // Oddiylik uchun har biri uchun alohida check qilamiz, lekin "lastSent" massiv bo'lishi kerak yoki har vaqt uchun flag.
                // Hozirgi tuzilishda oddiy check qoldiramiz, lekin isSameOrBefore ishlatamiz.
                // Yaxshisi, "times" arrayini tekshiramiz.
                // Eslatma: Advanced reminder strukturasi o'zgarmagan bo'lsa, har bir vaqt uchun 
                // bugun yuborilganligini tekshirish qiyin (chunki state yo'q). 
                // Vaqtinchalik yechim - faqat aniq vaqtni tekshirish (eski usul), 
                // yoki state qo'shish kerak. 
                // "Catch-up" faqat bir marta ishlaydigan narsalar uchun oson. Takroriylar uchun state kerak.
                // Keling, advanced uchun ham minimal state qo'shamiz agar iloji bo'lsa.
                // Agar yo'q bo'lsa, eski usulda qoldirib, faqat send error handle qilamiz.
                rem.times.forEach(time => {
                    // Aniq vaqt tekshiruvi (muhim o'zgarishsiz) - chunki buni to'liq qayta yozish kerak
                    if (dayjs().format('HH:mm') === time) {
                        bot.telegram.sendMessage(userId, `🔔 <b>Qayta eslatma:</b>\n${rem.desc}`, withProtectContentForUser(user, { parse_mode: 'HTML' }, userId))
                            .catch((e) => console.error('Send error:', e));
                    }
                });
            });
        }

        // 4. Ovozli eslatmalar (One-time va Recurring)
        if (user.voiceNotes) {
            for (const vn of user.voiceNotes) {
                // A) One-time datetime eslatma
                if (vn.datetime) {
                    if (!vn.sent) {
                        const vnTime = parseDateTime(vn.datetime);
                        console.log(`[VOICE_NOTE] Tekshirilmoqda - Vaqti: ${vn.datetime} - User: ${userId}`);
                        if (vnTime.isValid() && vnTime.isSameOrBefore(now, 'minute') && vnTime.isAfter(now.subtract(24, 'hour'))) {
                            try {
                                await bot.telegram.sendVoice(userId, vn.voiceId);
                                vn.sent = true;
                                changed = true;
                            } catch (e) {
                                console.error('Voice (datetime) error:', e);
                                if (e.response && e.response.error_code === 403) {
                                    vn.sent = true;
                                    changed = true;
                                }
                            }
                        }
                    }
                }
                // B) Recurring (Har kuni) eslatma
                else if (vn.time) {
                    const [h, m] = vn.time.split(':').map(Number);
                    const vnTime = dayjs().hour(h).minute(m).second(0);

                    if (vn.lastSent !== todayStr && vnTime.isSameOrBefore(now, 'minute')) {
                        try {
                            await bot.telegram.sendVoice(userId, vn.voiceId);
                            vn.lastSent = todayStr;
                            changed = true;
                        } catch (e) { console.error('Voice (recurring) error:', e); }
                    }
                }
            }
        }

        // 5. Odatlar eslatmalari (Daily at 20:00)
        if (user.habits) {
            // Global 20:00 check for habits
            const habitTime = dayjs().hour(20).minute(0).second(0);
            // User darajasida bugun eslatma yuborildimi?
            if (!user.habitsRemindedDate || user.habitsRemindedDate !== todayStr) {
                if (habitTime.isSameOrBefore(now, 'minute')) {
                    let hasPendingHabits = false;
                    user.habits.forEach(habit => {
                        if (!habit.doneToday) hasPendingHabits = true;
                    });

                    if (hasPendingHabits) {
                        try {
                            await bot.telegram.sendMessage(userId, `🔄 <b>Odatlarni unutmang!</b>\nBugungi odatlarni bajarib, streakni saqlab qoling.`, withProtectContentForUser(user, { parse_mode: 'HTML' }, userId));
                            user.habitsRemindedDate = todayStr;
                            changed = true;
                        } catch (e) { console.error('Habit remind error:', e); }
                    }
                }
            }
        }
    }
    if (changed) saveData(data);
});

// Odatlar reset va streak buzilishi
cron.schedule('0 0 * * *', async () => {
    const data = loadData();
    for (const userId in data.users) {
        const user = data.users[userId];
        if (user.habits) {
            user.habits.forEach(h => {
                if (!h.doneToday) {
                    h.streak = 0; // O'tkazib yuborilsa streak buziladi
                }
                h.doneToday = false;
            });
        }
    }
    saveData(data);
    console.log("🔄 Odatlar reset.");
});

// Motivatsiya moduli
cron.schedule('0 8 * * *', async () => {
    const data = loadData();
    const motivations = ["🌟 Bugun super!", "💪 Davom et!", "🔥 Foydalanuvchi holatiga mos maslahat: Dam oling!"];
    for (const [userId, user] of Object.entries(data.users)) {
        if (user.unlocked.includes('motivation') && !user.blocked && user.settings.notifications) {
            const msg = motivations[Math.floor(Math.random() * motivations.length)];
            bot.telegram.sendMessage(userId, `🔥 <b>Motivatsiya Moduli:</b>\n${msg}`, withProtectContentForUser(user, { parse_mode: 'HTML' }, userId)).catch((e) => console.error('Send error:', e));
        }
    }
    console.log("🔥 Motivatsiya yuborildi.");
});

// (Moved to end of file)// Haftalik tahlil funksiyasi
function analyzeWeeklyActivity(userId) {
    const data = loadData();
    const user = data.users[userId];
    if (!user) return null;

    const lang = user.settings?.language || 'uz';
    const sevenDaysAgo = dayjs().subtract(7, 'days');
    const tasks = (user.tasks || []).filter(t => dayjs(t.createdAt || t.datetime).isAfter(sevenDaysAgo));

    if (tasks.length < 3) {
        return getText(lang, 'weeklyAnalysis.no_data');
    }

    const completedTasks = tasks.filter(t => t.status === 'done' || t.done);
    const missedTasks = tasks.filter(t => t.status === 'missed');
    const completedPercent = Math.round((completedTasks.length / tasks.length) * 100);

    // Kategoriya tahlili
    const categoryStats = {};
    tasks.forEach(t => {
        const cat = t.category || 'other';
        if (!categoryStats[cat]) categoryStats[cat] = { total: 0, missed: 0 };
        categoryStats[cat].total++;
        if (t.status === 'missed' || (!t.done && dayjs(t.plannedTime || t.datetime).isBefore(dayjs()))) {
            categoryStats[cat].missed++;
        }
    });

    let mostAbandonedCategory = null;
    let maxMissedPercent = 0;
    for (const [cat, stats] of Object.entries(categoryStats)) {
        const percent = (stats.missed / stats.total) * 100;
        if (percent > maxMissedPercent) {
            maxMissedPercent = percent;
            mostAbandonedCategory = cat;
        }
    }

    // Vaqt tahlili
    const hourStats = {};
    completedTasks.forEach(t => {
        const hour = dayjs(t.completedAt || t.datetime).hour();
        hourStats[hour] = (hourStats[hour] || 0) + 1;
    });

    let bestHour = null;
    let maxCompleted = 0;
    for (const [hour, count] of Object.entries(hourStats)) {
        if (count > maxCompleted) {
            maxCompleted = count;
            bestHour = hour;
        }
    }

    // Kunlik tahlil
    const dayStats = {};
    tasks.forEach(t => {
        const day = dayjs(t.createdAt || t.datetime).format('dddd');
        if (!dayStats[day]) dayStats[day] = { total: 0, missed: 0 };
        dayStats[day].total++;
        if (t.status === 'missed') dayStats[day].missed++;
    });

    let lazyDay = null;
    let maxMissedCount = 0;
    for (const [day, stats] of Object.entries(dayStats)) {
        if (stats.missed > maxMissedCount) {
            maxMissedCount = stats.missed;
            lazyDay = day;
        }
    }

    // Tavsiyalar
    const advices = {
        uz: [
            `${mostAbandonedCategory ? getText(lang, `categories_list.${mostAbandonedCategory}`) : 'Ish'} vazifalaringizni kichikroq qismlarga bo'ling.`,
            `Kunning ${bestHour ? bestHour : 9}-${bestHour ? parseInt(bestHour) + 2 : 11} oralig'ida muhim vazifalarni bajaring.`,
            `${lazyDay || 'Dushanba'} kuni uchun kam vazifa rejalashtiring yoki motivatsiyani oshiring.`,
            `Qiyin vazifalarni energiya yuqori paytingizda bajaring.`,
            `Har kuni kamida 3 ta vazifa tugatishga harakat qiling.`
        ],
        en: [
            `Break down your ${mostAbandonedCategory ? mostAbandonedCategory : 'work'} tasks into smaller parts.`,
            `Do important tasks between ${bestHour || 9}-${(bestHour || 9) + 2}.`,
            `Plan fewer tasks or boost motivation on ${lazyDay || 'Monday'}.`,
            `Do difficult tasks when your energy is high.`,
            `Try to complete at least 3 tasks daily.`
        ],
        ru: [
            `Разбейте задачи по категории ${mostAbandonedCategory ? mostAbandonedCategory : 'работа'} на мелкие части.`,
            `Выполняйте важные задачи между ${bestHour || 9}-${(bestHour || 9) + 2} часами.`,
            `Планируйте меньше задач в ${lazyDay || 'понедельник'} или повысьте мотивацию.`,
            `Выполняйте сложные задачи, когда энергия на высоте.`,
            `Старайтесь выполнять минимум 3 задачи в день.`
        ]
    };

    const randomAdvice = advices[lang][Math.floor(Math.random() * advices[lang].length)];

    let report = `${getText(lang, 'weeklyAnalysis.title')}\n\n`;
    report += `${getText(lang, 'weeklyAnalysis.total_tasks')}: ${tasks.length}\n`;
    report += `${getText(lang, 'weeklyAnalysis.completed')}: ${completedTasks.length} (${completedPercent}%)\n`;
    report += `${getText(lang, 'weeklyAnalysis.missed')}: ${missedTasks.length}\n\n`;

    if (mostAbandonedCategory) {
        const catName = getText(lang, `categories_list.${mostAbandonedCategory}`);
        report += `${getText(lang, 'weeklyAnalysis.most_abandoned')}: ${catName} (${Math.round(maxMissedPercent)}%)\n`;
    }

    if (bestHour) {
        report += `${getText(lang, 'weeklyAnalysis.best_time')}: ${bestHour}:00-${parseInt(bestHour) + 2}:00\n`;
    }

    if (lazyDay) {
        report += `${getText(lang, 'weeklyAnalysis.lazy_day')}: ${lazyDay}\n\n`;
    }

    report += `${getText(lang, 'weeklyAnalysis.advice')}:\n${randomAdvice}`;

    return report;
}

// Kechiktirish handleri
bot.action(/postpone_(\d+)_(.*)/, async (ctx) => {
    const taskIdx = parseInt(ctx.match[1]);
    const duration = ctx.match[2];

    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const lang = user.settings?.language || 'uz';
    const task = user.tasks[taskIdx];

    if (!task) return ctx.answerCbQuery(getText(lang, 'common.error'));

    let newTime;
    const currentTime = dayjs(task.plannedTime || task.datetime);

    if (duration === '10min') {
        newTime = currentTime.add(10, 'minutes');
    } else if (duration === '1hour') {
        newTime = currentTime.add(1, 'hour');
    } else if (duration === 'tomorrow') {
        newTime = dayjs().add(1, 'day').hour(9).minute(0);
    }

    task.plannedTime = newTime.format('YYYY-MM-DDTHH:mm');
    task.datetime = newTime.format('YYYY-MM-DDTHH:mm');
    task.status = 'postponed';
    task.postponeCount = (task.postponeCount || 0) + 1;
    task.lastPostponeTime = dayjs().format('YYYY-MM-DDTHH:mm');

    saveData(data);
    await ctx.answerCbQuery(getText(lang, 'noEscape.postponed', { time: newTime.format('HH:mm') }));
    await showMainMenu(ctx);
});

// Sabab yozish handleri
bot.action(/write_reason_(\d+)/, async (ctx) => {
    const taskIdx = parseInt(ctx.match[1]);
    const userId = ctx.from.id.toString();
    const data = loadData();
    const lang = data.users[userId]?.settings?.language || 'uz';

    ctx.session = { state: 'await_task_reason', taskIdx };
    await safeEdit(ctx, getText(lang, 'noEscape.reason_prompt'), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(getText(lang, 'buttons.back'), 'main_menu')]])
    });
});

// Cron job - har kuni soat 20:00 da
cron.schedule('0 20 * * *', async () => {
    const data = loadData();
    const today = dayjs().day(); // 0-6, yakshanba-shanba

    for (const [userId, user] of Object.entries(data.users)) {
        if (!user.settings?.weeklyAnalysis) continue;

        const analysisDay = user.settings.analysisDay || 0; // Default yakshanba
        if (analysisDay !== today) continue;

        const lastAnalysis = user.lastAnalysisDate;
        const daysSinceAnalysis = lastAnalysis ? dayjs().diff(dayjs(lastAnalysis), 'days') : 999;

        if (daysSinceAnalysis >= 7) {
            const report = analyzeWeeklyActivity(userId);
            if (report) {
                try {
                    await bot.telegram.sendMessage(userId, report, { parse_mode: 'HTML' });
                    user.lastAnalysisDate = dayjs().format('YYYY-MM-DD');
                    saveData(data);
                } catch (e) {
                    console.error(`Failed to send weekly analysis to ${userId}:`, e);
                }
            }
        }
    }
});

console.log('✅ Haftalik tahlil tizimi yoqildi!');

// Bot start
bot.launch().then(() => {
    console.log('🤖 Bot ishga tushdi!');
    if (!ADMIN_ID) {
        console.error('⚠️ XATO: ADMIN_ID .env faylida topilmadi!');
    } else {
        console.log('✅ Admin ID sozlandi');
    }
    if (!BOT_TOKEN) {
        console.error('⚠️ XATO: BOT_TOKEN .env faylida topilmadi!');
    } else {
        console.log('✅ Bot token sozlandi');
    }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
