const test = require('node:test')
const assert = require('node:assert/strict')
const { commands, parseStatusLine } = require('../src/intelix-protocol')

test('builds documented routing and profile commands', () => {
	assert.equal(commands.route(1, 8), 'swi01o08')
	assert.equal(commands.routeAll(7), 'swi07o*')
	assert.equal(commands.loadProfile(3), 'profilef03load')
	assert.equal(commands.saveProfile(32), 'profilef32save')
})

test('builds documented audio and video commands', () => {
	assert.equal(commands.video(4, true), 'swo04on')
	assert.equal(commands.video(4, false), 'swo04off')
	assert.equal(commands.audio(4, true), 'muteo04off')
	assert.equal(commands.audio(4, false), 'muteo04on')
})

test('parses read response status lines', () => {
	assert.deepEqual(parseStatusLine('o01 i08 video on audio off'), { output: 1, input: 8, video: true, audio: false })
	assert.equal(parseStatusLine('unrelated response'), null)
})

test('rejects out-of-range ports and profiles', () => {
	assert.throws(() => commands.route(0, 1), /Input must be between 1 and 8/)
	assert.throws(() => commands.loadProfile(33), /Profile must be between 1 and 32/)
})
