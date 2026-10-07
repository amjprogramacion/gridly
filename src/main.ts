import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { initializeLocalProjects } from './useLocalProjects.ts'
import { initializeCloudAccount } from './useCloudAccount.ts'
// Recover the scene before mounting controls so late reads cannot replace edits.
initializeLocalProjects().then(initializeCloudAccount).finally(() => createApp(App).mount('#app'))
