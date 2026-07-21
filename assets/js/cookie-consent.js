(() => {
  'use strict';

  const COOKIE_NAME = 'sitom_cookie_consent';
  const CONSENT_VERSION = '1.0';
  const MAX_AGE = 60 * 60 * 24 * 180;
  const POLICY_URL = '/cookie-policy.html';
  const CATEGORIES = ['preferences', 'analytics', 'marketing'];
  let overlay;
  let dialog;
  let currentView = 'main';
  let lastFocused = null;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied',
    ad_personalization: 'denied', functionality_storage: 'denied',
    personalization_storage: 'denied', security_storage: 'granted', wait_for_update: 500
  });

  const readCookie = () => document.cookie.split('; ').find(row => row.startsWith(`${COOKIE_NAME}=`))?.split('=').slice(1).join('=');
  const validConsent = value => value && value.version === CONSENT_VERSION && value.necessary === true &&
    CATEGORIES.every(category => typeof value[category] === 'boolean') &&
    ['accept_all', 'reject_all', 'custom'].includes(value.method) && !Number.isNaN(Date.parse(value.timestamp));

  const getConsent = () => {
    try {
      const raw = readCookie();
      if (!raw) return null;
      const consent = JSON.parse(decodeURIComponent(raw));
      return validConsent(consent) ? consent : null;
    } catch (_) { return null; }
  };

  const deleteNonNecessaryCookies = () => {
    const knownNonNecessary = [/^_ga/, /^_gid$/, /^_gat/, /^_gcl_/, /^_fbp$/, /^_hj/, /^hubspot/, /^_tt_/];
    document.cookie.split(';').forEach(item => {
      const name = item.split('=')[0].trim();
      if (knownNonNecessary.some(pattern => pattern.test(name))) {
        document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
        document.cookie = `${name}=; Max-Age=0; Path=/; domain=${location.hostname}; SameSite=Lax`;
      }
    });
  };

  const updateGoogleConsent = consent => window.gtag('consent', 'update', {
    analytics_storage: consent.analytics ? 'granted' : 'denied',
    ad_storage: consent.marketing ? 'granted' : 'denied',
    ad_user_data: consent.marketing ? 'granted' : 'denied',
    ad_personalization: consent.marketing ? 'granted' : 'denied',
    functionality_storage: consent.preferences ? 'granted' : 'denied',
    personalization_storage: consent.preferences ? 'granted' : 'denied',
    security_storage: 'granted'
  });

  const activateScripts = consent => {
    CATEGORIES.forEach(category => {
      if (!consent[category]) return;
      document.querySelectorAll(`script[type="text/plain"][data-cookie-category="${category}"]:not([data-cookie-activated])`).forEach(source => {
        const script = document.createElement('script');
        [...source.attributes].forEach(attribute => {
          if (!['type', 'data-cookie-category', 'data-src'].includes(attribute.name)) script.setAttribute(attribute.name, attribute.value);
        });
        if (source.dataset.src) script.src = source.dataset.src;
        else script.textContent = source.textContent;
        source.dataset.cookieActivated = 'true';
        source.after(script);
      });
    });
  };

  const applyConsent = consent => {
    updateGoogleConsent(consent);
    activateScripts(consent);
    if (!consent.preferences || !consent.analytics || !consent.marketing) deleteNonNecessaryCookies();
    window.dispatchEvent(new CustomEvent('cookieConsentUpdated', { detail: consent }));
  };

  const saveConsent = (settings, method) => {
    const previous = getConsent();
    const consent = { version: CONSENT_VERSION, necessary: true, ...settings, timestamp: new Date().toISOString(), method };
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(consent))}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax${secure}`;
    applyConsent(consent);
    close(true);
    const revokedActiveCategory = previous && CATEGORIES.some(category => previous[category] && !consent[category]);
    if (revokedActiveCategory) window.location.reload();
    return consent;
  };

  const mainMarkup = () => `
    <button class="cc-close" type="button" data-cc-action="reject" aria-label="Chiudi e rifiuta i cookie non necessari">×</button>
    <p class="cc-eyebrow">Cookie</p><h2 class="cc-title" id="cc-title" tabindex="-1">Preferenze privacy</h2>
    <p class="cc-description" id="cc-description">Usiamo cookie tecnici necessari e, solo con consenso, eventuali cookie di preferenza, statistici e marketing. <a class="cc-policy" href="${POLICY_URL}">Cookie Policy</a>.</p>
    <p class="cc-note">Chiudendo il banner con la X continuerai la navigazione utilizzando esclusivamente i cookie necessari.</p>
    <div class="cc-actions"><button class="cc-button cc-button-equal" type="button" data-cc-action="reject">Rifiuta non necessari</button><button class="cc-button cc-button-secondary" type="button" data-cc-action="customize">Personalizza</button><button class="cc-button cc-button-equal" type="button" data-cc-action="accept">Accetta tutti</button></div>`;

  const preferencesMarkup = consent => `
    <button class="cc-back" type="button" data-cc-action="back">← Torna indietro</button><h2 class="cc-title" id="cc-title" tabindex="-1">Personalizza le tue scelte</h2>
    <p class="cc-description" id="cc-description">Scegli quali categorie autorizzare. I cookie necessari sono sempre attivi. <a class="cc-policy" href="${POLICY_URL}">Cookie Policy</a>.</p>
    <div class="cc-category-list">
      ${categoryMarkup('necessary','Necessari','Necessari per il funzionamento e la sicurezza del sito.',true,true)}
      ${categoryMarkup('preferences','Preferenze','Consentono di ricordare alcune preferenze dell’utente.',consent?.preferences,false)}
      ${categoryMarkup('analytics','Statistici','Ci aiutano a comprendere come viene utilizzato il sito.',consent?.analytics,false)}
      ${categoryMarkup('marketing','Marketing','Utilizzati per contenuti personalizzati, pubblicità e tracciamento.',consent?.marketing,false)}
    </div>
    <div class="cc-actions"><button class="cc-button cc-button-equal" type="button" data-cc-action="reject">Rifiuta non necessari</button><button class="cc-button cc-button-secondary" type="button" data-cc-action="save">Salva preferenze</button><button class="cc-button cc-button-equal" type="button" data-cc-action="accept">Accetta tutti</button></div>`;

  const categoryMarkup = (id, title, description, checked, disabled) => `<div class="cc-category"><div><h3>${title}</h3><p>${description}</p></div><label class="cc-switch"><input type="checkbox" data-cc-category="${id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} aria-label="${title}"><span class="cc-slider" aria-hidden="true"></span></label></div>`;

  const render = view => {
    currentView = view;
    dialog.innerHTML = view === 'main' ? mainMarkup() : preferencesMarkup(getConsent());
    dialog.querySelector('#cc-title')?.focus();
  };

  const open = (view = 'main') => {
    lastFocused = document.activeElement;
    if (!overlay) createDialog();
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('cc-visible'));
    render(view);
  };

  const close = restoreFocus => {
    if (!overlay) return;
    overlay.classList.remove('cc-visible');
    overlay.hidden = true;
    if (restoreFocus && lastFocused instanceof HTMLElement) lastFocused.focus();
  };

  const trapFocus = event => {
    if (event.key === 'Escape' && currentView === 'main') { event.preventDefault(); rejectAll(); return; }
    if (event.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll('a,button,input:not([disabled])')].filter(element => !element.hidden);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const rejectAll = () => saveConsent({ preferences:false, analytics:false, marketing:false }, 'reject_all');
  const acceptAll = () => saveConsent({ preferences:true, analytics:true, marketing:true }, 'accept_all');

  const createDialog = () => {
    overlay = document.createElement('div');
    overlay.className = 'cc-overlay'; overlay.hidden = true;
    dialog = document.createElement('section');
    dialog.className = 'cc-dialog'; dialog.setAttribute('role','dialog'); dialog.setAttribute('aria-modal','true');
    dialog.setAttribute('aria-labelledby','cc-title'); dialog.setAttribute('aria-describedby','cc-description');
    overlay.append(dialog); document.body.append(overlay);
    dialog.addEventListener('keydown', trapFocus);
    dialog.addEventListener('click', event => {
      const action = event.target.closest('[data-cc-action]')?.dataset.ccAction;
      if (action === 'reject') rejectAll();
      if (action === 'accept') acceptAll();
      if (action === 'customize') render('preferences');
      if (action === 'back') render('main');
      if (action === 'save') {
        const setting = category => Boolean(dialog.querySelector(`[data-cc-category="${category}"]`)?.checked);
        saveConsent({ preferences:setting('preferences'), analytics:setting('analytics'), marketing:setting('marketing') }, 'custom');
      }
    });
  };

  document.addEventListener('click', event => { if (event.target.closest('[data-cookie-consent-open]')) open('preferences'); });
  const existing = getConsent();
  if (existing) applyConsent(existing); else document.addEventListener('DOMContentLoaded', () => open('main'), { once:true });

  window.CookieConsent = {
    open: () => open('preferences'), getConsent, hasConsent: category => category === 'necessary' || Boolean(getConsent()?.[category]),
    acceptAll, rejectAll,
    reset: () => { document.cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`; deleteNonNecessaryCookies(); open('main'); }
  };
})();
