/**
 * Scholar's Home — Production SPA Controller
 * Vanilla JavaScript (ES6+), Fetch API, DOM manipulation, localStorage
 * Stitch Project 3755780600128896057 Architectural Implementation
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
    isUploading: false
  };

  // =========================================================================
  // DOM ELEMENT REFERENCES
  // =========================================================================
  const elements = {
    // Navigation & Views
    sidebarNav: document.getElementById('sidebarNav'),
    navBtns: document.querySelectorAll('.nav-tab-btn'),
    views: {
      feed: document.getElementById('viewFeed'),
      analyzer: document.getElementById('viewAnalyzer'),
      matrix: document.getElementById('viewMatrix'),
      graph: document.getElementById('viewGraph')
    },

    // Header & Search
    mainSearchInput: document.getElementById('mainSearchInput'),
    headerQueueCount: document.getElementById('headerQueueCount'),
    readingQueueBtn: document.getElementById('readingQueueBtn'),

    // Feed View Elements
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

    // Paper Analyzer Elements
    analyzerTitle: document.getElementById('analyzerTitle'),
    analyzerExecutiveSummary: document.getElementById('analyzerExecutiveSummary'),
    analyzerPaperIdPill: document.getElementById('analyzerPaperIdPill'),
    analyzerUploadedDate: document.getElementById('analyzerUploadedDate'),
    analyzerAuthorLine: document.getElementById('analyzerAuthorLine'),
    analyzerPdfDownloadLink: document.getElementById('analyzerPdfDownloadLink'),
    analyzerTagsList: document.getElementById('analyzerTagsList'),
    analyzerRawText: document.getElementById('analyzerRawText'),
    analyzerDeletePaperBtn: document.getElementById('analyzerDeletePaperBtn'),

    // Matrix View Elements
    matrixTableBody: document.getElementById('matrixTableBody'),
    copyLatexTableBtn: document.getElementById('copyLatexTableBtn'),
    copyLatexLabel: document.getElementById('copyLatexLabel'),
    matrixCountBadge: document.getElementById('matrixCountBadge'),

    // Graph View Elements
    taxonomyNetworkCanvas: document.getElementById('taxonomyNetworkCanvas'),
    graphStatsPill: document.getElementById('graphStatsPill'),
    graphNodesCount: document.getElementById('graphNodesCount'),

    // Upload Modal Elements
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

    // System Health
    systemHealthText: document.getElementById('systemHealthText'),
    serverPulse: document.getElementById('serverPulse'),
    dbStatusDot: document.getElementById('dbStatusDot'),
    sidebarDbStatusText: document.getElementById('sidebarDbStatusText'),

    // Toast
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

    // Update active tab buttons in sidebar
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

    // Hide all view containers, show target
    Object.keys(elements.views).forEach(v => {
      elements.views[v].classList.add('hidden');
    });
    elements.views[viewName].classList.remove('hidden');

    // Trigger view-specific re-renders
    if (viewName === 'matrix') {
      renderSynthesisMatrix();
    } else if (viewName === 'graph') {
      renderTaxonomyGraph();
    } else if (viewName === 'feed') {
      renderFeedCards();
    }
  }

  elements.navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.getAttribute('data-view');
      switchView(targetView);
    });
  });

  // =========================================================================
  // HEALTH CHECK POLLING
  // =========================================================================
  async function pollHealth() {
    try {
      const response = await fetch('/health');
      const data = await response.json();
      if (response.ok && data.database?.status === 'connected') {
        elements.systemHealthText.textContent = 'Backend Online';
        elements.serverPulse.className = 'h-2 w-2 rounded-full bg-secondary animate-pulse';
        elements.dbStatusDot.className = 'h-2.5 w-2.5 rounded-full bg-secondary';
        elements.sidebarDbStatusText.textContent = '3NF PostgreSQL 15';
      } else {
        elements.systemHealthText.textContent = 'DB Degraded';
        elements.serverPulse.className = 'h-2 w-2 rounded-full bg-error';
        elements.dbStatusDot.className = 'h-2.5 w-2.5 rounded-full bg-error';
        elements.sidebarDbStatusText.textContent = 'Postgres Reconnecting';
      }
    } catch {
      elements.systemHealthText.textContent = 'Server Offline';
      elements.serverPulse.className = 'h-2 w-2 rounded-full bg-error';
      elements.dbStatusDot.className = 'h-2.5 w-2.5 rounded-full bg-error';
      elements.sidebarDbStatusText.textContent = 'Postgres Offline';
    }
  }

  // =========================================================================
  // DATA FETCHING & SYNCHRONIZATION
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

      // If no paper is currently selected in analyzer, select the first one
      if (state.papers.length > 0 && !state.selectedPaper) {
        selectPaperForAnalyzer(state.papers[0]);
      }
    } catch (err) {
      console.error('Failed to load papers:', err);
      showToast(`Error fetching papers: ${err.message}`, 'error');
    }
  }

  function updateStats() {
    const totalPapers = state.papers.length;
    elements.statPapersCount.textContent = totalPapers;
    elements.feedCounterBadge.textContent = `${totalPapers} paper${totalPapers === 1 ? '' : 's'}`;
    elements.bibtexTrayCount.textContent = totalPapers;

    const allTags = new Set();
    state.papers.forEach(p => {
      if (Array.isArray(p.tags)) p.tags.forEach(t => allTags.add(t));
    });

    elements.statTagsCount.textContent = `${allTags.size} normalized taxonomy tags`;
    elements.graphStatsPill.textContent = `${totalPapers} papers · ${allTags.size} tags`;
    elements.graphNodesCount.textContent = `${allTags.size} tags`;
    elements.matrixCountBadge.textContent = `${totalPapers} rows`;
  }

  // =========================================================================
  // VIEW 1: RESEARCH FEED RENDERING
  // =========================================================================
  function renderTagFilters() {
    const allTags = new Set();
    state.papers.forEach(p => {
      if (Array.isArray(p.tags)) p.tags.forEach(t => allTags.add(t));
    });

    elements.feedTagFilters.innerHTML = '';

    // "All Categories" pill
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = `tag-filter-btn text-xs px-4 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap ${state.activeTag === 'ALL' ? 'active bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-outline-variant/40'}`;
    allBtn.textContent = 'All Categories';
    allBtn.addEventListener('click', () => {
      state.activeTag = 'ALL';
      localStorage.setItem('scholar_active_tag', 'ALL');
      elements.activeFocusLabel.textContent = 'All Domains';
      elements.activeFocusSub.textContent = 'Showing all indexed manuscripts';
      renderTagFilters();
      renderFeedCards();
    });
    elements.feedTagFilters.appendChild(allBtn);

    // Individual tag pills
    Array.from(allTags).sort().forEach(tag => {
      const count = state.papers.filter(p => Array.isArray(p.tags) && p.tags.includes(tag)).length;
      const tagBtn = document.createElement('button');
      tagBtn.type = 'button';
      const isActive = state.activeTag === tag;
      tagBtn.className = `tag-filter-btn text-xs px-4 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap ${isActive ? 'active bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-outline-variant/40'}`;
      tagBtn.textContent = `${tag} (${count})`;
      tagBtn.addEventListener('click', () => {
        state.activeTag = tag;
        localStorage.setItem('scholar_active_tag', tag);
        elements.activeFocusLabel.textContent = tag;
        elements.activeFocusSub.textContent = `${count} paper${count === 1 ? '' : 's'} in this taxonomy domain`;
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
      if (sortMode === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      } else if (sortMode === 'id') {
        return b.paper_id - a.paper_id;
      }
      return new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0);
    });
  }

  function renderFeedCards() {
    const filtered = getFilteredPapers();
    elements.showingCountLabel.textContent = `Showing ${filtered.length} of ${state.papers.length} discoveries`;

    if (filtered.length === 0) {
      elements.papersFeedStream.innerHTML = `
        <div class="bg-surface-container-lowest rounded-2xl p-10 border border-outline-variant/50 text-center flex flex-col items-center gap-3">
          <div class="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
            <span class="material-symbols-outlined text-2xl">search_off</span>
          </div>
          <h3 class="font-headline-sm text-lg font-serif font-semibold text-on-surface">No Research Manuscripts Found</h3>
          <p class="text-xs text-on-surface-variant max-w-sm">
            ${state.papers.length === 0 ? 'Click "+ Import PDF / ArXiv URL" in the sidebar to upload and parse your first research paper.' : 'No papers match your active search and filter criteria. Try selecting "All Categories" or clearing the search bar.'}
          </p>
        </div>
      `;
      return;
    }

    elements.papersFeedStream.innerHTML = '';

    filtered.forEach(paper => {
      const isQueued = state.readingQueue.includes(paper.paper_id);
      const formattedDate = formatDate(paper.uploaded_at);

      const card = document.createElement('article');
      card.className = 'bg-surface-container-lowest rounded-2xl p-7 border border-outline-variant/50 shadow-[0_1px_6px_rgba(75,55,40,0.02)] hover:shadow-[0_4px_18px_rgba(75,55,40,0.05)] hover:border-secondary-fixed transition-all flex flex-col gap-space-md';

      // Tags HTML
      const tagsHtml = (paper.tags || []).map(tag => `
        <button type="button" class="paper-tag-chip text-caption bg-surface-container-low px-2.5 py-1 rounded-lg text-on-surface-variant hover:bg-secondary-container hover:text-on-secondary-container transition-colors cursor-pointer" data-tag="${escapeHtml(tag)}">
          ${escapeHtml(tag)}
        </button>
      `).join('');

      card.innerHTML = `
        <div class="flex items-center justify-between text-xs text-on-surface-variant">
          <div class="flex items-center gap-2">
            <span class="font-label-mono text-[11px] bg-secondary-fixed/50 text-on-secondary-fixed px-2.5 py-0.5 rounded-full font-medium">Paper #${paper.paper_id}</span>
            <span>·</span>
            <span>${formattedDate}</span>
            <span>·</span>
            <span>3NF PostgreSQL</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="font-label-mono text-[11px] text-secondary font-semibold bg-secondary-container/50 px-2.5 py-0.5 rounded-full border border-secondary-fixed/70">Novelty 9.2</span>
            <button type="button" class="queue-toggle-btn text-on-surface-variant hover:text-secondary p-1 rounded transition-colors cursor-pointer" title="${isQueued ? 'Remove from Queue' : 'Add to Queue'}">
              <span class="material-symbols-outlined text-base ${isQueued ? 'text-secondary' : ''}">${isQueued ? 'bookmark' : 'bookmark_border'}</span>
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <h2 class="font-headline-md text-xl md:text-2xl text-on-surface hover:text-secondary transition-colors cursor-pointer font-serif leading-snug font-semibold paper-title-btn">
            ${escapeHtml(paper.title)}
          </h2>
          <p class="text-xs text-on-surface-variant">Lead Researcher: ${escapeHtml((JSON.parse(localStorage.getItem('scholar_user') || '{}').email) || (JSON.parse(localStorage.getItem('scholar_user') || '{}').user?.email) || 'Your Account')}</p>
        </div>

        <div class="bg-surface-container-low/70 border border-outline-variant/40 p-4 rounded-xl">
          <p class="font-body-reading text-sm text-on-surface leading-relaxed italic line-clamp-3">
            “${escapeHtml(paper.summary || 'Summary generated via Gemini 2.5 Flash.')}”
          </p>
        </div>

        <div class="flex flex-wrap items-center justify-between pt-2 border-t border-outline-variant/40 gap-2">
          <div class="flex flex-wrap items-center gap-1.5">
            ${tagsHtml}
          </div>
          <div class="flex items-center gap-space-sm">
            ${paper.file_path ? `
              <a href="/uploads/${encodeURIComponent(paper.file_path)}" target="_blank" class="bg-surface-container text-on-surface text-xs font-semibold px-3 py-2 rounded-xl hover:bg-surface-container-high transition-colors flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">picture_as_pdf</span>
                <span>PDF</span>
              </a>
            ` : ''}
            <button class="read-analyze-btn bg-primary text-on-primary text-xs font-semibold px-4 py-2 rounded-xl hover:bg-primary-container transition-all shadow-sm flex items-center gap-1 cursor-pointer" type="button">
              <span>Read & Analyze</span>
              <span class="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </div>
      `;

      // Event Listeners
      card.querySelector('.paper-title-btn').addEventListener('click', () => {
        selectPaperForAnalyzer(paper);
        switchView('analyzer');
      });

      card.querySelector('.read-analyze-btn').addEventListener('click', () => {
        selectPaperForAnalyzer(paper);
        switchView('analyzer');
      });

      card.querySelector('.queue-toggle-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleReadingQueue(paper.paper_id);
      });

      card.querySelectorAll('.paper-tag-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          const tag = chip.getAttribute('data-tag');
          state.activeTag = tag;
          renderTagFilters();
          renderFeedCards();
        });
      });

      elements.papersFeedStream.appendChild(card);
    });
  }

  // =========================================================================
  // VIEW 2: PAPER ANALYZER (Screen 4 Fidelity)
  // =========================================================================
  function selectPaperForAnalyzer(paper) {
    state.selectedPaper = paper;

    elements.analyzerTitle.textContent = paper.title || 'Untitled Manuscript';
    elements.analyzerExecutiveSummary.textContent = paper.summary || 'No AI summary available.';
    elements.analyzerPaperIdPill.textContent = `Paper #${paper.paper_id}`;
    elements.analyzerUploadedDate.textContent = formatDate(paper.uploaded_at);
    elements.analyzerRawText.textContent = paper.abstract_raw || 'No raw extract available.';

    if (paper.file_path) {
      elements.analyzerPdfDownloadLink.href = `/uploads/${encodeURIComponent(paper.file_path)}`;
      elements.analyzerPdfDownloadLink.classList.remove('hidden');
    } else {
      elements.analyzerPdfDownloadLink.classList.add('hidden');
    }

    // Render tags
    elements.analyzerTagsList.innerHTML = '';
    (paper.tags || []).forEach(tag => {
      const tagChip = document.createElement('span');
      tagChip.className = 'font-label-mono text-xs text-secondary bg-secondary-container/60 border border-secondary-fixed/80 px-3 py-1 rounded-full font-medium';
      tagChip.textContent = tag;
      elements.analyzerTagsList.appendChild(tagChip);
    });

    // Delete handler
    elements.analyzerDeletePaperBtn.onclick = () => {
      deletePaper(paper.paper_id, paper.title);
    };
  }

  async function deletePaper(paperId, paperTitle) {
    if (!confirm(`Are you sure you want to delete paper #${paperId}: "${paperTitle}"?\nThis cascades through 3NF PostgreSQL and deletes the PDF binary.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/papers/${paperId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      showToast(`Paper #${paperId} deleted successfully.`);
      state.readingQueue = state.readingQueue.filter(id => id !== paperId);
      localStorage.setItem('scholar_reading_queue', JSON.stringify(state.readingQueue));

      await loadPapersFromBackend();
      switchView('feed');
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  }

  // =========================================================================
  // VIEW 3: SYNTHESIS MATRIX (Screen 2 Fidelity)
  // =========================================================================
  function renderSynthesisMatrix() {
    elements.matrixTableBody.innerHTML = '';

    if (state.papers.length === 0) {
      elements.matrixTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="py-8 text-center text-on-surface-variant font-mono">
            No manuscripts available in matrix. Import papers above.
          </td>
        </tr>
      `;
      return;
    }

    state.papers.forEach(paper => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-surface-container-low transition-colors';

      const tagsHtml = (paper.tags || []).map(tag => `
        <span class="inline-block bg-surface-container px-2 py-0.5 rounded text-[10.5px] text-on-surface-variant mr-1 mb-1 font-mono">
          ${escapeHtml(tag)}
        </span>
      `).join('');

      tr.innerHTML = `
        <td class="py-3 px-4 font-mono font-medium text-secondary">#${paper.paper_id}</td>
        <td class="py-3 px-4 font-serif font-semibold text-on-surface text-sm">
          <button type="button" class="text-left hover:text-secondary transition-colors cursor-pointer matrix-paper-link">
            ${escapeHtml(paper.title)}
          </button>
        </td>
        <td class="py-3 px-4 text-xs text-on-surface leading-relaxed">
          <p class="line-clamp-2">${escapeHtml(paper.summary || '')}</p>
        </td>
        <td class="py-3 px-4">${tagsHtml}</td>
        <td class="py-3 px-4 text-right">
          <div class="flex items-center justify-end gap-1">
            <button type="button" class="p-1 rounded text-secondary hover:bg-secondary-container/50 inspect-matrix-btn cursor-pointer" title="Inspect">
              <span class="material-symbols-outlined text-base">visibility</span>
            </button>
            ${paper.file_path ? `
              <a href="/uploads/${encodeURIComponent(paper.file_path)}" target="_blank" class="p-1 rounded text-on-surface-variant hover:bg-surface-container" title="PDF">
                <span class="material-symbols-outlined text-base">picture_as_pdf</span>
              </a>
            ` : ''}
          </div>
        </td>
      `;

      tr.querySelector('.matrix-paper-link').addEventListener('click', () => {
        selectPaperForAnalyzer(paper);
        switchView('analyzer');
      });

      tr.querySelector('.inspect-matrix-btn').addEventListener('click', () => {
        selectPaperForAnalyzer(paper);
        switchView('analyzer');
      });

      elements.matrixTableBody.appendChild(tr);
    });
  }

  // Copy LaTeX Table
  elements.copyLatexTableBtn?.addEventListener('click', () => {
    let latex = '\\begin{table}[h]\n\\centering\n\\begin{tabular}{|l|p{6cm}|p{6cm}|}\n\\hline\n';
    latex += '\\textbf{ID} & \\textbf{Paper Title} & \\textbf{Core AI Summary} \\\\\n\\hline\n';

    state.papers.slice(0, 10).forEach(p => {
      const cleanTitle = (p.title || '').replace(/[&%$#_{}]/g, '\\$&').substring(0, 50);
      const cleanSummary = (p.summary || '').replace(/[&%$#_{}]/g, '\\$&').substring(0, 100);
      latex += `${p.paper_id} & ${cleanTitle}... & ${cleanSummary}... \\\\\n\\hline\n`;
    });

    latex += '\\end{tabular}\n\\caption{Scholar\'s Home Literature Synthesis Matrix}\n\\end{table}';

    navigator.clipboard.writeText(latex).then(() => {
      elements.copyLatexLabel.textContent = 'Copied to Clipboard!';
      setTimeout(() => {
        elements.copyLatexLabel.textContent = 'Copy LaTeX Table';
      }, 2000);
      showToast('LaTeX table code copied to clipboard!');
    });
  });

  // =========================================================================
  // VIEW 4: CITATION & TAXONOMY GRAPH (Screen 3 Fidelity)
  // =========================================================================
  function renderTaxonomyGraph() {
    const canvas = elements.taxonomyNetworkCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (state.papers.length === 0) {
      ctx.fillStyle = '#635d57';
      ctx.font = '14px Plus Jakarta Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No papers or taxonomy nodes to display yet.', width / 2, height / 2);
      return;
    }

    // Extract nodes and links
    const paperNodes = state.papers.slice(0, 12).map((p, idx) => ({
      id: `p_${p.paper_id}`,
      label: p.title.substring(0, 20) + '...',
      type: 'paper',
      x: 180 + (idx % 4) * 180 + Math.sin(idx) * 30,
      y: 120 + Math.floor(idx / 4) * 130 + Math.cos(idx) * 20
    }));

    const allTags = new Set();
    state.papers.forEach(p => {
      if (Array.isArray(p.tags)) p.tags.slice(0, 3).forEach(t => allTags.add(t));
    });

    const tagNodes = Array.from(allTags).slice(0, 10).map((t, idx) => ({
      id: `t_${idx}`,
      label: t,
      type: 'tag',
      x: 120 + (idx % 5) * 160 + (idx % 2 === 0 ? 30 : -30),
      y: 80 + (idx % 3) * 150
    }));

    // Draw Edges (Links)
    ctx.strokeStyle = '#d4cec7';
    ctx.lineWidth = 1.2;

    paperNodes.forEach(pNode => {
      tagNodes.forEach(tNode => {
        const dist = Math.hypot(pNode.x - tNode.x, pNode.y - tNode.y);
        if (dist < 220) {
          ctx.beginPath();
          ctx.moveTo(pNode.x, pNode.y);
          ctx.lineTo(tNode.x, tNode.y);
          ctx.stroke();
        }
      });
    });

    // Draw Tag Nodes (Green Circles)
    tagNodes.forEach(node => {
      ctx.fillStyle = '#43654d';
      ctx.beginPath();
      ctx.arc(node.x, node.y, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#24201e';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(node.label, node.x, node.y - 12);
    });

    // Draw Paper Nodes (Dark Brown Circles)
    paperNodes.forEach(node => {
      ctx.fillStyle = '#362e2b';
      ctx.beginPath();
      ctx.arc(node.x, node.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#faf7f2';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#635d57';
      ctx.font = '11px Plus Jakarta Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.label, node.x, node.y + 22);
    });
  }

  // =========================================================================
  // READING QUEUE MANAGEMENT
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
    elements.headerQueueCount.textContent = count;
    elements.sideQueueBadge.textContent = `${count} item${count === 1 ? '' : 's'}`;

    const queuedPapers = state.papers.filter(p => state.readingQueue.includes(p.paper_id));

    if (queuedPapers.length === 0) {
      elements.readingQueueList.innerHTML = `
        <div class="p-3 bg-surface-container-low/60 rounded-xl flex items-center justify-between text-xs text-on-surface-variant">
          <span>No papers queued yet. Click bookmark on any paper card.</span>
        </div>
      `;
      return;
    }

    elements.readingQueueList.innerHTML = '';
    queuedPapers.forEach(paper => {
      const item = document.createElement('div');
      item.className = 'p-3 bg-surface-container-low/60 rounded-xl flex items-center justify-between hover:bg-surface-container-low transition-colors';
      item.innerHTML = `
        <div class="flex flex-col min-w-0 pr-2">
          <span class="text-xs text-on-surface font-semibold truncate cursor-pointer queue-item-title">${escapeHtml(paper.title)}</span>
          <span class="text-[11px] text-on-surface-variant">5 min AI summary</span>
        </div>
        <span class="material-symbols-outlined text-secondary text-lg cursor-pointer queue-play-btn" title="Inspect">play_circle</span>
      `;

      item.querySelector('.queue-item-title').addEventListener('click', () => {
        selectPaperForAnalyzer(paper);
        switchView('analyzer');
      });
      item.querySelector('.queue-play-btn').addEventListener('click', () => {
        selectPaperForAnalyzer(paper);
        switchView('analyzer');
      });

      elements.readingQueueList.appendChild(item);
    });
  }

  // =========================================================================
  // MODAL UPLOAD WORKFLOW
  // =========================================================================
  elements.openUploadModalBtn?.addEventListener('click', () => {
    elements.importPdfModal.classList.remove('hidden');
    resetModalProgress();
  });

  elements.closeUploadModalBtn?.addEventListener('click', () => {
    if (!state.isUploading) elements.importPdfModal.classList.add('hidden');
  });

  elements.cancelUploadBtn?.addEventListener('click', () => {
    if (!state.isUploading) elements.importPdfModal.classList.add('hidden');
  });

  elements.modalDropZone?.addEventListener('click', () => {
    if (!state.isUploading) elements.modalFileInput.click();
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    elements.modalDropZone?.addEventListener(eventName, (e) => {
      e.preventDefault();
      elements.modalDropZone.classList.add('border-secondary', 'bg-surface-container-low');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    elements.modalDropZone?.addEventListener(eventName, (e) => {
      e.preventDefault();
      elements.modalDropZone.classList.remove('border-secondary', 'bg-surface-container-low');
    });
  });

  elements.modalDropZone?.addEventListener('drop', (e) => {
    if (e.dataTransfer?.files?.[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  });

  elements.modalFileInput?.addEventListener('change', (e) => {
    if (e.target.files?.[0]) {
      handleFileUpload(e.target.files[0]);
    }
  });

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

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      showToast('Only standard PDF files are supported.', 'error');
      return;
    }

    state.isUploading = true;
    elements.modalDropZone.classList.add('hidden');
    elements.modalProgressStepper.classList.remove('hidden');

    elements.modalStepperTitle.textContent = '1. Extracting text via pypdf...';
    elements.stepLabel1.className = 'text-secondary font-bold';

    const t1 = setTimeout(() => {
      elements.modalStepperTitle.textContent = '2. Synthesizing structured summary with Gemini 2.5 Flash...';
      elements.stepLabel1.className = 'text-on-surface-variant line-through';
      elements.stepLabel2.className = 'text-secondary font-bold';
    }, 1400);

    const t2 = setTimeout(() => {
      elements.modalStepperTitle.textContent = '3. Committing 3NF transaction to PostgreSQL...';
      elements.stepLabel2.className = 'text-on-surface-variant line-through';
      elements.stepLabel3.className = 'text-secondary font-bold';
    }, 3800);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData
      });

      clearTimeout(t1);
      clearTimeout(t2);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Upload failed with HTTP ${response.status}`);
      }

      const savedPaper = await response.json();
      showToast(`"${savedPaper.title}" ingested & indexed!`);

      await loadPapersFromBackend();
      selectPaperForAnalyzer(savedPaper);
      elements.importPdfModal.classList.add('hidden');
      switchView('analyzer');

    } catch (err) {
      console.error('Upload failed:', err);
      showToast(err.message, 'error');
      resetModalProgress();
    } finally {
      state.isUploading = false;
    }
  }

  // =========================================================================
  // UTILITIES & SEARCH
  // =========================================================================
  function formatDate(dateStr) {
    if (!dateStr) return 'Recent';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Live search input
  let searchTimer = null;
  elements.mainSearchInput?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      renderFeedCards();
    }, 150);
  });

  // ⌘K / Ctrl+K keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      elements.mainSearchInput?.focus();
    }
  });

  // Sort change listener
  elements.feedSortSelect?.addEventListener('change', () => {
    renderFeedCards();
  });

  // Quick export notes
  elements.quickExportNotesBtn?.addEventListener('click', () => {
    const text = `Scholar's Home Daily Briefing\nDate: ${new Date().toLocaleDateString()}\nTotal Papers: ${state.papers.length}\n\nTop Discoveries:\n` +
      state.papers.slice(0, 5).map((p, i) => `${i + 1}. ${p.title}\nSummary: ${p.summary}\n`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Scholarshome_Briefing_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    showToast('Daily briefing exported to text file.');
  });

  // BibTeX export
  elements.exportBibtexBtn?.addEventListener('click', () => {
    if (state.papers.length === 0) {
      showToast('No papers in library to export.', 'error');
      return;
    }
    const bibtex = state.papers.map(p => {
      const citeKey = (p.title || 'paper').replace(/[^a-zA-Z0-9]/g, '').substring(0, 15).toLowerCase() + p.paper_id;
      return `@article{${citeKey},\n  title={${p.title}},\n  author={Lead Researcher},\n  year={${new Date(p.uploaded_at || Date.now()).getFullYear()}},\n  note={Indexed in Scholar's Home 3NF PostgreSQL}\n}`;
    }).join('\n\n');

    const blob = new Blob([bibtex], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scholarshome_library.bib';
    a.click();
    showToast('BibTeX bibliography exported successfully.');
  });

  // =========================================================================
  // INITIALIZATION RUNNER
  // =========================================================================
  pollHealth();
  loadPapersFromBackend();
  switchView(state.activeView);
  setInterval(pollHealth, 25000); // 25s healthcheck heartbeat
});
