const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {createApp}=require('./app.cjs');
const configFile=process.env.LIQUIDGLASS_CONFIG||path.join(os.homedir(),'.config','liquidglass-iptv','config.json');
let config={};if(fs.existsSync(configFile))config=JSON.parse(fs.readFileSync(configFile,'utf8'));
createApp({port:Number(process.env.PORT||config.port||18920),ffmpeg:process.env.FFMPEG||config.ffmpeg||'ffmpeg',nook:config.nook}).then(app=>{
 console.log('LIQUIDGLASS IPTV '+(config.nook?'para NOOK TV':'Desktop')+' en '+app.url);
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.close().then(()=>process.exit(0)));
}).catch(e=>{console.error(e.message);process.exit(1);});
