for(const stream of [process.stdout,process.stderr])stream?.on('error',()=>{});
const {app,BrowserWindow,Menu,shell,session,dialog}=require('electron');
const path=require('node:path');
const {runtimePaths}=require('./platform.cjs');
const runtime=runtimePaths(process.platform,app.isPackaged?process.resourcesPath:path.resolve(__dirname,'../resources'));
const {createApp}=require('../server/app.cjs');
let backend,window,vpn;
app.setName('XUPER TV+');
if(process.platform==='linux'){app.commandLine.appendSwitch('no-sandbox');app.commandLine.appendSwitch('disable-dev-shm-usage');app.commandLine.appendSwitch('disable-features','Translate');}
// Software composition avoids black windows on unsupported/old display drivers.
if(process.platform==='win32'){app.disableHardwareAcceleration();app.commandLine.appendSwitch('disable-gpu-compositing');}
// Preserve the existing per-device library when upgrading from XUPER TV.
app.setPath('userData',path.join(app.getPath('appData'),'XUPER TV'));
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
const recorderMode=process.argv.includes('--xuper-recorder');
if(recorderMode){app.setPath('userData',path.join(app.getPath('appData'),'XUPER TV Recorder'));if(!app.requestSingleInstanceLock())app.quit();else{app.whenReady().then(()=>require('./recorder.cjs').startRecorder(app,runtime.ffmpeg)).catch(()=>app.quit());}}
else if(!app.requestSingleInstanceLock())app.quit();
else{
 app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
 app.whenReady().then(async()=>{
  const ffmpeg=runtime.ffmpeg;
  const fs=require('node:fs'),settingsFile=path.join(app.getPath('userData'),'settings.json');let settings={};try{settings=JSON.parse(fs.readFileSync(settingsFile,'utf8'));}catch{}
  if(process.platform==='win32'&&require('../package.json').xuperEdition==='vpn-local')vpn=require('./vpn-service.cjs').createVPNService(app,()=>window);
  backend=await createApp({vpn,port:Number(process.env.XUPER_PORT)||18928,ffmpeg,desktopUI:true,fallbackPort:true,enableRecorder:()=>require('./recorder.cjs').enableRecorder(app),fullscreen:enabled=>window?.setFullScreen(!!enabled),openExternal:url=>shell.openExternal(url),openDownload:url=>shell.openExternal(url),jobsDirectory:settings.downloadDirectory||path.join(app.getPath('videos'),'XUPER TV+'),stateDirectory:app.getPath('userData'),revealFile:file=>shell.showItemInFolder(file),openFile:file=>shell.openPath(file),selectDirectory:async()=>{const result=await dialog.showOpenDialog(window,{title:'Guardar descargas y grabaciones',properties:['openDirectory','createDirectory']});if(result.canceled)return;settings.downloadDirectory=result.filePaths[0];fs.writeFileSync(settingsFile,JSON.stringify(settings));return settings.downloadDirectory;}});
  session.defaultSession.setPermissionRequestHandler((wc,permission,callback,details)=>{let own=false;try{own=new URL(details.requestingUrl||wc.getURL()).origin===backend.url;}catch{}callback(permission==='fullscreen'&&own);});
  window=new BrowserWindow({width:1440,height:860,minWidth:960,minHeight:540,backgroundColor:'#080b10',title:'XUPER TV+',...(runtime.mac?{}:{icon:path.resolve(__dirname,'../resources/icon.ico')}),autoHideMenuBar:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,spellcheck:false}});
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'XUPER TV+',submenu:[...(runtime.mac?[{role:'about'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'}]:[]),{label:'Interfaz de escritorio',click:()=>window.loadURL(backend.url+'/')},{label:'Pantalla completa',accelerator:runtime.fullscreen,click:()=>window.setFullScreen(!window.isFullScreen())},{label:'Recargar',accelerator:'CommandOrControl+R',click:()=>window.reload()},{type:'separator'},{role:'quit',label:'Salir'}]},{label:'Editar',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},{label:'Vista',submenu:[{role:'zoomIn'},{role:'zoomOut'},{role:'resetZoom'}]}]));
  window.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\/(github\.com|ko-fi\.com|buymeacoffee\.com|www\.youtube\.com|www\.themoviedb\.org)\//.test(url))shell.openExternal(url);return{action:'deny'};});
  window.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(backend.url+'/'))event.preventDefault();});
  let rendererRetries=0;
  window.webContents.on('render-process-gone',()=>{if(rendererRetries++<1)setTimeout(()=>window.loadURL(backend.url+'/').catch(()=>{}),500);else dialog.showErrorBox('XUPER TV+','La interfaz no pudo iniciarse. Cierra la aplicación y vuelve a abrirla.');});
  window.webContents.on('did-fail-load',(_,code,description,validatedURL,isMainFrame)=>{if(isMainFrame&&code!==-3)dialog.showErrorBox('XUPER TV+','No se pudo cargar la interfaz local. Reinicia la aplicación. Código: '+code);});
  await window.loadURL(backend.url+'/');
  if(process.env.XUPER_SCREENSHOT){setTimeout(async()=>{const fs=require('node:fs');fs.writeFileSync(process.env.XUPER_SCREENSHOT,(await window.webContents.capturePage()).toPNG());app.quit();},7000);}
 }).catch(error=>{dialog.showErrorBox('No se pudo abrir XUPER TV',error.message);app.quit();});
 app.on('window-all-closed',()=>app.quit());
 let approvedQuit=false;
 app.on('before-quit',event=>{if(approvedQuit)return;if(backend?.jobs?.running.size){event.preventDefault();const answer=dialog.showMessageBoxSync(window,{type:'question',buttons:['Seguir en la app','Detener tareas y salir'],defaultId:0,cancelId:0,message:'Hay descargas o grabaciones en curso.'});if(answer===1){approvedQuit=true;backend.jobs.close();setTimeout(()=>app.quit(),1500);}return;}vpn?.close();if(backend)backend.close();});
}
