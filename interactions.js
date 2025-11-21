import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createTicket, closeTicket } from './tickets.js';
import { getUserXP, getLeaderboard, addXPManually } from './xp.js';
import { addLesson, getAllLessons } from './lessons.js';
import { createQuiz, submitQuizAnswer } from './quiz.js';
import { getCommandsList } from './commands.js';

/**
 * معالجة جميع التفاعلات (أوامر، أزرار، قوائم منسدلة)
 */
export async function handleInteraction(interaction, client) {
  try {
    // معالجة الأوامر Slash Commands
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction, client);
    }
    
    // معالجة الأزرار
    else if (interaction.isButton()) {
      await handleButton(interaction, client);
    }
    
    // معالجة القوائم المنسدلة
    else if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction, client);
    }
    
  } catch (error) {
    console.error('❌ خطأ في معالجة التفاعل:', error);
    
    const errorMessage = {
      content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر. يرجى المحاولة لاحقاً.',
      ephemeral: true
    };
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
}

/**
 * معالجة الأوامر
 */
async function handleCommand(interaction, client) {
  const { commandName } = interaction;
  
  // 1. التحقق من صلاحية الرتبة المحددة في الأمر
  const allowedRole = interaction.options.getRole('allowed_role');
  
  if (allowedRole) {
    // إذا تم تحديد رتبة، تحقق مما إذا كان المستخدم يمتلكها
    if (!interaction.member.roles.cache.has(allowedRole.id)) {
      return await interaction.reply({
        content: `⚠️ هذا الأمر متاح فقط للأعضاء الذين يمتلكون رتبة **${allowedRole.name}**!`,
        ephemeral: true
      });
    }
  }
  
  // 2. تنفيذ الأمر
  switch (commandName) {
    case 'ticket':
      await createTicket(interaction);
      break;
    
    case 'addlesson':
      await handleAddLesson(interaction);
      break;
    
    case 'quiz':
      await handleQuizCommand(interaction);
      break;
    
    case 'level':
      await handleLevelCommand(interaction);
      break;
    
    case 'leaderboard':
      await handleLeaderboardCommand(interaction);
      break;
    
    case 'addxp':
      await handleAddXPCommand(interaction);
      break;
      
    case 'setrole':
      const { handleSetRole } = await import('./moderation.js');
      await handleSetRole(interaction);
      break;
      
    case 'removerole':
      const { handleRemoveRole } = await import('./moderation.js');
      await handleRemoveRole(interaction);
      break;
      
    case 'mute':
      const { handleMute } = await import('./moderation.js');
      await handleMute(interaction);
      break;
      
    case 'unmute':
      const { handleUnmute } = await import('./moderation.js');
      await handleUnmute(interaction);
      break;
      
    case 'ban':
      const { handleBan } = await import('./moderation.js');
      await handleBan(interaction);
      break;
    
    case 'help':
      await handleHelpCommand(interaction);
      break;
    
    case 'info':
      await handleInfoCommand(interaction, client);
      break;
    
    default:
      await interaction.reply({
        content: '⚠️ هذا الأمر غير معروف.',
        ephemeral: true
      });
  }
}

/**
 * معالجة الأزرار
 */
async function handleButton(interaction, client) {
  const { customId } = interaction;
  
  if (customId === 'close_ticket') {
    await closeTicket(interaction);
  }
  else if (customId.startsWith('start_quiz_')) {
    const quizId = customId.replace('start_quiz_', '');
    const { startQuiz } = await import('./quiz.js');
    await startQuiz(interaction, quizId);
  }
  else if (customId.startsWith('quiz_answer_')) {
    await submitQuizAnswer(interaction);
  }
  else {
    await interaction.reply({
      content: '⚠️ هذا الزر غير معروف.',
      ephemeral: true
    });
  }
}

/**
 * معالجة القوائم المنسدلة
 */
async function handleSelectMenu(interaction, client) {
  await interaction.reply({
    content: '⚠️ هذه القائمة غير مدعومة حالياً.',
    ephemeral: true
  });
}

/**
 * أمر إضافة درس
 */
async function handleAddLesson(interaction) {
  // التحقق من الصلاحيات (يتم التحقق من allowed_role في handleCommand)
  // إذا لم يتم تحديد allowed_role، يتم التحقق من الصلاحية الافتراضية
  if (!interaction.options.getRole('allowed_role')) {
    const isTeacher = interaction.member.roles.cache.some(
      role => role.name === process.env.TEACHER_ROLE_NAME
    );
    
    if (!isTeacher && !interaction.member.permissions.has('ManageMessages')) {
      return await interaction.reply({
        content: '⚠️ هذا الأمر متاح للمعلمين فقط!',
        ephemeral: true
      });
    }
  }
  
  const title = interaction.options.getString('title');
  const content = interaction.options.getString('content');
  const cron = interaction.options.getString('cron');
  const channel = interaction.options.getChannel('channel') || interaction.channel;
  
  // إضافة الدرس
  const lesson = addLesson(channel.id, title, content, cron);
  
  if (lesson) {
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('✅ تم إضافة الدرس بنجاح')
      .addFields(
        { name: '📚 العنوان', value: title },
        { name: '📝 المحتوى', value: content.substring(0, 100) + '...' },
        { name: '⏰ الجدولة', value: `\`${cron}\`` },
        { name: '📍 القناة', value: `${channel}` }
      )
      .setFooter({ text: 'سيتم نشر الدرس تلقائياً حسب الجدولة' })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    
    // إعادة تشغيل البوت لتطبيق الجدولة الجديدة
    await interaction.followUp({
      content: '⚠️ يُنصح بإعادة تشغيل البوت لتطبيق الجدولة الجديدة.',
      ephemeral: true
    });
  } else {
    await interaction.reply({
      content: '❌ فشل في إضافة الدرس. يرجى التحقق من البيانات.',
      ephemeral: true
    });
  }
}

/**
 * أمر إنشاء اختبار
 */
async function handleQuizCommand(interaction) {
  await interaction.deferReply(); // قد يستغرق وقتاً
  
  const topic = interaction.options.getString('topic');
  const questionsCount = interaction.options.getInteger('questions') || 5;
  const difficulty = interaction.options.getString('difficulty') || 'medium';
  
  await createQuiz(interaction, topic, questionsCount, difficulty);
}

/**
 * أمر عرض المستوى
 */
async function handleLevelCommand(interaction) {
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const userData = getUserXP(interaction.guild.id, targetUser.id);
  
  const embed = new EmbedBuilder()
    .setColor('#3498db')
    .setTitle(`📊 مستوى ${targetUser.username}`)
    .setThumbnail(targetUser.displayAvatarURL())
    .addFields(
      { name: '🎯 المستوى', value: `${userData.level}`, inline: true },
      { name: '⭐ XP الحالي', value: `${userData.xp}`, inline: true },
      { name: '💎 إجمالي XP', value: `${userData.totalXP}`, inline: true },
      { name: '💬 عدد الرسائل', value: `${userData.messageCount}`, inline: true }
    )
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed] });
}

/**
 * أمر لوحة الصدارة
 */
async function handleLeaderboardCommand(interaction) {
  const limit = interaction.options.getInteger('limit') || 10;
  const leaderboard = getLeaderboard(interaction.guild.id, limit);
  
  if (leaderboard.length === 0) {
    return await interaction.reply({
      content: '📊 لا توجد بيانات في لوحة الصدارة بعد!',
      ephemeral: true
    });
  }
  
  const description = leaderboard.map((user, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    return `${medal} <@${user.userId}> - المستوى **${user.level}** (${user.totalXP} XP)`;
  }).join('\n');
  
  const embed = new EmbedBuilder()
    .setColor('#f1c40f')
    .setTitle('🏆 لوحة الصدارة')
    .setDescription(description)
    .setFooter({ text: `أفضل ${leaderboard.length} مستخدمين` })
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed] });
}

/**
 * أمر إضافة XP
 */
async function handleAddXPCommand(interaction) {
  // التحقق من الصلاحيات (يتم التحقق من allowed_role في handleCommand)
  // إذا لم يتم تحديد allowed_role، يتم التحقق من الصلاحية الافتراضية
  if (!interaction.options.getRole('allowed_role')) {
    const isTeacher = interaction.member.roles.cache.some(
      role => role.name === process.env.TEACHER_ROLE_NAME
    );
    
    if (!isTeacher && !interaction.member.permissions.has('ManageMessages')) {
      return await interaction.reply({
        content: '⚠️ هذا الأمر متاح للمعلمين فقط!',
        ephemeral: true
      });
    }
  }
  
  const targetUser = interaction.options.getUser('user');
  const amount = interaction.options.getInteger('amount');
  
  const updatedData = addXPManually(interaction.guild.id, targetUser.id, amount);
  
  const embed = new EmbedBuilder()
    .setColor('#00ff00')
    .setTitle('✅ تم إضافة XP بنجاح')
    .setDescription(`تمت إضافة **${amount} XP** إلى ${targetUser}`)
    .addFields(
      { name: 'المستوى الحالي', value: `${updatedData.level}`, inline: true },
      { name: 'XP الحالي', value: `${updatedData.xp}`, inline: true },
      { name: 'إجمالي XP', value: `${updatedData.totalXP}`, inline: true }
    )
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed] });
}

/**
 * أمر المساعدة
 */
async function handleHelpCommand(interaction) {
  const commands = getCommandsList();
  
  const embed = new EmbedBuilder()
    .setColor('#3498db')
    .setTitle('📚 قائمة الأوامر')
    .setDescription('إليك جميع الأوامر المتاحة في البوت:')
    .setTimestamp();
  
  // تقسيم الأوامر حسب الفئة
  const userCommands = commands.filter(cmd => 
    ['ticket', 'level', 'leaderboard', 'help', 'info'].includes(cmd.name)
  );
  
  const teacherCommands = commands.filter(cmd => 
    ['addlesson', 'quiz', 'addxp'].includes(cmd.name)
  );
  
  if (userCommands.length > 0) {
    embed.addFields({
      name: '👥 أوامر الطلاب',
      value: userCommands.map(cmd => `\`/${cmd.name}\` - ${cmd.description}`).join('\n')
    });
  }
  
  if (teacherCommands.length > 0) {
    embed.addFields({
      name: '👨‍🏫 أوامر المعلمين',
      value: teacherCommands.map(cmd => `\`/${cmd.name}\` - ${cmd.description}`).join('\n')
    });
  }
  
  const moderationCommands = commands.filter(cmd => 
    ['setrole', 'removerole', 'mute', 'unmute', 'ban'].includes(cmd.name)
  );
  
  if (moderationCommands.length > 0) {
    embed.addFields({
      name: '🛡️ أوامر الإدارة',
      value: moderationCommands.map(cmd => `\`/${cmd.name}\` - ${cmd.description}`).join('\n')
    });
  }
  
  await interaction.reply({ embeds: [embed] });
}

/**
 * أمر معلومات البوت
 */
async function handleInfoCommand(interaction, client) {
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  
  const embed = new EmbedBuilder()
    .setColor('#9b59b6')
    .setTitle('🤖 معلومات البوت')
    .setThumbnail(client.user.displayAvatarURL())
    .addFields(
      { name: '📛 الاسم', value: client.user.username, inline: true },
      { name: '🆔 ID', value: client.user.id, inline: true },
      { name: '📊 السيرفرات', value: `${client.guilds.cache.size}`, inline: true },
      { name: '👥 المستخدمين', value: `${client.users.cache.size}`, inline: true },
      { name: '⏱️ وقت التشغيل', value: `${days}d ${hours}h ${minutes}m`, inline: true },
      { name: '🔧 الإصدار', value: 'v1.0.0', inline: true },
      { name: '📝 الوصف', value: 'بوت تعليمي متكامل لتدريس اللغة الإنجليزية مع نظام الدروس التلقائية، الاختبارات، والذكاء الاصطناعي.' }
    )
    .setFooter({ text: 'تم التطوير بواسطة Manus AI' })
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed] });
}
