(function () {
  'use strict';

  const CONFIG = window.APP_CONFIG || {};
  const API_BASE_URL = ((CONFIG.apiBaseUrl || '').replace(/\/$/, '')) || `${window.location.origin}`;

  const STORAGE_KEYS = {
    token: 'acesso-livre.token',
    user: 'acesso-livre.user'
  };

  const ENDPOINTS = {
    login: '/auth/login',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
    register: '/users',
    place: '/places',
    placeFavorites: (id) => `/places/${id}/favorites`,
    placeReviews: (id) => `/places/${id}/reviews`,
    questionnaire: '/feedback',
    me: '/users/me'
  };

  const FEATURE_LABELS = {
    ramp_access: 'Rampa de acesso',
    elevator: 'Elevador',
    accessible_bathroom: 'Banheiro adaptado',
    reserved_parking: 'Vagas especiais',
    tactile_floor: 'Piso tatil',
    braille_signage: 'Sinalizacao em braile',
    audio_description: 'Audio descricao',
    libras_staff: 'Funcionarios treinados em Libras',
    subtitles: 'Legendas / Closed Caption',
    visual_signage: 'Sinalizacao visual',
    priority_service: 'Atendimento prioritario',
    wheelchair_available: 'Cadeira de rodas disponivel',
    accessible_parking: 'Estacionamento acessivel'
  };

  const FEATURE_BY_CHECKBOX = {
    rampaAcesso: 'ramp_access',
    elevador: 'elevator',
    banheiroAdaptado: 'accessible_bathroom',
    vagasEspeciais: 'reserved_parking',
    pisoTatil: 'tactile_floor',
    sinalizacaoBraile: 'braille_signage',
    audioDescricao: 'audio_description',
    libras: 'libras_staff',
    legenda: 'subtitles',
    sinalizacaoVisual: 'visual_signage',
    atendimentoPrioritario: 'priority_service',
    cadeiraRodas: 'wheelchair_available',
    estacionamento: 'accessible_parking'
  };

  const FEATURE_GROUP_FILTERS = {
    mobilidade: [
      'ramp_access',
      'elevator',
      'accessible_bathroom',
      'reserved_parking',
      'accessible_parking',
      'wheelchair_available'
    ],
    visual: ['tactile_floor', 'braille_signage', 'visual_signage'],
    auditiva: ['libras_staff', 'subtitles', 'audio_description'],
    intelectual: ['priority_service']
  };

  function getToken() {
    return window.localStorage.getItem(STORAGE_KEYS.token);
  }

  function getStoredUser() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.user);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn('[session] falha ao ler usuario armazenado', err);
      return null;
    }
  }

  function setSession(token, user) {
    if (token) {
      window.localStorage.setItem(STORAGE_KEYS.token, token);
    }
    if (user) {
      window.localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    }
  }

  function clearSession() {
    window.localStorage.removeItem(STORAGE_KEYS.token);
    window.localStorage.removeItem(STORAGE_KEYS.user);
  }

  function applySessionToNav(user) {
    const hasUser = Boolean(user && (user.name || user.email));
    document.querySelectorAll('[data-auth="guest"]').forEach((element) => {
      element.classList.toggle('d-none', hasUser);
    });
    document.querySelectorAll('[data-auth="auth"]').forEach((element) => {
      element.classList.toggle('d-none', !hasUser);
    });
    const nameTarget = document.getElementById('navbarUserName');
    if (nameTarget) {
      nameTarget.textContent = hasUser
        ? ([user.name, user.surname].filter(Boolean).join(' ') || user.email || '')
        : '';
    }
  }

  function bindLogoutHandlers() {
    document.querySelectorAll('[data-action="logout"]').forEach((link) => {
      if (link.dataset.boundLogout === 'true') return;
      link.dataset.boundLogout = 'true';
      link.addEventListener('click', (event) => {
        event.preventDefault();
        clearSession();
        applySessionToNav(null);
        window.location.href = 'index.html';
      });
    });
  }

  async function bootstrapSession() {
    bindLogoutHandlers();
    const token = getToken();
    let user = getStoredUser();
    applySessionToNav(user);

    if (!token) {
      return null;
    }

    if (!user) {
      try {
        user = await apiRequest(ENDPOINTS.me);
        setSession(token, user);
      } catch (err) {
        console.error('[session] erro ao atualizar usuario', err);
        clearSession();
        applySessionToNav(null);
        return null;
      }
    }

    applySessionToNav(user);
    return user;
  }

  async function apiRequest(path, options = {}) {
    const {
      method = 'GET',
      body,
      headers,
      skipAuth = false,
      ...fetchOptions
    } = options;

    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    const finalHeaders = new Headers(headers || {});
    const token = getToken();

    if (!skipAuth && token) {
      finalHeaders.set('Authorization', `Bearer ${token}`);
    }

    let finalBody = body;
    if (body && !(body instanceof FormData)) {
      if (typeof body === 'string') {
        finalBody = body;
        if (!finalHeaders.has('Content-Type')) {
          finalHeaders.set('Content-Type', 'application/json');
        }
      } else {
        finalBody = JSON.stringify(body);
        finalHeaders.set('Content-Type', 'application/json');
      }
    }

    const response = await fetch(url, {
      method,
      headers: finalHeaders,
      body: finalBody,
      ...fetchOptions
    });

    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (_) {
        data = text;
      }
    }

    if (!response.ok) {
      const message = (data && data.error) || `Requisicao falhou (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  function resolveMediaUrl(pathname) {
    if (!pathname) return '';
    if (/^https?:\/\//i.test(pathname) || pathname.startsWith('data:')) {
      return pathname;
    }
    const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
    return `${API_BASE_URL}${normalizedPath}`;
  }

  function showAlert(container, type, message) {
    if (!container) return;
    const el = document.createElement('div');
    el.className = `alert alert-${type}`;
    el.role = 'alert';
    el.setAttribute('aria-live', 'assertive');
    el.textContent = message;
    container.prepend(el);
    setTimeout(() => el.remove(), 5000);
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function markActiveNav() {
    const path = (window.location.pathname.split('/') || []).pop() || 'index.html';
    document.querySelectorAll('nav a.nav-link, nav .navbar-brand').forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) return;
      const isActive = href === path || (path === '' && href === 'index.html');
      if (isActive) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    });
  }

  function ensureMainIdAndSkipLink() {
    const main = document.querySelector('main');
    if (main && !main.id) {
      main.id = 'main-content';
    }
    if (!document.querySelector('.visually-hidden-focusable')) {
      const skip = document.createElement('a');
      skip.href = '#main-content';
      skip.className = 'visually-hidden-focusable';
      skip.textContent = 'Pular para conteudo';
      document.body.prepend(skip);
      skip.addEventListener('click', (event) => {
        event.preventDefault();
        const target = document.getElementById('main-content') || document.querySelector('main');
        if (target) {
          target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
          try {
            target.scrollIntoView({ behavior: 'instant', block: 'start' });
          } catch (_) {
            /* noop */
          }
          setTimeout(() => target.removeAttribute('tabindex'), 500);
        }
        if (history && history.replaceState) {
          history.replaceState(null, '', `${location.pathname}${location.search}`);
        }
      });
    }
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(date);
  }

  function renderStars(container, rating) {
    if (!container) return;
    container.innerHTML = '';
    const value = typeof rating === 'number' ? rating : Number(rating);
    const normalized = Number.isFinite(value) ? value : 0;
    for (let i = 1; i <= 5; i += 1) {
      const star = document.createElement('i');
      if (normalized >= i) {
        star.className = 'fas fa-star text-warning';
      } else if (normalized >= i - 0.5) {
        star.className = 'fas fa-star-half-alt text-warning';
      } else {
        star.className = 'far fa-star text-warning';
      }
      star.setAttribute('aria-hidden', 'true');
      container.appendChild(star);
    }
  }

  function renderFeatureBadges(container, features = [], options = {}) {
    if (!container) return;
    const { showEmpty = true, limit, flags = null } = options;
    container.innerHTML = '';

    let items = Array.isArray(features) ? features : [];
    if ((!items || !items.length) && flags && typeof flags === 'object') {
      items = Object.entries(flags)
        .filter(([, value]) => Boolean(value))
        .map(([key]) => ({ key, label: FEATURE_LABELS[key] || key }));
    }

    if (!items.length) {
      if (showEmpty) {
        const info = document.createElement('span');
        info.className = 'text-muted';
        info.textContent = 'Nenhum recurso cadastrado';
        container.appendChild(info);
      }
      return;
    }

    const list = Number.isFinite(limit) && limit > 0 ? items.slice(0, limit) : items;

    list.forEach((feature) => {
      const badge = document.createElement('span');
      badge.className = 'badge bg-success me-1 mb-1';
      badge.textContent = feature.label || FEATURE_LABELS[feature.key] || feature.key;
      container.appendChild(badge);
    });

    if (Number.isFinite(limit) && limit > 0 && features.length > items.length) {
      const extra = document.createElement('span');
      extra.className = 'badge bg-light text-dark border';
      extra.textContent = `+${features.length - items.length}`;
      container.appendChild(extra);
    }
  }

  function placeTypeLabel(type) {
    if (!type) return '';
    const normalized = String(type).toLowerCase();
    switch (normalized) {
      case 'restaurante': return 'Restaurante';
      case 'shopping': return 'Shopping Center';
      case 'parque': return 'Parque';
      case 'hotel': return 'Hotel';
      case 'cinema': return 'Cinema / Teatro';
      case 'supermercado': return 'Supermercado';
      case 'outro': return 'Outro';
      default:
        return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }
  }

  function truncateText(text, maxLength = 140) {
    if (!text) return '';
    const value = String(text).trim();
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength).trim()}...`;
  }
  function initLogin() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = document.getElementById('email')?.value.trim() || '';
      const senha = document.getElementById('senha')?.value || '';

      if (!email || !senha) {
        showAlert(form, 'warning', 'Informe email e senha.');
        return;
      }

      try {
        const data = await apiRequest(ENDPOINTS.login, {
          method: 'POST',
          body: { email, senha },
          skipAuth: true
        });
        if (data?.token) {
          setSession(data.token, data.user || null);
        }
        window.location.href = 'perfil.html';
      } catch (err) {
        console.error('[login] erro', err);
        const message = err.data?.error || 'Falha no login. Verifique suas credenciais.';
        showAlert(form, 'danger', message);
      }
    });
  }

  function updatePasswordStrength(input, bar) {
    if (!input || !bar) return;
    const val = input.value || '';
    let score = 0;
    if (val.length >= 8) score += 25;
    if (/[A-Z]/.test(val)) score += 25;
    if (/[0-9]/.test(val)) score += 25;
    if (/[^A-Za-z0-9]/.test(val)) score += 25;
    bar.style.width = `${score}%`;
    bar.style.backgroundColor = score < 50 ? '#dc3545' : score < 75 ? '#ffc107' : '#28a745';
  }

  function initRegister() {
    const form = document.getElementById('registerForm');
    if (!form) return;
    const senha = document.getElementById('senha');
    const confirmar = document.getElementById('confirmarSenha');
    const bar = document.getElementById('passwordStrengthBar');

    senha?.addEventListener('input', () => updatePasswordStrength(senha, bar));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const nome = document.getElementById('nome')?.value || '';
      const sobrenome = document.getElementById('sobrenome')?.value || '';
      const email = document.getElementById('email')?.value || '';
      const senhaVal = senha?.value || '';
      const confirmarVal = confirmar?.value || '';

      if (senhaVal !== confirmarVal) {
        showAlert(form, 'warning', 'As senhas nao conferem.');
        return;
      }

      try {
        await apiRequest(ENDPOINTS.register, {
          method: 'POST',
          body: {
            nome,
            sobrenome,
            email,
            senha: senhaVal
          },
          skipAuth: true
        });
        showAlert(form, 'success', 'Cadastro concluido! Agora voce pode fazer login.');
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 1200);
      } catch (err) {
        console.error('[register] erro', err);
        const message = err.data?.error || 'Nao foi possivel concluir o cadastro.';
        showAlert(form, 'danger', message);
      }
    });
  }

  function initForgotPassword() {
    const requestSection = document.getElementById('forgotPasswordRequest');
    const resetSection = document.getElementById('forgotPasswordReset');
    const successSection = document.getElementById('forgotPasswordSuccess');
    const requestForm = document.getElementById('forgotPasswordRequestForm');
    const resetForm = document.getElementById('forgotPasswordResetForm');
    const successMessage = document.getElementById('forgotPasswordSuccessMessage');
    const titleEl = document.getElementById('forgotPasswordTitle');
    const subtitleEl = document.getElementById('forgotPasswordSubtitle');
    const emailInput = document.getElementById('forgotPasswordEmail');
    const senhaInput = document.getElementById('resetPasswordSenha');
    const confirmInput = document.getElementById('resetPasswordConfirmacao');

    if (!requestSection && !resetSection && !successSection) return;

    const params = new URLSearchParams(window.location.search);
    const state = {
      token: (params.get('token') || '').trim()
    };

    const sections = {
      request: requestSection,
      reset: resetSection,
      success: successSection
    };

    function toggleStep(step) {
      Object.entries(sections).forEach(([key, element]) => {
        if (!element) return;
        element.classList.toggle('d-none', key !== step);
      });
    }

    function updateHeader(title, subtitle) {
      if (titleEl && title) {
        titleEl.textContent = title;
      }
      if (!subtitleEl) return;
      if (subtitle) {
        subtitleEl.textContent = subtitle;
        subtitleEl.classList.remove('d-none');
      } else {
        subtitleEl.classList.add('d-none');
      }
    }

    function toggleFormSubmitting(form, isSubmitting, loadingLabel) {
      if (!form) return;
      const button = form.querySelector('button[type="submit"]');
      if (!button) return;
      if (isSubmitting) {
        if (!button.dataset.originalText) {
          button.dataset.originalText = button.textContent ?? '';
        }
        if (loadingLabel) {
          button.textContent = loadingLabel;
        }
        button.setAttribute('disabled', 'disabled');
      } else {
        button.removeAttribute('disabled');
        if (button.dataset.originalText) {
          button.textContent = button.dataset.originalText;
          delete button.dataset.originalText;
        }
      }
    }

    if (state.token) {
      toggleStep('reset');
      updateHeader('Definir nova senha', 'Crie uma nova senha para continuar.');
    } else {
      toggleStep('request');
      updateHeader('Recuperar senha', 'Informe seu email e enviaremos um link para redefinir sua senha.');
    }

    requestForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = emailInput?.value.trim().toLowerCase() || '';
      if (!email) {
        showAlert(requestForm, 'warning', 'Informe um email valido.');
        return;
      }

      toggleFormSubmitting(requestForm, true, 'Enviando...');
      try {
        await apiRequest(ENDPOINTS.forgotPassword, {
          method: 'POST',
          body: { email },
          skipAuth: true
        });
        toggleStep('success');
        if (successMessage) {
          successMessage.textContent = 'Se o email estiver cadastrado, voce recebera um link para redefinir sua senha.';
        }
        updateHeader('Confira seu email', 'Enviamos as instrucoes para continuar.');
      } catch (err) {
        console.error('[forgot-password] erro', err);
        const message = err.data?.error || 'Nao foi possivel iniciar a redefinicao.';
        showAlert(requestForm, 'danger', message);
      } finally {
        toggleFormSubmitting(requestForm, false);
      }
    });

    resetForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const senha = senhaInput?.value || '';
      const confirmacao = confirmInput?.value || '';

      if (!state.token) {
        showAlert(resetForm, 'danger', 'Token de redefinicao ausente ou invalido.');
        return;
      }

      if (senha.length < 8) {
        showAlert(resetForm, 'warning', 'A senha deve conter pelo menos 8 caracteres.');
        return;
      }

      if (senha !== confirmacao) {
        showAlert(resetForm, 'warning', 'As senhas nao conferem.');
        return;
      }

      toggleFormSubmitting(resetForm, true, 'Salvando...');
      try {
        await apiRequest(ENDPOINTS.resetPassword, {
          method: 'POST',
          body: { token: state.token, senha },
          skipAuth: true
        });
        toggleStep('success');
        if (successMessage) {
          successMessage.textContent = 'Sua senha foi atualizada com sucesso.';
        }
        updateHeader('Senha atualizada', 'Voce ja pode fazer login com a nova senha.');
      } catch (err) {
        console.error('[reset-password] erro', err);
        const message = err.data?.error || 'Nao foi possivel redefinir sua senha.';
        showAlert(resetForm, 'danger', message);
      } finally {
        toggleFormSubmitting(resetForm, false);
      }
    });
  }

  function createPreviewElement(entry, container, state) {
    const wrapper = document.createElement('div');
    wrapper.className = 'image-preview';
    wrapper.dataset.photoId = entry.uid;

    const img = document.createElement('img');
    img.alt = entry.name || 'Preview';
    img.src = entry.dataUrl;
    wrapper.appendChild(img);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-btn';
    remove.setAttribute('aria-label', `Remover ${entry.name}`);
    remove.innerHTML = '&times;';
    remove.addEventListener('click', () => {
      const index = state.findIndex((item) => item.uid === entry.uid);
      if (index >= 0) {
        state.splice(index, 1);
      }
      wrapper.remove();
    });
    wrapper.appendChild(remove);
    container.appendChild(wrapper);
  }

  function gatherFeatureSelections() {
    return Object.entries(FEATURE_BY_CHECKBOX)
      .filter(([checkboxId]) => document.getElementById(checkboxId)?.checked)
      .map(([, key]) => key);
  }

  function initCadastroLocal() {
    const form = document.getElementById('cadastroLocalForm');
    if (!form) return;
    const inputFotos = document.getElementById('fotos');
    const preview = document.getElementById('imagePreviewContainer');
    const successActions = document.getElementById('cadastroLocalSuccessActions');
    const submitButton = form.querySelector('button[type="submit"]');
    const mapEl = document.getElementById('map');
    const latInput = document.getElementById('latitude');
    const lngInput = document.getElementById('longitude');
    const coordsHint = document.getElementById('mapSelectedCoords');
    const locationButton = document.getElementById('useCurrentLocation');
    const locationButtonDefaultLabel = locationButton?.textContent?.trim() || 'Usar minha localizacao';
    const cepInput = document.getElementById('cep');
    let selectedLat = null;
    let selectedLng = null;
    let isRequestingLocation = false;
    const photoState = [];
    const MAX_PHOTOS = 5;
    const token = getToken();

    if (!token) {
      showAlert(form, 'warning', 'E necessario estar logado para cadastrar um local.');
      form.querySelectorAll('input, select, textarea, button').forEach((element) => {
        element.setAttribute('disabled', 'disabled');
      });
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1500);
      return;
    }

    if (cepInput) {
      cepInput.addEventListener('input', () => {
        const digits = cepInput.value.replace(/\D/g, '').slice(0, 8);
        if (cepInput.value !== digits) {
          cepInput.value = digits;
        }
      });
    }

    const updateCoordsHint = () => {
      if (!coordsHint) return;
      if (Number.isFinite(selectedLat) && Number.isFinite(selectedLng)) {
        coordsHint.textContent = `Latitude: ${selectedLat.toFixed(5)}, Longitude: ${selectedLng.toFixed(5)}`;
        coordsHint.classList.remove('text-muted');
      } else {
        coordsHint.textContent = 'Nenhum ponto selecionado.';
        if (!coordsHint.classList.contains('text-muted')) {
          coordsHint.classList.add('text-muted');
        }
      }
    };

    const setLocationButtonLoading = (loading) => {
      if (!locationButton) return;
      locationButton.disabled = loading;
      locationButton.textContent = loading ? 'Buscando localizacao...' : locationButtonDefaultLabel;
    };

    const handleGeolocationError = (error, options = {}) => {
      if (options.silent) return;
      let message = 'Nao foi possivel acessar sua localizacao.';
      if (error?.code === 1) {
        message = 'Permita o acesso a localizacao do navegador para marcar automaticamente o endereco.';
      } else if (error?.code === 2) {
        message = 'Nao foi possivel determinar sua localizacao. Tente novamente.';
      } else if (error?.code === 3) {
        message = 'A busca pela localizacao expirou. Tente novamente.';
      } else if (typeof error?.message === 'string' && error.message.trim()) {
        message = error.message;
      }
      showAlert(form, 'warning', message);
    };

    const resetMapSelection = (options = {}) => {
      selectedLat = null;
      selectedLng = null;
      if (latInput) latInput.value = '';
      if (lngInput) lngInput.value = '';
      if (mapEl) {
        mapEl.dataset.marker = 'false';
      }
      setLocationButtonLoading(false);
      updateCoordsHint();
      if (mapEl?._leafletMap && mapEl._leafletMarker) {
        mapEl._leafletMap.removeLayer(mapEl._leafletMarker);
        mapEl._leafletMarker = null;
      }
      if (mapEl?._leafletMap && options.recenter !== false) {
        const centerLat = Number(mapEl.dataset.centerLat);
        const centerLng = Number(mapEl.dataset.centerLng);
        const zoom = Number.parseInt(mapEl.dataset.zoom || '13', 10);
        if (Number.isFinite(centerLat) && Number.isFinite(centerLng)) {
          mapEl._leafletMap.setView([centerLat, centerLng], Number.isFinite(zoom) ? zoom : mapEl._leafletMap.getZoom());
        }
      }
    };

    const setSelectedCoords = (lat, lng, options = {}) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        resetMapSelection({ recenter: options.recenter });
        return;
      }
      selectedLat = lat;
      selectedLng = lng;
      if (latInput) latInput.value = selectedLat.toFixed(6);
      if (lngInput) lngInput.value = selectedLng.toFixed(6);
      if (mapEl) {
        mapEl.dataset.marker = 'true';
        if (window.Maps?.setMarker) {
          window.Maps.setMarker(mapEl, selectedLat, selectedLng, {
            pan: options.pan ?? false,
            invalidate: options.invalidate ?? true
          });
        } else if (mapEl._leafletMap && window.L) {
          if (!mapEl._leafletMarker) {
            mapEl._leafletMarker = window.L.marker([selectedLat, selectedLng]).addTo(mapEl._leafletMap);
          } else {
            mapEl._leafletMarker.setLatLng([selectedLat, selectedLng]);
          }
          if (options.pan !== false) {
            mapEl._leafletMap.setView([selectedLat, selectedLng]);
          }
        }
      }
      updateCoordsHint();
    };

    const requestCurrentLocation = (options = {}) => {
      if (!navigator.geolocation) {
        if (!options.silent) {
          showAlert(form, 'warning', 'Geolocalizacao nao suportada neste navegador.');
        }
        return;
      }
      if (isRequestingLocation) {
        return;
      }
      isRequestingLocation = true;
      if (!options.silent) {
        setLocationButtonLoading(true);
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          isRequestingLocation = false;
          if (!options.silent) {
            setLocationButtonLoading(false);
          }
          const { latitude, longitude } = position.coords || {};
          if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            setSelectedCoords(latitude, longitude, { pan: options.pan ?? true, invalidate: true });
          } else if (!options.silent) {
            showAlert(form, 'warning', 'Localizacao valida nao encontrada.');
          }
        },
        (error) => {
          isRequestingLocation = false;
          if (!options.silent) {
            setLocationButtonLoading(false);
          }
          console.warn('[cadastro-local] geolocation erro', error);
          handleGeolocationError(error, options);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000
        }
      );
    };

    if (mapEl) {
      try {
        window.Maps?.initElement?.(mapEl);
        if (mapEl._leafletMap) {
          mapEl._leafletMap.on('click', (event) => {
            const { lat, lng } = event.latlng || {};
            setSelectedCoords(lat, lng, { pan: false });
          });
        } else {
          console.warn('[cadastro-local] mapa nao inicializado');
        }
      } catch (err) {
        console.warn('[cadastro-local] falha ao iniciar mapa', err);
      }
    }

    if (locationButton) {
      locationButton.textContent = locationButtonDefaultLabel;
      if (!navigator.geolocation) {
        locationButton.classList.add('d-none');
      } else if (locationButton.dataset.bound !== 'true') {
        locationButton.dataset.bound = 'true';
        locationButton.classList.remove('d-none');
        locationButton.addEventListener('click', (event) => {
          event.preventDefault();
          requestCurrentLocation({ pan: true });
        });
      }
    }

    if (navigator.geolocation && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          if (status.state === 'granted' && !Number.isFinite(selectedLat) && !Number.isFinite(selectedLng)) {
            requestCurrentLocation({ silent: true, pan: true });
          }
          status.onchange = () => {
            if (status.state === 'granted') {
              requestCurrentLocation({ silent: true, pan: true });
            }
          };
        })
        .catch(() => { });
    }

    updateCoordsHint();

    if (inputFotos && preview) {
      inputFotos.addEventListener('change', () => {
        const files = Array.from(inputFotos.files || []);
        const imageFiles = files.filter((file) => file && file.type && file.type.startsWith('image/'));
        if (!imageFiles.length && files.length) {
          showAlert(form, 'warning', 'Envie apenas arquivos de imagem.');
        }
        for (const file of imageFiles) {
          if (photoState.length >= MAX_PHOTOS) {
            showAlert(form, 'warning', `Limite de ${MAX_PHOTOS} fotos atingido.`);
            break;
          }
          const reader = new FileReader();
          const uid = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
          reader.onload = (event) => {
            const entry = {
              uid,
              name: file.name,
              dataUrl: event.target?.result || ''
            };
            photoState.push(entry);
            createPreviewElement(entry, preview, photoState);
          };
          reader.readAsDataURL(file);
        }
        inputFotos.value = '';
      });
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const nome = document.getElementById('nomeLocal')?.value.trim() || '';
      const tipo = document.getElementById('tipoLocal')?.value || '';
      const cepValue = cepInput?.value || '';
      const logradouro = document.getElementById('logradouro')?.value.trim() || '';
      const numero = document.getElementById('numero')?.value.trim() || '';
      const complemento = document.getElementById('complemento')?.value.trim() || '';
      const bairro = document.getElementById('bairro')?.value.trim() || '';
      const cidade = document.getElementById('cidade')?.value.trim() || '';
      const estado = document.getElementById('estado')?.value.trim().toUpperCase() || '';
      const telefone = document.getElementById('telefone')?.value.trim() || '';
      const site = document.getElementById('site')?.value.trim() || '';
      const descricao = document.getElementById('descricao')?.value.trim() || '';
      const latValue = Number.parseFloat(latInput?.value ?? '');
      const lngValue = Number.parseFloat(lngInput?.value ?? '');
      const cepDigits = cepValue.replace(/\D/g, '').slice(0, 8);
      const formattedCep = cepDigits.length === 8 ? `${cepDigits.slice(0, 5)}-${cepDigits.slice(5)}` : '';
      const addressParts = [];
      if (logradouro) {
        addressParts.push(numero ? `${logradouro}, ${numero}` : logradouro);
      }
      if (complemento) {
        addressParts.push(complemento);
      }
      if (bairro) {
        addressParts.push(bairro);
      }
      const cityState = [cidade, estado].filter(Boolean).join(' - ');
      if (cityState) {
        addressParts.push(cityState);
      }
      if (formattedCep) {
        addressParts.push(`CEP ${formattedCep}`);
      }
      const endereco = addressParts.join(' | ');

      if (successActions) {
        successActions.classList.add('d-none');
        successActions.innerHTML = '';
      }

      if (
        !nome ||
        !tipo ||
        !descricao ||
        !logradouro ||
        !numero ||
        !bairro ||
        !cidade ||
        !estado ||
        !formattedCep
      ) {
        showAlert(form, 'warning', 'Preencha os campos obrigatorios.');
        return;
      }

      if (!photoState.length) {
        showAlert(form, 'warning', 'E necessario anexar uma foto do local para concluir o cadastro.');
        return;
      }

      if (!Number.isFinite(latValue) || !Number.isFinite(lngValue)) {
        showAlert(form, 'warning', 'Clique no mapa para marcar a localizacao do estabelecimento.');
        return;
      }

      submitButton?.setAttribute('disabled', 'disabled');

      try {
        const payload = {
          nome,
          tipo,
          endereco,
          cep: cepDigits,
          logradouro,
          numero,
          complemento: complemento || null,
          bairro,
          cidade,
          estado,
          telefone: telefone || null,
          site: site || null,
          descricao,
          lat: latValue,
          lng: lngValue,
          features: gatherFeatureSelections(),
          fotos: photoState.map(({ dataUrl, name }) => ({ dataUrl, name }))
        };
        const place = await apiRequest(ENDPOINTS.place, {
          method: 'POST',
          body: payload
        });

        form.reset();
        if (preview) {
          preview.innerHTML = '';
        }
        photoState.splice(0, photoState.length);
        resetMapSelection();

        showAlert(form, 'success', 'Local cadastrado com sucesso!');

        if (place?.id) {
          window.sessionStorage.setItem('acesso-livre.lastPlaceId', String(place.id));
          window.location.href = `local-detalhes.html?id=${place.id}`;
          return;
        }

        if (successActions) {
          successActions.classList.remove('d-none');
          successActions.innerHTML = '';
          const viewButton = document.createElement('a');
          viewButton.className = 'btn btn-outline-success';
          viewButton.href = 'local-detalhes.html';
          viewButton.textContent = 'Ver detalhes';
          successActions.appendChild(viewButton);
        } else {
          window.location.href = 'local-detalhes.html';
        }
      } catch (err) {
        if (err.status === 401) {
          clearSession();
          window.location.href = 'login.html';
          return;
        }
        console.error('[cadastro-local] erro', err);
        const message = err.data?.error || 'Erro ao cadastrar local.';
        showAlert(form, 'danger', message);
      } finally {
        submitButton?.removeAttribute('disabled');
      }
    });
  }

  function collectSearchFilters() {
    const locationInput = document.getElementById('localizacao');
    const typeSelect = document.getElementById('tipo-local');
    const cepInput = document.getElementById('filtroCep');
    const bairroInput = document.getElementById('filtroBairro');
    const cidadeInput = document.getElementById('filtroCidade');
    const estadoSelect = document.getElementById('filtroEstado');
    const logradouroInput = document.getElementById('filtroLogradouro');
    const numeroInput = document.getElementById('filtroNumero');
    const complementoInput = document.getElementById('filtroComplemento');
    const selectedFeatures = new Set();

    Object.entries(FEATURE_GROUP_FILTERS).forEach(([checkboxId, featureKeys]) => {
      const checkbox = document.getElementById(checkboxId);
      if (checkbox && checkbox.checked) {
        featureKeys.forEach((key) => selectedFeatures.add(key));
      }
    });

    const query = new URLSearchParams();
    const searchValue = locationInput?.value.trim();
    if (searchValue) {
      query.set('search', searchValue);
    }

    const typeValue = typeSelect?.value || '';
    if (typeValue && typeValue !== 'todos') {
      query.set('tipo', typeValue);
    }

    if (cepInput) {
      const cepDigits = (cepInput.value || '').replace(/\D/g, '').slice(0, 8);
      if (cepDigits) {
        query.set('cep', cepDigits);
      }
    }
    if (bairroInput?.value.trim()) {
      query.set('bairro', bairroInput.value.trim());
    }
    if (cidadeInput?.value.trim()) {
      query.set('cidade', cidadeInput.value.trim());
    }
    if (estadoSelect?.value.trim()) {
      query.set('estado', estadoSelect.value.trim().toUpperCase());
    }
    if (logradouroInput?.value.trim()) {
      query.set('logradouro', logradouroInput.value.trim());
    }
    if (numeroInput?.value.trim()) {
      query.set('numero', numeroInput.value.trim());
    }
    if (complementoInput?.value.trim()) {
      query.set('complemento', complementoInput.value.trim());
    }

    if (selectedFeatures.size) {
      query.set('features', Array.from(selectedFeatures).join(','));
    }

    return query;
  }

  function renderSearchResults(results) {
    const list = document.getElementById('resultsList');
    const empty = document.getElementById('resultsEmpty');
    if (!list) return;
    list.innerHTML = '';

    if (!results || !results.length) {
      if (empty) empty.classList.remove('d-none');
      return;
    }
    if (empty) empty.classList.add('d-none');

    results.forEach((place) => {
      const link = document.createElement('a');
      link.className = 'list-group-item list-group-item-action';
      link.href = `local-detalhes.html?id=${place.id}`;
      link.setAttribute('aria-label', `Ver detalhes de ${place.name}`);

      const header = document.createElement('div');
      header.className = 'd-flex w-100 justify-content-between align-items-start';

      const title = document.createElement('h5');
      title.className = 'mb-1';
      title.textContent = place.name;
      header.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'text-end';
      const typeBadge = document.createElement('span');
      typeBadge.className = 'badge bg-secondary';
      typeBadge.textContent = placeTypeLabel(place.type);
      meta.appendChild(typeBadge);
      if (place.stats?.averageRating) {
        const rating = document.createElement('div');
        rating.className = 'small text-muted';
        rating.innerHTML = `<i class="fas fa-star text-warning"></i> ${place.stats.averageRating}`;
        meta.appendChild(rating);
      }
      header.appendChild(meta);
      link.appendChild(header);

      if (place.address) {
        const address = document.createElement('p');
        address.className = 'mb-1 text-muted';
        address.innerHTML = `<i class="fas fa-map-marker-alt me-1"></i>${place.address}`;
        link.appendChild(address);
      }

      const featureWrap = document.createElement('div');
      renderFeatureBadges(featureWrap, place.features || [], { showEmpty: false, limit: 3, flags: place.accessibilityFlags });
      link.appendChild(featureWrap);

      list.appendChild(link);
    });
  }

  function renderHomePlaces(places) {
    const container = document.getElementById('recentPlaces');
    const empty = document.getElementById('recentPlacesEmpty');
    if (!container) return;
    container.innerHTML = '';

    if (!places || !places.length) {
      empty?.classList.remove('d-none');
      return;
    }

    empty?.classList.add('d-none');

    places.slice(0, 6).forEach((place) => {
      const col = document.createElement('div');
      col.className = 'col-sm-6 col-lg-4';

      const card = document.createElement('div');
      card.className = 'card h-100 border-0 shadow-sm';

      if (place.photos && place.photos.length) {
        const img = document.createElement('img');
        img.className = 'card-img-top';
        img.loading = 'lazy';
        img.alt = place.name || 'Foto do local';
        img.src = resolveMediaUrl(place.photos[0].url);
        card.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'ratio ratio-16x9 bg-light d-flex align-items-center justify-content-center text-muted';
        placeholder.textContent = 'Sem foto disponivel';
        card.appendChild(placeholder);
      }

      const body = document.createElement('div');
      body.className = 'card-body d-flex flex-column';

      const header = document.createElement('div');
      header.className = 'd-flex justify-content-between align-items-start mb-2';

      const title = document.createElement('h5');
      title.className = 'mb-0';
      title.textContent = place.name;
      header.appendChild(title);

      const typeBadge = document.createElement('span');
      typeBadge.className = 'badge bg-secondary';
      typeBadge.textContent = placeTypeLabel(place.type);
      header.appendChild(typeBadge);
      body.appendChild(header);

      if (place.description) {
        const description = document.createElement('p');
        description.className = 'text-muted small';
        description.textContent = truncateText(place.description, 160);
        body.appendChild(description);
      }

      const features = document.createElement('div');
      renderFeatureBadges(features, place.features || [], { showEmpty: false, limit: 3, flags: place.accessibilityFlags });
      body.appendChild(features);

      const footer = document.createElement('div');
      footer.className = 'mt-auto d-flex justify-content-between align-items-center pt-3';

      const ratingWrap = document.createElement('div');
      ratingWrap.className = 'd-flex align-items-center gap-1 text-muted';
      renderStars(ratingWrap, place.stats?.averageRating || 0);
      const ratingValue = document.createElement('small');
      ratingValue.textContent = place.stats?.averageRating ? place.stats.averageRating.toString() : 'Novo';
      ratingWrap.appendChild(ratingValue);
      footer.appendChild(ratingWrap);

      const link = document.createElement('a');
      link.href = `local-detalhes.html?id=${place.id}`;
      link.className = 'btn btn-sm btn-outline-success';
      link.textContent = 'Ver detalhes';
      footer.appendChild(link);

      body.appendChild(footer);
      card.appendChild(body);
      col.appendChild(card);
      container.appendChild(col);
    });
  }

  async function initHome() {
    const container = document.getElementById('recentPlaces');
    if (!container) return;
    const loading = document.getElementById('recentPlacesLoading');
    const empty = document.getElementById('recentPlacesEmpty');

    loading?.classList.remove('d-none');
    try {
      const places = await apiRequest(`${ENDPOINTS.place}?limit=6`, { skipAuth: true });
      renderHomePlaces(Array.isArray(places) ? places : []);
    } catch (err) {
      console.error('[home] erro', err);
      showAlert(container.parentElement || document.body, 'danger', err.data?.error || 'Erro ao carregar locais recentes.');
      empty?.classList.remove('d-none');
    } finally {
      loading?.classList.add('d-none');
    }
  }

  async function loadPlaces() {
    const spinner = document.getElementById('resultsLoading');
    if (spinner) spinner.classList.remove('d-none');
    try {
      const query = collectSearchFilters();
      const queryString = query.toString();
      const endpoint = queryString ? `${ENDPOINTS.place}?${queryString}` : ENDPOINTS.place;
      if (history && history.replaceState) {
        const newUrl = queryString ? `${location.pathname}?${queryString}` : location.pathname;
        history.replaceState(null, '', newUrl);
      }
      const results = await apiRequest(endpoint);
      renderSearchResults(results || []);
    } catch (err) {
      console.error('[pesquisa] erro', err);
      const list = document.getElementById('resultsList');
      showAlert(list?.parentElement || document.body, 'danger', err.data?.error || 'Erro ao carregar locais.');
    } finally {
      if (spinner) spinner.classList.add('d-none');
    }
  }

  function initPesquisa() {
    const form = document.getElementById('searchForm');
    if (!form) return;

    const params = new URLSearchParams(window.location.search);
    const locationInput = document.getElementById('localizacao');
    const typeSelect = document.getElementById('tipo-local');
    const cepFilter = document.getElementById('filtroCep');
    const bairroFilter = document.getElementById('filtroBairro');
    const cidadeFilter = document.getElementById('filtroCidade');
    const estadoFilter = document.getElementById('filtroEstado');
    const logradouroFilter = document.getElementById('filtroLogradouro');
    const numeroFilter = document.getElementById('filtroNumero');
    const complementoFilter = document.getElementById('filtroComplemento');

    const featureParam = params.get('features');
    if (featureParam) {
      const featureSet = new Set(
        featureParam
          .split(',')
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean)
      );
      Object.entries(FEATURE_GROUP_FILTERS).forEach(([checkboxId, featureKeys]) => {
        const checkbox = document.getElementById(checkboxId);
        if (!checkbox) return;
        const hasAll = featureKeys.every((key) => featureSet.has(key));
        checkbox.checked = hasAll;
      });
    }

    if (locationInput && params.get('search')) {
      locationInput.value = params.get('search');
    }
    if (typeSelect && params.get('tipo')) {
      typeSelect.value = params.get('tipo');
    }
    if (cepFilter) {
      const setCepValue = (value) => {
        const digits = (value || '').replace(/\D/g, '').slice(0, 8);
        if (cepFilter.value !== digits) {
          cepFilter.value = digits;
        }
      };
      if (params.get('cep')) {
        setCepValue(params.get('cep'));
      }
      cepFilter.addEventListener('input', () => setCepValue(cepFilter.value));
    }
    if (bairroFilter && params.get('bairro')) {
      bairroFilter.value = params.get('bairro');
    }
    if (cidadeFilter && params.get('cidade')) {
      cidadeFilter.value = params.get('cidade');
    }
    if (estadoFilter && params.get('estado')) {
      estadoFilter.value = params.get('estado').toUpperCase();
    }
    if (logradouroFilter && params.get('logradouro')) {
      logradouroFilter.value = params.get('logradouro');
    }
    if (numeroFilter && params.get('numero')) {
      numeroFilter.value = params.get('numero');
    }
    if (complementoFilter && params.get('complemento')) {
      complementoFilter.value = params.get('complemento');
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      loadPlaces();
    });
    form.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => loadPlaces());
    });
    typeSelect?.addEventListener('change', () => loadPlaces());
    estadoFilter?.addEventListener('change', () => loadPlaces());

    const clearButton = document.getElementById('limparFiltros');
    clearButton?.addEventListener('click', (event) => {
      event.preventDefault();
      form.reset();
      form.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
        checkbox.checked = false;
      });
      loadPlaces();
    });

    loadPlaces();
  }

  function renderPlacePhotos(place) {
    const indicators = document.getElementById('placePhotosIndicators');
    const inner = document.getElementById('placePhotosInner');
    const empty = document.getElementById('placeNoPhotos');
    if (!inner) return;

    inner.innerHTML = '';
    if (indicators) indicators.innerHTML = '';

    const photos = place.photos || [];
    if (!photos.length) {
      if (empty) empty.classList.remove('d-none');
      return;
    }
    if (empty) empty.classList.add('d-none');

    photos.forEach((photo, index) => {
      const item = document.createElement('div');
      item.className = `carousel-item${index === 0 ? ' active' : ''}`;
      const img = document.createElement('img');
      img.className = 'd-block w-100';
      img.alt = `Foto ${index + 1} de ${place.name}`;
      img.loading = 'lazy';
      img.src = resolveMediaUrl(photo.url);
      item.appendChild(img);
      inner.appendChild(item);

      if (indicators) {
        const indicator = document.createElement('button');
        indicator.type = 'button';
        indicator.setAttribute('data-bs-target', '#placeCarousel');
        indicator.setAttribute('data-bs-slide-to', String(index));
        indicator.setAttribute('aria-label', `Slide ${index + 1}`);
        if (index === 0) {
          indicator.className = 'active';
          indicator.setAttribute('aria-current', 'true');
        }
        indicators.appendChild(indicator);
      }
    });
  }

  function renderPlaceReviewsList(reviews) {
    const wrapper = document.getElementById('placeReviewsList');
    const empty = document.getElementById('placeReviewsEmpty');
    if (!wrapper) return;
    wrapper.innerHTML = '';

    if (!reviews || !reviews.length) {
      if (empty) empty.classList.remove('d-none');
      return;
    }
    if (empty) empty.classList.add('d-none');

    reviews.forEach((review) => {
      const card = document.createElement('div');
      card.className = 'card border-0 shadow-sm mb-3';
      const body = document.createElement('div');
      body.className = 'card-body';

      const header = document.createElement('div');
      header.className = 'd-flex justify-content-between align-items-center mb-2';
      const userName = document.createElement('strong');
      const displayName = review.user?.name || review.user?.email || 'Usuario';
      userName.textContent = displayName;
      header.appendChild(userName);

      const ratingWrap = document.createElement('div');
      ratingWrap.className = 'd-flex align-items-center gap-1';
      renderStars(ratingWrap, review.rating);
      header.appendChild(ratingWrap);
      body.appendChild(header);

      if (review.comment) {
        const comment = document.createElement('p');
        comment.className = 'mb-1';
        comment.textContent = review.comment;
        body.appendChild(comment);
      }

      const meta = document.createElement('small');
      meta.className = 'text-muted';
      meta.textContent = formatDate(review.createdAt);
      body.appendChild(meta);

      card.appendChild(body);
      wrapper.appendChild(card);
    });
  }

  function applyFavoriteButtonState(button, isFavorite) {
    if (!button) return;
    button.dataset.favoriteState = isFavorite ? 'on' : 'off';
    button.classList.toggle('btn-success', isFavorite);
    button.classList.toggle('btn-outline-success', !isFavorite);
    button.innerHTML = isFavorite
      ? '<i class="fas fa-heart me-2"></i>Remover dos favoritos'
      : '<i class="far fa-heart me-2"></i>Adicionar aos favoritos';
  }

  async function toggleFavorite(button, placeId) {
    if (!button) return;
    const isFavorite = button.dataset.favoriteState === 'on';
    const method = isFavorite ? 'DELETE' : 'POST';
    const container = button.closest('.card-body') || document.body;
    button.disabled = true;
    try {
      await apiRequest(ENDPOINTS.placeFavorites(placeId), {
        method,
        body: method === 'POST' ? {} : undefined
      });
      applyFavoriteButtonState(button, !isFavorite);
    } catch (err) {
      if (err.status === 401) {
        clearSession();
        window.location.href = 'login.html';
        return;
      }
      console.error('[favorite] erro', err);
      showAlert(container, 'danger', err.data?.error || 'Erro ao atualizar favorito.');
    } finally {
      button.disabled = false;
    }
  }

  function setupFavoriteButton(button, hintElement, placeId, isFavorite) {
    if (!button) return;
    const token = getToken();
    applyFavoriteButtonState(button, Boolean(isFavorite));
    if (!token) {
      button.classList.remove('btn-success');
      button.classList.add('btn-outline-secondary');
      button.innerHTML = '<i class="fas fa-right-to-bracket me-2"></i>Entrar para favoritar';
      button.disabled = false;
      hintElement?.classList.remove('d-none');
      button.addEventListener('click', () => {
        window.location.href = 'login.html';
      });
      return;
    }
    hintElement?.classList.add('d-none');
    button.disabled = false;
    button.addEventListener('click', () => toggleFavorite(button, placeId));
  }

  function calculateAverageRating(reviews = []) {
    if (!reviews.length) return null;
    const total = reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0);
    return Number((total / reviews.length).toFixed(1));
  }

  function updatePlaceRatingSummary(reviews = []) {
    const average = calculateAverageRating(reviews);
    const countText = `${reviews.length} avaliacao(oes)`;
    document.getElementById('placeRatingValue')?.replaceChildren(document.createTextNode(average ? average.toString() : 'Novo'));
    renderStars(document.getElementById('placeRatingStars'), average || 0);
    document.getElementById('placeReviewCount')?.replaceChildren(document.createTextNode(countText));
  }

  async function fetchPlaceReviews(placeId) {
    try {
      const data = await apiRequest(ENDPOINTS.placeReviews(placeId));
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('[reviews] erro ao buscar lista', err);
      return null;
    }
  }

  function setupReviewForm(form, placeId, onSuccess) {
    const warning = document.getElementById('placeReviewLoginWarning');
    const feedback = document.getElementById('placeReviewFeedback');
    const token = getToken();

    if (!form) {
      warning?.classList.remove('d-none');
      return;
    }

    if (!token) {
      form.classList.add('d-none');
      warning?.classList.remove('d-none');
      return;
    }

    warning?.classList.add('d-none');
    form.classList.remove('d-none');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const ratingInput = form.querySelector('[name="rating"]');
      const commentInput = form.querySelector('[name="comment"]');
      const ratingValue = Number(ratingInput?.value || '');
      const comment = commentInput?.value?.trim() || '';

      if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
        if (feedback) {
          feedback.className = 'small mt-2 text-danger';
          feedback.textContent = 'Informe uma nota entre 1 e 5.';
        }
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn?.setAttribute('disabled', 'disabled');
      if (feedback) feedback.textContent = '';

      try {
        const review = await apiRequest(ENDPOINTS.placeReviews(placeId), {
          method: 'POST',
          body: { rating: ratingValue, comment }
        });
        form.reset();
        if (feedback) {
          feedback.className = 'small mt-2 text-success';
          feedback.textContent = 'Obrigado! Sua avaliacao foi registrada.';
        }
        onSuccess?.(review);
      } catch (err) {
        if (err.status === 401) {
          clearSession();
          window.location.href = 'login.html';
          return;
        }
        console.error('[reviews] erro ao criar', err);
        if (feedback) {
          feedback.className = 'small mt-2 text-danger';
          feedback.textContent = err.data?.error || 'Nao foi possivel enviar a avaliacao.';
        }
      } finally {
        submitBtn?.removeAttribute('disabled');
      }
    });
  }

  async function initLocalDetalhes() {
    const detailRoot = document.getElementById('placeDetailRoot');
    if (!detailRoot) return;
    const params = new URLSearchParams(window.location.search);
    let id = params.get('id');
    if (!id) {
      const storedId = window.sessionStorage.getItem('acesso-livre.lastPlaceId');
      if (storedId) {
        id = storedId;
        window.sessionStorage.removeItem('acesso-livre.lastPlaceId');
      }
    }
    const loading = document.getElementById('placeLoading');
    const favoriteButton = document.getElementById('favoriteToggle');
    const favoriteHint = document.getElementById('favoriteHint');

    if (!id) {
      loading?.classList.add('d-none');
      showAlert(detailRoot, 'warning', 'Local nao informado.');
      return;
    }

    loading?.classList.remove('d-none');
    try {
      const place = await apiRequest(`${ENDPOINTS.place}/${id}`);
      document.getElementById('placeTitle')?.replaceChildren(document.createTextNode(place.name));
      document.getElementById('placeType')?.replaceChildren(document.createTextNode(placeTypeLabel(place.type)));
      document.getElementById('placeAddress')?.replaceChildren(document.createTextNode(place.address || ''));
      document.getElementById('placeDescription')?.replaceChildren(document.createTextNode(place.description || ''));

      const phoneEl = document.getElementById('placeContactPhone');
      if (phoneEl) {
        phoneEl.textContent = place.phone || 'Nao informado';
      }
      const siteEl = document.getElementById('placeContactWebsite');
      if (siteEl) {
        if (place.website) {
          siteEl.innerHTML = `<a href="${place.website}" target="_blank" rel="noopener">Site oficial</a>`;
        } else {
          siteEl.textContent = 'Nao informado';
        }
      }

      const mapEl = document.getElementById('placeMap');
      const mapUnavailable = document.getElementById('placeMapUnavailable');
      if (mapEl) {
        const hasCoords = Number.isFinite(place.lat) && Number.isFinite(place.lng);
        if (hasCoords) {
          mapEl.dataset.centerLat = String(place.lat);
          mapEl.dataset.centerLng = String(place.lng);
          mapEl.dataset.marker = 'true';
          mapEl.setAttribute('data-map', 'true');
          mapEl.classList.remove('d-none');
          mapUnavailable?.classList.add('d-none');
          if (window.Maps?.initElement) {
            window.Maps.initElement(mapEl);
            window.Maps.setMarker?.(mapEl, Number(place.lat), Number(place.lng), { pan: true });
            setTimeout(() => {
              if (mapEl._leafletMap?.invalidateSize) {
                mapEl._leafletMap.invalidateSize();
              }
            }, 0);
          }
        } else {
          mapEl.classList.add('d-none');
          if (mapUnavailable) {
            mapUnavailable.classList.remove('d-none');
          }
          mapEl.removeAttribute('data-map');
        }
      }

      renderFeatureBadges(document.getElementById('placeFeatureList'), place.features || [], { flags: place.accessibilityFlags });
      window.sessionStorage.removeItem('acesso-livre.lastPlaceId');
      renderPlacePhotos(place);
      setupFavoriteButton(favoriteButton, favoriteHint, id, place.isFavorite);

      let currentReviews = Array.isArray(place.reviews) ? place.reviews.slice() : [];
      const applyReviews = (reviews) => {
        currentReviews = Array.isArray(reviews) ? reviews : [];
        renderPlaceReviewsList(currentReviews);
        updatePlaceRatingSummary(currentReviews);
      };

      applyReviews(currentReviews);

      const reviewForm = document.getElementById('placeReviewForm');
      setupReviewForm(reviewForm, id, async (newReview) => {
        if (newReview) {
          applyReviews([newReview, ...currentReviews]);
        } else {
          const refreshed = await fetchPlaceReviews(id);
          if (refreshed) applyReviews(refreshed);
        }
      });

      fetchPlaceReviews(id).then((latest) => {
        if (latest) applyReviews(latest);
      });
    } catch (err) {
      console.error('[local-detalhes] erro', err);
      const isNotFound = err.status === 404;
      const message = err.data?.error || (isNotFound ? 'Local nao encontrado.' : 'Erro ao carregar dados do local.');
      showAlert(detailRoot, isNotFound ? 'warning' : 'danger', message);
      window.sessionStorage.removeItem('acesso-livre.lastPlaceId');
      if (isNotFound) {
        document.getElementById('placeTitle')?.replaceChildren(document.createTextNode('Local nao encontrado'));
        document.getElementById('placeDescription')?.replaceChildren(document.createTextNode(''));
      }
      favoriteButton?.setAttribute('disabled', 'disabled');
      if (favoriteHint) {
        favoriteHint.classList.remove('d-none');
        favoriteHint.textContent = 'Favoritos indisponiveis.';
      }
    } finally {
      loading?.classList.add('d-none');
    }
  }

  function initQuestionario() {
    const form = document.getElementById('formQuestionario');
    if (!form) return;
    const token = getToken();

    if (!token) {
      showAlert(form, 'warning', 'E necessario estar logado para enviar o questionario.');
      form.querySelectorAll('input, select, textarea, button').forEach((element) => {
        element.setAttribute('disabled', 'disabled');
      });
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1500);
      return;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!getToken()) {
        showAlert(form, 'warning', 'Sessao expirada. Faca login novamente.');
        clearSession();
        applySessionToNav(null);
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 1500);
        return;
      }
      const data = new FormData(form);
      const payload = {};
      data.forEach((value, key) => {
        payload[key] = value;
      });
      try {
        await apiRequest(ENDPOINTS.questionnaire, {
          method: 'POST',
          body: payload
        });
        window.location.href = 'index.html';
      } catch (err) {
        console.error('[questionario] erro', err);
        if (err.status === 401) {
          clearSession();
          applySessionToNav(null);
          showAlert(form, 'warning', 'Sessao expirada. Faca login novamente.');
          setTimeout(() => {
            window.location.href = 'login.html';
          }, 1500);
          return;
        }
        showAlert(form, 'danger', err.data?.error || 'Erro ao enviar o questionario.');
      }
    });
  }

  onReady(() => {
    if (location.hash === '#main-content' && history && history.replaceState) {
      history.replaceState(null, '', `${location.pathname}${location.search}`);
    }
    try {
      document.querySelectorAll('a[href^="../"]').forEach((link) => {
        link.setAttribute('href', link.getAttribute('href').replace(/^\.\.\//, ''));
      });
    } catch (_) {
      /* noop */
    }

    ensureMainIdAndSkipLink();
    markActiveNav();
    bootstrapSession();
    initLogin();
    initRegister();
    initForgotPassword();
    initCadastroLocal();
    initPesquisa();
    initHome();
    initLocalDetalhes();
    initPerfil();
    initQuestionario();
  });

  function buildActivityFeed(me) {
    const items = [];
    (me.places || []).forEach((place) => {
      items.push({
        date: place.createdAt,
        title: `Cadastrou ${place.name}`,
        link: `local-detalhes.html?id=${place.id}`
      });
    });
    (me.reviews || []).forEach((review) => {
      items.push({
        date: review.createdAt,
        title: `Avaliou ${review.place?.name || 'um local'}`,
        link: review.place ? `local-detalhes.html?id=${review.place.id}` : null
      });
    });
    (me.favorites || []).forEach((favorite) => {
      items.push({
        date: favorite.addedAt,
        title: `Favoritou ${favorite.place?.name || 'um local'}`,
        link: favorite.place ? `local-detalhes.html?id=${favorite.place.id}` : null
      });
    });

    return items
      .filter((item) => item.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6);
  }

  function renderCardList(containerId, items, renderFn, emptyMessage) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    if (!items || !items.length) {
      const empty = document.createElement('p');
      empty.className = 'text-muted';
      empty.textContent = emptyMessage;
      container.appendChild(empty);
      return;
    }
    items.forEach((item) => renderFn(container, item));
  }

  function renderProfilePlaceCard(container, entry) {
    const card = document.createElement('div');
    card.className = 'card border-0 shadow-sm mb-3';
    const body = document.createElement('div');
    body.className = 'card-body';

    const header = document.createElement('div');
    header.className = 'd-flex justify-content-between align-items-center mb-2';
    const title = document.createElement('h5');
    title.className = 'mb-0';
    title.textContent = entry.name;
    header.appendChild(title);

    const link = document.createElement('a');
    link.href = `local-detalhes.html?id=${entry.id}`;
    link.className = 'btn btn-sm btn-outline-success';
    link.textContent = 'Ver detalhes';
    header.appendChild(link);
    body.appendChild(header);

    if (entry.address) {
      const address = document.createElement('p');
      address.className = 'mb-2 text-muted';
      address.innerHTML = `<i class="fas fa-map-marker-alt me-1"></i>${entry.address}`;
      body.appendChild(address);
    }

    renderFeatureBadges(body.appendChild(document.createElement('div')), entry.features || [], { flags: entry.accessibilityFlags });

    const stats = document.createElement('div');
    stats.className = 'small text-muted mt-2';
    const reviews = entry.stats?.reviewCount || 0;
    stats.textContent = `${reviews} avaliacao(oes)`;
    body.appendChild(stats);

    card.appendChild(body);
    container.appendChild(card);
  }

  function renderProfileFavoriteCard(container, favorite) {
    if (!favorite.place) return;
    const card = document.createElement('div');
    card.className = 'card border-0 shadow-sm mb-3';
    const body = document.createElement('div');
    body.className = 'card-body';
    const title = document.createElement('h5');
    title.className = 'mb-2';
    title.textContent = favorite.place.name;
    body.appendChild(title);
    renderFeatureBadges(body.appendChild(document.createElement('div')), favorite.place.features || [], { flags: favorite.place.accessibilityFlags });
    const meta = document.createElement('small');
    meta.className = 'text-muted';
    meta.textContent = `Adicionado em ${formatDate(favorite.addedAt)}`;
    body.appendChild(meta);
    card.appendChild(body);
    container.appendChild(card);
  }

  function renderProfileReviewCard(container, review) {
    const card = document.createElement('div');
    card.className = 'card border-0 shadow-sm mb-3';
    const body = document.createElement('div');
    body.className = 'card-body';
    const title = document.createElement('h5');
    title.className = 'mb-1';
    title.textContent = review.place?.name || 'Local';
    body.appendChild(title);
    const ratingWrap = document.createElement('div');
    ratingWrap.className = 'mb-2';
    renderStars(ratingWrap, review.rating);
    body.appendChild(ratingWrap);
    if (review.comment) {
      const comment = document.createElement('p');
      comment.textContent = review.comment;
      body.appendChild(comment);
    }
    const meta = document.createElement('small');
    meta.className = 'text-muted';
    meta.textContent = formatDate(review.createdAt);
    body.appendChild(meta);
    card.appendChild(body);
    container.appendChild(card);
  }

  async function initPerfil() {
    const profileRoot = document.getElementById('profileRoot');
    if (!profileRoot) return;
    const token = getToken();
    if (!token) {
      window.location.href = 'login.html';
      return;
    }
    const loading = document.getElementById('profileLoading');
    loading?.classList.remove('d-none');

    try {
      const me = await apiRequest(ENDPOINTS.me);
      const fullName = [me.name, me.surname].filter(Boolean).join(' ') || me.email;
      document.getElementById('profileName')?.replaceChildren(document.createTextNode(fullName));
      document.getElementById('navbarUserName')?.replaceChildren(document.createTextNode(fullName));
      document.getElementById('profileMemberSince')?.replaceChildren(document.createTextNode(formatDate(me.createdAt)));
      document.getElementById('profileStatsPlaces')?.replaceChildren(document.createTextNode(me.stats?.places ?? 0));
      document.getElementById('profileStatsReviews')?.replaceChildren(document.createTextNode(me.stats?.reviews ?? 0));
      document.getElementById('profileStatsFavorites')?.replaceChildren(document.createTextNode(me.stats?.favorites ?? 0));

      renderCardList('profilePlacesList', me.places, renderProfilePlaceCard, 'Voce ainda nao cadastrou locais.');
      renderCardList('profileFavoritesList', me.favorites, renderProfileFavoriteCard, 'Nenhum favorito cadastrado.');
      renderCardList('profileReviewsList', me.reviews, renderProfileReviewCard, 'Nenhuma avaliacao registrada.');

      const activity = buildActivityFeed(me);
      const activityContainer = document.getElementById('profileActivityList');
      if (activityContainer) {
        activityContainer.innerHTML = '';
        if (!activity.length) {
          const empty = document.createElement('p');
          empty.className = 'text-muted';
          empty.textContent = 'Nenhuma atividade recente.';
          activityContainer.appendChild(empty);
        } else {
          activity.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'card border-0 shadow-sm mb-3';
            const body = document.createElement('div');
            body.className = 'card-body';
            const title = document.createElement('p');
            title.className = 'mb-1';
            if (item.link) {
              const anchor = document.createElement('a');
              anchor.href = item.link;
              anchor.textContent = item.title;
              title.appendChild(anchor);
            } else {
              title.textContent = item.title;
            }
            body.appendChild(title);
            const meta = document.createElement('small');
            meta.className = 'text-muted';
            meta.textContent = formatDate(item.date);
            body.appendChild(meta);
            card.appendChild(body);
            activityContainer.appendChild(card);
          });
        }
      }

      setSession(getToken(), me);
      applySessionToNav(me);
      bindLogoutHandlers();
    } catch (err) {
      console.error('[perfil] erro', err);
      showAlert(profileRoot, 'danger', err.data?.error || 'Erro ao carregar perfil.');
    } finally {
      loading?.classList.add('d-none');
    }
  }

})();





