const fs = require('fs');
const path = require('path');
const https = require('https');
const { Telegraf, Markup, session } = require('telegraf');
const dotenv = require('dotenv');
const cron = require('node-cron');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const express = require('express');

// Konfiguratsiya
dayjs.extend(customParseFormat);
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
    team_collaboration: { name: '🤝 Jamoa Hamkorligi', price: 500, desc: "Jamoa bilan vazifalarni baham ko'rish" },
    advanced_analytics: { name: '🔍 Kengaytirilgan Analitika', price: 350, desc: "Chuqur statistika va tahlillar" },
    voice_notes: { name: '🎤 Ovozli Eslatmalar', price: 150, desc: "Ovozli xabarlarni saqlash va eslatish" },
    integration_apps: { name: '🔗 Ilovalar Integratsiyasi', price: 400, desc: "Boshqa ilovalar bilan bog'lanish" }
};

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
bot.use(session());

// --- YORDAMCHI FUNKSIYALAR ---
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
    } catch (e) {}
}

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

    const level = getUserLevel(user.xp);
    const todayStr = dayjs().format('YYYY-MM-DD');
    const todayTasks = (user.tasks || []).filter(t => t.datetime.startsWith(todayStr));
    const pendingCount = todayTasks.filter(t => !t.done).length;
    
    const lastBonus = user.lastBonusDate || '';
    const bonusAvailable = lastBonus !== todayStr;

    let text = `👋 <b>Salom, ${user.name}!</b>\n\n`;
    text += `🔰 <b>Daraja:</b> ${level.name}\n`;
    text += `💎 <b>XP:</b> ${user.xp}\n`;
    text += `📅 <b>Bugungi vazifalar:</b> ${pendingCount} ta qoldi\n\n`;
    
    if (bonusAvailable) {
        text += `🎁 <i>Sizda kunlik bonus mavjud!</i>\n\n`;
    }

    const buttons = [
        [Markup.button.callback('➕ Vazifa qo\'shish', 'add_task')],
        [Markup.button.callback('📅 Bugun', 'view_today'), Markup.button.callback('📋 Barchasi', 'view_all')],
        bonusAvailable ? [Markup.button.callback('🎁 Kunlik Bonusni Olish (+50 XP)', 'get_daily_bonus')] : [],
        [Markup.button.callback('🛒 Do\'kon', 'view_shop'), Markup.button.callback('👤 Profil', 'view_profile')],
        [Markup.button.callback('⚙️ Sozlamalar', 'view_settings')]
    ];

    const unlocked = user.unlocked || [];
    if (unlocked.includes('habits')) buttons.splice(2, 0, [Markup.button.callback('🔄 Odatlar', 'view_habits')]);
    if (unlocked.includes('statistics')) buttons.splice(3, 0, [Markup.button.callback('📊 Statistika', 'view_statistics')]);
    if (unlocked.includes('priorities')) buttons.splice(1, 0, [Markup.button.callback('🚨 Prioritetlar', 'view_priorities')]);
    if (unlocked.includes('categories')) buttons.splice(1, 0, [Markup.button.callback('🏷 Kategoriyalar', 'view_categories')]);
    if (unlocked.includes('reminders')) buttons.splice(4, 0, [Markup.button.callback('🔔 Eslatmalar', 'view_reminders')]);
    if (unlocked.includes('goals')) buttons.push([Markup.button.callback('🎯 Maqsadlar', 'view_goals')]);
    if (unlocked.includes('pomodoro')) buttons.push([Markup.button.callback('⏱ Pomodoro', 'view_pomodoro')]);
    if (unlocked.includes('notes')) buttons.push([Markup.button.callback('📝 Eslatmalar', 'view_notes')]);
    if (unlocked.includes('calendar')) buttons.push([Markup.button.callback('🗓 Kalendar', 'view_calendar')]);
    if (unlocked.includes('custom_reminders')) buttons.push([Markup.button.callback('🛎 Shaxsiy Eslatmalar', 'view_custom_reminders')]);
    if (unlocked.includes('progress_reports')) buttons.push([Markup.button.callback('📈 Hisobotlar', 'view_progress_reports')]);
    if (unlocked.includes('achievements')) buttons.push([Markup.button.callback('🏆 Yutuqlar', 'view_achievements')]);
    if (unlocked.includes('social_sharing')) buttons.push([Markup.button.callback('📤 Ulashish', 'view_social_sharing')]);
    if (unlocked.includes('custom_themes')) buttons.push([Markup.button.callback('🎨 Temalar', 'view_custom_themes')]);
    if (unlocked.includes('ai_tips')) buttons.push([Markup.button.callback('🤖 AI Maslahatlar', 'view_ai_tips')]);
    if (unlocked.includes('team_collaboration')) buttons.push([Markup.button.callback('🤝 Jamoa Hamkorligi', 'view_team_collaboration')]);
    if (unlocked.includes('advanced_analytics')) buttons.push([Markup.button.callback('🔍 Kengaytirilgan Analitika', 'view_advanced_analytics')]);
    if (unlocked.includes('voice_notes')) buttons.push([Markup.button.callback('🎤 Ovozli Eslatmalar', 'view_voice_notes')]);
    if (unlocked.includes('integration_apps')) buttons.push([Markup.button.callback('🔗 Ilovalar Integratsiyasi', 'view_integration_apps')]);

    if (isAdmin(userId)) {
        buttons.push([Markup.button.callback('🛡️ Admin Panel', 'admin_panel')]);
    }

    const cleanButtons = buttons.filter(row => row.length > 0);

    if (ctx.callbackQuery) {
        await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(cleanButtons) });
    } else {
        await ctx.reply(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(cleanButtons) });
    }
}

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

    // Taklif linkini tekshirish
    const startPayload = ctx.startPayload || ctx.message?.text?.split(' ')[1];
    
    if (startPayload && startPayload.startsWith('team_')) {
        const inviteCode = startPayload;
        
        // Barcha foydalanuvchilardan jamoani topish
        let foundTeam = null;
        let teamOwner = null;
        let teamIdx = -1;
        
        for (const [uid, user] of Object.entries(data.users)) {
            if (user.teams) {
                const idx = user.teams.findIndex(t => t.inviteCode === inviteCode);
                if (idx !== -1) {
                    foundTeam = user.teams[idx];
                    teamOwner = uid;
                    teamIdx = idx;
                    break;
                }
            }
        }
        
        if (foundTeam) {
            // Foydalanuvchi ro'yxatdan o'tganmi tekshirish
            if (!data.users[userId]) {
                // Ro'yxatdan o'tish kerak
                ctx.session = { state: 'register', teamInviteCode: inviteCode };
                await ctx.reply(
                    `👋 <b>Xush kelibsiz!</b>\n\n` +
                    `Sizni <b>${foundTeam.name}</b> jamoasiga taklif qilishmoqda!\n\n` +
                    `Ro'yxatdan o'tish uchun ismingizni kiriting:`,
                    withProtectContentForCtx(ctx, { parse_mode: 'HTML' })
                );
                return;
            } else {
                // Foydalanuvchi allaqachon ro'yxatdan o'tgan
                const user = data.users[userId];
                
                // Agar foydalanuvchi jamoa a'zosi bo'lmasa, qo'shish
                if (!foundTeam.members.includes(userId)) {
                    foundTeam.members.push(userId);
                    
                    // Foydalanuvchining teams ro'yxatiga ham qo'shish
                    if (!user.teams) user.teams = [];
                    user.teams.push(foundTeam);
                    
                    saveData(data);
                    
                    await ctx.reply(
                        `✅ <b>Jamoa a'zosi bo'ldingiz!</b>\n\n` +
                        `Jamoa: <b>${foundTeam.name}</b>\n` +
                        `A'zolar: ${foundTeam.members.length} ta`,
                        withProtectContentForCtx(ctx, {
                            parse_mode: 'HTML',
                            ...Markup.inlineKeyboard([
                                [Markup.button.callback('🤝 Jamoani ko\'rish', 'view_team_collaboration')],
                                [Markup.button.callback('🔙 Bosh menyu', 'main_menu')]
                            ])
                        })
                    );
                    
                    // Jamoa egasiga xabar yuborish
                    if (teamOwner && teamOwner !== userId) {
                        try {
                            await bot.telegram.sendMessage(
                                teamOwner,
                                `🎉 <b>Yangi a'zo qo'shildi!</b>\n\n` +
                                `${user.name} <b>${foundTeam.name}</b> jamoasiga qo'shildi!`,
                                { parse_mode: 'HTML' }
                            );
                        } catch (e) {}
                    }
                    return;
                } else {
                    await ctx.reply(
                        `ℹ️ Siz allaqachon <b>${foundTeam.name}</b> jamoasining a'zosisiz!`,
                        withProtectContentForCtx(ctx, {
                            parse_mode: 'HTML',
                            ...Markup.inlineKeyboard([
                                [Markup.button.callback('🤝 Jamoani ko\'rish', 'view_team_collaboration')],
                                [Markup.button.callback('🔙 Bosh menyu', 'main_menu')]
                            ])
                        })
                    );
                    return;
                }
            }
        } else {
            await ctx.reply("❌ Taklif linki noto'g'ri yoki muddati o'tgan.", withProtectContentForCtx(ctx));
        }
    }

    if (!data.users[userId]) {
        ctx.session = { state: 'register' };
        await ctx.reply("👋 <b>Xush kelibsiz!</b>\n\nIsmingizni kiriting:", withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
    } else {
        if (!data.users[userId].settings) data.users[userId].settings = { notifications: true, language: 'uz' };
        saveData(data);
        await showMainMenu(ctx);
    }
});

// --- PROFIL ---
bot.action('view_profile', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId] || {};
    const level = getUserLevel(user.xp || 0);
    const unlocked = user.unlocked || [];

    let text = `👤 <b>Profil</b>\n\n`;
    text += `Ism: ${user.name || 'Noma\'lum'}\n`;
    text += `Daraja: ${level.name}\n`;
    text += `XP: ${user.xp || 0}\n`;
    text += `Qo\'shilgan: ${dayjs(user.joinedAt).format('DD.MM.YYYY') || 'Noma\'lum'}\n\n`;
    text += `🔓 Ochilgan funksiyalar:\n${unlocked.map(k => `- ${SHOP_ITEMS[k]?.name || k}`).join('\n') || 'Yo\'q'}`;

    await safeEdit(ctx, text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'main_menu')]])
    });
});

// --- SOZLAMALAR ---
bot.action('view_settings', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.settings) {
        user.settings = { notifications: true, language: 'uz' };
        saveData(data);
    }

    let text = `⚙️ <b>Sozlamalar</b>\n\n`;
    text += `Bildirishnomalar: ${user.settings.notifications ? 'Yoqilgan' : 'O\'chirilgan'}\n`;
    text += `Til: ${(user.settings.language || 'uz').toUpperCase()}`;

    const buttons = [
        [Markup.button.callback('🔔 Bildirishnomalarni Yoqish/O\'chirish', 'toggle_notifications')],
        [Markup.button.callback('🌐 Tilni O\'zgartirish', 'change_language')],
        [Markup.button.callback('🔙 Orqaga', 'main_menu')]
    ];

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('toggle_notifications', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    user.settings.notifications = !user.settings.notifications;
    saveData(data);
    await ctx.answerCbQuery(`Bildirishnomalar ${user.settings.notifications ? 'yoqildi' : 'o\'chirildi'}`);
    await bot.action('view_settings', ctx);
});

bot.action('change_language', async (ctx) => {
    ctx.session = { state: 'await_language' };
    await safeEdit(ctx, "🌐 Tilni tanlang (uz/en/ru):", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Bekor qilish', 'view_settings')]])
    });
});

// --- VAZIFA QO'SHISH ---
bot.action('add_task', async (ctx) => {
    ctx.session = { state: 'await_task_desc' };
    await safeEdit(ctx, "📝 <b>Vazifa nomini yozing:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Bekor qilish', 'main_menu')]])
    });
});

// --- KUNLIK BONUS ---
bot.action('get_daily_bonus', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const today = dayjs().format('YYYY-MM-DD');

    if (data.users[userId].lastBonusDate !== today) {
        data.users[userId].lastBonusDate = today;
        data.users[userId].xp += DAILY_BONUS_XP;
        saveData(data);
        await ctx.answerCbQuery(`🎉 +${DAILY_BONUS_XP} XP!`);
        await showMainMenu(ctx);
    } else {
        await ctx.answerCbQuery("⚠️ Bugungi bonus olindi.");
    }
});

// --- VAZIFALAR KO'RISH ---
async function viewTasks(ctx, filter = 'all', page = 0) {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const tasks = user.tasks || [];
    
    let filteredTasks = [];
    let title = "";
    const today = dayjs().format('YYYY-MM-DD');

    if (filter === 'today') {
        filteredTasks = tasks.filter(t => t.datetime.startsWith(today));
        title = "📅 Bugungi vazifalar";
    } else {
        filteredTasks = tasks;
        title = "📋 Barcha vazifalar";
    }

    if (filteredTasks.length === 0) {
        return safeEdit(ctx, `${title}\n\n📭 Vazifalar yo'q.`, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Bosh menyu', 'main_menu')]])
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
                Markup.button.callback(`✅ Bajarish`, `do_${realIndex}`),
                Markup.button.callback(`❌ O'chirish`, `del_${realIndex}`)
            ]);
        } else {
            buttons.push([Markup.button.callback(`🗑 O'chirish`, `del_${realIndex}`)]);
        }
    });

    const navRow = [];
    if (page > 0) navRow.push(Markup.button.callback('⬅️', `list_${filter}_${page - 1}`));
    if (page < totalPages - 1) navRow.push(Markup.button.callback('➡️', `list_${filter}_${page + 1}`));
    
    if (navRow.length > 0) buttons.push(navRow);
    buttons.push([Markup.button.callback('🔙 Bosh menyu', 'main_menu')]);

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
}

// --- DO'KON ---
bot.action('view_shop', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const unlocked = user.unlocked || [];

    let text = `🛒 <b>Do'kon</b>\n💎 XP: <b>${user.xp}</b>\n\n`;
    const buttons = [];

    text += '<b>Ochilmagan funksiyalar:</b>\n\n';
    for (const [key, item] of Object.entries(SHOP_ITEMS)) {
        if (!unlocked.includes(key)) {
            text += `🔹 <b>${item.name}</b>\n💰 ${item.price} XP | ${item.desc}\n\n`;
            buttons.push([Markup.button.callback(`🔓 Sotib olish: ${item.name} (${item.price} XP)`, `buy_${key}`)]);
        }
    }

    text += '<b>Ochilgan funksiyalar:</b>\n\n';
    for (const [key, item] of Object.entries(SHOP_ITEMS)) {
        if (unlocked.includes(key)) {
            text += `✅ <b>${item.name}</b> - ${item.desc}\n\n`;
            buttons.push([Markup.button.callback(`✅ ${item.name} (Sotib olingan)`, 'noop')]);
        }
    }

    buttons.push([Markup.button.callback('🔙 Orqaga', 'main_menu')]);
    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

// --- ODATLAR TREKERI ---
bot.action('view_habits', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.unlocked.includes('habits')) return ctx.answerCbQuery("⚠️ Premium!");

    if (!user.habits) user.habits = [];

    let text = `🔄 <b>Odatlar</b>\n\n`;
    const buttons = [];

    user.habits.forEach((habit, idx) => {
        const status = habit.doneToday ? '✅' : '🔴';
        text += `${status} ${habit.name} (Streak: ${habit.streak || 0})\n`;
        if (!habit.doneToday) {
            buttons.push([Markup.button.callback(`✅ Bajarildi`, `habit_do_${idx}`)]);
        }
    });

    buttons.push([Markup.button.callback('➕ Yangi odat qo\'shish', 'add_habit')]);
    buttons.push([Markup.button.callback('🔙 Orqaga', 'main_menu')]);

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('add_habit', async (ctx) => {
    ctx.session = { state: 'await_habit_name' };
    await safeEdit(ctx, "🔄 <b>Odat nomini kiriting:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'view_habits')]])
    });
});

// --- PRO STATISTIKA ---
bot.action('view_statistics', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.unlocked.includes('statistics')) return ctx.answerCbQuery("⚠️ Premium!");

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
    const dailyGraph = 'Kunlik: ' + '█'.repeat(dailyDone) + '░'.repeat(10 - dailyDone);
    const weeklyGraph = 'Haftalik: ' + '█'.repeat(weeklyDone / 7) + '░'.repeat(10 - weeklyDone / 7);
    const monthlyGraph = 'Oylik: ' + '█'.repeat(monthlyDone / 30) + '░'.repeat(10 - monthlyDone / 30);

    let text = `📊 <b>Pro Statistika</b>\n\n`;
    text += `Bajarilgan vazifalar: ${doneTasks} / ${totalTasks}\n`;
    text += `Kunlik grafik: ${dailyGraph}\n`;
    text += `Haftalik grafik: ${weeklyGraph}\n`;
    text += `Oylik grafik: ${monthlyGraph}\n`;
    text += `Eng faol kun: ${mostActiveDay || 'Yo\'q'}\n`;
    text += `Eng faol vaqt: ${mostActiveTime || 'Yo\'q'} soat\n`;

    await safeEdit(ctx, text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'main_menu')]])
    });
});

// --- PRIORITETLAR ---
bot.action('view_priorities', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.unlocked.includes('priorities')) return ctx.answerCbQuery("⚠️ Premium!");

    // Vazifalarga prioritet qo'shish logikasi
    if (!user.tasks.every(t => t.hasOwnProperty('priority'))) {
        user.tasks.forEach(t => t.priority = t.priority || 'normal');
        saveData(data);
    }

    let text = `🚨 <b>Prioritetlar</b>\n\n`;
    const highPriorityTasks = user.tasks.filter(t => t.priority === 'high' && !t.done);
    const normalPriorityTasks = user.tasks.filter(t => t.priority === 'normal' && !t.done);
    text += `Yuqori prioritet vazifalar:\n${highPriorityTasks.map(t => `- ${t.desc}`).join('\n') || 'Yo\'q'}\n\n`;
    text += `Normal prioritet vazifalar:\n${normalPriorityTasks.map(t => `- ${t.desc}`).join('\n') || 'Yo\'q'}\n\n`;
    text += `Vazifani muhim qilish uchun vazifa qo'shishda "muhim" deb belgilang. Muhim vazifalar ro'yxat boshida.`;

    const buttons = [[Markup.button.callback('🔙', 'main_menu')]];

    await safeEdit(ctx, text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons)
    });
});

// --- KATEGORIYALAR ---
bot.action('view_categories', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.unlocked.includes('categories')) return ctx.answerCbQuery("⚠️ Premium!");

    if (!user.categories) user.categories = [];

    let text = `🏷 <b>Kategoriyalar</b>\n\n`;
    user.categories.forEach(cat => {
        const tasksInCat = user.tasks.filter(t => t.category === cat);
        text += `- ${cat} (${tasksInCat.length} vazifa)\n`;
    });

    const buttons = [
        [Markup.button.callback('➕ Kategoriya qo\'shish', 'add_category')],
        [Markup.button.callback('🔍 Filtrlash', 'filter_categories')],
        [Markup.button.callback('🔙', 'main_menu')]
    ];

    await safeEdit(ctx, text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons)
    });
});

bot.action('add_category', async (ctx) => {
    ctx.session = { state: 'await_category_name' };
    await safeEdit(ctx, "🏷 <b>Kategoriya nomini kiriting:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'view_categories')]])
    });
});

bot.action('filter_categories', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const buttons = user.categories.map(cat => [Markup.button.callback(cat, `filter_cat_${cat}`)]);
    buttons.push([Markup.button.callback('🔙', 'view_categories')]);
    await safeEdit(ctx, "🏷 <b>Kategoriyani tanlang:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons)
    });
});

bot.action(/filter_cat_(.*)/, async (ctx) => {
    const category = ctx.match[1];
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const filteredTasks = user.tasks.filter(t => t.category === category);
    let text = `🏷 <b>${category} kategoriyasi vazifalari:</b>\n\n`;
    filteredTasks.forEach(t => {
        text += `${t.done ? '✅' : '⏳'} ${t.desc}\n`;
    });
    await safeEdit(ctx, text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'view_categories')]])
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
bot.action('view_goals', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.unlocked.includes('goals')) return ctx.answerCbQuery("⚠️ Premium!");

    if (!user.goals) user.goals = [];

    let text = `🎯 <b>Maqsadlar</b>\n\n`;
    const buttons = [];

    user.goals.forEach((goal, idx) => {
        const subTasks = goal.subTasks || [];
        const doneSubTasks = subTasks.filter(st => st.done).length;
        const progress = subTasks.length > 0 ? Math.round((doneSubTasks / subTasks.length) * 100) : 0;
        text += `${goal.name} - Progress: ${progress}%\n`;
        buttons.push([Markup.button.callback(`📈 Yangilash: ${goal.name}`, `update_goal_${idx}`)]);
    });

    buttons.push([Markup.button.callback('➕ Uzoq muddatli maqsad qo\'shish', 'add_goal')]);
    buttons.push([Markup.button.callback('🔙', 'main_menu')]);

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('add_goal', async (ctx) => {
    ctx.session = { state: 'await_goal_name' };
    await safeEdit(ctx, "🎯 <b>Maqsad nomini kiriting:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'view_goals')]])
    });
});

bot.action(/update_goal_(\d+)/, async (ctx) => {
    const idx = parseInt(ctx.match[1]);
    const userId = ctx.from.id.toString();
    const data = loadData();
    const goal = data.users[userId].goals[idx];
    let text = `🎯 <b>${goal.name}</b> - Kichik vazifalar:\n\n`;
    goal.subTasks.forEach((st, stIdx) => {
        text += `${st.done ? '✅' : '⏳'} ${st.desc} [do_sub_${idx}_${stIdx}]\n`;
    });
    const buttons = goal.subTasks.map((st, stIdx) => [Markup.button.callback(`${st.done ? '✅' : '⏳'} ${st.desc}`, `do_sub_${idx}_${stIdx}`)]);
    buttons.push([Markup.button.callback('➕ Kichik vazifa qo\'shish', `add_sub_${idx}`)]);
    buttons.push([Markup.button.callback('🔙', 'view_goals')]);
    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action(/do_sub_(\d+)_(\d+)/, async (ctx) => {
    const goalIdx = parseInt(ctx.match[1]);
    const subIdx = parseInt(ctx.match[2]);
    const userId = ctx.from.id.toString();
    const data = loadData();
    const goal = data.users[userId].goals[goalIdx];
    goal.subTasks[subIdx].done = !goal.subTasks[subIdx].done;
    saveData(data);
    await ctx.answerCbQuery('✅ Yangilandi');
    await bot.action(`update_goal_${goalIdx}`, ctx);
});

bot.action(/add_sub_(\d+)/, async (ctx) => {
    const idx = parseInt(ctx.match[1]);
    ctx.session = { state: 'await_sub_task', goalIdx: idx };
    await safeEdit(ctx, "🎯 <b>Kichik vazifa nomini kiriting:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', `update_goal_${idx}`)]])
    });
});

// --- POMODORO TAYMER ---
bot.action('view_pomodoro', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.unlocked.includes('pomodoro')) return ctx.answerCbQuery("⚠️ Premium!");

    if (!user.pomodoro) user.pomodoro = { cycles: 0, active: false };

    let text = `⏱ <b>Pomodoro Taymer</b>\n\n`;
    text += `25 daqiqa ish, 5 daqiqa dam olish.\n`;
    text += `Joriy sikllar: ${user.pomodoro.cycles}\n`;

    const buttons = [
        [Markup.button.callback('▶️ Pomodoro boshlash', 'start_pomodoro')],
        [Markup.button.callback('🔙', 'main_menu')]
    ];

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('start_pomodoro', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    if (user.pomodoro.active) return ctx.answerCbQuery('⚠️ Allaqachon ishlamoqda!');
    user.pomodoro.active = true;
    saveData(data);
    await ctx.answerCbQuery('⏱ Pomodoro boshlandi! 25 daqiqa ishlaymiz.');
    setTimeout(async () => {
        user.pomodoro.active = false;
        user.pomodoro.cycles += 1;
        saveData(data);
        await ctx.reply('⏱ Pomodoro tugadi! 5 daqiqa dam oling. Sikl: ' + user.pomodoro.cycles);
    }, 25 * 60 * 1000);
});

// --- ESLATMALAR ---
bot.action('view_notes', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.unlocked.includes('notes')) return ctx.answerCbQuery("⚠️ Premium!");

    if (!user.notes) user.notes = [];

    let text = `📝 <b>Eslatmalar</b>\n\n`;
    const buttons = [];
    
    if (user.notes.length === 0) {
        text += `📭 Hozircha eslatmalar yo'q.\n`;
    } else {
        user.notes.forEach((note, idx) => {
            text += `${idx + 1}. ${note.text}\n`;
            buttons.push([
                Markup.button.callback(`✏️ Tahrirlash`, `edit_note_${idx}`),
                Markup.button.callback(`🗑 O'chirish`, `del_note_${idx}`)
            ]);
        });
    }

    buttons.push([Markup.button.callback('➕ Eslatma yozish', 'add_note')]);
    buttons.push([Markup.button.callback('🔙', 'main_menu')]);

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('add_note', async (ctx) => {
    ctx.session = { state: 'await_note_text' };
    await safeEdit(ctx, "📝 <b>Eslatma matnini kiriting:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'view_notes')]])
    });
});

// Eslatmani tahrirlash uchun qo'shimcha
bot.action(/edit_note_(\d+)/, async (ctx) => {
    const idx = parseInt(ctx.match[1]);
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    
    if (!user.unlocked.includes('notes')) return ctx.answerCbQuery("⚠️ Premium!");
    if (!user.notes[idx]) return ctx.answerCbQuery("❌ Eslatma topilmadi!");
    
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
    
    if (!user.unlocked.includes('notes')) return ctx.answerCbQuery("⚠️ Premium!");
    if (!user.notes[idx]) return ctx.answerCbQuery("❌ Eslatma topilmadi!");
    
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

    if (!user.unlocked.includes('custom_reminders')) return ctx.answerCbQuery("⚠️ Premium!");

    if (!user.custom_reminders) user.custom_reminders = [];

    let text = `🛎 <b>Shaxsiy Eslatmalar</b>\n\n`;
    user.custom_reminders.forEach((rem, idx) => {
        text += `${rem.desc} - ${rem.time} (${rem.customText})\n`;
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
    text += `Yutuq: ${user.achievements.length}\n`;
    text += `Statistika: ${user.tasks.filter(t => t.done).length} vazifa\n\n`;
    text += `Ulashish uchun matn tayyor.`;

    const buttons = [
        [Markup.button.callback('📤 Natijani ulashish', 'share_result')],
        [Markup.button.url('Botni Ulashish', 'https://t.me/share/url?url=t.me/yourbot&text=Salom%20do%27stim%2C%20mana%20ajoyib%20bot!')],
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

    let text = `🎨 <b>Shaxsiy Temalar</b>\n\nTanlangan tema: ${user.settings.theme || 'Default'}`;

    const buttons = [
        [Markup.button.callback('Qora Tema', 'set_theme_dark')],
        [Markup.button.callback('Oq Tema', 'set_theme_light')],
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

// --- JAMOA HAMKORLIGI ---
bot.action('view_team_collaboration', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];

    if (!user.unlocked.includes('team_collaboration')) return ctx.answerCbQuery("⚠️ Premium!");

    if (!user.teams) user.teams = [];

    let text = `🤝 <b>Jamoa Hamkorligi</b>\n\n`;
    const buttons = [];
    
    if (user.teams.length === 0) {
        text += `📭 Hozircha jamoalar yo'q.\n`;
        text += `Jamoa yaratib, do'stlaringizni taklif qiling!\n`;
    } else {
        user.teams.forEach((team, idx) => {
            const sharedTasks = team.sharedTasks || [];
            const doneTasks = sharedTasks.filter(t => t.done).length;
            text += `${idx + 1}. <b>${team.name}</b>\n`;
            text += `   👥 A'zolar: ${team.members.length}\n`;
            text += `   📋 Vazifalar: ${doneTasks}/${sharedTasks.length}\n\n`;
            buttons.push([
                Markup.button.callback(`📋 ${team.name}`, `team_view_${idx}`),
                Markup.button.callback(`👥 A'zolar`, `team_members_${idx}`)
            ]);
            buttons.push([
                Markup.button.callback(`🔗 Taklif qilish`, `team_invite_${idx}`),
                Markup.button.callback(`➕ Vazifa`, `team_add_task_${idx}`)
            ]);
        });
    }

    buttons.push([Markup.button.callback('➕ Jamoa yaratish', 'create_team')]);
    buttons.push([Markup.button.callback('🔙', 'main_menu')]);

    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('create_team', async (ctx) => {
    ctx.session = { state: 'await_team_name' };
    await safeEdit(ctx, "🤝 <b>Jamoa nomini kiriting:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'view_team_collaboration')]])
    });
});

bot.action(/team_view_(\d+)/, async (ctx) => {
    const idx = parseInt(ctx.match[1]);
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const team = user.teams[idx];
    
    if (!team) return ctx.answerCbQuery("❌ Jamoa topilmadi!");
    
    const sharedTasks = team.sharedTasks || [];
    const doneTasks = sharedTasks.filter(t => t.done).length;
    let text = `🤝 <b>${team.name}</b>\n\n`;
    text += `👥 A'zolar: ${team.members.length}\n`;
    text += `📋 Vazifalar: ${doneTasks}/${sharedTasks.length} bajarilgan\n\n`;
    
    if (sharedTasks.length === 0) {
        text += `📭 Vazifalar yo'q.\n`;
    } else {
        text += `<b>Vazifalar:</b>\n`;
        sharedTasks.forEach((task, tIdx) => {
            const creator = data.users[task.createdBy]?.name || 'Noma\'lum';
            const doneBy = task.doneBy ? (data.users[task.doneBy]?.name || 'Noma\'lum') : '';
            const doneAt = task.doneAt ? dayjs(task.doneAt).format('DD.MM HH:mm') : '';
            text += `${tIdx + 1}. <b>${task.desc}</b>\n`;
            text += `   ${task.done ? '✅' : '⏳'} ${task.done ? `Bajarildi ${doneBy ? `(${doneBy})` : ''} ${doneAt ? `- ${doneAt}` : ''}` : 'Kutilmoqda'}\n`;
            text += `   👤 Yaratuvchi: ${creator}\n\n`;
        });
    }
    
    const buttons = [];
    
    // Vazifalar uchun tugmalar
    if (sharedTasks.length > 0) {
        sharedTasks.forEach((task, tIdx) => {
            const row = [];
            if (!task.done) {
                row.push(Markup.button.callback(`✅ ${task.desc.substring(0, 15)}${task.desc.length > 15 ? '...' : ''}`, `team_task_done_${idx}_${tIdx}`));
            } else {
                row.push(Markup.button.callback(`⏳ ${task.desc.substring(0, 15)}${task.desc.length > 15 ? '...' : ''}`, `team_task_done_${idx}_${tIdx}`));
            }
            if (task.createdBy === userId || team.ownerId === userId) {
                row.push(Markup.button.callback('🗑', `team_task_del_${idx}_${tIdx}`));
            }
            if (row.length > 0) buttons.push(row);
        });
    }
    
    buttons.push([Markup.button.callback('➕ Vazifa qo\'shish', `team_add_task_${idx}`)]);
    buttons.push([
        Markup.button.callback('👥 A\'zolar', `team_members_${idx}`),
        Markup.button.callback('🔗 Taklif', `team_invite_${idx}`)
    ]);
    buttons.push([Markup.button.callback('🔙', 'view_team_collaboration')]);
    
    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

// Jamoa a'zolarini ko'rish
bot.action(/team_members_(\d+)/, async (ctx) => {
    const idx = parseInt(ctx.match[1]);
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const team = user.teams[idx];
    
    if (!team) return ctx.answerCbQuery("❌ Jamoa topilmadi!");
    
    let text = `👥 <b>${team.name} - A'zolar</b>\n\n`;
    
    if (team.members.length === 0) {
        text += `📭 A'zolar yo'q.\n`;
    } else {
        team.members.forEach((memberId, mIdx) => {
            const member = data.users[memberId];
            if (member) {
                const isOwner = memberId === team.ownerId || (team.members[0] === memberId && !team.ownerId);
                const memberTasks = (team.sharedTasks || []).filter(t => t.createdBy === memberId).length;
                const memberDoneTasks = (team.sharedTasks || []).filter(t => t.doneBy === memberId).length;
                text += `${mIdx + 1}. ${member.name} ${isOwner ? '👑 (Egasi)' : ''}\n`;
                text += `   💎 XP: ${member.xp || 0}\n`;
                text += `   📋 Yaratgan: ${memberTasks} | Bajargan: ${memberDoneTasks}\n\n`;
            } else {
                text += `${mIdx + 1}. Noma'lum foydalanuvchi (${memberId})\n\n`;
            }
        });
    }
    
    const buttons = [
        [Markup.button.callback('🔗 Taklif qilish', `team_invite_${idx}`)],
        [Markup.button.callback('🔙', `team_view_${idx}`)]
    ];
    
    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

// Taklif linki yaratish
bot.action(/team_invite_(\d+)/, async (ctx) => {
    const idx = parseInt(ctx.match[1]);
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const team = user.teams[idx];
    
    if (!team) return ctx.answerCbQuery("❌ Jamoa topilmadi!");
    
    // Unikal taklif linki yaratish
    if (!team.inviteCode) {
        team.inviteCode = `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        saveData(data);
    }
    
    // Bot username ni olish
    let botUsername = '';
    try {
        const botInfo = await ctx.telegram.getMe();
        botUsername = botInfo.username;
    } catch (e) {
        botUsername = ctx.botInfo?.username || '';
    }
    
    const inviteLink = `https://t.me/${botUsername}?start=team_${team.inviteCode}`;
    
    let text = `🔗 <b>Taklif Linki</b>\n\n`;
    text += `Jamoa: <b>${team.name}</b>\n\n`;
    text += `Do'stlaringizni taklif qilish uchun quyidagi linkni yuboring:\n\n`;
    text += `<code>${inviteLink}</code>\n\n`;
    text += `Yoki quyidagi tugmani bosing va do'stingizga yuboring:`;
    
    const buttons = [
        [Markup.button.url('📤 Do\'stga yuborish', `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(`Men sizni "${team.name}" jamoasiga taklif qilmoqchiman!`)}`)],
        [Markup.button.callback('📋 Linkni ko\'chirish', `team_copy_link_${idx}`)],
        [Markup.button.callback('🔄 Yangi link', `team_new_link_${idx}`)],
        [Markup.button.callback('🔙', `team_view_${idx}`)]
    ];
    
    await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

// Yangi link yaratish
bot.action(/team_new_link_(\d+)/, async (ctx) => {
    const idx = parseInt(ctx.match[1]);
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const team = user.teams[idx];
    
    if (!team) return ctx.answerCbQuery("❌ Jamoa topilmadi!");
    
    team.inviteCode = `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    saveData(data);
    
    await ctx.answerCbQuery('✅ Yangi link yaratildi!');
    await bot.action(`team_invite_${idx}`, ctx);
});

// Linkni ko'chirish
bot.action(/team_copy_link_(\d+)/, async (ctx) => {
    const idx = parseInt(ctx.match[1]);
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const team = user.teams[idx];
    
    if (!team || !team.inviteCode) return ctx.answerCbQuery("❌ Link topilmadi!");
    
    // Bot username ni olish
    let botUsername = '';
    try {
        const botInfo = await ctx.telegram.getMe();
        botUsername = botInfo.username;
    } catch (e) {
        botUsername = ctx.botInfo?.username || '';
    }
    const inviteLink = `https://t.me/${botUsername}?start=team_${team.inviteCode}`;
    await ctx.answerCbQuery('📋 Link ko\'chirildi! Endi yuborishingiz mumkin.');
    await ctx.reply(`🔗 Taklif linki:\n\n<code>${inviteLink}</code>`, { parse_mode: 'HTML' });
});

bot.action(/team_add_task_(\d+)/, async (ctx) => {
    const idx = parseInt(ctx.match[1]);
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const team = user.teams[idx];
    
    if (!team) return ctx.answerCbQuery("❌ Jamoa topilmadi!");
    
    // Faqat jamoa a'zolari vazifa qo'sha oladi
    if (!team.members.includes(userId)) {
        return ctx.answerCbQuery("❌ Siz jamoa a'zosi emassiz!");
    }
    
    ctx.session = { state: 'await_team_task', teamIdx: idx };
    await safeEdit(ctx, "📋 <b>Jamoa vazifasi nomini kiriting:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙', `team_view_${idx}`)]])
    });
});

// Jamoa vazifasini bajarish
bot.action(/team_task_done_(\d+)_(\d+)/, async (ctx) => {
    const teamIdx = parseInt(ctx.match[1]);
    const taskIdx = parseInt(ctx.match[2]);
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const team = user.teams[teamIdx];
    
    if (!team || !team.sharedTasks[taskIdx]) return ctx.answerCbQuery("❌ Topilmadi!");
    
    const task = team.sharedTasks[taskIdx];
    
    if (task.done) {
        task.done = false;
        task.doneBy = null;
        await ctx.answerCbQuery('⏳ Vazifa qayta ochildi');
    } else {
        task.done = true;
        task.doneBy = userId;
        task.doneAt = new Date().toISOString();
        await ctx.answerCbQuery('✅ Vazifa bajarildi!');
        
        // Barcha jamoa a'zolariga xabar yuborish
        team.members.forEach(memberId => {
            if (memberId !== userId) {
                try {
                    bot.telegram.sendMessage(
                        memberId,
                        `✅ <b>Jamoa vazifasi bajarildi!</b>\n\n` +
                        `Vazifa: ${task.desc}\n` +
                        `Bajaruvchi: ${user.name}`,
                        { parse_mode: 'HTML' }
                    ).catch(() => {});
                } catch (e) {}
            }
        });
    }
    
    saveData(data);
    await bot.action(`team_view_${teamIdx}`, ctx);
});

// Jamoa vazifasini o'chirish
bot.action(/team_task_del_(\d+)_(\d+)/, async (ctx) => {
    const teamIdx = parseInt(ctx.match[1]);
    const taskIdx = parseInt(ctx.match[2]);
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const team = user.teams[teamIdx];
    
    if (!team || !team.sharedTasks[taskIdx]) return ctx.answerCbQuery("❌ Topilmadi!");
    
    const task = team.sharedTasks[taskIdx];
    
    // Faqat vazifa yaratuvchisi yoki jamoa egasi o'chira oladi
    if (task.createdBy !== userId && team.ownerId !== userId) {
        return ctx.answerCbQuery("❌ Sizda ruxsat yo'q!");
    }
    
    team.sharedTasks.splice(taskIdx, 1);
    saveData(data);
    await ctx.answerCbQuery('🗑 Vazifa o\'chirildi');
    await bot.action(`team_view_${teamIdx}`, ctx);
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

    if (!user.unlocked.includes('integration_apps')) return ctx.answerCbQuery("⚠️ Premium!");

    if (!user.integrations) user.integrations = [];

    let text = `🔗 <b>Ilovalar Integratsiyasi</b>\n\n`;
    const buttons = [];
    
    if (!user.integrations || user.integrations.length === 0) {
        text += `📭 Hozircha ulangan ilovalar yo'q.\n\n`;
        text += `Mavjud integratsiyalar:\n`;
        text += `• Google Calendar\n`;
        text += `• Notion\n`;
        text += `• Trello\n`;
        text += `• Todoist\n`;
    } else {
        text += `✅ <b>Ulangan ilovalar:</b>\n`;
        user.integrations.forEach((app, idx) => {
            text += `${idx + 1}. ${app}\n`;
            buttons.push([Markup.button.callback(`🔌 ${app} ni o'chirish`, `remove_integration_${idx}`)]);
        });
        text += `\nMa'lumotlar avtomatik sinxronlanadi.`;
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
    ctx.session = { state: 'await_voice_note_text' };
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
    if (data.users[userId].tasks[index]) {
        data.users[userId].tasks.splice(index, 1);
        saveData(data);
        await ctx.answerCbQuery('🗑 O\'chirildi');
        viewTasks(ctx, 'all');
    }
});

bot.action(/buy_(.*)/, async (ctx) => {
    const key = ctx.match[1];
    const userId = ctx.from.id.toString();
    const data = loadData();
    const user = data.users[userId];
    const item = SHOP_ITEMS[key];

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

// Vazifa qo'shishda prioritet va kategoriya tanlash
bot.action('task_priority_high', async (ctx) => {
    ctx.session.temp_task_priority = 'high';
    ctx.session.state = 'await_task_time';
    await ctx.answerCbQuery('🚨 Yuqori prioritet tanlandi');
    await ctx.reply(`🕒 <b>"${ctx.session.temp_task_desc}"</b> qachon? Format: 14:00 yoki 05.20 09:00`, withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
});

bot.action('task_priority_normal', async (ctx) => {
    ctx.session.temp_task_priority = 'normal';
    ctx.session.state = 'await_task_time';
    await ctx.answerCbQuery('⚪ Normal prioritet tanlandi');
    await ctx.reply(`🕒 <b>"${ctx.session.temp_task_desc}"</b> qachon? Format: 14:00 yoki 05.20 09:00`, withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
});

bot.action(/task_category_(.*)/, async (ctx) => {
    const category = ctx.match[1];
    ctx.session.temp_task_category = category;
    ctx.session.state = 'await_task_time';
    await ctx.answerCbQuery(`🏷 Kategoriya: ${category}`);
    await ctx.reply(`🕒 <b>"${ctx.session.temp_task_desc}"</b> qachon? Format: 14:00 yoki 05.20 09:00`, withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
});

bot.action('task_new_category', async (ctx) => {
    ctx.session.state = 'await_task_category_name';
    await ctx.answerCbQuery();
    await ctx.reply("🏷 <b>Yangi kategoriya nomini kiriting:</b>", withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
});

bot.action('task_skip_options', async (ctx) => {
    ctx.session.state = 'await_task_time';
    await ctx.answerCbQuery('⏭ O\'tkazib yuborildi');
    await ctx.reply(`🕒 <b>"${ctx.session.temp_task_desc}"</b> qachon? Format: 14:00 yoki 05.20 09:00`, withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
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
        const user = data.users[userId];
        const unlocked = user.unlocked || [];
        
        // Agar prioritetlar yoki kategoriyalar ochilgan bo'lsa, ularni so'rash
        if (unlocked.includes('priorities') || unlocked.includes('categories')) {
            const buttons = [];
            if (unlocked.includes('priorities')) {
                buttons.push([Markup.button.callback('🚨 Yuqori prioritet', 'task_priority_high'), Markup.button.callback('⚪ Normal prioritet', 'task_priority_normal')]);
            }
            if (unlocked.includes('categories') && user.categories && user.categories.length > 0) {
                user.categories.forEach(cat => {
                    buttons.push([Markup.button.callback(`🏷 ${cat}`, `task_category_${cat}`)]);
                });
                buttons.push([Markup.button.callback('➕ Yangi kategoriya', 'task_new_category')]);
            }
            buttons.push([Markup.button.callback('⏭ O\'tkazib yuborish', 'task_skip_options')]);
            ctx.session.state = 'await_task_options';
            await safeEdit(ctx, `🕒 <b>"${text}"</b> uchun prioritet yoki kategoriya tanlang:`, { 
                parse_mode: 'HTML', 
                ...Markup.inlineKeyboard(buttons) 
            });
            return;
        }
        
        ctx.session.state = 'await_task_time';
        const msg = await ctx.reply(`🕒 <b>"${text}"</b> qachon? Format: 14:00 yoki 05.20 09:00`, withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
        ctx.session.last_msg_id = msg.message_id;
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

        if (ctx.session.last_msg_id) ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.last_msg_id).catch(()=>{});

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
            priority: ctx.session.temp_task_priority || 'normal',
            category: ctx.session.temp_task_category || null
        };
        data.users[userId].tasks.push(newTask);
        // Session o'zgaruvchilarini tozalash
        ctx.session.temp_task_priority = null;
        ctx.session.temp_task_category = null;
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
        await ctx.reply(`✅ Kategoriya qo'shildi va tanlandi!\n🕒 <b>"${ctx.session.temp_task_desc}"</b> qachon? Format: 14:00 yoki 05.20 09:00`, withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
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
        await ctx.reply(`🛎 <b>Eslatma vaqtini kiriting (HH:mm):</b>`, withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
        return;
    }

    if (ctx.session.state === 'await_custom_reminder_time') {
        ctx.session.temp_rem_time = text;
        ctx.session.state = 'await_custom_reminder_text';
        await ctx.reply(`🛎 <b>Maxsus matnni kiriting:</b>`, withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
        return;
    }

    if (ctx.session.state === 'await_custom_reminder_text') {
        if (!data.users[userId].custom_reminders) data.users[userId].custom_reminders = [];
        data.users[userId].custom_reminders.push({ desc: ctx.session.temp_rem_desc, time: ctx.session.temp_rem_time, customText: text });
        saveData(data);
        ctx.session.state = null;
        await ctx.reply(`✅ Shaxsiy eslatma qo'shildi! Belgilangan vaqtda matn yuboriladi.`, withProtectContentForCtx(ctx));
        await bot.action('view_custom_reminders', ctx);
        return;
    }

    if (ctx.session.state === 'await_team_name') {
        if (!data.users[userId].teams) data.users[userId].teams = [];
        
        // Unikal taklif kodi yaratish
        const inviteCode = `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const newTeam = {
            name: text,
            ownerId: userId,
            members: [userId],
            sharedTasks: [],
            inviteCode: inviteCode,
            createdAt: new Date().toISOString()
        };
        
        data.users[userId].teams.push(newTeam);
        saveData(data);
        
        ctx.session.state = null;
        
        // Bot username ni olish
        let botUsername = '';
        try {
            const botInfo = await ctx.telegram.getMe();
            botUsername = botInfo.username;
        } catch (e) {
            botUsername = ctx.botInfo?.username || '';
        }
        const inviteLink = `https://t.me/${botUsername}?start=team_${inviteCode}`;
        
        await ctx.reply(
            `✅ <b>Jamoa yaratildi!</b>\n\n` +
            `Jamoa: <b>${text}</b>\n\n` +
            `Do'stlaringizni taklif qilish uchun quyidagi linkni yuboring:\n\n` +
            `<code>${inviteLink}</code>`,
            withProtectContentForCtx(ctx, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.url('📤 Do\'stga yuborish', `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(`Men sizni "${text}" jamoasiga taklif qilmoqchiman!`)}`)],
                    [Markup.button.callback('🔙 Jamoa ro\'yxati', 'view_team_collaboration')]
                ])
            })
        );
        return;
    }

    if (ctx.session.state === 'await_team_task') {
        const teamIdx = ctx.session.teamIdx;
        const team = data.users[userId].teams[teamIdx];
        
        if (!team) {
            ctx.session.state = null;
            return ctx.reply("❌ Jamoa topilmadi!", withProtectContentForCtx(ctx));
        }
        
        // Faqat jamoa a'zolari vazifa qo'sha oladi
        if (!team.members.includes(userId)) {
            ctx.session.state = null;
            return ctx.reply("❌ Siz jamoa a'zosi emassiz!", withProtectContentForCtx(ctx));
        }
        
        if (!team.sharedTasks) {
            team.sharedTasks = [];
        }
        
        const newTask = {
            desc: text,
            done: false,
            createdBy: userId,
            createdAt: new Date().toISOString()
        };
        
        team.sharedTasks.push(newTask);
        
        // Barcha jamoa a'zolariga xabar yuborish
        team.members.forEach(memberId => {
            if (memberId !== userId) {
                try {
                    bot.telegram.sendMessage(
                        memberId,
                        `📋 <b>Yangi jamoa vazifasi!</b>\n\n` +
                        `Jamoa: <b>${team.name}</b>\n` +
                        `Vazifa: ${text}\n` +
                        `Yaratuvchi: ${data.users[userId].name}`,
                        { parse_mode: 'HTML' }
                    ).catch(() => {});
                } catch (e) {}
            }
        });
        
        saveData(data);
        ctx.session.state = null;
        await ctx.reply(`✅ Jamoa vazifasi qo'shildi! Barcha a'zolar xabardor qilindi.`, withProtectContentForCtx(ctx));
        await bot.action(`team_view_${teamIdx}`, ctx);
        return;
    }

    if (ctx.session.state === 'await_voice_note_text') {
        ctx.session.temp_voice_desc = text;
        ctx.session.state = 'await_voice_time';
        await ctx.reply(`⏰ <b>Eslatma vaqtini kiriting (HH:mm):</b>`, withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
        return;
    }

    if (ctx.session.state === 'await_integration_app') {
        data.users[userId].integrations.push(text);
        saveData(data);
        ctx.session.state = null;
        await ctx.reply(`✅ Ilova ulandi! Ma'lumotlar sinxronlanadi.`, withProtectContentForCtx(ctx));
        await bot.action('view_integration_apps', ctx);
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
        await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
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
            bot.telegram.sendMessage(targetId, `🎁 Admin ${amount} XP sovg'a qildi!`).catch(() => {});
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
        await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
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
});

// --- VOICE HANDLER FOR OVOZLI ESLATMALAR ---
bot.on('voice', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    if (ctx.session.state === 'await_voice_note') {
        const voiceFileId = ctx.message.voice.file_id;
        ctx.session.temp_voice_id = voiceFileId;
        ctx.session.state = 'await_voice_time';
        await ctx.reply(`🎤 <b>Ovoz saqlandi. Eslatma vaqtini kiriting (HH:mm):</b>`, withProtectContentForCtx(ctx, { parse_mode: 'HTML' }));
    }
});

// Voice notes vaqtini kiritish (ikkinchi text handler - faqat voice notes uchun)
bot.on('text', async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = loadData();
    const text = ctx.message.text.trim();
    
    if (ctx.session.state === 'await_voice_time') {
        const time = text;
        if (!data.users[userId].voiceNotes) data.users[userId].voiceNotes = [];
        data.users[userId].voiceNotes.push({ 
            voiceId: ctx.session.temp_voice_id, 
            time,
            desc: ctx.session.temp_voice_desc || null
        });
        saveData(data);
        ctx.session.state = null;
        ctx.session.temp_voice_id = null;
        ctx.session.temp_voice_desc = null;
        await ctx.reply(`✅ Ovozli eslatma saqlandi! Belgilangan vaqtda eshittiriladi.`, withProtectContentForCtx(ctx));
        await bot.action('view_voice_notes', ctx);
        return;
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

// --- CRON JOBS ---
// Eslatmalar
cron.schedule('* * * * *', async () => {
    const data = loadData();
    const now = dayjs();
    let changed = false;

    for (const [userId, user] of Object.entries(data.users)) {
        if (user.blocked || !user.settings.notifications) continue;
        user.tasks.forEach(task => {
            if (!task.done && !task.reminded) {
                const tTime = dayjs(task.datetime, 'YYYY-MM-DD HH:mm');
                if (tTime.isSame(now, 'minute')) {
                    bot.telegram.sendMessage(userId, `🔔 <b>Eslatma!</b>\n${task.desc}`, withProtectContentForUser(user, { parse_mode: 'HTML' }, userId)).catch((e) => console.error('Send error:', e));
                    task.reminded = true;
                    changed = true;
                }
            }
        });

        // Custom reminders
        if (user.custom_reminders) {
            user.custom_reminders.forEach(rem => {
                if (dayjs().format('HH:mm') === rem.time) {
                    bot.telegram.sendMessage(userId, `🛎 <b>Shaxsiy eslatma:</b>\n${rem.customText}`, withProtectContentForUser(user, { parse_mode: 'HTML' }, userId)).catch((e) => console.error('Send error:', e));
                }
            });
        }

        // Advanced reminders
        if (user.advancedReminders) {
            user.advancedReminders.forEach(rem => {
                rem.times.forEach(time => {
                    if (dayjs().format('HH:mm') === time) {
                        bot.telegram.sendMessage(userId, `🔔 <b>Qayta eslatma:</b>\n${rem.desc}`, withProtectContentForUser(user, { parse_mode: 'HTML' }, userId)).catch((e) => console.error('Send error:', e));
                    }
                });
            });
        }

        // Ovozli eslatmalar
        if (user.voiceNotes) {
            user.voiceNotes.forEach(vn => {
                if (dayjs().format('HH:mm') === vn.time) {
                    bot.telegram.sendVoice(userId, vn.voiceId).catch((e) => console.error('Send error:', e));
                }
            });
        }

        // Odatlar eslatmalari
        if (user.habits) {
            user.habits.forEach(habit => {
                if (!habit.doneToday && dayjs().hour() === 20) { // Masalan, kechqurun eslatish
                    bot.telegram.sendMessage(userId, `🔄 <b>Odat eslatma:</b>\n${habit.name} ni bajaring! Streak: ${habit.streak}`, withProtectContentForUser(user, { parse_mode: 'HTML' }, userId)).catch((e) => console.error('Send error:', e));
                }
            });
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