export const fields = { title: 'Title of Story', date: 'Date of Publication', image: 'Cover Image', status: 'Status' };
export const dayInLagos = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone:'Africa/Lagos', year:'numeric', month:'2-digit', day:'2-digit' }).format(date);
export function text(property) {
  if (!property) return '';
  return (property.title || property.rich_text || []).map(x => x.plain_text ?? x.text?.content ?? '').join('').trim();
}
export function cover(page) {
  const p = page.properties?.[fields.image];
  const f = p?.files?.[0];
  return f?.file?.url || f?.external?.url || p?.url || '';
}
export function eligible(page, today = dayInLagos()) {
  const p = page.properties || {};
  const date = p[fields.date]?.date?.start;
  if (!date || !Number.isFinite(Date.parse(date))) return false;
  const dateDay = date.length === 10 ? date : dayInLagos(new Date(date));
  return !page.archived && !page.in_trash && !page.is_archived &&
    (p[fields.status]?.status?.name || p[fields.status]?.select?.name) === 'Published' &&
    !!text(p[fields.title]) && !!cover(page) && dateDay <= today;
}
export async function notion(path, body) {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error('Set NOTION_TOKEN in Netlify environment variables, then redeploy.');
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch('https://api.notion.com/v1/' + path, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Notion-Version':'2025-09-03', 'Content-Type':'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(12000)
    });
    if (response.status === 429 && attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, Math.min(Number(response.headers.get('retry-after') || 1), 3) * 1000));
      continue;
    }
    const data = await response.json();
    if (!response.ok) throw new Error(`Notion ${response.status}: ${data.message || 'Request failed'}`);
    return data;
  }
}
export const cleanId = id => (id || '').replaceAll('-', '').toLowerCase();
export async function sourceId() {
  if (process.env.NOTION_DATA_SOURCE_ID) return process.env.NOTION_DATA_SOURCE_ID;
  if (!process.env.NOTION_DATABASE_ID) throw new Error('Set NOTION_DATABASE_ID in Netlify environment variables, then redeploy.');
  const db = await notion(`databases/${process.env.NOTION_DATABASE_ID}`);
  if (db.data_sources?.length !== 1) throw new Error('Set NOTION_DATA_SOURCE_ID: this database has multiple data sources.');
  return db.data_sources[0].id;
}
export function json(data, status = 200) {
  return Response.json(data, { status, headers:{'Cache-Control':'no-store'} });
}
