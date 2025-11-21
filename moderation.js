import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';

/**
 * التحقق من صلاحيات المعلم/المدير
 * @param {object} interaction - تفاعل الأمر
 * @returns {boolean} - هل يمتلك الصلاحية
 */
function isModerator(interaction) {
  return interaction.member.permissions.has(PermissionFlagsBits.ManageRoles) || 
         interaction.member.roles.cache.some(r => r.name === process.env.TEACHER_ROLE_NAME);
}

/**
 * تعيين رتبة لعضو
 */
export async function handleSetRole(interaction) {
  if (!isModerator(interaction)) {
    return interaction.reply({ content: '⚠️ ليس لديك صلاحية لاستخدام هذا الأمر.', ephemeral: true });
  }

  const member = interaction.options.getMember('user');
  const role = interaction.options.getRole('role');

  if (!member || !role) {
    return interaction.reply({ content: '❌ يجب تحديد العضو والرتبة.', ephemeral: true });
  }

  try {
    await member.roles.add(role);
    await interaction.reply({
      content: `✅ تم تعيين رتبة **${role.name}** للعضو ${member}.`,
      ephemeral: true
    });
  } catch (error) {
    console.error('❌ خطأ في تعيين الرتبة:', error);
    await interaction.reply({ content: '❌ فشل في تعيين الرتبة. تأكد من أن رتبة البوت أعلى من الرتبة المراد منحها.', ephemeral: true });
  }
}

/**
 * إزالة رتبة من عضو
 */
export async function handleRemoveRole(interaction) {
  if (!isModerator(interaction)) {
    return interaction.reply({ content: '⚠️ ليس لديك صلاحية لاستخدام هذا الأمر.', ephemeral: true });
  }

  const member = interaction.options.getMember('user');
  const role = interaction.options.getRole('role');

  if (!member || !role) {
    return interaction.reply({ content: '❌ يجب تحديد العضو والرتبة.', ephemeral: true });
  }

  try {
    await member.roles.remove(role);
    await interaction.reply({
      content: `✅ تم إزالة رتبة **${role.name}** من العضو ${member}.`,
      ephemeral: true
    });
  } catch (error) {
    console.error('❌ خطأ في إزالة الرتبة:', error);
    await interaction.reply({ content: '❌ فشل في إزالة الرتبة. تأكد من أن رتبة البوت أعلى من الرتبة المراد إزالتها.', ephemeral: true });
  }
}

/**
 * كتم عضو (Mute)
 */
export async function handleMute(interaction) {
  if (!isModerator(interaction)) {
    return interaction.reply({ content: '⚠️ ليس لديك صلاحية لاستخدام هذا الأمر.', ephemeral: true });
  }

  const member = interaction.options.getMember('user');
  const reason = interaction.options.getString('reason') || 'لا يوجد سبب محدد';
  const duration = interaction.options.getInteger('duration') || 60; // الافتراضي 60 دقيقة

  if (!member) {
    return interaction.reply({ content: '❌ يجب تحديد العضو.', ephemeral: true });
  }

  try {
    // Discord uses milliseconds for timeout
    const timeoutDuration = duration * 60 * 1000; 
    await member.timeout(timeoutDuration, reason);

    const embed = new EmbedBuilder()
      .setColor('#f1c40f')
      .setTitle('🔇 تم كتم العضو')
      .setDescription(`${member} تم كتمه بنجاح.`)
      .addFields(
        { name: '⏱️ المدة', value: `${duration} دقيقة`, inline: true },
        { name: '📝 السبب', value: reason, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error('❌ خطأ في كتم العضو:', error);
    await interaction.reply({ content: '❌ فشل في كتم العضو. تأكد من أن رتبة البوت أعلى من رتبة العضو.', ephemeral: true });
  }
}

/**
 * إلغاء كتم عضو (Unmute)
 */
export async function handleUnmute(interaction) {
  if (!isModerator(interaction)) {
    return interaction.reply({ content: '⚠️ ليس لديك صلاحية لاستخدام هذا الأمر.', ephemeral: true });
  }

  const member = interaction.options.getMember('user');

  if (!member) {
    return interaction.reply({ content: '❌ يجب تحديد العضو.', ephemeral: true });
  }

  try {
    await member.timeout(null); // إلغاء الـ timeout

    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('🔊 تم إلغاء كتم العضو')
      .setDescription(`${member} تم إلغاء كتمه بنجاح.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error('❌ خطأ في إلغاء كتم العضو:', error);
    await interaction.reply({ content: '❌ فشل في إلغاء كتم العضو.', ephemeral: true });
  }
}

/**
 * تبنيد عضو (Ban)
 */
export async function handleBan(interaction) {
  if (!isModerator(interaction)) {
    return interaction.reply({ content: '⚠️ ليس لديك صلاحية لاستخدام هذا الأمر.', ephemeral: true });
  }

  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') || 'لا يوجد سبب محدد';

  if (!user) {
    return interaction.reply({ content: '❌ يجب تحديد العضو.', ephemeral: true });
  }

  try {
    await interaction.guild.members.ban(user, { reason });

    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setTitle('🔨 تم تبنيد العضو')
      .setDescription(`العضو **${user.tag}** تم تبنيده بنجاح.`)
      .addFields({ name: '📝 السبب', value: reason })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error('❌ خطأ في تبنيد العضو:', error);
    await interaction.reply({ content: '❌ فشل في تبنيد العضو. تأكد من أن رتبة البوت أعلى من رتبة العضو.', ephemeral: true });
  }
}
