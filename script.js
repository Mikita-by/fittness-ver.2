// ============ СОСТОЯНИЕ ============
const STORAGE = {
  meals: 'ft_meals',
  body: 'ft_body',
  settings: 'ft_settings'
};

let state = {
  meals: JSON.parse(localStorage.getItem(STORAGE.meals) || '[]'),
  body: JSON.parse(localStorage.getItem(STORAGE.body) || '[]'),
  settings: JSON.parse(localStorage.getItem(STORAGE.settings) || '{}'),
  currentImage: null,
  charts: { weight: null, calories: null, measure: null }
};

const save = (key, data) => localStorage.setItem(key, JSON.stringify(data));

// ============ УТИЛИТЫ ============
const todayKey = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

function getTodayMeals() {
  return state.meals.filter(m => m.date.slice(0, 10) === todayKey());
}

function calcBMI(weight, heightCm) {
  if (!weight || !heightCm) return null;
  return (weight / Math.pow(heightCm / 100, 2)).toFixed(1);
}

function escape(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ============ НАВИГАЦИЯ ============
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (tab.dataset.tab === 'progress') renderCharts();
  });
});

// ============ НАСТРОЙКИ ============
const settingsModal = document.getElementById('settingsModal');

document.getElementById('settingsBtn').addEventListener('click', () => {
  document.getElementById('userName').value = state.settings.name || '';
  document.getElementById('userHeight').value = state.settings.height || '';
  document.getElementById('targetWeight').value = state.settings.target || '';
  settingsModal.classList.remove('hidden');
});

document.getElementById('closeSettings').addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) settingsModal.classList.add('hidden');
});

document.getElementById('saveSettings').addEventListener('click', () => {
  state.settings = {
    name: document.getElementById('userName').value.trim(),
    height: parseFloat(document.getElementById('userHeight').value) || null,
    target: parseFloat(document.getElementById('targetWeight').value) || null
  };
  save(STORAGE.settings, state.settings);
  settingsModal.classList.add('hidden');
  renderAll();
});

// ============ ДНЕВНИК ПИТАНИЯ ============
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const preview = document.getElementById('preview');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const analyzeBtn = document.getElementById('analyzeBtn');
const aiStatus = document.getElementById('aiStatus');

uploadArea.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 8 * 1024 * 1024) {
    showAIStatus('❌ Фото слишком большое (макс. 8 МБ)', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    state.currentImage = ev.target.result;
    preview.src = ev.target.result;
    preview.classList.remove('hidden');
    uploadPlaceholder.classList.add('hidden');
    analyzeBtn.disabled = false;
    aiStatus.classList.add('hidden');
  };
  reader.readAsDataURL(file);
});

// ============ АНАЛИЗ ЧЕРЕЗ PUTER.JS ============
analyzeBtn.addEventListener('click', async () => {
  if (!state.currentImage) return;

  if (typeof puter === 'undefined' || !puter.ai) {
    showAIStatus('❌ ИИ-модуль не загрузился. Проверьте интернет и обновите страницу.', 'error');
    return;
  }

  showAIStatus('🤖 Анализируем изображение через ИИ... Обычно занимает 3–10 секунд.', 'loading');
  analyzeBtn.disabled = true;

  try {
    const prompt = `Ты — профессиональный нутрициолог. Проанализируй фотографию еды и верни ТОЛЬКО валидный JSON без markdown, без пояснений, без обратных кавычек.

Формат ответа:
{"dish_name":"название блюда","calories":250,"proteins":10,"fats":8,"carbs":30}

Правила:
- Оценивай примерную порцию на фото.
- Если на фото несколько блюд — укажи суммарные показатели.
- Все числа — целые.
- Если не можешь распознать еду — верни {"dish_name":"Не распознано","calories":0,"proteins":0,"fats":0,"carbs":0}.`;

    const response = await puter.ai.chat(prompt, state.currentImage, {
      model: 'google/gemini-3.8-flash'
    });

    // Извлекаем текст из ответа
    let text = '';
    if (typeof response === 'string') {
      text = response;
    } else if (response?.message?.content) {
      const c = response.message.content;
      text = Array.isArray(c) ? c.map(x => x.text || '').join('') : c;
    } else if (response?.text) {
      text = response.text;
    } else {
      text = String(response);
    }

    // Ищем JSON в тексте
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('ИИ вернул ответ в неверном формате');
    }

    const jsonStr = text.slice(firstBrace, lastBrace + 1);
    const data = JSON.parse(jsonStr);

    document.getElementById('mealName').value = data.dish_name || '';
    document.getElementById('mCalories').value = Math.round(data.calories) || '';
    document.getElementById('mProtein').value = Math.round(data.proteins) || '';
    document.getElementById('mFat').value = Math.round(data.fats) || '';
    document.getElementById('mCarbs').value = Math.round(data.carbs) || '';

    showAIStatus(`✅ Распознано: ${Math.round(data.calories) || 0} ккал. Проверьте и нажмите «Добавить вручную».`, '');
  } catch (err) {
    console.error('Ошибка анализа:', err);
    showAIStatus('❌ Не удалось распознать фото: ' + (err.message || 'неизвестная ошибка'), 'error');
  } finally {
    analyzeBtn.disabled = false;
  }
});

function showAIStatus(text, cls) {
  aiStatus.textContent = text;
  aiStatus.className = 'ai-status ' + (cls || '');
  aiStatus.classList.remove('hidden');
}

// ============ ДОБАВЛЕНИЕ ПРИЁМА ПИЩИ ============
document.getElementById('addMealBtn').addEventListener('click', () => {
  const name = document.getElementById('mealName').value.trim() || 'Приём пищи';
  const type = document.getElementById('mealType').value;
  const calories = parseFloat(document.getElementById('mCalories').value) || 0;
  const protein = parseFloat(document.getElementById('mProtein').value) || 0;
  const fat = parseFloat(document.getElementById('mFat').value) || 0;
  const carbs = parseFloat(document.getElementById('mCarbs').value) || 0;

  if (!calories && !protein && !fat && !carbs && !state.currentImage) {
    showAIStatus('Заполните хотя бы калории или загрузите фото', 'error');
    return;
  }

  const meal = {
    id: Date.now(),
    name,
    type,
    calories,
    protein,
    fat,
    carbs,
    image: state.currentImage,
    date: new Date().toISOString()
  };

  state.meals.unshift(meal);
  save(STORAGE.meals, state.meals);

  // Сброс формы
  document.getElementById('mealName').value = '';
  document.getElementById('mCalories').value = '';
  document.getElementById('mProtein').value = '';
  document.getElementById('mFat').value = '';
  document.getElementById('mCarbs').value = '';
  state.currentImage = null;
  preview.src = '';
  preview.classList.add('hidden');
  uploadPlaceholder.classList.remove('hidden');
  analyzeBtn.disabled = true;
  fileInput.value = '';
  aiStatus.classList.add('hidden');

  renderAll();
});

function deleteMeal(id) {
  if (!confirm('Удалить эту запись?')) return;
  state.meals = state.meals.filter(m => m.id !== id);
  save(STORAGE.meals, state.meals);
  renderAll();
}

// ============ ТЕЛО ============
document.getElementById('saveBodyBtn').addEventListener('click', () => {
  const weight = parseFloat(document.getElementById('bWeight').value);
  if (!weight) {
    alert('Введите вес');
    return;
  }

  const entry = {
    id: Date.now(),
    date: new Date().toISOString(),
    weight,
    chest: parseFloat(document.getElementById('bChest').value) || null,
    waist: parseFloat(document.getElementById('bWaist').value) || null,
    hips: parseFloat(document.getElementById('bHips').value) || null,
    arm: parseFloat(document.getElementById('bArm').value) || null,
    leg: parseFloat(document.getElementById('bLeg').value) || null
  };

  state.body.unshift(entry);
  save(STORAGE.body, state.body);

  ['bWeight', 'bChest', 'bWaist', 'bHips', 'bArm', 'bLeg'].forEach(id => {
    document.getElementById(id).value = '';
  });

  renderAll();
});

function deleteBodyEntry(id) {
  if (!confirm('Удалить эту запись?')) return;
  state.body = state.body.filter(b => b.id !== id);
  save(STORAGE.body, state.body);
  renderAll();
}

// ============ РЕНДЕР ============
function renderAll() {
  renderDashboard();
  renderMeals();
  renderBodyHistory();
  if (document.getElementById('progress').classList.contains('active')) {
    renderCharts();
  }
}

function renderDashboard() {
  const todayMeals = getTodayMeals();
  const totalCal = todayMeals.reduce((s, m) => s + (m.calories || 0), 0);
  const lastBody = state.body[0];
  const weight = lastBody?.weight || null;
  const bmi = calcBMI(weight, state.settings.height);

  document.getElementById('greeting').textContent =
    state.settings.name ? `Привет, ${state.settings.name}! 👋` : 'Привет! 👋';

  if (weight) {
    document.getElementById('heroWeight').textContent = weight;
    document.getElementById('heroTitle').textContent = 'Текущий вес';
    const diff = state.settings.target ? (weight - state.settings.target).toFixed(1) : null;
    document.getElementById('heroSub').textContent =
      diff !== null
        ? (diff > 0 ? `Осталось сбросить: ${diff} кг` : '🎉 Цель достигнута!')
        : 'Укажите цель в настройках';
  } else {
    document.getElementById('heroWeight').textContent = '—';
    document.getElementById('heroTitle').textContent = 'Начнём путь к цели';
    document.getElementById('heroSub').textContent = 'Добавьте первую запись веса';
  }

  document.getElementById('statCalories').textContent = Math.round(totalCal);
  document.getElementById('statBMI').textContent = bmi || '—';
  document.getElementById('statMeals').textContent = todayMeals.length;

  const remaining = (state.settings.target && weight)
    ? (weight - state.settings.target).toFixed(1)
    : '—';
  document.getElementById('statRemaining').textContent = remaining;

  const recent = state.meals.slice(0, 3);
  const container = document.getElementById('recentMeals');
  if (!recent.length) {
    container.innerHTML = '<p class="empty">Пока ничего не добавлено</p>';
  } else {
    container.innerHTML = recent.map(m => mealItemHTML(m, false)).join('');
  }
}

function mealItemHTML(m, withDelete = true) {
  const thumb = m.image
    ? `<img src="${m.image}" class="meal-thumb" alt="">`
    : `<div class="meal-thumb-placeholder">🍽️</div>`;
  return `
    <div class="meal-item">
      ${thumb}
      <div class="meal-info">
        <div class="meal-name">${escape(m.name)}</div>
        <div class="meal-type">${escape(m.type)}</div>
        <div class="meal-macros">
          <span>Б: ${Math.round(m.protein || 0)}г</span>
          <span>Ж: ${Math.round(m.fat || 0)}г</span>
          <span>У: ${Math.round(m.carbs || 0)}г</span>
        </div>
      </div>
      <div class="meal-cal">${Math.round(m.calories || 0)} ккал</div>
      ${withDelete ? `<button class="meal-delete" onclick="deleteMeal(${m.id})">✕</button>` : ''}
    </div>
  `;
}

function renderMeals() {
  const todayMeals = getTodayMeals();
  const list = document.getElementById('mealList');
  const total = todayMeals.reduce((s, m) => s + (m.calories || 0), 0);
  document.getElementById('todayTotal').textContent = `${Math.round(total)} ккал`;

  if (!todayMeals.length) {
    list.innerHTML = '<p class="empty">Ещё нет записей на сегодня</p>';
  } else {
    list.innerHTML = todayMeals.map(m => mealItemHTML(m, true)).join('');
  }
}

function renderBodyHistory() {
  const container = document.getElementById('bodyHistory');
  if (!state.body.length) {
    container.innerHTML = '<p class="empty">Нет данных</p>';
    return;
  }
  container.innerHTML = state.body.map(b => {
    const measures = [];
    if (b.chest) measures.push(`Грудь ${b.chest}`);
    if (b.waist) measures.push(`Талия ${b.waist}`);
    if (b.hips) measures.push(`Бёдра ${b.hips}`);
    if (b.arm) measures.push(`Рука ${b.arm}`);
    if (b.leg) measures.push(`Нога ${b.leg}`);
    return `
      <div class="body-entry">
        <div>
          <div class="body-entry-date">${fmtDate(b.date)}</div>
          <div class="body-entry-weight">${b.weight} кг</div>
          ${measures.length ? `<div class="body-entry-measures">${measures.join(' · ')}</div>` : ''}
        </div>
        <button class="body-entry-delete" onclick="deleteBodyEntry(${b.id})">✕</button>
      </div>
    `;
  }).join('');
}

// ============ ГРАФИКИ ============
function renderCharts() {
  if (typeof Chart === 'undefined') return;

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        grid: { color: '#2a2f3a' },
        ticks: { color: '#8b91a1', font: { size: 10 } }
      },
      y: {
        grid: { color: '#2a2f3a' },
        ticks: { color: '#8b91a1', font: { size: 10 } }
      }
    }
  };

  // --- Вес ---
  const bodySorted = [...state.body].reverse();
  const weightLabels = bodySorted.map(b => fmtDate(b.date));
  const weightData = bodySorted.map(b => b.weight);

  if (state.charts.weight) state.charts.weight.destroy();
  state.charts.weight = new Chart(document.getElementById('weightChart'), {
    type: 'line',
    data: {
      labels: weightLabels.length ? weightLabels : ['—'],
      datasets: [{
        data: weightData.length ? weightData : [0],
        borderColor: '#6ee7b7',
        backgroundColor: 'rgba(110, 231, 183, 0.15)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#6ee7b7',
        pointRadius: 4
      }]
    },
    options: chartOpts
  });

  // --- Калории за 7 дней ---
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const total = state.meals
      .filter(m => m.date.slice(0, 10) === key)
      .reduce((s, m) => s + (m.calories || 0), 0);
    days.push({
      label: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
      value: total
    });
  }

  if (state.charts.calories) state.charts.calories.destroy();
  state.charts.calories = new Chart(document.getElementById('caloriesChart'), {
    type: 'bar',
    data: {
      labels: days.map(d => d.label),
      datasets: [{
        data: days.map(d => d.value),
        backgroundColor: '#38bdf8',
        borderRadius: 8
      }]
    },
    options: chartOpts
  });

  // --- Объёмы ---
  const measureEntries = bodySorted.filter(b => b.waist || b.hips || b.chest);

  if (state.charts.measure) state.charts.measure.destroy();
  state.charts.measure = new Chart(document.getElementById('measureChart'), {
    type: 'line',
    data: {
      labels: measureEntries.length ? measureEntries.map(b => fmtDate(b.date)) : ['—'],
      datasets: [
        {
          label: 'Талия',
          data: measureEntries.map(b => b.waist),
          borderColor: '#6ee7b7',
          tension: 0.4,
          pointRadius: 3
        },
        {
          label: 'Бёдра',
          data: measureEntries.map(b => b.hips),
          borderColor: '#38bdf8',
          tension: 0.4,
          pointRadius: 3
        },
        {
          label: 'Грудь',
          data: measureEntries.map(b => b.chest),
          borderColor: '#fbbf24',
          tension: 0.4,
          pointRadius: 3
        }
      ].filter(ds => ds.data.some(v => v != null))
    },
    options: {
      ...chartOpts,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#8b91a1', font: { size: 11 } }
        }
      }
    }
  });
}

// ============ ЭКСПОРТ ФУНКЦИЙ ============
window.deleteMeal = deleteMeal;
window.deleteBodyEntry = deleteBodyEntry;

// ============ СТАРТ ============
renderAll();