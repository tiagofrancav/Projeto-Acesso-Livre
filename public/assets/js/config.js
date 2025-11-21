// Global app configuration for frontend
// Ajuste apiBaseUrl conforme o ambiente do backend
window.APP_CONFIG = window.APP_CONFIG || {};

// Ordem de prioridade para a API (NÃO usar a origem do host estático, pois o front pode estar em outra porta):
// 1. window.APP_CONFIG.apiBaseUrl já definido antes de carregar este script.
// 2. window.API_BASE_URL (se setado via script inline).
// 3. localStorage.apiBaseUrl (útil em ambientes diferentes).
// 4. fallback para http://localhost:3000 (ajuste aqui se a API usar outra porta).
window.APP_CONFIG.apiBaseUrl =
  window.APP_CONFIG.apiBaseUrl ||
  window.API_BASE_URL ||
  window.localStorage?.getItem('apiBaseUrl') ||
  'http://localhost:3000';

// Configure geocodificacao para o mapa. Informe seu token Mapbox diretamente aqui
// ou defina window.APP_CONFIG.geocoding antes de carregar este script.
window.APP_CONFIG.geocoding = window.APP_CONFIG.geocoding || {
  provider: 'mapbox',
  mapboxAccessToken: 'pk.eyJ1IjoidGlhZ29mcmFuY2F2IiwiYSI6ImNtaDNyMGJ6NDFqNGlqMHExYzF2bzdyOHMifQ.laLJ1v74gpdbc6qKDAhAKg'
};

