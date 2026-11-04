const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
class ScheduleStore{
 constructor(root){this.root=path.resolve(root);fs.mkdirSync(this.root,{recursive:true});}
 file(id){if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Programación no válida');return path.join(this.root,id+'.json');}
 save(s){const file=this.file(s.id),tmp=file+'.'+randomUUID()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(s,null,2));fs.renameSync(tmp,file);return s;}
 add({channel,title,start,end,directory}){start=Number(start);end=Number(end);if(!channel||!Number.isFinite(start)||!Number.isFinite(end)||start<Date.now()||end<=start||end-start>86400000||start-Date.now()>366*86400000)throw Error('Elige una fecha futura y un final posterior al inicio (máximo 24 horas).');if(!path.isAbsolute(String(directory||'')))throw Error('Carpeta de grabación no válida');return this.save({id:randomUUID(),channel:String(channel).slice(0,150),title:String(title||'TV').slice(0,160),start,end,directory,status:'scheduled',created:Date.now()});}
 list(){return fs.readdirSync(this.root).filter(n=>/^[a-f0-9-]{36}\.json$/.test(n)).flatMap(n=>{try{return[JSON.parse(fs.readFileSync(path.join(this.root,n),'utf8'))];}catch{return[];}}).map(s=>this.cancelled(s.id)?{...s,status:'cancelled'}:s).sort((a,b)=>a.start-b.start);}
 cancelled(id){return fs.existsSync(this.file(id)+'.cancel');}
 cancel(id){const file=this.file(id);if(!fs.existsSync(file))throw Error('Programación no encontrada');fs.writeFileSync(file+'.cancel','cancelled');}
}
class Recorder{
 constructor({store,resolve,start,clock=Date.now}){Object.assign(this,{store,resolve,start,clock});this.active=new Map();this.busy=false;}
 async tick(){if(this.busy)return;this.busy=true;try{const now=this.clock();for(const s of this.store.list()){
  if(this.store.cancelled(s.id)){const running=this.active.get(s.id);if(running){running.stop();this.active.delete(s.id);}continue;}
  if(this.active.has(s.id)){if(now>=s.end){this.active.get(s.id).stop();this.active.delete(s.id);this.store.save({...s,status:'finishing'});}continue;}
  if(!['scheduled','recording','preparing'].includes(s.status))continue;
  if(now>=s.end){this.store.save({...s,status:s.status==='recording'?'interrupted':'missed',error:'El equipo no estuvo disponible en el horario programado.'});continue;}
  if(now<s.start||this.active.size>=3)continue;
  try{this.store.save({...s,status:'preparing'});const stream=await this.resolve(s.channel);if(this.store.cancelled(s.id))continue;const limit=Math.max(1,Math.floor((s.end-this.clock())/1000));if(this.clock()>=s.end){this.store.save({...s,status:'missed'});continue;}const task=await this.start({type:'record',title:s.title,stream,limit,directory:s.directory,schedule:s.id});this.active.set(s.id,task);this.store.save({...s,status:'recording',jobId:task.id,actualStart:this.clock()});}catch(error){this.store.save({...s,status:'failed',error:String(error.message||error).replace(/https?:\/\/\S+/g,'[origen]').slice(0,250)});}
 }}finally{this.busy=false;}}
}
module.exports={ScheduleStore,Recorder};
