/**
 * Scholar's Home — Production SPA Controller
 * Vanilla JavaScript (ES6+), Fetch API, DOM manipulation, localStorage, D3.js
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // APPLICATION STATE
  // =========================================================================
  const state = {
    papers: [],
    selectedPaper: null,
    activeView: localStorage.getItem('scholar_active_view') || 'feed',
    activeTag: localStorage.getItem('scholar_active_tag') || 'ALL',
    searchQuery: '',
    readingQueue: JSON.parse(localStorage.getItem('scholar_reading_queue') || '[]'),
    isUploading: false,
    citationGraph: null,
    analysisCache: {}
  };

  // =========================================================================
  // DOM ELEMENT REFERENCES
  // =========================================================================
  const elements = {
    sidebarNav: document.getElementById('sidebarNav'),
    navBtns: document.querySelectorAll('.nav-tab-btn'),
    views: {
      feed: document.getElementById('viewFeed'),
      analyzer: document.getElementById('viewAnalyzer'),
      matrix: document.getElementById('viewMatrix'),
      graph: document.getElementById('viewGraph')
    },
    mainSearchInput: document.getElementById('mainSearchInput'),
    headerQueueCount: document.getElementById('headerQueueCount'),
    readingQueueBtn: document.getElementById('readingQueueBtn'),
    papersFeedStream: document.getElementById('papersFeedStream'),
    feedTagFilters: document.getElementById('feedTagFilters'),
    showingCountLabel: document.getElementById('showingCountLabel'),
    feedSortSelect: document.getElementById('feedSortSelect'),
    statPapersCount: document.getElementById('statPapersCount'),
    statTagsCount: document.getElementById('statTagsCount'),
    activeFocusLabel: document.getElementById('activeFocusLabel'),
    activeFocusSub: document.getElementById('activeFocusSub'),
    feedCounterBadge: document.getElementById('feedCounterBadge'),
    readingQueueList: document.getElementById('readingQueueList'),
    sideQueueBadge: document.getElementById('sideQueueBadge'),
    bibtexTrayCount: document.getElementById('bibtexTrayCount'),
    analyzerTitle: document.getElementById('analyzerTitle'),
    analyzerExecutiveSummary: document.getElementById('analyzerExecutiveSummary'),
    analyzerThreeSentence: document.getElementById('analyzerThreeSentence'),
    analyzerMethodology: document.getElementById('analyzerMethodology'),
    analyzerCaveats: document.getElementById('analyzerCaveats'),
    analyzerPaperIdPill: document.getElementById('analyzerPaperIdPill'),
    analyzerUploadedDate: document.getElementById('analyzerUploadedDate'),
    analyzerAuthorLine: document.getElementById('analyzerAuthorLine'),
    analyzerPdfDownloadLink: document.getElementById('analyzerPdfDownloadLink'),
    analyzerTagsList: document.getElementById('analyzerTagsList'),
    analyzerRawText: document.getElementById('analyzerRawText'),
    analyzerDeletePaperBtn: document.getElementById('analyzerDeletePaperBtn'),
    analyzeWithAiBtn: document.getElementById('analyzeWithAiBtn'),
    matrixTableBody: document.getElementById('matrixTableBody'),
    copyLatexTableBtn: document.getElementById('copyLatexTableBtn'),
    copyLatexLabel: document.getElementById('copyLatexLabel'),
    matrixCountBadge: document.getElementById('matrixCountBadge'),
    graphStatsPill: document.getElementById('graphStatsPill'),
    graphNodesCount: document.getElementById('graphNodesCount'),
    graphPaperSelect: document.getElementById('graphPaperSelect'),
    generateGraphBtn: document.getElementById('generateGraphBtn'),
    graphLoadingState: document.getElementById('graphLoadingState'),
    graphNodePanel: document.getElementById('graphNodePanel'),
    graphHelpPanel: document.getElementById('graphHelpPanel'),
    graphNodeCount: document.getElementById('graphNodeCount'),
    graphEdgeCount: document.getElementById('graphEdgeCount'),
    citationGraphContainer: document.getElementById('citationGraphContainer'),
    openUploadModalBtn: document.getElementById('openUploadModalBtn'),
    importPdfModal: document.getElementById('importPdfModal'),
    closeUploadModalBtn: document.getElementById('closeUploadModalBtn'),
    cancelUploadBtn: document.getElementById('cancelUploadBtn'),
    modalDropZone: document.getElementById('modalDropZone'),
    modalFileInput: document.getElementById('modalFileInput'),
    modalProgressStepper: document.getElementById('modalProgressStepper'),
    modalStepperTitle: document.getElementById('modalStepperTitle'),
    stepLabel1: document.getElementById('stepLabel1'),
    stepLabel2: document.getElementById('stepLabel2'),
    stepLabel3: document.getElementById('stepLabel3'),
    systemHealthText: document.getElementById('systemHealthText'),
    serverPulse: document.getElementById('serverPulse'),
    dbStatusDot: document.getElementById('dbStatusDot'),
    sidebarDbStatusText: document.getElementById('sidebarDbStatusText'),
    toastNotification: document.getElementById('toastNotification'),
    toastMsg: document.getElementById('toastMsg'),
    toastIcon: document.getElementById('toastIcon'),
    quickExportNotesBtn: document.getElementById('quickExportNotesBtn'),
    exportBibtexBtn: document.getElementById('exportBibtexBtn')
  };

  // =========================================================================
  // TOAST NOTIFICATIONS
  // =========================================================================
  let toastTimer = null;
  function showToast(message, type = 'success') {
    clearTimeout(toastTimer);
    elements.toastMsg.textContent = message;
    if (type === 'success') {
      elements.toastNotification.className = 'fixed bottom-6 right-6 z-50 max-w-sm px-4 py-3 rounded-xl shadow-lg font-mono text-xs flex items-center gap-2 transition-all transform translate-y-0 opacity-100 bg-[#e4ece5] text-[#16341f] border border-[#b5d4bc]';
      elements.toastIcon.textContent = 'check_circle';
      elements.toastIcon.className = 'material-symbols-outlined text-sm text-[#43654d]';
    } else {
      elements.toastNotification.className = 'fixed bottom-6 right-6 z-50 max-w-sm px-4 py-3 rounded-xl shadow-lg font-mono text-xs flex items-center gap-2 transition-all transform translate-y-0 opacity-100 bg-[#fceae8] text-[#8b1814] border border-[#f5b8b5]';
      elements.toastIcon.textContent = 'error';
      elements.toastIcon.className = 'material-symbols-outlined text-sm text-[#b3261e]';
    }
    toastTimer = setTimeout(() => {
      elements.toastNotification.classList.add('translate-y-20', 'opacity-0');
    }, 4000);
  }

  // =========================================================================
  // VIEW NAVIGATION CONTROLLER
  // =========================================================================
  function switchView(viewName) {
    if (!elements.views[viewName]) return;
    state.activeView = viewName;
    localStorage.setItem('scholar_active_view', viewName);

    elements.navBtns.forEach(btn => {
      const isTarget = btn.getAttribute('data-view') === viewName;
      if (isTarget) {
        btn.className = 'nav-tab-btn active flex items-center justify-between px-space-md py-2 transition-all bg-secondary-container/80 text-on-secondary-container font-semibold rounded-xl border border-secondary-fixed shadow-[0_1px_4px_rgba(68,102,78,0.06)] text-left w-full cursor-pointer';
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.classList.add('text-secondary');
      } else {
        btn.className = 'nav-tab-btn flex items-center justify-between px-space-md py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high/60 hover:text-on-surface transition-all text-left w-full cursor-pointer';
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.classList.remove('text-secondary');
      }
    });

    Object.keys(elements.views).forEach(v => {
      elements.views[v].classList.add('hidden');
    });
    elements.views[viewName].classList.remove('hidden');

    if (viewName === 'matrix') renderSynthesisMatrix();
    else if (viewName === 'graph') populateGraphPaperSelect();
    else if (viewName === 'feed') renderFeedCards();
  }

  elements.navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.getAttribute('data-view');
      switchView(targetView);
    });
  });

  // =========================================================================
  // HEALTH CHECK
  // =========================================================================
  async function pollHealth() {
    try {
      const response = await fetch('/health');
      const data = await response.json();
      if (response.ok && data.database?.status === 'connected') {
        if (elements.systemHealthText) elements.systemHealthText.textContent = 'Backend Online';
        if (elements.serverPulse) elements.serverPulse.className = 'h-2 w-2 rounded-full bg-secondary animate-pulse';
        if (elements.dbStatusDot) elements.dbStatusDot.className = 'h-2.5 w-2.5 rounded-full bg-secondary';
        if (elements.sidebarDbStatusText) elements.sidebarDbStatusText.textContent = 'Secure Vault';
      } else {
        if (elements.systemHealthText) elements.systemHealthText.textContent = 'DB Degraded';
        if (elements.serverPulse) elements.serverPulse.className = 'h-2 w-2 rounded-full bg-error';
        if (elements.dbStatusDot) elements.dbStatusDot.className = 'h-2.5 w-2.5 rounded-full bg-error';
      }
    } catch {
      if (elements.systemHealthText) elements.systemHealthText.textContent = 'Server Offline';
      if (elements.serverPulse) elements.serverPulse.className = 'h-2 w-2 rounded-full bg-error';
    }
  }

  // =========================================================================
  // DATA FETCHING
  // =========================================================================
  async function loadPapersFromBackend() {
    try {
      const response = await fetch('/api/papers');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const papers = await response.json();
      state.papers = Array.isArray(papers) ? papers : [];
      updateStats();
      renderTagFilters();
      renderFeedCards();
      renderReadingQueue();
      if (state.papers.length > 0 && !state.selectedPaper) {
        selectPaperForAnalyzer(state.papers[0]);
      }
    } catch (err) {
      console.error('Failed to load papers:', err);
    }
  }

  function updateStats() {
    const totalPapers = state.papers.length;
    if (elements.statPapersCount) elements.statPapersCount.textContent = totalPapers;
    if (elements.feedCounterBadge) elements.feedCounterBadge.textContent = `${totalPapers} paper${totalPapers === 1 ? '' : 's'}`;
    if (elements.bibtexTrayCount) elements.bibtexTrayCount.textContent = totalPapers;
    const allTags = new Set();
    state.papers.forEach(p => { if (Array.isArray(p.tags)) p.tags.forEach(t => allTags.add(t)); });
    if (elements.statTagsCount) elements.statTagsCount.textContent = `${allTags.size} normalized taxonomy tags`;
    if (elements.graphStatsPill) elements.graphStatsPill.textContent = `${totalPapers} papers · ${allTags.size} tags`;
    if (elements.graphNodesCount) elements.graphNodesCount.textContent = `${allTags.size} tags`;
    if (elements.matrixCountBadge) elements.matrixCountBadge.textContent = `${totalPapers} rows`;
  }

  // =========================================================================
  // VIEW 1: RESEARCH FEED
  // =========================================================================
  function renderTagFilters() {
    const allTags = new Set();
    state.papers.forEach(p => { if (Array.isArray(p.tags)) p.tags.forEach(t => allTags.add(t)); });
    elements.feedTagFilters.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = `text-xs px-4 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap ${state.activeTag === 'ALL' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-outline-variant/40'}`;
    allBtn.textContent = 'All Categories';
    allBtn.addEventListener('click', () => {
      state.activeTag = 'ALL';
      localStorage.setItem('scholar_active_tag', 'ALL');
      if (elements.activeFocusLabel) elements.activeFocusLabel.textContent = 'All Domains';
      if (elements.activeFocusSub) elements.activeFocusSub.textContent = 'Showing all indexed manuscripts';
      renderTagFilters();
      renderFeedCards();
    });
    elements.feedTagFilters.appendChild(allBtn);
    Array.from(allTags).sort().forEach(tag => {
      const count = state.papers.filter(p => Array.isArray(p.tags) && p.tags.includes(tag)).length;
      const tagBtn = document.createElement('button');
      tagBtn.type = 'button';
      const isActive = state.activeTag === tag;
      tagBtn.className = `text-xs px-4 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap ${isActive ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-outline-variant/40'}`;
      tagBtn.textContent = `${tag} (${count})`;
      tagBtn.addEventListener('click', () => {
        state.activeTag = tag;
        localStorage.setItem('scholar_active_tag', tag);
        if (elements.activeFocusLabel) elements.activeFocusLabel.textContent = tag;
        if (elements.activeFocusSub) elements.activeFocusSub.textContent = `${count} paper${count === 1 ? '' : 's'} in this domain`;
        renderTagFilters();
        renderFeedCards();
      });
      elements.feedTagFilters.appendChild(tagBtn);
    });
  }

  function getFilteredPapers() {
    return state.papers.filter(paper => {
      const matchesTag = state.activeTag === 'ALL' || (Array.isArray(paper.tags) && paper.tags.includes(state.activeTag));
      const query = state.searchQuery.toLowerCase().trim();
      if (!query) return matchesTag;
      const inTitle = (paper.title || '').toLowerCase().includes(query);
      const inSummary = (paper.summary || '').toLowerCase().includes(query);
      const inTags = Array.isArray(paper.tags) && paper.tags.some(t => t.toLowerCase().includes(query));
      return matchesTag && (inTitle || inSummary || inTags);
    }).sort((a, b) => {
      const sortMode = elements.feedSortSelect?.value || 'recent';
      if (sortMode === 'title') return (a.title || '').localeCompare(b.title || '');
      if (sortMode === 'id') return b.paper_id - a.paper_id;
      return new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0);
    });
  }

  function renderFeedCards() {
    const filtered = getFilteredPapers();
    if (elements.showingCountLabel) elements.showingCountLabel.textContent = `Showing ${filtered.length} of ${state.papers.length} discoveries`;
    if (filtered.length === 0) {
      elements.papersFeedStream.innerHTML = `
        <div class="bg-surface-container-lowest rounded-2xl p-10 border border-outline-variant/50 text-center flex flex-col items-center gap-3">
          <span class="material-symbols-outlined text-4xl text-on-surface-variant">${state.papers.length === 0 ? 'upload_file' : 'search_off'}</span>
          <h3 class="font-headline-sm text-lg font-serif font-semibold text-on-surface">${state.papers.length === 0 ? 'No Papers Yet' : 'No Matches'}</h3>
          <p class="text-xs text-on-surface-variant max-w-sm">${state.papers.length === 0 ? 'Click "+ Import PDF / ArXiv URL" to upload your first research paper.' : 'Try selecting "All Categories" or clearing the search bar.'}</p>
        </div>`;
      return;
    }
    elements.papersFeedStream.innerHTML = '';
    filtered.forEach(paper => {
      const isQueued = state.readingQueue.includes(paper.paper_id);
      const formattedDate = formatDate(paper.uploaded_at);
      const card = document.createElement('article');
      card.className = 'bg-surface-container-lowest rounded-2xl p-7 border border-outline-variant/50 shadow-[0_1px_6px_rgba(75,55,40,0.02)] hover:shadow-[0_4px_18px_rgba(75,55,40,0.05)] hover:border-secondary-fixed transition-all flex flex-col gap-space-md';
      const tagsHtml = (paper.tags || []).map(tag => `<button type="button" class="paper-tag-chip text-caption bg-surface-container-low px-2.5 py-1 rounded-lg text-on-surface-variant hover:bg-secondary-container hover:text-on-secondary-container transition-colors cursor-pointer" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('');
      const userEmail = getUserEmail();
      card.innerHTML = `
        <div class="flex items-center justify-between text-xs text-on-surface-variant">
          <div class="flex items-center gap-2">
            <span class="font-label-mono text-[11px] bg-secondary-fixed/50 text-on-secondary-fixed px-2.5 py-0.5 rounded-full font-medium">Paper #${paper.paper_id}</span>
            <span>·</span><span>${formattedDate}</span>
          </div>
          <button type="button" class="queue-toggle-btn text-on-surface-variant hover:text-secondary p-1 rounded transition-colors cursor-pointer" title="${isQueued ? 'Remove from Queue' : 'Add to Queue'}">
            <span class="material-symbols-outlined text-base ${isQueued ? 'text-secondary' : ''}">${isQueued ? 'bookmark' : 'bookmark_border'}</span>
          </button>
        </div>
        <div class="flex flex-col gap-1">
          <h2 class="font-headline-md text-xl md:text-2xl text-on-surface hover:text-secondary transition-colors cursor-pointer font-serif leading-snug font-semibold paper-title-btn">${escapeHtml(paper.title)}</h2>
          <p class="text-xs text-on-surface-variant">Researcher: ${escapeHtml(userEmail)}</p>
        </div>
        <div class="bg-surface-container-low/70 border border-outline-variant/40 p-4 rounded-xl">
          <p class="font-body-reading text-sm text-on-surface leading-relaxed italic line-clamp-3">"${escapeHtml(paper.summary || 'Summary pending...')}"</p>
        </div>
        <div class="flex flex-wrap items-center justify-between pt-2 border-t border-outline-variant/40 gap-2">
          <div class="flex flex-wrap items-center gap-1.5">${tagsHtml}</div>
          <div class="flex items-center gap-space-sm">
            ${paper.file_path ? `<a href="/uploads/${encodeURIComponent(paper.file_path)}" target="_blank" class="bg-surface-container text-on-surface text-xs font-semibold px-3 py-2 rounded-xl hover:bg-surface-container-high transition-colors flex items-center gap-1"><span class="material-symbols-outlined text-sm">picture_as_pdf</span><span>PDF</span></a>` : ''}
            <button class="read-analyze-btn bg-primary text-on-primary text-xs font-semibold px-4 py-2 rounded-xl hover:bg-primary-container transition-all shadow-sm flex items-center gap-1 cursor-pointer" type="button">
              <span>Read & Analyze</span>
              <span class="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </div>`;
      card.querySelector('.paper-title-btn').addEventListener('click', () => { selectPaperForAnalyzer(paper); switchView('analyzer'); });
      card.querySelector('.read-analyze-btn').addEventListener('click', () => { selectPaperForAnalyzer(paper); switchView('analyzer'); });
      card.querySelector('.queue-toggle-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleReadingQueue(paper.paper_id); });
      card.querySelectorAll('.paper-tag-chip').forEach(chip => {
        chip.addEventListener('click', (e) => { e.stopPropagation(); state.activeTag = chip.getAttribute('data-tag'); renderTagFilters(); renderFeedCards(); });
      });
      elements.papersFeedStream.appendChild(card);
    });
  }

  function getUserEmail() {
    try {
      const stored = JSON.parse(localStorage.getItem('scholar_user') || '{}');
      return stored.email || stored.user?.email || 'Your Account';
    } catch { return 'Your Account'; }
  }

  // =========================================================================
  // VIEW 2: PAPER ANALYZER
  // =========================================================================
  function selectPaperForAnalyzer(paper) {
    state.selectedPaper = paper;
    if (elements.analyzerTitle) elements.analyzerTitle.textContent = paper.title || 'Untitled Manuscript';
    if (elements.analyzerPaperIdPill) elements.analyzerPaperIdPill.textContent = `Paper #${paper.paper_id}`;
    if (elements.analyzerUploadedDate) elements.analyzerUploadedDate.textContent = formatDate(paper.uploaded_at);
    if (elements.analyzerRawText) elements.analyzerRawText.textContent = paper.abstract_raw || 'No raw extract available.';
    if (paper.file_path) {
      elements.analyzerPdfDownloadLink.href = `/uploads/${encodeURIComponent(paper.file_path)}`;
      elements.analyzerPdfDownloadLink.classList.remove('hidden');
    } else {
      elements.analyzerPdfDownloadLink.classList.add('hidden');
    }
    elements.analyzerTagsList.innerHTML = '';
    (paper.tags || []).forEach(tag => {
      const tagChip = document.createElement('span');
      tagChip.className = 'font-label-mono text-xs text-secondary bg-secondary-container/60 border border-secondary-fixed/80 px-3 py-1 rounded-full font-medium';
      tagChip.textContent = tag;
      elements.analyzerTagsList.appendChild(tagChip);
    });
    // Reset analysis panels
    if (elements.analyzerExecutiveSummary) elements.analyzerExecutiveSummary.textContent = paper.summary || 'Click "Analyze with AI" to generate.';
    if (elements.analyzerThreeSentence) elements.analyzerThreeSentence.textContent = 'Click "Analyze with AI" to generate a 3-sentence synthesis.';
    if (elements.analyzerMethodology) elements.analyzerMethodology.textContent = 'Click "Analyze with AI" to extract methodology details.';
    if (elements.analyzerCaveats) elements.analyzerCaveats.textContent = 'Click "Analyze with AI" to identify caveats and limitations.';
    // Check cache
    if (state.analysisCache[paper.paper_id]) {
      populateAnalysis(state.analysisCache[paper.paper_id]);
    }
    elements.analyzerDeletePaperBtn.onclick = () => deletePaper(paper.paper_id, paper.title);
  }

  function populateAnalysis(data) {
    if (elements.analyzerExecutiveSummary && data.executive_breakdown) elements.analyzerExecutiveSummary.textContent = data.executive_breakdown;
    if (elements.analyzerThreeSentence && data.three_sentence_synthesis) elements.analyzerThreeSentence.textContent = data.three_sentence_synthesis;
    if (elements.analyzerMethodology && data.methodology) elements.analyzerMethodology.textContent = data.methodology;
    if (elements.analyzerCaveats && data.caveats) elements.analyzerCaveats.textContent = data.caveats;
  }

  // Analyzer tab switching
  const analyzerTabs = {
    'tabExecBtn': 'analyzerExecPanel',
    'tabMethodBtn': 'analyzerMethodPanel',
    'tabCaveatsBtn': 'analyzerCaveatsPanel',
    'tabQABtn': 'analyzerQAPanel'
  };
  Object.keys(analyzerTabs).forEach(btnId => {
    document.getElementById(btnId)?.addEventListener('click', () => switchAnalyzerTab(btnId));
  });
  function switchAnalyzerTab(activeBtnId) {
    Object.keys(analyzerTabs).forEach(btnId => {
      const btn = document.getElementById(btnId);
      const panel = document.getElementById(analyzerTabs[btnId]);
      const isActive = btnId === activeBtnId;
      if (btn) {
        btn.className = isActive
          ? 'analyzer-tab flex-1 py-3 text-xs font-semibold text-center transition-all bg-secondary-container text-on-secondary-container border-b-2 border-secondary cursor-pointer'
          : 'analyzer-tab flex-1 py-3 text-xs font-semibold text-center transition-all text-on-surface-variant hover:bg-surface-container-low cursor-pointer';
      }
      if (panel) panel.classList.toggle('hidden', !isActive);
    });
  }

  // Analyze with AI button
  elements.analyzeWithAiBtn?.addEventListener('click', async () => {
    if (!state.selectedPaper) { showToast('Select a paper first.', 'error'); return; }
    const paperId = state.selectedPaper.paper_id;
    const btn = elements.analyzeWithAiBtn;
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-base animate-spin">progress_activity</span><span>Analyzing...</span>';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    try {
      const res = await fetch(`/api/papers/${paperId}/analyze`, { method: 'POST', signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.analysisCache[paperId] = data;
      populateAnalysis(data);
      showToast('AI analysis complete!');
    } catch (err) {
      clearTimeout(timeoutId);
      showToast(err.name === 'AbortError' ? 'Analysis timed out. Please try again.' : `Analysis failed: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined text-base">auto_awesome</span><span>Analyze with AI</span>';
    }
  });

  // Q&A
  const qaSubmitBtn = document.getElementById('qaSubmitBtn');
  qaSubmitBtn?.addEventListener('click', async () => {
    const input = document.getElementById('qaInput');
    const answerDiv = document.getElementById('qaAnswer');
    const question = input?.value?.trim();
    if (!question) { showToast('Please type a question first.', 'error'); return; }
    if (!state.selectedPaper) { showToast('Select a paper first.', 'error'); return; }

    qaSubmitBtn.disabled = true;
    qaSubmitBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">sync</span><span>Thinking...</span>';
    answerDiv.innerHTML = '<div class="flex items-center gap-2 text-on-surface-variant italic"><span class="material-symbols-outlined text-sm animate-spin text-secondary">sync</span><span>Analyzing paper content with AI...</span></div>';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    try {
      const res = await fetch(`/api/papers/${state.selectedPaper.paper_id}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      answerDiv.textContent = data.answer || 'No answer received.';
    } catch (err) {
      clearTimeout(timeoutId);
      answerDiv.textContent = err.name === 'AbortError'
        ? 'Request timed out due to high cloud server load. Please try asking again.'
        : `Error: ${err.message}`;
    } finally {
      qaSubmitBtn.disabled = false;
      qaSubmitBtn.innerHTML = '<span class="material-symbols-outlined text-sm">send</span><span>Ask</span>';
    }
  });
  // Q&A enter key
  document.getElementById('qaInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('qaSubmitBtn')?.click();
  });

  async function deletePaper(paperId, paperTitle) {
    if (!confirm(`Delete paper #${paperId}: "${paperTitle}"? This cannot be undone.`)) return;
    try {
      const response = await fetch(`/api/papers/${paperId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      showToast(`Paper #${paperId} deleted.`);
      state.readingQueue = state.readingQueue.filter(id => id !== paperId);
      localStorage.setItem('scholar_reading_queue', JSON.stringify(state.readingQueue));
      state.selectedPaper = null;
      await loadPapersFromBackend();
      switchView('feed');
    } catch (err) { showToast(`Delete failed: ${err.message}`, 'error'); }
  }

  // =========================================================================
  // VIEW 3: SYNTHESIS MATRIX
  // =========================================================================
  function renderSynthesisMatrix() {
    elements.matrixTableBody.innerHTML = '';
    if (state.papers.length === 0) {
      elements.matrixTableBody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-on-surface-variant font-mono">No manuscripts. Import papers to populate the matrix.</td></tr>';
      return;
    }
    state.papers.forEach(paper => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-surface-container-low transition-colors';
      const tagsHtml = (paper.tags || []).map(tag => `<span class="inline-block bg-surface-container px-2 py-0.5 rounded text-[10.5px] text-on-surface-variant mr-1 mb-1 font-mono">${escapeHtml(tag)}</span>`).join('');
      tr.innerHTML = `
        <td class="py-3 px-4 font-mono font-medium text-secondary">#${paper.paper_id}</td>
        <td class="py-3 px-4 font-serif font-semibold text-on-surface text-sm"><button type="button" class="text-left hover:text-secondary transition-colors cursor-pointer matrix-paper-link">${escapeHtml(paper.title)}</button></td>
        <td class="py-3 px-4 text-xs text-on-surface leading-relaxed"><p class="line-clamp-2">${escapeHtml(paper.summary || '')}</p></td>
        <td class="py-3 px-4">${tagsHtml}</td>
        <td class="py-3 px-4 text-right">
          <div class="flex items-center justify-end gap-1">
            <button type="button" class="p-1 rounded text-secondary hover:bg-secondary-container/50 inspect-matrix-btn cursor-pointer" title="Inspect"><span class="material-symbols-outlined text-base">visibility</span></button>
            ${paper.file_path ? `<a href="/uploads/${encodeURIComponent(paper.file_path)}" target="_blank" class="p-1 rounded text-on-surface-variant hover:bg-surface-container"><span class="material-symbols-outlined text-base">picture_as_pdf</span></a>` : ''}
          </div>
        </td>`;
      tr.querySelector('.matrix-paper-link').addEventListener('click', () => { selectPaperForAnalyzer(paper); switchView('analyzer'); });
      tr.querySelector('.inspect-matrix-btn').addEventListener('click', () => { selectPaperForAnalyzer(paper); switchView('analyzer'); });
      elements.matrixTableBody.appendChild(tr);
    });
  }

  elements.copyLatexTableBtn?.addEventListener('click', () => {
    let latex = '\\begin{table}[h]\n\\centering\n\\begin{tabular}{|l|p{6cm}|p{6cm}|}\n\\hline\n';
    latex += '\\textbf{ID} & \\textbf{Paper Title} & \\textbf{Core AI Summary} \\\\\n\\hline\n';
    state.papers.slice(0, 10).forEach(p => {
      const t = (p.title || '').replace(/[&%$#_{}]/g, '\\$&').substring(0, 50);
      const s = (p.summary || '').replace(/[&%$#_{}]/g, '\\$&').substring(0, 100);
      latex += `${p.paper_id} & ${t}... & ${s}... \\\\\n\\hline\n`;
    });
    latex += '\\end{tabular}\n\\caption{Scholar\'s Home Literature Synthesis Matrix}\n\\end{table}';
    navigator.clipboard.writeText(latex).then(() => {
      if (elements.copyLatexLabel) { elements.copyLatexLabel.textContent = 'Copied!'; setTimeout(() => { elements.copyLatexLabel.textContent = 'Copy LaTeX Table'; }, 2000); }
      showToast('LaTeX table copied to clipboard!');
    });
  });

  // =========================================================================
  // VIEW 4: CITATION GRAPH (D3.js)
  // =========================================================================
  function populateGraphPaperSelect() {
    const sel = elements.graphPaperSelect;
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">Select a paper...</option>';
    state.papers.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.paper_id;
      opt.textContent = `#${p.paper_id} — ${(p.title || 'Untitled').substring(0, 50)}`;
      sel.appendChild(opt);
    });
    if (currentVal) sel.value = currentVal;
  }

  elements.generateGraphBtn?.addEventListener('click', () => {
    const sel = elements.graphPaperSelect;
    let paperId = sel?.value ? parseInt(sel.value) : null;
    if (!paperId && state.selectedPaper) paperId = state.selectedPaper.paper_id;
    if (!paperId && state.papers.length > 0) paperId = state.papers[0].paper_id;
    if (!paperId) { showToast('No paper selected. Upload a paper first.', 'error'); return; }
    loadCitationGraph(paperId);
  });

  async function loadCitationGraph(paperId) {
    elements.graphLoadingState?.classList.remove('hidden');
    elements.graphNodePanel?.classList.add('hidden');
    elements.graphHelpPanel?.classList.add('hidden');

    const genBtn = elements.generateGraphBtn;
    if (genBtn) {
      genBtn.disabled = true;
      genBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">sync</span><span>Generating...</span>';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    try {
      const res = await fetch(`/api/papers/${paperId}/citation-graph`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.citationGraph = data;
      renderD3Graph(data);
      if (elements.graphNodeCount) elements.graphNodeCount.textContent = (data.nodes || []).length;
      if (elements.graphEdgeCount) elements.graphEdgeCount.textContent = (data.edges || []).length;
      showToast(`Citation graph generated: ${(data.nodes || []).length} nodes, ${(data.edges || []).length} edges`);
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Graph generation error:', err);
      showToast(err.name === 'AbortError' ? 'Generation timed out. Please try again.' : `Graph failed: ${err.message}`, 'error');
      elements.graphHelpPanel?.classList.remove('hidden');
    } finally {
      elements.graphLoadingState?.classList.add('hidden');
      if (genBtn) {
        genBtn.disabled = false;
        genBtn.innerHTML = '<span class="material-symbols-outlined text-sm">hub</span><span>Generate Graph</span>';
      }
    }
  }

  function renderD3Graph(data) {
    const container = elements.citationGraphContainer;
    if (!container || typeof d3 === 'undefined') return;
    container.innerHTML = '';

    const width = container.clientWidth || 700;
    const height = container.clientHeight || 460;

    const nodeColors = { target: '#362e2b', seminal: '#1a4d2e', direct: '#43654d', orthogonal: '#8a817b' };
    const nodeRadius = { target: 18, seminal: 14, direct: 11, orthogonal: 9 };

    const svg = d3.select(container).append('svg')
      .attr('width', width).attr('height', height)
      .attr('viewBox', [0, 0, width, height]);

    const g = svg.append('g');

    // Zoom
    svg.call(d3.zoom().scaleExtent([0.3, 4]).on('zoom', (event) => {
      g.attr('transform', event.transform);
    }));

    const nodes = (data && data.nodes && data.nodes.length > 0) ? data.nodes.map(n => ({ ...n })) : [];
    if (nodes.length === 0) {
      container.innerHTML = '<div class="flex items-center justify-center h-full text-xs text-on-surface-variant font-mono p-8 text-center">No citation nodes available. Select a paper and click Generate Graph.</div>';
      return;
    }

    const nodeIds = new Set(nodes.map(n => n.id));
    const rawEdges = (data && data.edges) ? data.edges : [];
    const edges = rawEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target)).map(e => ({ ...e }));

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id(d => d.id).distance(100).strength(d => d.strength || 0.3))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => (nodeRadius[d.type] || 10) + 5));

    // Edges
    const link = g.append('g').selectAll('line')
      .data(edges).join('line')
      .attr('stroke', '#d4cec7').attr('stroke-width', d => Math.max(1, (d.strength || 0.3) * 3))
      .attr('stroke-opacity', 0.6);

    // Nodes
    const node = g.append('g').selectAll('g')
      .data(nodes).join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    node.append('circle')
      .attr('r', d => nodeRadius[d.type] || 10)
      .attr('fill', d => nodeColors[d.type] || '#8a817b')
      .attr('stroke', d => d.type === 'target' ? '#faf7f2' : 'none')
      .attr('stroke-width', d => d.type === 'target' ? 3 : 0);

    node.append('text')
      .text(d => d.label || '')
      .attr('dy', d => (nodeRadius[d.type] || 10) + 14)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-family', 'Plus Jakarta Sans, sans-serif')
      .attr('fill', '#635d57')
      .each(function() { truncateText(this, 100); });

    // Node click
    node.on('click', (event, d) => {
      event.stopPropagation();
      showNodePanel(d);
    });

    svg.on('click', () => {
      elements.graphNodePanel?.classList.add('hidden');
      elements.graphHelpPanel?.classList.remove('hidden');
    });

    simulation.on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
  }

  function truncateText(textEl, maxWidth) {
    const text = textEl.textContent;
    if (text.length > 25) {
      textEl.textContent = text.substring(0, 22) + '...';
    }
  }

  function showNodePanel(nodeData) {
    elements.graphNodePanel?.classList.remove('hidden');
    elements.graphHelpPanel?.classList.add('hidden');
    const $ = id => document.getElementById(id);
    if ($('gnPaperTitle')) $('gnPaperTitle').textContent = nodeData.label || '—';
    if ($('gnAuthors')) $('gnAuthors').textContent = nodeData.authors || '—';
    if ($('gnYear')) $('gnYear').textContent = nodeData.year || '—';
    if ($('gnVenue')) $('gnVenue').textContent = nodeData.venue || '—';
    if ($('gnCitations')) $('gnCitations').textContent = nodeData.citations || '0';
    if ($('gnDescription')) $('gnDescription').textContent = nodeData.description || '—';
    if ($('gnType')) $('gnType').textContent = nodeData.type || '—';
  }

  document.getElementById('closeNodePanel')?.addEventListener('click', () => {
    elements.graphNodePanel?.classList.add('hidden');
    elements.graphHelpPanel?.classList.remove('hidden');
  });

  // =========================================================================
  // READING QUEUE
  // =========================================================================
  function toggleReadingQueue(paperId) {
    if (state.readingQueue.includes(paperId)) {
      state.readingQueue = state.readingQueue.filter(id => id !== paperId);
      showToast('Removed from reading queue.');
    } else {
      state.readingQueue.push(paperId);
      showToast('Added to reading queue.');
    }
    localStorage.setItem('scholar_reading_queue', JSON.stringify(state.readingQueue));
    renderFeedCards();
    renderReadingQueue();
  }

  function renderReadingQueue() {
    const count = state.readingQueue.length;
    if (elements.headerQueueCount) elements.headerQueueCount.textContent = count;
    if (elements.sideQueueBadge) elements.sideQueueBadge.textContent = `${count} item${count === 1 ? '' : 's'}`;
    const queuedPapers = state.papers.filter(p => state.readingQueue.includes(p.paper_id));
    if (queuedPapers.length === 0) {
      elements.readingQueueList.innerHTML = '<div class="p-3 bg-surface-container-low/60 rounded-xl text-xs text-on-surface-variant">No papers queued. Click bookmark on any paper.</div>';
      return;
    }
    elements.readingQueueList.innerHTML = '';
    queuedPapers.forEach(paper => {
      const item = document.createElement('div');
      item.className = 'p-3 bg-surface-container-low/60 rounded-xl flex items-center justify-between hover:bg-surface-container-low transition-colors';
      item.innerHTML = `
        <div class="flex flex-col min-w-0 pr-2">
          <span class="text-xs text-on-surface font-semibold truncate cursor-pointer queue-item-title">${escapeHtml(paper.title)}</span>
          <span class="text-[11px] text-on-surface-variant">AI summary available</span>
        </div>
        <span class="material-symbols-outlined text-secondary text-lg cursor-pointer queue-play-btn">play_circle</span>`;
      item.querySelector('.queue-item-title').addEventListener('click', () => { selectPaperForAnalyzer(paper); switchView('analyzer'); });
      item.querySelector('.queue-play-btn').addEventListener('click', () => { selectPaperForAnalyzer(paper); switchView('analyzer'); });
      elements.readingQueueList.appendChild(item);
    });
  }

  // =========================================================================
  // UPLOAD MODAL
  // =========================================================================
  elements.openUploadModalBtn?.addEventListener('click', () => { elements.importPdfModal.classList.remove('hidden'); resetModalProgress(); });
  elements.closeUploadModalBtn?.addEventListener('click', () => { if (!state.isUploading) elements.importPdfModal.classList.add('hidden'); });
  elements.cancelUploadBtn?.addEventListener('click', () => { if (!state.isUploading) elements.importPdfModal.classList.add('hidden'); });
  elements.modalDropZone?.addEventListener('click', () => { if (!state.isUploading) elements.modalFileInput.click(); });
  ['dragenter', 'dragover'].forEach(ev => { elements.modalDropZone?.addEventListener(ev, e => { e.preventDefault(); elements.modalDropZone.classList.add('border-secondary', 'bg-surface-container-low'); }); });
  ['dragleave', 'drop'].forEach(ev => { elements.modalDropZone?.addEventListener(ev, e => { e.preventDefault(); elements.modalDropZone.classList.remove('border-secondary', 'bg-surface-container-low'); }); });
  elements.modalDropZone?.addEventListener('drop', e => { if (e.dataTransfer?.files?.[0]) handleFileUpload(e.dataTransfer.files[0]); });
  elements.modalFileInput?.addEventListener('change', e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); });

  function resetModalProgress() {
    elements.modalProgressStepper.classList.add('hidden');
    elements.modalDropZone.classList.remove('hidden');
    elements.modalFileInput.value = '';
    elements.stepLabel1.className = 'text-secondary font-bold';
    elements.stepLabel2.className = 'text-on-surface-variant';
    elements.stepLabel3.className = 'text-on-surface-variant';
  }

  async function handleFileUpload(file) {
    if (!file || state.isUploading) return;
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') { showToast('Only PDF files are supported.', 'error'); return; }
    state.isUploading = true;
    elements.modalDropZone.classList.add('hidden');
    elements.modalProgressStepper.classList.remove('hidden');
    elements.modalStepperTitle.textContent = '1. Extracting text from PDF...';
    elements.stepLabel1.className = 'text-secondary font-bold';
    const t1 = setTimeout(() => { elements.modalStepperTitle.textContent = '2. AI synthesis with Gemini...'; elements.stepLabel1.className = 'text-on-surface-variant line-through'; elements.stepLabel2.className = 'text-secondary font-bold'; }, 1400);
    const t2 = setTimeout(() => { elements.modalStepperTitle.textContent = '3. Saving to database...'; elements.stepLabel2.className = 'text-on-surface-variant line-through'; elements.stepLabel3.className = 'text-secondary font-bold'; }, 3800);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('/api/upload-pdf', { method: 'POST', body: formData });
      clearTimeout(t1); clearTimeout(t2);
      if (!response.ok) { const errJson = await response.json().catch(() => ({})); throw new Error(errJson.error || `Upload failed HTTP ${response.status}`); }
      const savedPaper = await response.json();
      showToast(`"${savedPaper.title}" ingested & indexed!`);
      await loadPapersFromBackend();
      selectPaperForAnalyzer(savedPaper);
      elements.importPdfModal.classList.add('hidden');
      switchView('analyzer');
    } catch (err) { showToast(err.message, 'error'); resetModalProgress(); } finally { state.isUploading = false; }
  }

  // =========================================================================
  // UTILITIES
  // =========================================================================
  function formatDate(dateStr) {
    if (!dateStr) return 'Recent';
    try { return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return dateStr; }
  }
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Live search
  let searchTimer = null;
  elements.mainSearchInput?.addEventListener('input', e => { state.searchQuery = e.target.value; clearTimeout(searchTimer); searchTimer = setTimeout(() => renderFeedCards(), 150); });
  document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); elements.mainSearchInput?.focus(); } });
  elements.feedSortSelect?.addEventListener('change', () => renderFeedCards());

  // Export
  elements.quickExportNotesBtn?.addEventListener('click', () => {
    const text = `Scholar's Home Daily Briefing\nDate: ${new Date().toLocaleDateString()}\nTotal Papers: ${state.papers.length}\n\n` +
      state.papers.slice(0, 5).map((p, i) => `${i + 1}. ${p.title}\nSummary: ${p.summary}\n`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ScholarHome_Briefing_${new Date().toISOString().slice(0, 10)}.txt`; a.click();
    showToast('Briefing exported.');
  });
  elements.exportBibtexBtn?.addEventListener('click', () => {
    if (state.papers.length === 0) { showToast('No papers to export.', 'error'); return; }
    const bibtex = state.papers.map(p => {
      const key = (p.title || 'paper').replace(/[^a-zA-Z0-9]/g, '').substring(0, 15).toLowerCase() + p.paper_id;
      return `@article{${key},\n  title={${p.title}},\n  year={${new Date(p.uploaded_at || Date.now()).getFullYear()}},\n  note={Indexed in Scholar's Home}\n}`;
    }).join('\n\n');
    const blob = new Blob([bibtex], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'scholarshome_library.bib'; a.click();
    showToast('BibTeX exported.');
  });

  // =========================================================================
  // INITIALIZATION
  // =========================================================================
  // Auto-detect view from URL path
  const pathMap = { '/analyzer': 'analyzer', '/matrix': 'matrix', '/graph': 'graph', '/feed': 'feed', '/': 'feed' };
  const pathView = pathMap[window.location.pathname];
  if (pathView) state.activeView = pathView;

  pollHealth();
  loadPapersFromBackend();
  switchView(state.activeView);
  setInterval(pollHealth, 25000);
});
