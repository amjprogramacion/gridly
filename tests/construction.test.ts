import assert from 'node:assert/strict'
import { state, add, edit, editRoom, checkpoint, undo, redo, load, save, defaultRoom, normalizeOpening } from '../src/editor.ts'
state.collisions=false
import { wallPanels, visibleWallSides, wallPanelVisible } from '../src/walls.ts'
state.room=defaultRoom();state.objects=[]
add('door');const door=state.objects[0]!;assert.equal(door.type,'door');assert.equal(door.z,-1810);assert.equal(door.y,0)
edit('width','1100');edit('offset','800');assert.equal(door.width,1100);assert.equal(door.x,-1200)
const panels=wallPanels(state.room!,'north',state.objects)
const area=panels.reduce((sum,p)=>sum+p.width*p.height,0)
assert.equal(area,(4000+240)*2500-1100*2100)
assert.ok(!panels.some(p=>800>p.start&&800<p.start+p.width&&1000>p.bottom&&1000<p.bottom+p.height))
add('window');edit('wall','east');edit('y','900');assert.equal(state.objects[1]!.x,2060);assert.equal(state.objects[1]!.y,900)
add('column');edit('height','2200');assert.equal(state.objects[2]!.height,2200)
add('beam');edit('width','3200');edit('depth','400');assert.equal(state.objects[3]!.width,3200);assert.equal(state.objects[3]!.depth,400)
checkpoint();editRoom('width','700');assert.equal(state.room!.width,4000);assert.ok(state.error);state.objects=state.objects.filter(o=>o.type==='door'||o.type==='window');checkpoint();editRoom('width','700');editRoom('height','1500');assert.equal(state.objects[0]!.width,700);assert.equal(state.objects[0]!.height,1500);assert.ok(state.objects[1]!.y+state.objects[1]!.height<=1500);undo();assert.equal(state.room!.width,4000);redo();assert.equal(state.room!.width,700)
state.room=defaultRoom();state.objects.forEach(o=>normalizeOpening(o,state.room!))
const project={version:3,units:'mm',objects:JSON.parse(JSON.stringify(state.objects)),room:defaultRoom()}
await load(new File([JSON.stringify(project)],'construction.json'));assert.equal(state.error,'');assert.equal(state.objects.length,2);assert.equal(state.objects[1]!.wall,'east')
const before=JSON.stringify(state.objects)
await load(new File([JSON.stringify({...project,objects:[{...project.objects[0],wall:'invalid'}]})],'invalid.json'));assert.ok(state.error);assert.equal(JSON.stringify(state.objects),before)
let savedBlob:Blob|undefined
const originalURL=URL.createObjectURL;URL.createObjectURL=blob=>{savedBlob=blob;return 'blob:test'};URL.revokeObjectURL=()=>{}
;(globalThis as any).document={createElement:()=>({click(){},href:'',download:''})}
save();const saved=JSON.parse(await savedBlob!.text());assert.equal(saved.version,6);assert.equal(saved.objects.length,2);assert.equal(saved.room.width,4000);URL.createObjectURL=originalURL
console.log('Openings, wall cutouts, editable dimensions, room resizing, history and project persistence passed.')
const overlapRoom=defaultRoom()
const overlapA={...project.objects[0],wall:'north' as const,offset:1500,width:1000,height:2100,y:0}
const overlapB={...overlapA,id:'other',offset:1800}
assert.equal(wallPanels(overlapRoom,'north',[overlapA,overlapB]).reduce((sum,p)=>sum+p.width*p.height,0),4240*2500-1300*2100)


// Hidden or disabled adjoining walls must leave no corner filler at the exposed end.
const cutawayRoom=defaultRoom(),wholeWall=wallPanels(cutawayRoom,'north',[])
for(const x of [-10000,0,10000]){
 const visible=visibleWallSides(cutawayRoom,{x,z:10000})
 const drawn=wholeWall.filter(panel=>wallPanelVisible(cutawayRoom,'north',panel,visible))
 assert.equal(drawn.reduce((sum,panel)=>sum+panel.width,0),4000+(x>=-2060?120:0)+(x<=2060?120:0))
 assert.equal(drawn.some(panel=>panel.start<0),visible.west)
 assert.equal(drawn.some(panel=>panel.start>=4000),visible.east)
 assert.equal(wallPanelVisible(cutawayRoom,'south',wholeWall[0]!,visible),false)
}
const disabled={...cutawayRoom,walls:{...cutawayRoom.walls,west:false,east:false}}
const disabledVisible=visibleWallSides(disabled,{x:0,z:0})
assert.equal(wholeWall.filter(panel=>wallPanelVisible(disabled,'north',panel,disabledVisible)).reduce((sum,panel)=>sum+panel.width,0),4000)
// Removing camera-only fillers leaves the opening's original cells unchanged.
const opened=wallPanels(cutawayRoom,'north',[overlapA])
const cutaway=visibleWallSides(disabled,{x:0,z:0})
assert.equal(opened.filter(panel=>wallPanelVisible(cutawayRoom,'north',panel,cutaway)).reduce((sum,panel)=>sum+panel.width*panel.height,0),4000*2500-1000*2100)
console.log('Wall cutaway: visible corner joins, hidden/disabled neighbours and opening preservation passed.')
