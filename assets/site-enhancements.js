(() => {
  'use strict';

  document.documentElement.classList.add('motion-ready');

  const phone = '393475930035';
  const value = id => document.getElementById(id)?.value.trim() || '';
  const openWhatsApp = lines => window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');

  const mobileButton = document.getElementById('ham');
  const mobileMenu = document.getElementById('mobileMenu');
  if (mobileButton && mobileMenu) {
    mobileButton.setAttribute('aria-expanded', 'false');
    mobileButton.setAttribute('aria-controls', 'mobileMenu');
    mobileButton.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.toggle('open');
      mobileButton.setAttribute('aria-expanded', String(isOpen));
    });
    mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      mobileButton.setAttribute('aria-expanded', 'false');
    }));
  }

  const contactForm = document.getElementById('contactForm');
  contactForm?.addEventListener('submit', event => {
    event.preventDefault();
    if (!contactForm.reportValidity()) return;
    const name = `${value('c-nome')} ${value('c-cognome')}`.trim();
    openWhatsApp([
      'Ciao Sitom Edilizia, vorrei richiedere un preventivo.', '',
      `Nome: ${name}`,
      `Email: ${value('c-email')}`,
      `Telefono: ${value('c-tel') || 'Non indicato'}`,
      `Tipo di lavoro: ${value('c-tipo') || 'Da definire'}`,
      `Progetto: ${value('c-msg') || 'Da approfondire'}`, '',
      'Ho preso visione della Privacy Policy e autorizzo il trattamento dei dati per essere ricontattato.'
    ]);
  });

  const careerForm = document.getElementById('careerForm');
  careerForm?.addEventListener('submit', event => {
    event.preventDefault();
    if (!careerForm.reportValidity()) return;
    const name = `${value('cv-nome')} ${value('cv-cognome')}`.trim();
    openWhatsApp([
      'Ciao Sitom Edilizia, vorrei candidarmi per collaborare con voi.', '',
      `Nome: ${name}`,
      `Telefono: ${value('cv-tel')}`,
      `Email: ${value('cv-email') || 'Non indicata'}`,
      `Mansione: ${value('cv-ruolo') || 'Da definire'}`,
      `Presentazione: ${value('cv-msg') || 'Nessuna nota'}`, '',
      'Ho preso visione della Privacy Policy e autorizzo il trattamento dei dati per la candidatura.'
    ]);
  });

  const lightbox = document.getElementById('workLightbox');
  document.querySelectorAll('.work-open').forEach(button => button.addEventListener('click', () => {
    const source = button.querySelector('img');
    const target = lightbox?.querySelector('img');
    if (!source || !target || !lightbox) return;
    target.src = source.src;
    target.alt = source.alt;
    lightbox.showModal();
  }));
  lightbox?.querySelector('.lightbox-close')?.addEventListener('click', () => lightbox.close());
  lightbox?.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
  lightbox?.addEventListener('keydown', event => { if (event.key === 'Escape') lightbox.close(); });

  const assistantSteps = [
    {
      key: 'intervento',
      title: 'Che intervento ti serve?',
      options: ['Ristrutturazione completa', 'Bagno', 'Cucina', 'Tinteggiatura', 'Cartongesso', 'Esterni', 'Altro']
    },
    {
      key: 'comune',
      title: 'In quale comune o zona?',
      free: true,
      placeholder: 'Es. Roma, Guidonia, Frascati...'
    },
    {
      key: 'immobile',
      title: 'Tipologia immobile',
      options: ['Appartamento', 'Villa', 'Negozio', 'Ufficio', 'Condominio']
    },
    {
      key: 'dimensione',
      title: 'Dimensione indicativa',
      options: ['<50 mq', '50-100 mq', '100-200 mq', '200 mq+']
    },
    {
      key: 'tempistiche',
      title: 'Tempistiche',
      options: ['Subito', 'Entro un mese', 'Entro tre mesi', 'Solo informazioni']
    },
    {
      key: 'note',
      title: 'Note aggiuntive',
      free: true,
      textarea: true,
      placeholder: 'Raccontaci vincoli, priorità, stato dell’immobile o dettagli utili.'
    },
    {
      key: 'riepilogo',
      title: 'Riepilogo richiesta'
    }
  ];

  const state = {};
  let currentStep = 0;
  let assistantPanel;
  let lastAssistantFocus;

  const ensureAssistant = () => {
    if (assistantPanel) return assistantPanel;
    assistantPanel = document.createElement('section');
    assistantPanel.className = 'wa-assistant-panel';
    assistantPanel.setAttribute('role', 'dialog');
    assistantPanel.setAttribute('aria-modal', 'true');
    assistantPanel.setAttribute('aria-labelledby', 'wa-assistant-title');
    assistantPanel.innerHTML = `
      <div class="wa-head">
        <div>
          <p class="wa-kicker">Preventivo guidato</p>
          <h2 id="wa-assistant-title">Parla con Sitom</h2>
          <p>Rispondi in meno di un minuto: prepariamo un messaggio WhatsApp ordinato per il tuo sopralluogo.</p>
        </div>
        <button class="wa-close" type="button" aria-label="Chiudi assistente">×</button>
      </div>
      <div class="wa-body"></div>
      <div class="wa-foot">
        <button class="wa-back" type="button">Indietro</button>
        <button class="wa-next" type="button">Avanti</button>
      </div>`;
    document.body.append(assistantPanel);
    assistantPanel.querySelector('.wa-close').addEventListener('click', closeAssistant);
    assistantPanel.querySelector('.wa-back').addEventListener('click', () => {
      if (currentStep > 0) {
        currentStep -= 1;
        renderAssistant();
      }
    });
    assistantPanel.querySelector('.wa-next').addEventListener('click', () => {
      if (!saveFreeField()) return;
      if (currentStep < assistantSteps.length - 1) {
        currentStep += 1;
        renderAssistant();
        return;
      }
      sendAssistantMessage();
    });
    assistantPanel.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeAssistant();
    });
    return assistantPanel;
  };

  const saveFreeField = () => {
    const step = assistantSteps[currentStep];
    if (!step.free) return true;
    const field = assistantPanel.querySelector('[data-wa-free]');
    const text = field?.value.trim() || '';
    if (step.key === 'comune' && !text) {
      field?.focus();
      return false;
    }
    state[step.key] = text || 'Non indicato';
    return true;
  };

  const renderAssistant = () => {
    const panel = ensureAssistant();
    const body = panel.querySelector('.wa-body');
    const next = panel.querySelector('.wa-next');
    const back = panel.querySelector('.wa-back');
    const step = assistantSteps[currentStep];
    const progress = ((currentStep + 1) / assistantSteps.length) * 100;

    back.disabled = currentStep === 0;
    next.textContent = currentStep === assistantSteps.length - 1 ? 'Apri WhatsApp' : 'Avanti';
    next.disabled = false;

    let content = `<div class="wa-progress" aria-hidden="true"><span style="--wa-progress:${progress}%"></span></div><p class="wa-question">${step.title}</p>`;

    if (step.options) {
      content += `<div class="wa-options">${step.options.map(option => `<button class="wa-option${state[step.key] === option ? ' is-selected' : ''}" type="button" data-wa-value="${option}">${option}</button>`).join('')}</div>`;
    } else if (step.free) {
      const tag = step.textarea ? 'textarea' : 'input';
      const value = state[step.key] && state[step.key] !== 'Non indicato' ? state[step.key] : '';
      content += step.textarea
        ? `<textarea class="wa-note" data-wa-free placeholder="${step.placeholder || ''}">${value}</textarea>`
        : `<input class="wa-note" data-wa-free type="text" value="${value}" placeholder="${step.placeholder || ''}"/>`;
    } else {
      content += `<div class="wa-summary">
        <span><strong>Intervento:</strong> ${state.intervento || 'Da definire'}</span>
        <span><strong>Comune/Zona:</strong> ${state.comune || 'Da indicare'}</span>
        <span><strong>Immobile:</strong> ${state.immobile || 'Da definire'}</span>
        <span><strong>Dimensione:</strong> ${state.dimensione || 'Da definire'}</span>
        <span><strong>Tempistiche:</strong> ${state.tempistiche || 'Da definire'}</span>
        <span><strong>Note:</strong> ${state.note || 'Nessuna nota aggiuntiva'}</span>
      </div>`;
    }

    body.innerHTML = content;
    body.querySelectorAll('.wa-option').forEach(option => option.addEventListener('click', () => {
      state[step.key] = option.dataset.waValue;
      currentStep += 1;
      renderAssistant();
    }));
    body.querySelector('[data-wa-free]')?.focus();
  };

  const openAssistant = () => {
    lastAssistantFocus = document.activeElement;
    ensureAssistant();
    assistantPanel.classList.add('is-open');
    renderAssistant();
    assistantPanel.querySelector('.wa-close')?.focus();
  };

  const closeAssistant = () => {
    assistantPanel?.classList.remove('is-open');
    if (lastAssistantFocus instanceof HTMLElement) lastAssistantFocus.focus();
  };

  const sendAssistantMessage = () => {
    openWhatsApp([
      'Ciao Sitom Edilizia, vorrei raccontarvi il lavoro e ricevere un primo orientamento.', '',
      `Tipologia intervento: ${state.intervento || 'Da definire'}`,
      `Comune/Zona: ${state.comune || 'Da indicare'}`,
      `Tipologia immobile: ${state.immobile || 'Da definire'}`,
      `Dimensione: ${state.dimensione || 'Da definire'}`,
      `Tempistiche: ${state.tempistiche || 'Da definire'}`,
      `Note aggiuntive: ${state.note || 'Nessuna nota'}`, '',
      'Grazie, resto in attesa di un primo orientamento.'
    ]);
    closeAssistant();
  };

  document.addEventListener('click', event => {
    if (event.target.closest('[data-wa-assistant-open]')) {
      event.preventDefault();
      openAssistant();
    }
  });

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealItems = document.querySelectorAll('.hero-brand-mark,.hero-eyebrow,.hero-title,.hero-sub,.hero-actions,.trust-item,.about-strip>*,.section-bridge-inner,.serv-mini-card,.servizio-row,.zone>*,.work-gallery-head,.work-card,.info-card,.contact-form,.cv-form,.cta-strip>*');
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    revealItems.forEach((item, index) => {
      item.style.transitionDelay = `${Math.min(index % 6, 5) * 45}ms`;
      revealObserver.observe(item);
    });
  } else {
    revealItems.forEach(item => item.classList.add('is-visible'));
  }

  const parallaxImages = document.querySelectorAll('.hero-img,.content-photo,.servizio-visual img');
  if (!reduceMotion && parallaxImages.length) {
    let ticking = false;
    const moveImages = () => {
      const viewport = window.innerHeight || 1;
      parallaxImages.forEach(img => {
        const rect = img.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > viewport) return;
        const progress = (rect.top + rect.height / 2 - viewport / 2) / viewport;
        img.style.transform = `translateY(${progress * -10}px) scale(1.018)`;
      });
      ticking = false;
    };
    const requestMove = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(moveImages);
    };
    moveImages();
    window.addEventListener('scroll', requestMove, { passive: true });
    window.addEventListener('resize', requestMove);
  }
})();
