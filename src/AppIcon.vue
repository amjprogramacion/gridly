<script setup lang="ts">
import { useId } from 'vue'
import { iconPaths, type IconName } from './icons'
defineProps<{name:IconName; path?:string}>()
const markerId=`icon-arrow-${useId()}`
</script>
<template>
 <svg class="app-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <template v-if="name==='rotate'&&path"><defs><marker :id="markerId" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="3.5" markerHeight="3.5" orient="auto-start-reverse"><path d="M0 0L6 3L0 6Z" fill="currentColor" stroke="none"/></marker></defs><path :d="path" transform="scale(.6)" stroke-width="3.333333" :marker-start="`url(#${markerId})`" :marker-end="`url(#${markerId})`"/></template>
  <path v-else v-for="(d,index) in iconPaths[name]" :key="index" :d="d"/>
 </svg>
</template>
