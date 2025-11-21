import fs from 'fs';
import { EmbedBuilder } from 'discord.js';

const XP_DB_FILE = './data/xp_db.json';
const COOLDOWNS = new Map(); // تخزين مؤقت للـ cooldown

// إعدادات نظام XP
const XP_CONFIG = {
  minXP: parseInt(process.env.XP_PER_MESSAGE_MIN) || 5,
  maxXP: parseInt(process.env.XP_PER_MESSAGE_MAX) || 15,
  cooldown: parseInt(process.env.XP_COOLDOWN_SECONDS) || 60, // ثانية
  levelMultiplier: 100, // XP مطلوب للمستوى التالي = level * multiplier
};

// مستويات الرتب
const RANK_LEVELS = [
  { level: 5, name: 'Beginner', color: '#95a5a6' },
  { level: 10, name: 'Student', color: '#3498db' },
  { level: 15, name: 'Scholar', color: '#9b59b6' },
  { level: 20, name: 'Expert', color: '#e67e22' },
  { level: 30, name: 'Master', color: '#e74c3c' },
  { level: 50, name: 'Legend', color: '#f1c40f' }
];

// تحميل قاعدة بيانات XP
function loadXPDB() {
  try {
    if (!fs.existsSync(XP_DB_FILE)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(XP_DB_FILE, 'utf8'));
  } catch (error) {
    console.error('❌ خطأ في تحميل قاعدة بيانات XP:', error);
    return {};
  }
}

// حفظ قاعدة بيانات XP
function saveXPDB(db) {
  try {
    const dir = './data';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(XP_DB_FILE, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error('❌ خطأ في حفظ قاعدة بيانات XP:', error);
  }
}

// حساب XP المطلوب للمستوى التالي
function getRequiredXP(level) {
  return level * XP_CONFIG.levelMultiplier;
}

// الحصول على معلومات الرتبة بناءً على المستوى
function getRankInfo(level) {
  for (let i = RANK_LEVELS.length - 1; i >= 0; i--) {
    if (level >= RANK_LEVELS[i].level) {
      return RANK_LEVELS[i];
    }
  }
  return null;
}

// منح XP وربما ترقية المستوى
export async function giveXPAndMaybeRank(message) {
  // تجاهل الرسائل في DM
  if (!message.guild) return;
  
  const userId = message.author.id;
  const guildId = message.guild.id;
  const cooldownKey = `${guildId}-${userId}`;
  
  // التحقق من cooldown
  const now = Date.now();
  const cooldownEnd = COOLDOWNS.get(cooldownKey);
  
  if (cooldownEnd && now < cooldownEnd) {
    return; // المستخدم في فترة cooldown
  }
  
  // تعيين cooldown جديد
  COOLDOWNS.set(cooldownKey, now + (XP_CONFIG.cooldown * 1000));
  
  // تحميل قاعدة البيانات
  const db = loadXPDB();
  
  // تهيئة السيرفر والمستخدم إذا لم يكن موجوداً
  if (!db[guildId]) {
    db[guildId] = {};
  }
  
  if (!db[guildId][userId]) {
    db[guildId][userId] = {
      xp: 0,
      level: 0,
      totalXP: 0,
      messageCount: 0,
      lastMessage: now
    };
  }
  
  const userData = db[guildId][userId];
  
  // حساب XP عشوائي
  const xpGained = Math.floor(
    Math.random() * (XP_CONFIG.maxXP - XP_CONFIG.minXP + 1) + XP_CONFIG.minXP
  );
  
  // إضافة XP
  userData.xp += xpGained;
  userData.totalXP += xpGained;
  userData.messageCount += 1;
  userData.lastMessage = now;
  
  // التحقق من الترقية
  const requiredXP = getRequiredXP(userData.level + 1);
  
  if (userData.xp >= requiredXP) {
    userData.level += 1;
    userData.xp -= requiredXP; // الباقي ينتقل للمستوى التالي
    
    // إنشاء رسالة الترقية
    const levelUpEmbed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('🎉 تهانينا! ترقية مستوى!')
      .setDescription(`${message.author} وصلت إلى **المستوى ${userData.level}**!`)
      .addFields(
        { name: '📊 XP الحالي', value: `${userData.xp}/${getRequiredXP(userData.level + 1)}`, inline: true },
        { name: '💬 عدد الرسائل', value: `${userData.messageCount}`, inline: true },
        { name: '⭐ إجمالي XP', value: `${userData.totalXP}`, inline: true }
      )
      .setTimestamp();
    
    // التحقق من الرتبة الجديدة
    const rankInfo = getRankInfo(userData.level);
    if (rankInfo) {
      levelUpEmbed.addFields({
        name: '🏆 الرتبة',
        value: rankInfo.name,
        inline: true
      });
      levelUpEmbed.setColor(rankInfo.color);
      
      // محاولة منح الرتبة في Discord
      try {
        const roleName = rankInfo.name;
        let role = message.guild.roles.cache.find(r => r.name === roleName);
        
        // إنشاء الرتبة إذا لم تكن موجودة
        if (!role) {
          role = await message.guild.roles.create({
            name: roleName,
            color: rankInfo.color,
            reason: `رتبة تلقائية للمستوى ${rankInfo.level}`
          });
          console.log(`✅ تم إنشاء رتبة جديدة: ${roleName}`);
        }
        
        // منح الرتبة للعضو
        if (role && !message.member.roles.cache.has(role.id)) {
          await message.member.roles.add(role);
          levelUpEmbed.addFields({
            name: '🎖️ رتبة جديدة',
            value: `تم منحك رتبة **${roleName}**!`
          });
        }
        
      } catch (error) {
        console.error('❌ خطأ في منح الرتبة:', error);
      }
    }
    
    // إرسال رسالة الترقية
    try {
      await message.channel.send({ embeds: [levelUpEmbed] });
    } catch (error) {
      console.error('❌ خطأ في إرسال رسالة الترقية:', error);
    }
  }
  
  // حفظ التغييرات
  saveXPDB(db);
}

// الحصول على معلومات مستخدم
export function getUserXP(guildId, userId) {
  const db = loadXPDB();
  
  if (!db[guildId] || !db[guildId][userId]) {
    return {
      xp: 0,
      level: 0,
      totalXP: 0,
      messageCount: 0
    };
  }
  
  return db[guildId][userId];
}

// الحصول على لوحة الصدارة
export function getLeaderboard(guildId, limit = 10) {
  const db = loadXPDB();
  
  if (!db[guildId]) {
    return [];
  }
  
  // تحويل إلى مصفوفة وترتيب حسب إجمالي XP
  const leaderboard = Object.entries(db[guildId])
    .map(([userId, data]) => ({
      userId,
      ...data
    }))
    .sort((a, b) => b.totalXP - a.totalXP)
    .slice(0, limit);
  
  return leaderboard;
}

// إعادة تعيين XP لمستخدم
export function resetUserXP(guildId, userId) {
  const db = loadXPDB();
  
  if (db[guildId] && db[guildId][userId]) {
    db[guildId][userId] = {
      xp: 0,
      level: 0,
      totalXP: 0,
      messageCount: 0,
      lastMessage: Date.now()
    };
    saveXPDB(db);
    return true;
  }
  
  return false;
}

// إضافة XP يدوياً (للمعلمين)
export function addXPManually(guildId, userId, amount) {
  const db = loadXPDB();
  
  if (!db[guildId]) {
    db[guildId] = {};
  }
  
  if (!db[guildId][userId]) {
    db[guildId][userId] = {
      xp: 0,
      level: 0,
      totalXP: 0,
      messageCount: 0,
      lastMessage: Date.now()
    };
  }
  
  db[guildId][userId].xp += amount;
  db[guildId][userId].totalXP += amount;
  
  saveXPDB(db);
  return db[guildId][userId];
}
