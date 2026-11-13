function groupKey(item){return item.isSeries||item.kind==='serie'||item.type==='series'?'series:'+String(item.title||'').replace(/\s*(?:-|–|—)?\s*(?:T(?:emp(?:orada)?)?\.?|Season)\s*\d+\s*$/i,'').trim().toLocaleLowerCase():'movie:'+item.id;}
function updateHistory(history,item,episode,position,duration=0,episodeName=''){if(!item||item.live||position<5)return history;const id=groupKey(item);return[{id,item,episode,episodeName,position,duration,at:Date.now()},...history.filter(r=>(r.id||groupKey(r.item))!==id)].slice(0,40);}
function nextEpisode(episodes,id){const index=episodes.findIndex(e=>e.id===id);return index>=0?episodes[index+1]||null:null;}
function shouldPrepareNext(position,duration){return Number.isFinite(duration)&&duration>60&&position>=duration-60&&position<duration;}
module.exports={groupKey,updateHistory,nextEpisode,shouldPrepareNext};
