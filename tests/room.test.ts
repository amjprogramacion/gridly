import assert from 'node:assert/strict'
import { state, checkpoint, editRoom, toggleWall, undo, redo, load, defaultRoom } from '../src/editor.ts'
checkpoint();editRoom('width','5000');toggleWall('north');undo();assert.equal(state.room!.walls.north,true);undo();assert.equal(state.room!.width,4000);redo();assert.equal(state.room!.width,5000)
const project={version:2,units:'mm',objects:[],room:{...defaultRoom(),width:6200}}
await load(new File([JSON.stringify(project)],'room.json'));assert.equal(state.room!.width,6200);undo();assert.equal(state.room!.width,5000)
const before=JSON.stringify(state.room)
await load(new File([JSON.stringify({...project,room:{...project.room,width:-1}})],'invalid.json'));assert.equal(JSON.stringify(state.room),before);assert.ok(state.error)
await load(new File([JSON.stringify({version:1,units:'mm',objects:[]})],'legacy.json'));assert.equal(state.room,null);assert.equal(state.error,'');undo();assert.equal(state.room!.width,5000)
console.log('Room history, project loading, legacy compatibility and invalid input passed.')
