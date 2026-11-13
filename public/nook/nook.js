'use strict';
const $=id=>document.getElementById(id);let token='',view='nook',page=0,total=0,items=[],generation=0,timer,category='',categories=[],currentState={};
function notice(text,error=false){$('notice').hidden=!text;$('notice').textContent=text;$('notice').classList.toggle('error',error);}
async function api(path,data){const response=await fetch('/api/'+path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json','X-LiquidGlass-Token':token}:{},body:data?JSON.stringify(data):undefined});const value=await response.json();if(!response.ok||value.returnValue===false)throw Error(value.error||value.errorText||'No se pudo completar');return value;}
function element(tag,text,className){const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;}
async function status(){try{currentState=await api('nook/status');const runtime=currentState.runtime||{},p=currentState.playback||{};$('onair').textContent=runtime.title||runtime.current||'NOOK TV';$('phase').textContent=p.paused?'Emisión pausada':runtime.phase==='playing'?'En emisión':runtime.phase||'NOOK TV conectado';$('clock').textContent=(p.position?Math.floor(p.position/60)+' min · ':'')+(currentState.schedules||0)+' horarios configurados';}catch(e){$('phase').textContent='NOOK TV no disponible';notice(e.message,true);}}
function render(){
 $('results').replaceChildren();
 const query=$('search').value.trim().toLocaleLowerCase();const shown=view==='nook'?items:items.filter(i=>(i.title||i.name||'').toLocaleLowerCase().includes(query));
 for(const item of shown){
  const card=element('article',null,'item'+(['movies','series'].includes(view)?' vod':'')),art=element('div',null,'art');
  const poster=item.poster||item.logo||item.posterUrl;if(poster){const image=document.createElement('img');image.src=poster;image.alt='';image.loading='lazy';image.onerror=()=>image.remove();art.append(image);}else art.textContent='NOOK TV';
  card.append(art,element('h3',item.title||item.name),element('p',item.group_name||item.row||item.year||'En vivo'));
  const button=element('button',['movies','series'].includes(view)?'Ver detalles':'Emitir en NOOK TV','send');button.onclick=()=>['movies','series'].includes(view)?detail(item):send(item);card.append(button);$('results').append(card);
 }
 if(!shown.length)$('results').append(element('p','No se encontraron resultados.'));
 $('count').textContent=(view==='nook'?total:shown.length)+' resultados';$('page').textContent='Página '+(page+1);$('previous').disabled=page===0;$('next').disabled=view==='nook'?(page+1)*48>=total:view==='liquidglass-live'?items.length<50:true;
}
async function load(){
 const revision=++generation;$('results').replaceChildren(element('p','Cargando fuentes…'));notice('');
 try{
  if(view==='nook'){const result=await api('nook/catalog?'+new URLSearchParams({q:$('search').value,kind:$('kind').value,page}));if(revision!==generation)return;items=result.items;total=result.total;}
  else if(view==='liquidglass-live'){
   if(!categories.length){categories=(await api('liveCategories')).categories;$('category').replaceChildren(...categories.map(i=>{const option=element('option',i.name);option.value=i.id;return option;}));category=categories[0]?.id||'';}
   const result=await api('liveChannels?'+new URLSearchParams({columnId:category,pageNum:page+1,pageSize:50}));if(revision!==generation)return;items=result.channels;
  }else{const query=$('search').value.trim(),result=await api(query?'search?value='+encodeURIComponent(query):'home?root='+view);if(revision!==generation)return;items=result.items||[];}
  render();
 }catch(e){if(revision===generation){$('results').replaceChildren();notice(e.message,true);}}
}
async function send(item,episode,series){
 const data=view==='nook'?{source:'nook',id:item.id}:{source:view==='liquidglass-live'?'liquidglass-live':'liquidglass-vod',id:episode||item.channelCode||item.id,title:item.title||item.name,params:series?{seriesContentId:series}:{}};
 if(!confirm('¿Emitir «'+data.title+'» ahora en NOOK TV? Esto sustituye temporalmente la emisión actual.'))return;
 notice('Preparando fuente para NOOK TV…');try{await api('nook/play',data);notice('Fuente enviada. Comprueba la imagen y el audio de la TV.');$('detail').close();await status();}catch(e){notice(e.message,true);}
}
async function detail(item){
 $('detail-content').replaceChildren(element('h2',item.title),element('p','Cargando episodios…'));$('detail').showModal();
 try{const result=await api('detail?contentId='+encodeURIComponent(item.id));$('detail-content').replaceChildren(element('h2',item.title),element('p',result.item?.synopsis||item.synopsis||''));const episodes=element('div',null,'episodes');
  if(result.episodes?.length){for(const ep of result.episodes){const button=element('button',(ep.number||'')+' · '+ep.name);button.onclick=()=>send(item,ep.id,item.id);episodes.append(button);}}
  else{const button=element('button','Emitir película en NOOK TV','send');button.onclick=()=>send(item);episodes.append(button);}
  $('detail-content').append(episodes);
 }catch(e){$('detail-content').append(element('p',e.message));}
}
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{view=button.dataset.view;page=0;$('search').value='';document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',b===button));$('section-title').textContent=button.textContent;$('search').placeholder='Buscar en '+button.textContent;$('kind').hidden=view!=='nook';$('category').hidden=view!=='liquidglass-live';load();});
$('search').oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{page=0;view==='liquidglass-live'?render():load();},450);};$('kind').onchange=()=>{page=0;load();};$('category').onchange=()=>{category=$('category').value;page=0;load();};$('refresh').onclick=()=>{status();load();};$('previous').onclick=()=>{page=Math.max(0,page-1);load();};$('next').onclick=()=>{page++;load();};$('close-detail').onclick=()=>$('detail').close();
document.querySelectorAll('[data-action]').forEach(button=>button.onclick=async()=>{try{await api('nook/control',{action:button.dataset.action});status();}catch(e){notice(e.message,true);}});
$('routine').onclick=async()=>{if(!confirm('¿Volver a la programación habitual de NOOK TV?'))return;try{await api('nook/resume',{});notice('Programación de NOOK TV restaurada.');status();}catch(e){notice(e.message,true);}};
(async()=>{try{({token}=await api('session'));await Promise.all([status(),load()]);setInterval(status,10000);}catch(e){notice(e.message,true);}})();
