import axios from 'axios';

/**
 * استدعاء الذكاء الاصطناعي للحصول على رد
 * @param {string} prompt - النص المطلوب معالجته
 * @param {object} options - خيارات إضافية
 * @returns {Promise<string>} - الرد من AI
 */
export async function callAI(prompt, options = {}) {
  const {
    maxTokens = 500,
    temperature = 0.7,
    model = process.env.AI_MODEL || 'gpt-4.1-mini'
  } = options;
  
  // التحقق من وجود مفتاح API
  if (!process.env.AI_API_KEY) {
    console.warn('⚠️ لم يتم تعيين AI_API_KEY - استخدام رد افتراضي');
    return 'شكراً لسؤالك! المعلم سيساعدك قريباً. 📚';
  }
  
  try {
    // استخدام OpenAI API
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: model,
        messages: [
          {
            role: 'system',
            content: 'أنت مساعد ذكاء اصطناعي متعدد المهام في سيرفر Discord. مهمتك هي الإجابة على أسئلة المستخدمين بجميع أنواعها (تعليمية، تقنية، عامة) بطريقة ودودة ومفيدة ومختصرة. يمكنك الرد باللغة العربية أو الإنجليزية حسب السؤال.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature: temperature
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.AI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 ثانية
      }
    );
    
    const aiReply = response.data.choices[0].message.content.trim();
    
    // تسجيل الاستخدام
    console.log(`🤖 AI Response - Tokens: ${response.data.usage?.total_tokens || 'N/A'}`);
    
    return aiReply;
    
  } catch (error) {
    console.error('❌ خطأ في استدعاء AI:', error.message);
    
    // رسائل خطأ مفصلة
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      
      if (error.response.status === 401) {
        return '❌ خطأ في المصادقة مع خدمة AI. يرجى التحقق من مفتاح API.';
      } else if (error.response.status === 429) {
        return '⏳ تم تجاوز حد الاستخدام. يرجى المحاولة بعد قليل.';
      }
    }
    
    return 'عذراً، حدث خطأ في الاتصال بالذكاء الاصطناعي. المعلم سيساعدك قريباً! 🙏';
  }
}

/**
 * توليد أسئلة اختبار باستخدام AI
 * @param {string} topic - موضوع الاختبار
 * @param {number} count - عدد الأسئلة
 * @param {string} difficulty - مستوى الصعوبة (easy, medium, hard)
 * @returns {Promise<Array>} - مصفوفة الأسئلة
 */
export async function generateQuizQuestions(topic, count = 5, difficulty = 'medium') {
  const prompt = `أنشئ ${count} أسئلة اختيار من متعدد (MCQ) عن موضوع: ${topic}

المستوى: ${difficulty === 'easy' ? 'سهل' : difficulty === 'medium' ? 'متوسط' : 'صعب'}

الصيغة المطلوبة (JSON):
[
  {
    "question": "نص السؤال",
    "options": ["خيار 1", "خيار 2", "خيار 3", "خيار 4"],
    "correct": 0,
    "explanation": "شرح الإجابة الصحيحة"
  }
]

ملاحظات:
- الأسئلة يجب أن تكون واضحة ومباشرة
- 4 خيارات لكل سؤال
- correct هو رقم الخيار الصحيح (0-3)
- قدم شرحاً مختصراً للإجابة

أرجع JSON فقط بدون أي نص إضافي.`;

  try {
    const response = await callAI(prompt, { maxTokens: 1500, temperature: 0.8 });
    
    // محاولة استخراج JSON من الرد
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const questions = JSON.parse(jsonMatch[0]);
      return questions;
    }
    
    throw new Error('لم يتم العثور على JSON في الرد');
    
  } catch (error) {
    console.error('❌ خطأ في توليد أسئلة الاختبار:', error);
    
    // أسئلة افتراضية في حالة الفشل
    return [
      {
        question: "What is the past tense of 'go'?",
        options: ["goed", "went", "gone", "going"],
        correct: 1,
        explanation: "الماضي من 'go' هو 'went' (فعل شاذ)"
      },
      {
        question: "Choose the correct sentence:",
        options: [
          "She don't like coffee",
          "She doesn't likes coffee",
          "She doesn't like coffee",
          "She not like coffee"
        ],
        correct: 2,
        explanation: "نستخدم doesn't مع الضمائر المفردة (he/she/it) والفعل يبقى في صيغته الأساسية"
      }
    ];
  }
}

/**
 * تصحيح إجابة نصية باستخدام AI
 * @param {string} question - السؤال
 * @param {string} studentAnswer - إجابة الطالب
 * @param {string} correctAnswer - الإجابة الصحيحة (اختياري)
 * @returns {Promise<object>} - نتيجة التصحيح
 */
export async function gradeAnswer(question, studentAnswer, correctAnswer = null) {
  const prompt = `قيّم إجابة الطالب التالية:

السؤال: ${question}
${correctAnswer ? `الإجابة الصحيحة: ${correctAnswer}` : ''}
إجابة الطالب: ${studentAnswer}

قدم تقييماً يتضمن:
1. هل الإجابة صحيحة؟ (نعم/لا/جزئياً)
2. الدرجة من 10
3. ملاحظات وتوجيهات للتحسين

أرجع JSON بالصيغة:
{
  "isCorrect": true/false,
  "score": 0-10,
  "feedback": "ملاحظاتك هنا"
}`;

  try {
    const response = await callAI(prompt, { maxTokens: 300 });
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return {
      isCorrect: false,
      score: 5,
      feedback: 'تم استلام إجابتك. سيقوم المعلم بمراجعتها.'
    };
    
  } catch (error) {
    console.error('❌ خطأ في تصحيح الإجابة:', error);
    return {
      isCorrect: false,
      score: 0,
      feedback: 'حدث خطأ في التصحيح التلقائي.'
    };
  }
}
