const fs=require('node:fs');const path=require('node:path');const {randomUUID}=require('node:crypto');const {spawn}=require('node:child_process');
function safeFilename(title){let value=String(title).replace(/[<>:"/\\|?*\u0000-\u001f]/g,' ').replace(/\s+/g,' ').replace(/^[. ]+|[. ]+$/g,'').slice(0,110)||'LIQUIDGLASS IPTV';if(/^(CON|PRN|AUX|NUL|COM\d|LPT\d)(\.|$)/i.test(value))value='_'+value;return value;}
class JobManager{
 constructor({directory,stateFile,ffmpeg='ffmpeg'}){this.directory=path.resolve(directory);this.stateFile=stateFile;this.ffmpeg=ffmpeg;this.jobs=[];this.running=new Map();fs.mkdirSync(this.directory,{recursive:true});if(fs.existsSync(stateFile)){try{this.jobs=JSON.parse(fs.readFileSync(stateFile,'utf8')).map(j=>['running','stopping'].includes(j.status)?{...j,status:'interrupted',error:'La app se cerró antes de completar la tarea.'}:j);}catch{}}}
 persist(){fs.mkdirSync(path.dirname(this.stateFile),{recursive:true});const temporary=this.stateFile+'.tmp';fs.writeFileSync(temporary,JSON.stringify(this.jobs,null,2));fs.renameSync(temporary,this.stateFile);}
 list(){const previous=this.jobs.length;this.jobs=this.jobs.filter(j=>j.status!=='completed'||(j.file&&fs.existsSync(j.file)));if(this.jobs.length!==previous)this.persist();return this.jobs.map(j=>({...j,elapsed:this.running.has(j.id)?Math.floor((Date.now()-j.startedAt)/1000):j.elapsed||0}));}
 start({type,title,stream,limit=3600}){
  if(!['record','download'].includes(type))throw Error('Tipo de tarea no admitido');
  if(this.running.size>=3)throw Error('Ya hay tres tareas activas. Espera o detén una.');
  const id=randomUUID(),name=safeFilename(title)+' - '+id.slice(0,8),file=path.join(this.directory,name+'.mkv'),partial=file+'.part';
  const job={id,type,title:String(title).slice(0,160),status:'running',startedAt:Date.now(),file,bytes:0,seconds:0,duration:type==='record'?Math.max(1,Math.min(86400,Number(limit)||3600)):Number(stream.duration)||0,progress:0};
  const args=['-hide_banner','-loglevel','error','-rw_timeout','30000000','-progress','pipe:1','-nostats'];
  if(type==='record')args.push('-re');
  if(Object.keys(stream.headers||{}).length)args.push('-headers',Object.entries(stream.headers).map(([k,v])=>k+': '+String(v).replace(/[\r\n]/g,'')+'\r\n').join(''));
  args.push('-i',stream.url,'-map','0:v:0?','-map','0:a?','-map','0:s?','-c','copy');
  if(type==='record')args.push('-t',String(job.duration));
  args.push('-f','matroska','-n',partial);
  const child=spawn(this.ffmpeg,args,{windowsHide:true,stdio:['pipe','pipe','pipe']});let buffer='',error='',cancelled=false,stopping=false,lastSave=0;
  child.stdin.on('error',()=>{});
  this.running.set(id,{child,stop:()=>{stopping=true;job.status='stopping';child.stdin.write('q\n');setTimeout(()=>{if(this.running.has(id))child.kill();},8000).unref();},cancel:()=>{cancelled=true;child.kill();}});this.jobs.unshift(job);this.persist();
  child.stdout.on('data',data=>{buffer+=data;let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index).trim();buffer=buffer.slice(index+1);const [key,value]=line.split('=');if(key==='out_time_us')job.seconds=Math.max(0,Number(value)/1e6||0);if(key==='total_size')job.bytes=Number(value)||0;}if(job.duration>0)job.progress=Math.min(.999,job.seconds/job.duration);if(Date.now()-lastSave>1500){lastSave=Date.now();this.persist();}});
  child.stderr.on('data',data=>{error=(error+String(data)).slice(-3000);});
  child.on('error',e=>{error=e.message;});
  child.on('close',code=>{
   this.running.delete(id);job.elapsed=Math.floor((Date.now()-job.startedAt)/1000);
   if((code===0||stopping)&&fs.existsSync(partial)&&fs.statSync(partial).size>0){fs.renameSync(partial,file);job.status='completed';job.progress=1;job.bytes=fs.statSync(file).size;}
   else{job.status=cancelled?'cancelled':'failed';job.file=partial;job.bytes=fs.existsSync(partial)?fs.statSync(partial).size:0;job.error=cancelled?'Descarga cancelada; el archivo parcial se conserva.':error.replace(/https?:\/\/\S+/g,'[origen]').slice(-350)||'El origen no entregó contenido.';}
   this.persist();
  });
  return {...job};
 }
 stop(id){const task=this.running.get(id);if(!task)throw Error('La tarea ya finalizó');const job=this.jobs.find(j=>j.id===id);if(job.type==='record')task.stop();else task.cancel();this.persist();}
 file(id){const job=this.jobs.find(j=>j.id===id);return job?.file;}
 close(){for(const [id,task]of this.running){const job=this.jobs.find(j=>j.id===id);if(job.type==='record')task.stop();else task.cancel();}}
}
module.exports={JobManager,safeFilename};
