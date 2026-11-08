'use strict';
const fs=require('node:fs'),path=require('node:path');
class PrivateVault{
 constructor({file,safeStorage}){this.file=file;this.safeStorage=safeStorage;}
 read(){if(!fs.existsSync(this.file))return{};if(!this.safeStorage.isEncryptionAvailable())throw Error('No está disponible el cifrado del sistema.');return JSON.parse(this.safeStorage.decryptString(fs.readFileSync(this.file)));}
 write(value){if(!this.safeStorage.isEncryptionAvailable())throw Error('No está disponible el cifrado del sistema. No se guardaron credenciales.');fs.mkdirSync(path.dirname(this.file),{recursive:true});const blob=this.safeStorage.encryptString(JSON.stringify(value));fs.writeFileSync(this.file+'.tmp',blob,{mode:0o600});fs.renameSync(this.file+'.tmp',this.file);}
}
module.exports={PrivateVault};
