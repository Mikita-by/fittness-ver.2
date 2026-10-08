// ==================== СОСТОЯНИЕ ====================
const KEYS = {
  meals: 'ft_meals', body: 'ft_body', settings: 'ft_settings',
  water: 'ft_water', streak: 'ft_streak', achievements: 'ft_ach',
  recipes: 'ft_recipes', fasting: 'ft_fasting', coach: 'ft_coach',
  challenges: 'ft_challenges', mission: 'ft_mission', steps: 'ft_steps'
};

const load = (k, def) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? def; }
  catch { return def; }
};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

let state = {
  meals: load(KEYS.meals, []),
  body: load(KEYS.body, []),
  settings: load(KEYS.settings, {}),
  water: load(KEYS.water, {}),
  streak: load(KEYS.streak, { current: 0, best: 0, lastDate: null }),
  achievements: load(KEYS.achievements, []),
  recipes: load(KEYS.recipes, []),
  fasting: load(KEYS.fasting, { active: false, start: null, hours: 16 }),
  coach: load(KEYS.coach, []),
  challenges: load(KEYS.challenges, { active: null, start: null }),
  mission: load(KEYS.mission, { date: null, text: null }),
  steps: load(KEYS.steps, {}),
  currentImage: null,
  charts: {}
};

const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
const esc = (s) => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };
const $ = (id) => document.getElementById(id);

// ==================== ТЕМА ====================
function applyTheme(theme) {
  const t = theme === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : theme;
  document.documentElement.setAttribute('data-theme', t);
  document.querySelector('meta[name="theme-color"]').setAttribute('content',
    t === 'light' ? '#f5f7fa' : t === 'pink' ? '#1a1218' : '#0f1115');
  if (state.settings.theme) save(KEYS.settings, state.settings);
}
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (state.settings.theme === 'auto') applyTheme('auto');
});

// ==================== НАВИГАЦИЯ ====================
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    $(tab.dataset.tab).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (tab.dataset.tab === 'progress') renderCharts();
    if (tab.dataset.tab === 'profile') renderProfile();
  });
});

// ==================== МОДАЛКИ ====================
document.querySelectorAll('.modal-close, [data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.close || btn.closest('.modal').id;
    $(id).classList.add('hidden');
    if (id === 'scannerModal') stopScanner();
  });
});
document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', (e) => {
    if (e.target === m) {
      m.classList.add('hidden');
      if (m.id === 'scannerModal') stopScanner();
    }
  });
});

// ==================== ОНБОРДИНГ ====================
let obSlide = 1;
const TOTAL_SLIDES = 5;
function showOnboarding() {
  $('onboarding').classList.remove('hidden');
  obSlide = 1;
  updateOnboarding();
}
function updateOnboarding() {
  document.querySelectorAll('.onboarding-slide').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.slide) === obSlide);
  });
  document.querySelectorAll('.onboarding-dots .dot').forEach((d, i) => {
    d.classList.toggle('active', i === obSlide - 1);
  });
  $('onboardingNext').textContent = obSlide === TOTAL_SLIDES ? 'Начать 🚀' : 'Далее';
}
$('onboardingNext').addEventListener('click', () => {
  if (obSlide < TOTAL_SLIDES) { obSlide++; updateOnboarding(); }
  else finishOnboarding();
});
$('onboardingSkip').addEventListener('click', finishOnboarding);
function finishOnboarding() {
  $('onboarding').classList.add('hidden');
  state.settings.onboarded = true;
  save(KEYS.settings, state.settings);
  if (!state.settings.name) setTimeout(() => openSettings(), 300);
}
document.querySelectorAll('.theme-option').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.theme-option').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.settings.theme = btn.dataset.themeChoice;
    applyTheme(btn.dataset.themeChoice);
  });
});

// ==================== НАСТРОЙКИ ====================
function openSettings() {
  const s = state.settings;
  $('userName').value = s.name || '';
  $('userAge').value = s.age || '';
  $('userSex').value = s.sex || 'male';
  $('userHeight').value = s.height || '';
  $('userWeight').value = s.weight || '';
  $('targetWeight').value = s.target || '';
  $('waterNorm').value = s.waterNorm || 2000;
  $('userActivity').value = s.activity || '1.55';
  $('userGoal').value = s.goal || 'lose';
  $('themeSelect').value = s.theme || 'dark';
  $('notificationsEnabled').checked = !!s.notifications;
  $('manualNorms').checked = !!s.manual;
  $('normCalories').value = s.normCalories || '';
  $('normProtein').value = s.normProtein || '';
  $('normFat').value = s.normFat || '';
  $('normCarbs').value = s.normCarbs || '';
  toggleManualBlock();
  updateAutoNormsPreview();
  $('settingsModal').classList.remove('hidden');
}
$('settingsBtn').addEventListener('click', openSettings);
$('openSettings2').addEventListener('click', openSettings);
$('closeSettings').addEventListener('click', () => $('settingsModal').classList.add('hidden'));

['userAge','userSex','userHeight','userWeight','userActivity','userGoal'].forEach(id => {
  $(id).addEventListener('input', updateAutoNormsPreview);
  $(id).addEventListener('change', updateAutoNormsPreview);
});
$('manualNorms').addEventListener('change', toggleManualBlock);
$('themeSelect').addEventListener('change', (e) => applyTheme(e.target.value));

function toggleManualBlock() {
  const on = $('manualNorms').checked;
  $('manualNormsBlock').classList.toggle('hidden', !on);
  $('autoNormsPreview').classList.toggle('hidden', on);
}

function calcNormsFromForm() {
  const age = +$('userAge').value;
  const sex = $('userSex').value;
  const height = +$('userHeight').value;
  const weight = +$('userWeight').value;
  const activity = +$('userActivity').value;
  const goal = $('userGoal').value;
  if (!age || !height || !weight) return null;
  const bmr = sex === 'male'
    ? 10*weight + 6.25*height - 5*age + 5
    : 10*weight + 6.25*height - 5*age - 161;
  let cal = bmr * activity;
  if (goal === 'lose') cal *= 0.80;
  if (goal === 'gain') cal *= 1.15;
  const protein = weight * 2;
  const fat = weight * 0.9;
  const carbs = Math.max(0, (cal - protein*4 - fat*9) / 4);
  return { calories: cal, protein, fat, carbs };
}

function updateAutoNormsPreview() {
  const n = calcNormsFromForm();
  const el = $('autoNormsText');
  if (!n) { el.textContent = 'заполните возраст, рост и вес'; el.style.color = 'var(--text-muted)'; return; }
  el.style.color = 'var(--accent)';
  el.textContent = `${Math.round(n.calories)} ккал · Б ${Math.round(n.protein)} г · Ж ${Math.round(n.fat)} г · У ${Math.round(n.carbs)} г`;
}

$('saveSettings').addEventListener('click', () => {
  const manual = $('manualNorms').checked;
  state.settings = {
    ...state.settings,
    name: $('userName').value.trim(),
    age: +$('userAge').value || null,
    sex: $('userSex').value,
    height: +$('userHeight').value || null,
    weight: +$('userWeight').value || null,
    target: +$('targetWeight').value || null,
    waterNorm: +$('waterNorm').value || 2000,
    activity: +$('userActivity').value || 1.55,
    goal: $('userGoal').value,
    theme: $('themeSelect').value,
    notifications: $('notificationsEnabled').checked,
    manual
  };
  if (manual) {
    state.settings.normCalories = +$('normCalories').value || null;
    state.settings.normProtein = +$('normProtein').value || null;
    state.settings.normFat = +$('normFat').value || null;
    state.settings.normCarbs = +$('normCarbs').value || null;
  } else {
    delete state.settings.normCalories;
    delete state.settings.normProtein;
    delete state.settings.normFat;
    delete state.settings.normCarbs;
  }
  save(KEYS.settings, state.settings);
  applyTheme(state.settings.theme || 'dark');
  $('settingsModal').classList.add('hidden');
  renderAll();
  if (state.settings.notifications) requestNotifications();
});

function getNorms() {
  const s = state.settings;
  if (s.manual && s.normCalories) {
    return { calories: s.normCalories, protein: s.normProtein || 0, fat: s.normFat || 0, carbs: s.normCarbs || 0 };
  }
  if (!s.age || !s.height || !s.weight) return null;
  const bmr = s.sex === 'female'
    ? 10*s.weight + 6.25*s.height - 5*s.age - 161
    : 10*s.weight + 6.25*s.height - 5*s.age + 5;
  let cal = bmr * (s.activity || 1.55);
  if (s.goal === 'lose') cal *= 0.80;
  if (s.goal === 'gain') cal *= 1.15;
  const protein = s.weight * 2;
  const fat = s.weight * 0.9;
  const carbs = Math.max(0, (cal - protein*4 - fat*9) / 4);
  return { calories: cal, protein, fat, carbs };
}

// ==================== ЭКСПОРТ / ИМПОРТ / СБРОС ====================
$('exportBtn').addEventListener('click', () => {
  const data = {
    meals: state.meals, body: state.body, settings: state.settings,
    water: state.water, streak: state.streak, achievements: state.achievements,
    recipes: state.recipes, coach: state.coach, challenges: state.challenges, steps: state.steps,
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fittrack-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

$('importBtn').addEventListener('click', () => $('importInput').click());
$('importInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!confirm('Заменить все текущие данные импортированными?')) return;
      Object.keys(data).forEach(k => { if (k in state) state[k] = data[k]; });
      save(KEYS.meals, state.meals);
      save(KEYS.body, state.body);
      save(KEYS.settings, state.settings);
      save(KEYS.water, state.water);
      save(KEYS.streak, state.streak);
      save(KEYS.achievements, state.achievements);
      save(KEYS.recipes, state.recipes);
      save(KEYS.coach, state.coach);
      save(KEYS.challenges, state.challenges);
      applyTheme(state.settings.theme || 'dark');
      renderAll();
      alert('Импорт успешно завершён!');
    } catch { alert('Ошибка чтения файла'); }
  };
  reader.readAsText(file);
});

$('resetBtn').addEventListener('click', () => {
  if (!confirm('Удалить ВСЕ данные? Это действие необратимо!')) return;
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  location.reload();
});

// ==================== SHARE ====================
$('shareBtn').addEventListener('click', async () => {
  const streak = state.streak.current;
  const weight = state.body[0]?.weight || state.settings.weight || '—';
  const totalMeals = state.meals.length;
  const text = `🌿 Мой прогресс в FitTrack\n🔥 Стрик: ${streak} дней\n⚖️ Вес: ${weight} кг\n🍎 Приёмов пищи: ${totalMeals}\n\nПопробуй и ты!`;
  if (navigator.share) {
    try { await navigator.share({ title: 'FitTrack', text }); } catch {}
  } else {
    await navigator.clipboard.writeText(text);
    alert('Прогресс скопирован в буфер обмена!');
  }
});

// ==================== ВОДА ====================
function getTodayWater() { return state.water[today()] || 0; }
function setTodayWater(ml) {
  state.water[today()] = Math.max(0, ml);
  save(KEYS.water, state.water);
  renderWater();
  checkAchievements();
}

document.querySelectorAll('.water-btn[data-ml]').forEach(b => {
  b.addEventListener('click', () => setTodayWater(getTodayWater() + (+b.dataset.ml)));
});
$('waterReset').addEventListener('click', () => setTodayWater(0));

function renderWater() {
  const norm = state.settings.waterNorm || 2000;
  const cur = getTodayWater();
  const pct = Math.min(100, (cur / norm) * 100);
  $('waterLabel').textContent = `${cur} / ${norm} мл`;
  const fill = $('waterBarFill');
  fill.style.width = pct + '%';
  fill.classList.toggle('over', cur > norm);

  const glasses = Math.floor(cur / 250);
  const glassesEl = $('waterGlasses');
  glassesEl.innerHTML = '';
  for (let i = 0; i < Math.min(glasses, 20); i++) {
    const span = document.createElement('span');
    span.className = 'water-glass';
    span.textContent = '💧';
    glassesEl.appendChild(span);
  }
}

// ==================== СТРИК ====================
function updateStreak() {
  const mealsByDay = new Set(state.meals.map(m => m.date.slice(0, 10)));
  if (!mealsByDay.has(today())) {
    // Сегодня ещё нет записей — проверяем, активен ли стрик
    const last = state.streak.lastDate;
    if (last) {
      const diff = Math.floor((new Date(today()) - new Date(last)) / 86400000);
      if (diff > 1) {
        state.streak.current = 0;
        save(KEYS.streak, state.streak);
      }
    }
    return;
  }
  const last = state.streak.lastDate;
  if (last === today()) return;

  if (!last) {
    state.streak.current = 1;
  } else {
    const diff = Math.floor((new Date(today()) - new Date(last)) / 86400000);
    state.streak.current = diff === 1 ? state.streak.current + 1 : 1;
  }
  state.streak.lastDate = today();
  state.streak.best = Math.max(state.streak.best || 0, state.streak.current);
  save(KEYS.streak, state.streak);
  checkAchievements();
}

function renderStreak() {
  const s = state.streak;
  $('streakDays').textContent = s.current || 0;
  $('streakBest').textContent = s.best || 0;
  const sub = $('streakSub');
  if (s.current === 0) { sub.textContent = 'Начните серию сегодня!'; $('streakLabel').textContent = 'дней подряд'; }
  else if (s.current === 1) { sub.textContent = 'Отличное начало!'; $('streakLabel').textContent = 'день подряд'; }
  else if (s.current < 5) { sub.textContent = 'Продолжайте, вы в ритме!'; $('streakLabel').textContent = 'дня подряд'; }
  else if (s.current < 14) { sub.textContent = 'Огонь 🔥 Так держать!'; $('streakLabel').textContent = 'дней подряд'; }
  else { sub.textContent = 'Вы легенда! 🏆'; $('streakLabel').textContent = 'дней подряд'; }
}

// ==================== ДОСТИЖЕНИЯ ====================
const ACHIEVEMENTS = [
  { id: 'first_meal', emoji: '🍎', name: 'Первый шаг', cond: () => state.meals.length >= 1 },
  { id: 'meals_10', emoji: '📝', name: '10 записей', cond: () => state.meals.length >= 10 },
  { id: 'meals_100', emoji: '💯', name: '100 записей', cond: () => state.meals.length >= 100 },
  { id: 'streak_3', emoji: '🔥', name: '3 дня подряд', cond: () => state.streak.best >= 3 },
  { id: 'streak_7', emoji: '⚡', name: 'Неделя силы', cond: () => state.streak.best >= 7 },
  { id: 'streak_30', emoji: '🏆', name: 'Месяц', cond: () => state.streak.best >= 30 },
  { id: 'water_2l', emoji: '💧', name: '2 литра', cond: () => getTodayWater() >= 2000 },
  { id: 'first_weight', emoji: '⚖️', name: 'Взвешивание', cond: () => state.body.length >= 1 },
  { id: 'weight_lost_1', emoji: '📉', name: '-1 кг', cond: () => getLost() >= 1 },
  { id: 'weight_lost_5', emoji: '🎉', name: '-5 кг', cond: () => getLost() >= 5 },
  { id: 'goal_reached', emoji: '🎯', name: 'Цель достигнута', cond: () => {
    const w = state.body[0]?.weight; return w && state.settings.target && w <= state.settings.target;
  }},
  { id: 'photo_ai', emoji: '📷', name: 'Фото-анализ', cond: () => state.meals.some(m => m.image) }
];

function getLost() {
  if (!state.body.length) return 0;
  const first = state.body[state.body.length - 1]?.weight;
  const last = state.body[0]?.weight;
  if (!first || !last) return 0;
  return Math.max(0, first - last);
}

function checkAchievements() {
  let unlocked = false;
  ACHIEVEMENTS.forEach(a => {
    if (!state.achievements.includes(a.id) && a.cond()) {
      state.achievements.push(a.id);
      unlocked = true;
    }
  });
  if (unlocked) {
    save(KEYS.achievements, state.achievements);
    renderAchievements();
    const last = ACHIEVEMENTS.filter(a => state.achievements.includes(a.id)).pop();
    if (last) showAchievementToast(last);
  }
}

function showAchievementToast(a) {
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `<div class="achievement-toast-emoji">${a.emoji}</div><div class="achievement-toast-text"><strong>Достижение!</strong><span>${a.name}</span></div>`;
  toast.style.cssText = `
    position:fixed;top:20px;left:50%;transform:translateX(-50%);
    background:var(--gradient);color:#0f1115;padding:14px 20px;border-radius:14px;
    display:flex;align-items:center;gap:12px;z-index:9999;
    box-shadow:0 8px 30px rgba(110,231,183,0.4);
    animation:slideDown 0.4s,slideUp 0.4s 3s forwards;font-weight:600;max-width:90vw;
  `;
  const emoji = toast.querySelector('.achievement-toast-emoji');
  emoji.style.fontSize = '28px';
  const text = toast.querySelector('.achievement-toast-text');
  text.style.display = 'flex';
  text.style.flexDirection = 'column';
  text.style.lineHeight = '1.2';
  toast.querySelector('strong').style.fontSize = '0.85rem';
  toast.querySelector('span').style.fontSize = '0.75rem';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function renderAchievements() {
  const grid = $('achievementsGrid');
  grid.innerHTML = ACHIEVEMENTS.map(a => {
    const unlocked = state.achievements.includes(a.id);
    return `<div class="achievement ${unlocked ? 'unlocked' : ''}" title="${a.name}">
      <span class="achievement-emoji">${a.emoji}</span>
      <span class="achievement-name">${a.name}</span>
    </div>`;
  }).join('');
  $('achievementsCount').textContent = `${state.achievements.length} / ${ACHIEVEMENTS.length}`;
}

// ==================== УРОВНИ ====================
const LEVELS = [
  { xp: 0, emoji: '🥉', name: 'Новичок' },
  { xp: 100, emoji: '🥈', name: 'Любитель' },
  { xp: 300, emoji: '🥇', name: 'Знаток' },
  { xp: 600, emoji: '💪', name: 'Спортсмен' },
  { xp: 1000, emoji: '🏆', name: 'Чемпион' },
  { xp: 2000, emoji: '👑', name: 'Легенда' }
];

function getXP() {
  const mealsXP = state.meals.length * 5;
  const weightXP = state.body.length * 10;
  const achXP = state.achievements.length * 25;
  const streakXP = (state.streak.best || 0) * 10;
  return mealsXP + weightXP + achXP + streakXP;
}

function renderLevel() {
  const xp = getXP();
  let lvl = LEVELS[0], next = LEVELS[1];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xp) {
      lvl = LEVELS[i];
      next = LEVELS[i + 1] || LEVELS[i];
      break;
    }
  }
  $('levelBadge').textContent = lvl.emoji;
  $('levelTitle').textContent = lvl.name;
  const rangeXP = next.xp - lvl.xp || 1;
  const inLvlXP = xp - lvl.xp;
  const pct = next === lvl ? 100 : Math.min(100, (inLvlXP / rangeXP) * 100);
  $('levelBar').style.width = pct + '%';
  $('levelSub').textContent = next === lvl
    ? `${xp} XP — максимум!`
    : `${inLvlXP} / ${rangeXP} XP`;
}

// ==================== ДНЕВНИК ====================
const fileInput = $('fileInput');
$('uploadArea').addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) { showAIStatus('❌ Фото больше 8 МБ', 'error'); return; }
  const reader = new FileReader();
  reader.onload = (ev) => {
    state.currentImage = ev.target.result;
    $('preview').src = ev.target.result;
    $('preview').classList.remove('hidden');
    $('uploadPlaceholder').classList.add('hidden');
    $('analyzeBtn').disabled = false;
    $('aiStatus').classList.add('hidden');
  };
  reader.readAsDataURL(file);
});

function showAIStatus(text, cls) {
  $('aiStatus').textContent = text;
  $('aiStatus').className = 'ai-status ' + (cls || '');
  $('aiStatus').classList.remove('hidden');
}

function extractJSON(text) {
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1) throw new Error('Неверный формат ответа');
  return JSON.parse(text.slice(first, last + 1));
}

async function askPuter(prompt, image = null) {
  if (typeof puter === 'undefined' || !puter.ai) throw new Error('ИИ-модуль не загружен');
  const args = [prompt];
  if (image) args.push(image);
  args.push({ model: 'google/gemini-3.8-flash' });
  const response = await puter.ai.chat(...args);
  let text = '';
  if (typeof response === 'string') text = response;
  else if (response?.message?.content) {
    const c = response.message.content;
    text = Array.isArray(c) ? c.map(x => x.text || '').join('') : c;
  } else if (response?.text) text = response.text;
  else text = String(response);
  return text;
}

$('analyzeBtn').addEventListener('click', async () => {
  const name = $('mealName').value.trim();
  const grams = +$('portion').value || null;
  if (!state.currentImage && !name) { showAIStatus('Загрузите фото или введите название', 'error'); return; }
  if (typeof puter === 'undefined' || !puter.ai) { showAIStatus('❌ ИИ-модуль не загрузился', 'error'); return; }

  showAIStatus(`🤖 Анализируем ${state.currentImage ? 'фото' : '«' + name + '»'}...`, 'loading');
  $('analyzeBtn').disabled = true;

  try {
    const portionLine = grams ? `Порция: ${grams} грамм. Рассчитай КБЖУ именно для этого количества.` : 'Если порция не указана, используй стандартную порцию 150-200 г.';
    const prompt = `Ты — нутрициолог. ${state.currentImage ? 'Проанализируй фото еды.' : `Пользователь указал: "${name}".`}
${portionLine}
Верни ТОЛЬКО валидный JSON без markdown:
{"dish_name":"название с граммовкой","calories":250,"proteins":10,"fats":8,"carbs":30}
Все числа целые. Если не распознал — нули.`;
    const text = await askPuter(prompt, state.currentImage);
    const data = extractJSON(text);

    $('mealName').value = data.dish_name || name || '';
    $('mCalories').value = Math.round(data.calories) || '';
    $('mProtein').value = Math.round(data.proteins) || '';
    $('mFat').value = Math.round(data.fats) || '';
    $('mCarbs').value = Math.round(data.carbs) || '';
    showAIStatus(`✅ ${data.dish_name || ''} — ${Math.round(data.calories) || 0} ккал. Проверьте и нажмите «Добавить без ИИ».`, '');
  } catch (err) {
    showAIStatus('❌ Ошибка: ' + (err.message || 'неизвестная'), 'error');
  } finally {
    $('analyzeBtn').disabled = false;
  }
});

$('addMealBtn').addEventListener('click', () => {
  const name = $('mealName').value.trim() || 'Приём пищи';
  const type = $('mealType').value;
  const portion = +$('portion').value || null;
  const calories = +$('mCalories').value || 0;
  const protein = +$('mProtein').value || 0;
  const fat = +$('mFat').value || 0;
  const carbs = +$('mCarbs').value || 0;
  const steps = +$('stepsInput').value || 0;

  if (!calories && !protein && !fat && !carbs && !state.currentImage) {
    showAIStatus('Заполните хотя бы калории или загрузите фото', 'error');
    return;
  }

  const meal = {
    id: Date.now(), name, type, portion, calories, protein, fat, carbs,
    image: state.currentImage, date: new Date().toISOString()
  };
  state.meals.unshift(meal);
  save(KEYS.meals, state.meals);

  if (steps > 0) {
    state.steps[today()] = steps;
    save(KEYS.steps, state.steps);
  }

  // Сброс
  $('mealName').value = '';
  $('mCalories').value = '';
  $('mProtein').value = '';
  $('mFat').value = '';
  $('mCarbs').value = '';
  $('portion').value = '';
  $('stepsInput').value = '';
  state.currentImage = null;
  $('preview').src = '';
  $('preview').classList.add('hidden');
  $('uploadPlaceholder').classList.remove('hidden');
  $('analyzeBtn').disabled = true;
  fileInput.value = '';
  $('aiStatus').classList.add('hidden');

  updateStreak();
  renderAll();
  showAIFeedback(meal);
});

function deleteMeal(id) {
  if (!confirm('Удалить эту запись?')) return;
  state.meals = state.meals.filter(m => m.id !== id);
  save(KEYS.meals, state.meals);
  renderAll();
}

function mealItemHTML(m, withDelete = true) {
  const thumb = m.image
    ? `<img src="${m.image}" class="meal-thumb" alt="">`
    : `<div class="meal-thumb-placeholder">🍽️</div>`;
  return `<div class="meal-item">
    ${thumb}
    <div class="meal-info">
      <div class="meal-name">${esc(m.name)}${m.portion ? ` · ${m.portion} г` : ''}</div>
      <div class="meal-type">${esc(m.type)}</div>
      <div class="meal-macros">
        <span>Б: ${Math.round(m.protein || 0)}г</span>
        <span>Ж: ${Math.round(m.fat || 0)}г</span>
        <span>У: ${Math.round(m.carbs || 0)}г</span>
      </div>
    </div>
    <div class="meal-cal">${Math.round(m.calories || 0)} ккал</div>
    ${withDelete ? `<button class="meal-delete" onclick="deleteMeal(${m.id})">✕</button>` : ''}
  </div>`;
}

function renderMeals() {
  const day = today();
  const meals = state.meals.filter(m => m.date.slice(0, 10) === day);
  const total = meals.reduce((s, m) => s + (m.calories || 0), 0);
  $('todayTotal').textContent = `${Math.round(total)} ккал`;
  const list = $('mealList');
  list.innerHTML = meals.length
    ? meals.map(m => mealItemHTML(m, true)).join('')
    : '<p class="empty">Ещё нет записей на сегодня</p>';
}

// ==================== ИИ-ФИДБЭК ПОСЛЕ ЕДЫ ====================
async function showAIFeedback(meal) {
  $('feedbackModal').classList.remove('hidden');
  $('feedbackContent').innerHTML = '<div class="spinner"></div><p>Анализируем приём пищи...</p>';
  try {
    const prompt = `Ты — дружелюбный нутрициолог. Пользователь записал приём пищи:
Название: ${meal.name}
Ккал: ${meal.calories}, Б: ${meal.protein}г, Ж: ${meal.fat}г, У: ${meal.carbs}г.
Дай КОРОТКИЙ отзыв (1-2 предложения) и один совет (1 предложение).
Ответь ТОЛЬКО JSON без markdown:
{"emoji":"подходящий эмодзи","title":"короткий заголовок (3-5 слов)","text":"отзыв одним предложением","tip":"совет одним предложением"}`;
    const text = await askPuter(prompt);
    const data = extractJSON(text);
    $('feedbackContent').innerHTML = `
      <span class="feedback-emoji">${data.emoji || '👍'}</span>
      <div class="feedback-title">${esc(data.title || 'Отлично!')}</div>
      <p>${esc(data.text || '')}</p>
      <div class="feedback-tip">💡 ${esc(data.tip || '')}</div>
    `;
  } catch (err) {
    $('feedbackContent').innerHTML = `<span class="feedback-emoji">👍</span><div class="feedback-title">Записано!</div><p>Запись добавлена в дневник.</p>`;
  }
}
$('feedbackClose').addEventListener('click', () => $('feedbackModal').classList.add('hidden'));

// ==================== ТЕЛО ====================
$('saveBodyBtn').addEventListener('click', () => {
  const weight = +$('bWeight').value;
  if (!weight) { alert('Введите вес'); return; }
  const entry = {
    id: Date.now(), date: new Date().toISOString(), weight,
    chest: +$('bChest').value || null,
    waist: +$('bWaist').value || null,
    hips: +$('bHips').value || null,
    arm: +$('bArm').value || null,
    leg: +$('bLeg').value || null
  };
  state.body.unshift(entry);
  save(KEYS.body, state.body);
  ['bWeight','bChest','bWaist','bHips','bArm','bLeg'].forEach(id => $(id).value = '');
  state.settings.weight = weight;
  save(KEYS.settings, state.settings);
  checkAchievements();
  renderAll();
});

function deleteBodyEntry(id) {
  if (!confirm('Удалить?')) return;
  state.body = state.body.filter(b => b.id !== id);
  save(KEYS.body, state.body);
  renderAll();
}

function renderBodyHistory() {
  const c = $('bodyHistory');
  if (!state.body.length) { c.innerHTML = '<p class="empty">Нет данных</p>'; return; }
  c.innerHTML = state.body.map(b => {
    const m = [];
    if (b.chest) m.push(`Грудь ${b.chest}`);
    if (b.waist) m.push(`Талия ${b.waist}`);
    if (b.hips) m.push(`Бёдра ${b.hips}`);
    if (b.arm) m.push(`Рука ${b.arm}`);
    if (b.leg) m.push(`Нога ${b.leg}`);
    return `<div class="body-entry">
      <div>
        <div class="body-entry-date">${fmtDate(b.date)}</div>
        <div class="body-entry-weight">${b.weight} кг</div>
        ${m.length ? `<div class="body-entry-measures">${m.join(' · ')}</div>` : ''}
      </div>
      <button class="body-entry-delete" onclick="deleteBodyEntry(${b.id})">✕</button>
    </div>`;
  }).join('');
}

// ==================== ГЛАВНЫЙ ЭКРАН ====================
function renderDashboard() {
  const day = today();
  const meals = state.meals.filter(m => m.date.slice(0, 10) === day);
  const totals = meals.reduce((acc, m) => ({
    calories: acc.calories + (m.calories || 0),
    protein: acc.protein + (m.protein || 0),
    fat: acc.fat + (m.fat || 0),
    carbs: acc.carbs + (m.carbs || 0)
  }), { calories: 0, protein: 0, fat: 0, carbs: 0 });

  const lastBody = state.body[0];
  const weight = lastBody?.weight || state.settings.weight || null;
  const bmi = weight && state.settings.height ? (weight / Math.pow(state.settings.height / 100, 2)).toFixed(1) : null;
  const norms = getNorms();

  const hour = new Date().getHours();
  const g = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  $('greeting').textContent = state.settings.name ? `${g}, ${state.settings.name}! 👋` : `${g}! 👋`;

  if (weight) {
    $('heroWeight').textContent = weight;
    $('heroTitle').textContent = 'Текущий вес';
    const diff = state.settings.target ? (weight - state.settings.target).toFixed(1) : null;
    $('heroSub').textContent = diff !== null
      ? (diff > 0 ? `Осталось сбросить: ${diff} кг` : '🎉 Цель достигнута!')
      : 'Укажите цель в настройках';
  } else {
    $('heroWeight').textContent = '—';
    $('heroTitle').textContent = 'Начнём путь к цели';
    $('heroSub').textContent = 'Добавьте первую запись веса';
  }

  // Кольцо калорий
  const RING = 314;
  $('ringValue').textContent = Math.round(totals.calories);
  if (norms && norms.calories) {
    const pct = Math.min(1, totals.calories / norms.calories);
    $('calorieRing').setAttribute('stroke-dashoffset', String(RING * (1 - pct)));
    $('calorieRing').setAttribute('stroke', totals.calories > norms.calories ? 'url(#ringGradOver)' : 'url(#ringGrad)');
    $('calorieNormLabel').textContent = `Норма: ${Math.round(norms.calories)} ккал`;
    const left = Math.round(norms.calories - totals.calories);
    const el = $('calorieLeftLabel');
    if (left > 50) { el.textContent = `Осталось ${left} ккал`; el.className = 'calorie-left'; $('calorieSubLabel').textContent = 'Можно ещё поесть 😊'; }
    else if (left > -50) { el.textContent = '🎯 В норме!'; el.className = 'calorie-left ok'; $('calorieSubLabel').textContent = 'Отличная работа сегодня!'; }
    else { el.textContent = `Перебор ${Math.abs(left)} ккал`; el.className = 'calorie-left over'; $('calorieSubLabel').textContent = 'Завтра сбалансируйте'; }
  } else {
    $('calorieRing').setAttribute('stroke-dashoffset', String(RING));
    $('calorieNormLabel').textContent = 'Норма: —';
    $('calorieLeftLabel').textContent = '—';
    $('calorieLeftLabel').className = 'calorie-left';
    $('calorieSubLabel').textContent = 'Заполните профиль';
  }

  // Статистика
  $('statBMI').textContent = bmi || '—';
  $('statCalories').textContent = Math.round(totals.calories);
  $('statMeals').textContent = meals.length;
  $('statRemaining').textContent = (state.settings.target && weight) ? (weight - state.settings.target).toFixed(1) : '—';

  // Макросы
  updateMacro('protein', totals.protein, norms?.protein);
  updateMacro('fat', totals.fat, norms?.fat);
  updateMacro('carbs', totals.carbs, norms?.carbs);

  renderWater();
  renderStreak();
  renderMission();
  renderRecommendation(totals, norms);
  renderMotivation(totals, norms, meals.length);

  const recent = state.meals.slice(0, 3);
  $('recentMeals').innerHTML = recent.length
    ? recent.map(m => mealItemHTML(m, false)).join('')
    : '<p class="empty">Пока ничего не добавлено</p>';
}

function updateMacro(key, current, goal) {
  const cur = Math.round(current);
  $(key + 'Now').textContent = cur;
  if (!goal) {
    $(key + 'Goal').textContent = '—';
    $(key + 'Bar').style.width = '0%';
    $(key + 'Hint').textContent = '—';
    $(key + 'Hint').className = 'macro-hint';
    return;
  }
  $(key + 'Goal').textContent = Math.round(goal);
  const pct = Math.min(100, (current / goal) * 100);
  $(key + 'Bar').style.width = pct + '%';
  $(key + 'Bar').classList.toggle('over', current > goal);
  const left = Math.round(goal - current);
  const hint = $(key + 'Hint');
  if (left > 5) { hint.textContent = `Добрать ${left} г`; hint.className = 'macro-hint'; }
  else if (left > -5) { hint.textContent = '✅ Норма достигнута'; hint.className = 'macro-hint ok'; }
  else { hint.textContent = `Перебор на ${Math.abs(left)} г`; hint.className = 'macro-hint over'; }
}

function renderMotivation(totals, norms, mealCount) {
  let emoji = '🌱', text = 'Сегодня — отличный день, чтобы начать!', variant = '';
  if (!norms) { emoji = '⚙️'; text = 'Заполните профиль в настройках, чтобы видеть нормы'; }
  else if (mealCount === 0) { emoji = '☀️'; text = 'Новый день — чистый лист. Добавьте первый приём пищи!'; }
  else if (totals.calories > norms.calories * 1.15) { emoji = '🌊'; text = 'Сегодня перебор. Ничего страшного — завтра сбалансируем!'; variant = 'warn'; }
  else if (Math.abs(totals.calories - norms.calories) < norms.calories * 0.05 && Math.abs(totals.protein - norms.protein) < norms.protein * 0.1) {
    emoji = '🏆'; text = 'Идеальный день! Калории и белки в норме!'; variant = 'good';
  }
  else if (totals.calories < norms.calories * 0.5) { emoji = '🍽️'; text = 'Вы сегодня мало ели. Не забывайте про питание!'; }
  else { emoji = '💪'; text = 'Хороший темп! Продолжайте в том же духе.'; }
  $('motivationEmoji').textContent = emoji;
  $('motivationText').textContent = text;
  const c = $('motivationCard');
  c.classList.remove('warn', 'good');
  if (variant) c.classList.add(variant);
}

function renderRecommendation(totals, norms) {
  const box = $('recommendation');
  if (!norms) { box.innerHTML = '<p class="empty">Заполните профиль в настройках</p>'; return; }
  const left = {
    calories: Math.round(norms.calories - totals.calories),
    protein: Math.round(norms.protein - totals.protein),
    fat: Math.round(norms.fat - totals.fat),
    carbs: Math.round(norms.carbs - totals.carbs)
  };
  const items = [];
  if (left.calories > 200) items.push({ icon: '🔥', text: `Не хватает <strong>${left.calories} ккал</strong>. Добавьте ещё приём пищи.` });
  else if (left.calories > 50) items.push({ icon: '🔥', text: `Осталось <strong>${left.calories} ккал</strong> — можно перекусить.` });
  else if (left.calories >= -50) items.push({ icon: '🎯', text: 'Калории в норме — отличная работа!' });
  else items.push({ icon: '⚠️', text: `Перебор на <strong>${Math.abs(left.calories)} ккал</strong>.` });

  if (left.protein > 20) items.push({ icon: '🥩', text: `Добрать <strong>${left.protein} г белка</strong>: курица, рыба, творог.` });
  else if (left.protein > 5) items.push({ icon: '🥩', text: `Ещё <strong>${left.protein} г белка</strong> — 100 г творога.` });
  if (left.fat > 15) items.push({ icon: '🥑', text: `Добрать <strong>${left.fat} г жиров</strong>: орехи, авокадо.` });
  else if (left.fat > 5) items.push({ icon: '🥑', text: `Ещё <strong>${left.fat} г жиров</strong> — горсть орехов.` });
  else if (left.fat < -15) items.push({ icon: '⚠️', text: `Много жиров (${Math.abs(left.fat)} г). Уменьшите.` });
  if (left.carbs > 40) items.push({ icon: '🍞', text: `Добрать <strong>${left.carbs} г углеводов</strong>: крупы, овощи.` });
  else if (left.carbs > 15) items.push({ icon: '🍞', text: `Ещё <strong>${left.carbs} г углеводов</strong> — яблоко.` });
  if (!items.length) items.push({ icon: '✅', text: 'Всё в норме — вы молодец!' });
  box.innerHTML = items.map(i => `<div class="rec-item"><span class="rec-icon">${i.icon}</span><span class="rec-text">${i.text}</span></div>`).join('');
}

// ==================== МИССИЯ ДНЯ ====================
function renderMission() {
  const m = state.mission;
  if (m.date === today() && m.text) {
    $('missionText').textContent = m.text;
  } else if (!m.text) {
    $('missionText').textContent = 'Нажмите 🔄, чтобы получить миссию от ИИ';
  } else {
    $('missionText').textContent = 'Нажмите 🔄, чтобы получить миссию на сегодня';
  }
}

$('missionRefresh').addEventListener('click', async () => {
  const btn = $('missionRefresh');
  btn.classList.add('loading');
  $('missionText').textContent = '🤖 Генерируем миссию...';
  try {
    const norms = getNorms();
    const weight = state.body[0]?.weight || state.settings.weight || '—';
    const context = `Пользователь: ${state.settings.name || 'без имени'}.
Цель: ${state.settings.goal || 'похудение'}. Вес: ${weight} кг.
Норма: ${norms ? Math.round(norms.calories) + ' ккал' : 'не задана'}.
Дай одну конкретную миссию на сегодня (1 предложение, максимум 15 слов, мотивирующую, измеримую). 
Например: «Выпей 2 литра воды и добавь 150 г овощей к обеду».
Только текст миссии, без кавычек и пояснений.`;
    const text = await askPuter(context);
    const clean = text.trim().replace(/^["«]|["»]$/g, '').slice(0, 200);
    state.mission = { date: today(), text: clean };
    save(KEYS.mission, state.mission);
    $('missionText').textContent = clean;
  } catch {
    $('missionText').textContent = 'Не удалось получить миссию. Попробуйте ещё раз.';
  } finally {
    btn.classList.remove('loading');
  }
});

// ==================== СКАНЕР ШТРИХ-КОДА ====================
let codeReader = null;
$('openScanner').addEventListener('click', startScanner);

async function startScanner() {
  $('scannerModal').classList.remove('hidden');
  $('scannerResult').classList.add('hidden');
  if (typeof ZXing === 'undefined') {
    $('scannerResult').innerHTML = '❌ Модуль сканера не загрузился';
    $('scannerResult').classList.remove('hidden');
    return;
  }
  try {
    codeReader = new ZXing.BrowserMultiFormatReader();
    codeReader.decodeFromVideoDevice(null, 'scannerVideo', (result, err) => {
      if (result) {
        handleBarcode(result.text);
        stopScanner();
      }
    });
  } catch (e) {
    $('scannerResult').innerHTML = '❌ Не удалось включить камеру: ' + e.message;
    $('scannerResult').classList.remove('hidden');
  }
}

function stopScanner() {
  if (codeReader) { try { codeReader.reset(); } catch {} codeReader = null; }
}

async function handleBarcode(code) {
  $('scannerResult').innerHTML = '<div class="spinner"></div>Ищем продукт...';
  $('scannerResult').classList.remove('hidden');
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
    const data = await res.json();
    if (data.status !== 1) {
      $('scannerResult').innerHTML = `❌ Продукт с кодом ${code} не найден в базе`;
      return;
    }
    const p = data.product;
    const n = p.nutriments || {};
    const name = p.product_name_ru || p.product_name || 'Без названия';
    const cal = Math.round(n['energy-kcal_100g'] || 0);
    const prot = Math.round(n.proteins_100g || 0);
    const fat = Math.round(n.fat_100g || 0);
    const carbs = Math.round(n.carbohydrates_100g || 0);

    $('scannerResult').innerHTML = `
      <div style="font-weight:700;margin-bottom:8px">${esc(name)}</div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:10px">На 100 г продукта</div>
      <div>🔥 <strong>${cal}</strong> ккал</div>
      <div>🥩 Б: <strong>${prot}</strong> г · 🥑 Ж: <strong>${fat}</strong> г · 🍞 У: <strong>${carbs}</strong> г</div>
      <button id="useScanned" class="btn-primary full" style="margin-top:12px">Использовать</button>
    `;
    setTimeout(() => {
      const btn = $('useScanned');
      if (btn) btn.addEventListener('click', () => {
        $('mealName').value = name;
        $('portion').value = 100;
        $('mCalories').value = cal;
        $('mProtein').value = prot;
        $('mFat').value = fat;
        $('mCarbs').value = carbs;
        $('scannerModal').classList.add('hidden');
        document.querySelector('.tab[data-tab="diary"]').click();
      });
    }, 50);
  } catch (e) {
    $('scannerResult').innerHTML = '❌ Ошибка запроса: ' + e.message;
  }
}

// ==================== РЕЦЕПТЫ ====================
$('openRecipes').addEventListener('click', () => {
  renderRecipes();
  $('recipesModal').classList.remove('hidden');
});

$('saveRecipeBtn').addEventListener('click', () => {
  const name = $('recipeName').value.trim();
  if (!name) { alert('Введите название'); return; }
  state.recipes.unshift({
    id: Date.now(), name,
    calories: +$('recipeCal').value || 0,
    protein: +$('recipeProt').value || 0,
    fat: +$('recipeFat').value || 0,
    carbs: +$('recipeCarbs').value || 0
  });
  save(KEYS.recipes, state.recipes);
  ['recipeName','recipeCal','recipeProt','recipeFat','recipeCarbs'].forEach(id => $(id).value = '');
  renderRecipes();
});

function renderRecipes() {
  const c = $('recipesList');
  if (!state.recipes.length) { c.innerHTML = '<p class="empty">Рецептов пока нет</p>'; return; }
  c.innerHTML = state.recipes.map(r => `
    <div class="recipe-item">
      <div class="recipe-item-info">
        <div class="recipe-item-name">${esc(r.name)}</div>
        <div class="recipe-item-macros">${r.calories} ккал · Б ${r.protein} · Ж ${r.fat} · У ${r.carbs}</div>
      </div>
      <div class="recipe-item-actions">
        <button class="recipe-item-btn add" onclick="addRecipeToDiary(${r.id})" title="Добавить">➕</button>
        <button class="recipe-item-btn" onclick="deleteRecipe(${r.id})" title="Удалить">🗑️</button>
      </div>
    </div>
  `).join('');
}

function addRecipeToDiary(id) {
  const r = state.recipes.find(x => x.id === id);
  if (!r) return;
  state.meals.unshift({
    id: Date.now(), name: r.name, type: 'Перекус', portion: null,
    calories: r.calories, protein: r.protein, fat: r.fat, carbs: r.carbs,
    image: null, date: new Date().toISOString()
  });
  save(KEYS.meals, state.meals);
  updateStreak();
  $('recipesModal').classList.add('hidden');
  renderAll();
}

function deleteRecipe(id) {
  state.recipes = state.recipes.filter(r => r.id !== id);
  save(KEYS.recipes, state.recipes);
  renderRecipes();
}

// ==================== ГОЛОДАНИЕ ====================
let fastingInterval = null;
$('openFasting').addEventListener('click', () => {
  $('fastingModal').classList.remove('hidden');
  renderFasting();
  if (state.fasting.active) startFastingTick();
});

document.querySelectorAll('.scheme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.scheme-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.fasting.hours = +btn.dataset.hours;
    if (!state.fasting.active) save(KEYS.fasting, state.fasting);
    renderFasting();
  });
});

$('fastingToggle').addEventListener('click', () => {
  if (state.fasting.active) {
    state.fasting.active = false;
    state.fasting.start = null;
    stopFastingTick();
  } else {
    state.fasting.active = true;
    state.fasting.start = Date.now();
    startFastingTick();
  }
  save(KEYS.fasting, state.fasting);
  renderFasting();
});

$('fastingReset').addEventListener('click', () => {
  state.fasting = { active: false, start: null, hours: state.fasting.hours || 16 };
  save(KEYS.fasting, state.fasting);
  stopFastingTick();
  renderFasting();
});

function startFastingTick() {
  stopFastingTick();
  fastingInterval = setInterval(renderFasting, 1000);
}

function stopFastingTick() {
  if (fastingInterval) clearInterval(fastingInterval);
  fastingInterval = null;
}

function renderFasting() {
  const f = state.fasting;
  document.querySelectorAll('.scheme-btn').forEach(b => {
    b.classList.toggle('active', +b.dataset.hours === f.hours);
  });

  if (!f.active || !f.start) {
    $('fastingTime').textContent = '00:00:00';
    $('fastingLabel').textContent = 'Не активно';
    $('fastingToggle').textContent = '▶ Начать голодание';
    $('fastingReset').classList.add('hidden');
    $('fastingRing').setAttribute('stroke-dashoffset', '0');
    $('fastingInfo').textContent = `Выберите схему и нажмите «Начать». Длительность: ${f.hours} ч.`;
    return;
  }

  const elapsed = Date.now() - f.start;
  const totalMs = f.hours * 3600 * 1000;
  const remaining = Math.max(0, totalMs - elapsed);

  const h = Math.floor(elapsed / 3600000);
  const m = Math.floor((elapsed % 3600000) / 60000);
  const s = Math.floor((elapsed % 60000) / 1000);
  $('fastingTime').textContent =
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  if (remaining === 0) {
    $('fastingLabel').textContent = '🎉 Готово!';
    $('fastingInfo').textContent = `Вы продержались ${f.hours} часов! Можно есть.`;
    $('fastingRing').setAttribute('stroke-dashoffset', '0');
  } else {
    $('fastingLabel').textContent = `Осталось ${Math.floor(remaining / 3600000)}ч ${Math.floor((remaining % 3600000) / 60000)}м`;
    const RING = 314;
    const pct = elapsed / totalMs;
    $('fastingRing').setAttribute('stroke-dashoffset', String(RING * (1 - pct)));
  }
  $('fastingToggle').textContent = '⏸ Остановить';
  $('fastingReset').classList.remove('hidden');
}

// ==================== ИИ-ТРЕНЕР ====================
$('coachBtn').addEventListener('click', () => {
  $('coachModal').classList.remove('hidden');
  renderCoach();
});
document.querySelectorAll('.quick-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    $('coachInput').value = chip.dataset.prompt;
    sendCoachMessage();
  });
});
$('coachSend').addEventListener('click', sendCoachMessage);
$('coachInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendCoachMessage();
});

function renderCoach() {
  const box = $('coachMessages');
  if (!state.coach.length) {
    box.innerHTML = `<div class="coach-msg bot"><div class="coach-msg-content">Привет! Я твой личный ИИ-тренер. Спроси меня о питании, тренировках или попроси совет. 💪</div></div>`;
    return;
  }
  box.innerHTML = state.coach.map(m =>
    `<div class="coach-msg ${m.role}"><div class="coach-msg-content">${esc(m.text)}</div></div>`
  ).join('');
  box.scrollTop = box.scrollHeight;
}

async function sendCoachMessage() {
  const input = $('coachInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  state.coach.push({ role: 'user', text });
  save(KEYS.coach, state.coach);
  renderCoach();

  const box = $('coachMessages');
  const loadingEl = document.createElement('div');
  loadingEl.className = 'coach-msg bot';
  loadingEl.id = 'coachLoading';
  loadingEl.innerHTML = '<div class="coach-msg-content"><div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0"></div></div>';
  box.appendChild(loadingEl);
  box.scrollTop = box.scrollHeight;

  try {
    const norms = getNorms();
    const day = today();
    const dayMeals = state.meals.filter(m => m.date.slice(0, 10) === day);
    const totals = dayMeals.reduce((a, m) => ({
      calories: a.calories + (m.calories || 0),
      protein: a.protein + (m.protein || 0),
      fat: a.fat + (m.fat || 0),
      carbs: a.carbs + (m.carbs || 0)
    }), { calories: 0, protein: 0, fat: 0, carbs: 0 });

    const context = `Ты — дружелюбный ИИ-тренер по питанию в приложении FitTrack.
Данные пользователя:
Имя: ${state.settings.name || '—'}
Цель: ${state.settings.goal || '—'}
Вес: ${state.body[0]?.weight || state.settings.weight || '—'} кг
Рост: ${state.settings.height || '—'} см
Норма: ${norms ? Math.round(norms.calories) + ' ккал (Б ' + Math.round(norms.protein) + 'г, Ж ' + Math.round(norms.fat) + 'г, У ' + Math.round(norms.carbs) + 'г)' : 'не задана'}
Сегодня съедено: ${Math.round(totals.calories)} ккал (Б ${Math.round(totals.protein)}г, Ж ${Math.round(totals.fat)}г, У ${Math.round(totals.carbs)}г)
Приёмов пищи сегодня: ${dayMeals.length}

Отвечай коротко (2-4 предложения), дружелюбно, с конкретными советами. Без markdown.`;

    const history = state.coach.slice(-8).map(m => `${m.role === 'user' ? 'Пользователь' : 'Тренер'}: ${m.text}`).join('\n');
    const fullPrompt = `${context}\n\nИстория диалога:\n${history}\n\nОтветь на последнее сообщение пользователя.`;
    const reply = await askPuter(fullPrompt);
    const clean = (typeof reply === 'string' ? reply : String(reply)).trim();

    state.coach.push({ role: 'bot', text: clean });
    save(KEYS.coach, state.coach);
    renderCoach();
  } catch (e) {
    state.coach.push({ role: 'bot', text: '❌ Ошибка: ' + (e.message || 'неизвестная') });
    save(KEYS.coach, state.coach);
    renderCoach();
  } finally {
    const l = $('coachLoading');
    if (l) l.remove();
  }
}

// ==================== ЧЕЛЛЕНДЖИ ====================
document.querySelectorAll('.challenge-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const days = +chip.dataset.days;
    if (state.challenges.active) {
      if (!confirm('Начать новый челлендж? Текущий сбросится.')) return;
    }
    state.challenges = { active: days, start: today() };
    save(KEYS.challenges, state.challenges);
    renderChallenges();
  });
});

function renderChallenges() {
  const c = state.challenges;
  const box = $('activeChallenge');
  document.querySelectorAll('.challenge-chip').forEach(chip => {
    chip.classList.toggle('active', +chip.dataset.days === c.active);
  });

  if (!c.active || !c.start) {
    box.classList.add('hidden');
    return;
  }

  const startDate = new Date(c.start);
  const elapsed = Math.floor((Date.now() - startDate.getTime()) / 86400000) + 1;
  const pct = Math.min(100, (elapsed / c.active) * 100);
  const done = elapsed >= c.active;

  box.innerHTML = `
    <div class="ch-progress">
      <span>День <span class="ch-days">${Math.min(elapsed, c.active)}</span> из ${c.active}</span>
      <span>${done ? '🎉 Завершён!' : 'Осталось ' + (c.active - elapsed) + ' дн.'}</span>
    </div>
    <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
    ${done ? '<p class="hint" style="margin-top:10px">Поздравляем с завершением челленджа! Начните новый или отдохните.</p>' : ''}
  `;
  box.classList.remove('hidden');
}

// ==================== ГРАФИКИ ====================
function renderCharts() {
  if (typeof Chart === 'undefined') return;
  const opts = {
    responsive: true, maintainAspectRatio: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: 'rgba(128,128,128,0.15)' }, ticks: { color: '#8b91a1', font: { size: 10 } } },
      y: { grid: { color: 'rgba(128,128,128,0.15)' }, ticks: { color: '#8b91a1', font: { size: 10 } } }
    }
  };
  const bodySorted = [...state.body].reverse();

  // Вес
  if (state.charts.weight) state.charts.weight.destroy();
  state.charts.weight = new Chart($('weightChart'), {
    type: 'line',
    data: {
      labels: bodySorted.length ? bodySorted.map(b => fmtDate(b.date)) : ['—'],
      datasets: [{
        data: bodySorted.length ? bodySorted.map(b => b.weight) : [0],
        borderColor: '#6ee7b7',
        backgroundColor: 'rgba(110, 231, 183, 0.15)',
        fill: true, tension: 0.4,
        pointBackgroundColor: '#6ee7b7', pointRadius: 4
      }]
    },
    options: opts
  });

  // Калории за 7 дней
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const total = state.meals.filter(m => m.date.slice(0, 10) === key).reduce((s, m) => s + (m.calories || 0), 0);
    days.push({ label: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }), value: total });
  }
  if (state.charts.calories) state.charts.calories.destroy();
  state.charts.calories = new Chart($('caloriesChart'), {
    type: 'bar',
    data: { labels: days.map(d => d.label), datasets: [{ data: days.map(d => d.value), backgroundColor: '#38bdf8', borderRadius: 8 }] },
    options: opts
  });

  // Объёмы
  const withMeasures = bodySorted.filter(b => b.waist || b.hips || b.chest);
  if (state.charts.measure) state.charts.measure.destroy();
  state.charts.measure = new Chart($('measureChart'), {
    type: 'line',
    data: {
      labels: withMeasures.length ? withMeasures.map(b => fmtDate(b.date)) : ['—'],
      datasets: [
        { label: 'Талия', data: withMeasures.map(b => b.waist), borderColor: '#6ee7b7', tension: 0.4, pointRadius: 3 },
        { label: 'Бёдра', data: withMeasures.map(b => b.hips), borderColor: '#38bdf8', tension: 0.4, pointRadius: 3 },
        { label: 'Грудь', data: withMeasures.map(b => b.chest), borderColor: '#fbbf24', tension: 0.4, pointRadius: 3 }
      ].filter(ds => ds.data.some(v => v != null))
    },
    options: { ...opts, plugins: { legend: { display: true, labels: { color: '#8b91a1', font: { size: 11 } } } } }
  });
}

// ==================== ПРОФИЛЬ ====================
function renderProfile() {
  renderLevel();
  renderAchievements();
  $('totalMeals').textContent = state.meals.length;
  const days = new Set(state.meals.map(m => m.date.slice(0, 10)));
  $('totalDays').textContent = days.size;
  $('totalLost').textContent = getLost().toFixed(1);
  const water = Object.values(state.water).reduce((s, v) => s + v, 0);
  $('totalWater').textContent = (water / 1000).toFixed(1);
}

// ==================== УВЕДОМЛЕНИЯ ====================
function requestNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') Notification.requestPermission();
}

function checkNotifications() {
  if (!state.settings.notifications) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const h = new Date().getHours();
  const m = new Date().getMinutes();
  const lastNotif = +localStorage.getItem('ft_last_notif') || 0;
  const now = Date.now();
  if (now - lastNotif < 3600000) return; // не чаще раза в час

  const day = today();
  const water = getTodayWater();
  const norm = state.settings.waterNorm || 2000;

  if (h >= 14 && water < norm * 0.5) {
    new Notification('💧 Пора пить воду', { body: `Выпито ${water} мл из ${norm} мл. Добавьте стакан воды!` });
    localStorage.setItem('ft_last_notif', String(now));
  } else if (h >= 20 && !state.meals.some(m => m.date.slice(0, 10) === day)) {
    new Notification('🍽️ Не забудьте про дневник', { body: 'Сегодня ещё нет записей о еде.' });
    localStorage.setItem('ft_last_notif', String(now));
  }
}
setInterval(checkNotifications, 600000);

// ==================== РЕНДЕР ВСЕГО ====================
function renderAll() {
  renderDashboard();
  renderMeals();
  renderBodyHistory();
  renderChallenges();
  if ($('progress').classList.contains('active')) renderCharts();
  if ($('profile').classList.contains('active')) renderProfile();
}

// ==================== ЭКСПОРТ В WINDOW ====================
window.deleteMeal = deleteMeal;
window.deleteBodyEntry = deleteBodyEntry;
window.addRecipeToDiary = addRecipeToDiary;
window.deleteRecipe = deleteRecipe;

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
(function init() {
  applyTheme(state.settings.theme || 'dark');
  renderAll();
  updateStreak();

  if (!state.settings.onboarded) {
    setTimeout(showOnboarding, 300);
  }

  // PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();