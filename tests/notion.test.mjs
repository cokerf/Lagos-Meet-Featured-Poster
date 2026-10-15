import test from 'node:test';
import assert from 'node:assert/strict';
import {eligible, text, dayInLagos} from '../lib/notion.mjs';
import articlesHandler from '../netlify/functions/articles.mjs';
const page = () => ({id:'12345678-1234-1234-1234-123456789012',properties:{
 'Title of Story':{rich_text:[{plain_text:'A story'}]},
 'Date of Publication':{date:{start:'2026-10-15'}},
 'Cover Image':{files:[{file:{url:'https://prod-files-secure.s3.us-west-2.amazonaws.com/cover.jpg'}}]},
 Status:{status:{name:'Published'}}
}});
test('accepts full published article and rejects each missing required field',()=>{
 assert.equal(eligible(page(),'2026-10-15'),true);
 for(const name of ['Title of Story','Date of Publication','Cover Image','Status']){const p=page();delete p.properties[name];assert.equal(eligible(p,'2026-10-15'),false,name);}
});
test('rejects drafts, future dates, invalid dates and archived pages',()=>{
 for(const change of [p=>p.properties.Status.status.name='Draft',p=>p.properties['Date of Publication'].date.start='2026-10-16',p=>p.properties['Date of Publication'].date.start='invalid',p=>p.archived=true]){const p=page();change(p);assert.equal(eligible(p,'2026-10-15'),false);}
});
test('supports title and select types; handles Lagos midnight',()=>{
 const p=page();p.properties['Title of Story']={title:[{plain_text:'Title'}]};p.properties.Status={select:{name:'Published'}};
 assert.equal(text(p.properties['Title of Story']),'Title');assert.equal(eligible(p,'2026-10-15'),true);
 assert.equal(dayInLagos(new Date('2026-10-14T23:30:00Z')),'2026-10-15');
});
test('API screens rows, passes cursor and never returns private properties or signed image URLs',async()=>{
 const original=globalThis.fetch;process.env.NOTION_TOKEN='test';process.env.NOTION_DATA_SOURCE_ID='source';
 const valid=page();valid.properties.Email={email:'private@example.com'};const draft=page();draft.properties.Status.status.name='Draft';
 globalThis.fetch=async(url,options)=>{assert.ok(url.endsWith('/data_sources/source/query'));assert.equal(JSON.parse(options.body).start_cursor,'next');return Response.json({results:[valid,draft],has_more:true,next_cursor:'more'});};
 try{const response=await articlesHandler(new Request('https://example.com/.netlify/functions/articles?cursor=next'));const data=await response.json();assert.equal(data.articles.length,1);assert.equal(data.nextCursor,'more');assert.deepEqual(Object.keys(data.articles[0]),['id','title','date','image']);assert.ok(!JSON.stringify(data).includes('private@example.com'));assert.ok(!JSON.stringify(data).includes('amazonaws'));}
 finally{globalThis.fetch=original;delete process.env.NOTION_TOKEN;delete process.env.NOTION_DATA_SOURCE_ID;}
});
