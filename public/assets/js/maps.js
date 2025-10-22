// Leaflet helper to bootstrap maps declared with data-map=\"true\"
(function () {
  function parseLatLng(el) {
    const lat = parseFloat(el.getAttribute('data-center-lat'));
    const lng = parseFloat(el.getAttribute('data-center-lng'));
    return {
      lat: Number.isFinite(lat) ? lat : 0,
      lng: Number.isFinite(lng) ? lng : 0
    };
  }

  function initElement(el) {
    if (!window.L || el.dataset.leafletInitialized === 'true') {
      return;
    }
    const { lat, lng } = parseLatLng(el);
    const zoom = parseInt(el.getAttribute('data-zoom') || '13', 10);
    const map = window.L
      .map(el, { scrollWheelZoom: false })
      .setView([lat, lng], Number.isFinite(zoom) ? zoom : 13);

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    let marker = null;
    if (el.getAttribute('data-marker') === 'true') {
      marker = window.L.marker([lat, lng]).addTo(map);
    }

    el.dataset.leafletInitialized = 'true';
    el._leafletMap = map;
    el._leafletMarker = marker;
  }

  function initAll() {
    const elements = Array.from(document.querySelectorAll('[data-map=\"true\"]'));
    if (!elements.length) {
      return;
    }
    if (!window.L) {
      console.warn('[Maps] Leaflet nao carregado. Certifique-se de incluir o script antes de assets/js/maps.js.');
      return;
    }
    elements.forEach(initElement);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  window.Maps = {
    initAll,
    initElement,
    setMarker(el, lat, lng, options = {}) {
      if (!el?._leafletMap || !window.L || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }
      const map = el._leafletMap;
      if (!el._leafletMarker) {
        el._leafletMarker = window.L.marker([lat, lng]).addTo(map);
      } else {
        el._leafletMarker.setLatLng([lat, lng]);
      }
      if (options.pan !== false) {
        map.setView([lat, lng], options.zoom ?? map.getZoom());
      }
      if (options.invalidate !== false && typeof map.invalidateSize === 'function') {
        setTimeout(() => map.invalidateSize(), 0);
      }
      return el._leafletMarker;
    }
  };
})();
