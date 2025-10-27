(function (App) {
  if (!App) return;

  const {
    onReady,
    ensureFeatureLabels,
    apiRequest,
    ENDPOINTS,
    FEATURE_GROUP_FILTERS,
    renderFeatureBadges,
    placeTypeLabel,
    renderStars,
    truncateText,
    resolveMediaUrl,
    showAlert
  } = App;

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

  async function loadPlaces() {
    const spinner = document.getElementById('resultsLoading');
    if (spinner) spinner.classList.remove('d-none');
    try {
      await ensureFeatureLabels();
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

  onReady(() => {
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
  });
})(window.App);
