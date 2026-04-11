// ExamEdge — UI logic and mock AI response simulation
// No real API calls yet; simulates a 2-second processing delay.

'use strict';

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const modeCards     = document.querySelectorAll('.mode-card');
const uploadPanels  = {
  1: document.getElementById('upload-panel-mode1'),
  2: document.getElementById('upload-panel-mode2'),
};
const uploadForms   = {
  1: document.getElementById('upload-form-mode1'),
  2: document.getElementById('upload-form-mode2'),
};
const dropZones     = {
  1: document.getElementById('drop-zone-mode1'),
  2: document.getElementById('drop-zone-mode2'),
};
const fileInputs    = {
  1: document.getElementById('file-input-mode1'),
  2: document.getElementById('file-input-mode2'),
};

const resultsSection  = document.getElementById('results');
const tabButtons      = document.querySelectorAll('.results-tab');
const tabPanels       = document.querySelectorAll('.results-panel');
const tabFullex       = document.getElementById('tab-fullex');
const panelQuestions  = document.getElementById('panel-questions');
const panelCramsheet  = document.getElementById('panel-cramsheet');
const panelFullex     = document.getElementById('panel-fullex');
const btnDownloadPdf  = document.getElementById('btn-download-pdf');
const btnStartOver    = document.getElementById('btn-start-over');

// ─── State ────────────────────────────────────────────────────────────────────

let activeMode    = null;          // 1 or 2
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

  // Highlight chosen card, un-highlight the other
  modeCards.forEach(c =>
    c.classList.toggle('mode-card--active', Number(c.dataset.mode) === mode)
  );

  // Hide both upload panels, then reveal the correct one
  Object.values(uploadPanels).forEach(p => p?.setAttribute('hidden', ''));
  const panel = uploadPanels[mode];
  if (panel) {
    panel.removeAttribute('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ─── Drag & drop + file input ─────────────────────────────────────────────────

[1, 2].forEach(mode => {
  const zone  = dropZones[mode];
  const input = fileInputs[mode];
  if (!zone || !input) return;

  // Highlight zone while file is dragged over it
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

const ACCEPTED_MIME  = ['application/pdf', 'image/png', 'image/jpeg', 'text/plain'];
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

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
  if (hint)   { hint.textContent = 'Click \u201CAnalyse\u201D or \u201CGenerate\u201D below to continue.'; hint.style.color = ''; }

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

  // Trigger transition on next frame so CSS opacity animates in
  requestAnimationFrame(() => overlay.classList.add('spinner-visible'));
}

function hideSpinner() {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;

  overlay.classList.remove('spinner-visible');
  overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
}

function startProcessing(mode) {
  const submitBtn = uploadForms[mode]?.querySelector('[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  const context  = document.getElementById(`context-mode${mode}`)?.value.trim() ?? '';
  const examType = mode === 2 ? (document.getElementById('exam-type-mode2')?.value || 'mixed') : null;

  showSpinner(mode);

  setTimeout(() => {
    hideSpinner();
    if (submitBtn) submitBtn.disabled = false;
    renderResults(mode, context, examType);
  }, 2000);
}

// ─── Mock data ─────────────────────────────────────────────────────────────────

const MOCK = {
  // ── Mode 1: past exam analysis ──────────────────────────────────────────────
  mode1: {
    questions(subject) {
      const ctx = subject ? `in the context of ${escapeHtml(subject)}` : 'for this subject';
      return `
        <ol class="question-list">
          <li class="question-item">
            <p class="question-text">Explain the key differences between supervised and unsupervised learning, and give one real-world example of each.</p>
            <details class="question-hint"><summary>Hint</summary><p>Focus on whether the training data includes labelled outputs.</p></details>
          </li>
          <li class="question-item">
            <p class="question-text">A sorting algorithm has a worst-case time complexity of O(n²). Name two such algorithms and describe a scenario where each would be preferred over a faster alternative.</p>
            <details class="question-hint"><summary>Hint</summary><p>Consider in-place sorting and nearly-sorted data.</p></details>
          </li>
          <li class="question-item">
            <p class="question-text">Outline the main steps ${ctx} in designing a normalised relational database schema. Illustrate with an example up to 3NF.</p>
            <details class="question-hint"><summary>Hint</summary><p>Cover 1NF, 2NF, and 3NF with functional dependency examples.</p></details>
          </li>
          <li class="question-item">
            <p class="question-text">What is a race condition? Describe how mutexes and semaphores each address it, and identify one situation where a semaphore is the better choice.</p>
          </li>
          <li class="question-item">
            <p class="question-text">Apply the CAP theorem to a distributed banking system. Which two guarantees would you prioritise, and what concrete trade-off does your choice imply?</p>
          </li>
        </ol>`;
    },

    cramsheet(subject) {
      const title = subject || 'Key Topics';
      return `
        <div class="cramsheet">
          <h3 class="cramsheet__heading">Cram Sheet &mdash; ${escapeHtml(title)}</h3>

          <div class="cramsheet__section">
            <h4>Algorithms &amp; Complexity</h4>
            <ul>
              <li><strong>Big-O notation</strong> &mdash; worst-case growth rate; O(1) &lt; O(log n) &lt; O(n) &lt; O(n log n) &lt; O(n²)</li>
              <li><strong>Divide &amp; conquer</strong> &mdash; split → solve sub-problems → merge (e.g. Merge Sort, Quick Sort)</li>
              <li><strong>Dynamic programming</strong> &mdash; memoise overlapping sub-problems (Fibonacci, 0/1 Knapsack)</li>
            </ul>
          </div>

          <div class="cramsheet__section">
            <h4>Data Structures</h4>
            <ul>
              <li><strong>Array vs. Linked List</strong> &mdash; O(1) random access vs. O(1) head insert/delete</li>
              <li><strong>BST</strong> &mdash; O(log n) when balanced; degrades to O(n) if unbalanced</li>
              <li><strong>Hash Table</strong> &mdash; O(1) average; collision resolution: chaining or open addressing</li>
            </ul>
          </div>

          <div class="cramsheet__section">
            <h4>Concurrency</h4>
            <ul>
              <li><strong>Race condition</strong> &mdash; outcome depends on thread scheduling; prevent with locks</li>
              <li><strong>Deadlock</strong> &mdash; circular wait; break with lock ordering or timeouts</li>
              <li><strong>Mutex vs. Semaphore</strong> &mdash; mutex = binary ownership; semaphore = counted permits</li>
            </ul>
          </div>

          <div class="cramsheet__section">
            <h4>Databases</h4>
            <ul>
              <li><strong>ACID</strong> &mdash; Atomicity, Consistency, Isolation, Durability</li>
              <li><strong>Normalisation</strong> &mdash; 1NF → 2NF → 3NF eliminates redundancy; BCNF is stricter</li>
              <li><strong>CAP theorem</strong> &mdash; only 2 of 3 guaranteed: Consistency, Availability, Partition tolerance</li>
            </ul>
          </div>
        </div>`;
    },
  },

  // ── Mode 2: generate from notes / syllabus ──────────────────────────────────
  mode2: {
    questions(subject) {
      const ctx = subject ? `relevant to ${escapeHtml(subject)}` : 'from your notes';
      return `
        <ol class="question-list">
          <li class="question-item">
            <p class="question-text">Define the central dogma of molecular biology and describe the role of DNA, mRNA, and protein in the process.</p>
          </li>
          <li class="question-item">
            <p class="question-text">Compare mitosis and meiosis, highlighting three key differences in process and biological outcome.</p>
            <details class="question-hint"><summary>Hint</summary><p>Consider ploidy, number of divisions, and genetic variation produced.</p></details>
          </li>
          <li class="question-item">
            <p class="question-text">Using an example ${ctx}, explain how a negative feedback loop maintains homeostasis. What happens when the loop is disrupted?</p>
          </li>
          <li class="question-item">
            <p class="question-text">What does the Michaelis&ndash;Menten constant (Km) represent? How does a competitive inhibitor alter Km and Vmax, and why?</p>
          </li>
          <li class="question-item">
            <p class="question-text">Describe two mechanisms by which antibiotic resistance spreads between bacteria, and propose one clinical strategy to limit each mechanism.</p>
          </li>
        </ol>`;
    },

    cramsheet(subject) {
      const title = subject || 'Module Summary';
      return `
        <div class="cramsheet">
          <h3 class="cramsheet__heading">Cram Sheet &mdash; ${escapeHtml(title)}</h3>

          <div class="cramsheet__section">
            <h4>Cell Biology</h4>
            <ul>
              <li><strong>Prokaryote vs. Eukaryote</strong> &mdash; no nucleus vs. membrane-bound organelles</li>
              <li><strong>Cell cycle</strong> &mdash; G1 → S (replication) → G2 → M (mitosis) → C (cytokinesis)</li>
              <li><strong>Apoptosis</strong> &mdash; intrinsic (mitochondrial) &amp; extrinsic (death receptor) pathways</li>
            </ul>
          </div>

          <div class="cramsheet__section">
            <h4>Molecular Biology</h4>
            <ul>
              <li><strong>DNA replication</strong> &mdash; semi-conservative; leading &amp; lagging strands; Okazaki fragments</li>
              <li><strong>Transcription</strong> &mdash; DNA → mRNA; promoter, elongation, termination</li>
              <li><strong>Translation</strong> &mdash; mRNA → protein; ribosome reads codons, tRNA carries amino acids</li>
            </ul>
          </div>

          <div class="cramsheet__section">
            <h4>Enzymes &amp; Metabolism</h4>
            <ul>
              <li><strong>Enzyme catalysis</strong> &mdash; lowers activation energy; induced-fit model</li>
              <li><strong>Km</strong> &mdash; substrate concentration at ½ Vmax; low Km = high affinity</li>
              <li><strong>Glycolysis</strong> &mdash; glucose → 2 pyruvate + 2 ATP net + 2 NADH (10 steps)</li>
            </ul>
          </div>

          <div class="cramsheet__section">
            <h4>Genetics</h4>
            <ul>
              <li><strong>Mendel&rsquo;s laws</strong> &mdash; Segregation &amp; Independent Assortment (linked genes violate the latter)</li>
              <li><strong>Mutation types</strong> &mdash; silent, missense, nonsense, frameshift</li>
              <li><strong>Epigenetics</strong> &mdash; methylation (silencing) &amp; acetylation (activation) without changing DNA sequence</li>
            </ul>
          </div>
        </div>`;
    },

    fullExam(subject, examType) {
      const title     = subject || 'Practice Exam';
      const typeLabel = { mcq: 'Multiple Choice', short: 'Short Answer', essay: 'Essay / Long Answer', mixed: 'Mixed Format' }[examType] ?? 'Mixed Format';
      return `
        <div class="full-exam">
          <div class="full-exam__header">
            <h3>${escapeHtml(title)}</h3>
            <p class="full-exam__meta">Format: ${typeLabel}&emsp;|&emsp;Time allowed: 90 min&emsp;|&emsp;Total marks: 50</p>
          </div>

          <section class="full-exam__section">
            <h4>Section A &mdash; Multiple Choice <span class="mark-total">(20 marks)</span></h4>
            <ol class="question-list">
              <li class="question-item">
                <p class="question-text">Which statement correctly describes the structure of DNA?</p>
                <ul class="mcq-options">
                  <li>A) Single-stranded helix with ribose sugar</li>
                  <li class="mcq-correct">B) Double-stranded helix with deoxyribose sugar ✓</li>
                  <li>C) Double-stranded helix with ribose sugar</li>
                  <li>D) Triple-stranded helix with deoxyribose sugar</li>
                </ul>
              </li>
              <li class="question-item">
                <p class="question-text">The process by which mRNA is used to synthesise a protein is called:</p>
                <ul class="mcq-options">
                  <li>A) Replication</li>
                  <li>B) Transcription</li>
                  <li class="mcq-correct">C) Translation ✓</li>
                  <li>D) Transduction</li>
                </ul>
              </li>
              <li class="question-item">
                <p class="question-text">A competitive inhibitor affects enzyme kinetics by:</p>
                <ul class="mcq-options">
                  <li>A) Increasing Vmax only</li>
                  <li class="mcq-correct">B) Increasing apparent Km only ✓</li>
                  <li>C) Increasing both Vmax and Km</li>
                  <li>D) Decreasing Vmax and Km</li>
                </ul>
              </li>
            </ol>
          </section>

          <section class="full-exam__section">
            <h4>Section B &mdash; Short Answer <span class="mark-total">(30 marks)</span></h4>
            <ol class="question-list" start="4">
              <li class="question-item">
                <p class="question-text"><span class="mark-badge">6 marks</span> Explain the semi-conservative model of DNA replication. Describe the roles of helicase, DNA polymerase III, and DNA ligase.</p>
              </li>
              <li class="question-item">
                <p class="question-text"><span class="mark-badge">8 marks</span> Describe the stages of the cell cycle and explain how checkpoint proteins regulate the G1-to-S transition. What occurs when these checkpoints fail?</p>
              </li>
              <li class="question-item">
                <p class="question-text"><span class="mark-badge">6 marks</span> Compare the intrinsic and extrinsic apoptosis pathways, naming the key molecular players in each.</p>
              </li>
              <li class="question-item">
                <p class="question-text"><span class="mark-badge">10 marks</span> A bacterium acquires a plasmid carrying the <em>bla</em> gene (β-lactamase). Explain: (a) how this confers ampicillin resistance; (b) two routes by which resistance could spread to other bacteria; and (c) one clinical strategy to counteract each route.</p>
              </li>
            </ol>
          </section>
        </div>`;
    },
  },
};

// ─── Render results ────────────────────────────────────────────────────────────

function renderResults(mode, context, examType) {
  if (mode === 1) {
    panelQuestions.innerHTML = MOCK.mode1.questions(context);
    panelCramsheet.innerHTML = MOCK.mode1.cramsheet(context);
    tabFullex.setAttribute('hidden', '');
    panelFullex.setAttribute('hidden', '');
  } else {
    panelQuestions.innerHTML = MOCK.mode2.questions(context);
    panelCramsheet.innerHTML = MOCK.mode2.cramsheet(context);
    panelFullex.innerHTML    = MOCK.mode2.fullExam(context, examType);
    tabFullex.removeAttribute('hidden');
  }

  activateTab('tab-questions');

  resultsSection.removeAttribute('hidden');
  btnDownloadPdf.disabled = false;

  // Small delay lets the browser paint the section before scrolling
  requestAnimationFrame(() => {
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
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
    const shouldShow = panel.getAttribute('aria-labelledby') === tabId;
    panel.toggleAttribute('hidden', !shouldShow);
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
  modeCards.forEach(c => c.classList.remove('mode-card--active'));
  activeMode = null;

  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ─── Utility ───────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
