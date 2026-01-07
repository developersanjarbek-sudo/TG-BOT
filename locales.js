const LOCALES = {
    uz: {
        greeting: "👋 <b>Salom, {name}!</b>",
        level_prefix: "🔰 <b>Daraja:</b> {level}",
        xp_prefix: "💎 <b>XP:</b> {xp}",
        tasks_today: "📅 <b>Bugungi vazifalar:</b> {count} ta qoldi",
        bonus_available: "🎁 <i>Sizda kunlik bonus mavjud!</i>",
        buttons: {
            add_task: "➕ Vazifa qo'shish",
            today: "📅 Bugun",
            all_tasks: "📋 Barchasi",
            get_bonus: "🎁 Kunlik Bonusni Olish (+{xp} XP)",
            shop: "🛒 Do'kon",
            profile: "👤 Profil",
            settings: "⚙️ Sozlamalar",
            habits: "🔄 Odatlar",
            statistics: "📊 Statistika",
            back_main: "🔙 Bosh menyu",
            back: "🔙 Orqaga",
            view_all: "📋 Barchasi",
            admin_panel: "🛡️ Admin Panel"
        },
        levels: {
            1: "🌱 Yangi",
            2: "🥉 Boshlovchi",
            3: "🥈 Faol",
            4: "🥇 Mutaxassis",
            5: "💎 Afsona"
        },
        settings: {
            title: "⚙️ <b>Sozlamalar</b>",
            notifications: "Bildirishnomalar",
            on: "Yoqilgan",
            off: "O'chirilgan",
            language: "Til",
            toggle_notif: "🔔 Bildirishnomalarni Yoqish/O'chirish",
            change_lang: "🌐 Tilni O'zgartirish",
            choose_lang: "🌐 Tilni tanlang:",
            lang_updated: "✅ Til o'zgartirildi: O'zbekcha"
        },
        profile: {
            title: "👤 <b>Profil</b>",
            name: "Ism",
            level: "Daraja",
            joined: "Qo'shilgan",
            unlocked: "🔓 Ochilgan funksiyalar",
            unknown: "Noma'lum",
            none: "Yo'q"
        },
        shop: {
            title: "🛒 <b>Do'kon</b>\n💎 XP: <b>{xp}</b>",
            unlocked_section: "<b>Ochilgan funksiyalar:</b>",
            locked_section: "<b>Ochilmagan funksiyalar:</b>",
            buy_btn: "🔓 Sotib olish: {name} ({price} XP)",
            bought_btn: "✅ {name} (Sotib olingan)",
            items: {
                statistics: { name: '📊 Pro Statistika', desc: "Barcha bajarilgan ishlar statistikasi va grafiklar" },
                habits: { name: '🔄 Odatlar Trekeri', desc: "Har kuni takrorlanuvchi odatlar, streak va bildirishnomalar" },
                motivation: { name: '🔥 Motivatsiya Moduli', desc: "Har kuni ertalab motivatsion xabar va maslahatlar" },
                priorities: { name: '🚨 Prioritetlar', desc: "Vazifalarga prioritet berish va tartiblash" },
                categories: { name: '🏷 Kategoriyalar', desc: "Vazifalarni kategoriyalarga bo'lish" },
                reminders: { name: '🔔 Kengaytirilgan Eslatmalar', desc: "Bir necha eslatma va takroriy bildirishnomalar" },
                goals: { name: '🎯 Maqsadlar Trekeri', desc: "Uzoq muddatli maqsadlarni kuzatish" },
                pomodoro: { name: '⏱ Pomodoro Taymer', desc: "Vaqt boshqaruv usuli" },
                notes: { name: '📝 Eslatmalar', desc: "Shaxsiy eslatmalar saqlash" },
                calendar: { name: '🗓 Kalendar Integratsiyasi', desc: "Vazifalarni kalendarga bog'lash" },
                custom_reminders: { name: '🛎 Shaxsiy Eslatmalar', desc: "Moslashtirilgan eslatmalar" },
                progress_reports: { name: '📈 Taraqqiyot Hisobotlari', desc: "Haftalik/oylik hisobotlar" },
                achievements: { name: '🏆 Yutuqlar', desc: "Yutuqlar tizimi" },
                social_sharing: { name: '📤 Ijtimoiy Ulashish', desc: "Yutuqlarni ulashish va botni do'stlarga uzatish" },
                custom_themes: { name: '🎨 Shaxsiy Temalar', desc: "Bot interfeysini moslashtirish" },
                ai_tips: { name: '🤖 AI Maslahatlar', desc: "AI orqali maslahatlar olish" },
                voice_notes: { name: '🎤 Ovozli Eslatmalar', desc: "Ovozli xabarlarni saqlash va eslatish" },
                integration_apps: { name: '🔗 Ilovalar Integratsiyasi', desc: "Boshqa ilovalar bilan bog'lanish" },
                goal_chat: { name: '🎭 Anonim Maqsadlar Chati', desc: "Global anonim chat, intizom va motivatsiya" }
            }
        },
        common: {
            cancel: "🔙 Bekor qilish",
            saved: "✅ Saqlandi",
            error: "❌ Xatolik yuz berdi",
            bonus_received: "🎉 +{xp} XP!",
            bonus_already: "⚠️ Bugungi bonus olindi.",
            premium: "⚠️ Premium!",
            no_tasks: "📭 Vazifalar yo'q.",
            do: "✅ Bajarish",
            delete: "❌ O'chirish",
            delete_bin: "🗑 O'chirish",
            edit: "✏️ Tahrirlash"
        },
        tasks: {
            add_prompt: "📝 <b>Vazifa nomini yozing:</b>",
            today_title: "📅 Bugungi vazifalar",
            all_title: "📋 Barcha vazifalar"
        },
        modules: {
            statistics: {
                title: "📊 <b>Pro Statistika</b>",
                completed: "Bajarilgan vazifalar",
                daily: "Kunlik",
                weekly: "Haftalik",
                monthly: "Oylik",
                active_day: "Eng faol kun",
                active_time: "Eng faol vaqt",
                none: "Yo'q"
            },
            pomodoro: {
                title: "⏱ <b>Pomodoro Taymer</b>",
                info: "25 daqiqa ish, 5 daqiqa dam olish.",
                cycles: "Joriy sikllar",
                start: "▶️ Pomodoro boshlash",
                started: "⏱ Pomodoro boshlandi! 25 daqiqa ishlaymiz.",
                finished: "⏱ Pomodoro tugadi! 5 daqiqa dam oling. Sikl: {cycles}",
                active: "⚠️ Allaqachon ishlamoqda!"
            },
            notes: {
                title: "📝 <b>Eslatmalar</b>",
                empty: "📭 Hozircha eslatmalar yo'q.",
                add_btn: "➕ Eslatma yozish",
                add_prompt: "📝 <b>Eslatma matnini kiriting:</b>"
            },
            goals: {
                title: "🎯 <b>Maqsadlar</b>",
                add_btn: "➕ Uzoq muddatli maqsad qo'shish",
                add_prompt: "🎯 <b>Maqsad nomini kiriting:</b>",
                update: "📈 Yangilash",
                subtask_add: "➕ Kichik vazifa qo'shish",
                subtask_prompt: "🎯 <b>Kichik vazifa nomini kiriting:</b>",
                updated: "✅ Yangilandi"
            },
            habits: {
                title: "🔄 <b>Odatlar</b>",
                add_btn: "➕ Yangi odat qo'shish",
                add_prompt: "🔄 <b>Odat nomini kiriting:</b>",
                streak: "Streak",
                done: "✅ Bajarildi"
            },
            priorities: {
                title: "🚨 <b>Prioritetlar</b>",
                high: "Yuqori prioritet vazifalar",
                normal: "Normal prioritet vazifalar",
                info: "Vazifani muhim qilish uchun vazifa qo'shishda 'muhim' deb belgilang. Muhim vazifalar ro'yxat boshida."
            },
            categories: {
                title: "🏷 <b>Kategoriyalar</b>",
                add_btn: "➕ Kategoriya qo'shish",
                add_prompt: "🏷 <b>Kategoriya nomini kiriting:</b>",
                filter_btn: "🔍 Filtrlash",
                select: "🏷 <b>Kategoriyani tanlang:</b>",
                tasks_in: "🏷 <b>{category} kategoriyasi vazifalari:</b>"
            }
        },
        registration: {
            welcome: "👋 <b>Xush kelibsiz!</b>\n\nIsmingizni kiriting:",
            restart: "Iltimos, qaytadan /start ni bosing.",
            blocked: "🚫 Siz admin tomonidan bloklangansiz."
        },
        admin: {
            title: "�️ <b>Admin Panel</b>",
            users: "Foydalanuvchilar soni",
            broadcast_btn: "📢 Xabar yuborish",
            stats_btn: "📊 Statistika",
            manage_btn: "👥 Foydalanuvchilarni boshqarish",
            broadcast_prompt: "📢 <b>Barcha foydalanuvchilarga xabar yuborish:</b>",
            broadcast_success: "✅ Xabar {count} ta foydalanuvchiga yuborildi.",
            stats_title: "📊 <b>Statistika</b>",
            manage_title: "👥 <b>Foydalanuvchilarni boshqarish</b>\n\n<b>Foydalanuvchi ID ni kiriting:</b>",
            clear_db_btn: "⚠️ Bazani tozalash",
            clear_db_confirm: "⚠️ <b>Haqiqatan ham barcha ma'lumotlarni o'chirmoqchimisiz?</b>\n\nBu amalni ortga qaytarib bo'lmaydi! Barcha foydalanuvchilar, vazifalar va sozlamalar o'chib ketadi.",
            clear_db_success: "✅ Baza tozalandi! Bot qayta ishga tushishga tayyor."
        },
        contact_admin: "📞 Admin bilan bog'lanish",
        weeklyAnalysis: {
            title: "🧠 Haftalik tahlil",
            total_tasks: "📊 Jami vazifalar",
            completed: "✅ Bajarilgan",
            missed: "❌ Bajarilmagan",
            most_abandoned: "📉 Eng ko'p tashlangan vazifa turi",
            best_time: "⏰ Eng samarali vaqt",
            lazy_day: "😴 Sust kun",
            advice: "💡 Tavsiya",
            no_data: "📭 Tahlil uchun yetarli ma'lumot yo'q.",
            percent: "{percent}%"
        },
        noEscape: {
            title: "😈 No-Escape Mode",
            description: "Vazifalardan qochishni oldini oluvchi qattiq rejim",
            enabled: "Yoqilgan",
            disabled: "O'chirilgan",
            task_not_done: "😈 \"{title}\" bajarilmadi!",
            choose: "Tanlang:",
            postpone_10min: "⏰ 10 daqiqaga",
            postpone_1hour: "⏰ 1 soatga",
            postpone_tomorrow: "📅 Ertaga",
            write_reason: "✍️ Sabab yozish",
            reason_prompt: "✍️ Nima uchun bajarilmadi? Sabab yozing:",
            postponed: "⏰ {time} ga ko'chirildi",
            reason_saved: "✅ Sabab saqlandi",
            previous_reason: "⚠️ Oldingi safar bu turdagi vazifa \"{reason}\" sababli tashlangan edi.\n💪 Bu safar bajarasizmi?",
            cannot_delete: "❌ No-Escape rejimida vazifani o'chirib bo'lmaydi. Faqat kechiktirish yoki sabab yozish mumkin."
        },
        categories_list: {
            work: "💼 Ish",
            study: "📚 O'qish",
            personal: "🏠 Shaxsiy",
            other: "📦 Boshqa",
            prompt: "Kategoriyani tanlang:"
        },
        difficulty: {
            prompt: "Qiyinlik darajasini tanlang:",
            level_1: "1️⃣ Juda oson",
            level_2: "2️⃣ Oson",
            level_3: "3️⃣ O'rtacha",
            level_4: "4️⃣ Qiyin",
            level_5: "5️⃣ Juda qiyin"
        },
        goalChat: {
            title: "🎭 <b>Anonim Maqsadlar Chati</b>",
            joined: "✅ Chatga qo'shildingiz! Bu yerda yozganlaringiz barchaga anonim ko'rinadi.\n\n🆔 Sizning ID: <b>{anonId}</b>\n\n⚠️ <i>Qoidalar: Reklama, so'kinish va shaxsiy ma'lumotlar taqiqlanadi.</i>",
            left: "🚪 Chatdan chiqdingiz. Qayta kirish uchun do'kondan ruxsat olishingiz kerak.",
            banned: "🚫 Siz chatdan ban qilingansiz. Ban tugash vaqti: {time}",
            msg_template: "🧠 <b>{anonId}</b> | {time}\n{text}",
            admin_msg_template: "👮‍♂️ <b>ADMIN</b>: {text}",
            violation: "🚫 <b>Qoidabuzarlik aniqlandi!</b> Siz chatdan {duration} ga ban qilindingiz."
        }
    },
    en: {
        greeting: "�👋 <b>Hello, {name}!</b>",
        level_prefix: "🔰 <b>Level:</b> {level}",
        xp_prefix: "💎 <b>XP:</b> {xp}",
        tasks_today: "📅 <b>Today's tasks:</b> {count} left",
        bonus_available: "🎁 <i>Daily bonus available!</i>",
        buttons: {
            add_task: "➕ Add Task",
            today: "📅 Today",
            all_tasks: "📋 All Tasks",
            get_bonus: "🎁 Get Daily Bonus (+{xp} XP)",
            shop: "🛒 Shop",
            profile: "👤 Profile",
            settings: "⚙️ Settings",
            habits: "🔄 Habits",
            statistics: "📊 Statistics",
            back_main: "🔙 Main Menu",
            back: "🔙 Back",
            view_all: "📋 View All",
            admin_panel: "🛡️ Admin Panel"
        },
        levels: {
            1: "🌱 Newbie",
            2: "🥉 Beginner",
            3: "🥈 Active",
            4: "🥇 Expert",
            5: "💎 Legend"
        },
        settings: {
            title: "⚙️ <b>Settings</b>",
            notifications: "Notifications",
            on: "On",
            off: "Off",
            language: "Language",
            toggle_notif: "🔔 Toggle Notifications",
            change_lang: "🌐 Change Language",
            choose_lang: "🌐 Choose Language:",
            lang_updated: "✅ Language changed: English"
        },
        goalChat: {
            title: "🎭 <b>Anonymous Goal Chat</b>",
            joined: "✅ Joined chat! Messages are anonymous.\n\n🆔 Your ID: <b>{anonId}</b>\n\n⚠️ <i>Rules: No ads, swearing, or personal info.</i>",
            left: "🚪 You left the chat. Repurchase required to rejoin.",
            banned: "🚫 You are banned until: {time}",
            msg_template: "🧠 <b>{anonId}</b> | {time}\n{text}",
            admin_msg_template: "👮‍♂️ <b>ADMIN</b>: {text}",
            violation: "🚫 <b>Violation detected!</b> You are banned for {duration}."
        },
        profile: {
            title: "👤 <b>Profile</b>",
            name: "Name",
            level: "Level",
            joined: "Joined",
            unlocked: "🔓 Unlocked Features",
            unknown: "Unknown",
            none: "None"
        },
        shop: {
            title: "🛒 <b>Shop</b>\n💎 XP: <b>{xp}</b>",
            unlocked_section: "<b>Unlocked Features:</b>",
            locked_section: "<b>Locked Features:</b>",
            buy_btn: "🔓 Buy: {name} ({price} XP)",
            bought_btn: "✅ {name} (Owned)",
            items: {
                statistics: { name: '📊 Pro Statistics', desc: "Statistics and graphs of all work done" },
                habits: { name: '🔄 Habit Tracker', desc: "Daily recurring habits, streaks and notifications" },
                motivation: { name: '🔥 Motivation Module', desc: "Daily morning motivation messages and tips" },
                priorities: { name: '🚨 Priorities', desc: "Prioritize and sort tasks" },
                categories: { name: '🏷 Categories', desc: "Categorize tasks" },
                reminders: { name: '🔔 Advanced Reminders', desc: "Multiple reminders and recurring notifications" },
                goals: { name: '🎯 Goal Tracker', desc: "Track long-term goals" },
                pomodoro: { name: '⏱ Pomodoro Timer', desc: "Time management method" },
                notes: { name: '📝 Notes', desc: "Keep personal notes" },
                calendar: { name: '🗓 Calendar Integration', desc: "Link tasks to calendar" },
                custom_reminders: { name: '🛎 Custom Reminders', desc: "Customized reminders" },
                progress_reports: { name: '📈 Progress Reports', desc: "Weekly/monthly reports" },
                achievements: { name: '🏆 Achievements', desc: "Achievement system" },
                social_sharing: { name: '📤 Social Sharing', desc: "Share achievements and refer friends" },
                custom_themes: { name: '🎨 Custom Themes', desc: "Customize bot interface" },
                ai_tips: { name: '🤖 AI Tips', desc: "Get tips via AI" },
                voice_notes: { name: '🎤 Voice Notes', desc: "Save and remind voice messages" },
                integration_apps: { name: '🔗 App Integrations', desc: "Connect with other apps" },
                goal_chat: { name: '🎭 Anonymous Goal Chat', desc: "Global anonymous chat for discipline and motivation" }
            }
        },
        common: {
            cancel: "🔙 Cancel",
            saved: "✅ Saved",
            error: "❌ An error occurred",
            bonus_received: "🎉 +{xp} XP!",
            bonus_already: "⚠️ Today's bonus already collected.",
            premium: "⚠️ Premium!",
            no_tasks: "📭 No tasks.",
            do: "✅ Do",
            delete: "❌ Delete",
            delete_bin: "🗑 Delete",
            edit: "✏️ Edit"
        },
        tasks: {
            add_prompt: "📝 <b>Enter task name:</b>",
            today_title: "📅 Today's Tasks",
            all_title: "📋 All Tasks"
        },
        modules: {
            statistics: {
                title: "📊 <b>Pro Statistics</b>",
                completed: "Completed tasks",
                daily: "Daily",
                weekly: "Weekly",
                monthly: "Monthly",
                active_day: "Most active day",
                active_time: "Most active time",
                none: "None"
            },
            pomodoro: {
                title: "⏱ <b>Pomodoro Timer</b>",
                info: "25 min work, 5 min break.",
                cycles: "Current cycles",
                start: "▶️ Start Pomodoro",
                started: "⏱ Pomodoro started! Work for 25 mins.",
                finished: "⏱ Pomodoro finished! Take a 5 min break. Cycle: {cycles}",
                active: "⚠️ Already running!"
            },
            notes: {
                title: "📝 <b>Notes</b>",
                empty: "📭 No notes yet.",
                add_btn: "➕ Add Note",
                add_prompt: "📝 <b>Enter note text:</b>"
            },
            goals: {
                title: "🎯 <b>Goals</b>",
                add_btn: "➕ Add Long-term Goal",
                add_prompt: "🎯 <b>Enter goal name:</b>",
                update: "📈 Update",
                subtask_add: "➕ Add Subtask",
                subtask_prompt: "🎯 <b>Enter subtask name:</b>",
                updated: "✅ Updated"
            },
            habits: {
                title: "🔄 <b>Habits</b>",
                add_btn: "➕ Add New Habit",
                add_prompt: "🔄 <b>Enter habit name:</b>",
                streak: "Streak",
                done: "✅ Done"
            },
            priorities: {
                title: "🚨 <b>Priorities</b>",
                high: "High priority tasks",
                normal: "Normal priority tasks",
                info: "To make a task important, mark it as 'important' when adding. Important tasks appear at the top of the list."
            },
            categories: {
                title: "🏷 <b>Categories</b>",
                add_btn: "➕ Add Category",
                add_prompt: "🏷 <b>Enter category name:</b>",
                filter_btn: "🔍 Filter",
                select: "🏷 <b>Select category:</b>",
                tasks_in: "🏷 <b>Tasks in {category} category:</b>"
            }
        },
        registration: {
            welcome: "👋 <b>Welcome!</b>\n\nEnter your name:",
            restart: "Please press /start again.",
            blocked: "🚫 You have been blocked by admin."
        },
        admin: {
            title: "🛡️ <b>Admin Panel</b>",
            users: "Number of users",
            broadcast_btn: "📢 Send Message",
            stats_btn: "📊 Statistics",
            manage_btn: "👥 Manage Users",
            broadcast_prompt: "📢 <b>Send message to all users:</b>",
            broadcast_success: "✅ Message sent to {count} users.",
            stats_title: "📊 <b>Statistics</b>",
            manage_title: "👥 <b>Manage Users</b>\n\n<b>Enter user ID:</b>",
            clear_db_btn: "⚠️ Clear Database",
            clear_db_confirm: "⚠️ <b>Are you sure you want to delete ALL data?</b>\n\nThis action cannot be undone! All users, tasks and settings will be lost.",
            clear_db_success: "✅ Database cleared! Bot ready to restart."
        },
        contact_admin: "📞 Contact Admin",
        weeklyAnalysis: {
            title: "🧠 Weekly Analysis",
            total_tasks: "📊 Total tasks",
            completed: "✅ Completed",
            missed: "❌ Missed",
            most_abandoned: "📉 Most abandoned task type",
            best_time: "⏰ Best time",
            lazy_day: "😴 Lazy day",
            advice: "💡 Advice",
            no_data: "📭 Not enough data for analysis.",
            percent: "{percent}%"
        },
        noEscape: {
            title: "😈 No-Escape Mode",
            description: "Strict mode that prevents avoiding tasks",
            enabled: "Enabled",
            disabled: "Disabled",
            task_not_done: "😈 \"{title}\" not completed!",
            choose: "Choose:",
            postpone_10min: "⏰ 10 minutes",
            postpone_1hour: "⏰ 1 hour",
            postpone_tomorrow: "📅 Tomorrow",
            write_reason: "✍️ Write reason",
            reason_prompt: "✍️ Why wasn't it completed? Write reason:",
            postponed: "⏰ Moved to {time}",
            reason_saved: "✅ Reason saved",
            previous_reason: "⚠️ Last time this type of task was abandoned due to \"{reason}\".\n💪 Will you complete it this time?",
            cannot_delete: "❌ Cannot delete task in No-Escape mode. Only postpone or write reason."
        },
        categories_list: {
            work: "💼 Work",
            study: "📚 Study",
            personal: "🏠 Personal",
            other: "📦 Other",
            prompt: "Choose category:"
        },
        difficulty: {
            prompt: "Choose difficulty level:",
            level_1: "1️⃣ Very easy",
            level_2: "2️⃣ Easy",
            level_3: "3️⃣ Medium",
            level_4: "4️⃣ Hard",
            level_5: "5️⃣ Very hard"
        }
    },
    ru: {
        greeting: "👋 <b>Привет, {name}!</b>",
        level_prefix: "🔰 <b>Уровень:</b> {level}",
        xp_prefix: "💎 <b>XP:</b> {xp}",
        tasks_today: "📅 <b>Задачи на сегодня:</b> осталось {count}",
        bonus_available: "🎁 <i>Доступен ежедневный бонус!</i>",
        buttons: {
            add_task: "➕ Добавить задачу",
            today: "📅 Сегодня",
            all_tasks: "📋 Все задачи",
            get_bonus: "🎁 Получить бонус (+{xp} XP)",
            shop: "🛒 Магазин",
            profile: "👤 Профиль",
            settings: "⚙️ Настройки",
            habits: "🔄 Привычки",
            statistics: "📊 Статистика",
            back_main: "🔙 Главное меню",
            back: "🔙 Назад",
            view_all: "📋 Посмотреть все",
            admin_panel: "🛡️ Админ панель"
        },
        levels: {
            1: "🌱 Новичок",
            2: "🥉 Начинающий",
            3: "🥈 Активный",
            4: "🥇 Эксперт",
            5: "💎 Легенда"
        },
        settings: {
            title: "⚙️ <b>Настройки</b>",
            notifications: "Уведомления",
            on: "Включены",
            off: "Отключены",
            language: "Язык",
            toggle_notif: "🔔 Вкл/Выкл уведомления",
            change_lang: "🌐 Изменить язык",
            choose_lang: "🌐 Выберите язык:",
            lang_updated: "✅ Язык изменен: Русский"
        },
        goalChat: {
            title: "🎭 <b>Анонимный Чат Целей</b>",
            joined: "✅ Вы присоединились к чату! Ваши сообщения анонимны.\n\n🆔 Ваш ID: <b>{anonId}</b>\n\n⚠️ <i>Правила: Реклама, брань и личные данные запрещены.</i>",
            left: "🚪 Вы вышли из чата. Требуется повторная покупка для входа.",
            banned: "🚫 Вы забанены до: {time}",
            msg_template: "🧠 <b>{anonId}</b> | {time}\n{text}",
            admin_msg_template: "👮‍♂️ <b>АДМИН</b>: {text}",
            violation: "🚫 <b>Нарушение!</b> Вы забанены на {duration}."
        },
        profile: {
            title: "👤 <b>Профиль</b>",
            name: "Имя",
            level: "Уровень",
            joined: "В боте с",
            unlocked: "🔓 Открытые функции",
            unknown: "Неизвестно",
            none: "Нет"
        },
        shop: {
            title: "🛒 <b>Магазин</b>\n💎 XP: <b>{xp}</b>",
            unlocked_section: "<b>Открытые функции:</b>",
            locked_section: "<b>Закрытые функции:</b>",
            buy_btn: "🔓 Купить: {name} ({price} XP)",
            bought_btn: "✅ {name} (Куплено)",
            items: {
                statistics: { name: '📊 Pro Статистика', desc: "Статистика и графики выполненных работ" },
                habits: { name: '🔄 Трекер привычек', desc: "Ежедневные привычки, серии и уведомления" },
                motivation: { name: '🔥 Модуль мотивации', desc: "Ежедневные мотивационные сообщения и советы" },
                priorities: { name: '🚨 Приоритеты', desc: "Приоритезация и сортировка задач" },
                categories: { name: '🏷 Категории', desc: "Разделение задач на категории" },
                reminders: { name: '🔔 Расширенные напоминания', desc: "Несколько напоминаний и повторы" },
                goals: { name: '🎯 Трекер целей', desc: "Отслеживание долгосрочных целей" },
                pomodoro: { name: '⏱ Помидоро таймер', desc: "Метод управления временем" },
                notes: { name: '📝 Заметки', desc: "Личные заметки" },
                calendar: { name: '🗓 Интеграция с календарем', desc: "Связь задач с календарем" },
                custom_reminders: { name: '🛎 Личные напоминания', desc: "Настраиваемые напоминания" },
                progress_reports: { name: '📈 Отчеты о прогрессе', desc: "Еженедельные/ежемесячные отчеты" },
                achievements: { name: '🏆 Достижения', desc: "Система достижений" },
                social_sharing: { name: '📤 Поделиться', desc: "Делиться достижениями и приглашать друзей" },
                custom_themes: { name: '🎨 Темы', desc: "Настройка интерфейса бота" },
                ai_tips: { name: '🤖 AI Советы', desc: "Советы от ИИ" },
                voice_notes: { name: '🎤 Голосовые заметки', desc: "Сохранение и напоминание голосовых" },
                integration_apps: { name: '🔗 Интеграции', desc: "Связь с другими приложениями" },
                goal_chat: { name: '🎭 Анонимный Чат Целей', desc: "Глобальный анонимный чат для дисциплины и мотивации" }
            }
        },
        common: {
            cancel: "🔙 Отмена",
            saved: "✅ Сохранено",
            error: "❌ Произошла ошибка",
            bonus_received: "🎉 +{xp} XP!",
            bonus_already: "⚠️ Ежедневный бонус уже получен.",
            premium: "⚠️ Премиум!",
            no_tasks: "📭 Задач нет.",
            do: "✅ Выполнить",
            delete: "❌ Удалить",
            delete_bin: "🗑 Удалить",
            edit: "✏️ Редактировать"
        },
        tasks: {
            add_prompt: "📝 <b>Введите название задачи:</b>",
            today_title: "📅 Задачи на сегодня",
            all_title: "📋 Все задачи"
        },
        modules: {
            statistics: {
                title: "📊 <b>Pro Статистика</b>",
                completed: "Выполненные задачи",
                daily: "Дневной",
                weekly: "Недельный",
                monthly: "Месячный",
                active_day: "Самый активный день",
                active_time: "Самое активное время",
                none: "Нет"
            },
            pomodoro: {
                title: "⏱ <b>Помидоро Таймер</b>",
                info: "25 мин работа, 5 мин отдых.",
                cycles: "Текущие циклы",
                start: "▶️ Начать Помидоро",
                started: "⏱ Помидоро запущен! Работаем 25 мин.",
                finished: "⏱ Помидоро завершен! Отдохните 5 мин. Цикл: {cycles}",
                active: "⚠️ Уже запущен!"
            },
            notes: {
                title: "📝 <b>Заметки</b>",
                empty: "📭 Заметок пока нет.",
                add_btn: "➕ Добавить заметку",
                add_prompt: "📝 <b>Введите текст заметки:</b>"
            },
            goals: {
                title: "🎯 <b>Цели</b>",
                add_btn: "➕ Добавить цель",
                add_prompt: "🎯 <b>Введите название цели:</b>",
                update: "📈 Обновить",
                subtask_add: "➕ Добавить подзадачу",
                subtask_prompt: "🎯 <b>Введите название подзадачи:</b>",
                updated: "✅ Обновлено"
            },
            habits: {
                title: "🔄 <b>Привычки</b>",
                add_btn: "➕ Добавить привычку",
                add_prompt: "🔄 <b>Введите название привычки:</b>",
                streak: "Серия",
                done: "✅ Выполнено"
            },
            priorities: {
                title: "🚨 <b>Приоритеты</b>",
                high: "Задачи с высоким приоритетом",
                normal: "Задачи с обычным приоритетом",
                info: "Чтобы сделать задачу важной, отметьте 'важно' при добавлении. Важные задачи появляются в начале списка."
            },
            categories: {
                title: "🏷 <b>Категории</b>",
                add_btn: "➕ Добавить категорию",
                add_prompt: "🏷 <b>Введите название категории:</b>",
                filter_btn: "🔍 Фильтр",
                select: "🏷 <b>Выберите категорию:</b>",
                tasks_in: "🏷 <b>Задачи в категории {category}:</b>"
            }
        },
        registration: {
            welcome: "👋 <b>Добро пожаловать!</b>\n\nВведите ваше имя:",
            restart: "Пожалуйста, нажмите /start снова.",
            blocked: "🚫 Вы заблокированы администратором."
        },
        admin: {
            title: "🛡️ <b>Админ Панель</b>",
            users: "Количество пользователей",
            broadcast_btn: "📢 Отправить сообщение",
            stats_btn: "📊 Статистика",
            manage_btn: "👥 Управление пользователями",
            broadcast_prompt: "📢 <b>Отправить сообщение всем пользователям:</b>",
            broadcast_success: "✅ Сообщение отправлено {count} пользователям.",
            stats_title: "📊 <b>Статистика</b>",
            manage_title: "👥 <b>Управление пользователями</b>\n\n<b>Введите ID пользователя:</b>",
            clear_db_btn: "⚠️ Очистить базу",
            clear_db_confirm: "⚠️ <b>Вы уверены, что хотите удалить ВСЕ данные?</b>\n\nЭто действие необратимо! Все пользователи, задачи и настройки будут удалены.",
            clear_db_success: "✅ База очищена! Бот готов к перезапуску."
        },
        contact_admin: "📞 Связаться с админом",
        weeklyAnalysis: {
            title: "🧠 Недельный анализ",
            total_tasks: "📊 Всего задач",
            completed: "✅ Выполнено",
            missed: "❌ Пропущено",
            most_abandoned: "📉 Чаще всего пропускается",
            best_time: "⏰ Лучшее время",
            lazy_day: "😴 Ленивый день",
            advice: "💡 Совет",
            no_data: "📭 Недостаточно данных для анализа.",
            percent: "{percent}%"
        },
        noEscape: {
            title: "😈 No-Escape режим",
            description: "Строгий режим, предотвращающий избегание задач",
            enabled: "Включен",
            disabled: "Отключен",
            task_not_done: "😈 \"{title}\" не выполнена!",
            choose: "Выберите:",
            postpone_10min: "⏰ 10 минут",
            postpone_1hour: "⏰ 1 час",
            postpone_tomorrow: "📅 На завтра",
            write_reason: "✍️ Написать причину",
            reason_prompt: "✍️ Почему не выполнено? Напишите причину:",
            postponed: "⏰ Перенесено на {time}",
            reason_saved: "✅ Причина сохранена",
            previous_reason: "⚠️ В прошлый раз эта задача была пропущена по причине \"{reason}\".\n💪 Выполните на этот раз?",
            cannot_delete: "❌ Нельзя удалить задачу в No-Escape режиме. Можно только отложить или написать причину."
        },
        categories_list: {
            work: "💼 Работа",
            study: "📚 Учеба",
            personal: "🏠 Личное",
            other: "📦 Другое",
            prompt: "Выберите категорию:"
        },
        difficulty: {
            prompt: "Выберите уровень сложности:",
            level_1: "1️⃣ Очень легко",
            level_2: "2️⃣ Легко",
            level_3: "3️⃣ Средне",
            level_4: "4️⃣ Сложно",
            level_5: "5️⃣ Очень сложно"
        }
    }
};

module.exports = LOCALES;
