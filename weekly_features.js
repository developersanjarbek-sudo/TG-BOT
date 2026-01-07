// Haftalik tahlil funksiyasi
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

    let report = `${getText(lang, 'weeklyAnalysis.title')}\\n\\n`;
    report += `${getText(lang, 'weeklyAnalysis.total_tasks')}: ${tasks.length}\\n`;
    report += `${getText(lang, 'weeklyAnalysis.completed')}: ${completedTasks.length} (${completedPercent}%)\\n`;
    report += `${getText(lang, 'weeklyAnalysis.missed')}: ${missedTasks.length}\\n\\n`;

    if (mostAbandonedCategory) {
        const catName = getText(lang, `categories_list.${mostAbandonedCategory}`);
        report += `${getText(lang, 'weeklyAnalysis.most_abandoned')}: ${catName} (${Math.round(maxMissedPercent)}%)\\n`;
    }

    if (bestHour) {
        report += `${getText(lang, 'weeklyAnalysis.best_time')}: ${bestHour}:00-${parseInt(bestHour) + 2}:00\\n`;
    }

    if (lazyDay) {
        report += `${getText(lang, 'weeklyAnalysis.lazy_day')}: ${lazyDay}\\n\\n`;
    }

    report += `${getText(lang, 'weeklyAnalysis.advice')}:\\n${randomAdvice}`;

    return report;
}

// Kechiktirish handleri
bot.action(/postpone_(\\d+)_(.*)/, async (ctx) => {
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
bot.action(/write_reason_(\\d+)/, async (ctx) => {
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
