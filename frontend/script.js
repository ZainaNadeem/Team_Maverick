'use strict';

const BACKEND_URL = 'http://localhost:8000';

function buildPrompt(mode, content) {
  if (mode === 1) {
    return `Analyze this exam and return exactly 3 sections:
TOP CONCEPTS: List the 5 most tested concepts.
PRACTICE QUESTIONS: Generate 5 new questions in the same style.
CRAM SHEET: Write a focused one-page study summary.
Exam content: ${content}`;
  }
  return `Based on this syllabus/notes create a practice exam with 3 sections:
TOP CONCEPTS: The 5 most important topics.
PRACTICE QUESTIONS: 10 exam-style questions.
CRAM SHEET: A focused one-page study summary.
Content: ${content}`;
}

// DOM references
const modeCards      = document.querySelectorAll('.mode-card');
const uploadPanels   = {
  1: document.getElementById('upload-panel-mode1'),
  2: document.getElementById('upload-panel-mode2'),
};
const uploadForms    = {
  1: document.getElementById('upload-form-mode1'),
  2: document.getElementById('upload-form-mode2'),
};
const fileInputs     = {
  1: document.getElementById('file-input-mode1'),
  2: document.getElementById('file-input-mode2'),
};
const resultsSection = document.getElementById('results');
const tabButtons     = document.querySelectorAll('.results-tab');
const panelCram      = document.getElementById('panel-cram');
const panelQuestions = document.getElementById('panel-questions');
const panelSheet     = document.getElementById('panel-sheet');
const btnDownloadPdf = document.getElementById('btn-download-pdf');
const btnStartOver   = document.getElementById('btn-start-over');

let activeMode    = null;
let selectedFiles = { 1: null, 2: null };

// Mode selection
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
  modeCards.forEach(c =>
    c.classList.toggle('mode-card--active', Number(c.dataset.mode) === mode)
  );
  Object.values(uploadPanels).forEach(p => p?.setAttribute('hidden', ''));
  const panel = uploadPanels[mode];
  if (panel) {
    panel.removeAttribute('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// File handling
[1, 2].forEach(mode => {
  const input = fileInputs[mode];
  if (!input) return;
  input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) handleFileSelect(mode, file);
  });
});

function handleFileSelect(mode, file) {
  selectedFiles[mode] = file;
  const form = uploadForms[mode];
  if (form) {
    let label = form.querySelector('.file-selected-label');
    if (!label) {
      label = document.createElement('p');
      label.className = 'file-selected-label';
      label.style.color = 'green';
      label.style.marginTop = '8px';
      form.querySelector('.drop-zone').after(label);
    }
    label.textContent = `✓ ${file.name} selected`;
  }
}

// Form submission
[1, 2].forEach(mode => {
  uploadForms[mode]?.addEventListener('submit', e => {
    e.preventDefault();
    if (!selectedFiles[mode]) {
      alert('Please select a file first.');
      return;
    }
    startProcessing(mode);
  });
});

// Loading spinner
function showSpinner() {
  const overlay = document.createElement('div');
  overlay.id = 'loading-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:999;';
  overlay.innerHTML = `<div style="background:white;padding:40px;border-radius:12px;text-align:center;">
    <p style="font-size:1.2rem;font-weight:600;">🤖 Gemini is analyzing your file...</p>
    <p style="color:#6b7280;margin-top:8px;">This may take 10-20 seconds</p>
  </div>`;
  document.body.appendChild(overlay);
}

function hideSpinner() {
  document.getElementById('loading-overlay')?.remove();
}

// Main processing
async function startProcessing(mode) {
  showSpinner();
  try {
    const rawText = await callBackend(selectedFiles[mode], mode);
    const sections = parseTextSections(rawText);
    renderResults(sections);
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    hideSpinner();
  }
}

// Call backend
async function callBackend(file, mode) {
  const formData = new FormData();
  formData.append('file', file);

  const endpoint = mode === 2
    ? `${BACKEND_URL}/upload-syllabus`
    : `${BACKEND_URL}/upload-exam`;

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error(`Backend error (${response.status})`);

  const json = await response.json();
  return json.analysis.analysis;
}

// Parse sections
function parseTextSections(text) {
  const markers = [
    { key: 'topConcepts',       label: 'TOP CONCEPTS:'       },
    { key: 'practiceQuestions', label: 'PRACTICE QUESTIONS:' },
    { key: 'cramSheet',         label: 'CRAM SHEET:'         },
  ];
  const positions = markers.map(m => ({ ...m, idx: text.indexOf(m.label) }));
  const sections  = {};
  positions.forEach((m, i) => {
    if (m.idx === -1) { sections[m.key] = ''; return; }
    const start = m.idx + m.label.length;
    const next  = positions.slice(i + 1).find(n => n.idx !== -1);
    const end   = next ? next.idx : text.length;
    sections[m.key] = text.slice(start, end).trim();
  });
  return sections;
}

// Render results
function renderResults(sections) {
  panelCram.innerHTML      = `<pre style="white-space:pre-wrap">${sections.topConcepts || 'No content'}</pre>`;
  panelQuestions.innerHTML = `<pre style="white-space:pre-wrap">${sections.practiceQuestions || 'No content'}</pre>`;
  panelSheet.innerHTML     = `<pre style="white-space:pre-wrap">${sections.cramSheet || 'No content'}</pre>`;

  resultsSection.removeAttribute('hidden');
  if (btnDownloadPdf) btnDownloadPdf.disabled = false;
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Tab switching
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('results-tab--active'));
    btn.classList.add('results-tab--active');

    document.querySelectorAll('.results-panel').forEach(p => p.setAttribute('hidden', ''));

    const tabId = btn.id;
    if (tabId === 'tab-cram')      panelCram.removeAttribute('hidden');
    if (tabId === 'tab-questions') panelQuestions.removeAttribute('hidden');
    if (tabId === 'tab-sheet')     panelSheet.removeAttribute('hidden');
  });
});

// Start over
btnStartOver?.addEventListener('click', () => {
  resultsSection.setAttribute('hidden', '');
  Object.values(uploadPanels).forEach(p => p?.setAttribute('hidden', ''));
  modeCards.forEach(c => c.classList.remove('mode-card--active'));
  selectedFiles = { 1: null, 2: null };
  activeMode = null;
  window.scrollTo({ top: 0, behavior: 'smooth' });
});