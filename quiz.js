import { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} from 'discord.js';
import { generateQuizQuestions } from './ai.js';
import fs from 'fs';

const QUIZ_FILE = './data/quiz_db.json';
const ACTIVE_QUIZZES = new Map(); // تخزين الاختبارات النشطة في الذاكرة

// تحميل قاعدة بيانات الاختبارات
function loadQuizDB() {
  try {
    if (!fs.existsSync(QUIZ_FILE)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(QUIZ_FILE, 'utf8'));
  } catch (error) {
    console.error('❌ خطأ في تحميل قاعدة بيانات الاختبارات:', error);
    return {};
  }
}

// حفظ قاعدة بيانات الاختبارات
function saveQuizDB(db) {
  try {
    const dir = './data';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(QUIZ_FILE, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error('❌ خطأ في حفظ قاعدة بيانات الاختبارات:', error);
  }
}

/**
 * إنشاء اختبار جديد
 */
export async function createQuiz(interaction, topic, questionsCount, difficulty) {
  try {
    // توليد الأسئلة باستخدام AI
    await interaction.editReply('🤖 جاري توليد الأسئلة باستخدام الذكاء الاصطناعي...');
    
    const questions = await generateQuizQuestions(topic, questionsCount, difficulty);
    
    if (!questions || questions.length === 0) {
      return await interaction.editReply('❌ فشل في توليد الأسئلة. يرجى المحاولة لاحقاً.');
    }
    
    // إنشاء معرف فريد للاختبار
    const quizId = `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // حفظ الاختبار
    const quizData = {
      id: quizId,
      topic,
      difficulty,
      questions,
      createdBy: interaction.user.id,
      createdAt: new Date().toISOString(),
      participants: {}
    };
    
    ACTIVE_QUIZZES.set(quizId, quizData);
    
    // حفظ في قاعدة البيانات
    const db = loadQuizDB();
    db[quizId] = quizData;
    saveQuizDB(db);
    
    // إنشاء رسالة الاختبار
    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setTitle(`📝 اختبار: ${topic}`)
      .setDescription(`**المستوى:** ${getDifficultyText(difficulty)}\n**عدد الأسئلة:** ${questions.length}\n\nاضغط على الزر أدناه لبدء الاختبار!`)
      .addFields(
        { name: '⏱️ الوقت المقدر', value: `${questions.length * 2} دقيقة`, inline: true },
        { name: '🎯 النجاح', value: '60% فأكثر', inline: true }
      )
      .setFooter({ text: `تم الإنشاء بواسطة ${interaction.user.username}` })
      .setTimestamp();
    
    const startButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`start_quiz_${quizId}`)
          .setLabel('ابدأ الاختبار')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('▶️')
      );
    
    await interaction.editReply({
      content: '@everyone اختبار جديد متاح الآن! 📚',
      embeds: [embed],
      components: [startButton]
    });
    
    console.log(`✅ تم إنشاء اختبار جديد: ${quizId} - ${topic}`);
    
  } catch (error) {
    console.error('❌ خطأ في إنشاء الاختبار:', error);
    await interaction.editReply('❌ حدث خطأ في إنشاء الاختبار.');
  }
}

/**
 * بدء الاختبار للمستخدم
 */
export async function startQuiz(interaction, quizId) {
  const quiz = ACTIVE_QUIZZES.get(quizId);
  
  if (!quiz) {
    return await interaction.reply({
      content: '❌ هذا الاختبار غير متاح أو انتهت صلاحيته.',
      ephemeral: true
    });
  }
  
  const userId = interaction.user.id;
  
  // التحقق من عدم بدء الاختبار مسبقاً
  if (quiz.participants[userId]) {
    return await interaction.reply({
      content: '⚠️ لقد أكملت هذا الاختبار بالفعل!',
      ephemeral: true
    });
  }
  
  // تهيئة بيانات المشارك
  quiz.participants[userId] = {
    username: interaction.user.username,
    currentQuestion: 0,
    answers: [],
    startedAt: new Date().toISOString(),
    score: 0
  };
  
  // إرسال السؤال الأول
  await sendQuestion(interaction, quiz, userId, 0);
}

/**
 * إرسال سؤال للمستخدم
 */
async function sendQuestion(interaction, quiz, userId, questionIndex) {
  const question = quiz.questions[questionIndex];
  const participant = quiz.participants[userId];
  
  const embed = new EmbedBuilder()
    .setColor('#3498db')
    .setTitle(`📝 السؤال ${questionIndex + 1}/${quiz.questions.length}`)
    .setDescription(question.question)
    .setFooter({ text: `الاختبار: ${quiz.topic}` })
    .setTimestamp();
  
  // إنشاء أزرار الخيارات
  const rows = [];
  const optionsPerRow = 2;
  
  for (let i = 0; i < question.options.length; i += optionsPerRow) {
    const row = new ActionRowBuilder();
    
    for (let j = i; j < Math.min(i + optionsPerRow, question.options.length); j++) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`quiz_answer_${quiz.id}_${questionIndex}_${j}`)
          .setLabel(question.options[j])
          .setStyle(ButtonStyle.Secondary)
      );
    }
    
    rows.push(row);
  }
  
  const replyOptions = {
    embeds: [embed],
    components: rows,
    ephemeral: true
  };
  
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(replyOptions);
  } else {
    await interaction.reply(replyOptions);
  }
}

/**
 * معالجة إجابة المستخدم
 */
export async function submitQuizAnswer(interaction) {
  const [, , quizId, questionIndexStr, answerIndexStr] = interaction.customId.split('_');
  const questionIndex = parseInt(questionIndexStr);
  const answerIndex = parseInt(answerIndexStr);
  
  const quiz = ACTIVE_QUIZZES.get(quizId);
  
  if (!quiz) {
    return await interaction.reply({
      content: '❌ هذا الاختبار غير متاح.',
      ephemeral: true
    });
  }
  
  const userId = interaction.user.id;
  const participant = quiz.participants[userId];
  
  if (!participant) {
    return await interaction.reply({
      content: '❌ لم تبدأ هذا الاختبار بعد.',
      ephemeral: true
    });
  }
  
  const question = quiz.questions[questionIndex];
  const isCorrect = answerIndex === question.correct;
  
  // حفظ الإجابة
  participant.answers.push({
    questionIndex,
    answer: answerIndex,
    correct: isCorrect,
    answeredAt: new Date().toISOString()
  });
  
  if (isCorrect) {
    participant.score++;
    
    // إضافة XP إذا كانت الإجابة صحيحة وفي اختبار يومي
    if (quiz.isDaily) {
      const { addXP } = await import('./xp.js');
      await addXP(interaction.member, 50); // 50 XP لكل إجابة صحيحة في الاختبار اليومي
    }
  }
  
  // إنشاء رسالة النتيجة
  const resultEmbed = new EmbedBuilder()
    .setColor(isCorrect ? '#00ff00' : '#ff0000')
    .setTitle(isCorrect ? '✅ إجابة صحيحة!' : '❌ إجابة خاطئة')
    .setDescription(question.explanation || (isCorrect ? 'أحسنت!' : `الإجابة الصحيحة: ${question.options[question.correct]}`))
    .setTimestamp();
  
  await interaction.update({
    embeds: [resultEmbed],
    components: []
  });
  
  // الانتقال للسؤال التالي أو إنهاء الاختبار
  const nextQuestionIndex = questionIndex + 1;
  
  if (nextQuestionIndex < quiz.questions.length) {
    // السؤال التالي
    participant.currentQuestion = nextQuestionIndex;
    
    setTimeout(async () => {
      await sendQuestion(interaction, quiz, userId, nextQuestionIndex);
    }, 2000);
    
  } else {
    // إنهاء الاختبار
    participant.completedAt = new Date().toISOString();
    
    setTimeout(async () => {
      await showQuizResults(interaction, quiz, userId);
    }, 2000);
  }
  
  // حفظ التحديثات
  const db = loadQuizDB();
  db[quizId] = quiz;
  saveQuizDB(db);
}

/**
 * عرض نتائج الاختبار
 */
async function showQuizResults(interaction, quiz, userId) {
  const participant = quiz.participants[userId];
  const totalQuestions = quiz.questions.length;
  const percentage = Math.round((participant.score / totalQuestions) * 100);
  const passed = percentage >= 60;
  
  const embed = new EmbedBuilder()
    .setColor(passed ? '#00ff00' : '#ff0000')
    .setTitle(passed ? '🎉 تهانينا! لقد نجحت!' : '😔 للأسف، لم تنجح هذه المرة')
    .setDescription(`**نتيجة الاختبار: ${quiz.topic}**`)
    .addFields(
      { name: '📊 النتيجة', value: `${participant.score}/${totalQuestions}`, inline: true },
      { name: '📈 النسبة المئوية', value: `${percentage}%`, inline: true },
      { name: '🎯 الحالة', value: passed ? 'ناجح ✅' : 'راسب ❌', inline: true }
    )
    .setFooter({ text: passed ? 'عمل رائع! استمر في التعلم!' : 'لا تستسلم! حاول مرة أخرى!' })
    .setTimestamp();
  
  await interaction.followUp({
    embeds: [embed],
    ephemeral: true
  });
  
  console.log(`✅ ${interaction.user.username} أكمل الاختبار ${quiz.id}: ${participant.score}/${totalQuestions} (${percentage}%)`);
}

/**
 * الحصول على نص مستوى الصعوبة
 */
function getDifficultyText(difficulty) {
  const levels = {
    easy: '🟢 سهل',
    medium: '🟡 متوسط',
    hard: '🔴 صعب'
  };
  return levels[difficulty] || levels.medium;
}

/**
 * الحصول على إحصائيات الاختبار
 */
export async function sendDailyQuiz(client) {
  const QUIZ_CHANNEL_ID = process.env.QUIZ_CHANNEL_ID;
  if (!QUIZ_CHANNEL_ID) {
    console.log('⚠️ لم يتم تحديد QUIZ_CHANNEL_ID في .env. سيتم تخطي الاختبار اليومي.');
    return;
  }

  try {
    const channel = await client.channels.fetch(QUIZ_CHANNEL_ID);
    if (!channel) {
      console.error(`❌ لم يتم العثور على قناة الاختبار بالـ ID: ${QUIZ_CHANNEL_ID}`);
      return;
    }

    // توليد اختبار يومي بموضوع عشوائي (يمكنك تخصيص الموضوع هنا)
    const dailyTopic = 'قواعد اللغة الإنجليزية الأساسية';
    const questionsCount = 3;
    const difficulty = 'easy';
    
    // توليد الأسئلة باستخدام AI
    const { generateQuizQuestions } = await import('./ai.js');
    const questions = await generateQuizQuestions(dailyTopic, questionsCount, difficulty);
    
    if (!questions || questions.length === 0) {
      console.log('❌ فشل في توليد اختبار يومي.');
      return;
    }
    
    // إنشاء معرف فريد للاختبار
    const quizId = `daily_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // حفظ الاختبار
    const quizData = {
      id: quizId,
      topic: dailyTopic,
      difficulty,
      questions,
      createdBy: 'Daily Bot',
      createdAt: new Date().toISOString(),
      participants: {},
      isDaily: true
    };
    
    ACTIVE_QUIZZES.set(quizId, quizData);
    
    // حفظ في قاعدة البيانات
    const db = loadQuizDB();
    db[quizId] = quizData;
    saveQuizDB(db);

    const embed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setTitle('📝 اختبار اليوم! (Daily Quiz)')
      .setDescription(`أهلاً بالجميع! إليكم اختبار اليوم في **${dailyTopic}**. أجب على الأسئلة للحصول على نقاط خبرة (XP)!`)
      .setFooter({ text: 'لديك 24 ساعة للإجابة!' })
      .setTimestamp();

    const startButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`start_quiz_${quizId}`)
          .setLabel('ابدأ الاختبار اليومي')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('▶️')
      );

    await channel.send({
      content: '@everyone اختبار يومي جديد متاح الآن! 📚',
      embeds: [embed],
      components: [startButton]
    });

    console.log(`✅ تم إرسال اختبار يومي جديد في القناة: ${channel.name}`);

  } catch (error) {
    console.error('❌ خطأ في إرسال الاختبار اليومي:', error);
  }
}

function getQuizStats(quizId) {
  const quiz = ACTIVE_QUIZZES.get(quizId);
  
  if (!quiz) {
    return null;
  }
  
  const participants = Object.values(quiz.participants);
  const completed = participants.filter(p => p.completedAt);
  
  return {
    totalParticipants: participants.length,
    completed: completed.length,
    averageScore: completed.length > 0 
      ? completed.reduce((sum, p) => sum + p.score, 0) / completed.length 
      : 0
  };
}
