export function average(values = []) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(2));
}

export function digitsOnly(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\D/g, '');
}

export function normalizeCep(value) {
  const digits = digitsOnly(value).slice(0, 8);
  return digits.length === 8 ? digits : null;
}

export function formatCep(value) {
  const digits = normalizeCep(value);
  if (!digits) return null;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function buildFullAddress({ street, number, complement, neighborhood, city, state, cep }) {
  const parts = [];
  const streetLine = street ? (number ? `${street}, ${number}` : street) : '';
  if (streetLine) parts.push(streetLine);
  if (complement) parts.push(complement);
  if (neighborhood) parts.push(neighborhood);
  const cityState = [city, state].filter(Boolean).join(' - ');
  if (cityState) parts.push(cityState);
  if (cep) {
    const formatted = formatCep(cep);
    if (formatted) parts.push(`CEP ${formatted}`);
  }
  return parts.join(' | ');
}

export function toFloat(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseFeatureKeys(raw = []) {
  if (!raw) return [];
  const values = Array.isArray(raw) ? raw : [raw];
  const keys = values
    .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(keys));
}

export function mapFeature(featureRelation) {
  if (!featureRelation?.feature) return null;
  const { feature } = featureRelation;
  return { key: feature.key, label: feature.label };
}

export function mapPhoto(photo) {
  if (!photo) return null;
  return { id: photo.id, url: photo.url };
}
