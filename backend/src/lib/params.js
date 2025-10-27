export function parsePlaceId(req, res) {
  const placeId = Number(req.params.id);
  if (!Number.isFinite(placeId)) {
    res.status(400).json({ error: 'Identificador inválido.' });
    return null;
  }
  return placeId;
}
