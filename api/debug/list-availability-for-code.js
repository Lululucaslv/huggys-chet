export default async function handler(req, res) {
  res.status(404).json({ error: 'not_found' })
}
