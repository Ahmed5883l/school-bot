import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import { setupTicketHandlers } from './modules/tickets.js';
import { sendDailyQuiz } from './modules/quiz.js';
import { scheduleLessons } from './modules/lessons.js';
import { registerCommands } from './modules/commands.js';
import { giveXPAndMaybeRank } from './modules/xp.js';
import { handleInteraction } from './modules/interactions.js';

// إنشاء عميل Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel, Partials.Message]
});

// تخزين الأوامر في مجموعة
client.commands = new Collection();

// حدث جاهزية البوت
client.once('ready', async () => {
  console.log(`✅ تم تسجيل الدخول بنجاح: ${client.user.tag}`);
  console.log(`📊 عدد السيرفرات: ${client.guilds.cache.size}`);
  console.log(`👥 عدد المستخدمين: ${client.users.cache.size}`);
  
  // تسجيل الأوامر
  await registerCommands(client);
  
  // جدولة الدروس التلقائية
  scheduleLessons(client);
  
  // إعداد نظام التذاكر
  setupTicketHandlers(client);
  
  // جدولة الاختبار اليومي (كل 24 ساعة)
  // يمكنك استخدام مكتبة مثل node-cron لجدولة أكثر دقة
  setInterval(() => {
    sendDailyQuiz(client);
  }, 24 * 60 * 60 * 1000); // 24 ساعة
  
  // إرسال أول اختبار عند التشغيل (اختياري)
  sendDailyQuiz(client);
  
  // تعيين حالة البوت
  client.user.setActivity('مساعدة الطلاب 📚', { type: 'WATCHING' });
});

// حدث استقبال الرسائل
client.on('messageCreate', async (message) => {
  // تجاهل رسائل البوتات
  if (message.author.bot) return;
  
  // نظام XP للنشاط
  await giveXPAndMaybeRank(message);
});

// حدث التفاعل مع الأوامر والأزرار
client.on('interactionCreate', async (interaction) => {
  await handleInteraction(interaction, client);
});

// معالجة الأخطاء
client.on('error', (error) => {
  console.error('❌ خطأ في Discord Client:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ خطأ غير معالج:', error);
});

// تسجيل الدخول
client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('❌ فشل تسجيل الدخول. تحقق من DISCORD_TOKEN في ملف .env');
  console.error(error);
  process.exit(1);
});
