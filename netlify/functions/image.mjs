import { notion, sourceId, eligible, cover, cleanId, json } from '../../lib/notion.mjs';

// Only follow signed Notion media URLs and explicitly configured trusted hosts.
const allowed = hostname => {
  const extra = (process.env.IMAGE_ALLOWED_HOSTS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  return [
    'prod-files-secure.s3.us-west-2.amazonaws.com',
    's3.us-west-2.amazonaws.com',
    'secure.notion-static.com',
    'www.notion.so',
    'notion.so',
    'images.unsplash.com',
    'ik.imagekit.io',
    'file.notion.so',
    'prod-files-secure.s3.us-east-1.amazonaws.com',
    's3.us-east-1.amazonaws.com',
    ...extra
  ].includes(hostname);
};
const isMedia = type => type.startsWith('image/') || type.startsWith('video/');
export default async request => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return json({error:'Method not allowed'},405);
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!/^[a-f0-9-]{32,36}$/i.test(id || '')) return json({error:'Invalid article ID'},400);
    const page = await notion(`pages/${id}`);
    const source = await sourceId();
    if (cleanId(page.parent?.data_source_id) !== cleanId(source) || !eligible(page)) return json({error:'Article is unavailable'},404);
    let url = new URL(cover(page));
    let media;
    const range = request.headers.get('range');
    for (let redirects = 0; redirects < 6; redirects++) {
      if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !allowed(url.hostname)) {
        return json({error:'Media host is not allowed. Add its exact hostname to IMAGE_ALLOWED_HOSTS in Netlify.'},422);
      }
      media = await fetch(url, {
        method:'GET',
        redirect:'manual',
        headers: range && /^bytes=\d*-\d*$/.test(range) ? {Range:range} : {},
        signal:AbortSignal.timeout(30000)
      });
      if ([301,302,303,307,308].includes(media.status)) {
        const location = media.headers.get('location');
        if (!location) throw new Error('Invalid media redirect');
        url = new URL(location,url);media = null;continue;
      }
      break;
    }
    if (!media?.ok) throw new Error('Unable to download the cover media');
    const type = (media.headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (!isMedia(type)) return json({error:'Cover must be an image or video'},422);
    const headers = new Headers({
      'Content-Type':type,
      'Cache-Control':'private, no-store',
      'X-Content-Type-Options':'nosniff'
    });
    for (const key of ['content-length','content-range','accept-ranges']) {
      const value = media.headers.get(key);
      if (value) headers.set(key,value);
    }
    // Stream the original asset: never impose a 4 MB cap or buffer it in memory.
    if(request.method === 'HEAD') { await media.body?.cancel(); return new Response(null,{status:media.status,headers}); }
    return new Response(media.body, {status:media.status,headers});
  } catch(e) {return json({error:e.message},502);}
};
