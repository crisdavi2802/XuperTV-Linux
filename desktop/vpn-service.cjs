const fs=require('node:fs'),path=require('node:path'),{safeStorage,dialog}=require('electron'),{PrivateVault}=require('./private-vault.cjs'),{RegionalVPN,parseProfile,detectPublicCountry}=require('../server/regional-vpn.cjs'),{physicalNetwork}=require('./network-monitor.cjs');
function createVPNService(app,window){
 const vault=new PrivateVault({file:path.join(app.getPath('userData'),'private','vpn.dpapi'),safeStorage});let configured=false,polling=false,timer,settingUp=false,engineReady=false,setupError=false;
 // The official engine and the elevated, authenticated broker must be provisioned
 // before connection is permitted. Never execute the binary from a supplied ZIP.
 const engine={connect:async()=>{throw Error('Falta instalar y verificar el motor oficial y el servicio autorizado.');}};
 const controller=new RegionalVPN({country:detectPublicCountry,engine});
 try{configured=!!vault.read().profile;}catch{}
 const tick=async()=>{if(polling||!controller.enabled)return;polling=true;try{await controller.network(await physicalNetwork(controller.owned?.interfaceIds||[]));}catch{controller.state='network-unavailable';}finally{polling=false;}};
 return{
  status:()=>({...controller.status(),configured,engineReady,brokerReady:false,settingUp,setupError,realConnectionTested:false,routing:'Sin comprobar: el servidor puede enviar rutas para todo Windows.'}),
  async enable(value){await controller.setEnabled(value===true);clearInterval(timer);if(value===true){timer=setInterval(tick,15000);timer.unref();tick();}return this.status();},
  setup(){if(!settingUp){settingUp=true;setupError=false;require('./official-openvpn.cjs').setup(path.join(app.getPath('userData'),'setup')).then(()=>{engineReady=true;}).catch(()=>{setupError=true;}).finally(()=>{settingUp=false;});}return this.status();},
  async configure(){if(process.platform!=='win32')throw Error('Esta configuración OpenVPN es exclusiva de Windows.');const choice=await dialog.showOpenDialog(window(),{title:'Importar perfil OpenVPN propio',properties:['openFile'],filters:[{name:'OpenVPN',extensions:['ovpn']}]});if(choice.canceled)return this.status();const file=choice.filePaths[0];if(fs.statSync(file).size>262144)throw Error('Perfil demasiado grande.');const profile=parseProfile(fs.readFileSync(file,'utf8'));vault.write({profile:profile.profile,mayRouteAllTraffic:profile.mayRouteAllTraffic});configured=true;return this.status();},
  async close(){clearInterval(timer);await controller.setEnabled(false);}
 };
}
module.exports={createVPNService};
