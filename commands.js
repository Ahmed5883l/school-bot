import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

// تعريف جميع الأوامر
const commands = [
  // أمر إنشاء تذكرة
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('إنشاء تذكرة دعم جديدة')
    .toJSON(),
  
  // أمر إضافة درس (للمعلمين فقط)
  new SlashCommandBuilder()
    .setName('addlesson')
    .setDescription('إضافة درس مجدول تلقائياً (للمعلمين فقط)')
    .addStringOption(option =>
      option.setName('title')
        .setDescription('عنوان الدرس')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('content')
        .setDescription('محتوى الدرس')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('cron')
        .setDescription('جدولة الدرس (مثال: 0 9 * * 1 = كل اثنين 9 صباحاً)')
        .setRequired(true)
    )
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('القناة التي سيُنشر فيها الدرس')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .toJSON(),
  
  // أمر إنشاء اختبار
  new SlashCommandBuilder()
    .setName('quiz')
    .setDescription('إنشاء اختبار إنجليزي تلقائي')
    .addStringOption(option =>
      option.setName('topic')
        .setDescription('موضوع الاختبار (مثال: Present Simple)')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('questions')
        .setDescription('عدد الأسئلة (1-10)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10)
    )
    .addStringOption(option =>
      option.setName('difficulty')
        .setDescription('مستوى الصعوبة')
        .setRequired(false)
        .addChoices(
          { name: 'سهل', value: 'easy' },
          { name: 'متوسط', value: 'medium' },
          { name: 'صعب', value: 'hard' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .toJSON(),
  
  // أوامر الإدارة (الرتب، الكتم، التبنيد)
  new SlashCommandBuilder()
    .setName('setrole')
    .setDescription('تعيين رتبة لعضو (للمعلمين/المديرين)')
    .addRoleOption(option =>
      option.setName('allowed_role')
        .setDescription('الرتبة المطلوبة لاستخدام هذا الأمر')
        .setRequired(false)
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('العضو المراد تعيين الرتبة له')
        .setRequired(true)
    )
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('الرتبة المراد تعيينها')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .toJSON(),
  
  new SlashCommandBuilder()
    .setName('removerole')
    .setDescription('إزالة رتبة من عضو (للمعلمين/المديرين)')
    .addRoleOption(option =>
      option.setName('allowed_role')
        .setDescription('الرتبة المطلوبة لاستخدام هذا الأمر')
        .setRequired(false)
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('العضو المراد إزالة الرتبة منه')
        .setRequired(true)
    )
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('الرتبة المراد إزالتها')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .toJSON(),
  
  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('كتم عضو لفترة محددة (للمعلمين/المديرين)')
    .addRoleOption(option =>
      option.setName('allowed_role')
        .setDescription('الرتبة المطلوبة لاستخدام هذا الأمر')
        .setRequired(false)
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('العضو المراد كتمه')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('duration')
        .setDescription('مدة الكتم بالدقائق (الافتراضي 60 دقيقة)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(40320) // 4 أسابيع
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('سبب الكتم')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .toJSON(),
  
  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('إلغاء كتم عضو (للمعلمين/المديرين)')
    .addRoleOption(option =>
      option.setName('allowed_role')
        .setDescription('الرتبة المطلوبة لاستخدام هذا الأمر')
        .setRequired(false)
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('العضو المراد إلغاء كتمه')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .toJSON(),
  
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('تبنيد عضو من السيرفر (للمعلمين/المديرين)')
    .addRoleOption(option =>
      option.setName('allowed_role')
        .setDescription('الرتبة المطلوبة لاستخدام هذا الأمر')
        .setRequired(false)
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('العضو المراد تبنيده')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('سبب التبنيد')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .toJSON(),
  
  // أمر عرض المستوى
  new SlashCommandBuilder()
    .setName('level')
    .setDescription('عرض مستواك أو مستوى مستخدم آخر')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('المستخدم المراد عرض مستواه')
        .setRequired(false)
    )
    .toJSON(),
  
  // أمر لوحة الصدارة
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('عرض لوحة الصدارة')
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('عدد المستخدمين في اللوحة (1-25)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(25)
    )
    .toJSON(),
  
  // أمر إضافة XP (للمعلمين)
  new SlashCommandBuilder()
    .setName('addxp')
    .setDescription('إضافة XP لمستخدم (للمعلمين فقط)')
    .addRoleOption(option =>
      option.setName('allowed_role')
        .setDescription('الرتبة المطلوبة لاستخدام هذا الأمر')
        .setRequired(false)
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('المستخدم')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('كمية XP')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(10000)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .toJSON(),
  
  // أمر المساعدة
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('عرض قائمة الأوامر والمساعدة')
    .toJSON(),
  
  // أمر معلومات البوت
  new SlashCommandBuilder()
    .setName('info')
    .setDescription('عرض معلومات عن البوت')
    .toJSON()
];

/**
 * تسجيل الأوامر في Discord
 */
export async function registerCommands(client) {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  
  try {
    console.log('🔄 بدء تسجيل الأوامر...');
    
    // التحقق من وجود CLIENT_ID
    if (!process.env.CLIENT_ID) {
      console.error('❌ CLIENT_ID غير موجود في ملف .env');
      console.log('💡 احصل على CLIENT_ID من Developer Portal > Application > General Information');
      return;
    }
    
    // تسجيل الأوامر عالمياً
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    
    console.log(`✅ تم تسجيل ${commands.length} أمر بنجاح`);
    
  } catch (error) {
    console.error('❌ خطأ في تسجيل الأوامر:', error);
    
    if (error.code === 50001) {
      console.error('💡 البوت يحتاج صلاحية applications.commands');
    }
  }
}

/**
 * الحصول على قائمة الأوامر
 */
export function getCommandsList() {
  return commands.map(cmd => ({
    name: cmd.name,
    description: cmd.description
  }));
}
