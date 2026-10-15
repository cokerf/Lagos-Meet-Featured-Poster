import { notion, sourceId, eligible, cover, cleanId, json } from '../../lib/notion.mjs';
const allowed = hostname => {
  const extra = (process.env.IMAGE_ALLOWED_HOSTS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  return ['prod-files-secure.s3.us-west-2.amazonaws.com','s3.us-west-2.amazonaws.com','secure.notion-static.com','www.notion.so','images.unsplash.com','ik.imagekit.io',...extra].includes(hostname);
};
export default async request => {
  if (request.method !== 'GET') return json({error:'Method not allowed'},405);
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!/^[a-f0-9-]{32,36}$/i.test(id || '')) return json({error:'Invalid article ID'},400);
    const page = await notion(`pages/${id}`);
    const source = await sourceId();
    if (cleanId(page.parent?.data_source_id) !== cleanId(source) || !eligible(page)) return json({error:'Article is unavailable'},404);
    let url = new URL(cover(page));
    let image;
    for (let redirects = 0; redirects < 4; redirects++) {
      if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !allowed(url.hostname)) {
        return json({error:'Image host is not allowed. Add its exact hostname to IMAGE_ALLOWED_HOSTS in Netlify.'},422);
      }
      image = await fetch(url, {redirect:'manual',signal:AbortSignal.timeout(15000)});
      if ([301,302,303,307,308].includes(image.status)) {
        const location = image.headers.get('location');
        if (!location) throw new Error('Invalid image redirect');
        url = new URL(location,url); image = null; continue;
      }
      break;
    }
    if (!image?.ok) throw new Error('Unable to download the cover image');
    const type = (image.headers.get('content-type') || '').split(';')[0];
    if (!['image/jpeg','image/png','image/webp','image/gif','image/avif'].includes(type)) return json({error:'Cover must be PNG, JPEG, WebP, GIF or AVIF'},422);
    const limit = 4 * 1024 * 1024;
    const reader = image.body.getReader(); const chunks = []; let length = 0;
    while (true) {
      const {done,value} = await reader.read(); if (done) break;
      length += value.length;
      if (length > limit) { await reader.cancel(); return json({error:'Cover exceeds 4 MB. Upload a smaller image to Notion.'},413); }
      chunks.push(value);
    }
    return new Response(Buffer.concat(chunks), {headers:{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  } catch(e) {return json({error:e.message},502);}
};

