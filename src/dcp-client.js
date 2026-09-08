const { InstanceStatus } = require('@companion-module/base')

const DEFAULT_RECONNECT_MS = 5000
const COMMAND_TIMEOUT_MS = 4000
const LOGIN_TIMEOUT_MS = 4000
const KEEPALIVE_MS = 120000

const MM4D_INVENTORY_KEYS = [
	'DEVICE/NAME',
	'DEVICE/MODELNAME',
	'DEVICE/VER/SYSTEM',
	'DEVICE/SAMPLE',
	'DEVICE/MIXERMODE',
	...Array.from({ length: 4 }, (_, index) => index + 1).flatMap((channel) => [
		`ANLGIN/${channel}/NAME`,
		`ANLGIN/${channel}/MUTE`,
		`ANLGIN/${channel}/FADER`,
		`DANTEIN/${channel}/NAME`,
		`MIX/${channel}/NAME`,
		`MIX/${channel}/MUTE`,
		`MIX/${channel}/FADER`,
		`DANTEOUT/${channel}/NAME`,
	]),
]

function parseParameters(text) {
	const values = {}
	const pattern = /([A-Z0-9/]+):("(?:[^"\\]|\\.)*"|[^\s]+)/g
	let match
	while ((match = pattern.exec(text)) !== null) {
		let value = match[2]
		if (value.startsWith('"') && value.endsWith('"')) {
			value = value.slice(1, -1).replace(/\\(["\\])/g, '$1')
		}
		values[match[1]] = value
	}
	return values
}

class DcpClient {
	constructor(options) {
		this.host = options.host
		this.port = options.port
		this.password = options.password || ''
		this.socketFactory = options.socketFactory
		this.log = options.log
		this.status = options.status
		this.onState = options.onState
		this.reconnectMs = options.reconnectMs ?? DEFAULT_RECONNECT_MS
		this.commandTimeoutMs = options.commandTimeoutMs ?? COMMAND_TIMEOUT_MS
		this.loginTimeoutMs = options.loginTimeoutMs ?? LOGIN_TIMEOUT_MS
		this.keepaliveMs = options.keepaliveMs ?? KEEPALIVE_MS
		this.socket = undefined
		this.buffer = ''
		this.queue = []
		this.active = undefined
		this.ready = false
		this.destroyed = false
		this.reconnectAllowed = true
		this.nextCid = 1
		this.inventoryStatus = 'Not read'
		this.lastRefresh = ''
	}

	connect() {
		if (this.destroyed || this.socket) return
		this.status(InstanceStatus.Connecting)
		this.buffer = ''
		this.socket = this.socketFactory(this.host, this.port)
		this.socket.on('connect', () => this.onConnect())
		this.socket.on('data', (data) => this.onData(data))
		this.socket.on('end', () => this.onDisconnect('Connection ended'))
		this.socket.on('error', (error) => this.onDisconnect(error.message))
	}

	async onConnect() {
		this.log('debug', 'TCP connected; starting DCP login')
		this.loginTimer = setTimeout(() => this.failLogin('DCP login prompt timed out'), this.loginTimeoutMs)
		try {
			await this.sendRaw('\r\n')
		} catch (error) {
			this.onDisconnect(error.message)
		}
	}

	onData(data) {
		const lines = `${this.buffer}${data.toString('utf8')}`.split(/\r\n|\n|\r/)
		this.buffer = lines.pop() || ''
		for (const line of lines) {
			if (line) this.onLine(line)
		}
	}

	onLine(line) {
		if (!this.ready) {
			if (line === 'Enter Password') {
				this.sendRaw(`${this.password}\r\n`).catch((error) => this.onDisconnect(error.message))
				return
			}
			if (line === 'Login Successful') {
				clearTimeout(this.loginTimer)
				this.ready = true
				this.status(InstanceStatus.Ok)
				this.startKeepalive()
				this.refreshInventory().catch((error) => this.log('warn', `Inventory failed: ${error.message}`))
				return
			}
			if (line === 'Another User Already Connected') {
				this.reconnectAllowed = false
				this.failLogin('Another DCP controller is already connected')
				return
			}
			if (/fail|error|invalid/i.test(line)) {
				this.reconnectAllowed = false
				this.failLogin('DCP login was rejected')
			}
			return
		}

		if (line.startsWith('NOTIFY ')) {
			this.onState(parseParameters(line.slice(7)))
			return
		}
		if (line.startsWith('METER ')) return

		if (line.startsWith('OK GET')) {
			const values = parseParameters(line.slice(6))
			const cid = values.CID
			delete values.CID
			this.onState(values)
			this.completeActive(cid, values)
			return
		}

		if (line.startsWith('NG') || line.includes(':ERR')) {
			const values = parseParameters(line)
			this.failActive(new Error(`Device rejected GET${values.CID ? ` CID ${values.CID}` : ''}`))
		}
	}

	failLogin(message) {
		clearTimeout(this.loginTimer)
		this.status(InstanceStatus.ConnectionFailure, message)
		this.log('warn', message)
		this.disposeSocket()
	}

	onDisconnect(message) {
		if (this.destroyed || !this.socket) return
		this.ready = false
		this.stopKeepalive()
		this.failActive(new Error(message))
		this.queue.splice(0).forEach((item) => item.reject(new Error(message)))
		this.disposeSocket()
		this.status(InstanceStatus.Disconnected, message)
		if (this.reconnectAllowed) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectMs)
		}
	}

	disposeSocket() {
		const socket = this.socket
		this.socket = undefined
		if (socket) socket.destroy()
	}

	async sendRaw(value) {
		if (!this.socket) throw new Error('Not connected')
		const sent = await this.socket.sendAsync(value)
		if (!sent) throw new Error('Socket is not connected')
	}

	get(key) {
		return new Promise((resolve, reject) => {
			this.queue.push({ key, resolve, reject })
			this.pump()
		})
	}

	async pump() {
		if (!this.ready || this.active || this.queue.length === 0) return
		const item = this.queue.shift()
		const cid = this.nextCid.toString(16).toUpperCase().padStart(8, '0')
		this.nextCid = (this.nextCid + 1) >>> 0 || 1
		this.active = { ...item, cid }
		this.active.timer = setTimeout(() => this.failActive(new Error(`GET ${item.key} timed out`)), this.commandTimeoutMs)
		try {
			await this.sendRaw(`GET CID:${cid} ${item.key}\r\n`)
		} catch (error) {
			this.failActive(error)
		}
	}

	completeActive(cid, values) {
		if (!this.active) return
		if (cid && cid !== this.active.cid) return
		const active = this.active
		this.active = undefined
		clearTimeout(active.timer)
		active.resolve(values)
		this.pump()
	}

	failActive(error) {
		if (!this.active) return
		const active = this.active
		this.active = undefined
		clearTimeout(active.timer)
		active.reject(error)
		this.pump()
	}

	async refreshInventory() {
		if (!this.ready) throw new Error('DCP session is not ready')
		this.inventoryStatus = 'Reading'
		this.onState({})
		const failures = []
		for (const key of MM4D_INVENTORY_KEYS) {
			try {
				await this.get(key)
			} catch (error) {
				failures.push(`${key}: ${error.message}`)
			}
		}
		this.lastRefresh = new Date().toISOString()
		this.inventoryStatus = failures.length ? `Complete with ${failures.length} unsupported/error keys` : 'Complete'
		this.onState({})
		if (failures.length) this.log('warn', `Inventory notes: ${failures.join('; ')}`)
		return { failures }
	}

	startKeepalive() {
		this.stopKeepalive()
		this.keepaliveTimer = setInterval(() => {
			this.get('DEVICE/NAME').catch((error) => this.log('warn', `Keepalive failed: ${error.message}`))
		}, this.keepaliveMs)
	}

	stopKeepalive() {
		clearInterval(this.keepaliveTimer)
		this.keepaliveTimer = undefined
	}

	destroy() {
		this.destroyed = true
		this.ready = false
		clearTimeout(this.loginTimer)
		clearTimeout(this.reconnectTimer)
		this.stopKeepalive()
		this.failActive(new Error('Module stopped'))
		this.queue.splice(0).forEach((item) => item.reject(new Error('Module stopped')))
		this.disposeSocket()
	}
}

module.exports = { DcpClient, MM4D_INVENTORY_KEYS, parseParameters }
