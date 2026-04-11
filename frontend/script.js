'use strict';

// ─── API config ───────────────────────────────────────────────────────────────

const API_KEY  = 'YOUR_KEY_HERE';
const API_URL  = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

// ─── Prompts ──────────────────────────────────────────────────────────────────

function buildPrompt(mode, subject, examType) {
  const subjectLine  = subject  ? `Subject / module: ${subject}.` : '';
  const examTypeLine = examType ? `Exam format preference: ${examType}.` : '';

  if (mode === 1) {
    return `You are an expert exam tutor. Analyse the attached past exam paper carefully.
${subjectLine}

Return ONLY a valid JSON object — no markdown, no code fences, no extra text. Use exactly this schema:
{
  "questions": [
    { "text": "<practice question text>", "hint": "<brief hint, or null>" }
  ],
  "cramsheet": {
    "title": "<subject name or 'Key Concepts'>",
    "sections": [
      { "heading": "<topic>", "points": ["<key fact>", "<key fact>"] }
    ]
  }
}

Rules:
- Generate exactly 6 practice questions that reflect the style and difficulty of the exam.
- At least 3 questions should have a non-null hint.
- The cram sheet must have 4 sections covering the main topics tested.
- Each section must have at least 3 bullet points.
- Every point should be a concise, self-contained study note, not a vague heading.`;
  }

  return `You are an expert exam creator. Read the attached study notes or syllabus carefully.
${subjectLine}
${examTypeLine}

Return ONLY a valid JSON object — no markdown, no code fences, no extra text. Use exactly this schema:
{
  "questions": [
    { "text": "<practice question text>", "hint": "<brief hint, or null>" }
  ],
  "cramsheet": {
    "title": "<subject name or 'Study Summary'>",
    "sections": [
      { "heading": "<topic>", "points": ["<key fact>", "<key fact>"] }
    ]
  },
  "fullExam": {
    "title": "<subject name or 'Practice Exam'>",
    "mcq": [
      {
        "text": "<question>",
        "options": ["<option A text>", "<option B text>", "<option C text>", "<option D text>"],
        "correctIndex": <integer 0-3>
      }
    ],
    "shortAnswer": [
      { "marks": <integer>, "text": "<question>" }
    ]
  }
}

Rules:
- Generate exactly 6 practice questions; at least 3 should have a non-null hint.
- The cram sheet must have 4 sections, each with at least 3 bullet points.
- The full exam must have exactly 5 MCQ questions and 4 short-answer questions.
- Short-answer marks must sum to 30; distribute them as you see fit.
- MCQ options must contain exactly one correct answer at the specified correctIndex.`;
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const modeCards    = document.querySelectorAll('.mode-card');
const uploadPanels = {
  1: document.getElementById('upload-panel-mode1'),
  2: document.getElementById('upload-panel-mode2'),
};
const uploadForms  = {
  1: document.getElementById('upload-form-mode1'),
  2: document.getElementById('upload-form-mode2'),
};
const dropZones    = {
  1: document.getElementById('drop-zone-mode1'),
  2: document.getElementById('drop-zone-mode2'),
};
const fileInputs   = {
  1: document.getElementById('file-input-mode1'),
  2: document.getElementById('file-input-mode2'),
};

const resultsSection = document.getElementById('results');
const tabButtons     = document.querySelectorAll('.results-tab');
const tabPanels      = document.querySelectorAll('.results-panel');
const tabFullex      = document.getElementById('tab-fullex');
const panelQuestions = document.getElementById('panel-questions');
const panelCramsheet = document.getElementById('panel-cramsheet');
const panelFullex    = document.getElementById('panel-fullex');
const btnDownloadPdf = document.getElementById('btn-download-pdf');
const btnStartOver   = document.getElementById('btn-start-over');

// ─── State ────────────────────────────────────────────────────────────────────

let activeMode    = null;
let selectedFiles = { 1: null, 2: null };

// ─── Mode card selection ──────────────────────────────────────────────────────

modeCards.forEach(card => {
  card.addEventListener('click', () => selectMode(Number(card.dataset.mode)));

  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectMode(Number(card.dataset.mode));
    }
  });
});

function selectMode(mode) {
  activeMode = mode;
  modeCards.forEach(c => c.classList.toggle('mode-card--active', Number(c.dataset.mode) === mode));
  Object.values(uploadPanels).forEach(p => p?.setAttribute('hidden', ''));
  const panel = uploadPanels[mode];
  if (panel) {
    panel.removeAttribute('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ─── Drag & drop + file input ─────────────────────────────────────────────────

const ACCEPTED_MIME  = ['application/pdf', 'image/png', 'image/jpeg', 'text/plain'];
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

[1, 2].forEach(mode => {
  const zone  = dropZones[mode];
  const input = fileInputs[mode];
  if (!zone || !input) return;

  ['dragenter', 'dragover'].forEach(evt =>
    zone.addEventListener(evt, e => { e.preventDefault(); zone.classList.add('drop-zone--over'); })
  );
  ['dragleave', 'drop'].forEach(evt =>
    zone.addEventListener(evt, () => zone.classList.remove('drop-zone--over'))
  );

  zone.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(mode, file);
  });

  input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) handleFileSelect(mode, file);
  });
});

function handleFileSelect(mode, file) {
  if (!ACCEPTED_MIME.includes(file.type)) {
    setDropZoneError(mode, 'Unsupported file type. Please upload PDF, PNG, JPG, or TXT.');
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    setDropZoneError(mode, 'File too large — max 20 MB.');
    return;
  }
  selectedFiles[mode] = file;
  setDropZoneSuccess(mode, file.name);
}

function setDropZoneSuccess(mode, filename) {
  const zone   = dropZones[mode];
  const prompt = zone.querySelector('.drop-zone__prompt');
  const hint   = zone.querySelector('.drop-zone__hint');
  if (prompt) prompt.innerHTML = `<strong>\u2713 ${escapeHtml(filename)}</strong> ready to upload`;
  if (hint)   { hint.textContent = 'Click below to continue.'; hint.style.color = ''; }
  zone.style.borderColor = 'var(--purple-600)';
  zone.style.background  = 'var(--purple-50)';
}

function setDropZoneError(mode, message) {
  const zone = dropZones[mode];
  const hint = zone.querySelector('.drop-zone__hint');
  if (hint) { hint.textContent = message; hint.style.color = '#dc2626'; }
  zone.style.borderColor = '#dc2626';
}

function resetDropZone(mode) {
  const zone   = dropZones[mode];
  const prompt = zone.querySelector('.drop-zone__prompt');
  const hint   = zone.querySelector('.drop-zone__hint');
  const noun   = mode === 1 ? 'exam file' : 'notes';
  const id     = `file-input-mode${mode}`;
  if (prompt) prompt.innerHTML = `Drag &amp; drop your ${noun} here, or <label for="${id}" class="drop-zone__browse">browse</label>`;
  if (hint)   { hint.textContent = 'Supports PDF, PNG, JPG, TXT \u2014 max 20 MB'; hint.style.color = ''; }
  zone.style.borderColor = '';
  zone.style.background  = '';
  selectedFiles[mode]    = null;
  if (fileInputs[mode]) fileInputs[mode].value = '';
}

// ─── Form submission ───────────────────────────────────────────────────────────

[1, 2].forEach(mode => {
  uploadForms[mode]?.addEventListener('submit', e => {
    e.preventDefault();
    if (!selectedFiles[mode]) {
      setDropZoneError(mode, 'Please select a file before continuing.');
      return;
    }
    startProcessing(mode);
  });
});

// ─── Loading overlay ───────────────────────────────────────────────────────────

function showSpinner(mode) {
  const label = mode === 1 ? 'Analysing your exam\u2026' : 'Generating your practice material\u2026';
  const overlay = document.createElement('div');
  overlay.id = 'loading-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.innerHTML = `
    <div class="spinner-box">
      <div class="spinner" aria-hidden="true"></div>
      <p class="spinner-label">AI is ${label}</p>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('spinner-visible'));
}

function hideSpinner() {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  overlay.classList.remove('spinner-visible');
  overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  // Fallback: force-remove after transition window
  setTimeout(() => overlay.remove(), 400);
}

// ─── Processing (async, calls real Gemini API) ────────────────────────────────

async function startProcessing(mode) {
  clearUploadError(mode);

  const submitBtn = uploadForms[mode]?.querySelector('[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  const subject  = document.getElementById(`context-mode${mode}`)?.value.trim() ?? '';
  const examType = mode === 2 ? (document.getElementById('exam-type-mode2')?.value || 'mixed') : null;

  showSpinner(mode);

  try {
    const prompt  = buildPrompt(mode, subject, examType);
    const rawText = await callGemini(prompt, selectedFiles[mode]);
    const data    = parseGeminiJson(rawText);
    renderResults(mode, data, subject, examType);
  } catch (err) {
    showUploadError(mode, err.message);
  } finally {
    hideSpinner();
    if (submitBtn) submitBtn.disabled = false;
  }
}

// ─── Gemini API ───────────────────────────────────────────────────────────────

// Convert a File to the part shape Gemini expects:
//   text/plain  →  { text: "..." }
//   everything else  →  { inline_data: { mime_type, data: base64 } }
function readFileAsGeminiPart(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    if (file.type === 'text/plain') {
      reader.onload  = () => resolve({ text: reader.result });
      reader.onerror = () => reject(new Error('Could not read file.'));
      reader.readAsText(file);
    } else {
      reader.onload  = () => {
        // result is "data:<mime>;base64,<data>" — we only need the data portion
        const base64 = reader.result.split(',')[1];
        resolve({ inline_data: { mime_type: file.type, data: base64 } });
      };
      reader.onerror = () => reject(new Error('Could not read file.'));
      reader.readAsDataURL(file);
    }
  });
}

async function callGemini(prompt, file) {
  const filePart = await readFileAsGeminiPart(file);

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        filePart,
      ],
    }],
    generationConfig: {
      temperature:      0.7,
      maxOutputTokens:  4096,
      responseMimeType: 'application/json',
    },
  };

  let response;
  try {
    response = await fetch(API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
  } catch {
    throw new Error('Network error — check your connection and try again.');
  }

  if (!response.ok) {
    let message = `Gemini API error (${response.status})`;
    try {
      const err = await response.json();
      message   = err.error?.message ?? message;
    } catch { /* swallow parse error, keep the status-based message */ }
    throw new Error(message);
  }

  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error('Empty response from Gemini — please try again.');
  return text;
}

// Strip code fences in case the model adds them despite responseMimeType
function parseGeminiJson(text) {
  const cleaned = text.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('Could not parse the AI response. Please try again.');
  }
}

// ─── Render results ────────────────────────────────────────────────────────────

function renderResults(mode, data, subject, examType) {
  panelQuestions.innerHTML = renderQuestions(data.questions ?? []);
  panelCramsheet.innerHTML = renderCramsheet(data.cramsheet, subject);

  if (mode === 1) {
    tabFullex.setAttribute('hidden', '');
    panelFullex.setAttribute('hidden', '');
  } else {
    panelFullex.innerHTML = renderFullExam(data.fullExam, subject, examType);
    tabFullex.removeAttribute('hidden');
  }

  activateTab('tab-questions');
  resultsSection.removeAttribute('hidden');
  btnDownloadPdf.disabled = false;

  requestAnimationFrame(() => {
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function renderQuestions(questions) {
  if (!questions.length) return '<p class="results-placeholder">No questions were returned.</p>';

  const items = questions.map(q => {
    const hint = q.hint
      ? `<details class="question-hint"><summary>Hint</summary><p>${escapeHtml(q.hint)}</p></details>`
      : '';
    return `<li class="question-item">
      <p class="question-text">${escapeHtml(q.text)}</p>
      ${hint}
    </li>`;
  }).join('');

  return `<ol class="question-list">${items}</ol>`;
}

function renderCramsheet(cram, subject) {
  if (!cram) return '<p class="results-placeholder">No cram sheet was returned.</p>';

  const title    = escapeHtml(cram.title || subject || 'Key Concepts');
  const sections = (cram.sections ?? []).map(s => `
    <div class="cramsheet__section">
      <h4>${escapeHtml(s.heading ?? '')}</h4>
      <ul>${(s.points ?? []).map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
    </div>`).join('');

  return `<div class="cramsheet">
    <h3 class="cramsheet__heading">${title}</h3>
    ${sections}
  </div>`;
}

function renderFullExam(exam, subject, examType) {
  if (!exam) return '<p class="results-placeholder">No practice exam was generated.</p>';

  const title     = escapeHtml(exam.title || subject || 'Practice Exam');
  const typeLabel = { mcq: 'Multiple Choice', short: 'Short Answer', essay: 'Essay / Long Answer', mixed: 'Mixed Format' }[examType] ?? 'Mixed Format';

  // MCQ section
  const mcqItems = (exam.mcq ?? []).map(q => {
    const options = (q.options ?? []).map((opt, idx) => {
      const letter    = String.fromCharCode(65 + idx);
      const isCorrect = idx === q.correctIndex;
      return `<li class="${isCorrect ? 'mcq-correct' : ''}">${escapeHtml(`${letter}) ${opt}`)}${isCorrect ? ' \u2713' : ''}</li>`;
    }).join('');
    return `<li class="question-item">
      <p class="question-text">${escapeHtml(q.text)}</p>
      <ul class="mcq-options">${options}</ul>
    </li>`;
  }).join('');

  const mcqMarks   = (exam.mcq?.length ?? 0) * 2;
  const mcqSection = mcqItems
    ? `<section class="full-exam__section">
        <h4>Section A &mdash; Multiple Choice <span class="mark-total">(${mcqMarks} marks)</span></h4>
        <ol class="question-list">${mcqItems}</ol>
      </section>`
    : '';

  // Short answer section
  const saItems = (exam.shortAnswer ?? []).map(q =>
    `<li class="question-item">
      <p class="question-text"><span class="mark-badge">${q.marks} marks</span>${escapeHtml(q.text)}</p>
    </li>`
  ).join('');

  const saMarks   = (exam.shortAnswer ?? []).reduce((sum, q) => sum + (q.marks ?? 0), 0);
  const saStart   = (exam.mcq?.length ?? 0) + 1;
  const saSection = saItems
    ? `<section class="full-exam__section">
        <h4>Section B &mdash; Short Answer <span class="mark-total">(${saMarks} marks)</span></h4>
        <ol class="question-list" start="${saStart}">${saItems}</ol>
      </section>`
    : '';

  const totalMarks = mcqMarks + saMarks;

  return `<div class="full-exam">
    <div class="full-exam__header">
      <h3>${title}</h3>
      <p class="full-exam__meta">Format: ${typeLabel}&emsp;|&emsp;Time: 90 min&emsp;|&emsp;Total: ${totalMarks} marks</p>
    </div>
    ${mcqSection}
    ${saSection}
  </div>`;
}

// ─── Tab switching ─────────────────────────────────────────────────────────────

tabButtons.forEach(btn => btn.addEventListener('click', () => activateTab(btn.id)));

function activateTab(tabId) {
  tabButtons.forEach(btn => {
    const active = btn.id === tabId;
    btn.classList.toggle('results-tab--active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  tabPanels.forEach(panel => {
    panel.toggleAttribute('hidden', panel.getAttribute('aria-labelledby') !== tabId);
  });
}

// ─── Start over ────────────────────────────────────────────────────────────────

btnStartOver?.addEventListener('click', () => {
  resultsSection.setAttribute('hidden', '');
  btnDownloadPdf.disabled = true;

  panelQuestions.innerHTML = '<p class="results-placeholder">Practice questions will appear here.</p>';
  panelCramsheet.innerHTML = '<p class="results-placeholder">Your cram sheet will appear here.</p>';
  panelFullex.innerHTML    = '<p class="results-placeholder">Your generated practice exam will appear here.</p>';

  activateTab('tab-questions');
  Object.values(uploadPanels).forEach(p => p?.setAttribute('hidden', ''));
  [1, 2].forEach(resetDropZone);
  [1, 2].forEach(clearUploadError);
  modeCards.forEach(c => c.classList.remove('mode-card--active'));
  activeMode = null;

  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ─── Inline error display ──────────────────────────────────────────────────────

function showUploadError(mode, message) {
  const form = uploadForms[mode];
  if (!form) return;
  let el = form.querySelector('.upload-error');
  if (!el) {
    el = document.createElement('p');
    el.className = 'upload-error';
    form.appendChild(el);
  }
  el.textContent = `\u26A0\uFE0F ${message}`;
}

function clearUploadError(mode) {
  uploadForms[mode]?.querySelector('.upload-error')?.remove();
}

// ─── Utility ───────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
