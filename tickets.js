import { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder
} from 'discord.js';
import { callAI } from './ai.js';
import fs from 'fs';

const TICKETS_FILE = './data/tickets_db.json';

// تحميل التذاكر
function loadTickets() {
  try {
    if (!fs.existsSync(TICKETS_FILE)) return {};
    return JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8'));
  } catch (error) {
    console.error('❌ خطأ في تحميل التذاكر:', error);
    return {};
  }
}

// حفظ التذاكر
function saveTickets(tickets) {
  try {
    const dir = './data';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));
  } catch (error) {
    console.error('❌ خطأ في حفظ التذاكر:', error);
  }
}

// إعداد معالجات التذاكر
export async function setupTicketHandlers(client) {
  console.log('🎫 تم تفعيل نظام التذاكر');
  
  // معالجة الرسائل في قنوات التذاكر
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // التحقق من أن القناة هي تذكرة
    if (message.channel.name && message.channel.name.startsWith('ticket-')) {
      const tickets = loadTickets();
      const ticketId = message.channel.id;
      
      // إذا كانت التذكرة موجودة ومفعّل فيها AI
      if (tickets[ticketId] && tickets[ticketId].aiEnabled) {
        // تجاهل رسائل المعلمين
        const isTeacher = message.member.roles.cache.some(
          role => role.name === process.env.TEACHER_ROLE_NAME
        );
        
        if (!isTeacher) {
          // إظهار مؤشر الكتابة
          await message.channel.sendTyping();
          
          try {
            // الحصول على سياق المحادثة (آخر 5 رسائل)
            const messages = await message.channel.messages.fetch({ limit: 6 });
            const context = Array.from(messages.values())
              .reverse()
              .slice(0, 5)
              .map(m => `${m.author.bot ? 'المساعد' : 'الطالب'}: ${m.content}`)
              .join('\n');
            
              const aiPrompt = `أنت مساعد ذكاء اصطناعي متعدد المهام. ساعد الطالب بشكل ودود ومختصر.

سياق المحادثة:
${context}

رسالة الطالب الجديدة: ${message.content}

قدم إجابة مفيدة بالعربية والإنجليزية إذا لزم الأمر. كن مشجعاً ومختصراً.`;
            
            const reply = await callAI(aiPrompt);
            
            // إرسال الرد
            await message.reply({
              content: reply,
              allowedMentions: { repliedUser: true }
            });
            
            // تحديث آخر نشاط
            tickets[ticketId].lastActivity = new Date().toISOString();
            tickets[ticketId].messageCount = (tickets[ticketId].messageCount || 0) + 1;
            saveTickets(tickets);
            
          } catch (error) {
            console.error('❌ خطأ في الرد التلقائي:', error);
            await message.reply('عذراً، حدث خطأ في الرد التلقائي. سيساعدك المعلم قريباً! 🙏');
          }
        }
      }
    }
  });
}

// إنشاء تذكرة جديدة
export async function createTicket(interaction) {
  const guild = interaction.guild;
  const member = interaction.member;
  
  // التحقق من وجود تذكرة مفتوحة بالفعل
  const tickets = loadTickets();
  const existingTicket = Object.values(tickets).find(
    t => t.userId === member.id && t.status === 'open'
  );
  
  if (existingTicket) {
    return await interaction.reply({
      content: '⚠️ لديك تذكرة مفتوحة بالفعل! <#' + existingTicket.channelId + '>',
      ephemeral: true
    });
  }
  
  try {
    // إنشاء قناة التذكرة
    const ticketChannel = await guild.channels.create({
      name: `ticket-${member.user.username}`,
      type: ChannelType.GuildText,
      parent: interaction.channel.parent, // نفس الفئة
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        },
        {
          id: interaction.client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels
          ]
        }
      ]
    });
    
    // إضافة صلاحيات للمعلمين
    const teacherRole = guild.roles.cache.find(r => r.name === process.env.TEACHER_ROLE_NAME);
    if (teacherRole) {
      await ticketChannel.permissionOverwrites.create(teacherRole, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });
    }
    
    // إنشاء رسالة الترحيب
    const welcomeEmbed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('🎫 تذكرة دعم جديدة')
      .setDescription(`أهلاً ${member}!\n\nاكتب سؤالك أو مشكلتك هنا، وسيساعدك المساعد الذكي أو المعلم قريباً.`)
      .addFields(
        { name: '💡 نصيحة', value: 'كن واضحاً ومحدداً في سؤالك للحصول على أفضل مساعدة' },
        { name: '⏱️ وقت الاستجابة', value: 'عادةً خلال دقائق قليلة' }
      )
      .setTimestamp();
    
    const closeButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('إغلاق التذكرة')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒')
      );
    
    await ticketChannel.send({
      embeds: [welcomeEmbed],
      components: [closeButton]
    });
    
    // حفظ التذكرة في قاعدة البيانات
    tickets[ticketChannel.id] = {
      channelId: ticketChannel.id,
      userId: member.id,
      username: member.user.username,
      status: 'open',
      aiEnabled: true,
      createdAt: new Date().toISOString(),
      messageCount: 0
    };
    saveTickets(tickets);
    
    // الرد على التفاعل
    await interaction.reply({
      content: `✅ تم إنشاء تذكرتك! ${ticketChannel}`,
      ephemeral: true
    });
    
    console.log(`✅ تم إنشاء تذكرة جديدة: ${ticketChannel.name} للمستخدم ${member.user.tag}`);
    
  } catch (error) {
    console.error('❌ خطأ في إنشاء التذكرة:', error);
    await interaction.reply({
      content: '❌ حدث خطأ في إنشاء التذكرة. يرجى المحاولة لاحقاً.',
      ephemeral: true
    });
  }
}

// إغلاق تذكرة
export async function closeTicket(interaction) {
  const channel = interaction.channel;
  
  if (!channel.name.startsWith('ticket-')) {
    return await interaction.reply({
      content: '⚠️ هذه ليست قناة تذكرة!',
      ephemeral: true
    });
  }
  
  const tickets = loadTickets();
  const ticket = tickets[channel.id];
  
  if (ticket) {
    ticket.status = 'closed';
    ticket.closedAt = new Date().toISOString();
    ticket.closedBy = interaction.user.id;
    saveTickets(tickets);
  }
  
  await interaction.reply('🔒 سيتم إغلاق هذه التذكرة خلال 5 ثوانٍ...');
  
  setTimeout(async () => {
    try {
      await channel.delete();
      console.log(`✅ تم إغلاق التذكرة: ${channel.name}`);
    } catch (error) {
      console.error('❌ خطأ في حذف قناة التذكرة:', error);
    }
  }, 5000);
}
