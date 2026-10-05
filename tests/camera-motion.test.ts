import assert from 'node:assert/strict'
import { createCameraMotion } from '../src/cameraMotion.ts'
const motion=createCameraMotion()
assert.equal(motion(false,0),false)
assert.equal(motion(true,0),true)
assert.equal(motion(false,3),true)
// Smooth damping need not reach absolute zero or emit a change event.
assert.equal(motion(false,.3),true)
assert.equal(motion(false,.24),true)
assert.equal(motion(false,.22),false)
// Residual changes around the settling threshold cannot make controls blink.
for(const pixels of [.3,.1,.4,.26,.001,0])assert.equal(motion(false,pixels),false)
// Wheel/view changes hide even without a held pointer.
assert.equal(motion(false,5),true)
assert.equal(motion(false,0),true)
assert.equal(motion(false,0),false)
// A single quiet frame during an ongoing motion must not reveal the controls.
assert.equal(motion(false,2),true)
assert.equal(motion(false,.1),true)
assert.equal(motion(false,.4),true)
assert.equal(motion(false,.1),true)
assert.equal(motion(false,.1),false)
assert.equal(motion(true,0),true)
assert.equal(motion(true,0),true)
console.log('Camera motion: prompt settling, hysteresis, residual damping, brief pauses and new gestures passed.')
