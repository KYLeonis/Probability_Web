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

    // --- Layout Setting Logic (Step 3 Addition) ---
    const fontSizeButtons = document.querySelectorAll('#font-size-control button');
    const lineHeightButtons = document.querySelectorAll('#line-height-control button');

    if (fontSizeButtons.length > 0) {
        fontSizeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const size = e.target.getAttribute('data-size');
                document.documentElement.style.setProperty('--content-font-size', size);
                fontSizeButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
    }

    if (lineHeightButtons.length > 0) {
        lineHeightButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const height = e.target.getAttribute('data-height');
                document.documentElement.style.setProperty('--content-line-height', height);
                lineHeightButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
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
            // --- Phase 4.4 / 4.3.2: Trigger Appropriate Renders ---
            if (viewId === 'view-stats') {
                renderStatisticsView();
            } else if (viewId === 'view-mistakes') {
                renderLocalList('mistakes-list', 'userMistakes');
            } else if (viewId === 'view-favorites') {
                renderLocalList('favorites-list', 'userFavorites');
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

        // Options HTML (如果题型是选择题)
        let optionsHtml = '';
        if (q.type === 'choice' && q.options) {
            optionsHtml = '<div class="options-container">';
            q.options.forEach((opt, idx) => {
                optionsHtml += `<button class="option-btn" onclick="window.handleOptionClick(this, '${q.id}', ${idx}, ${q.correctOption})">${opt}</button>`;
            });
            optionsHtml += '</div>';
        }

        // Local State
        const favs = JSON.parse(localStorage.getItem('userFavorites') || '[]');
        const mistakes = JSON.parse(localStorage.getItem('userMistakes') || '[]');
        const isFav = favs.includes(q.id);
        const isMistake = mistakes.includes(q.id);

        card.innerHTML = `
            <div class="card-header">
                <div class="card-tags">${tagsHtml}</div>
                <div class="question-source">${q.paper || '未知来源'}</div>
            </div>
            <div class="question-content">
                ${q.content}
            </div>
            ${optionsHtml}
            <div class="card-action">
                <div class="card-action-group">
                    <button class="ghost-button" onclick="window.toggleAnswer('${q.id}')">
                        查看解析
                    </button>
                    <button class="ghost-button ${isFav ? 'active-fav' : ''}" onclick="window.toggleFavorite('${q.id}', this)" id="btn-fav-${q.id}">
                        ${isFav ? '⭐ 已收藏' : '⭐ 收藏'}
                    </button>
                    <button class="ghost-button ${isMistake ? 'active-mistake' : ''}" onclick="window.markAsWrong('${q.id}', this)" id="btn-mistake-${q.id}">
                        ${isMistake ? '❌ 已记为错题' : '❌ 记为错题'}
                    </button>
                    <button class="ghost-button export-btn" title="复制 Markdown" onclick="window.exportToMarkdown('${q.id}')">📝 Markdown</button>
                    <button class="ghost-button export-btn" title="保存为 PDF" onclick="window.exportToPdf('${q.id}')">📄 PDF</button>
                </div>
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

    // --- Phase 4.4 / 4.3.2: Render Local Lists for Action Centers ---
    function renderLocalList(containerId, storageKey) {
        const listContainer = document.getElementById(containerId);
        if (!listContainer) return;

        const storedIds = JSON.parse(localStorage.getItem(storageKey) || '[]');
        listContainer.innerHTML = '';

        if (storedIds.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state-msg">
                    <h3>太棒了！或者...还没开始记录？</h3>
                    <p>这里空空如也，快去刷题大厅探索吧。</p>
                </div>
            `;
            return;
        }

        const filteredQuestions = state.questions.filter(q => storedIds.includes(q.id));
        const fragment = document.createDocumentFragment();

        filteredQuestions.forEach(q => {
            const card = createQuestionCard(q);
            fragment.appendChild(card);
        });

        listContainer.appendChild(fragment);

        // 强制触发局部 KaTeX 渲染并注入分隔符
        if (window.renderMathInElement) {
            window.renderMathInElement(listContainer, {
                delimiters: [
                    { left: "$$", right: "$$", display: true },
                    { left: "$", right: "$", display: false },
                    { left: "\\(", right: "\\)", display: false },
                    { left: "\\[", right: "\\]", display: true }
                ]
            });
        }
    }

    // --- Phase 4.4: Render Macro Statistics Dashboard ---
    function renderStatisticsView() {
        const mistakes = JSON.parse(localStorage.getItem('userMistakes') || '[]');
        const favorites = JSON.parse(localStorage.getItem('userFavorites') || '[]');

        // 1. Update Hero Stats
        const mistakesCountEl = document.getElementById('stat-mistakes-count');
        const favoritesCountEl = document.getElementById('stat-favorites-count');

        if (mistakesCountEl) mistakesCountEl.textContent = mistakes.length;
        if (favoritesCountEl) favoritesCountEl.textContent = favorites.length;

        // 2. Render Mock Community Stats
        const communityList = document.getElementById('community-stats-list');
        if (communityList) {
            communityList.innerHTML = `
                <li><span class="rank-badge">#1</span> 2023-2024 第1学期 A卷 填空题 3 —— 全网错误率 82%</li>
                <li><span class="rank-badge">#2</span> 第3章 多维随机变量 解答题 1 —— 全网错误率 75%</li>
                <li><span class="rank-badge">#3</span> 2022-2023 第2学期 B卷 选择题 5 —— 全网错误率 68%</li>
            `;
        }

        // 3. Render Personal Insights (Tag Analysis)
        const insightsContent = document.getElementById('personal-insights-content');
        if (insightsContent) {
            insightsContent.innerHTML = '';
            if (mistakes.length === 0) {
                insightsContent.innerHTML = '<p class="empty-state-msg">暂无错题数据，无法生成分析报告。</p>';
                return;
            }

            // Extract tags from mistake questions
            const tagCounts = {};
            let totalTags = 0;
            state.questions.forEach(q => {
                if (mistakes.includes(q.id) && q.tags) {
                    q.tags.forEach(tag => {
                        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                        totalTags++;
                    });
                }
            });

            const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

            if (sortedTags.length === 0) {
                insightsContent.innerHTML = '<p class="empty-state-msg">错题缺乏标签数据，无法进行知识点提取。</p>';
                return;
            }

            let html = '<p>你的错题主要集中在以下知识点：</p>';
            sortedTags.forEach(([tag, count]) => {
                const percentage = Math.round((count / Math.max(totalTags, 1)) * 100);
                html += `
                    <div class="insight-tag-bar">
                        <div class="insight-tag-name" title="${tag}">${tag}</div>
                        <div class="insight-progress-track">
                            <div class="insight-progress-fill" style="width: ${percentage}%"></div>
                        </div>
                        <div class="insight-tag-count">${count}题</div>
                    </div>
                `;
            });
            insightsContent.innerHTML = html;
        }
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

    window.exportToMarkdown = function (questionId) {
        const q = state.questions.find(item => item.id === questionId);
        if (!q) return;

        const tagsStr = (q.tags || []).map(t => `#${t}`).join(' ');
        const mdContent = `### 📝 概率论复习笔记\n> **题目来源**：${q.paper || '未知'}\n> **标签**：${tagsStr}\n\n**【题目】**：\n${q.content}\n\n---\n**【解析】**：\n${q.answer}`;

        navigator.clipboard.writeText(mdContent).then(() => {
            if (window.showToast) {
                window.showToast('✅ Markdown 笔记已复制');
            } else {
                alert('✅ Markdown 笔记已复制');
            }
        }).catch(err => console.error('复制失败', err));
    };

    window.exportToPdf = function (questionId) {
        const card = document.querySelector(`.question-card[data-id="${questionId}"]`);
        if (!card) return;

        // 1. 展开解析以确保被打印
        const answerSection = card.querySelector('.answer-section');
        const wasExpanded = answerSection.style.maxHeight && answerSection.style.maxHeight !== '0px';
        if (!wasExpanded) {
            answerSection.style.maxHeight = answerSection.scrollHeight + 'px';
            answerSection.style.opacity = '1';
        }

        // 2. 标记打印目标
        document.body.classList.add('print-mode');
        card.classList.add('print-target');

        // 3. 呼出打印机 (用户可选择另存为 PDF)
        setTimeout(() => {
            window.print();

            // 4. 清理现场
            document.body.classList.remove('print-mode');
            card.classList.remove('print-target');
            if (!wasExpanded) {
                answerSection.style.maxHeight = '0px';
                answerSection.style.opacity = '0';
            }
        }, 300); // 略微延迟等待解析动画展开和渲染
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

    // --- 升级版：智能混合搜索与联想引擎 ---
    dom.searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        state.filters.searchQuery = query;

        // 1. 触发底部列表的实时过滤
        applyFilters();

        // 2. 触发下拉联想菜单
        const suggestionsBox = document.getElementById('search-suggestions');
        if (!suggestionsBox) return;

        if (!query) {
            suggestionsBox.classList.add('hidden');
            return;
        }

        // 获取当前作用域的题目池 (严格遵循 Scope)
        let pool = state.questions;
        if (state.filters.scope === 'current' && state.filters.activeCategory) {
            if (state.filters.type === 'paper') {
                pool = pool.filter(q => q.paper === state.filters.activeCategory);
            } else {
                pool = pool.filter(q => q.tags && q.tags.includes(state.filters.activeCategory));
            }
        }

        // 匹配 Tag
        const matchedTags = new Set();
        pool.forEach(q => {
            if (q.tags) q.tags.forEach(t => {
                if (t.toLowerCase().includes(query)) matchedTags.add(t);
            });
        });
        const topTags = Array.from(matchedTags).slice(0, 3);

        // 匹配题目片段
        const matchedQuestions = pool.filter(q =>
            (q.content + (q.answer || '') + (q.paper || '')).toLowerCase().includes(query)
        ).slice(0, 4);

        // 渲染菜单 HTML
        if (topTags.length === 0 && matchedQuestions.length === 0) {
            suggestionsBox.innerHTML = '<div class="suggestion-empty">未找到相关内容</div>';
        } else {
            let html = '';
            if (topTags.length > 0) {
                html += '<div class="suggestion-group-title">🏷️ 相关知识点</div>';
                topTags.forEach(tag => {
                    html += `<div class="suggestion-item tag-item" data-tag="${tag}"><span>${tag}</span></div>`;
                });
            }
            if (matchedQuestions.length > 0) {
                html += '<div class="suggestion-group-title">📄 相关题目</div>';
                matchedQuestions.forEach(q => {
                    // 粗略去除 LaTeX 和 HTML 标签以显示摘要
                    let snippet = q.content.replace(/<[^>]+>/g, '').replace(/\$/g, '').substring(0, 25) + '...';
                    let paperTag = q.paper ? q.paper.replace('2024-2025第一学期', '24秋').replace('2023-2024第二学期', '24春') : '未知';
                    html += `<div class="suggestion-item q-item" data-id="${q.id}">
                                <span class="q-snippet">${snippet}</span>
                                <span class="q-source-tag">#${paperTag}</span>
                             </div>`;
                });
            }
            suggestionsBox.innerHTML = html;
        }
        suggestionsBox.classList.remove('hidden');
    });

    // 处理联想菜单的点击交互 (事件代理)
    document.addEventListener('click', (e) => {
        const searchWrapper = document.getElementById('search-wrapper');
        const suggestionsBox = document.getElementById('search-suggestions');
        if (!searchWrapper || !suggestionsBox) return;

        // 1. 点击外部隐藏菜单
        if (!searchWrapper.contains(e.target)) {
            suggestionsBox.classList.add('hidden');
            return;
        }

        // 2. 点击 Tag 项：将搜索词替换为 Tag 并过滤
        const tagItem = e.target.closest('.tag-item');
        if (tagItem) {
            const tag = tagItem.dataset.tag;
            dom.searchInput.value = tag;
            state.filters.searchQuery = tag;
            suggestionsBox.classList.add('hidden');
            applyFilters();
        }

        // 3. 点击题目项：精准狙击单道题目
        const qItem = e.target.closest('.q-item');
        if (qItem) {
            const qId = qItem.dataset.id;
            dom.searchInput.value = ''; // 清空输入框以防干扰
            state.filters.searchQuery = '';
            suggestionsBox.classList.add('hidden');

            // 直接渲染这唯一的一道题
            const singleQuestion = state.questions.filter(q => q.id === qId);
            state.filteredQuestions = singleQuestion;
            // eslint-disable-next-line no-undef
            renderQuestions(singleQuestion);
        }
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

    // --- Login Modal Logic ---
    const loginModalOverlay = document.getElementById('login-modal-overlay');
    const closeLoginBtn = document.getElementById('close-modal-btn');
    const loginTriggerBtn = document.getElementById('login-trigger-btn');
    const authRequiredBtns = document.querySelectorAll('.auth-required');

    // In-place Swap Links
    const toRegisterLink = document.getElementById('to-register-link');
    const toLoginLink = document.getElementById('to-login-link');
    const loginModal = document.querySelector('.login-modal');

    function openLoginModal() {
        if (!loginModalOverlay) return;
        loginModalOverlay.classList.remove('hidden');
        // trigger reflow
        void loginModalOverlay.offsetWidth;
        loginModalOverlay.classList.add('active');
    }

    function closeLoginModal() {
        if (!loginModalOverlay) return;
        loginModalOverlay.classList.remove('active');
        // Wait for CSS transition (0.3s) before hidden
        setTimeout(() => {
            loginModalOverlay.classList.add('hidden');
            // Reset state to login
            if (loginModal) loginModal.classList.remove('is-register');
        }, 300);
    }

    if (toRegisterLink) {
        toRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (loginModal) loginModal.classList.add('is-register');
        });
    }

    if (toLoginLink) {
        toLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (loginModal) loginModal.classList.remove('is-register');
        });
    }

    function handleLogout() {
        localStorage.removeItem('currentUser');
        alert("已安全退出账号");
        renderUserProfile();
    }

    if (loginTriggerBtn) {
        loginTriggerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (localStorage.getItem('currentUser')) {
                handleLogout();
            } else {
                openLoginModal();
            }
        });
    }

    if (closeLoginBtn) {
        closeLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeLoginModal();
        });
    }

    const forgotLink = document.querySelector('.forgot-link');
    if (forgotLink) {
        forgotLink.addEventListener('click', function (e) {
            e.preventDefault();
            alert("💡 本系统暂不支持自动找回密码。\n\n如遗忘密码，请使用新邮箱重新注册，或联系管理员 Leonis(lz2398947517@gmail.com) 处理。");
        });
    }

    // --- Global Auth Guard ---
    document.body.addEventListener('click', (e) => {
        const authBtn = e.target.closest('.auth-required');
        if (authBtn) {
            if (!localStorage.getItem('currentUser')) {
                e.preventDefault();
                e.stopPropagation();
                openLoginModal();
            }
        }
    });

    // --- Init ---
    init();

    // 全局头像渲染引擎
    window.renderAvatar = function (nickname, imageUrl = null) {
        const avatarContainers = document.querySelectorAll('.avatar-display');
        if (avatarContainers.length === 0) return;

        let contentToRender = '';
        if (imageUrl) {
            contentToRender = `<img src="${imageUrl}" alt="User Avatar">`;
        } else {
            const fallbackSvg = `<svg width="60%" height="60%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
            contentToRender = fallbackSvg;
            if (nickname && typeof nickname === 'string') {
                const firstChar = nickname.trim().charAt(0);
                if (/^[a-zA-Z]$/.test(firstChar)) {
                    contentToRender = firstChar.toUpperCase();
                } else if (/^[\u4e00-\u9fa5]$/.test(firstChar)) {
                    contentToRender = firstChar;
                }
            }
        }

        avatarContainers.forEach(container => {
            container.innerHTML = contentToRender;
        });
    };

    // --- Phase 4.1: 本地错题与收藏管理 ---
    window.toggleFavorite = function (questionId, btnElement) {
        if (!localStorage.getItem('currentUser')) {
            openLoginModal();
            return;
        }

        let favs = JSON.parse(localStorage.getItem('userFavorites') || '[]');
        const index = favs.indexOf(questionId);

        if (index === -1) {
            favs.push(questionId);
            if (btnElement) {
                btnElement.classList.add('active-fav');
                btnElement.innerHTML = '⭐ 已收藏';
            }
        } else {
            favs.splice(index, 1);
            if (btnElement) {
                btnElement.classList.remove('active-fav');
                btnElement.innerHTML = '⭐ 收藏';
            }
        }
        localStorage.setItem('userFavorites', JSON.stringify(favs));
    };

    window.markAsWrong = function (questionId, btnElement) {
        if (!localStorage.getItem('currentUser')) {
            openLoginModal();
            return;
        }

        let mistakes = JSON.parse(localStorage.getItem('userMistakes') || '[]');
        const index = mistakes.indexOf(questionId);

        if (index === -1) {
            mistakes.push(questionId);
            if (btnElement) {
                btnElement.classList.add('active-mistake');
                btnElement.innerHTML = '❌ 已记为错题';
            }
        } else {
            mistakes.splice(index, 1);
            if (btnElement) {
                btnElement.classList.remove('active-mistake');
                btnElement.innerHTML = '❌ 记为错题';
            }
        }
        localStorage.setItem('userMistakes', JSON.stringify(mistakes));
    };

    window.handleOptionClick = function (btnElement, questionId, selectedIdx, correctIdx) {
        // 锁定所有同组按钮
        const container = btnElement.closest('.options-container');
        const allBtns = container.querySelectorAll('.option-btn');
        allBtns.forEach(b => b.disabled = true);

        if (selectedIdx === correctIdx) {
            btnElement.classList.add('correct');
        } else {
            btnElement.classList.add('wrong');
            // 同时标出正确的
            if (allBtns[correctIdx]) {
                allBtns[correctIdx].classList.add('correct');
            }

            // 如果答错了，自动触发记为错题逻辑
            let mistakes = JSON.parse(localStorage.getItem('userMistakes') || '[]');
            if (!mistakes.includes(questionId)) {
                const mistakeBtn = document.getElementById(`btn-mistake-${questionId}`);
                window.markAsWrong(questionId, mistakeBtn);
            }
        }

        // 如果启用了 KaTeX，可能需要渲染选项的公式，但通常初始化时已渲染
    };

    // 初始化调用一次，传入默认昵称测试
    // 假设当前用户名为 Leonis
    renderAvatar('Leonis');

    // 头像上传逻辑
    const uploadBtn = document.getElementById('upload-avatar-btn');
    const uploadInput = document.getElementById('avatar-upload-input');

    if (uploadBtn && uploadInput) {
        uploadBtn.addEventListener('click', () => {
            uploadInput.click();
        });

        uploadInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    // 调用全局渲染引擎，传入预览的 base64 图片地址
                    renderAvatar('Leonis', e.target.result);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // --- Cloudflare Worker API Authentication Integration ---
    const API_URL = 'https://prob-api.lz2398947517.workers.dev/api/auth';

    const emailInput = document.getElementById('auth-email-input');
    const passwordInput = document.getElementById('auth-password-input');
    const nicknameInput = document.getElementById('reg-nickname-input');
    const confirmPasswordInput = document.getElementById('reg-confirm-password-input');

    const loginSubmitBtn = document.getElementById('login-submit-btn');
    const registerSubmitBtn = document.getElementById('register-submit-btn');

    async function handleAuth(type, payload, button, originalText) {
        button.textContent = '正在处理...';
        button.disabled = true;

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            alert(data.message || (type === 'login' ? '登录调用完毕' : '注册调用完毕'));

            if (response.ok) {
                if (type === 'login' && data.user) {
                    // 保存状态
                    localStorage.setItem('currentUser', JSON.stringify(data.user));
                    closeLoginModal();
                    renderUserProfile();
                } else if (type === 'register') {
                    // If register successful, switch to login view automatically
                    if (loginModal) loginModal.classList.remove('is-register');
                }
            }
        } catch (error) {
            console.error('Auth API Error:', error);
            alert('请求失败，请检查网络连接或稍后再试。');
        } finally {
            button.textContent = originalText;
            button.disabled = false;
        }
    }

    if (loginSubmitBtn) {
        loginSubmitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const email = emailInput?.value.trim();
            const password = passwordInput?.value.trim();

            if (!email || !password) {
                alert('请输入邮箱和密码。');
                return;
            }

            const payload = { type: 'login', email, password };
            handleAuth('login', payload, loginSubmitBtn, '登 录');
        });
    }

    if (registerSubmitBtn) {
        registerSubmitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const email = emailInput?.value.trim();
            const nickname = nicknameInput?.value.trim();
            const password = passwordInput?.value.trim();
            const confirmPassword = confirmPasswordInput?.value.trim();

            if (!email || !nickname || !password) {
                alert('请完整填写注册信息。');
                return;
            }
            if (password !== confirmPassword) {
                alert('两次输入的密码不一致。');
                return;
            }

            const payload = { type: 'register', email, nickname, password };
            handleAuth('register', payload, registerSubmitBtn, '立即注册');
        });
    }

    // --- 用户状态持久化与 UI 渲染引擎 ---
    function renderUserProfile() {
        const userStr = localStorage.getItem('currentUser');
        const profileHeader = document.querySelector('.profile-header-centered');
        const loginTriggerBtn = document.getElementById('login-trigger-btn');
        const profileName = document.querySelector('.profile-name');
        const profileEmail = document.querySelector('.profile-email');
        const uploadAvatarBtn = document.getElementById('upload-avatar-btn');

        if (userStr) {
            try {
                const user = JSON.parse(userStr);

                // 显示个人信息区域
                if (profileHeader) profileHeader.style.display = 'flex';
                if (uploadAvatarBtn) uploadAvatarBtn.style.display = 'inline-block';

                // 更新用户信息
                if (profileName) profileName.textContent = user.nickname;
                if (profileEmail) profileEmail.textContent = user.email;

                // 底部按钮切为“退出账号”
                if (loginTriggerBtn) {
                    loginTriggerBtn.textContent = '退出账号';
                    loginTriggerBtn.style.color = '#dc2626';
                    loginTriggerBtn.style.display = 'block';
                }

                // 渲染用户头像（大写首字母或头像系统）
                if (window.renderAvatar) {
                    window.renderAvatar(user.nickname);
                }

                // 更新网络侦测状态
                updateNetworkStatus();
            } catch (e) {
                console.error('Failed to parse user data:', e);
                localStorage.removeItem('currentUser');
                renderUserProfile(); // 清理并退回未登录状态
            }
        } else {
            // 未登录状态
            if (profileHeader) profileHeader.style.display = 'flex';
            if (uploadAvatarBtn) uploadAvatarBtn.style.display = 'none';

            if (profileName) profileName.textContent = '未登录';
            if (profileEmail) profileEmail.textContent = '请登录以使用完整功能';

            // 底部按钮切为“登录 / 注册”
            if (loginTriggerBtn) {
                loginTriggerBtn.textContent = '登录 / 注册';
                loginTriggerBtn.style.color = ''; // 恢复默认
                loginTriggerBtn.style.display = 'block';
            }

            if (window.renderAvatar) {
                window.renderAvatar('?'); // 未登录显示默认字符
            }
        }
    }

    // --- 网络状态即时侦测引擎 ---
    function updateNetworkStatus() {
        const isOnline = navigator.onLine;
        const statusText = document.querySelector('.status-text');

        if (isOnline) {
            document.body.classList.remove('is-offline');
            if (statusText) statusText.textContent = '在线';
        } else {
            document.body.classList.add('is-offline');
            if (statusText) statusText.textContent = '离线';
        }
    }

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    updateNetworkStatus(); // 初始化调用

    // 初始化应用状态 UI
    renderUserProfile();

    // ==========================================
    // 5.1 全面公式复制逻辑 (支持行内与块状)
    // ==========================================
    document.body.addEventListener('click', async (e) => {
        // 寻找最近的 .katex 元素
        const mathElement = e.target.closest('.katex');
        if (!mathElement) return;

        e.preventDefault();
        e.stopPropagation();

        // 在内部寻找原始 TeX 代码
        const annotation = mathElement.querySelector('annotation[encoding="application/x-tex"]');
        if (annotation && annotation.textContent) {
            const rawTex = annotation.textContent.trim();
            try {
                await navigator.clipboard.writeText(rawTex);

                // 成功反馈：简单的视觉闪烁
                const originalBg = mathElement.style.backgroundColor;
                mathElement.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';

                // 复用或新建一个轻量 Toast 提示
                showToast('✅ LaTeX 已复制');

                setTimeout(() => {
                    mathElement.style.backgroundColor = originalBg;
                }, 1000);
            } catch (err) {
                console.error('Copy failed:', err);
            }
        }
    });

    // 辅助函数：显示 Toast
    function showToast(msg) {
        let toast = document.getElementById('math-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'math-toast';
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.background = 'rgba(0,0,0,0.8)';
            toast.style.color = '#fff';
            toast.style.padding = '10px 20px';
            toast.style.borderRadius = '8px';
            toast.style.zIndex = '9999';
            toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
            toast.style.transition = 'opacity 0.3s ease';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';

        // 清除旧的 timeout 避免快速点击时闪烁
        if (toast.hideTimeout) clearTimeout(toast.hideTimeout);

        toast.hideTimeout = setTimeout(() => {
            toast.style.opacity = '0';
        }, 2000);
    }

    // 批量导出为 Markdown
    window.exportAllToMarkdown = function (storageKey) {
        const ids = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (ids.length === 0) {
            alert('当前列表为空，没有可导出的题目。');
            return;
        }

        const questionsToExport = state.questions.filter(q => ids.includes(q.id));
        let mdContent = `# 📝 概率论复习导出资料\n\n`;

        questionsToExport.forEach((q, index) => {
            const tagsStr = (q.tags || []).map(t => `#${t}`).join(' ');
            mdContent += `### 第 ${index + 1} 题\n> **来源**：${q.paper || '未知'} | **标签**：${tagsStr}\n\n**【题目内容】**：\n${q.content}\n\n---\n**【详细解析】**：\n${q.answer}\n\n<br><br>\n\n`;
        });

        navigator.clipboard.writeText(mdContent).then(() => {
            if (window.showToast) window.showToast('✅ 全部题目已成功导出为 Markdown 到剪贴板');
            else alert('✅ 全部题目已成功导出为 Markdown 到剪贴板');
        }).catch(err => console.error('复制失败', err));
    };

    // 批量导出为 PDF
    window.exportAllToPdf = function (viewId) {
        const container = document.querySelector(`#${viewId} .question-list-container`);
        if (!container || container.children.length === 0 || container.querySelector('.empty-state-msg')) {
            alert('当前列表为空，无法导出 PDF。');
            return;
        }

        // 1. 展开当前列表下所有的解析，确保打印完整
        const answerSections = container.querySelectorAll('.answer-section');
        const toggledSections = [];
        answerSections.forEach(sec => {
            if (!sec.style.maxHeight || sec.style.maxHeight === '0px') {
                sec.style.maxHeight = sec.scrollHeight + 'px';
                sec.style.opacity = '1';
                toggledSections.push(sec);
            }
        });

        // 2. 打上打印专属标记
        document.body.classList.add('print-mode');
        container.classList.add('print-container');

        // 3. 呼出系统打印机 (允许用户另存为 PDF)
        setTimeout(() => {
            window.print();

            // 4. 取消标记，恢复现场
            document.body.classList.remove('print-mode');
            container.classList.remove('print-container');
            toggledSections.forEach(sec => {
                sec.style.maxHeight = '0px';
                sec.style.opacity = '0';
            });
        }, 500); // 预留 500ms 等待 CSS 动画展开和重绘
    };

    // --- Phase 6.1: 智能密卷生成引擎 (纯测试模式) ---
    window.generateMockExam = function (storageKey) {
        const ids = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (ids.length === 0) {
            alert('当前列表为空，没有题目可供生成试卷。');
            return;
        }

        const qs = state.questions.filter(q => ids.includes(q.id));

        // 自动按题型分类器
        const choiceQs = qs.filter(q => q.type === 'choice' || (q.type && q.type.includes('选择')));
        const blankQs = qs.filter(q => q.type && q.type.includes('填空'));
        const calcQs = qs.filter(q => !choiceQs.includes(q) && !blankQs.includes(q)); // 剩下的全归为解答/计算题

        const container = document.getElementById('exam-questions-container');
        if (!container) return alert('找不到试卷容器，请确保试卷版式 HTML 已正确注入。');

        let html = '';
        let globalIndex = 1;

        // 一、选择题
        if (choiceQs.length > 0) {
            html += `<h3 style="font-size: 9pt; font-weight: bold; margin: 10px 0 6px 0;">一、 单项选择题（每小题3分）</h3>`;
            choiceQs.forEach(q => {
                html += `<div class="exam-q-item" style="margin-bottom: 12px; font-size: 9.5pt;">`;
                html += `<div>${globalIndex++}. ${q.content} ( &nbsp;&nbsp;&nbsp;&nbsp; )</div>`;
                if (q.options) {
                    html += `<div style="display: flex; flex-wrap: wrap; gap: 20px; margin-top: 8px; padding-left: 15px;">`;
                    q.options.forEach(opt => html += `<span>${opt}</span>`);
                    html += `</div>`;
                }
                html += `</div>`;
            });
        }

        // 二、填空题
        if (blankQs.length > 0) {
            html += `<h3 style="font-size: 9pt; font-weight: bold; margin: 10px 0 6px 0;">二、 填空题（每小题3分）</h3>`;
            blankQs.forEach(q => {
                html += `<div class="exam-q-item" style="margin-bottom: 12px; font-size: 9.5pt;">`;
                html += `<div>${globalIndex++}. ${q.content}</div>`;
                html += `</div>`;
            });
        }

        // 三、计算与解答题
        if (calcQs.length > 0) {
            html += `<h3 style="font-size: 9pt; font-weight: bold; margin: 10px 0 6px 0;">三、 计算与解答题（请写出详细的推导和计算过程）</h3>`;
            calcQs.forEach(q => {
                html += `<div class="exam-q-item" style="margin-bottom: 12px; font-size: 9.5pt; page-break-inside: avoid;">`;
                html += `<div>${globalIndex++}. ${q.content}</div>`;
                html += `</div>`; // 取消大面积留白，实现紧凑试题卷
            });
        }

        // 注入 DOM
        container.innerHTML = html;

        // 呼叫 KaTeX 渲染试卷内的公式
        if (window.renderMathInElement) {
            window.renderMathInElement(container, {
                delimiters: [
                    { left: "$$", right: "$$", display: true },
                    { left: "$", right: "$", display: false },
                    { left: "\\(", right: "\\)", display: false },
                    { left: "\\[", right: "\\]", display: true }
                ]
            });
        }

        // 开启试卷专属打印模式 (隐藏网页，显现试卷)
        document.body.classList.add('print-exam-mode');

        // 延时等待 KaTeX 渲染完成并弹出打印机
        setTimeout(() => {
            window.print();
            // 打印结束后关闭密卷模式，恢复正常网页
            document.body.classList.remove('print-exam-mode');
        }, 800);
    };
});
