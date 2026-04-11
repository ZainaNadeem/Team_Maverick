'use strict';

/* ══════════════════════════════════════════════════════════════
   ExamEdge — application logic
   Handles: mode selection, file upload, Gemini API calls,
   plain-text parsing, result rendering, tab switching.
   ══════════════════════════════════════════════════════════════ */

// ─── API configuration ─────────────────────────────────────────────────────────
// Replace 'YOUR_KEY_HERE' with a real Gemini API key before running.

const API_KEY = 'YOUR_KEY_HERE';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

// ─── Exact prompts ─────────────────────────────────────────────────────────────
// Both prompts instruct Gemini to return plain text with exactly 3 labelled
// sections. The [content] placeholder is swapped at call-time with the actual
// file text (TXT) or left as "[see attached document]" (PDF / image).

function buildPrompt(mode, content) {
  if (mode === 1) {
    return `You are an expert academic tutor. Analyze this exam and return exactly 3 sections:

TOP CONCEPTS: List the 5 most tested concepts.

PRACTICE QUESTIONS: Generate 5 new questions in the same style and difficulty.

CRAM SHEET: Write a focused one-page study summary.

Exam content: ${content}`;
  }

  return `You are an expert academic tutor. Based on this syllabus/notes, create a realistic practice exam with exactly 3 sections:

TOP CONCEPTS: The 5 most important topics likely to be tested.

PRACTICE QUESTIONS: 10 exam-style questions covering these topics.

CRAM SHEET: A focused one-page study summary.

Content: ${content}`;
}

// ─── DOM references ────────────────────────────────────────────────────────────

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
const panelCramsheet = document.getElementById('panel-cramsheet');  // Top Concepts
const panelQuestions = document.getElementById('panel-questions');  // Practice Questions
const panelFullex    = document.getElementById('panel-fullex');     // Cram Sheet
const btnDownloadPdf = document.getElementById('btn-download-pdf');
const btnStartOver   = document.getElementById('btn-start-over');

// ─── Application state ─────────────────────────────────────────────────────────

let activeMode    = null;
let selectedFiles = { 1: null, 2: null };

// ─── Mode selection ────────────────────────────────────────────────────────────
// Clicking (or pressing Enter/Space on) a mode card shows the matching upload panel.

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

  // Highlight the chosen card, clear the other
  modeCards.forEach(c =>
    c.classList.toggle('mode-card--active', Number(c.dataset.mode) === mode)
  );

  // Hide all upload panels, then reveal the one matching the selected mode
  Object.values(uploadPanels).forEach(p => p?.setAttribute('hidden', ''));
  const panel = uploadPanels[mode];
  if (panel) {
    panel.removeAttribute('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ─── File handling — drag & drop + native picker ───────────────────────────────
// Supported types match what Gemini inline_data accepts for document analysis.

const ACCEPTED_MIME  = ['application/pdf', 'image/png', 'image/jpeg', 'text/plain'];
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB hard cap

[1, 2].forEach(mode => {
  const zone  = dropZones[mode];
  const input = fileInputs[mode];
  if (!zone || !input) return;

  // Visual feedback while a file is dragged over the zone
  ['dragenter', 'dragover'].forEach(evt =>
    zone.addEventListener(evt, e => {
      e.preventDefault();
      zone.classList.add('drop-zone--over');
    })
  );
  ['dragleave', 'drop'].forEach(evt =>
    zone.addEventListener(evt, () => zone.classList.remove('drop-zone--over'))
  );

  // Handle a dropped file
  zone.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(mode, file);
  });

  // Handle selection from the native file picker
  input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) handleFileSelect(mode, file);
  });
});

function handleFileSelect(mode, file) {
  // Validate type and size before accepting
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
  if (hint)   { hint.textContent = 'Click the button below to continue.'; hint.style.color = ''; }
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
  if (prompt) prompt.innerHTML =
    `Drag &amp; drop your ${noun} here, or <label for="${id}" class="drop-zone__browse">browse</label>`;
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

// ─── Loading spinner ───────────────────────────────────────────────────────────
// A full-screen overlay injected while the Gemini request is in flight.

function showSpinner(mode) {
  const label   = mode === 1 ? 'Analysing your exam\u2026' : 'Generating your practice material\u2026';
  const overlay = document.createElement('div');
  overlay.id    = 'loading-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.innerHTML = `
    <div class="spinner-box">
      <div class="spinner" aria-hidden="true"></div>
      <p class="spinner-label">AI is ${label}</p>
    </div>`;
  document.body.appendChild(overlay);
  // Defer the class add so the CSS opacity transition plays on entry
  requestAnimationFrame(() => overlay.classList.add('spinner-visible'));
}

function hideSpinner() {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  overlay.classList.remove('spinner-visible');
  overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  setTimeout(() => overlay.remove(), 400); // Fallback if transitionend doesn't fire
}

// ─── Main processing flow ──────────────────────────────────────────────────────
// Coordinates file reading → prompt building → Gemini call → rendering.

async function startProcessing(mode) {
  clearUploadError(mode);

  const submitBtn = uploadForms[mode]?.querySelector('[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  showSpinner(mode);

  try {
    // Prepare the file as either inline prompt text (TXT) or a Gemini inline_data part (binary)
    const { promptContent, extraPart } = await prepareFile(selectedFiles[mode]);

    const prompt   = buildPrompt(mode, promptContent);
    const rawText  = await callGemini(prompt, extraPart);
    const sections = parseTextSections(rawText);

    renderResults(sections);
  } catch (err) {
    showUploadError(mode, err.message);
  } finally {
    hideSpinner();
    if (submitBtn) submitBtn.disabled = false;
  }
}

// ─── File preparation ──────────────────────────────────────────────────────────
// text/plain  → read as text and inject directly into the prompt string
// PDF / image → read as base64 and send as a Gemini inline_data part

async function prepareFile(file) {
  if (file.type === 'text/plain') {
    const text = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read file.'));
      reader.readAsText(file);
    });
    return { promptContent: text, extraPart: null };
  }

  // Binary file — strip the data-URL prefix to get the raw base64 string
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
  return {
    promptContent: '[see attached document]',
    extraPart:     { inline_data: { mime_type: file.type, data: base64 } },
  };
}

// ─── Gemini API call ───────────────────────────────────────────────────────────
// Sends the prompt and optional file part to gemini-1.5-flash.
// Returns the raw text string from the first response candidate.

async function callGemini(promptText, extraPart) {
  // Build the parts array: always include the text prompt; optionally append the file
  const parts = [{ text: promptText }];
  if (extraPart) parts.push(extraPart);

  const body = {
    contents: [{ parts }],
    generationConfig: {
      temperature:     0.7,
      maxOutputTokens: 4096,
      // No responseMimeType — we want plain text so the section headers parse reliably
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
      const errJson = await response.json();
      message = errJson.error?.message ?? message;
    } catch { /* swallow JSON parse failure; keep the status-based message */ }
    throw new Error(message);
  }

  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error('Empty response from Gemini — please try again.');
  return text;
}

// ─── Plain-text section parser ─────────────────────────────────────────────────
// Splits the Gemini response on the 3 exact section headers we requested.
// Works for both Mode 1 and Mode 2 (the prompts use identical header names).

function parseTextSections(text) {
  // Map each section to the marker label and its position in the response text
  const markers = [
    { key: 'topConcepts',       label: 'TOP CONCEPTS:'       },
    { key: 'practiceQuestions', label: 'PRACTICE QUESTIONS:' },
    { key: 'cramSheet',         label: 'CRAM SHEET:'         },
  ];

  const positions = markers.map(m => ({ ...m, idx: text.indexOf(m.label) }));

  const sections = {};
  positions.forEach((m, i) => {
    if (m.idx === -1) { sections[m.key] = ''; return; }

    const start = m.idx + m.label.length;
    // End of this section = start of the next found section (or end of string)
    const next  = positions.slice(i + 1).find(n => n.idx !== -1);
    const end   = next ? next.idx : text.length;

    sections[m.key] = text.slice(start, end).trim();
  });

  // If none of the headers were found the response is unusable
  if (!sections.topConcepts && !sections.practiceQuestions && !sections.cramSheet) {
    throw new Error('Could not parse the AI response — expected section headers not found. Please try again.');
  }

  return sections;
}

// ─── Result rendering ──────────────────────────────────────────────────────────
// Populates all three panels, reveals the results card, and activates the first tab.
// All 3 tabs are always shown — both prompts return the same 3 sections.

function renderResults(sections) {
  panelCramsheet.innerHTML = renderSection(sections.topConcepts);        // Tab 1: Top Concepts
  panelQuestions.innerHTML = renderSection(sections.practiceQuestions);  // Tab 2: Practice Questions
  panelFullex.innerHTML    = renderSection(sections.cramSheet);           // Tab 3: Cram Sheet

  // Reveal the Cram Sheet tab (hidden in initial HTML; shown for both modes)
  tabFullex.removeAttribute('hidden');

  activateTab('tab-cramsheet');          // Start on Top Concepts
  resultsSection.removeAttribute('hidden');
  btnDownloadPdf.disabled = false;

  requestAnimationFrame(() =>
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
  );
}

// ─── Section renderer ──────────────────────────────────────────────────────────
// Converts a plain-text section body from Gemini into clean HTML.
// Handles: numbered lists, bullet lists, sub-headings, paragraphs,
// and inline **bold** / *italic* markdown.

function renderSection(text) {
  if (!text) return '<p class="results-placeholder">No content returned for this section.</p>';

  const lines  = text.split('\n');
  const chunks = [];
  let inList   = false;
  let listTag  = '';

  lines.forEach(rawLine => {
    const line = rawLine.trim();

    // Blank line — close any open list
    if (!line) {
      if (inList) { chunks.push(`</${listTag}>`); inList = false; listTag = ''; }
      return;
    }

    // Numbered list item: "1. text"
    if (/^\d+\.\s/.test(line)) {
      if (!inList || listTag !== 'ol') {
        if (inList) chunks.push(`</${listTag}>`);
        chunks.push('<ol class="text-list">');
        inList = true; listTag = 'ol';
      }
      chunks.push(`<li class="text-list__item">${renderInline(line.replace(/^\d+\.\s/, ''))}</li>`);
      return;
    }

    // Bullet list item: "- text" or "* text"
    if (/^[-*]\s/.test(line)) {
      if (!inList || listTag !== 'ul') {
        if (inList) chunks.push(`</${listTag}>`);
        chunks.push('<ul class="text-list">');
        inList = true; listTag = 'ul';
      }
      chunks.push(`<li class="text-list__item">${renderInline(line.replace(/^[-*]\s/, ''))}</li>`);
      return;
    }

    // Close any open list before rendering a heading or paragraph
    if (inList) { chunks.push(`</${listTag}>`); inList = false; listTag = ''; }

    // Sub-heading: "## text" or short line ending with ":"
    if (/^#{1,3}\s/.test(line) || (line.endsWith(':') && line.length < 80)) {
      const headText = line.replace(/^#{1,3}\s/, '').replace(/:$/, '');
      chunks.push(`<p class="section-subheading">${renderInline(headText)}</p>`);
      return;
    }

    // Default: body paragraph
    chunks.push(`<p class="text-para">${renderInline(line)}</p>`);
  });

  if (inList) chunks.push(`</${listTag}>`); // Close any trailing open list

  return `<div class="text-section">${chunks.join('\n')}</div>`;
}

// Converts **bold** and *italic* within a single line to HTML.
// escapeHtml runs FIRST to prevent XSS from AI-generated content.
function renderInline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>');
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
// Resets the entire UI back to the initial mode-selection state.

btnStartOver?.addEventListener('click', () => {
  // Hide results and disable download
  resultsSection.setAttribute('hidden', '');
  btnDownloadPdf.disabled = true;

  // Reset each panel to its placeholder text
  panelCramsheet.innerHTML = '<p class="results-placeholder">Top concepts will appear here.</p>';
  panelQuestions.innerHTML = '<p class="results-placeholder">Practice questions will appear here.</p>';
  panelFullex.innerHTML    = '<p class="results-placeholder">Your cram sheet will appear here.</p>';

  // Return to first tab and hide the third tab until next result
  activateTab('tab-cramsheet');
  tabFullex.setAttribute('hidden', '');

  // Hide upload panels and clear all file state
  Object.values(uploadPanels).forEach(p => p?.setAttribute('hidden', ''));
  [1, 2].forEach(resetDropZone);
  [1, 2].forEach(clearUploadError);

  // Deselect mode cards
  modeCards.forEach(c => c.classList.remove('mode-card--active'));
  activeMode = null;

  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ─── Inline error helpers ──────────────────────────────────────────────────────

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

// ─── XSS-safe HTML escaping ────────────────────────────────────────────────────
// Applied to ALL AI-generated text before it is inserted into the DOM.

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
