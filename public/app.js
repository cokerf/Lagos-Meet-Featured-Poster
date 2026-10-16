'use strict';
const $ = id => document.getElementById(id);
let articleView='grid', articlePage=0;
let articles = [], selected = null, format = 'portrait', imageReady = false, loading = false, generation = 0, toastTimer, activeObjectURL, exporting=false, imageBackgroundEnabled=false, imagePosition={x:50,y:50};
const dimensions = {portrait:[1080,1350],square:[1080,1080],landscape:[1080,565],story:[1080,1920]};
function toast(message) { $('toast').textContent=message; $('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5500); }
function scale() {
 const [w,h]=dimensions[format];const panelHeight=document.querySelector('.controls').getBoundingClientRect().height;document.documentElement.style.setProperty('--panel-space',(panelHeight+48)+'px');const width=Math.max(1,Math.min(innerWidth-100,520,Math.max(120,(window.visualViewport?.height||innerHeight)-panelHeight-140)*w/h));
 $('previewWrapper').style.width=width+'px';$('previewWrapper').style.height=width*h/w+'px';
 $('postCard').style.width=w+'px';$('postCard').style.height=h+'px';$('postCard').style.transform=`scale(${width/w})`;
 clampHeadline();renderImageBackground();
}
function fitHeadlineText(text,fits){
 if(fits(text))return text;
 const words=text.trim().split(/\s+/);
 let low=0,high=words.length;
 while(low<high){const mid=Math.ceil((low+high)/2);if(fits(words.slice(0,mid).join(' ')+'…'))low=mid;else high=mid-1;}
 if(low)return words.slice(0,low).join(' ')+'…';
 const chars=Array.from(text);low=0;high=chars.length;
 while(low<high){const mid=Math.ceil((low+high)/2);if(fits(chars.slice(0,mid).join('')+'…'))low=mid;else high=mid-1;}
 return chars.slice(0,low).join('')+'…';
}
function clampHeadline(){
 const title=$('previewTitle');if(document.activeElement===title)return;
 const full=title.dataset.fullTitle??title.textContent.trim();title.dataset.fullTitle=full;
 const style=getComputedStyle(title),lines=format==='landscape'?2:format==='story'?4:3;
 const probe=document.createElement('div');
 Object.assign(probe.style,{position:'fixed',left:'-20000px',top:'0',visibility:'hidden',width:title.clientWidth+'px',fontFamily:style.fontFamily,fontSize:style.fontSize,fontWeight:style.fontWeight,lineHeight:style.lineHeight,letterSpacing:style.letterSpacing,overflowWrap:'anywhere',whiteSpace:'normal',padding:'0',margin:'0'});
 document.body.append(probe);
 try{
  const lineHeight=parseFloat(style.lineHeight);
  title.textContent=fitHeadlineText(full,candidate=>{probe.textContent=candidate;return probe.getBoundingClientRect().height<=lineHeight*lines+.5;});
 }finally{probe.remove();}
}
$('previewTitle').addEventListener('focus',()=>{
 const title=$('previewTitle');title.textContent=title.dataset.fullTitle??title.textContent;
});
$('previewTitle').addEventListener('blur',()=>{const title=$('previewTitle');title.dataset.fullTitle=title.textContent.trim();clampHeadline();});
function renderImageBackground(){
 const canvas=$('imageBackground');
 canvas.hidden=!imageBackgroundEnabled||!imageReady;
 if(canvas.hidden)return;
 const [width,height]=dimensions[format],w=Math.round(width/4),h=Math.round(height/4);
 if(canvas.width===w&&canvas.height===h&&canvas.dataset.source===activeObjectURL)return;
 canvas.width=w;canvas.height=h;canvas.dataset.source=activeObjectURL;
 const context=canvas.getContext('2d'),source=$('previewImage');
 // Bake the blur into pixels so html2canvas exports it without CSS-filter support.
 context.filter='blur(12px)';
 const ratio=Math.max(w/source.naturalWidth,h/source.naturalHeight)*1.24;
 const dw=source.naturalWidth*ratio,dh=source.naturalHeight*ratio;
 context.drawImage(source,(w-dw)/2,(h-dh)/2,dw,dh);
 context.filter='none';context.fillStyle='rgba(0,0,0,.22)';context.fillRect(0,0,w,h);
}
$('backgroundToggle').onclick=()=>{
 imageBackgroundEnabled=!imageBackgroundEnabled;
 $('backgroundToggle').setAttribute('aria-pressed',String(imageBackgroundEnabled));renderImageBackground();
};
function coverCrop(sourceWidth, sourceHeight, targetWidth, targetHeight, x=50, y=50) {
 const ratio=Math.max(targetWidth/sourceWidth,targetHeight/sourceHeight);
 const width=Math.min(sourceWidth,targetWidth/ratio),height=Math.min(sourceHeight,targetHeight/ratio);
 return [(sourceWidth-width)*x/100,(sourceHeight-height)*y/100,width,height];
}
function dateLabel(date) {return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Lagos'}).format(new Date(date.length===10?date+'T12:00:00+01:00':date));}
function storyPage(items,page,size=12){
 const count=Math.max(1,Math.ceil(items.length/size)),index=Math.max(0,Math.min(page,count-1));
 return {items:items.slice(index*size,(index+1)*size),index,count};
}
function renderArticles() {
 const query=$('search').value.trim().toLocaleLowerCase();
 const matches=articles.filter(a=>a.title.toLocaleLowerCase().includes(query));
 const paged=storyPage(matches,articlePage);articlePage=paged.index;
 const grid=articleView==='grid';
 $('articleDialog').classList.toggle('grid-dialog',grid);
 $('articleList').classList.toggle('story-grid',grid);
 $('articleList').replaceChildren();
 for(const article of (grid?paged.items:matches)) {
  const button=document.createElement('button');button.className=grid?'story-card':'article-row';
  if(grid){
   const cover=document.createElement('div');cover.className='story-cover';
   const fallback=document.createElement('span');fallback.textContent='Lagos Meet';fallback.className='cover-fallback';
   const image=document.createElement('img');image.src=article.image;image.alt='';image.loading='lazy';image.decoding='async';
   image.onerror=()=>{image.hidden=true;};cover.append(fallback,image);button.append(cover);
  }
  const title=document.createElement('span');title.className='story-title';title.textContent=article.title;
  const date=document.createElement('small');date.textContent=dateLabel(article.date);
  button.append(title,date);button.onclick=()=>selectArticle(article);$('articleList').append(button);
 }
 $('articlePages').hidden=!grid||matches.length===0;
 $('previousPage').disabled=articlePage===0;$('nextPage').disabled=articlePage>=paged.count-1;
 $('pageLabel').textContent='Page '+(articlePage+1)+' of '+paged.count;
 $('viewToggle').textContent=grid?'List view':'Grid view';
 $('viewToggle').setAttribute('aria-pressed',String(grid));
 if(!loading) $('loadStatus').textContent=matches.length ? matches.length+' eligible article'+(matches.length===1?'':'s') : 'No eligible articles match. Check the required fields in Notion.';
}
$('viewToggle').onclick=()=>{articleView=articleView==='grid'?'list':'grid';articlePage=0;renderArticles();};
function turnStoryPage(delta){articlePage+=delta;renderArticles();$('articleList').scrollIntoView({block:'start'});}
$('previousPage').onclick=()=>turnStoryPage(-1);$('nextPage').onclick=()=>turnStoryPage(1);
async function loadArticles(autoSelect=false) {
 if(loading)return;loading=true;articles=[];articlePage=0;renderArticles();$('refresh').disabled=true;
 try {
  let cursor=null;
  do {
   $('loadStatus').textContent=`Loading from Notion… ${articles.length} eligible articles found`;
   const response=await fetch('/.netlify/functions/articles'+(cursor?'?cursor='+encodeURIComponent(cursor):''),{cache:'no-store'});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to load articles');
   articles.push(...data.articles);cursor=data.nextCursor;renderArticles();
   // Results arrive newest publication date first, including across pages.
   if(autoSelect===true&&!selected&&data.articles.length)await selectArticle(data.articles[0]);
  }while(cursor);
  loading=false;renderArticles();
  if(autoSelect===true&&!selected){$('previewDate').textContent='No published story available';$('imageHint').textContent='Choose article to review available stories.';}
 }catch(error){$('loadStatus').textContent=error.message;loading=false;if(autoSelect===true&&!selected){$('previewDate').textContent='Could not load latest story';$('imageHint').textContent=error.message;toast(error.message);}}
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

}
$('imageX').oninput=positionImage;$('imageY').oninput=positionImage;

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
function showImageSliders(show) {
 for(const slider of document.querySelectorAll('.position-control'))slider.hidden=!show;
 $('artworkContainer').setAttribute('aria-expanded',String(show));
}
$('artworkContainer').addEventListener('click',()=>{if(imageReady&&!exporting)showImageSliders(true);});
$('artworkContainer').addEventListener('keydown',event=>{
 if((event.key==='Enter'||event.key===' ')&&imageReady&&!exporting){event.preventDefault();showImageSliders(true);}
});
document.addEventListener('click',event=>{if(!event.target.closest('#artworkContainer,.position-control'))showImageSliders(false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape')showImageSliders(false);});
async function setImage(src) {
 showImageSliders(false);
 $('imageX').value=50;$('imageY').value=50;positionImage();const ticket=++generation;imageReady=false;renderImageBackground();$('download').disabled=true;$('downloadVideo').disabled=true;$('previewImage').style.display='none';$('previewImage').removeAttribute('src');$('imageHint').style.display='grid';$('imageHint').textContent='Loading cover…';
 try {
  let blob;
  if(src instanceof Blob)blob=src;
  else {const response=await fetch(src,{cache:'no-store'});if(!response.ok){let data;try{data=await response.json();}catch{}throw new Error(data?.error||'Cover image failed to load');}blob=await response.blob();}
  const objectURL=URL.createObjectURL(blob);const image=new Image();
  try {image.src=objectURL;await image.decode();if(ticket!==generation)return;
   if(activeObjectURL)URL.revokeObjectURL(activeObjectURL);activeObjectURL=objectURL;$('previewImage').src=objectURL;await $('previewImage').decode();$('previewImage').style.display='block';$('imageHint').style.display='none';imageReady=true;renderImageBackground();$('download').disabled=false;$('downloadVideo').disabled=false;matchColour();
  }finally{if(activeObjectURL!==objectURL)URL.revokeObjectURL(objectURL);}
 }catch(error){if(ticket!==generation)return;$('imageHint').textContent=error.message;toast(error.message);}
}
async function selectArticle(article) {
 selected=article;$('previewTitle').dataset.fullTitle=article.title;$('previewTitle').textContent=article.title;clampHeadline();$('previewDate').textContent=dateLabel(article.date);$('articleDialog').close();
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
$('closeArticles').onclick=()=>$('articleDialog').close();$('refresh').onclick=loadArticles;$('search').oninput=()=>{articlePage=0;renderArticles();};
for(const button of document.querySelectorAll('[data-format]'))button.onclick=()=>{format=button.dataset.format;$('postCard').className=format;for(const b of document.querySelectorAll('[data-format]'))b.setAttribute('aria-pressed',String(b===button));scale();};
$('bgColor').oninput=event=>theme(event.target.value);$('autoColor').onclick=matchColour;
$('uploadBtn').onclick=()=>$('imageUpload').click();$('artworkContainer').ondblclick=()=>$('imageUpload').click();
$('postCard').ondblclick=event=>{if(event.target===$('postCard'))$('bgColor').click();};
$('imageUpload').onchange=event=>{const file=event.target.files[0];if(file&&!exporting)setImage(file);event.target.value='';};
window.addEventListener('dragover',event=>event.preventDefault());window.addEventListener('drop',event=>{event.preventDefault();const file=event.dataTransfer.files[0];if(!exporting&&file?.type.startsWith('image/'))setImage(file);});
async function capturePoster(hideDate=false) {
  if(!window.html2canvas)throw new Error('Export library did not load. Check your connection and reload.');
  await document.fonts.ready;clampHeadline();renderImageBackground();await $('previewImage').decode();const [width,height]=dimensions[format];
  return await html2canvas($('postCard'),{scale:1,width,height,useCORS:true,allowTaint:false,logging:false,
   onclone:doc=>{
    if(hideDate)doc.getElementById('previewDate').style.visibility='hidden';
    const card=doc.getElementById('postCard');card.style.transform='none';card.style.position='relative';card.style.width=width+'px';card.style.height=height+'px';card.classList.add('is-exporting');
    const background=doc.getElementById('imageBackground');
    if(background&&!background.hidden){
     // Do not resolve percentages against the smaller preview wrapper.
     Object.assign(background.style,{position:'absolute',left:'0px',top:'0px',right:'auto',bottom:'auto',width:width+'px',height:height+'px'});
    }
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

}
function downloadBlob(blob,extension) {
 const link=document.createElement('a'),url=URL.createObjectURL(blob);
 link.href=url;link.download='LagosMeet-'+format+'-'+(selected?.id||Date.now())+'.'+extension;
 link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function exportLock(locked) {
 exporting=locked;
 for(const element of document.querySelectorAll('.controls button,.controls input,.position-control input,.position-control button,#colourPanel button,#colourPanel input,#posterSearch'))element.disabled=locked;
 for(const element of [$('previewDate'),$('previewTitle')])element.contentEditable=locked?'false':'plaintext-only';
 if(!locked){$('download').disabled=!imageReady;$('downloadVideo').disabled=!imageReady;}
}
$('download').onclick=async()=>{
 if(!imageReady||exporting)return;exportLock(true);$('download').textContent='Exporting…';document.activeElement?.blur();
 try{
  const canvas=await capturePoster();
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG export failed');
  downloadBlob(blob,'png');toast('Poster exported');
 }catch(error){toast(error.message);}finally{exportLock(false);$('download').textContent='Export PNG';}
};
function createBadgeMotion() {
 const state={dateY:0,badgeY:1,reveal:0,text:0,imageProgress:0};
 const timeline=anime.timeline({autoplay:false,easing:'easeInOutQuint'});
 timeline.add({targets:state,dateY:[0,-1],duration:720},1400)
 .add({targets:state,badgeY:[1,0],reveal:[0,1],duration:900,easing:'easeOutQuint'},1610)
 .add({targets:state,text:[0,1],duration:860,easing:'easeOutCubic'},1740)
 .add({targets:state,badgeY:[0,-1],reveal:[1,0],duration:800,easing:'easeInOutQuint'},4020)
 .add({targets:state,dateY:[1,0],duration:900,easing:'easeOutQuint'},4290)
 .add({targets:state,imageProgress:[0,1],duration:3000,easing:'easeInOutSine'},0)
 .add({targets:state,imageProgress:[1,0],duration:3000,easing:'easeInOutSine'},3000);
 return {state,timeline};
}
function imageMotionCrop(sw,sh,width,height,x,y,progress) {
 const [sx,sy,cw,ch]=coverCrop(sw,sh,width,height,x,y);
 const zoom=1+.065*progress,w=cw/zoom,h=ch/zoom;
 // Travel stays inside the user's chosen crop, even at the image edges.
 return [sx+(cw-w)*(.5+.12*progress),sy+(ch-h)*(.5-.08*progress),w,h];
}
function drawImageMotion(ctx,source,frame,position,progress) {
 ctx.save();ctx.beginPath();ctx.roundRect(frame.x,frame.y,frame.width,frame.height,frame.radius);ctx.clip();
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 ctx.drawImage(source,...imageMotionCrop(source.naturalWidth,source.naturalHeight,frame.width,frame.height,position.x,position.y,progress),frame.x,frame.y,frame.width,frame.height);
 ctx.restore();
}
function drawBadgeMotion(ctx,motion,cx,cy,fontSize,family,dateText,colour,textColour) {
 ctx.font=fontSize+'px '+family;ctx.textBaseline='middle';ctx.textAlign='center';
 const text='Project of the Day',height=fontSize*1.8,width=ctx.measureText(text).width+fontSize*1.4;
 // A stationary viewport clips both lines as they travel through it.
 ctx.save();ctx.beginPath();ctx.rect(cx-width,cy-height/2,width*2,height);ctx.clip();
 ctx.fillStyle='#000';ctx.fillText(dateText,cx,cy+motion.dateY*height);
 if(motion.reveal>.0001){
  const y=cy+motion.badgeY*height,w=width*motion.reveal;
  ctx.save();ctx.beginPath();ctx.roundRect(cx-w/2,y-height/2,w,height,Math.min(fontSize*.4,w/2));ctx.clip();
  ctx.fillStyle=colour;ctx.fillRect(cx-width/2,y-height/2,width,height);
  // A second mask holds the letters inside the coloured pill.
  ctx.fillStyle=textColour;ctx.textAlign='left';
  const characters=Array.from(text),measurements=characters.map(char=>ctx.measureText(char).width);
  let x=cx-measurements.reduce((a,b)=>a+b,0)/2;
  characters.forEach((char,index)=>{
   const progress=Math.max(0,Math.min(1,(motion.text-index*.018)/.68));
   const eased=1-(1-progress)**3;
   ctx.fillText(char,x,y+(1-eased)*height);
   x+=measurements[index];
  });
  ctx.restore();
 }
 ctx.restore();
}
$('downloadVideo').onclick=async()=>{
 if(!imageReady||exporting)return;
 if(!window.VideoEncoder||!window.VideoFrame){toast('MP4 export needs a browser with video encoding support. Try current Chrome or Edge on desktop.');return;}
 if(!window.anime){toast('Animation library did not load. Check your connection and reload.');return;}
 if(!window.Mp4Muxer){toast('Video library did not load. Check your connection and reload.');return;}
 exportLock(true);$('downloadVideo').textContent='Preparing…';document.activeElement?.blur();
 let encoder;
 try{
  const [width,originalHeight]=dimensions[format],height=Math.ceil(originalHeight/2)*2, fps=30;
  const config={codec:'avc1.420028',width,height,bitrate:6000000,framerate:fps,avc:{format:'avc'}};
  if(!(await VideoEncoder.isConfigSupported(config)).supported)throw new Error('This device cannot encode this MP4 size. Try desktop Chrome or Edge.');
  const base=await capturePoster(true),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d'),date=$('previewDate'),cardRect=$('postCard').getBoundingClientRect(),rect=date.getBoundingClientRect();
  const scaleFactor=width/cardRect.width,cx=(rect.left+rect.width/2-cardRect.left)*scaleFactor,cy=(rect.top+rect.height/2-cardRect.top)*scaleFactor;
  const artwork=$('artworkContainer'),artRect=artwork.getBoundingClientRect();
  const imageFrame={x:(artRect.left-cardRect.left)*scaleFactor,y:(artRect.top-cardRect.top)*scaleFactor,width:artRect.width*scaleFactor,height:artRect.height*scaleFactor,radius:parseFloat(getComputedStyle(artwork).borderTopLeftRadius)||0};
  const exportImage=$('previewImage'),exportPosition={...imagePosition};
  const fontSize=parseFloat(getComputedStyle(date).fontSize),family=getComputedStyle(date).fontFamily,dateText=date.textContent.trim();
  const colour=$('bgColor').value;
  const channels=[1,3,5].map(i=>parseInt(colour.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  const badgeTextColour=channels[0]*.2126+channels[1]*.7152+channels[2]*.0722>.179?'#000':'#fff';
  const target=new Mp4Muxer.ArrayBufferTarget(),muxer=new Mp4Muxer.Muxer({target,video:{codec:'avc',width,height,frameRate:fps},fastStart:'in-memory'});
  let encodingError=null;
  encoder=new VideoEncoder({output:(chunk,meta)=>{try{muxer.addVideoChunk(chunk,meta);}catch(e){encodingError=e;}},error:error=>{encodingError=error;}});
  encoder.configure(config);
  const motion=createBadgeMotion();
  for(let i=0;i<180;i++){
   if(encodingError)throw encodingError;
   ctx.globalAlpha=1;ctx.fillStyle=colour;ctx.fillRect(0,0,width,height);ctx.drawImage(base,0,0);
   motion.timeline.seek(i*1000/fps);
   drawImageMotion(ctx,exportImage,imageFrame,exportPosition,motion.state.imageProgress);
   drawBadgeMotion(ctx,motion.state,cx,cy,fontSize,family,dateText,colour,badgeTextColour);
   const frame=new VideoFrame(canvas,{timestamp:Math.round(i*1000000/fps),duration:Math.round(1000000/fps)});
   try{encoder.encode(frame,{keyFrame:i%60===0});}finally{frame.close();}
   if(i%12===11){await encoder.flush();$('downloadVideo').textContent='MP4 '+Math.round((i+1)/180*100)+'%';await new Promise(resolve=>setTimeout(resolve,0));}
  }
  await encoder.flush();if(encodingError)throw encodingError;muxer.finalize();
  downloadBlob(new Blob([target.buffer],{type:'video/mp4'}),'mp4');toast('6-second MP4 exported');
 }catch(error){toast(error.message);}finally{if(encoder&&encoder.state!=='closed')encoder.close();exportLock(false);$('downloadVideo').textContent='Export MP4';}
};
new ResizeObserver(scale).observe(document.querySelector('.controls'));
window.visualViewport?.addEventListener('resize',scale);
window.addEventListener('resize',scale);document.fonts.ready.then(scale);scale();
$('previewDate').textContent='Loading latest story…';$('imageHint').textContent='Loading the latest published article from Notion…';
loadArticles(true);
