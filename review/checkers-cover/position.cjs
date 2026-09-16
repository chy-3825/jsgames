const fs=require('fs'), E=require('../../server/games/checkers/engine');
const e=new E('cover',[{id:'teal',name:'青方'},{id:'red',name:'红方'}]);e.start();
let seed=284;const rand=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
const history=[];
for(let turn=0;turn<22;turn++){
 const player=e.players[e.currentTurnIndex], dir=player.id==='teal'?1:-1, choices=[];
 for(const piece of e.boardValuesFor(player)){
  for(const to of e._stepTargets(piece))choices.push({piece,path:[{x:piece.x,y:piece.y},to]});
  const queue=[[{x:piece.x,y:piece.y}]],seen=new Set([`${piece.x},${piece.y}`]);
  while(queue.length){const path=queue.shift(),current=path.at(-1);for(const {to} of e._jumpTargets(current,{from:piece,current})){
   const k=`${to.x},${to.y}`;if(seen.has(k))continue;seen.add(k);const next=[...path,to];choices.push({piece,path:next});queue.push(next);
  }}
 }
 for(const c of choices){const to=c.path.at(-1),from=c.path[0];c.score=dir*(to.y-from.y)*2.5+(Math.abs(from.x-12)-Math.abs(to.x-12))*.25+(dir===1?(8-from.y):(from.y-8))*.12+rand()*1.6;}
 choices.sort((a,b)=>b.score-a.score);const c=choices[0];
 const actions=[{kind:'select',pieceId:c.piece.id},...c.path.slice(1).map(to=>({kind:'move',to}))];
 for(const a of actions){const r=e.handleAction(player.id,a);if(!r.success)throw Error(r.message);}
 if(e.pendingMove){const a={kind:'endMove'};actions.push(a);if(!e.handleAction(player.id,a).success)throw Error('end failed');}
 history.push({playerId:player.id,actions,path:c.path});
}
const replay=new E('replay',[{id:'teal'},{id:'red'}]);replay.start();for(const h of history)for(const a of h.actions)if(!replay.handleAction(h.playerId,a).success)throw Error('replay failed');
const pieces=[...e.board.values()].map(p=>({id:p.id,side:p.playerId,x:p.x,y:p.y}));
fs.writeFileSync(__dirname+'/position.json',JSON.stringify({cells:E.CELLS,pieces,history,plies:history.length},null,2));
console.log(JSON.stringify({plies:history.length,pieces,jumpMoves:history.filter(h=>h.path.length>2).length}));
