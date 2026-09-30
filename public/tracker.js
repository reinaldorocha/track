;(function() {
  'use strict';
  
  function getParam(name) {
    var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
  }

  // Obter configurações a partir dos atributos da tag script, meta tags ou variáveis globais
  var script = (typeof document !== 'undefined' && document.currentScript) || (function() {
    if (typeof document === 'undefined' || !document.getElementsByTagName) return null;
    var scripts = document.getElementsByTagName('script');
    return scripts && scripts.length > 0 ? scripts[scripts.length - 1] : null;
  })();

  var metaPixelTag = typeof document !== 'undefined' && document.querySelector ? document.querySelector('meta[name="utmtrack-pixel"], meta[name="meta-pixel-id"]') : null;
  var platformTag = typeof document !== 'undefined' && document.querySelector ? document.querySelector('meta[name="utmtrack-platform"], meta[name="platform"], meta[name="gateway"]') : null;
  
  var config = {
    apiUrl: (script && script.getAttribute('data-api-url')) || '',
    workspaceId: (script && script.getAttribute('data-workspace-id')) || '',
    pixelId: (script && (script.getAttribute('data-pixel-id') || script.getAttribute('data-pixel'))) ||
             (metaPixelTag && metaPixelTag.getAttribute('content')) ||
             (typeof window !== 'undefined' && (window.UTM_TRACK_PIXEL_ID || window.UTM_PIXEL_ID)) ||
             getParam('pixel_id') ||
             getParam('pixelId') ||
             '',
    platform: (script && (script.getAttribute('data-platform') || script.getAttribute('data-gateway'))) ||
              (platformTag && platformTag.getAttribute('content')) ||
              (typeof window !== 'undefined' && (window.UTM_TRACK_PLATFORM || window.UTM_PLATFORM)) ||
              ''
  };
  
  if (!config.apiUrl || !config.workspaceId) return;
  
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    if (match) return match[2];
    return null;
  }
  
  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + 24*60*60*1000*days);
    document.cookie = name + '=' + value + ';path=/;expires=' + d.toUTCString();
  }
  
  function getOrCreateId(key, persistent) {
    var val = null;
    try {
      if (persistent) {
        val = localStorage.getItem(key);
        if (!val) {
          val = Date.now().toString(36) + Math.random().toString(36).substr(2);
          localStorage.setItem(key, val);
        }
      } else {
        val = sessionStorage.getItem(key);
        if (!val) {
          val = Date.now().toString(36) + Math.random().toString(36).substr(2);
          sessionStorage.setItem(key, val);
        }
      }
    } catch(e) {}
    return val;
  }
  
  // 1. Extração de Parâmetros UTM e Identificadores Meta Ads
  var utms = {
    source: getParam('utm_source') || getParam('src'),
    medium: getParam('utm_medium'),
    campaign: getParam('utm_campaign') || getParam('sck'),
    content: getParam('utm_content'),
    term: getParam('utm_term')
  };
  
  var fbclid = getParam('fbclid');
  var fbp = getCookie('_fbp') || ('fb.1.' + Date.now() + '.' + Math.floor(Math.random()*1e9));
  var fbc = fbclid ? ('fb.1.' + Date.now() + '.' + fbclid) : getCookie('_fbc');
  
  // Persistir cookies first-party por 90 dias
  if (!getCookie('_fbp')) setCookie('_fbp', fbp, 90);
  if (fbc && !getCookie('_fbc')) setCookie('_fbc', fbc, 90);
  
  var sessionId = getOrCreateId('_utmt_sid', false); // 30min session
  var visitorId = getOrCreateId('_utmt_vid', true);  // persistent localStorage
  
  // Persistir UTMs na navegação do site (sessionStorage)
  if (utms.campaign || utms.source) {
    try { sessionStorage.setItem('_utmt_utm', JSON.stringify(utms)); } catch(e) {}
  } else {
    try { 
      var stored = sessionStorage.getItem('_utmt_utm');
      if (stored) {
        var parsed = JSON.parse(stored);
        utms.source = utms.source || parsed.source;
        utms.medium = utms.medium || parsed.medium;
        utms.campaign = utms.campaign || parsed.campaign;
        utms.content = utms.content || parsed.content;
        utms.term = utms.term || parsed.term;
      }
    } catch(e) {}
  }
  
  function send(endpoint, data) {
    var url = config.apiUrl + endpoint;
    var body = JSON.stringify(data);
    if (typeof navigator !== 'undefined' && navigator.sendBeacon && typeof Blob !== 'undefined') {
      var blob = new Blob([body], {type:'application/json'});
      navigator.sendBeacon(url, blob);
    } else if (typeof fetch === 'function') {
      fetch(url, {method:'POST',body:body,headers:{'Content-Type':'application/json'},keepalive:true}).catch(function(){});
    }
  }
  
  // Gerador de ID único de evento para deduplicação entre Pixel (Browser) e CAPI (Server)
  function genEventId() {
    return 'evt_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
  }

  // Disparo sincronizado com Meta Pixel no Navegador (se instalado) com o MESMO event_id
  function fireBrowserPixel(eventName, customData, eventId, targetPixel) {
    try {
      if (typeof window.fbq === 'function') {
        var px = targetPixel || config.pixelId;
        if (px) {
          window.fbq('trackSingle', px, eventName, customData || {}, { eventID: eventId });
        } else {
          window.fbq('track', eventName, customData || {}, { eventID: eventId });
        }
      }
    } catch(e) {}
  }

  // =========================================================================
  // 2. DETECÇÃO E DECORAÇÃO INTELIGENTE DE LINKS DE CHECKOUT
  // =========================================================================
  var checkoutKeywords = [
    'hotmart.com', 'cakto.com.br', 'cacto.com.br', 'yampi.io', 'yampi.com.br',
    'shopify.com', 'myshopify.com', 'kiwify.com.br', 'eduzz.com', 'braip.com',
    'ticto.com.br', 'monetizze.com.br', 'perfectpay.com.br', 'kirvano.com',
    'cartpanda.com', 'greenn.com.br', 'doppler.com.br', 'appmax.com.br',
    'getfy.com', 'getfy.com.br', 'getfy.cloud',
    'profjonathanrocha.com.br',
    'pay.', 'checkout', 'seguro.', 'pagamento.', '/c/'
  ];

  // Suporte a domínios adicionais personalizados via atributo data-checkout-domains no <script>
  try {
    var customAttr = script && script.getAttribute('data-checkout-domains');
    if (customAttr) {
      var customParts = customAttr.split(',');
      for (var c = 0; c < customParts.length; c++) {
        var trimmed = customParts[c].trim().toLowerCase();
        if (trimmed && checkoutKeywords.indexOf(trimmed) === -1) {
          checkoutKeywords.push(trimmed);
        }
      }
    }
  } catch(e) {}

  function isCheckoutUrl(href) {
    if (!href) return false;
    var lower = href.toLowerCase();
    for (var i = 0; i < checkoutKeywords.length; i++) {
      if (lower.indexOf(checkoutKeywords[i]) !== -1) return true;
    }
    return false;
  }

  function detectCheckoutPlatform(urlStr) {
    if (!urlStr) return '';
    var lower = urlStr.toLowerCase();
    if (lower.indexOf('hotmart') !== -1) return 'hotmart';
    if (lower.indexOf('kiwify') !== -1) return 'kiwify';
    if (lower.indexOf('cakto') !== -1 || lower.indexOf('cacto') !== -1) return 'cakto';
    if (lower.indexOf('yampi') !== -1) return 'yampi';
    if (lower.indexOf('getfy') !== -1) return 'getfy';
    if (lower.indexOf('shopify') !== -1 || lower.indexOf('myshopify') !== -1) return 'shopify';
    if (lower.indexOf('eduzz') !== -1) return 'eduzz';
    if (lower.indexOf('braip') !== -1) return 'braip';
    return '';
  }

  // Decora uma URL de checkout anexando UTMs, src, sck, fbclid e sessionIds
  function decorateUrl(urlStr) {
    if (!urlStr || urlStr.indexOf('javascript:') === 0 || urlStr.indexOf('#') === 0) return urlStr;
    try {
      var base = window.location.href;
      var parsed = new URL(urlStr, base);

      // Preservar UTMs padrões caso o link ainda não possua
      if (utms.source && !parsed.searchParams.has('utm_source')) parsed.searchParams.set('utm_source', utms.source);
      if (utms.medium && !parsed.searchParams.has('utm_medium')) parsed.searchParams.set('utm_medium', utms.medium);
      if (utms.campaign && !parsed.searchParams.has('utm_campaign')) parsed.searchParams.set('utm_campaign', utms.campaign);
      if (utms.content && !parsed.searchParams.has('utm_content')) parsed.searchParams.set('utm_content', utms.content);
      if (utms.term && !parsed.searchParams.has('utm_term')) parsed.searchParams.set('utm_term', utms.term);

      // Parâmetros especiais Hotmart, Kiwify, Cakto, Eduzz
      var srcVal = utms.source || utms.campaign;
      var sckVal = utms.campaign || utms.source;
      if (srcVal && !parsed.searchParams.has('src')) parsed.searchParams.set('src', srcVal);
      if (sckVal && !parsed.searchParams.has('sck')) parsed.searchParams.set('sck', sckVal);

      // Identificadores Meta Ads
      if (fbclid && !parsed.searchParams.has('fbclid')) parsed.searchParams.set('fbclid', fbclid);
      if (fbp && !parsed.searchParams.has('fbp')) parsed.searchParams.set('fbp', fbp);
      if (fbc && !parsed.searchParams.has('fbc')) parsed.searchParams.set('fbc', fbc);

      // Identificador de Sessão do UTM-Track para correlação direta
      if (sessionId && !parsed.searchParams.has('_utmt_sid')) parsed.searchParams.set('_utmt_sid', sessionId);
      if (visitorId && !parsed.searchParams.has('_utmt_vid')) parsed.searchParams.set('_utmt_vid', visitorId);

      // Persistir plataforma de checkout detectada para deduplicação no obrigado
      var detectedCheckoutPlat = detectCheckoutPlatform(urlStr);
      if (detectedCheckoutPlat) {
        try {
          if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('_utmt_platform', detectedCheckoutPlat);
          setCookie('_utmt_plat', detectedCheckoutPlat, 7);
        } catch(e) {}
      }

      return parsed.toString();
    } catch(e) {
      return urlStr;
    }
  }

  // Varre o DOM para decorar links, formulários e iframes de checkout
  function decorateAllLinks() {
    try {
      // 1. Links <a>
      var links = document.querySelectorAll('a[href]');
      for (var i = 0; i < links.length; i++) {
        var a = links[i];
        var href = a.getAttribute('href');
        if (href && isCheckoutUrl(href) && href.indexOf('_utmt_sid=') === -1) {
          a.href = decorateUrl(href);
        }
      }

      // 2. Formulários <form>
      var forms = document.querySelectorAll('form[action]');
      for (var j = 0; j < forms.length; j++) {
        var form = forms[j];
        var action = form.getAttribute('action');
        if (action && isCheckoutUrl(action) && action.indexOf('_utmt_sid=') === -1) {
          form.action = decorateUrl(action);
        }
      }

      // 3. iFrames de checkout embutido
      var iframes = document.querySelectorAll('iframe[src]');
      for (var k = 0; k < iframes.length; k++) {
        var iframe = iframes[k];
        var src = iframe.getAttribute('src');
        if (src && isCheckoutUrl(src) && src.indexOf('_utmt_sid=') === -1) {
          iframe.src = decorateUrl(src);
        }
      }
    } catch(e) {}
  }

  function startLinkObserver() {
    decorateAllLinks();
    if (typeof MutationObserver !== 'undefined' && document.body) {
      var observer = new MutationObserver(function() {
        decorateAllLinks();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startLinkObserver);
  } else {
    startLinkObserver();
  }
  window.addEventListener('load', decorateAllLinks);

  // =========================================================================
  // 3. INICIALIZAÇÃO DE SESSÃO E DISPARO DE EVENTOS
  // =========================================================================
  
  // Registrar Sessão no Backend
  send('/api/tracking/session', {
    sessionId: sessionId,
    visitorId: visitorId,
    workspaceId: config.workspaceId,
    utmSource: utms.source,
    utmMedium: utms.medium,
    utmCampaign: utms.campaign,
    utmContent: utms.content,
    utmTerm: utms.term,
    fbclid: fbclid,
    fbp: fbp,
    fbc: fbc || null,
    landingPage: location.href,
    referrer: document.referrer,
    userAgent: navigator.userAgent
  });
  
  // Disparar PageView (Sincronizado entre Navegador e Servidor com o mesmo eventId)
  var pageViewEventId = genEventId();
  fireBrowserPixel('PageView', {}, pageViewEventId);
  send('/api/tracking/event', {
    sessionId: sessionId,
    workspaceId: config.workspaceId,
    pixelId: config.pixelId || undefined,
    eventName: 'PageView',
    eventId: pageViewEventId,
    sourceUrl: location.href
  });

  // Interceptar cliques em links/botões de checkout para decorar em tempo real e disparar InitiateCheckout
  document.addEventListener('click', function(e) {
    var target = e.target;
    while (target && target.tagName !== 'A' && target.tagName !== 'BUTTON') {
      target = target.parentElement;
    }
    if (!target) return;

    var href = target.getAttribute('href') || target.getAttribute('data-href') || '';
    if (isCheckoutUrl(href)) {
      // Garantir decoração imediata antes da navegação
      var decorated = decorateUrl(href);
      if (target.tagName === 'A') {
        target.href = decorated;
      }

      var icEventId = genEventId();
      fireBrowserPixel('InitiateCheckout', { content_ids: [decorated] }, icEventId);

      send('/api/tracking/event', {
        sessionId: sessionId,
        workspaceId: config.workspaceId,
        pixelId: config.pixelId || undefined,
        eventName: 'InitiateCheckout',
        eventId: icEventId,
        sourceUrl: location.href,
        contentIds: JSON.stringify([decorated])
      });
    }
  }, true);
  
  function detectPlatform(orderId) {
    // 1. Configuração explícita via script data-platform, meta tag, ou window global
    if (config.platform) return config.platform.toLowerCase().trim();

    // 2. Parâmetro direto de URL
    var p = getParam('platform') || getParam('gateway') || getParam('origem') || getParam('provider');
    if (p) return p.toLowerCase().trim();

    // 3. Atributo direto na tag script (caso atualizado dinamicamente)
    if (script && script.getAttribute) {
      var dp = script.getAttribute('data-platform') || script.getAttribute('data-gateway');
      if (dp) return dp.toLowerCase().trim();
    }

    // 4. Elemento na página de obrigado (data-platform em elemento ou container)
    if (typeof document !== 'undefined' && document.querySelector) {
      var elem = document.querySelector('[data-platform], [data-gateway], [data-utm-platform]');
      if (elem) {
        var ep = elem.getAttribute('data-platform') || elem.getAttribute('data-gateway') || elem.getAttribute('data-utm-platform');
        if (ep) return ep.toLowerCase().trim();
      }
    }

    // 5. Fallback por sessionStorage ou cookie gravado no clique de checkout
    try {
      var storedPlat = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('_utmt_platform')) || getCookie('_utmt_plat');
      if (storedPlat) return storedPlat.toLowerCase().trim();
    } catch(e) {}

    // 6. Referrer
    var ref = (typeof document !== 'undefined' && document.referrer ? document.referrer : '').toLowerCase();
    if (ref.indexOf('hotmart') !== -1) return 'hotmart';
    if (ref.indexOf('kiwify') !== -1) return 'kiwify';
    if (ref.indexOf('cakto') !== -1 || ref.indexOf('cacto') !== -1) return 'cakto';
    if (ref.indexOf('yampi') !== -1) return 'yampi';
    if (ref.indexOf('getfy') !== -1) return 'getfy';
    if (ref.indexOf('shopify') !== -1 || ref.indexOf('myshopify') !== -1) return 'shopify';
    if (ref.indexOf('eduzz') !== -1) return 'eduzz';
    if (ref.indexOf('braip') !== -1) return 'braip';

    // 7. Padrões conhecidos de formato de Order ID / Tokens
    if (getParam('hottok') || (orderId && String(orderId).toUpperCase().indexOf('HP') === 0)) return 'hotmart';
    if (getParam('kiwify') || (orderId && String(orderId).indexOf('kw_') === 0)) return 'kiwify';
    if (getParam('cakto') || (orderId && String(orderId).indexOf('ck_') === 0)) return 'cakto';
    if (getParam('yampi')) return 'yampi';
    if (getParam('getfy')) return 'getfy';
    if (getParam('shopify')) return 'shopify';

    return '';
  }

  function buildPurchaseEventId(workspaceId, orderId, platform) {
    var cleanWs = String(workspaceId || '').trim() || 'default';
    var cleanPlat = (platform && String(platform).trim().toLowerCase()) || 'direct';
    var cleanOrder = String(orderId || '').trim();
    return 'purchase_' + cleanWs + '_' + cleanPlat + '_' + cleanOrder;
  }

  // 3. Detecção e Disparo Automático de Purchase em Páginas de Obrigado / Confirmação com deduplicação CAPI
  (function detectThankYouPage() {
    var path = location.pathname.toLowerCase();
    var isThankYou = path.indexOf('obrigad') !== -1 ||
                     path.indexOf('thank') !== -1 ||
                     path.indexOf('sucesso') !== -1 ||
                     path.indexOf('confirm') !== -1 ||
                     document.querySelector('[data-utm-purchase]') !== null;

    var orderId = getParam('order_id') || getParam('transaction') || getParam('order') || getParam('id');
    if (isThankYou && orderId) {
      var storageKey = '_utmt_purchased_' + orderId;
      try {
        if (!sessionStorage.getItem(storageKey)) {
          sessionStorage.setItem(storageKey, 'true');
          var val = parseFloat(getParam('value') || getParam('amount') || '0');
          var curr = getParam('currency') || 'BRL';
          var platform = detectPlatform(orderId);
          var purchaseEventId = buildPurchaseEventId(config.workspaceId, orderId, platform);

          fireBrowserPixel('Purchase', {
            value: val,
            currency: curr,
            order_id: orderId,
            content_type: 'product'
          }, purchaseEventId);

          send('/api/tracking/event', {
            sessionId: sessionId,
            workspaceId: config.workspaceId,
            pixelId: config.pixelId || undefined,
            eventName: 'Purchase',
            eventId: purchaseEventId,
            orderId: orderId,
            platform: platform || undefined,
            value: val,
            currency: curr,
            sourceUrl: location.href
          });
        }
      } catch(e) {}
    }
  })();

  // Public API para chamadas manuais (ex: window.utmTrack.track('Lead', { value: 10 }) ou trackPurchase)
  window.utmTrack = {
    track: function(eventName, data) {
      data = data || {};
      var customEventId = genEventId();
      var targetPixel = data.pixelId || config.pixelId || undefined;
      fireBrowserPixel(eventName, data, customEventId, targetPixel);
      send('/api/tracking/event', Object.assign({}, data, {
        sessionId: sessionId,
        workspaceId: config.workspaceId,
        pixelId: targetPixel,
        eventName: eventName,
        eventId: customEventId,
        sourceUrl: location.href
      }));
      return customEventId;
    },
    trackPurchase: function(data) {
      data = data || {};
      var orderId = data.orderId || data.order_id || data.transaction || getParam('order_id') || getParam('transaction') || getParam('order');
      var platform = data.platform || detectPlatform(orderId);
      var purchaseEventId = orderId ? buildPurchaseEventId(config.workspaceId, orderId, platform) : genEventId();
      var val = Number(data.value || data.amount || getParam('value') || 0);
      var curr = data.currency || getParam('currency') || 'BRL';
      var targetPixel = data.pixelId || config.pixelId || undefined;

      fireBrowserPixel('Purchase', {
        value: val,
        currency: curr,
        order_id: orderId || undefined,
        content_type: 'product'
      }, purchaseEventId, targetPixel);

      send('/api/tracking/event', {
        sessionId: sessionId,
        workspaceId: config.workspaceId,
        pixelId: targetPixel,
        eventName: 'Purchase',
        eventId: purchaseEventId,
        orderId: orderId || undefined,
        platform: platform || undefined,
        value: val,
        currency: curr,
        sourceUrl: location.href
      });
      return purchaseEventId;
    },
    buildPurchaseEventId: buildPurchaseEventId,
    detectPlatform: detectPlatform,
    decorateUrl: decorateUrl,
    sessionId: sessionId,
    visitorId: visitorId,
    pixelId: config.pixelId
  };
})();
