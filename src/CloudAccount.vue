<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from './AppIcon.vue'
import { cloudAccount, projectCloudStatus as status, emailMode, requestSignIn, verifyCode, signOut, uploadLocalProject, synchronize, resolveCloudConflict } from './useCloudAccount.ts'
import { currentProject, localProjects, projectTransition, publishProject } from './useLocalProjects.ts'

const dialog = ref<HTMLDialogElement>()
const email = ref(''), token = ref(''), sent = ref(false), busy = ref(false), error = ref('')
const belongsToAccount = computed(() => !!cloudAccount.user && currentProject.value?.accountId === cloudAccount.user.id)
async function action(run: () => Promise<unknown>, close = false) {
  busy.value = true; error.value = ''
  try { await run(); publishProject(); if (close) dialog.value?.close() }
  catch (failure) { error.value = failure instanceof Error ? failure.message : 'No se pudo completar la operación. Tu proyecto se conserva.' }
  finally { busy.value = false }
}
async function send() { await requestSignIn(email.value); sent.value = true }
function show() { error.value = ''; dialog.value?.showModal() }
</script>

<template>
  <div v-if="cloudAccount.configured" class="cloud-account">
    <button :disabled="projectTransition || !cloudAccount.ready" @click="show"><AppIcon name="account"/> {{cloudAccount.user?'Mi cuenta':'Iniciar sesión'}}</button>
  </div>
  <dialog ref="dialog" class="custom-library-dialog account-dialog" aria-labelledby="account-title" @keydown.stop>
    <div class="custom-library-heading"><h2 id="account-title">{{cloudAccount.user?'Mi cuenta':'Iniciar sesión'}}</h2><button aria-label="Cerrar cuenta" :disabled="busy" @click="dialog?.close()"><AppIcon name="close"/></button></div>
    <template v-if="cloudAccount.user">
      <p>{{cloudAccount.user.email}}</p>
      <p class="muted">Los proyectos de tu cuenta se sincronizan entre dispositivos. Los proyectos locales se conservan aquí hasta que los guardes en tu cuenta.</p>
      <p role="status">{{status}}</p>
      <p v-if="cloudAccount.message" class="muted">{{cloudAccount.message}}</p>
      <div v-if="currentProject?.conflict" class="conflict-actions">
        <p>Este proyecto cambió en otro dispositivo. Tu trabajo local se conserva. Antes de cargar la versión de la nube guardaremos una copia local.</p>
        <button class="primary" :disabled="busy" @click="action(()=>resolveCloudConflict(false),true)">Conservar ambos</button>
        <button :disabled="busy" @click="action(()=>resolveCloudConflict(true),true)">Usar la versión de la nube</button>
      </div>
      <button v-else-if="!belongsToAccount" class="primary" :disabled="busy || !localProjects" @click="action(uploadLocalProject,true)"><AppIcon name="cloud"/> Guardar en mi cuenta</button>
      <button v-else :disabled="busy" @click="action(synchronize)">Sincronizar ahora</button>
      <button class="sign-out" :disabled="busy" @click="action(signOut,true)">Cerrar sesión en este dispositivo</button>
    </template>
    <template v-else>
      <p class="muted">Entra con el mismo correo en tus dispositivos para continuar tus proyectos.</p>
      <form @submit.prevent="action(send)">
        <label>Correo electrónico<input v-model="email" aria-label="Correo electrónico" type="email" autocomplete="email" required :disabled="busy"></label>
        <button class="primary" :disabled="busy">{{emailMode==='otp'?'Enviar código':'Enviar enlace de acceso'}}</button>
      </form>
      <p v-if="sent" role="status">{{emailMode==='otp'?'Revisa tu correo e introduce el código.':'Revisa tu correo y abre el enlace de acceso en este dispositivo.'}}</p>
      <form v-if="sent && emailMode==='otp'" @submit.prevent="action(()=>verifyCode(email,token),true)">
        <label>Código de acceso<input v-model="token" aria-label="Código de acceso" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label>
        <button class="primary" :disabled="busy">Entrar</button>
      </form>
    </template>
    <p v-if="error || cloudAccount.authError" role="alert">{{error || cloudAccount.authError}}</p>
  </dialog>
</template>

<style scoped>
.cloud-account { display: flex; align-items: center; gap: 8px; }
.account-dialog { width: min(520px, calc(100vw - 32px)); }
.account-dialog form, .conflict-actions { display: grid; gap: 14px; }
.account-dialog label { display: grid; gap: 8px; margin-bottom: 12px; }
.account-dialog input { width: 100%; min-width: 0; padding: 10px 12px; border: 1px solid #394859; border-radius: 7px; background: #111b27; color: #e1eaf3; }
.sign-out { display: block; margin-top: 20px; }
</style>
