/**
 * Scholar's Home - Client-side Auth & Per-User Data Integration
 * Handles:
 * 1. Session verification & automatic redirect to /welcome for unauthenticated visitors
 * 2. User identity binding (display name, email, avatar) across all Stitch screens
 * 3. Sign Out button injection and session termination (POST /api/auth/logout)
 * 4. Dynamic loading and rendering of authenticated user's papers from PostgreSQL (GET /api/papers)
 * 5. Interactive live filtering, search, tag clicking, and deletion (DELETE /api/papers/<id>)
 */

(function () {
  'use strict';

  // Global Sign Out Handler
  window.handleLogout = async function () {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('Logout network error:', err);
    }
    localStorage.removeItem('scholar_user');
    window.location.href = '/welcome';
  };

  document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verify User Authentication
    let currentUser = null;
    try {
      const res = await fetch('/api/auth/me');
      if (res.status === 401 || !res.ok) {
        window.location.href = '/welcome';
        return;
      }
      const data = await res.json();
      currentUser = data.user || data;
      localStorage.setItem('scholar_user', JSON.stringify(currentUser));
    } catch (err) {
      console.error('Auth verification error:', err);
      window.location.href = '/welcome';
      return;
    }

    // 2. Update User Profile in Navigation Header & Sidebar
    updateUserProfileUI(currentUser);

    // 3. Inject Sign Out Buttons in Header & Sidebar
    injectSignOutButtons(currentUser);

    // 4. Setup Upload Handlers
    setupPdfUpload();

    // 5. If on Main Dashboard Feed, Load User's Real Papers
    if (window.location.pathname === '/' || window.location.pathname === '/feed') {
      await initUserPapersFeed(currentUser);
    }
  });

  /**
   * Update Profile displays across the screen
   */
  function updateUserProfileUI(user) {
    if (!user) return;
    const userObj = user.user || user;
    const userEmail = (userObj.email || user.email || '').trim();
    const userName = (userObj.full_name || user.full_name || '').trim();
    const displayName = userName || (userEmail ? userEmail.split('@')[0] : 'Scholar');
    const displayEmail = userEmail;

    // Update Header Profile Texts
    document.querySelectorAll('header .flex-col.text-right').forEach((el) => {
      const nameSpan = el.querySelector('span:first-child');
      const emailSpan = el.querySelector('span:last-child');
      if (nameSpan) {
        nameSpan.id = 'user-display-name';
        nameSpan.textContent = displayName;
      }
      if (emailSpan) {
        emailSpan.id = 'user-display-email';
        if (displayEmail) {
          emailSpan.textContent = displayEmail;
        }
      }
    });

    const directNameEl = document.getElementById('user-display-name');
    if (directNameEl) directNameEl.textContent = displayName;
    const directEmailEl = document.getElementById('user-display-email');
    if (directEmailEl && displayEmail) directEmailEl.textContent = displayEmail;

    // Update active workspace badge subtitle if exists
    const wsSubtitle = document.querySelector('aside .bg-surface-container-lowest\\/90 .font-caption, aside .bg-surface-container-lowest\\/80 .font-label-mono');
    if (wsSubtitle && displayEmail) {
      wsSubtitle.textContent = displayEmail;
    }
  }

  /**
   * Inject Sign Out buttons cleanly into the Header and Sidebar
   */
  function injectSignOutButtons(user) {
    // Inject into Header profile area
    const headerProfileContainer = document.querySelector('header .flex.items-center.gap-space-sm, header .flex.items-center.gap-2.bg-surface-container-lowest\\/90');
    if (headerProfileContainer && !document.getElementById('header-logout-btn')) {
      const logoutBtn = document.createElement('button');
      logoutBtn.id = 'header-logout-btn';
      logoutBtn.type = 'button';
      logoutBtn.title = 'Sign Out of Scholar\'s Home';
      logoutBtn.className =
        'flex items-center gap-1.5 px-3 py-1.5 ml-2 rounded-xl border border-outline-variant/60 hover:bg-error-container/20 text-on-surface-variant hover:text-error hover:border-error/30 transition-all text-xs font-medium cursor-pointer shadow-xs';
      logoutBtn.innerHTML = `
        <span class="material-symbols-outlined text-sm">logout</span>
        <span>Sign Out</span>
      `;
      logoutBtn.onclick = window.handleLogout;
      headerProfileContainer.parentElement.appendChild(logoutBtn);
    }

    // Inject into Sidebar bottom panel
    const sidebarBottom = document.querySelector('aside .flex.flex-col.border-t');
    if (sidebarBottom && !document.getElementById('sidebar-logout-btn')) {
      const sidebarLogout = document.createElement('button');
      sidebarLogout.id = 'sidebar-logout-btn';
      sidebarLogout.type = 'button';
      sidebarLogout.className =
        'w-full flex items-center justify-between px-space-sm py-2 rounded-xl hover:bg-error-container/20 text-on-surface-variant hover:text-error transition-all cursor-pointer border border-transparent hover:border-error/20 mt-1';
      sidebarLogout.innerHTML = `
        <div class="flex items-center gap-space-xs">
          <span class="material-symbols-outlined text-base">logout</span>
          <span class="font-body-ui-sm text-body-ui-sm font-medium">Sign Out</span>
        </div>
        <span class="font-label-mono text-[10px] uppercase text-on-surface-variant/70">Exit</span>
      `;
      sidebarLogout.onclick = window.handleLogout;
      sidebarBottom.appendChild(sidebarLogout);
    }
  }

  /**
   * Configure PDF upload trigger and progress
   */
  function setupPdfUpload() {
    let fileInput = document.getElementById('globalPdfUploader');
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'globalPdfUploader';
      fileInput.accept = 'application/pdf';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
    }

    document.querySelectorAll('button').forEach((btn) => {
      if (btn.textContent.includes('Import PDF') || btn.textContent.includes('Add Paper')) {
        btn.onclick = (e) => {
          e.preventDefault();
          fileInput.click();
        };
      }
    });

    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const importBtns = Array.from(document.querySelectorAll('button')).filter(
        (b) => b.textContent.includes('Import PDF') || b.textContent.includes('Add Paper')
      );
      importBtns.forEach((b) => {
        b.disabled = true;
        b.innerHTML = `
          <span class="material-symbols-outlined text-base animate-spin">sync</span>
          <span>Synthesizing (Gemini 2.5 Flash)...</span>
        `;
      });

      const fd = new FormData();
      fd.append('file', file);

      try {
        const res = await fetch('/api/upload-pdf', {
          method: 'POST',
          body: fd,
        });

        const data = await res.json();
        if (res.ok) {
          showToast(`Paper successfully synthesized: "${data.title}"`, 'success');
          // If on main feed, reload papers dynamically without full reload
          if (window.location.pathname === '/' || window.location.pathname === '/feed') {
            await loadAndRenderPapers();
          } else {
            window.location.href = '/';
          }
        } else {
          showToast(`Upload Error: ${data.error || 'Failed to process PDF'}`, 'error');
        }
      } catch (err) {
        showToast(`Connection failed: ${err.message}`, 'error');
      } finally {
        fileInput.value = '';
        importBtns.forEach((b) => {
          b.disabled = false;
          b.innerHTML = `
            <span class="material-symbols-outlined text-base">add</span>
            <span>Import PDF / ArXiv URL</span>
          `;
        });
      }
    };
  }

  /**
   * User Papers Feed Controller (Research Feed Page)
   */
  let allPapers = [];
  let selectedTag = 'ALL';

  async function initUserPapersFeed(user) {
    // Find Left Column Main Feed Section
    const feedCol = document.querySelector('section.lg\\:col-span-8');
    if (!feedCol) return;

    // Create a container for User's Saved Papers above or replacing mock stream
    let userPapersSection = document.getElementById('user-library-section');
    if (!userPapersSection) {
      userPapersSection = document.createElement('div');
      userPapersSection.id = 'user-library-section';
      userPapersSection.className = 'flex flex-col gap-space-md w-full mb-space-lg';
      feedCol.prepend(userPapersSection);
    }

    // Connect Search Bar
    const searchInput = document.querySelector('input[placeholder*="Search papers"]');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        renderFilteredPapers(e.target.value.trim().toLowerCase());
      });
    }

    // Connect Tag Category Buttons in filter strip
    const catButtons = document.querySelectorAll('section.bg-surface-container-lowest button');
    catButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        catButtons.forEach((b) => {
          b.classList.remove('bg-primary', 'text-on-primary');
          b.classList.add('bg-surface-container-low', 'text-on-surface-variant');
        });
        btn.classList.add('bg-primary', 'text-on-primary');
        btn.classList.remove('bg-surface-container-low', 'text-on-surface-variant');

        const tagText = btn.textContent.trim();
        if (tagText.includes('All Categories')) {
          selectedTag = 'ALL';
        } else {
          selectedTag = tagText.split('·')[0].trim();
        }
        renderFilteredPapers(searchInput ? searchInput.value.trim().toLowerCase() : '');
      });
    });

    await loadAndRenderPapers();
  }

  async function loadAndRenderPapers() {
    const userPapersSection = document.getElementById('user-library-section');
    if (!userPapersSection) return;

    userPapersSection.innerHTML = `
      <div class="p-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-xs flex items-center justify-center gap-3 text-on-surface-variant">
        <span class="material-symbols-outlined text-secondary animate-spin">progress_activity</span>
        <span class="font-body-ui-sm">Retrieving your encrypted 3NF research records...</span>
      </div>
    `;

    try {
      const res = await fetch('/api/papers');
      if (!res.ok) throw new Error('Failed to fetch user papers');
      allPapers = await res.json();
      updateMetricsRibbon(allPapers.length);
      renderFilteredPapers();
    } catch (err) {
      userPapersSection.innerHTML = `
        <div class="p-4 bg-error-container/20 border border-error/30 rounded-xl text-error text-sm flex items-center justify-between">
          <span>Failed to load papers: ${err.message}</span>
          <button onclick="window.location.reload()" class="underline font-medium">Retry</button>
        </div>
      `;
    }
  }

  function renderFilteredPapers(filterQuery = '') {
    const userPapersSection = document.getElementById('user-library-section');
    if (!userPapersSection) return;

    let filtered = allPapers;

    // Filter by tag
    if (selectedTag !== 'ALL') {
      filtered = filtered.filter((p) =>
        (p.tags || []).some((t) => t.toLowerCase().includes(selectedTag.toLowerCase()))
      );
    }

    // Filter by search query
    if (filterQuery) {
      filtered = filtered.filter(
        (p) =>
          (p.title || '').toLowerCase().includes(filterQuery) ||
          (p.summary || '').toLowerCase().includes(filterQuery) ||
          (p.tags || []).some((t) => t.toLowerCase().includes(filterQuery))
      );
    }

    // Update counter label
    const showingCount = document.querySelector('span.font-caption.text-caption.text-on-surface-variant');
    if (showingCount && showingCount.textContent.includes('discoveries')) {
      showingCount.textContent = `Showing ${filtered.length} paper${filtered.length === 1 ? '' : 's'} in your vault`;
    }

    if (allPapers.length === 0) {
      userPapersSection.innerHTML = `
        <div class="bg-surface-container-lowest rounded-2xl p-8 border border-dashed border-outline-variant/80 text-center flex flex-col items-center gap-3 shadow-xs">
          <div class="w-12 h-12 rounded-full bg-secondary-container/60 text-secondary flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl">upload_file</span>
          </div>
          <h3 class="font-headline-sm text-headline-sm text-on-surface font-serif">Your Research Vault is Empty</h3>
          <p class="font-body-ui-sm text-on-surface-variant max-w-md">
            Upload your first research paper (PDF). Google Gemini 2.5 Flash will extract the abstract, generate executive takeaways, and normalize metadata into your private PostgreSQL 3NF schema.
          </p>
          <button onclick="document.getElementById('globalPdfUploader').click()" class="mt-2 bg-primary text-on-primary font-title-sm text-title-sm px-6 py-2.5 rounded-xl hover:bg-primary-container transition-all flex items-center gap-2 shadow-sm">
            <span class="material-symbols-outlined text-base">add</span>
            <span>Upload Research Paper PDF</span>
          </button>
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      userPapersSection.innerHTML = `
        <div class="p-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/60 text-center text-on-surface-variant">
          <p class="text-sm">No research papers match "${filterQuery}".</p>
        </div>
      `;
      return;
    }

    let cardsHtml = `
      <div class="flex items-center justify-between px-1 mb-1">
        <span class="font-label-mono text-[11px] uppercase tracking-wider text-secondary font-semibold flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-secondary"></span>
          Your Authenticated Research Vault (${filtered.length})
        </span>
        <span class="font-label-mono text-[10px] text-on-surface-variant">PostgreSQL 3NF Isolated</span>
      </div>
    `;

    filtered.forEach((paper) => {
      const uploadDate = paper.uploaded_at ? new Date(paper.uploaded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently';
      const tagsList = (paper.tags || []).map((t) => `
        <span class="text-caption bg-secondary-container/40 border border-secondary-fixed/60 text-on-secondary-container px-2.5 py-1 rounded-lg font-medium cursor-pointer hover:bg-secondary-container transition-colors" onclick="filterByTag('${escapeHtml(t)}')">
          #${escapeHtml(t)}
        </span>
      `).join('');

      cardsHtml += `
        <article class="bg-surface-container-lowest rounded-2xl p-7 border border-outline-variant/60 shadow-[0_1px_6px_rgba(75,55,40,0.02)] hover:shadow-[0_4px_18px_rgba(75,55,40,0.05)] transition-all flex flex-col gap-space-md" data-paper-id="${paper.paper_id}">
          <div class="flex items-center justify-between text-caption text-on-surface-variant">
            <div class="flex items-center gap-2">
              <span class="font-label-mono text-[11px] bg-secondary-fixed/50 text-on-secondary-fixed px-2.5 py-0.5 rounded-full font-medium">Vault ID: ${paper.paper_id}</span>
              <span>·</span>
              <span>${uploadDate}</span>
              <span>·</span>
              <span class="text-secondary font-medium">AI Synthesized</span>
            </div>
            <button onclick="deletePaper(${paper.paper_id})" class="text-on-surface-variant/70 hover:text-error transition-colors flex items-center gap-1 text-xs" title="Delete Paper from Database">
              <span class="material-symbols-outlined text-base">delete</span>
              <span>Remove</span>
            </button>
          </div>

          <div class="flex flex-col gap-1">
            <h2 class="font-headline-md text-headline-md text-on-surface hover:text-secondary transition-colors cursor-pointer font-serif leading-snug">
              ${escapeHtml(paper.title)}
            </h2>
          </div>

          <div class="bg-surface-container-low/70 border border-outline-variant/40 p-4 rounded-xl">
            <p class="font-body-reading text-body-reading text-on-surface leading-relaxed">
              ${escapeHtml(paper.summary || 'Summary processing complete.')}
            </p>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-outline-variant/40 flex-wrap gap-2">
            <div class="flex items-center gap-1.5 flex-wrap">
              ${tagsList || '<span class="text-caption text-on-surface-variant">No tags</span>'}
            </div>
            <div class="flex items-center gap-space-sm">
              <a href="/matrix" class="bg-surface-container text-on-surface font-title-sm text-title-sm px-4 py-2 rounded-xl hover:bg-surface-container-high transition-colors text-xs font-semibold">
                Compare in Matrix
              </a>
              <a href="/analyzer" class="bg-primary text-on-primary font-title-sm text-title-sm px-5 py-2 rounded-xl hover:bg-primary-container transition-all shadow-sm text-xs font-semibold">
                Read Deep-Dive
              </a>
            </div>
          </div>
        </article>
      `;
    });

    userPapersSection.innerHTML = cardsHtml;
  }

  function updateMetricsRibbon(count) {
    // Update Bento intake card
    const intakeSpan = document.querySelector('section.grid .font-headline-lg');
    if (intakeSpan) {
      intakeSpan.textContent = count.toString();
    }
    const wsLabel = document.querySelector('span.font-headline-sm.truncate');
    if (wsLabel) {
      wsLabel.textContent = `${count} Private Papers`;
    }
  }

  window.filterByTag = function (tag) {
    selectedTag = tag;
    renderFilteredPapers();
  };

  window.deletePaper = async function (paperId) {
    if (!confirm('Are you sure you want to permanently delete this paper from your database? Cascading tag links will also be purged.')) {
      return;
    }

    try {
      const res = await fetch(`/api/papers/${paperId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showToast('Paper deleted successfully', 'info');
        allPapers = allPapers.filter((p) => p.paper_id !== paperId);
        updateMetricsRibbon(allPapers.length);
        renderFilteredPapers();
      } else {
        showToast(`Failed to delete: ${data.error || 'Server error'}`, 'error');
      }
    } catch (err) {
      showToast(`Delete request failed: ${err.message}`, 'error');
    }
  };

  /**
   * Toast notification helper
   */
  function showToast(message, type = 'info') {
    const existing = document.getElementById('scholar-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'scholar-toast';
    const isError = type === 'error';
    const isSuccess = type === 'success';

    toast.className = `fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 transition-all transform duration-300 font-title-sm text-sm border ${
      isError
        ? 'bg-error-container text-on-error-container border-error/30'
        : isSuccess
        ? 'bg-secondary-fixed text-on-secondary-fixed border-secondary-fixed-dim'
        : 'bg-surface-container-high text-on-surface border-outline-variant'
    }`;

    const icon = isError ? 'error' : isSuccess ? 'check_circle' : 'info';
    toast.innerHTML = `
      <span class="material-symbols-outlined text-lg">${icon}</span>
      <span>${escapeHtml(message)}</span>
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
