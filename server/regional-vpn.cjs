'use strict';
const COUNTRIES=new Set(['UY','CL','AR','US','MX','ES']);
class RegionalVPN{
 constructor({country,engine}){this.countryLookup=country;this.engine=engine;this.enabled=false;this.physical=null;this.country=null;this.state='disabled';this.owned=null;this.revision=0;this.pending=null;}
 status(){return{enabled:this.enabled,country:this.country,state:this.state,ownsTunnel:!!this.owned,countries:[...COUNTRIES]};}
 async setEnabled(value){this.enabled=value===true;this.revision++;if(!this.enabled){const own=this.owned;this.owned=null;if(own)await own.disconnect();this.state='disabled';this.physical=null;}else{this.state='waiting-network';this.physical=null;}}
 async network({physical,externalVPN=false}){
  if(!this.enabled||!physical)return;
  if(externalVPN){this.revision++;this.state='external-vpn';this.physical=null;const own=this.owned;this.owned=null;if(own)await own.disconnect();return;}
  if(physical===this.physical)return;
  const revision=++this.revision;this.physical=physical;this.country=null;const previous=this.owned;this.owned=null;if(previous)await previous.disconnect();if(revision!==this.revision)return;
  this.state='detecting';let country;try{country=await this.countryLookup();}catch{country=null;}
  if(revision!==this.revision||!this.enabled)return;
  this.country=typeof country==='string'&&/^[A-Z]{2}$/.test(country)?country:null;
  if(!this.country){this.state='geo-unavailable';return;}if(!COUNTRIES.has(this.country)){this.state='not-required';return;}
  this.state='connecting';try{const own=await this.engine.connect();if(revision!==this.revision||!this.enabled){await own.disconnect();return;}this.owned=own;this.state='connected';}catch{if(revision===this.revision)this.state='setup-required';}
 }
}
function parseProfile(text){
 if(typeof text!=='string'||text.length>262144)throw Error('Perfil no válido');const allowed=new Set(['client','dev','proto','remote','resolv-retry','nobind','persist-key','persist-tun','remote-cert-tls','verify-x509-name','cipher','data-ciphers','auth','auth-user-pass','auth-nocache','verb','windows-driver','tls-version-min','key-direction','pull','route-nopull','redirect-gateway','route','route-ipv6','pull-filter','explicit-exit-notify']);
 let block=null,server=false,ca=false,client=false,routeAll=false;for(const raw of text.split(/\r?\n/)){const line=raw.trim();if(!line||/^[#;]/.test(line))continue;if(block){if(line==='</'+block+'>')block=null;continue;}if(line.startsWith('<')){const match=/^<(ca|cert|key|tls-auth|tls-crypt)>$/.exec(line);if(!match)throw Error('Bloque no permitido');block=match[1];if(block==='ca')ca=true;continue;}const [key,...args]=line.split(/\s+/);if(!allowed.has(key))throw Error('Directiva no permitida: '+key);if(key==='auth-user-pass'&&args.length)throw Error('No se permiten archivos externos de credenciales');if(key==='remote-cert-tls'&&args[0]==='server')server=true;if(key==='client'||key==='pull')client=true;if(key==='redirect-gateway')routeAll=true;if(key==='verb'&&Number(args[0])>3)throw Error('Registro demasiado detallado');}
 if(block)throw Error('Bloque incompleto');if(!server||!ca)throw Error('Falta validar el certificado del servidor');return{profile:text,mayRouteAllTraffic:routeAll||client};
}
async function detectPublicCountry(){const response=await fetch('https://api.country.is/',{signal:AbortSignal.timeout(5000),redirect:'error',headers:{Accept:'application/json'}});if(!response.ok)throw Error('Geolocalización no disponible');const text=await response.text();if(text.length>2048)throw Error('Respuesta no válida');const data=JSON.parse(text);return typeof data.country==='string'&&/^[A-Z]{2}$/.test(data.country)?data.country:null;}
module.exports={RegionalVPN,parseProfile,detectPublicCountry,COUNTRIES};
