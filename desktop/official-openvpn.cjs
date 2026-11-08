const fs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process');
const INSTALLER='https://swupdate.openvpn.org/community/releases/OpenVPN-2.7.8-I002-amd64.msi';
function powershell(script,timeout=15000){return new Promise((resolve,reject)=>execFile(path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from("$ErrorActionPreference='Stop';"+script,'utf16le').toString('base64')],{windowsHide:true,timeout,maxBuffer:32768,env:{...process.env,PSModulePath:path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','Modules')}},(error,out)=>error?reject(Error('No se pudo completar la configuración del motor oficial.')):resolve(out.trim())));}
const literal=file=>`[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(file).toString('base64')}'))`;
async function verify(file){const result=await powershell(`$p=${literal(file)};$s=Get-AuthenticodeSignature -LiteralPath $p;if($s.Status -eq 'Valid' -and $s.SignerCertificate.Subject -match '^CN=OpenVPN Inc[.]'){'VERIFIED'}else{'INVALID'}`);if(result!=='VERIFIED')throw Error('La firma del motor no es válida o no pertenece a OpenVPN.');return true;}
async function setup(directory){
 const response=await fetch(INSTALLER,{signal:AbortSignal.timeout(30000)});if(!response.ok||!['swupdate.openvpn.org','swupdate.openvpn.net'].includes(new URL(response.url).hostname))throw Error('No se pudo obtener el instalador oficial.');
 const data=Buffer.from(await response.arrayBuffer());if(data.length<1000000||data.length>20000000)throw Error('El instalador no tiene un tamaño válido.');fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,'OpenVPN-official.msi');fs.writeFileSync(file,data);await verify(file);
 // This runs only after the user explicitly clicks Setup in the application.
 // Windows presents UAC and the official installer. No silent installation.
 const exit=await powershell(`$p=${literal(file)};$r=Start-Process -FilePath msiexec.exe -ArgumentList @('/i',('"'+$p+'"')) -Verb RunAs -WindowStyle Normal -Wait -PassThru;$r.ExitCode`,600000);if(!['0','3010'].includes(exit))throw Error('La configuración se canceló o no pudo completarse.');
 const binary=path.join(process.env.ProgramFiles||'C:\\Program Files','OpenVPN','bin','openvpn.exe');await verify(binary);return binary;
}
module.exports={setup,verify};
