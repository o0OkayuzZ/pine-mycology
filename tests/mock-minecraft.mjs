export class Signal{handlers=[];subscribe(h){this.handlers.push(h);return h;}emit(e){for(const h of this.handlers)h(e);}}
export class Properties{props=new Map();getDynamicProperty(k){return this.props.get(k);}setDynamicProperty(k,v){if(v===undefined)this.props.delete(k);else this.props.set(k,v);}}
export class ItemStack{
 constructor(typeId,amount=1){this.typeId=typeId;this.amount=amount;this.maxAmount=64;this.nameTag='';}
 clone(){const s=new ItemStack(this.typeId,this.amount);s.nameTag=this.nameTag;return s;}
 isStackableWith(other){return this.typeId===other.typeId&&this.nameTag===other.nameTag;}
 getComponent(id){return id==='minecraft:cooldown'?{startCooldown(){}}:undefined;}
}
export class Container{
 constructor(size=36){this.size=size;this.slots=Array(size).fill(undefined);this.failOnceAt=-1;}
 getItem(i){return this.slots[i]?.clone();}
 setItem(i,x){if(i===this.failOnceAt){this.failOnceAt=-1;throw new Error('injected write failure');}this.slots[i]=x?.clone();}
}
export class Dimension{
 id='minecraft:overworld';drops=[];particles=[];failDrop=false;
 spawnItem(item,loc){if(this.failDrop)throw new Error('injected spawnItem failure');this.drops.push({item:item.clone(),loc:{...loc}});return {};}
 spawnParticle(id,loc){this.particles.push({id,loc});}
 getEntities(query={}){return [...world.entities.values()].filter(x=>x.dimension===this&&(!query.type||x.typeId===query.type)&&!(query.excludeTypes??[]).includes(x.typeId)).slice(0,query.closest??Infinity);}
 getBiome(){return {id:'minecraft:plains',hasTags:()=>false};}
 getTopmostBlock({x,z}){return {location:{x,y:63,z},typeId:'minecraft:grass_block'};}
 getBlock({x,y,z}){return y>=64?{isAir:true,typeId:'minecraft:air'}:{isAir:false,typeId:'minecraft:stone'};}
 spawnEntity(typeId,location){const e=new FakeEntity('npc-'+world.entities.size,typeId,this);e.location=location;world.entities.set(e.id,e);return e;}
}
export class FakeEntity extends Properties{
 constructor(id,typeId='minecraft:player',dim){super();this.id=id;this.typeId=typeId;this.dimension=dim??new Dimension();this.isValid=true;this.location={x:0,y:64,z:0};this.c=new Container();this.selectedSlotIndex=0;this.effects=new Map();this.health=20;this.messages=[];}
 getComponent(id){if(id==='minecraft:inventory')return {container:this.c};if(id==='minecraft:health')return {currentValue:this.health,setCurrentValue:n=>{this.health=n;}};}
 getGameMode(){return 'Survival';}getEffect(id){return this.effects.get(id);}addEffect(id,duration,opts){this.effects.set(id,{duration,...opts});}
 kill(){this.health=0;world.afterEvents.entityDie.emit({deadEntity:this});}
 remove(){this.isValid=false;world.entities.delete(this.id);}
 sendMessage(m){this.messages.push(m);}hasTag(){return false;}
}
class World extends Properties{
 entities=new Map();afterEvents=Object.fromEntries(['entityLoad','entityDie','playerLeave','playerSpawn','worldLoad','itemCompleteUse','playerInteractWithEntity'].map(k=>[k,new Signal()]));
 getAllPlayers(){return [...this.entities.values()].filter(x=>x.typeId==='minecraft:player');}getEntity(id){return this.entities.get(id);}getDimension(){return [...this.entities.values()][0]?.dimension??new Dimension();}
}
export const world=new World();let next=1;
export const system={currentTick:0,beforeEvents:{startup:new Signal()},afterEvents:{scriptEventReceive:new Signal()},timers:new Map(),intervals:new Map(),run:f=>f(),runTimeout(f,ticks){const n=next++;this.timers.set(n,{f,ticks});return n;},runInterval(f,ticks){const n=next++;this.intervals.set(n,{f,ticks});return n;},clearRun(id){this.timers.delete(id);this.intervals.delete(id);}};
export function reset(){world.props.clear();world.entities.clear();system.timers.clear();system.intervals.clear();system.currentTick=0;}
