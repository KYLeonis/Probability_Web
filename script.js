document.addEventListener('DOMContentLoaded', () => {
    // --- Theme Logic ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const brandImg = document.querySelector('.brand-img');
    if (themeToggleBtn) {
        const sunIcon = themeToggleBtn.querySelector('.sun-icon');
        const moonIcon = themeToggleBtn.querySelector('.moon-icon');

        function setTheme(themeName) {
            if (themeName === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
                sunIcon.style.display = 'none';
                moonIcon.style.display = 'block';
                localStorage.setItem('theme', 'dark');
                if (brandImg) brandImg.src = 'assets/img/hfut-logo.png';
            } else {
                document.documentElement.removeAttribute('data-theme');
                sunIcon.style.display = 'block';
                moonIcon.style.display = 'none';
                localStorage.setItem('theme', 'light');
                if (brandImg) brandImg.src = 'assets/img/hfut-brand.png';
            }
        }

        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            setTheme('dark');
        } else {
            setTheme('light');
        }

        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            if (currentTheme === 'dark') {
                setTheme('light');
            } else {
                setTheme('dark');
            }
        });
    }

    // --- Fullscreen Logic ---
    const fullscreenToggleBtn = document.getElementById('fullscreen-toggle');
    if (fullscreenToggleBtn) {
        const maximizeSvgPath = '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>';
        const minimizeSvgPath = '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>';

        const svgElement = fullscreenToggleBtn.querySelector('svg');

        fullscreenToggleBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.log(`Error attempting to enable fullscreen: ${err.message} (${err.name})`);
                });
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        });

        document.addEventListener('fullscreenchange', () => {
            if (document.fullscreenElement) {
                svgElement.innerHTML = minimizeSvgPath;
            } else {
                svgElement.innerHTML = maximizeSvgPath;
            }
        });
    }

    // --- State Management ---
    const state = {
        questions: [],
        filteredQuestions: [],
        filters: {
            scope: 'current', // 'current' | 'global'
            type: 'paper', // 'paper' | 'knowledge'
            activeCategory: null, // 当前选中的试卷名或知识点Tag名
            searchQuery: '',
            selectedTags: [] // 用于多选Tag过滤 (目前需求主要是一次点击过滤)
        },
        sidebarData: {
            papers: [],
            tags: []
        }
    };

    // --- DOM Elements ---
    const dom = {
        questionList: document.getElementById('question-list'),
        sidebarList: document.getElementById('sidebar-list'),
        searchInput: document.getElementById('search-input'),
        // searchScope: document.getElementById('search-scope'), // Removed custom dropdown implementation
        tabButtons: document.querySelectorAll('.tab-btn'),
        menuToggle: document.getElementById('menu-toggle'),
        sidebar: document.getElementById('sidebar'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        loading: document.getElementById('loading-indicator'),
        // NEW: View Elements
        views: document.querySelectorAll('.view-section'),
        navButtons: document.querySelectorAll('.nav-btn'), // Sidebar main/admin buttons
    };

    // --- Core Logic ---

    // 0. Routing & View Switching
    function switchView(viewId) {
        // 1. Hide all views
        dom.views.forEach(view => {
            view.classList.remove('active');
        });

        // 2. Show target view
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.classList.add('active');
        }

        // 3. Update Sidebar Active State
        dom.navButtons.forEach(btn => {
            if (btn.dataset.view === viewId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // 4. Mobile: Close sidebar after switch
        if (window.innerWidth <= 768) {
            toggleSidebar(false);
        }
    }

    // 1. Fetch Data
    async function init() {
        try {
            dom.loading.classList.remove('hidden');
            const response = await fetch('data.json');
            if (!response.ok) throw new Error('Failed to load data');

            const data = await response.json();
            state.questions = data;
            state.filteredQuestions = [...data];

            // Analyze data for sidebar
            analyzeData(data);

            // Initial Render
            renderSidebar();

            // 默认选中第一个试卷
            if (state.sidebarData.papers.length > 0) {
                selectCategory(state.sidebarData.papers[0], 'paper');
            } else {
                renderQuestions(state.questions);
            }

            // Ensure Home view is active by default (handled by HTML class="active" but nice to enforce)
            // switchView('view-home'); 

        } catch (error) {
            console.error('Error:', error);
            dom.questionList.innerHTML = `<div class="empty-state-msg">数据加载失败: ${error.message}</div>`;
        } finally {
            dom.loading.classList.add('hidden');
        }
    }

    // 2. Data Analysis for Sidebar
    function analyzeData(data) {
        // Extract unique papers
        const paperSet = new Set(data.map(q => q.paper).filter(Boolean));
        state.sidebarData.papers = Array.from(paperSet).sort();

        // Extract unique tags for "Knowledge" tab
        const tagMap = new Map();
        data.forEach(q => {
            if (q.tags && Array.isArray(q.tags)) {
                q.tags.forEach(t => {
                    tagMap.set(t, (tagMap.get(t) || 0) + 1);
                });
            }
        });
        // Convert map to array of objects {name, count} and sort by count desc
        state.sidebarData.tags = Array.from(tagMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }

    // 3. Rendering Helpers
    function renderMath() {
        if (window.renderMathInElement) {
            try {
                // IMPORTANT: Render in the currently active view or specific container? 
                // Since we moved question list to #view-home -> #question-list, we can target dom.questionList
                renderMathInElement(dom.questionList, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false },
                        { left: '\\(', right: '\\)', display: false },
                        { left: '\\[', right: '\\]', display: true }
                    ],
                    throwOnError: false
                });
            } catch (e) {
                console.error("KaTeX rendering error:", e);
            }
        } else {
            console.warn("KaTeX not loaded yet, retrying in 500ms...");
            setTimeout(renderMath, 500);
        }
    }

    function createQuestionCard(q) {
        const card = document.createElement('div');
        card.className = 'question-card';
        card.dataset.id = q.id;

        // Tags HTML
        const tagsHtml = (q.tags || []).map(tag =>
            `<span class="tag" data-tag="${tag}">${tag}</span>`
        ).join('');

        card.innerHTML = `
            <div class="card-header">
                <div class="card-tags">${tagsHtml}</div>
                <div class="question-source">${q.paper || '未知来源'}</div>
            </div>
            <div class="question-content">
                ${q.content}
            </div>
            <div class="card-action">
                <button class="ghost-button" onclick="window.toggleAnswer('${q.id}')">
                    查看解析
                </button>
                <div id="ans-${q.id}" class="answer-section">
                    <div class="answer-content">${q.answer}</div>
                </div>
            </div>
        `;
        return card;
    }

    function renderQuestions(list) {
        dom.questionList.innerHTML = '';
        if (list.length === 0) {
            dom.questionList.innerHTML = '<div class="empty-state-msg">没有找到匹配的题目</div>';
            return;
        }

        const fragment = document.createDocumentFragment();
        list.forEach(q => {
            fragment.appendChild(createQuestionCard(q));
        });
        dom.questionList.appendChild(fragment);

        // Render Math immediately after insertion
        renderMath();
    }

    function renderSidebar() {
        const type = state.filters.type;
        dom.sidebarList.innerHTML = '';
        const fragment = document.createDocumentFragment();

        if (type === 'paper') {
            state.sidebarData.papers.forEach(paper => {
                const el = document.createElement('div');
                el.className = `sidebar-item ${state.filters.activeCategory === paper ? 'active' : ''}`;
                el.textContent = paper;
                el.onclick = () => selectCategory(paper, 'paper');
                fragment.appendChild(el);
            });
        } else {
            state.sidebarData.tags.forEach(tagObj => {
                const el = document.createElement('div');
                el.className = `sidebar-item ${state.filters.activeCategory === tagObj.name ? 'active' : ''}`;
                el.innerHTML = `<span>${tagObj.name}</span> <span class="count">${tagObj.count}</span>`;
                el.onclick = () => selectCategory(tagObj.name, 'knowledge');
                fragment.appendChild(el);
            });
        }
        dom.sidebarList.appendChild(fragment);
    }

    // 4. Filtering Logic
    function applyFilters() {
        let result = state.questions;

        // 1. Category Filter (Sidebar)
        // If searching globally, we might ignore sidebar selection, or keep it.
        // Requirement: "Scope Dropdown: [Current List] or [Global]"
        // Logic: 
        // IF Scope == Global AND SearchQuery is NOT empty -> Ignore category, search everything.
        // IF Scope == Global AND SearchQuery IS empty -> Ignore category? Or show all? Usually show all.
        // IF Scope == Current -> Apply Category then Search.

        const isGlobalSearch = state.filters.scope === 'global' && state.filters.searchQuery.trim() !== '';

        if (!isGlobalSearch && state.filters.activeCategory) {
            if (state.filters.type === 'paper') {
                result = result.filter(q => q.paper === state.filters.activeCategory);
            } else {
                result = result.filter(q => q.tags && q.tags.includes(state.filters.activeCategory));
            }
        }

        // 2. Search Filter
        const query = state.filters.searchQuery.toLowerCase().trim();
        if (query) {
            result = result.filter(q => {
                const searchWait = (q.content + (q.answer || '') + (q.paper || '') + (q.tags || []).join(' ')).toLowerCase();
                return searchWait.includes(query);
            });
        }

        state.filteredQuestions = result;
        renderQuestions(result);
    }

    function selectCategory(name, type) {
        state.filters.type = type; // Ensure type matches what we clicked
        state.filters.activeCategory = name;

        // Update Sidebar UI active state
        renderSidebar();

        // Clear search if switching categories (optional UX choice, keeps things clean)
        // dom.searchInput.value = '';
        // state.filters.searchQuery = '';

        // Mobile UI: auto close sidebar on selection
        if (window.innerWidth <= 768) {
            toggleSidebar(false);
        }

        // Ensure we are on home view when selecting a category
        switchView('view-home');

        applyFilters();
    }

    // --- Event Listeners ---

    // Toggle Answer (Global for inline onclick)
    window.toggleAnswer = function (id) {
        const el = document.getElementById(`ans-${id}`);
        const btn = el.previousElementSibling; // ghost button
        if (el.style.maxHeight && el.style.maxHeight !== '0px') {
            el.style.maxHeight = '0px';
            el.style.opacity = '0';
            btn.textContent = '查看解析';
        } else {
            el.style.maxHeight = el.scrollHeight + 'px'; // Set to actual height
            el.style.opacity = '1';
            btn.textContent = '收起解析';
        }
    };

    // View Switching Logic (New)
    dom.navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Find closest button in case of icon click
            const button = e.target.closest('.nav-btn');
            if (button) {
                const viewId = button.dataset.view;
                if (viewId) switchView(viewId);
            }
        });
    });

    // Sidebar Tabs
    dom.tabButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active class from all
            dom.tabButtons.forEach(b => b.classList.remove('active'));
            // Add to clicked
            e.target.classList.add('active');

            // Update State
            state.filters.type = e.target.dataset.tab;
            state.filters.activeCategory = null; // Reset selection on tab switch

            renderSidebar();
            applyFilters(); // Renders all if no category selected
            switchView('view-home'); // Ensure home view
        });
    });

    // Search Input
    dom.searchInput.addEventListener('input', (e) => {
        state.filters.searchQuery = e.target.value;
        applyFilters();
    });

    // --- Custom Dropdown Logic ---
    const scopeWrapper = document.getElementById('scope-wrapper');
    const scopeTrigger = document.getElementById('scope-trigger');
    const scopeDropdown = document.getElementById('scope-dropdown');
    const scopeText = document.getElementById('scope-text');
    const scopeItems = document.querySelectorAll('.scope-item');

    // Toggle Dropdown
    scopeTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        scopeWrapper.classList.toggle('open');
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!scopeWrapper.contains(e.target)) {
            scopeWrapper.classList.remove('open');
        }
    });

    // Handle Item Selection
    scopeItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const value = item.dataset.value;
            const text = item.textContent.trim().replace('✓', '').trim(); // Remove tick if present in textContent logic

            // Update UI State
            state.filters.scope = value;
            scopeText.textContent = text;

            // Update Active Class
            scopeItems.forEach(i => i.classList.remove('active'));
            scopeItems.forEach(i => {
                const check = i.querySelector('.check-icon');
                if (check) check.textContent = ''; // Clear checks
            });

            item.classList.add('active');
            const check = item.querySelector('.check-icon');
            if (check) check.textContent = '✓';

            // Close Dropdown
            scopeWrapper.classList.remove('open');

            // Trigger Filter
            applyFilters();
        });
    });

    // Mobile Menu
    function toggleSidebar(show) {
        if (show === undefined) {
            dom.sidebar.classList.toggle('open');
            dom.sidebarOverlay.classList.toggle('active');
        } else if (show) {
            dom.sidebar.classList.add('open');
            dom.sidebarOverlay.classList.add('active');
        } else {
            dom.sidebar.classList.remove('open');
            dom.sidebarOverlay.classList.remove('active');
        }
    }

    dom.menuToggle.addEventListener('click', () => toggleSidebar());
    dom.sidebarOverlay.addEventListener('click', () => toggleSidebar(false));

    // Tag Click (Delegation)
    dom.questionList.addEventListener('click', (e) => {
        if (e.target.classList.contains('tag')) {
            const tagName = e.target.dataset.tag;
            // Behavior: Clicking a tag in a card switches view to "Knowledge" tab and filters by that tag
            state.filters.type = 'knowledge';
            state.filters.activeCategory = tagName;

            // Visual Update Sidebar Tabs
            dom.tabButtons.forEach(b => {
                if (b.dataset.tab === 'knowledge') b.classList.add('active');
                else b.classList.remove('active');
            });

            renderSidebar();
            applyFilters();

            // Scroll to top
            // NOTE: questionList is inside view-home so we can still scroll it
            dom.questionList.scrollTop = 0;

            // Ensure home view
            switchView('view-home');
        }
    });

    // --- Init ---
    init();
});
