// Global app configuration for frontend
// Ajuste apiBaseUrl conforme o ambiente do backend
window.APP_CONFIG = window.APP_CONFIG || {};

window.APP_CONFIG.apiBaseUrl = window.APP_CONFIG.apiBaseUrl || 'http://localhost:3000';

// Configure geocodificacao para o mapa. Informe seu token Mapbox diretamente aqui
// ou defina window.APP_CONFIG.geocoding antes de carregar este script.
window.APP_CONFIG.geocoding = window.APP_CONFIG.geocoding || {
  provider: 'mapbox',
  mapboxAccessToken: 'pk.eyJ1IjoidGlhZ29mcmFuY2F2IiwiYSI6ImNtaDNyMGJ6NDFqNGlqMHExYzF2bzdyOHMifQ.laLJ1v74gpdbc6qKDAhAKg'
};

