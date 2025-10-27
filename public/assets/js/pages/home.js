(function (App) {
  if (!App) return;

  const {
    onReady,
    ensureFeatureLabels,
    apiRequest,
    ENDPOINTS,
    renderFeatureBadges,
    renderStars,
    resolveMediaUrl,
    truncateText,
    placeTypeLabel,
    showAlert
  } = App;

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
        placeholder.textContent = 'Sem foto disponível';
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

  onReady(async () => {
    const container = document.getElementById('recentPlaces');
    if (!container) return;
    await ensureFeatureLabels();
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
  });
})(window.App);
