import { notion, sourceId, eligible, text, fields, json } from '../../lib/notion.mjs';
export default async request => {
  if (request.method !== 'GET') return json({error:'Method not allowed'},405);
  try {
    const id = await sourceId();
    // Server-side date filter reduces pagination; final checks handle rich-text/title
    // and status/select property variations without guessing from a CSV export.
    const data = await notion(`data_sources/${id}/query`, {
      page_size:100,
      ...(new URL(request.url).searchParams.get('cursor') ? {start_cursor:new URL(request.url).searchParams.get('cursor')} : {}),
      filter:{ property:fields.date, date:{is_not_empty:true} },
      sorts:[{property:fields.date,direction:'descending'}]
    });
    return json({articles:data.results.filter(p => eligible(p)).map(p => ({
      id:p.id, title:text(p.properties[fields.title]), date:p.properties[fields.date].date.start,
      image:`/.netlify/functions/image?id=${encodeURIComponent(p.id)}`
    })), nextCursor:data.has_more ? data.next_cursor : null});
  } catch(e) { return json({error:e.message},502); }
};
