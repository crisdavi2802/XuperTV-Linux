'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto'),http=require('node:http'),https=require('node:https');
const {safeFilename}=require('./jobs.cjs');
class DownloadQueue{
 constructor({directory,stateFile,resolve,verify=async()=>{},concurrency=2}){
  this.directory=path.resolve(directory);this.stateFile=stateFile;this.resolve=resolve;this.verify=verify;this.concurrency=Math.max(1,Math.min(2,concurrency));this.running=new Map();this.closed=false;this.jobs=[];fs.mkdirSync(this.directory,{recursive:true});
  try{this.jobs=JSON.parse(fs.readFileSync(stateFile,'utf8')).map(j=>({...j,status:['running','queued'].includes(j.status)?'paused':j.status,speed:0,eta:null}));}catch{}
 }
 persist(){fs.mkdirSync(path.dirname(this.stateFile),{recursive:true});fs.writeFileSync(this.stateFile+'.tmp',JSON.stringify(this.jobs));fs.renameSync(this.stateFile+'.tmp',this.stateFile);}
 list(){for(const j of this.jobs){if(j.status==='completed'&&!fs.existsSync(j.file)){j.status='missing';j.progress=null;j.error='El archivo se eliminó del equipo.';}}return this.jobs.map(j=>({...j}));}
 add(items){if(!Array.isArray(items)||!items.length||items.length>500)throw Error('Selecciona entre 1 y 500 episodios.');const added=[];for(const item of items){const contentId=String(item.contentId||''),seriesId=String(item.seriesId||'');if(!contentId||contentId.length>200||seriesId.length>200)throw Error('Contenido no válido');const key=seriesId+':'+contentId;let old=this.jobs.find(j=>j.key===key&&!['cancelled','missing','failed'].includes(j.status));if(old){added.push({...old});continue;}const id=randomUUID(),file=path.join(this.directory,safeFilename(item.title)+' - '+id.slice(0,8)+'.media');const job={id,key,contentId,seriesId,type:'download',queuedDownload:true,title:String(item.title||'Episodio').slice(0,160),group:String(item.group||'').slice(0,160),file,status:'queued',bytes:0,totalBytes:null,progress:null,speed:0,eta:null,createdAt:Date.now()};this.jobs.push(job);added.push({...job});}this.persist();this.pump();return added;}
 pause(id){const j=this.find(id);if(!['running','queued'].includes(j.status))return;j.status='paused';this.running.get(id)?.abort();this.persist();}
 resume(id){const j=this.find(id);if(['running','completed'].includes(j.status))return;if(this.running.has(id))throw Error('Espera a que termine de pausarse.');j.status='queued';j.error='';this.persist();this.pump();}
 cancel(id){const j=this.find(id);if(j.status==='completed')return;j.status='cancelled';this.running.get(id)?.abort();this.persist();}
 find(id){const j=this.jobs.find(j=>j.id===id);if(!j)throw Error('Descarga no encontrada');return j;}
 pump(){if(this.closed)return;for(const j of this.jobs){if(this.running.size>=this.concurrency)break;if(j.status!=='queued'||this.running.has(j.id))continue;const abort=new AbortController();this.running.set(j.id,abort);j.status='running';this.transfer(j,abort.signal).catch(error=>{if(j.status==='running'){j.status='failed';j.error=String(error.message||error).replace(/https?:\/\/\S+/g,'[origen]').slice(0,220);}}).finally(()=>{this.running.delete(j.id);j.speed=0;j.eta=null;this.persist();this.pump();});}}
 async transfer(j,signal){
  const stream=await this.resolve(j);if(signal.aborted)return;
  if(stream.isHls===true||/\.m3u8(?:\?|$)/i.test(stream.url))throw Error('Esta fuente HLS necesita descarga por segmentos; no admite reanudación de archivo.');
  const partial=j.file+'.part';let offset=fs.existsSync(partial)?fs.statSync(partial).size:0;
  const headers={...stream.headers,'Accept-Encoding':'identity'};if(offset){headers.Range='bytes='+offset+'-';if(j.validator)headers['If-Range']=j.validator;}
  const response=await this.request(stream.url,headers,signal);if(signal.aborted){response.destroy();return;}
  if(response.statusCode===200){offset=0;}else if(response.statusCode!==206){response.resume();throw Error('El origen rechazó la descarga ('+response.statusCode+').');}
  const range=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers['content-range']||'');
  if(response.statusCode===206&&(!range||Number(range[1])!==offset||Number(range[2])<offset||Number(range[3])<=Number(range[2]))){response.destroy();throw Error('El origen devolvió un rango de archivo no válido.');}
  if(offset&&j.validator&&response.headers.etag&&response.headers.etag!==j.validator){response.destroy();throw Error('El archivo cambió en el origen. Cancela y crea una descarga nueva.');}
  const length=Number(response.headers['content-length']);j.totalBytes=range?Number(range[3]):Number.isFinite(length)&&length>0?length:null;j.validator=response.headers.etag||response.headers['last-modified']||null;j.bytes=offset;j.progress=j.totalBytes?offset/j.totalBytes:null;
  if(fs.statfsSync&&j.totalBytes){const disk=fs.statfsSync(this.directory);if(disk.bavail*disk.bsize<j.totalBytes-offset+10485760){response.destroy();throw Error('No hay espacio suficiente para esta descarga.');}}
  const output=fs.createWriteStream(partial,{flags:offset?'a':'w'});let last=Date.now(),sample=offset,saved=last;
  response.on('data',chunk=>{j.bytes+=chunk.length;if(j.totalBytes)j.progress=Math.min(.999,j.bytes/j.totalBytes);const now=Date.now();if(now-last>=500){j.speed=(j.bytes-sample)*1000/(now-last);j.eta=j.totalBytes&&j.speed>0?Math.ceil((j.totalBytes-j.bytes)/j.speed):null;last=now;sample=j.bytes;}if(now-saved>2000){saved=now;this.persist();}});
  const {pipeline}=require('node:stream/promises');await pipeline(response,output,{signal});
  if(j.totalBytes&&j.bytes!==j.totalBytes)throw Error('La descarga quedó incompleta. Puedes reanudarla.');if(j.bytes===0)throw Error('El origen entregó un archivo vacío.');
  await this.verify(partial);if(signal.aborted)return;
  fs.renameSync(partial,j.file);j.status='completed';j.progress=1;j.completedAt=Date.now();
 }
 request(value,headers,signal,redirects=0){return new Promise((resolve,reject)=>{const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return reject(Error('Fuente no válida'));const request=(url.protocol==='https:'?https:http).get(url,{headers,signal,timeout:30000},res=>{if([301,302,303,307,308].includes(res.statusCode)){res.resume();if(redirects>=3)return reject(Error('Demasiadas redirecciones'));const next=new URL(res.headers.location,url);if(url.protocol==='https:'&&next.protocol!=='https:')return reject(Error('Redirección insegura'));const forwarded=next.origin===url.origin?headers:{'Accept-Encoding':'identity',...(headers.Range?{Range:headers.Range}:{})};this.request(next.href,forwarded,signal,redirects+1).then(resolve,reject);}else resolve(res);});request.on('timeout',()=>request.destroy(Error('El origen tardó demasiado. Puedes reanudar.')));request.on('error',reject);});}
 close(){this.closed=true;for(const j of this.jobs)if(['running','queued'].includes(j.status)){j.status='paused';this.running.get(j.id)?.abort();}this.persist();}
}
module.exports={DownloadQueue};
