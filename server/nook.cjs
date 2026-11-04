function nookAdapter(config){
 if(!config)return null;
 const origin=new URL(config.origin||'http://127.0.0.1:8796');
 if(!['127.0.0.1','localhost','[::1]'].includes(origin.hostname))throw Error('NOOK TV debe usar su API local.');
 async function request(route,data){
  const response=await fetch(new URL(route,origin),{method:data===undefined?'GET':'POST',headers:{'Tailscale-User-Login':config.owner,'Origin':config.publicOrigin||origin.origin,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(30000)});
  const json=await response.json();if(!response.ok)throw Error(json.error||'NOOK TV no respondió.');return json;
 }
 return {request,config};
}
module.exports={nookAdapter};
