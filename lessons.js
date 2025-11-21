import cron from 'node-cron';
import fs from 'fs';
import path from 'path';

const LESSONS_FILE = './data/lessons_db.json';

// تحميل الدروس من قاعدة البيانات
function loadLessons() {
  try {
    if (!fs.existsSync(LESSONS_FILE)) {
      // إنشاء ملف افتراضي إذا لم يكن موجوداً
      const defaultLessons = [
        {
          id: 1,
          channelId: process.env.LESSONS_CHANNEL_ID || '',
          title: 'درس القواعد الأسبوعي',
          text: '📚 **درس اليوم: Present Simple**\n\nنستخدم المضارع البسيط للتعبير عن:\n- الحقائق العامة\n- العادات والروتين\n- الجداول الزمنية\n\n**مثال:**\nI study English every day.\nShe works at a school.',
          cron: '0 9 * * 1',  // كل يوم اثنين الساعة 9 صباحاً
          active: true
        },
        {
          id: 2,
          channelId: process.env.LESSONS_CHANNEL_ID || '',
          title: 'مفردات الأسبوع',
          text: '📖 **مفردات هذا الأسبوع:**\n\n1. **Achieve** - يحقق\n2. **Challenge** - تحدي\n3. **Improve** - يحسّن\n4. **Knowledge** - معرفة\n5. **Practice** - يمارس\n\n💡 حاول استخدام هذه الكلمات في جمل!',
          cron: '0 10 * * 3',  // كل يوم أربعاء الساعة 10 صباحاً
          active: true
        }
      ];
      
      // إنشاء مجلد data إذا لم يكن موجوداً
      const dir = path.dirname(LESSONS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(LESSONS_FILE, JSON.stringify(defaultLessons, null, 2));
      return defaultLessons;
    }
    
    return JSON.parse(fs.readFileSync(LESSONS_FILE, 'utf8'));
  } catch (error) {
    console.error('❌ خطأ في تحميل الدروس:', error);
    return [];
  }
}

// حفظ الدروس
function saveLessons(lessons) {
  try {
    const dir = path.dirname(LESSONS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LESSONS_FILE, JSON.stringify(lessons, null, 2));
    return true;
  } catch (error) {
    console.error('❌ خطأ في حفظ الدروس:', error);
    return false;
  }
}

// جدولة الدروس التلقائية
export function scheduleLessons(client) {
  const lessons = loadLessons();
  let scheduledCount = 0;
  
  lessons.forEach(lesson => {
    if (!lesson.active || !lesson.channelId) return;
    
    try {
      // التحقق من صحة تعبير cron
      if (!cron.validate(lesson.cron)) {
        console.warn(`⚠️ تعبير cron غير صحيح للدرس ${lesson.id}: ${lesson.cron}`);
        return;
      }
      
      // جدولة الدرس
      cron.schedule(lesson.cron, async () => {
        try {
          const channel = await client.channels.fetch(lesson.channelId).catch(() => null);
          if (channel) {
            await channel.send({
              content: `## 🎓 ${lesson.title}\n\n${lesson.text}\n\n*تم النشر تلقائياً*`
            });
            console.log(`✅ تم نشر الدرس: ${lesson.title}`);
          } else {
            console.warn(`⚠️ لم يتم العثور على القناة: ${lesson.channelId}`);
          }
        } catch (error) {
          console.error(`❌ خطأ في نشر الدرس ${lesson.id}:`, error);
        }
      });
      
      scheduledCount++;
      console.log(`📅 تم جدولة الدرس: ${lesson.title} (${lesson.cron})`);
    } catch (error) {
      console.error(`❌ خطأ في جدولة الدرس ${lesson.id}:`, error);
    }
  });
  
  console.log(`✅ تم جدولة ${scheduledCount} درس تلقائي`);
}

// إضافة درس جديد
export function addLesson(channelId, title, text, cronExpression) {
  const lessons = loadLessons();
  const newId = lessons.length > 0 ? Math.max(...lessons.map(l => l.id)) + 1 : 1;
  
  const newLesson = {
    id: newId,
    channelId,
    title,
    text,
    cron: cronExpression,
    active: true,
    createdAt: new Date().toISOString()
  };
  
  lessons.push(newLesson);
  return saveLessons(lessons) ? newLesson : null;
}

// حذف درس
export function deleteLesson(lessonId) {
  const lessons = loadLessons();
  const filtered = lessons.filter(l => l.id !== lessonId);
  return saveLessons(filtered);
}

// الحصول على جميع الدروس
export function getAllLessons() {
  return loadLessons();
}
