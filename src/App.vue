<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import { imageTexture } from './textures.ts'
import { setObjectTexture, canEditAppearance, hasTexture, type Box } from './editor.ts'
import type { IconName } from './icons'
import Viewport from './Viewport.vue'
import CustomThumbnail from './CustomThumbnail.vue'
import LocalProjects from './LocalProjects.vue'
import CloudAccount from './CloudAccount.vue'
import { cloudAccount, projectCloudStatus } from './useCloudAccount.ts'
import { projectTransition } from './useLocalProjects.ts'
import { state, customEditing, customEditingId, beginCustomObject, saveCustomObject, cancelCustomObject, insertCustomObject, selected, selection, selectObject, canGroup, canUngroup, groupSelected, ungroupSelected, collisionSelection, history, checkpoint, add, duplicate, copySelection, pasteSelection, remove, edit, undo, redo, save, load, createRoom, editRoom, toggleBaseboard, toggleCollisions, editStructuralColor, editFloorColor, editProjectName, FLOOR_COLOR, WALL_COLOR, isStructural, isOpening, type ObjectKind } from './editor'
const viewport=ref<InstanceType<typeof Viewport>>();const file=ref<HTMLInputElement>();const currentView=ref('Perspectiva')
const libraryOpen=ref(false),libraryDialog=ref<HTMLDialogElement>(),libraryError=ref(''),customName=ref(state.customObjects.find(entry=>entry.id===customEditingId.value)?.name??''),previousView=ref('Perspectiva')
watch(libraryOpen,async open=>{await nextTick();if(open&&!libraryDialog.value?.open)libraryDialog.value?.showModal();else if(!open&&libraryDialog.value?.open)libraryDialog.value.close()})
function openCustomLibrary(){libraryError.value='';libraryOpen.value=true;paletteOpen.value=false}
function startCustom(id?:string){const name=state.customObjects.find(entry=>entry.id===id)?.name??'';if(!beginCustomObject(id))return;libraryOpen.value=false;roomEditorOpen.value=false;customName.value=name;previousView.value=currentView.value;currentView.value='Perspectiva'}
function finishCustom(){if(saveCustomObject(customName.value)){currentView.value=previousView.value;openCustomLibrary()}}
function leaveCustom(){cancelCustomObject();currentView.value=previousView.value;openCustomLibrary()}
function insertCustom(id:string){if(insertCustomObject(id))libraryOpen.value=false;else{libraryError.value=state.error;state.error=''}}
const workshopTemplates=computed(()=>state.customObjects.filter(entry=>entry.id!==customEditingId.value))
function addWorkshopTemplate(e:Event){const input=e.target as HTMLSelectElement;insertCustomObject(input.value);input.value=''}
const editingProjectName=ref(false),projectNameDraft=ref(''),projectNameInput=ref<HTMLInputElement>()
async function startProjectNameEdit(){projectNameDraft.value=state.projectName;editingProjectName.value=true;await nextTick();projectNameInput.value?.focus();projectNameInput.value?.select()}
function saveProjectName(){if(!projectNameDraft.value.trim())return;editProjectName(projectNameDraft.value);editingProjectName.value=false}
// Temporarily hidden toolbar switches; restore them in a future UI step.
const showToolbarCheckboxes=false
const roomEditorOpen=ref(false)
function toggleRoomEditor(){roomEditorOpen.value=!roomEditorOpen.value;paletteOpen.value=false}
watch(()=>state.room,room=>{if(!room)roomEditorOpen.value=false})
const paletteOpen=ref(false),colorControl=ref<HTMLElement>()
const textureFile=ref<HTMLInputElement>(),textureLoading=ref(false)
let textureTarget:Box|undefined
function chooseTexture(){textureTarget=selected.value;textureFile.value?.click()}
async function attachTexture(e:Event){
 const input=e.target as HTMLInputElement,file=input.files?.[0],target=textureTarget;input.value=''
 if(!file||!target)return
 textureLoading.value=true
 try{
  const texture=await imageTexture(file)
  if(selected.value!==target||!furnitureMode.value||!state.objects.includes(target))return
  setObjectTexture(target.id,texture)
 }catch(failure){state.error=failure instanceof Error&&failure.name==='Error'?failure.message:'No se pudo leer la imagen. Elige otra imagen PNG, JPG o WebP.'}
 finally{textureLoading.value=false}
}
const materialColors=[{name:'Blanco',value:'#f2f1ed'},{name:'Arena',value:'#d1c8ba'},{name:'Beige',value:'#e4d5c8'},{name:'Terracota',value:'#ad5b20'},{name:'Teja',value:'#915845'},{name:'Azul claro',value:'#bbcbd0'},{name:'Azul grisáceo',value:'#68858f'},{name:'Oliva',value:'#929879'},{name:'Gris',value:'#85867e'},{name:'Topo',value:'#9e897c'},{name:'Malva',value:'#77596e'}]
const basicColors=[{name:'Blanco',value:'#ffffff'},{name:'Negro',value:'#202020'},{name:'Gris',value:'#808080'},{name:'Rojo',value:'#e53935'},{name:'Naranja',value:'#fb8c00'},{name:'Amarillo',value:'#fdd835'},{name:'Verde',value:'#43a047'},{name:'Cian',value:'#00acc1'},{name:'Azul',value:'#1e88e5'},{name:'Violeta',value:'#8e24aa'},{name:'Rosa',value:'#ec407a'}]
const furnitureMode=computed(()=>!customEditing.value&&!roomEditorOpen.value)
const paletteColors=computed(()=>furnitureMode.value?basicColors:materialColors)
const surfaceColorTarget=ref<'walls'|'floor'>('walls')
const floorPalette=computed(()=>structurePalette.value&&surfaceColorTarget.value==='floor')
const structurePalette=computed(()=>!customEditing.value&&roomEditorOpen.value&&(!selected.value||isStructural(selected.value)))
const paletteEnabled=computed(()=>structurePalette.value||!!selected.value&&(selected.value.type!=='group'||canEditAppearance(selected.value)))
const selectedHasTexture=computed(()=>!!selected.value&&hasTexture(selected.value))
const paletteColor=computed(()=>floorPalette.value?(state.room?.floorColor??FLOOR_COLOR):structurePalette.value?state.structuralColor:selected.value?.color)
function applyPaletteColor(color:string){if(!paletteEnabled.value)return;if(floorPalette.value)editFloorColor(color);else if(structurePalette.value)editStructuralColor(color);else edit('color',color)}
function resetPaletteColor(){applyPaletteColor(floorPalette.value?FLOOR_COLOR:structurePalette.value?WALL_COLOR:selected.value?.type==='door'?'#b78b61':selected.value?.type==='window'?'#7faec6':'#779b8e')}
function dismissPalette(e:PointerEvent){if(!colorControl.value?.contains(e.target as Node))paletteOpen.value=false}
watch(()=>state.selected,()=>paletteOpen.value=false)
watch(paletteEnabled,enabled=>{if(!enabled)paletteOpen.value=false})
const roomFields:{key:'width'|'depth'|'height';label:string}[]=[{key:'width',label:'Anchura'},{key:'depth',label:'Profundidad'},{key:'height',label:'Altura'}]
const workshopFields=[{title:'Tamaño',fields:[{key:'width',label:'Anchura (X)'},{key:'height',label:'Altura (Y)'},{key:'depth',label:'Profundidad (Z)'}]},{title:'Posición',fields:[{key:'x',label:'X'},{key:'y',label:'Y'},{key:'z',label:'Z'}]}] as const
function changeWorkshopField(e:Event,key:'width'|'height'|'depth'|'x'|'y'|'z'){edit(key,input(e));resetInput(e,selected.value?.[key])}
const additions:{type:ObjectKind;label:string;icon:IconName}[]=[{type:'door',label:'Puerta',icon:'door'},{type:'window',label:'Ventana',icon:'window'},{type:'column',label:'Columna',icon:'column'},{type:'beam',label:'Viga',icon:'beam'}]
const visibleObjects=computed(()=>state.objects.filter(object=>roomEditorOpen.value===additions.some(item=>item.type===object.type)))
const editableObjectIds=computed(()=>visibleObjects.value.map(object=>object.id))
watch([editableObjectIds,selection],()=>{if(selection.value.some(object=>!editableObjectIds.value.includes(object.id)))selectObject('')})
function changeCollisions(e:Event){toggleCollisions();(e.target as HTMLInputElement).checked=collisionSelection.value.checked;(e.target as HTMLInputElement).indeterminate=collisionSelection.value.mixed}
function resetInput(e:Event,value:unknown){(e.target as HTMLInputElement).value=String(value??'')}
function resetRoomInput(e:Event,key:'width'|'depth'|'height'|'thickness'){resetInput(e,state.room?.[key])}
function input(e:Event){return (e.target as HTMLInputElement).value}
function changeView(){viewport.value?.view(currentView.value)}
const workshopSnap=computed({get:()=>state.snap?String(state.step):'disabled',set:(value:string)=>{if(!customEditing.value)return;if(value==='disabled')state.snap=false;else if(['5','10','50','100'].includes(value)){state.step=Number(value);state.snap=true}}})
function textTarget(target:EventTarget|null){return target instanceof HTMLElement&&!!target.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"])')}
function pasteTypes():ObjectKind[]{return roomEditorOpen.value?additions.map(item=>item.type):['box','cylinder','group']}
function copyEvent(e:ClipboardEvent){if(libraryOpen.value||textTarget(e.target))return;if(copySelection()){e.preventDefault();e.clipboardData?.setData('text/plain',selection.value.map(object=>object.name).join('\n'))}}
function pasteEvent(e:ClipboardEvent){if(libraryOpen.value||textTarget(e.target))return;e.preventDefault();pasteSelection(pasteTypes())}
function key(e:KeyboardEvent){
 if(projectTransition.value)return
 if(libraryOpen.value)return
 if(e.key==='Escape'&&paletteOpen.value){paletteOpen.value=false;e.preventDefault();return}
 if(e.key==='Escape'&&roomEditorOpen.value){roomEditorOpen.value=false;e.preventDefault();return}
 if(textTarget(e.target))return
 const command=e.ctrlKey||e.metaKey,key=e.key.toLowerCase()
 if(command&&!e.altKey){
  if(key==='z'){e.preventDefault();e.shiftKey?redo():undo();return}
  if(key==='d'){e.preventDefault();duplicate();return}
  if(key==='c'){copySelection();return}
  if(key==='v'){e.preventDefault();pasteSelection(pasteTypes());return}
 }
 if(!command&&!e.altKey){
  if(customEditing.value&&selected.value&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
   e.preventDefault();viewport.value?.nudge(e.key);return
  }
  if(key==='r'&&selected.value&&!isOpening(selected.value))state.transformMode='rotate'
  if(key==='w')state.transformMode='translate'
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove()}
 }
 if(e.key==='Escape')selectObject('')
}
watch(selected,object=>{if(!object||isOpening(object))state.transformMode='translate'})
onMounted(()=>{window.addEventListener('keydown',key);window.addEventListener('copy',copyEvent);window.addEventListener('paste',pasteEvent);window.addEventListener('pointerdown',dismissPalette)});onBeforeUnmount(()=>{window.removeEventListener('keydown',key);window.removeEventListener('copy',copyEvent);window.removeEventListener('paste',pasteEvent);window.removeEventListener('pointerdown',dismissPalette)})
</script>
<template>
<div class="app" :inert="projectTransition"><header><a class="brand" href="/"><AppIcon name="grid"/><span>gridly<span class="dot">.</span></span></a><div v-if="!customEditing" class="project-name"><form v-if="editingProjectName" class="project-name-editor" @submit.prevent="saveProjectName"><input ref="projectNameInput" v-model="projectNameDraft" aria-label="Nombre del proyecto" maxlength="120" required @keydown.esc.stop="editingProjectName=false"><button type="submit" class="project-name-save" aria-label="Guardar nombre del proyecto" title="Guardar nombre del proyecto" :disabled="!projectNameDraft.trim()"><AppIcon name="save"/></button></form><button v-else class="project-name-button" title="Editar nombre del proyecto" @click="startProjectNameEdit">{{state.projectName}}</button><span v-if="cloudAccount.configured" class="project-cloud-status" role="status">{{projectCloudStatus}}</span></div><form v-else class="custom-name-editor" @submit.prevent="finishCustom"><input v-model="customName" aria-label="Nombre del objeto personalizado" placeholder="Nombre del objeto" maxlength="120" required><button type="submit" class="primary" :disabled="!customName.trim()||!state.objects.length"><AppIcon name="save"/>Guardar objeto</button><button type="button" @click="leaveCustom"><AppIcon name="back"/>Volver a la habitación</button></form><div v-if="!customEditing" class="header-actions"><LocalProjects/><button @click="file?.click()"><AppIcon name="open"/> Abrir</button><button class="primary" @click="save"><AppIcon name="download"/> Descargar proyecto</button><CloudAccount/><input ref="file" hidden type="file" accept=".json" @change="e=>{const f=(e.target as HTMLInputElement).files?.[0];if(f)load(f);(e.target as HTMLInputElement).value=''}"></div></header>
<div class="workspace"><aside class="objects-panel"><section class="sidebar-card add-shapes-card" :aria-label="customEditing?'Formas':roomEditorOpen?'Construcción':'Muebles'"><div class="construction-title">{{customEditing?'FORMAS':roomEditorOpen?'CONSTRUCCIÓN':'MUEBLES'}}</div><div class="construction-buttons"><template v-if="roomEditorOpen"><button v-for="item in additions" :key="item.type" :disabled="(item.type==='door'||item.type==='window')&&!state.room" @click="add(item.type)"><AppIcon :name="item.icon"/> {{item.label}}</button><button class="baseboard-button" :disabled="!state.room" :aria-pressed="!!state.room?.baseboard" @click="toggleBaseboard"><AppIcon name="baseboard"/> {{state.room?.baseboard?'Quitar rodapié':'Rodapié'}}</button></template><template v-else><button v-if="!state.room && !customEditing" @click="createRoom"><AppIcon name="plus"/> Crear habitación</button><button @click="add('box')"><AppIcon name="box"/> Prisma</button><button @click="add('cylinder')"><AppIcon name="cylinder"/> Cilindro</button><div v-if="customEditing" class="icon-select workshop-template-select"><AppIcon name="custom"/><select aria-label="Añadir forma personalizada" :disabled="!workshopTemplates.length" value="" @change="addWorkshopTemplate"><option value="" disabled>{{workshopTemplates.length?'Añadir forma personalizada':'Sin formas personalizadas'}}</option><option v-for="entry in workshopTemplates" :key="entry.id" :value="entry.id">{{entry.name}}</option></select><AppIcon name="chevron"/></div><button v-if="!customEditing" class="custom-shape-button" @click="openCustomLibrary"><AppIcon name="custom"/><span>Personalizado</span></button></template></div></section><section class="sidebar-card existing-shapes-card" aria-label="Elementos incluidos"><div class="construction-title">ELEMENTOS</div><div class="object-list"><button v-for="o in visibleObjects" :key="o.id" :class="['object-row',{active:selection.some(item=>item.id===o.id)}]" @click="e=>selectObject(o.id,e.ctrlKey||e.metaKey||e.shiftKey)"><AppIcon class="object-icon" :name="o.type??'box'"/><span>{{o.name}}</span><span class="swatch" :style="{background:o.color}"></span></button><p v-if="!visibleObjects.length" class="muted">{{customEditing?'No hay formas añadidas.':roomEditorOpen?'No hay elementos de construcción.':'No hay muebles añadidos.'}}</p></div></section></aside>
<main><div class="canvas-wrap"><Viewport ref="viewport" :editable-object-ids="editableObjectIds" :workshop="customEditing" :construction="roomEditorOpen"/><div v-if="state.error || state.autosaveError" role="alert" class="error workspace-alert"><span>{{state.error || state.autosaveError}}</span><button type="button" class="dismiss-alert" aria-label="Cerrar aviso" title="Cerrar aviso" @click="state.error='';state.autosaveError=''"><AppIcon name="close"/></button></div><div class="toolbar" role="toolbar" aria-label="Herramientas del plano"><div class="toolbar-group"><button aria-label="Deshacer" title="Deshacer (Ctrl+Z)" :disabled="!history.undo" @click="undo"><AppIcon name="undo"/></button><button aria-label="Rehacer" title="Rehacer (Ctrl+Mayús+Z)" :disabled="!history.redo" @click="redo"><AppIcon name="redo"/></button></div><span class="separator" aria-hidden="true"></span><div class="toolbar-group"><button class="group-action" :disabled="!selection.length" @click="duplicate" title="Duplicar selección (Ctrl/Cmd+D)"><AppIcon name="duplicate"/>Duplicar</button><button class="group-action" :disabled="!canGroup" @click="groupSelected" title="Agrupar selección"><AppIcon name="group"/>Agrupar</button><button class="group-action" :disabled="!canUngroup" @click="ungroupSelected"><AppIcon name="ungroup"/>Desagrupar</button></div><span v-if="showToolbarCheckboxes" class="separator" aria-hidden="true"></span><div v-if="showToolbarCheckboxes" class="toolbar-group"><label class="snap" title="Activar o desactivar las colisiones de los elementos opcionales. Vigas y columnas colisionan con otros tipos, pero pueden solaparse entre sí. Un estado mixto indica ajustes individuales."><input :checked="collisionSelection.checked" :indeterminate="collisionSelection.mixed" :aria-checked="collisionSelection.mixed?'mixed':collisionSelection.checked" type="checkbox" @change="changeCollisions"> Colisiones</label><label class="snap" title="Ajustar movimientos y tamaños en pasos de 50 mm; giros en pasos de 15°"><input v-model="state.snap" type="checkbox"> Snap</label><label class="snap" title="Ajustar caras a paredes, suelo y altura de la habitación (60 mm)"><input v-model="state.wallSnap" :disabled="!state.snap" type="checkbox"> Paredes</label></div><span class="separator" aria-hidden="true"></span><div ref="colorControl" class="color-control"><button aria-label="Selector de colores" :title="floorPalette?'Color del suelo':structurePalette?'Color de paredes, vigas y columnas':'Color del elemento seleccionado'" :disabled="!paletteEnabled" :aria-expanded="paletteOpen" aria-controls="toolbar-color-palette" :class="{active:paletteOpen}" @click="paletteOpen=!paletteOpen"><AppIcon name="palette"/></button><div v-if="paletteOpen" id="toolbar-color-palette" class="color-palette" role="group" :aria-label="floorPalette?'Color del suelo':structurePalette?'Color de la estructura':'Color del elemento'"><div v-if="structurePalette" class="surface-color-target"><button :aria-pressed="surfaceColorTarget==='walls'" @click="surfaceColorTarget='walls'">Paredes</button><button :disabled="!state.room" :aria-pressed="surfaceColorTarget==='floor'" @click="surfaceColorTarget='floor'">Suelo</button></div><button class="color-swatch reset-color" aria-label="Restaurar color original" title="Restaurar color original" @click="resetPaletteColor"><AppIcon name="reset"/></button><button v-for="color in paletteColors" :key="color.value" class="color-swatch" :style="{backgroundColor:color.value}" :aria-label="color.name" :title="color.name" :aria-pressed="!selectedHasTexture && paletteColor?.toLowerCase()===color.value" @click="applyPaletteColor(color.value)"></button><div v-if="furnitureMode && paletteEnabled" class="texture-actions"><button :disabled="textureLoading" @click="chooseTexture"><AppIcon name="image"/>{{textureLoading?'Preparando imagen…':'Texturizar'}}</button><button v-if="selectedHasTexture" :disabled="textureLoading" title="Quitar textura" @click="setObjectTexture(selected!.id)"><AppIcon name="trash"/>Quitar textura</button><input ref="textureFile" hidden type="file" accept="image/png,image/jpeg,image/webp" @change="attachTexture"></div></div></div><span class="separator" aria-hidden="true"></span><div class="icon-select"><select v-model="currentView" aria-label="Vista de cámara" @change="changeView"><option>Perspectiva</option><option>Superior</option><option>Frontal</option><option>Lateral</option></select><AppIcon name="chevron"/></div><div v-if="customEditing" class="icon-select"><select v-model="workshopSnap" aria-label="Snap del constructor" title="Paso de movimiento y tamaño; giros de 15° con Snap activo"><option value="5">Snap: 5 mm</option><option value="10">Snap: 10 mm</option><option value="50">Snap: 50 mm</option><option value="100">Snap: 100 mm</option><option value="disabled">Snap: deshabilitado</option></select><AppIcon name="chevron"/></div><span v-if="!customEditing" class="separator" aria-hidden="true"></span><button v-if="!customEditing" class="edit-room-button" :class="{active:roomEditorOpen}" :disabled="!state.room" :aria-expanded="roomEditorOpen" aria-controls="room-editor" @click="toggleRoomEditor"><AppIcon :name="roomEditorOpen?'check':'room'"/>{{roomEditorOpen?'Confirmar edición':'Editar estancia'}}</button></div></div></main>
<aside v-if="customEditing && selected" :key="selected.id" class="properties workshop-properties" aria-label="Propiedades del elemento"><h2>{{selected.name}}</h2><section v-for="block in workshopFields" :key="block.title" class="workshop-property-block" :aria-label="block.title"><h3>{{block.title}}</h3><label v-for="f in block.fields" :key="f.key" class="field">{{f.label}}<div class="number-field"><input type="number" :aria-label="block.title+' '+f.label" :min="block.title==='Tamaño'?1:f.key==='y'?0:-100000" max="100000" step="any" :value="Math.round(selected[f.key]*1000)/1000" @blur="e=>changeWorkshopField(e,f.key)" @keydown.enter="e=>(e.target as HTMLInputElement).blur()"><span>mm</span></div></label></section><p class="muted">X y Z: centro del elemento. Y: punto más bajo.</p></aside><aside v-if="roomEditorOpen && state.room" id="room-editor" class="properties room-editor" aria-label="Editar estancia"><label v-for="f in roomFields" :key="f.key" class="field">{{f.label}}<div class="number-field"><input type="number" min="1" max="100000" step="50" :value="state.room[f.key]" @focus="checkpoint" @input="e=>editRoom(f.key,input(e))" @blur="e=>resetRoomInput(e,f.key)"><span>mm</span></div></label></aside></div><dialog ref="libraryDialog" class="custom-library-dialog" @cancel="libraryOpen=false" @close="libraryOpen=false" aria-labelledby="custom-library-title"><div class="custom-library-heading"><h2 id="custom-library-title">Objetos personalizados</h2><button aria-label="Cerrar objetos personalizados" @click="libraryOpen=false"><AppIcon name="close"/></button></div><button class="primary create-custom-button" @click="startCustom()"><AppIcon name="plus"/> Crear objeto personalizado</button><p v-if="libraryError" class="library-error" role="alert">{{libraryError}}</p><div v-if="state.customObjects.length" class="custom-library-grid"><div v-for="entry in state.customObjects" :key="entry.id" class="custom-library-card"><button class="custom-library-item" :aria-label="'Añadir '+entry.name" @click="insertCustom(entry.id)"><CustomThumbnail :object="entry.object"/><span>{{entry.name}}</span></button><button class="edit-custom-button" :aria-label="'Editar '+entry.name" :title="'Editar '+entry.name" @click="startCustom(entry.id)"><AppIcon name="edit"/></button></div></div><p v-else class="muted">Crea tu primer objeto combinando prismas y cilindros.</p></dialog></div>
</template>





