const {randomBytes}=require('node:crypto');
const {spawn}=require('node:child_process');
class MediaRelay{
 constructor({ffmpeg='ffmpeg',base}){this.ffmpeg=ffmpeg;this.base=base;this.sessions=new Map();this.children=new Set();}
 register(stream){const token=randomBytes(16).toString('hex');this.sessions.set(token,{stream,at:Date.now()});while(this.sessions.size>24)this.sessions.delete(this.sessions.keys().next().value);return this.base()+'/s/'+token+'.mp4';}
 args(stream,start=0,audio=0){
  const args=['-hide_banner','-loglevel','error','-nostdin','-rw_timeout','20000000','-probesize','4M','-analyzeduration','4M'];
  if(Object.keys(stream.headers||{}).length)args.push('-headers',Object.entries(stream.headers).map(([k,v])=>k+': '+String(v).replace(/[\r\n]/g,'')+'\r\n').join(''));
  if(start>0)args.push('-ss',String(start));
  args.push('-i',stream.url,'-map','0:v:0','-map',`0:a:${audio}?`);
  if(stream.videoCodec==='h264')args.push('-c:v','copy');
  else args.push('-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p');
  args.push('-c:a','aac','-b:a','192k','-movflags','frag_keyframe+empty_moov+default_base_moof','-f','mp4','pipe:1');return args;
 }
 handle(req,res,url){
  const match=/^\/s\/([a-f0-9]{32})\.mp4$/.exec(url.pathname),session=match&&this.sessions.get(match[1]);
  if(!session){res.writeHead(404);res.end();return;}
  session.at=Date.now();
  if(req.method==='HEAD'){res.writeHead(200,{'Content-Type':'video/mp4','Accept-Ranges':'none'});res.end();return;}
  if(this.children.size>5){res.writeHead(429);res.end();return;}
  const start=Math.max(0,Math.min(604800,Number(url.searchParams.get('start'))||0)),audio=Math.max(0,Math.min(15,Number(url.searchParams.get('a'))||0));
  const child=spawn(this.ffmpeg,this.args(session.stream,start,audio),{windowsHide:true,stdio:['ignore','pipe','pipe']});this.children.add(child);
  let sent=false,errorText='';
  child.stderr.on('data',c=>{errorText=(errorText+c.toString()).slice(-2000);});
  child.stdout.on('data',chunk=>{if(!sent){res.writeHead(200,{'Content-Type':'video/mp4','Cache-Control':'no-store','Accept-Ranges':'none'});sent=true;}if(!res.write(chunk)){child.stdout.pause();res.once('drain',()=>child.stdout.resume());}});
  child.on('error',()=>{if(!sent)res.writeHead(502);res.end('No se pudo iniciar FFmpeg.');});
  child.on('close',code=>{this.children.delete(child);if(!sent){res.writeHead(502);if(code)console.warn('FFmpeg: no se recibió vídeo ('+String(errorText).replace(/https?:\/\/\S+/g,'[origen]').slice(-180)+')');}res.end();});
  res.on('close',()=>{child.kill();this.children.delete(child);});
 }
 stop(){for(const child of this.children)child.kill();this.children.clear();}
 close(){this.stop();this.sessions.clear();}
}
module.exports={MediaRelay};
