const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const test = require('node:test')
const Module = require('node:module')
const InstanceStatus = { Ok: 'ok', ConnectionFailure: 'connection_failure' }
const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
	if (request === '@companion-module/base') return { InstanceStatus }
	return originalLoad.call(this, request, parent, isMain)
}
const { DcpClient, MM4D_INVENTORY_KEYS, parseParameters } = require('../src/dcp-client')
Module._load = originalLoad

class FakeSocket extends EventEmitter {
	constructor() {
		super()
		this.sent = []
		this.destroyed = false
	}
	async sendAsync(value) {
		this.sent.push(value)
		return true
	}
	destroy() {
		this.destroyed = true
	}
}

function nextTick() {
	return new Promise((resolve) => setImmediate(resolve))
}

function makeClient(overrides = {}) {
	const socket = new FakeSocket()
	const statuses = []
	const states = []
	const client = new DcpClient({
		host: '192.0.2.10',
		port: 54726,
		password: 'do-not-log-this',
		socketFactory: () => socket,
		log: () => undefined,
		status: (...args) => statuses.push(args),
		onState: (state) => states.push(state),
		keepaliveMs: 60000,
		...overrides,
	})
	return { client, socket, statuses, states }
}

test('parses quoted values without splitting names on spaces', () => {
	assert.deepEqual(parseParameters('CID:00000001 DEVICE/NAME:"Meeting Room 1" DEVICE/SAMPLE:48000'), {
		CID: '00000001',
		'DEVICE/NAME': 'Meeting Room 1',
		'DEVICE/SAMPLE': '48000',
	})
})

test('performs the documented login without logging the password', async () => {
	const logs = []
	const { client, socket, statuses } = makeClient({ log: (...entry) => logs.push(entry.join(' ')) })
	client.refreshInventory = async () => ({ failures: [] })
	client.connect()
	socket.emit('connect')
	await nextTick()
	assert.deepEqual(socket.sent, ['\r\n'])

	socket.emit('data', Buffer.from('Enter Pass'))
	socket.emit('data', Buffer.from('word\r\n'))
	await nextTick()
	assert.equal(socket.sent[1], 'do-not-log-this\r\n')
	assert.equal(logs.join('\n').includes('do-not-log-this'), false)

	socket.emit('data', Buffer.from('Login Successful\r\n'))
	assert.equal(client.ready, true)
	assert.deepEqual(statuses.at(-1), [InstanceStatus.Ok])
	client.destroy()
})

test('serializes GET commands and accepts fragmented responses by CID', async () => {
	const { client, socket, states } = makeClient()
	client.connect()
	client.ready = true

	const first = client.get('DEVICE/MODELNAME')
	const second = client.get('DEVICE/VER/SYSTEM')
	await nextTick()
	assert.equal(socket.sent.at(-1), 'GET CID:00000001 DEVICE/MODELNAME\r\n')
	assert.equal(
		socket.sent.some((line) => line.includes('DEVICE/VER/SYSTEM')),
		false,
	)

	socket.emit('data', Buffer.from('OK GET CID:00000001 DEVICE/MODEL'))
	socket.emit('data', Buffer.from('NAME:"MM-4D/IN-X"\r\n'))
	await first
	await nextTick()
	assert.equal(socket.sent.at(-1), 'GET CID:00000002 DEVICE/VER/SYSTEM\r\n')

	socket.emit('data', Buffer.from('OK GET CID:00000002 DEVICE/VER/SYSTEM:V1.04B0119\r\n'))
	await second
	assert.deepEqual(states.at(-1), { 'DEVICE/VER/SYSTEM': 'V1.04B0119' })
	client.destroy()
})

test('updates state from unsolicited NOTIFY messages', () => {
	const { client, states } = makeClient()
	client.ready = true
	client.onLine('NOTIFY ANLGIN/1/MUTE:ON MIX/2/FADER:-12.5')
	assert.deepEqual(states.at(-1), { 'ANLGIN/1/MUTE': 'ON', 'MIX/2/FADER': '-12.5' })
	client.destroy()
})

test('serializes a SET command, then updates state after its confirmation', async () => {
	const { client, socket, states } = makeClient()
	client.ready = true
	const setting = client.set('ANLGIN/2/FADER', '-6.0')
	await nextTick()
	assert.equal(socket.sent.at(-1), 'SET CID:00000001 ANLGIN/2/FADER:-6.0\r\n')
	socket.emit('data', Buffer.from('OK SET CID:00000001\r\n'))
	await setting
	assert.deepEqual(states.at(-1), { 'ANLGIN/2/FADER': '-6.0' })
	client.destroy()
})

test('stops reconnecting when another controller owns the single DCP session', () => {
	const { client, socket, statuses } = makeClient()
	client.connect()
	socket.emit('connect')
	socket.emit('data', Buffer.from('Another User Already Connected\r\n'))
	assert.equal(client.reconnectAllowed, false)
	assert.equal(socket.destroyed, true)
	assert.equal(statuses.at(-1)[0], InstanceStatus.ConnectionFailure)
	client.destroy()
})

test('MM-4D inventory is read-only and excludes sensitive or mutating keys', () => {
	assert.equal(MM4D_INVENTORY_KEYS.length, 53)
	assert.equal(
		MM4D_INVENTORY_KEYS.every((key) => !/PHANT|GAIN|TRIM|ROUTING|NETWORK|RESET|METER/.test(key)),
		true,
	)
	assert.equal(MM4D_INVENTORY_KEYS.includes('DEVICE/MODELNAME'), true)
	assert.equal(MM4D_INVENTORY_KEYS.includes('DANTEOUT/4/NAME'), true)
})
