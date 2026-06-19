/**
 * CBT Exam Unified Engine
 * Standardizes CBT functionality, state management, layouts, and accessibility.
 */

(function() {
  // ── Auto-fix generic page titles ──
  const genericTitles = ['devgagan', 'CBT Exam - pundits', 'CBT Exam'];
  const currentTitle = document.title || '';
  const isGeneric = genericTitles.some(g => currentTitle.toLowerCase() === g.toLowerCase());
  if (isGeneric) {
    document.addEventListener('DOMContentLoaded', function() {
      const h1 = document.querySelector('.welcome-header h1, .welcome-header h2');
      if (h1 && h1.textContent.trim()) {
        document.title = h1.textContent.trim().substring(0, 80);
      }
    });
  }

  // ── Apply saved theme as early as possible to prevent flashing ──
  try {
    const savedTheme = localStorage.getItem('portal-theme') || 'dark';
    if (savedTheme === 'light') {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-mode');
    } else {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-theme');
    }
  } catch (e) {}

  // ── Math Equation Aligner ──
  function processImage(img) {
    if (img.classList.contains('processed-math')) return;
    img.classList.add('processed-math');
    const hasLargeAttr = (img.getAttribute('width') && parseInt(img.getAttribute('width')) > 100) ||
                         (img.getAttribute('height') && parseInt(img.getAttribute('height')) > 60);
    const src = img.src || '';
    const isMath = src.includes('parserImages') || 
                   src.includes('equation') || 
                   img.classList.contains('eq-img') ||
                   (!hasLargeAttr && (img.align === 'bottom' || img.align === 'middle' || !img.align));
    if (isMath && !hasLargeAttr) {
      img.classList.add('math-eq');
    }
  }
  
  function initMathAligner() {
    document.querySelectorAll('img').forEach(processImage);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'IMG') {
              processImage(node);
            } else {
              node.querySelectorAll('img').forEach(processImage);
            }
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMathAligner);
  } else {
    initMathAligner();
  }
})();

class CBTExamEngine {
  constructor(config = {}) {
    this.questions = config.questions || window.questions || [];
    this.sections = config.sections !== undefined ? config.sections : (window.sectionsData || null);
    this.marksPerQ = config.marksPerQ !== undefined ? config.marksPerQ : (window.marksPerQ || 3.0);
    this.negMarks = config.negMarks !== undefined ? config.negMarks : (window.negMarks || 1.0);
    this.totalDuration = config.totalDuration !== undefined ? config.totalDuration : (window.totalDuration || 60);
    this.theme = config.theme || 'modern';

    // State Variables
    this.currentQuestion = 0;
    this.answers = new Array(this.questions.length).fill(null);
    this.markedForReview = new Array(this.questions.length).fill(false);
    this.timeSpent = new Array(this.questions.length).fill(0);
    this.isEnglish = true;
    this.isSubmitted = false;
    
    this.startTime = null;
    this.lastQuestionTime = null;
    this.mainTimer = null;
    this.sectionTimer = null;
    this.currentSectionIdx = 0;
    this.totalTimeLeft = this.totalDuration * 60;
    this.endTime = null;
    
    // Pause state
    this.isPaused = false;
    this.pauseDuration = 0;
    this.lastPauseStart = null;
    
    // Storage state setup
    try {
      this.storageKey = `cbt-state-${encodeURIComponent(document.title || 'exam')}`;
    } catch(e) {
      this.storageKey = 'cbt-state-fallback';
    }

    // Dynamic configuration loading & elements init
    this.initElements();
    this.loadPersistedState();
    this.setupWelcomeScreen();
    this.setupThemeToggle();
    this.setupGlobalHandlers();

    // Map legacy class properties for compatibility
    this.syncLegacyProperties();
  }

  initElements() {
    this.els = {
      welcomeScreen: document.getElementById('welcomeScreen'),
      examContainer: document.getElementById('examContainer'),
      mainTimer: document.getElementById('mainTimer') || document.getElementById('timer'),
      sectionBadge: document.getElementById('sectionBadge'),
      sectionName: document.getElementById('sectionName'),
      sectionTimer: document.getElementById('sectionTimer'),
      sectionTabs: document.getElementById('sectionTabs'),
      questionNum: document.getElementById('questionNum'),
      questionMarks: document.getElementById('questionMarks'),
      questionText: document.getElementById('questionText'),
      comprehension: document.getElementById('comprehension'),
      comprehensionText: document.getElementById('comprehensionText'),
      optionsList: document.getElementById('optionsList'),
      solutionBox: document.getElementById('solutionBox'),
      solutionStats: document.getElementById('solutionStats'),
      solutionText: document.getElementById('solutionText'),
      progressText: document.getElementById('progressText'),
      answeredCount: document.getElementById('answeredCount'),
      desktopNav: document.getElementById('desktopNav') || document.getElementById('navGrid'),
      mobileNav: document.getElementById('mobileNav') || document.getElementById('mobileDrawer'),
      mobileNavGrid: document.getElementById('mobileNavGrid') || document.getElementById('mobileGrid'),
      resultModal: document.getElementById('resultModal') || document.getElementById('resultOverlay') || document.getElementById('modalOver'),
      resultScore: document.getElementById('resultScore') || document.getElementById('scoreDisp'),
      correctCount: document.getElementById('correctCount') || document.getElementById('corrStat'),
      incorrectCount: document.getElementById('incorrectCount') || document.getElementById('incStat'),
      unattemptedCount: document.getElementById('unattemptedCount') || document.getElementById('unaStat'),
      timeTaken: document.getElementById('timeTaken') || document.getElementById('timeStat'),
      sectionResults: document.getElementById('sectionResults'),
      sectionResultsBody: document.getElementById('sectionResultsBody'),
      panel: document.querySelector('.navigator-sidebar') || document.getElementById('mobileNav')
    };
  }

  loadPersistedState() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && Array.isArray(parsed.answers) && parsed.answers.length === this.questions.length) {
          this.answers = parsed.answers;
          this.markedForReview = parsed.markedForReview || parsed.reviewed || this.markedForReview;
          this.timeSpent = parsed.timeSpent || this.timeSpent;
          this.isEnglish = parsed.isEnglish !== undefined ? parsed.isEnglish : true;
          this.isSubmitted = parsed.isSubmitted !== undefined ? parsed.isSubmitted : (parsed.sub !== undefined ? parsed.sub : false);
          this.currentQuestion = parsed.currentQuestion !== undefined ? parsed.currentQuestion : (parsed.curQ !== undefined ? parsed.curQ : 0);
          this.totalTimeLeft = parsed.totalTimeLeft !== undefined ? parsed.totalTimeLeft : this.totalTimeLeft;
          this.currentSectionIdx = parsed.currentSectionIdx !== undefined ? parsed.currentSectionIdx : (parsed.currentSection !== undefined ? parsed.currentSection : 0);
          if (this.sections && parsed.sections) {
            this.sections.forEach((sec, idx) => {
              if (parsed.sections[idx]) {
                sec.time_left = parsed.sections[idx].time_left;
                sec.submitted = parsed.sections[idx].submitted;
              }
            });
          }
        }
      }
    } catch(e) {
      console.warn("Failed to load local state, resetting state", e);
      try { localStorage.removeItem(this.storageKey); } catch(err) {}
    }
  }

  saveState() {
    if (this.isSubmitted) {
      try { localStorage.removeItem(this.storageKey); } catch(e) {}
      return;
    }
    try {
      const state = {
        answers: this.answers,
        markedForReview: this.markedForReview,
        timeSpent: this.timeSpent,
        isEnglish: this.isEnglish,
        isSubmitted: this.isSubmitted,
        currentQuestion: this.currentQuestion,
        totalTimeLeft: this.totalTimeLeft,
        currentSectionIdx: this.currentSectionIdx,
        sections: this.sections ? this.sections.map(s => ({ time_left: s.time_left, submitted: s.submitted })) : null
      };
      localStorage.setItem(this.storageKey, JSON.stringify(state));
    } catch(e) {
      console.error("Failed to save state to localStorage", e);
    }
  }

  setupWelcomeScreen() {
    const totalQsEl = document.getElementById('welcomeTotalQs');
    const totalMarksEl = document.getElementById('welcomeTotalMarks');
    const durationEl = document.getElementById('welcomeDuration');
    const marksSchemeEl = document.getElementById('welcomeMarksScheme');

    if (totalQsEl) totalQsEl.textContent = this.questions.length;
    if (totalMarksEl) totalMarksEl.textContent = (this.questions.length * this.marksPerQ).toFixed(1);
    if (durationEl) durationEl.textContent = this.totalDuration;
    if (marksSchemeEl) marksSchemeEl.textContent = `+${this.marksPerQ.toFixed(1)} / -${this.negMarks.toFixed(1)}`;

    if (this.sections && this.sections.length > 0) {
      const sBlock = document.getElementById('welcomeSectionsBlock');
      const sBody = document.getElementById('welcomeSectionsBody');
      if (sBlock) sBlock.style.display = 'block';
      if (sBody) {
        sBody.innerHTML = this.sections.map(s => `
          <tr>
            <td>
              <strong>${s.name}</strong>
              ${s.subsections ? `<div class="subsec-container">${s.subsections.map(sub => `<div class="subsec-row">${sub.name}: Q${sub.start+1}-Q${sub.end+1}</div>`).join('')}</div>` : ''}
            </td>
            <td>Q${s.start+1} - Q${s.end+1}</td>
            <td>${Math.round(s.timer / 60)} mins</td>
          </tr>
        `).join('');
      }
    }

    const startBtn = document.getElementById('startBtn') || document.getElementById('startExam') || document.getElementById('initExam');
    if (startBtn) {
      startBtn.onclick = (e) => {
        if (e) e.preventDefault();
        if (this.els.welcomeScreen) this.els.welcomeScreen.classList.add('hidden');
        if (this.els.examContainer) this.els.examContainer.classList.add('active');
        this.startExam();
      };
    }
  }

  setupThemeToggle() {
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.onclick = (e) => {
        if (e) e.stopPropagation();
        const isLight = document.body.classList.toggle('light-theme');
        document.body.classList.toggle('dark-mode', !isLight);
        try {
          localStorage.setItem('portal-theme', isLight ? 'light' : 'dark');
        } catch(err) {}

        const icon = btn.querySelector('i, span.icon') || document.getElementById('theme-toggle-icon');
        if (icon) {
          if (isLight) {
            icon.className = 'fas fa-sun';
            if (icon.tagName === 'SPAN') icon.textContent = '☀️';
          } else {
            icon.className = 'fas fa-moon';
            if (icon.tagName === 'SPAN') icon.textContent = '🌙';
          }
        }
      };
    }
  }

  setupGlobalHandlers() {
    // Escape key modal dismiss
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.keyCode === 27) {
        if (this.els.resultModal) {
          this.els.resultModal.style.display = 'none';
          this.els.resultModal.classList.remove('show');
        }
        const pauseModal = document.getElementById('pauseModal');
        if (pauseModal) {
          pauseModal.style.display = 'none';
        }
      }

      // Keyboard Left/Right arrow navigation
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        if (e.key === 'ArrowLeft') {
          this.navigate(-1);
        } else if (e.key === 'ArrowRight') {
          this.navigate(1);
        }
      }
    });

    // Backdrop click dismiss for resultModal
    if (this.els.resultModal) {
      this.els.resultModal.onclick = (e) => {
        if (e.target === this.els.resultModal) {
          this.els.resultModal.style.display = 'none';
          this.els.resultModal.classList.remove('show');
        }
      };
    }

    // Unload safety
    window.onbeforeunload = (e) => {
      if (!this.isSubmitted) {
        return 'Your test is in progress. Are you sure you want to leave?';
      }
    };
  }

  startExam() {
    this.startTime = Date.now();
    this.endTime = this.startTime + (this.totalTimeLeft * 1000);
    this.lastQuestionTime = this.startTime;

    // Dynamic Tier I sections
    if (!this.sections || this.sections.length === 0) {
      this.buildSoftSections();
    }

    this.createNavigator();
    this.startMainTimer();

    if (this.sections && this.sections.length > 0) {
      this.startSectionTimer();
      this.updateSectionInfo();
    }

    this.loadQuestion(this.currentQuestion);
    this.setupEventListeners();
    this.saveState();
  }

  buildSoftSections() {
    if (this.questions.length === 100) {
      this.softSections = [
        { name: "REASONING", start: 0, end: 24 },
        { name: "GENERAL AWARENESS", start: 25, end: 49 },
        { name: "QUANTITATIVE APTITUDE", start: 50, end: 74 },
        { name: "ENGLISH COMPREHENSION", start: 75, end: 99 }
      ];
    } else {
      const part = Math.floor(this.questions.length / 4);
      this.softSections = [
        { name: "SECTION A", start: 0, end: Math.max(0, part - 1) },
        { name: "SECTION B", start: part, end: Math.max(part, (part * 2) - 1) },
        { name: "SECTION C", start: part * 2, end: Math.max(part * 2, (part * 3) - 1) },
        { name: "SECTION D", start: part * 3, end: this.questions.length - 1 }
      ];
    }
    
    if (this.els.sectionTabs) {
      this.els.sectionTabs.style.display = 'flex';
      this.renderSoftSectionTabs();
    }
  }

  renderSoftSectionTabs() {
    if (!this.els.sectionTabs || !this.softSections) return;
    this.els.sectionTabs.innerHTML = this.softSections.map((sec, idx) => {
      const isActive = this.currentQuestion >= sec.start && this.currentQuestion <= sec.end;
      return `<button class="section-tab${isActive ? ' active' : ''}" onclick="window.app.goToQuestion(${sec.start})">${sec.name}</button>`;
    }).join('');
  }

  updateSoftSectionTabs() {
    if (!this.els.sectionTabs || !this.softSections) return;
    const tabs = this.els.sectionTabs.querySelectorAll('.section-tab');
    this.softSections.forEach((sec, idx) => {
      if (tabs[idx]) {
        const isActive = this.currentQuestion >= sec.start && this.currentQuestion <= sec.end;
        tabs[idx].classList.toggle('active', isActive);
      }
    });
  }

  setupEventListeners() {
    const bindClick = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.onclick = fn;
    };

    bindClick('engBtn', () => this.setLanguage(true));
    bindClick('hinBtn', () => this.setLanguage(false));
    bindClick('prevBtn', () => this.navigate(-1));
    
    const nextBtn = document.getElementById('nextBtn') || document.querySelector('.btn-next');
    if (nextBtn) nextBtn.onclick = () => this.navigate(1);

    bindClick('reviewBtn', () => this.toggleReview());
    bindClick('submitBtn', () => this.confirmSubmit());
    bindClick('submitBtnDesktop', () => this.confirmSubmit());
    bindClick('subBtn', () => this.confirmSubmit());
    bindClick('navigatorBtn', () => this.openMobileNav());
    bindClick('closeNav', () => this.closeMobileNav());
    bindClick('closeResult', () => this.closeResultModal());
    bindClick('reviewAnswers', () => this.reviewAnswers());
    bindClick('pauseBtn', () => this.togglePause());
    bindClick('resumeBtn', () => this.togglePause());
    bindClick('printBtn', () => this.printTest());
  }

  createNavigator() {
    [this.els.desktopNav, this.els.mobileNavGrid].forEach(container => {
      if (!container) return;
      container.innerHTML = '';
      this.questions.forEach((_, i) => {
        const btn = document.createElement('div');
        btn.className = 'nav-question';
        btn.textContent = i + 1;
        btn.onclick = () => this.goToQuestion(i);
        container.appendChild(btn);
      });
    });
  }

  extractText(html, isEng) {
    if (!html) return '';
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    const langSpans = temp.querySelectorAll('span.eqt, span.hqt');
    langSpans.forEach(span => {
      if ((isEng && span.classList.contains('hqt')) || 
          (!isEng && span.classList.contains('eqt'))) {
        span.style.display = 'none';
      } else {
        span.style.display = '';
      }
    });
    return temp.innerHTML;
  }

  getQuestionMarks(qIdx) {
    if (!this.sections) return this.marksPerQ;
    for (const section of this.sections) {
      if (qIdx >= section.start && qIdx <= section.end) {
        if (section.subsections) {
          for (const subsec of section.subsections) {
            if (qIdx >= subsec.start && qIdx <= subsec.end) {
              return subsec.marks_per_q || this.marksPerQ;
            }
          }
        }
        return section.marks_per_q || this.marksPerQ;
      }
    }
    return this.marksPerQ;
  }

  loadQuestion(idx) {
    if (this.currentQuestion !== idx) {
      const now = Date.now();
      this.timeSpent[this.currentQuestion] += (now - this.lastQuestionTime) / 1000;
      this.lastQuestionTime = now;
    }
    
    this.currentQuestion = idx;
    const q = this.questions[idx];
    if (!q) return;
    const qMarks = this.getQuestionMarks(idx);
    
    if (this.els.questionNum) {
      this.els.questionNum.textContent = `Question ${idx + 1} of ${this.questions.length}`;
    }
    if (this.els.questionMarks) {
      this.els.questionMarks.textContent = `Marks: ${qMarks.toFixed(1)}`;
    }
    if (this.els.progressText) {
      this.els.progressText.textContent = `Question ${idx + 1} of ${this.questions.length}`;
    }

    this.updateAnsweredCount();
    this.updateNavigator();
    this.updateNavigationButtons();
    this.updateReviewButton();
    this.updateSoftSectionTabs();
    
    if (this.els.comprehension) {
      if (q.comp) {
        this.els.comprehension.style.display = 'block';
        this.els.comprehensionText.innerHTML = this.extractText(q.comp, this.isEnglish);
      } else {
        this.els.comprehension.style.display = 'none';
      }
    }
    
    if (this.els.questionText) {
      this.els.questionText.innerHTML = this.extractText(q.question, this.isEnglish);
    }
    this.loadOptions(q, idx);
    
    if (this.els.solutionBox) {
      if (this.isSubmitted && q.solution) {
        const timeSpent = Math.round(this.timeSpent[idx]);
        const mins = Math.floor(timeSpent / 60);
        const secs = timeSpent % 60;
        const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        
        if (this.els.solutionStats) {
          this.els.solutionStats.innerHTML = `
            <span><i class="fas fa-clock"></i> Time spent: ${timeStr}</span>
            <span><i class="fas fa-check-circle"></i> Correct Option: ${String.fromCharCode(65 + q.correct_option_id)}</span>
          `;
        }
        if (this.els.solutionText) {
          this.els.solutionText.innerHTML = this.extractText(q.solution, this.isEnglish);
        }
        this.els.solutionBox.classList.add('show');
      } else {
        this.els.solutionBox.classList.remove('show');
      }
    }
    this.saveState();
  }

  loadOptions(q, qIdx) {
    if (!this.els.optionsList) return;
    this.els.optionsList.innerHTML = '';
    const userAnswer = this.answers[qIdx];
    const correctAnswer = q.correct_option_id;
    
    if (!q.options || !Array.isArray(q.options)) return;
    
    q.options.forEach((opt, i) => {
      const div = document.createElement('div');
      let className = 'option';
      
      if (this.isSubmitted) className += ' submitted';
      if (userAnswer === i) className += ' selected';
      
      if (this.isSubmitted && correctAnswer !== undefined) {
        if (i === correctAnswer) {
          className += ' correct';
        } else if (userAnswer === i && userAnswer !== correctAnswer) {
          className += ' wrong';
        }
      }
      
      div.className = className;
      
      let indicator = String.fromCharCode(65 + i);
      if (this.isSubmitted && correctAnswer !== undefined) {
        if (i === correctAnswer) {
          indicator = '✓';
        } else if (userAnswer === i) {
          indicator = '✗';
        }
      } else if (userAnswer === i) {
        indicator = '✓';
      }
      
      div.innerHTML = `
        <div class="option-indicator">${indicator}</div>
        <div class="option-text">${this.extractText(opt, this.isEnglish)}</div>
      `;
      
      if (!this.isSubmitted) {
        div.onclick = () => this.selectOption(i, qIdx);
      }
      
      this.els.optionsList.appendChild(div);
    });
  }

  selectOption(optIdx, qIdx) {
    if (this.isSubmitted) return;
    this.answers[qIdx] = this.answers[qIdx] === optIdx ? null : optIdx;
    this.loadOptions(this.questions[qIdx], qIdx);
    this.updateAnsweredCount();
    this.updateNavigator();
    this.saveState();
  }

  toggleReview() {
    if (this.isSubmitted) return;
    this.markedForReview[this.currentQuestion] = !this.markedForReview[this.currentQuestion];
    this.updateNavigator();
    this.updateReviewButton();
    this.saveState();
  }

  updateReviewButton() {
    const btn = document.getElementById('reviewBtn');
    if (!btn) return;
    if (this.markedForReview[this.currentQuestion]) {
      btn.classList.add('marked');
      btn.innerHTML = '<i class="fas fa-flag"></i> Marked';
    } else {
      btn.classList.remove('marked');
      btn.innerHTML = '<i class="fas fa-flag"></i> Mark for Review';
    }
  }

  navigate(dir) {
    const newIdx = this.currentQuestion + dir;
    if (this.isSubmitted) {
      if (newIdx >= 0 && newIdx < this.questions.length) {
        this.loadQuestion(newIdx);
      }
      return;
    }
    
    if (this.sections && this.sections.length > 0) {
      const currentSection = this.sections[this.currentSectionIdx];
      if (newIdx < currentSection.start || newIdx > currentSection.end) {
        return;
      }
    }
    
    if (newIdx >= 0 && newIdx < this.questions.length) {
      this.loadQuestion(newIdx);
    }
  }

  goToQuestion(idx) {
    if (this.isSubmitted) {
      this.loadQuestion(idx);
      this.closeMobileNav();
      return;
    }
    
    if (this.sections && this.sections.length > 0) {
      const currentSection = this.sections[this.currentSectionIdx];
      if (idx < currentSection.start || idx > currentSection.end) {
        return;
      }
    }
    
    this.loadQuestion(idx);
    this.closeMobileNav();
  }

  updateNavigator() {
    [this.els.desktopNav, this.els.mobileNavGrid].forEach(container => {
      if (!container) return;
      const btns = container.querySelectorAll('.nav-question');
      btns.forEach((btn, i) => {
        btn.className = 'nav-question';
        
        if (i === this.currentQuestion) {
          btn.classList.add('current');
        } else if (this.isSubmitted) {
          if (this.answers[i] !== null && this.questions[i].correct_option_id !== undefined) {
            if (this.answers[i] === this.questions[i].correct_option_id) {
              btn.classList.add('answered');
            } else {
              btn.classList.add('wrong');
            }
          }
        } else {
          if (this.markedForReview[i]) {
            btn.classList.add('review');
          } else if (this.answers[i] !== null) {
            btn.classList.add('answered');
          }
          
          if (this.sections && this.sections.length > 0) {
            const currentSection = this.sections[this.currentSectionIdx];
            if (i < currentSection.start || i > currentSection.end) {
              btn.classList.add('disabled');
            }
          }
        }
      });
    });
  }

  updateNavigationButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn') || document.querySelector('.btn-next');
    const reviewBtn = document.getElementById('reviewBtn');
    
    if (prevBtn) prevBtn.disabled = this.currentQuestion === 0;
    if (nextBtn) nextBtn.disabled = this.currentQuestion === this.questions.length - 1;
    
    if (reviewBtn) {
      if (this.isSubmitted) {
        reviewBtn.style.display = 'none';
      } else {
        reviewBtn.style.display = 'inline-flex';
      }
    }
    
    if (this.sections && this.sections.length > 0 && !this.isSubmitted) {
      const currentSection = this.sections[this.currentSectionIdx];
      if (prevBtn) prevBtn.disabled = prevBtn.disabled || (this.currentQuestion === currentSection.start);
      if (nextBtn) nextBtn.disabled = nextBtn.disabled || (this.currentQuestion === currentSection.end);
    }
  }

  updateAnsweredCount() {
    const count = this.answers.filter(a => a !== null).length;
    if (this.els.answeredCount) {
      this.els.answeredCount.textContent = count;
    }
  }

  setLanguage(isEng) {
    this.isEnglish = isEng;
    const engBtn = document.getElementById('engBtn');
    const hinBtn = document.getElementById('hinBtn');
    if (engBtn) engBtn.classList.toggle('active', isEng);
    if (hinBtn) hinBtn.classList.toggle('active', !isEng);
    this.loadQuestion(this.currentQuestion);
  }

  startMainTimer() {
    if (this.mainTimer) clearInterval(this.mainTimer);
    this.mainTimer = setInterval(() => {
      if (this.isPaused) return;

      // tab-drift prevention: recalculate from system endTime
      const secondsLeft = Math.max(0, Math.round((this.endTime - Date.now()) / 1000));
      this.totalTimeLeft = secondsLeft;

      if (this.totalTimeLeft <= 0) {
        clearInterval(this.mainTimer);
        this.submitTest();
        return;
      }
      
      const mins = Math.floor(this.totalTimeLeft / 60);
      const secs = this.totalTimeLeft % 60;
      if (this.els.mainTimer) {
        this.els.mainTimer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }

  startSectionTimer() {
    if (!this.sections || this.sections.length === 0) return;
    if (this.sectionTimer) clearInterval(this.sectionTimer);
    
    const section = this.sections[this.currentSectionIdx];
    if (section.time_left === undefined) {
      section.time_left = section.timer;
    }
    
    const updateTimerDisplay = () => {
      if (!this.els.sectionTimer) return;
      const mins = Math.floor(section.time_left / 60);
      const secs = section.time_left % 60;
      this.els.sectionTimer.textContent = ` | ${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    updateTimerDisplay();
    
    this.sectionTimer = setInterval(() => {
      if (this.isPaused) return;
      section.time_left--;
      updateTimerDisplay();
      
      if (section.time_left <= 0) {
        clearInterval(this.sectionTimer);
        this.submitSection();
      }
    }, 1000);
  }

  updateSectionInfo() {
    if (!this.sections || this.sections.length === 0) return;
    const section = this.sections[this.currentSectionIdx];
    if (this.els.sectionName) this.els.sectionName.textContent = section.name;
    if (this.els.sectionBadge) this.els.sectionBadge.style.display = 'block';
    
    if (section.time_left !== undefined && this.els.sectionTimer) {
      const mins = Math.floor(section.time_left / 60);
      const secs = section.time_left % 60;
      this.els.sectionTimer.textContent = ` | ${mins}:${secs.toString().padStart(2, '0')}`;
    }
  }

  submitSection() {
    if (!this.sections || this.sections.length === 0) return;
    
    const section = this.sections[this.currentSectionIdx];
    section.submitted = true;
    clearInterval(this.sectionTimer);
    
    const nextSectionIdx = this.currentSectionIdx + 1;
    if (nextSectionIdx < this.sections.length) {
      this.currentSectionIdx = nextSectionIdx;
      this.startSectionTimer();
      this.updateSectionInfo();
      this.loadQuestion(this.sections[nextSectionIdx].start);
    } else {
      this.submitTest();
    }
    this.updateNavigator();
  }

  confirmSubmit() {
    if (this.sections && this.sections.length > 0) {
      const section = this.sections[this.currentSectionIdx];
      const unanswered = this.answers.slice(section.start, section.end + 1)
          .filter(a => a === null).length;
      
      let msg = unanswered > 0 
          ? `You have ${unanswered} unanswered questions in this section. Submit Section?`
          : 'Submit this section?';
      
      if (confirm(msg)) this.submitSection();
    } else {
      const unanswered = this.answers.filter(a => a === null).length;
      let msg = unanswered > 0 
          ? `You have ${unanswered} unanswered questions. Submit entire test?`
          : 'Submit test?';
      
      if (confirm(msg)) this.submitTest();
    }
  }

  submitTest() {
    if (this.isSubmitted) return;
    
    const now = Date.now();
    this.timeSpent[this.currentQuestion] += (now - this.lastQuestionTime) / 1000;
    
    this.isSubmitted = true;
    clearInterval(this.mainTimer);
    if (this.sectionTimer) clearInterval(this.sectionTimer);
    
    const hideEl = (id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    };
    hideEl('submitBtn');
    hideEl('submitBtnDesktop');
    hideEl('subBtn');
    hideEl('reviewBtn');
    
    if (this.sections && this.sections.length > 0 && this.els.sectionBadge) {
      this.els.sectionBadge.style.display = 'none';
    }
    
    const results = this.calculateResults();
    this.showResults(results);
    this.loadQuestion(this.currentQuestion);
    this.updateNavigator();
    this.updatePrintButton();
    this.saveState();
  }

  calculateResults() {
    const timeTaken = Math.round((Date.now() - this.startTime - this.pauseDuration) / 60000);
    let correct = 0, incorrect = 0, unattempted = 0, score = 0;
    
    const sectionResults = [];
    
    if (this.sections && this.sections.length > 0) {
      for (const section of this.sections) {
        let secCorrect = 0, secIncorrect = 0, secUnattempted = 0, secScore = 0;
        const subsecResults = [];
        
        if (section.subsections) {
          for (const subsec of section.subsections) {
            let subCorrect = 0, subIncorrect = 0, subUnattempted = 0, subScore = 0;
            
            for (let i = subsec.start; i <= subsec.end; i++) {
              const userAns = this.answers[i];
              const correctAns = this.questions[i].correct_option_id;
              
              if (userAns === null) {
                subUnattempted++;
              } else if (correctAns !== undefined && userAns === correctAns) {
                subCorrect++;
                subScore += subsec.marks_per_q || this.marksPerQ;
              } else {
                subIncorrect++;
                subScore -= this.negMarks;
              }
            }
            
            subsecResults.push({
              name: subsec.name,
              attempted: subCorrect + subIncorrect,
              correct: subCorrect,
              incorrect: subIncorrect,
              unattempted: subUnattempted,
              score: Math.max(0, subScore)
            });
            
            secCorrect += subCorrect;
            secIncorrect += subIncorrect;
            secUnattempted += subUnattempted;
            secScore += subScore;
          }
        } else {
          for (let i = section.start; i <= section.end; i++) {
            const userAns = this.answers[i];
            const correctAns = this.questions[i].correct_option_id;
            
            if (userAns === null) {
              secUnattempted++;
            } else if (correctAns !== undefined && userAns === correctAns) {
              secCorrect++;
              secScore += section.marks_per_q || this.marksPerQ;
            } else {
              secIncorrect++;
              secScore -= this.negMarks;
            }
          }
        }
        
        sectionResults.push({
          name: section.name,
          attempted: secCorrect + secIncorrect,
          correct: secCorrect,
          incorrect: secIncorrect,
          unattempted: secUnattempted,
          score: Math.max(0, secScore),
          subsections: subsecResults.length > 0 ? subsecResults : null
        });
        
        correct += secCorrect;
        incorrect += secIncorrect;
        unattempted += secUnattempted;
        score += secScore;
      }
    } else {
      this.questions.forEach((q, i) => {
        const userAns = this.answers[i];
        const correctAns = q.correct_option_id;
        
        if (userAns === null) {
          unattempted++;
        } else if (correctAns !== undefined && userAns === correctAns) {
          correct++;
          score += this.marksPerQ;
        } else {
          incorrect++;
          score -= this.negMarks;
        }
      });
    }
    
    return {
      score: Math.max(0, score),
      correct,
      incorrect,
      unattempted,
      timeTaken,
      sectionResults: sectionResults.length > 0 ? sectionResults : null
    };
  }

  showResults(results) {
    if (this.els.resultScore) {
      this.els.resultScore.textContent = `${results.score.toFixed(2)}/${(this.questions.length * this.marksPerQ).toFixed(1)}`;
    }
    if (this.els.correctCount) this.els.correctCount.textContent = results.correct;
    if (this.els.incorrectCount) this.els.incorrectCount.textContent = results.incorrect;
    if (this.els.unattemptedCount) this.els.unattemptedCount.textContent = results.unattempted;
    if (this.els.timeTaken) this.els.timeTaken.textContent = results.timeTaken;
    
    if (this.els.sectionResults) {
      if (results.sectionResults) {
        this.els.sectionResults.style.display = 'block';
        if (this.els.sectionResultsBody) {
          this.els.sectionResultsBody.innerHTML = '';
          results.sectionResults.forEach(section => {
            const row = document.createElement('tr');
            row.innerHTML = `
              <td><strong>${section.name}</strong></td>
              <td>${section.attempted}</td>
              <td>${section.correct}</td>
              <td>${section.incorrect}</td>
              <td><strong>${section.score.toFixed(2)}</strong></td>
            `;
            this.els.sectionResultsBody.appendChild(row);
            
            if (section.subsections) {
              section.subsections.forEach(subsec => {
                const subRow = document.createElement('tr');
                subRow.className = 'subsection-row';
                subRow.innerHTML = `
                  <td style="padding-left: 20px;">${subsec.name}</td>
                  <td>${subsec.attempted}</td>
                  <td>${subsec.correct}</td>
                  <td>${subsec.incorrect}</td>
                  <td>${subsec.score.toFixed(2)}</td>
                `;
                this.els.sectionResultsBody.appendChild(subRow);
              });
            }
          });
        }
      } else {
        this.els.sectionResults.style.display = 'none';
      }
    }
    
    if (this.els.resultModal) {
      this.els.resultModal.classList.add('show');
      this.els.resultModal.style.display = 'flex';
    }
  }

  closeResultModal() {
    if (this.els.resultModal) {
      this.els.resultModal.classList.remove('show');
      this.els.resultModal.style.display = 'none';
    }
  }

  reviewAnswers() {
    this.closeResultModal();
    this.loadQuestion(0);
  }

  openMobileNav() {
    if (this.els.mobileNav) this.els.mobileNav.classList.add('open');
  }

  closeMobileNav() {
    if (this.els.mobileNav) this.els.mobileNav.classList.remove('open');
  }

  togglePause() {
    const pauseModal = document.getElementById('pauseModal');
    const pauseBtn = document.getElementById('pauseBtn');
    
    if (!this.isPaused) {
      this.isPaused = true;
      this.lastPauseStart = Date.now();
      
      if (pauseModal) {
        pauseModal.style.display = 'flex';
      }
      if (pauseBtn) {
        pauseBtn.innerHTML = '▶';
        pauseBtn.title = 'Resume Test';
      }
    } else {
      this.isPaused = false;
      if (this.lastPauseStart) {
        const pauseDiff = Date.now() - this.lastPauseStart;
        this.pauseDuration += pauseDiff;
        this.endTime += pauseDiff; // Adjust total exam endTime
      }
      
      if (pauseModal) {
        pauseModal.style.display = 'none';
      }
      if (pauseBtn) {
        pauseBtn.innerHTML = '⏸';
        pauseBtn.title = 'Pause Test';
      }
    }
  }

  // legacy compatibility triggers
  togglePanel() {
    if (this.els.panel) this.els.panel.classList.toggle('open');
  }

  closePanel() {
    if (this.els.panel) this.els.panel.classList.remove('open');
  }

  // print methods (for SSC and analytics review)
  updatePrintButton() {
    const printBtn = document.getElementById('printBtn');
    if (printBtn) {
      printBtn.style.display = this.isSubmitted ? 'inline-flex' : 'none';
    }
  }

  printTest() {
    const printWindow = window.open('', '_blank');
    const questionsHtml = this.questions.map((q, i) => {
      const userAns = this.answers[i];
      const correctAns = q.correct_option_id;
      const isCorrect = userAns !== null && correctAns !== undefined && userAns === correctAns;
      const timeSpent = Math.round(this.timeSpent[i]);
      const wasReviewed = this.markedForReview[i];
      const sectionName = this.sections ? this.getSectionNameForQuestion(i) : '';
      
      return `
        <div style="page-break-inside:avoid;margin-bottom:30px;border-bottom:1px solid #eee;padding-bottom:20px">
          <h3>Question ${i + 1} ${wasReviewed ? '<span style="color:#F59E0B">(Marked for Review)</span>' : ''}</h3>
          ${sectionName ? `<div style="font-size:14px;color:#6B7280;margin-bottom:8px">Section: ${sectionName}</div>` : ''}
          ${q.comp ? `<div>${q.comp}</div>` : ''}
          <div>${q.question}</div>
          <div style="margin-top:15px">
            ${q.options.map((opt, j) => `
              <div style="margin:5px 0;padding:5px;border-left:3px solid ${ 
                j === correctAns ? '#10B981' : 
                j === userAns ? '#EF4444' : '#E5E7EB' 
              }">
                ${opt}
              </div>
            `).join('')}
          </div>
          <div style="margin-top:15px;font-size:14px;color:#666">
            <strong>Your answer:</strong> ${userAns !== null ? String.fromCharCode(65 + userAns) : 'Not attempted'}
            ${userAns !== null && correctAns !== undefined ? 
              `(<span style="color:${isCorrect ? '#10B981' : '#EF4444'}">${isCorrect ? 'Correct' : 'Incorrect'}</span>)` : ''}
            <br>
            <strong>Time spent:</strong> ${timeSpent} seconds
          </div>
          ${q.solution ? `
            <div style="margin-top:15px;background:#f0fdf4;padding:15px;border-radius:8px">
              <h4 style="color:#10B981;margin-top:0">Solution</h4>
              ${q.solution}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${document.title} - Analysis</title>
        <style>
          body { font-family: sans-serif; padding: 20px; color: #333; }
          h2 { color: #4F46E5; }
        </style>
      </head>
      <body>
        <h2>CBT Exam - Performance Analysis</h2>
        <div style="margin-bottom:30px">
          <div><strong>Score:</strong> ${this.els.resultScore ? this.els.resultScore.textContent : ''}</div>
          <div><strong>Correct:</strong> ${this.calculateResults().correct}</div>
          <div><strong>Incorrect:</strong> ${this.calculateResults().incorrect}</div>
          <div><strong>Unattempted:</strong> ${this.calculateResults().unattempted}</div>
        </div>
        ${questionsHtml}
        <script>
          setTimeout(() => { window.print(); }, 500);
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  getSectionNameForQuestion(qIdx) {
    if (!this.sections) return '';
    for (const sec of this.sections) {
      if (qIdx >= sec.start && qIdx <= sec.end) return sec.name;
    }
    return '';
  }

  // Sync getter/setters for legacy class code runners
  syncLegacyProperties() {
    Object.defineProperties(this, {
      'curQ': {
        get: () => this.currentQuestion,
        set: (v) => { this.currentQuestion = v; }
      },
      'ans': {
        get: () => this.answers,
        set: (v) => { this.answers = v; }
      },
      'reviewed': {
        get: () => this.markedForReview,
        set: (v) => { this.markedForReview = v; }
      },
      'sub': {
        get: () => this.isSubmitted,
        set: (v) => { this.isSubmitted = v; }
      },
      'qs': {
        get: () => this.questions,
        set: (v) => { this.questions = v; }
      },
      'startT': {
        get: () => this.startTime,
        set: (v) => { this.startTime = v; }
      },
      'lastQTime': {
        get: () => this.lastQuestionTime,
        set: (v) => { this.lastQuestionTime = v; }
      },
      'currentSection': {
        get: () => this.currentSectionIdx,
        set: (v) => { this.currentSectionIdx = v; }
      }
    });
  }

  // legacy wrapper calls
  loadQ(idx) { this.loadQuestion(idx); }
  goToQ(idx) { this.goToQuestion(idx); }
  selectOptionLegacy(optIdx, qIdx) { this.selectOption(optIdx, qIdx); }
  confirmSub() { this.confirmSubmit(); }
  submitCurrentSection() { this.submitSection(); }
  subTest() { this.submitTest(); }
  calcResults() { return this.calculateResults(); }
  showResultsLegacy(r) { this.showResults(r); }
  closeModal() { this.closeResultModal(); }
  review() { this.reviewAnswers(); }
  updateGrid() { this.updateNavigator(); }
  stopTimers() {
    clearInterval(this.mainTimer);
    clearInterval(this.sectionTimer);
  }
}

// Register globally under all used class namespaces
window.CBTExamEngine = CBTExamEngine;
window.CBTExamApp = CBTExamEngine;
window.CBTExam = CBTExamEngine;
window.TestApp = CBTExamEngine;
