import assert from 'node:assert/strict'
import { nextTick } from 'vue'
import { state, defaultRoom, FLOOR_COLOR, editFloorColor, undo, redo, load, projectJSON, startAutosave, AUTOSAVE_KEY } from '../src/editor.ts'
state.room=defaultRoom();state.objects=[]
const walls=state.structuralColor
editFloorColor('#d1c8ba');assert.equal(state.room.floorColor,'#d1c8ba');assert.equal(state.structuralColor,walls)
undo();assert.equal(state.room.floorColor??FLOOR_COLOR,FLOOR_COLOR);redo();assert.equal(state.room.floorColor,'#d1c8ba')
const json=projectJSON();await load(new File([json],'floor.json'));assert.equal(state.room?.floorColor,'#d1c8ba')
const original=JSON.parse(json)
for(const color of [5,'red',null]){await load(new File([JSON.stringify({...original,room:{...original.room,floorColor:color}})],'invalid.json'));assert.ok(state.error);assert.equal(state.room?.floorColor,'#d1c8ba')}
for(const version of [2,3,4,5,6]){await load(new File([JSON.stringify({...original,version,room:defaultRoom()})],'legacy.json'));assert.equal(state.error,'');assert.equal(state.room?.floorColor??FLOOR_COLOR,FLOOR_COLOR)}
const values=new Map<string,string>();const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)}}
const stop=startAutosave(()=>storage);editFloorColor('#77596e');await nextTick();assert.equal(JSON.parse(values.get(AUTOSAVE_KEY)!).room.floorColor,'#77596e');stop.stop()
state.room=defaultRoom();const restored=startAutosave(()=>storage);assert.equal(state.room.floorColor,'#77596e');restored.stop()
console.log('Floor color: independent walls, history, JSON validation, legacy defaults and autosave passed.')
