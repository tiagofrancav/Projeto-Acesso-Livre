export const FEATURE_LABELS = {
  ramp_access: 'Rampa de acesso',
  elevator: 'Elevador',
  accessible_bathroom: 'Banheiro adaptado',
  reserved_parking: 'Vagas especiais',
  tactile_floor: 'Piso tátil',
  braille_signage: 'Sinalização em braile',
  audio_description: 'Audiodescrição',
  libras_staff: 'Funcionários treinados em Libras',
  subtitles: 'Legendas / Closed Caption',
  visual_signage: 'Sinalização visual',
  priority_service: 'Atendimento prioritário',
  wheelchair_available: 'Cadeira de rodas disponível',
  accessible_parking: 'Estacionamento acessível'
};

export const FEATURE_KEYS = Object.keys(FEATURE_LABELS);

export function getFeatureEntries() {
  return FEATURE_KEYS.map((key) => ({ key, label: FEATURE_LABELS[key] }));
}

export function buildAccessibilityFlags(selectedKeys = []) {
  return FEATURE_KEYS.reduce((acc, key) => {
    acc[key] = selectedKeys.includes(key);
    return acc;
  }, {});
}
