'use strict';
const $ = id => document.getElementById(id);
let articles = [], selected = null, format = 'portrait', imageReady = false, loading = false, generation = 0, toastTimer, activeObjectURL, imagePosition={x:50,y:50};
const dimensions = {portrait:[1080,1350],square:[1080,1080],landscape:[1080,565],story:[1080,1920]};
function toast(message) { $('toast').textContent=message; $('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5500); }
function scale() {
 const [w,h]=dimensions[format];const panelHeight=document.querySelector('.controls').getBoundingClientRect().height;document.documentElement.style.setProperty('--panel-space',(panelHeight+48)+'px');const width=Math.max(1,Math.min(innerWidth-100,520,Math.max(120,(window.visualViewport?.height||innerHeight)-panelHeight-140)*w/h));
 $('previewWrapper').style.width=width+'px';$('previewWrapper').style.height=width*h/w+'px';
 $('postCard').style.width=w+'px';$('postCard').style.height=h+'px';$('postCard').style.transform=`scale(${width/w})`;
}
function coverCrop(sourceWidth, sourceHeight, targetWidth, targetHeight, x=50, y=50) {
 const ratio=Math.max(targetWidth/sourceWidth,targetHeight/sourceHeight);
 const width=Math.min(sourceWidth,targetWidth/ratio),height=Math.min(sourceHeight,targetHeight/ratio);
 return [(sourceWidth-width)*x/100,(sourceHeight-height)*y/100,width,height];
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
function theme(hex){
 $('postCard').style.backgroundColor=hex;$('bgColor').value=hex;
 $('hexColour').value=hex;$('hexColour').setCustomValidity('');
 $('colourSwatch').style.background=hex;$('colourPreview').style.background=hex;
 const [h,s,l]=hexToHsl(hex);$('hue').value=h;$('saturation').value=s;$('lightness').value=l;
 $('hueValue').textContent=Math.round(h)+'°';$('satValue').textContent=Math.round(s)+'%';$('lightValue').textContent=Math.round(l)+'%';
 $('saturation').style.background='linear-gradient(to right,hsl('+h+' 0% 50%),hsl('+h+' 100% 50%))';
 $('lightness').style.background='linear-gradient(to right,#000,hsl('+h+' '+s+'% 50%),#fff)';
}
function hexToHsl(hex){
 const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;
 let h=0,s=0;if(d){s=d/(1-Math.abs(2*l-1));h=(max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4)*60;}return [h,s*100,l*100];
}
function hslToHex(h,s,l){
 s/=100;l/=100;const a=s*Math.min(l,1-l);
 return '#'+[0,8,4].map(n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');}).join('');
}
function positionImage(){
 imagePosition={x:Number($('imageX').value),y:Number($('imageY').value)};
 $('previewImage').style.objectPosition=imagePosition.x+'% '+imagePosition.y+'%';
 $('xValue').textContent=imagePosition.x+'%';$('yValue').textContent=imagePosition.y+'%';
}
$('imageX').oninput=positionImage;$('imageY').oninput=positionImage;
$('resetPosition').onclick=()=>{$('imageX').value=50;$('imageY').value=50;positionImage();};
function colourPanel(open){$('colourPanel').hidden=!open;$('colourTrigger').setAttribute('aria-expanded',String(open));}
$('colourTrigger').onclick=()=>colourPanel($('colourPanel').hidden);
$('closeColour').onclick=()=>colourPanel(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape')colourPanel(false);});
document.addEventListener('click',e=>{if(!e.target.closest('#colourPanel,#colourTrigger'))colourPanel(false);});
for(const id of ['hue','saturation','lightness'])$(id).oninput=()=>theme(hslToHex(Number($('hue').value),Number($('saturation').value),Number($('lightness').value)));
$('hexColour').oninput=e=>{const value=e.target.value;if(/^#[0-9a-f]{6}$/i.test(value))theme(value.toLowerCase());else e.target.setCustomValidity('Enter a six-digit hex colour, such as #163a4d');};
for(const button of document.querySelectorAll('[data-colour]')){button.style.background=button.dataset.colour;button.onclick=()=>theme(button.dataset.colour);}
$('panelMatch').onclick=matchColour;theme('#163a4d');positionImage();
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
 $('imageX').value=50;$('imageY').value=50;positionImage();const ticket=++generation;imageReady=false;$('download').disabled=true;$('previewImage').style.display='none';$('previewImage').removeAttribute('src');$('imageHint').style.display='grid';$('imageHint').textContent='Loading cover…';
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
 selected=article;$('previewTitle').textContent=article.title;$('previewDate').textContent=dateLabel(article.date);$('articleDialog').close();
 await setImage(article.image); // Image endpoint re-fetches the page and fresh Notion file URL.
}
function openArticlePicker() {
 if(!$('articleDialog').open)$('articleDialog').showModal();
 if(!articles.length&&!loading)loadArticles();
 $('search').focus();
}
$('openArticles').onclick=openArticlePicker;
$('posterSearch').onclick=openArticlePicker;
const preferredMode=window.matchMedia('(prefers-color-scheme: dark)');
let savedMode=null;
try{savedMode=localStorage.getItem('lagos-meet-mode');}catch{}
function applyMode(mode) {
 document.documentElement.dataset.mode=mode;
 const dark=mode==='dark';
 $('modeToggle').textContent=dark?'Light mode':'Dark mode';
 $('modeToggle').setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');
 $('modeToggle').setAttribute('aria-pressed',String(dark));
}
applyMode(savedMode==='light'||savedMode==='dark'?savedMode:preferredMode.matches?'dark':'light');
$('modeToggle').onclick=()=>{
 savedMode=document.documentElement.dataset.mode==='dark'?'light':'dark';
 applyMode(savedMode);try{localStorage.setItem('lagos-meet-mode',savedMode);}catch{}
};
preferredMode.addEventListener('change',event=>{if(!savedMode)applyMode(event.matches?'dark':'light');});
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
    crop.getContext('2d').drawImage(source,...coverCrop(source.naturalWidth,source.naturalHeight,crop.width,crop.height,imagePosition.x,imagePosition.y),0,0,crop.width,crop.height);
    image.replaceWith(crop);
   }});
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG export failed');
  const link=document.createElement('a');const url=URL.createObjectURL(blob);link.href=url;link.download=`LagosMeet-${format}-${selected?.id||Date.now()}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('Poster exported');
 }catch(error){toast(error.message);}finally{button.disabled=!imageReady;button.textContent='Export PNG';}
};
new ResizeObserver(scale).observe(document.querySelector('.controls'));
window.visualViewport?.addEventListener('resize',scale);
window.addEventListener('resize',scale);document.fonts.ready.then(scale);scale();
