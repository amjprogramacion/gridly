import assert from 'node:assert/strict'
import { syncFailure } from '../src/cloudSync.ts'
assert.equal(syncFailure({code:'22023',message:'Invalid Gridly document (maximum 2 MB)'}).status,'error')
assert.match(syncFailure({code:'22023'}).message,/servidor rechazó/)
assert.equal(syncFailure({code:'42501'}).status,'error')
assert.equal(syncFailure({code:'54000'}).status,'error')
assert.equal(syncFailure(new TypeError('Failed to fetch')).status,'offline')
console.log('Cloud failures: server rejection and permission failures differ from connectivity errors.')
