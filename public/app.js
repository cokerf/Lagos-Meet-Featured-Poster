'use strict';
const $ = id => document.getElementById(id);
let articles = [], selected = null, format = 'portrait', imageReady = false, loading = false, generation = 0, toastTimer, activeObjectURL;
const dimensions = {portrait:[1080,1350],square:[1080,1080],landscape:[1080,565],story:[1080,1920]};
function toast(message) { $('toast').textContent=message; $('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5500); }
function scale() {
 const [w,h]=dimensions[format];const width=Math.min(innerWidth-32,520,(Math.max(220,innerHeight-220))*w/h);
 $('previewWrapper').style.width=width+'px';$('previewWrapper').style.height=width*h/w+'px';
 $('postCard').style.width=w+'px';$('postCard').style.height=h+'px';$('postCard').style.transform=`scale(${width/w})`;
}
function coverCrop(sourceWidth, sourceHeight, targetWidth, targetHeight) {
 const ratio=Math.max(targetWidth/sourceWidth,targetHeight/sourceHeight);
 const width=Math.min(sourceWidth,targetWidth/ratio),height=Math.min(sourceHeight,targetHeight/ratio);
 return [(sourceWidth-width)/2,(sourceHeight-height)/2,width,height];
}
function dateLabel(date) {return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Lagos'}).format(new Date(date.length===10?date+'T12:00:00+01:00':date));}
function renderArticles() {
 const query=$('search').value.trim().toLocaleLowerCase(); const matches=articles.filter(a=>a.title.toLocaleLowerCase().includes(query));
 $('articleList').replaceChildren();
 for(const article of matches) {
  const button=document.createElement('button');button.className='article-row';
  const title=document.createElement('span');title.textContent=article.title;
  const date=document.createElement('small');date.textContent=dateLabel(article.date);
  button.append(title,date);button.onclick=()=>selectArticle(article);$('articleList').append(button);
 }
 if(!loading) $('loadStatus').textContent=matches.length ? `${matches.length} eligible article${matches.length===1?'':'s'}` : 'No eligible articles match. Check the required fields in Notion.';
}
async function loadArticles() {
 if(loading)return;loading=true;articles=[];renderArticles();$('refresh').disabled=true;
 try {
  let cursor=null;
  do {
   $('loadStatus').textContent=`Loading from Notion… ${articles.length} eligible articles found`;
   const response=await fetch('/.netlify/functions/articles'+(cursor?'?cursor='+encodeURIComponent(cursor):''),{cache:'no-store'});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to load articles');
   articles.push(...data.articles);cursor=data.nextCursor;renderArticles();
  }while(cursor);
  loading=false;renderArticles();
 }catch(error){$('loadStatus').textContent=error.message;loading=false;}
 finally{$('refresh').disabled=false;}
}
function theme(hex){$('postCard').style.backgroundColor=hex;$('bgColor').value=hex;}
function matchColour() {
 if(!imageReady)return;
 try {
  const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage($('previewImage'),0,0,32,32);
  const pixels=ctx.getImageData(0,0,32,32).data;let best=[22,58,77],score=-1;
  for(let i=0;i<pixels.length;i+=16){const rgb=[pixels[i],pixels[i+1],pixels[i+2]];const light=rgb.reduce((a,b)=>a+b,0)/3;const saturation=Math.max(...rgb)-Math.min(...rgb);const s=saturation-(Math.abs(light-95)*.5);if(s>score){score=s;best=rgb;}}
  theme('#'+best.map(x=>x.toString(16).padStart(2,'0')).join(''));
 }catch{toast('Could not sample this image. Choose a colour manually.');}
}
async function setImage(src) {
 const ticket=++generation;imageReady=false;$('download').disabled=true;$('previewImage').style.display='none';$('previewImage').removeAttribute('src');$('imageHint').style.display='grid';$('imageHint').textContent='Loading cover…';
 try {
  let blob;
  if(src instanceof Blob)blob=src;
  else {const response=await fetch(src,{cache:'no-store'});if(!response.ok){let data;try{data=await response.json();}catch{}throw new Error(data?.error||'Cover image failed to load');}blob=await response.blob();}
  const objectURL=URL.createObjectURL(blob);const image=new Image();
  try {image.src=objectURL;await image.decode();if(ticket!==generation)return;
   if(activeObjectURL)URL.revokeObjectURL(activeObjectURL);activeObjectURL=objectURL;$('previewImage').src=objectURL;await $('previewImage').decode();$('previewImage').style.display='block';$('imageHint').style.display='none';imageReady=true;$('download').disabled=false;matchColour();
  }finally{if(activeObjectURL!==objectURL)URL.revokeObjectURL(objectURL);}
 }catch(error){if(ticket!==generation)return;$('imageHint').textContent=error.message;toast(error.message);}
}
async function selectArticle(article) {
 selected=article;$('previewTitle').textContent=article.title;$('previewDate').textContent=dateLabel(article.date);$('selected').textContent=article.title;$('articleDialog').close();
 await setImage(article.image); // Image endpoint re-fetches the page and fresh Notion file URL.
}
$('openArticles').onclick=()=>{$('articleDialog').showModal();if(!articles.length&&!loading)loadArticles();$('search').focus();};
$('closeArticles').onclick=()=>$('articleDialog').close();$('refresh').onclick=loadArticles;$('search').oninput=renderArticles;
for(const button of document.querySelectorAll('[data-format]'))button.onclick=()=>{format=button.dataset.format;$('postCard').className=format;for(const b of document.querySelectorAll('[data-format]'))b.setAttribute('aria-pressed',String(b===button));scale();};
$('bgColor').oninput=event=>theme(event.target.value);$('autoColor').onclick=matchColour;
$('uploadBtn').onclick=()=>$('imageUpload').click();$('artworkContainer').ondblclick=()=>$('imageUpload').click();
$('postCard').ondblclick=event=>{if(event.target===$('postCard'))$('bgColor').click();};
$('imageUpload').onchange=event=>{const file=event.target.files[0];if(file)setImage(file);event.target.value='';};
window.addEventListener('dragover',event=>event.preventDefault());window.addEventListener('drop',event=>{event.preventDefault();const file=event.dataTransfer.files[0];if(file?.type.startsWith('image/'))setImage(file);});
$('download').onclick=async()=>{
 if(!imageReady)return;const button=$('download');button.disabled=true;button.textContent='Exporting…';document.activeElement?.blur();
 try {
  if(!window.html2canvas)throw new Error('Export library did not load. Check your connection and reload.');
  await document.fonts.ready;await $('previewImage').decode();const [width,height]=dimensions[format];
  const canvas=await html2canvas($('postCard'),{scale:1,width,height,useCORS:true,allowTaint:false,logging:false,
   onclone:doc=>{
    const card=doc.getElementById('postCard');card.style.transform='none';card.classList.add('is-exporting');
    for(const id of ['previewTitle','previewDate']){
     const element=doc.getElementById(id);element.style.color='#000000';element.style.webkitTextFillColor='#000000';
    }
    // html2canvas ignores object-fit. Draw a centered cover crop using source pixels.
    const frame=doc.getElementById('artworkContainer');
    const source=$('previewImage'),image=doc.getElementById('previewImage');
    const crop=doc.createElement('canvas');
    crop.width=Math.max(1,Math.round(frame.clientWidth));crop.height=Math.max(1,Math.round(frame.clientHeight));
    crop.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;';
    crop.getContext('2d').drawImage(source,...coverCrop(source.naturalWidth,source.naturalHeight,crop.width,crop.height),0,0,crop.width,crop.height);
    image.replaceWith(crop);
   }});
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG export failed');
  const link=document.createElement('a');const url=URL.createObjectURL(blob);link.href=url;link.download=`LagosMeet-${format}-${selected?.id||Date.now()}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('Poster exported');
 }catch(error){toast(error.message);}finally{button.disabled=!imageReady;button.textContent='Export PNG';}
};
window.addEventListener('resize',scale);document.fonts.ready.then(scale);scale();
