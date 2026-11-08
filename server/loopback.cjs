'use strict';
async function listenLoopback(server,preferred=0,fallback=false){
 const ports=fallback&&preferred!==0?[preferred,0,0]:[preferred];
 for(let index=0;index<ports.length;index++){
  try{await new Promise((resolve,reject)=>{
   const failed=error=>{server.removeListener('error',failed);reject(error);};
   server.once('error',failed);
   try{server.listen(ports[index],'127.0.0.1',()=>{server.removeListener('error',failed);resolve();});}catch(error){failed(error);}
  });return;}catch(error){if(index===ports.length-1||!['EADDRINUSE','EACCES','EPERM'].includes(error.code))throw error;}
 }
}
module.exports={listenLoopback};
