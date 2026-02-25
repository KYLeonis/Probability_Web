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
    // --- Phase 7.0: 灵动公式悬浮窗引擎 ---

    // 核心数据结构：按单元分类，长内容分页
    const formulaData = [
        {
            title: "一、随机事件",
            pages: [
                // 第一页内容 (String.raw 防止 LaTeX 反斜杠被转义)
                String.raw`
            <h3 style="margin-top:0;">一、随机事件与概率</h3>
            <table>
                <tr><th>公式名称</th><th>公式表达式</th></tr>
                <tr><td>德摩根公式</td><td>$\overline{A \cup B} = \overline{A} \cap \overline{B}, \quad \overline{A \cap B} = \overline{A} \cup \overline{B}$</td></tr>
                <tr><td>古典概型</td><td>$P(A) = \frac{m}{n} = \frac{\text{A包含的基本事件数}}{\text{基本事件总数}}$</td></tr>
                <tr><td>加法公式</td><td>$P(A \cup B) = P(A) + P(B) - P(AB)$</td></tr>
                <tr><td>条件概率</td><td>$P(B \mid A) = \frac{P(AB)}{P(A)}$</td></tr>
                <tr><td>全概率公式</td><td>$P(A) = \sum_{i=1}^{n} P(B_i)P(A \mid B_i)$</td></tr>
                <tr><td>贝叶斯公式</td><td>$P(B_i \mid A) = \frac{P(B_i)P(A \mid B_i)}{\sum_{i=1}^{n} P(B_i)P(A \mid B_i)}$</td></tr>
                <tr><td>独立性</td><td>$P(AB) = P(A)P(B)$</td></tr>
            </table>
            `
            ]
        },
        {
            title: "二、随机变量",
            pages: [
                // 第一页：离散型与连续型基础
                String.raw`
            <h3 style="margin-top:0;">1. 离散型分布</h3>
            <table>
                <tr><th>分布</th><th>分布律</th></tr>
                <tr><td>0-1 分布</td><td>$P(X = k) = p^k(1-p)^{1-k}, \quad k = 0,1$</td></tr>
                <tr><td>二项分布</td><td>$P(X = k) = C_n^k p^k (1-p)^{n-k}$</td></tr>
                <tr><td>泊松分布</td><td>$P(X = k) = \frac{\lambda^k}{k!}e^{-\lambda}$</td></tr>
            </table>
            `,
                // 第二页：连续型分布 (依靠底部圆点切换过来)
                String.raw`
            <h3 style="margin-top:0;">2. 连续型分布</h3>
            <table>
                <tr><th>分布</th><th>密度函数 $f(x)$</th></tr>
                <tr><td>均匀分布</td><td>$f(x) = \begin{cases} \frac{1}{b-a}, & a < x < b \\ 0, & \text{其他} \end{cases}$</td></tr>
                <tr><td>指数分布</td><td>$f(x) = \begin{cases} \lambda e^{-\lambda x}, & x > 0 \\ 0, & x \le 0 \end{cases}$</td></tr>
                <tr><td>正态分布</td><td>$f(x) = \frac{1}{\sqrt{2\pi}\sigma} e^{-\frac{(x-\mu)^2}{2\sigma^2}}$</td></tr>
            </table>
            `
            ]
        },
        {
            title: "三、多维随机变量",
            pages: [
                // 第一页：离散型二维
                String.raw`
            <h3 style="margin-top:0;">1. 离散型二维随机变量</h3>
            <table>
                <tr><th>概念</th><th>公式</th></tr>
                <tr><td>分布律</td><td>$P(X = x_i, Y = y_j) = p_{ij}$</td></tr>
                <tr><td>分布函数</td><td>$F(x, y) = \sum_{x_i \le x} \sum_{y_j \le y} p_{ij}$</td></tr>
                <tr><td>边缘分布律</td><td>$p_{i\cdot} = \sum_{j} p_{ij}, \quad p_{\cdot j} = \sum_{i} p_{ij}$</td></tr>
                <tr><td>条件分布律</td><td>$P(X = x_i \mid Y = y_j) = \frac{p_{ij}}{p_{\cdot j}}$</td></tr>
            </table>
            `,
                // 第二页：连续型二维
                String.raw`
            <h3 style="margin-top:0;">2. 连续型二维随机变量</h3>
            <p><strong>分布函数与性质：</strong><br>
            $F(x, y) = \int_{-\infty}^{x} \int_{-\infty}^{y} f(u, v) dudv$<br>
            $\frac{\partial^2 F(x, y)}{\partial x \partial y} = f(x, y)$</p>
            <p><strong>边缘密度函数：</strong><br>
            $f_X(x) = \int_{-\infty}^{+\infty} f(x, v) dv$<br>
            $f_Y(y) = \int_{-\infty}^{+\infty} f(u, y) du$</p>
            <p><strong>条件概率密度：</strong><br>
            $f_{Y \mid X}(y \mid x) = \frac{f(x, y)}{f_X(x)}$</p>
            `,
                // 第三页：独立性与函数分布
                String.raw`
            <h3 style="margin-top:0;">3. 独立性 & 4. 函数的分布</h3>
            <p><strong>相互独立 $\Leftrightarrow F(x, y) = F_X(x)F_Y(y)$</strong></p>
            <ul>
                <li>离散型独立：$p_{ij} = p_{i\cdot} p_{\cdot j}$</li>
                <li>连续型独立：$f(x, y) = f_X(x) f_Y(y)$</li>
            </ul>
            <p><strong>二维随机变量和的分布 $Z = X + Y$：</strong></p>
            <ul>
                <li>离散型和：$P(Z = z_k) = \sum_{x_i+y_j=z_k} P(X=x_i, Y=y_j)$</li>
                <li>连续型和(卷积公式)：<br>$f_Z(z) = \int_{-\infty}^{+\infty} f(x, z-x) dx$</li>
            </ul>
            `
            ]
        },
        {
            title: "四、数字特征",
            pages: [
                // 第一页：期望与方差
                String.raw`
            <h3 style="margin-top:0;">1. 数学期望 & 2. 方差</h3>
            <table>
                <tr><th>特征</th><th>定义 / 核心公式</th></tr>
                <tr><td>期望 $E(X)$</td><td>离散: $\sum x_k p_k$<br>连续: $\int_{-\infty}^{+\infty} x f(x) dx$</td></tr>
                <tr><td>期望性质</td><td>$E(aX \pm b) = aE(X) \pm b$<br>$E(X \pm Y) = E(X) \pm E(Y)$</td></tr>
                <tr><td>方差 $D(X)$</td><td>$D(X) = E(X^2) - E^2(X)$</td></tr>
                <tr><td>方差性质</td><td>$D(aX \pm b) = a^2D(X)$<br>独立时: $D(X \pm Y) = D(X) + D(Y)$</td></tr>
            </table>
            `,
                // 第二页：协方差与相关系数
                String.raw`
            <h3 style="margin-top:0;">3. 协方差与相关系数</h3>
            <p><strong>协方差：</strong> $Cov(X, Y) = E(XY) - E(X)E(Y)$</p>
            <p><strong>相关系数：</strong> $\rho_{xy} = \frac{Cov(X, Y)}{\sqrt{D(X)}\sqrt{D(Y)}}$</p>
            <p><strong>核心性质与推论：</strong></p>
            <ul>
                <li>$X, Y$ 独立 $\Rightarrow Cov(X, Y) = 0 \Rightarrow \rho_{xy} = 0$ (即不相关)</li>
                <li>$D(X \pm Y) = D(X) + D(Y) \pm 2Cov(X, Y)$</li>
                <li>$Cov(aX + c, bY + d) = abCov(X, Y)$</li>
                <li>$Cov(X, X) = D(X)$</li>
            </ul>
            `,
                // 第三页：常见分布特征表 (极高频考点)
                String.raw`
            <h3 style="margin-top:0;">4. 常见分布的数字特征</h3>
            <table>
                <tr><th>分布</th><th>期望 $E(X)$</th><th>方差 $D(X)$</th></tr>
                <tr><td>0-1分布 $b(1, p)$</td><td>$p$</td><td>$p(1-p)$</td></tr>
                <tr><td>二项分布 $b(n, p)$</td><td>$np$</td><td>$np(1-p)$</td></tr>
                <tr><td>泊松分布 $P(\lambda)$</td><td>$\lambda$</td><td>$\lambda$</td></tr>
                <tr><td>均匀分布 $U(a, b)$</td><td>$\frac{a+b}{2}$</td><td>$\frac{(b-a)^2}{12}$</td></tr>
                <tr><td>正态分布 $N(\mu, \sigma^2)$</td><td>$\mu$</td><td>$\sigma^2$</td></tr>
                <tr><td>指数分布 $e(\lambda)$</td><td>$\frac{1}{\lambda}$</td><td>$\frac{1}{\lambda^2}$</td></tr>
            </table>
            `
            ]
        }
        , // 记得加逗号
        {
            title: "五、大数定律",
            pages: [
                // 第一页：切比雪夫与大数定律
                String.raw`
            <h3 style="margin-top:0;">1. 切比雪夫不等式</h3>
            <p>若 $E(X) = \mu, D(X) = \sigma^2$ ，对于任意 $\varepsilon > 0$ 有：<br>
            $P\{|X - E(X)| \ge \varepsilon\} \le \frac{D(X)}{\varepsilon^2}$</p>
            
            <h3 style="margin-top:15px;">2. 大数定律</h3>
            <ul>
                <li><strong>切比雪夫大数定律：</strong>独立且方差有界时，样本均值依概率收敛于期望均值。<br>$\frac{1}{n} \sum_{i=1}^{n} X_i \xrightarrow{P} \frac{1}{n} \sum_{i=1}^{n} E(X_i)$</li>
                <li><strong>伯努利大数定律：</strong>频率依概率收敛于概率。<br>$\lim_{n \to \infty} P\left( \left| \frac{n_A}{n} - p \right| < \varepsilon \right) = 1$</li>
                <li><strong>辛钦大数定律：</strong>独立同分布且期望存在时，样本均值依概率收敛于期望 $\mu$。</li>
            </ul>
            `,
                // 第二页：中心极限定理
                String.raw`
            <h3 style="margin-top:0;">3. 中心极限定理 (CLT)</h3>
            <p><strong>列维—林德伯格 (独立同分布)：</strong><br>
            均值为 $\mu$ ，方差为 $\sigma^2 > 0$ ，当 $n$ 充分大时：<br>
            $Y_n = \frac{\sum_{k=1}^{n} X_k - n\mu}{\sqrt{n}\sigma} \xrightarrow{\sim} N(0,1)$</p>
            
            <p><strong>棣莫弗—拉普拉斯 (二项分布逼近)：</strong><br>
            $X \sim B(n, p)$，当 $n$ 很大时，近似服从正态分布：<br>
            $\lim_{n \to \infty} P\left\{ \frac{X - np}{\sqrt{np(1-p)}} \le x \right\} = \Phi(x)$</p>

            <p><strong>近似计算核心公式：</strong><br>
            $P\left( a \le \sum_{k=1}^{n} X_k \le b \right) \approx \Phi\left( \frac{b - n\mu}{\sqrt{n}\sigma} \right) - \Phi\left( \frac{a - n\mu}{\sqrt{n}\sigma} \right)$</p>
            `
            ]
        },
        {
            title: "六、基本概念",
            pages: [
                // 第一页：统计量
                String.raw`
            <h3 style="margin-top:0;">1. 常用统计量</h3>
            <table>
                <tr><th>名称</th><th>公式</th></tr>
                <tr><td>样本均值</td><td>$\overline{x} = \frac{1}{n} \sum_{i=1}^{n} x_i$</td></tr>
                <tr><td>样本方差</td><td>$s^2 = \frac{1}{n-1} \sum_{i=1}^{n} (x_i - \overline{x})^2$</td></tr>
                <tr><td>计算化简</td><td>$s^2 = \frac{1}{n-1} \left( \sum_{i=1}^{n} x_i^2 - n\overline{x}^2 \right)$</td></tr>
                <tr><td>原点矩</td><td>$A_k = \frac{1}{n} \sum_{i=1}^{n} x_i^k$</td></tr>
                <tr><td>中心矩</td><td>$B_k = \frac{1}{n} \sum_{i=1}^{n} (x_i - \overline{x})^k$</td></tr>
            </table>
            `,
                // 第二页：三大抽样分布
                String.raw`
            <h3 style="margin-top:0;">2. 三大抽样分布</h3>
            <p><strong>(1) $\chi^2$ 分布：</strong> $\chi^2 = x_1^2 + x_2^2 + \cdots + x_n^2 \sim \chi^2(n)$<br>
            性质：$E[\chi^2(n)] = n, \quad D[\chi^2(n)] = 2n$</p>
            
            <p><strong>(2) $t$ 分布：</strong> $T = \frac{X}{\sqrt{Y/n}} \sim t(n)$<br>
            ($X \sim N(0,1), Y \sim \chi^2(n)$ 且独立)<br>
            性质：$E(T) = 0 \ (n > 1)$</p>
            
            <p><strong>(3) $F$ 分布：</strong> $F(m, n) = \frac{X/m}{Y/n} \sim F(m, n)$<br>
            性质：若 $F \sim F(m, n)$，则 $1/F \sim F(n, m)$</p>
            `
            ]
        },
        {
            title: "七、参数估计",
            pages: [
                // 第一页：矩估计与极大似然
                String.raw`
            <h3 style="margin-top:0;">1. 点估计两大方法</h3>
            <p><strong>① 矩估计法 (MoM)：</strong><br>
            思想：用样本矩（如均值 $\overline{x}$）替换总体矩（如 $E(X)$）。<br>
            方程：$\mu_i = g_i(\theta_1, \theta_2, \cdots, \theta_k)$，解出参数。</p>
            
            <p><strong>② 极大似然估计 (MLE)：</strong><br>
            步骤一：写出似然函数 $L(\theta) = \prod_{i=1}^{n} f(x_i, \theta)$<br>
            步骤二：取对数 $\ln L(\theta) = \sum_{i=1}^{n} \ln f(x_i, \theta)$<br>
            步骤三：求导并令其为0 $\frac{\partial \ln L}{\partial \theta_i} = 0$，解方程组。</p>

            <h3 style="margin-top:15px;">2. 估计量的评价标准</h3>
            <ul>
                <li><strong>无偏性：</strong> $E(\hat{\theta}) = \theta$</li>
                <li><strong>有效性：</strong> 方差越小越有效，即 $D(\hat{\theta}_1) < D(\hat{\theta}_2)$</li>
                <li><strong>一致性：</strong> 依概率收敛于真值。</li>
            </ul>
            `,
                // 第二页：置信区间 (超级表格)
                String.raw`
            <h3 style="margin-top:0;">3. 单正态总体参数的置信区间</h3>
            <p style="font-size: 12px; color: #666;">（置信水平为 $1-\alpha$）</p>
            <table>
                <tr><th>条件</th><th>参数</th><th>枢轴量及分布</th></tr>
                <tr>
                    <td>已知 $\sigma^2$</td>
                    <td>$\mu$</td>
                    <td>$Z = \frac{\overline{X} - \mu}{\sigma / \sqrt{n}} \sim N(0,1)$</td>
                </tr>
                <tr>
                    <td colspan="3" style="background:#f8f9fa;">
                        区间：$\left( \overline{x} - z_{\alpha/2}\frac{\sigma}{\sqrt{n}}, \overline{x} + z_{\alpha/2}\frac{\sigma}{\sqrt{n}} \right)$
                    </td>
                </tr>
                <tr>
                    <td>未知 $\sigma^2$</td>
                    <td>$\mu$</td>
                    <td>$T = \frac{\overline{X} - \mu}{S / \sqrt{n}} \sim t(n-1)$</td>
                </tr>
                <tr>
                    <td colspan="3" style="background:#f8f9fa;">
                        区间：$\left( \overline{x} - t_{\alpha/2}\frac{S}{\sqrt{n}}, \overline{x} + t_{\alpha/2}\frac{S}{\sqrt{n}} \right)$
                    </td>
                </tr>
                <tr>
                    <td>未知 $\mu$</td>
                    <td>$\sigma^2$</td>
                    <td>$\chi^2 = \frac{(n-1)S^2}{\sigma^2} \sim \chi^2(n-1)$</td>
                </tr>
                <tr>
                    <td colspan="3" style="background:#f8f9fa;">
                        区间：$\left( \frac{(n-1)s^2}{\chi_{\alpha/2}^2}, \frac{(n-1)s^2}{\chi_{1-\alpha/2}^2} \right)$
                    </td>
                </tr>
            </table>
            `
            ]
        }
        , // 记得加上逗号
        {
            title: "八、假设检验",
            pages: [
                // 第一页：基本概念与两类错误
                String.raw`
            <h3 style="margin-top:0;">1. 假设检验的基本概念</h3>
            <table>
                <tr><th>概念</th><th>内容详述</th></tr>
                <tr>
                    <td><strong>基本思想</strong></td>
                    <td>统计思想是小概率原理。显著性水平常取 $\alpha=0.05, 0.01$ 或 $0.10$。</td>
                </tr>
                <tr>
                    <td><strong>基本步骤</strong></td>
                    <td>
                        ① 提出原假设 $H_0$；<br>
                        ② 选择检验统计量 $g(X_1, \cdots, X_n)$；<br>
                        ③ 查表找分位数，定出拒绝域 $W$；<br>
                        ④ 计算实测值，落入 $W$ 则拒绝 $H_0$，否则接受。
                    </td>
                </tr>
                <tr>
                    <td><strong>第一类错误<br>(弃真错误)</strong></td>
                    <td>$H_0$ 为真时，却拒绝了 $H_0$。<br>
                    $P\{\text{拒绝 } H_0 \mid H_0 \text{ 为真}\} = \alpha$</td>
                </tr>
                <tr>
                    <td><strong>第二类错误<br>(取伪错误)</strong></td>
                    <td>$H_0$ 不真时，却接受了 $H_0$。<br>
                    $P\{\text{接受 } H_0 \mid H_0 \text{ 不真}\} = \beta$</td>
                </tr>
                <tr>
                    <td><strong>两类错误的关系</strong></td>
                    <td>样本容量 $n$ 一定时，$\alpha$ 变小则 $\beta$ 变大。要想使两者同时变小，必须<strong>增加样本容量</strong>。</td>
                </tr>
            </table>
            `,
                // 第二页：单正态总体假设检验 (使用 rowspan 优化排版)
                String.raw`
            <h3 style="margin-top:0;">2. 单正态总体参数的假设检验</h3>
            <p style="font-size: 14px; color: #666; margin-bottom: 8px;">（显著性水平为 $\alpha$）</p>
            <table>
                <tr><th>条件</th><th>原假设 $H_0$</th><th>检验统计量及分布</th><th>拒绝域 $W$</th></tr>
                
                <tr>
                    <td rowspan="3" style="background:#f8f9fa;">已知 $\sigma^2$</td>
                    <td>$\mu = \mu_0$</td>
                    <td rowspan="3">$Z = \frac{\overline{X} - \mu_0}{\sigma / \sqrt{n}} \sim N(0,1)$</td>
                    <td>$|z| > z_{\alpha/2}$</td>
                </tr>
                <tr><td>$\mu \le \mu_0$</td><td>$z > z_\alpha$</td></tr>
                <tr><td>$\mu \ge \mu_0$</td><td>$z < -z_\alpha$</td></tr>
                
                <tr>
                    <td rowspan="3" style="background:#f8f9fa;">未知 $\sigma^2$</td>
                    <td>$\mu = \mu_0$</td>
                    <td rowspan="3">$T = \frac{\overline{X} - \mu_0}{S / \sqrt{n}} \sim t(n-1)$</td>
                    <td>$|t| > t_{\alpha/2}(n-1)$</td>
                </tr>
                <tr><td>$\mu \le \mu_0$</td><td>$t > t_\alpha(n-1)$</td></tr>
                <tr><td>$\mu \ge \mu_0$</td><td>$t < -t_\alpha(n-1)$</td></tr>
                
                <tr>
                    <td rowspan="3" style="background:#f8f9fa;">未知 $\mu$</td>
                    <td>$\sigma^2 = \sigma_0^2$</td>
                    <td rowspan="3">$\chi^2 = \frac{(n-1)S^2}{\sigma_0^2} \sim \chi^2(n-1)$</td>
                    <td style="font-size: 16px;">$\chi^2 < \chi_{1-\alpha/2}^2$<br>或 $\chi^2 > \chi_{\alpha/2}^2$</td>
                </tr>
                <tr><td>$\sigma^2 \le \sigma_0^2$</td><td>$\chi^2 > \chi_\alpha^2$</td></tr>
                <tr><td>$\sigma^2 \ge \sigma_0^2$</td><td>$\chi^2 < \chi_{1-\alpha}^2$</td></tr>
            </table>
            <p style="font-size: 13px; color: #888; margin-top: 10px;">* 注：已知 $\mu$ 检验 $\sigma^2$ 的情况较少见，其统计量为 $\chi^2 = \frac{\sum (x_i - \mu)^2}{\sigma_0^2} \sim \chi^2(n)$，拒绝域形式与上述类似，仅自由度变为 $n$。</p>
            `
            ]
        }
    ];

    // --- Phase 7.1: 实用主义公式弹窗引擎 (重构版) ---

    // 状态管理
    let currentChapterIndex = 0;
    let currentPageIndex = 0;

    // DOM 元素获取 (更新版)
    const fab = document.getElementById('formula-fab');
    const overlay = document.getElementById('formula-overlay');
    const modalTitle = document.getElementById('formula-modal-title');
    const contentContainer = document.getElementById('formula-content');
    const closeBtn = document.getElementById('formula-close-btn');

    // 获取 4 个导航按钮
    const prevBtnTop = document.getElementById('prev-btn-top');
    const nextBtnTop = document.getElementById('next-btn-top');
    const prevBtnBottom = document.getElementById('prev-btn-bottom');
    const nextBtnBottom = document.getElementById('next-btn-bottom');


    // 初始化渲染 (打开弹窗时调用)
    function initFormulaModal() {
        renderFormulaContent();
    }

    // 核心渲染函数
    function renderFormulaContent() {
        const chapter = formulaData[currentChapterIndex];

        // 1. 更新弹窗标题
        modalTitle.textContent = chapter.title;

        // 2. 注入当前页 HTML 内容
        contentContainer.innerHTML = chapter.pages[currentPageIndex];
        contentContainer.scrollTop = 0; // 滚动回顶部

        // 3. 调用 KaTeX 渲染公式
        if (window.renderMathInElement) {
            window.renderMathInElement(contentContainer, {
                delimiters: [
                    { left: "$$", right: "$$", display: true },
                    { left: "$", right: "$", display: false },
                    { left: "\\begin{cases}", right: "\\end{cases}", display: true }
                ]
            });
        }

        // 4. 更新导航按钮状态与动态 Tooltip
        updateNavButtonsState();
    }

    // 更新按钮状态与悬浮提示 (Tooltip)
    function updateNavButtonsState() {
        // --- 顶部按钮控制：单元 (Chapter) ---
        const isFirstChapter = (currentChapterIndex === 0);
        const isLastChapter = (currentChapterIndex === formulaData.length - 1);

        prevBtnTop.disabled = isFirstChapter;
        nextBtnTop.disabled = isLastChapter;

        // 动态设置顶部按钮的 Tooltip (title 属性)
        prevBtnTop.title = isFirstChapter ? '已经是第一单元' : '上一单元: ' + formulaData[currentChapterIndex - 1].title;
        nextBtnTop.title = isLastChapter ? '已经是最后一单元' : '下一单元: ' + formulaData[currentChapterIndex + 1].title;

        // --- 底部按钮控制：页码 (Page) ---
        const isFirstPage = (currentPageIndex === 0);
        const isLastPage = (currentPageIndex === formulaData[currentChapterIndex].pages.length - 1);

        prevBtnBottom.disabled = isFirstPage;
        nextBtnBottom.disabled = isLastPage;

        // 底部按钮固定 Tooltip
        prevBtnBottom.title = isFirstPage ? '本单元第一页' : '上一页';
        nextBtnBottom.title = isLastPage ? '本单元最后一页' : '下一页';
    }

    // --- 导航逻辑分离 ---

    // 1. 跨单元切换 (顶部按钮调用)
    function goPrevChapter() {
        if (currentChapterIndex > 0) {
            currentChapterIndex--;
            currentPageIndex = 0; // 切换单元时，强制回到第一页
            renderFormulaContent();
        }
    }

    function goNextChapter() {
        if (currentChapterIndex < formulaData.length - 1) {
            currentChapterIndex++;
            currentPageIndex = 0; // 切换单元时，强制回到第一页
            renderFormulaContent();
        }
    }

    // 2. 单元内翻页 (底部按钮调用)
    function goPrevPage() {
        if (currentPageIndex > 0) {
            currentPageIndex--;
            renderFormulaContent();
        }
    }

    function goNextPage() {
        if (currentPageIndex < formulaData[currentChapterIndex].pages.length - 1) {
            currentPageIndex++;
            renderFormulaContent();
        }
    }

    // --- 事件监听绑定 ---

    // 打开弹窗
    fab.addEventListener('click', () => {
        overlay.classList.add('active');
        initFormulaModal();
    });

    // 关闭弹窗 (点击叉号 X 或遮罩层)
    closeBtn.addEventListener('click', () => overlay.classList.remove('active'));
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('active');
    });

    // 绑定独立的导航事件
    prevBtnTop.addEventListener('click', goPrevChapter);
    nextBtnTop.addEventListener('click', goNextChapter);

    prevBtnBottom.addEventListener('click', goPrevPage);
    nextBtnBottom.addEventListener('click', goNextPage);
});