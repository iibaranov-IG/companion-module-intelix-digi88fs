const { InstanceBase, InstanceStatus, Regex, TCPHelper, combineRgb } = require('@companion-module/base')
const { commands, parseStatusLine } = require('./intelix-protocol')

const ports = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, label: String(index + 1) }))
const profiles = Array.from({ length: 32 }, (_, index) => ({ id: index + 1, label: String(index + 1) }))

class IntelixInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.outputs = new Map()
		this.receiveBuffer = ''
	}

	async init(config) {
		this.config = config
		this.setDefinitions()
		this.connect()
	}

	async configUpdated(config) {
		this.config = config
		this.connect()
	}

	async destroy() {
		this.stopPolling()
		this.socket?.destroy()
	}

	connect() {
		this.stopPolling()
		this.socket?.destroy()
		this.receiveBuffer = ''

		const host = String(this.config.host || '').trim()
		const port = Number(this.config.port || 23)
		if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
			this.updateStatus(InstanceStatus.BadConfig, 'Enter the matrix IP address and Telnet port')
			return
		}

		this.updateStatus(InstanceStatus.Connecting)
		this.socket = new TCPHelper(host, port)
		this.socket.on('connect', () => {
			this.updateStatus(InstanceStatus.Ok)
			this.beginPolling()
			this.refresh().catch((error) => this.log('warn', error.message))
		})
		this.socket.on('data', (data) => this.handleData(data))
		this.socket.on('error', (error) => this.updateStatus(InstanceStatus.ConnectionFailure, error.message))
		this.socket.on('end', () => this.updateStatus(InstanceStatus.Disconnected))
	}

	beginPolling() {
		this.stopPolling()
		const seconds = Math.max(2, Math.min(300, Number(this.config.pollInterval || 10)))
		this.pollTimer = setInterval(
			() => this.refresh().catch((error) => this.log('debug', error.message)),
			seconds * 1000,
		)
	}

	stopPolling() {
		if (this.pollTimer) clearInterval(this.pollTimer)
		delete this.pollTimer
	}

	async send(command) {
		if (!this.socket?.isConnected) throw new Error('Intelix matrix is not connected')
		await this.socket.sendAsync(`${command}\r\n`)
	}

	refresh() {
		return this.send(commands.read())
	}

	handleData(data) {
		this.receiveBuffer += data.toString('utf8').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
		const lines = this.receiveBuffer.split(/\r?\n/)
		this.receiveBuffer = lines.pop() || ''
		// Telnet prompts commonly have no line terminator. Consume a complete
		// prompt once; a following CRLF must not resend the credentials.
		if (/^(?:enter\s+)?(?:login|username|password)\s*:\s*$/i.test(this.receiveBuffer.trim())) {
			lines.push(this.receiveBuffer)
			this.receiveBuffer = ''
		}

		for (const rawLine of lines) {
			const line = rawLine.trim()
			if (!line) continue
			if (/^(?:enter\s+)?(login|username)\s*:/i.test(line) && this.config.username) {
				this.send(String(this.config.username)).catch((error) => this.log('warn', error.message))
				continue
			}
			if (/^(?:enter\s+)?password\s*:/i.test(line) && this.config.password) {
				this.send(String(this.config.password)).catch((error) => this.log('warn', error.message))
				continue
			}

			const status = parseStatusLine(line)
			if (status) this.updateOutput(status)
		}
	}

	updateOutput(status) {
		this.outputs.set(status.output, status)
		this.setVariableValues({
			[`output_${status.output}_input`]: String(status.input),
			[`output_${status.output}_video`]: status.video ? 'on' : 'off',
			[`output_${status.output}_audio`]: status.audio ? 'on' : 'off',
		})
		this.checkFeedbacks('routed', 'video_enabled', 'audio_enabled')
	}

	setDefinitions() {
		this.setActionDefinitions({
			route: {
				name: 'Route input to output',
				options: [portOption('input', 'Input'), portOption('output', 'Output')],
				callback: async (action) => {
					await this.send(commands.route(action.options.input, action.options.output))
					await this.refresh()
				},
			},
			route_all: {
				name: 'Route input to all outputs',
				options: [portOption('input', 'Input')],
				callback: async (action) => {
					await this.send(commands.routeAll(action.options.input))
					await this.refresh()
				},
			},
			next_input: stepAction(this, 'Select next input', commands.nextInput),
			previous_input: stepAction(this, 'Select previous input', commands.previousInput),
			set_video: stateAction(this, 'Set output video', commands.video),
			set_audio: stateAction(this, 'Set output audio', commands.audio),
			load_profile: profileAction(this, 'Load profile', commands.loadProfile),
			save_profile: profileAction(this, 'Save current matrix state to profile', commands.saveProfile),
			refresh: { name: 'Refresh matrix status', options: [], callback: () => this.refresh() },
		})

		this.setFeedbackDefinitions({
			routed: {
				type: 'boolean',
				name: 'Output has selected input',
				description: 'Uses the route reported by the matrix',
				defaultStyle: { bgcolor: combineRgb(0, 130, 0), color: combineRgb(255, 255, 255) },
				options: [portOption('input', 'Input'), portOption('output', 'Output')],
				callback: (feedback) =>
					this.outputs.get(Number(feedback.options.output))?.input === Number(feedback.options.input),
			},
			video_enabled: stateFeedback(this, 'Output video is enabled', 'video', combineRgb(0, 90, 180)),
			audio_enabled: stateFeedback(this, 'Output audio is enabled', 'audio', combineRgb(120, 70, 0)),
		})

		this.setVariableDefinitions(
			Array.from({ length: 8 }, (_, index) => index + 1).flatMap((output) => [
				{ variableId: `output_${output}_input`, name: `Output ${output}: routed input` },
				{ variableId: `output_${output}_video`, name: `Output ${output}: video state` },
				{ variableId: `output_${output}_audio`, name: `Output ${output}: audio state` },
			]),
		)
	}

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				label: 'DIGI-88FS control',
				value: 'Uses the documented Telnet/RS-232 command set. Default Telnet port is 23.',
				width: 12,
			},
			{ type: 'textinput', id: 'host', label: 'Matrix IP address', regex: Regex.IP, width: 8 },
			{ type: 'textinput', id: 'port', label: 'Telnet port', default: '23', regex: Regex.PORT, width: 4 },
			{ type: 'textinput', id: 'username', label: 'Telnet username (optional)', width: 6 },
			{ type: 'textinput', id: 'password', label: 'Telnet password (optional)', width: 6 },
			{
				type: 'number',
				id: 'pollInterval',
				label: 'Status refresh interval (seconds)',
				default: 10,
				min: 2,
				max: 300,
				width: 6,
			},
		]
	}
}

function portOption(id, label) {
	return { type: 'dropdown', id, label, default: 1, choices: ports }
}

function profileOption() {
	return { type: 'dropdown', id: 'profile', label: 'Profile', default: 1, choices: profiles }
}

function stepAction(self, name, command) {
	return {
		name,
		options: [portOption('output', 'Output')],
		callback: async (action) => {
			await self.send(command(action.options.output))
			await self.refresh()
		},
	}
}

function stateAction(self, name, command) {
	return {
		name,
		options: [portOption('output', 'Output'), { type: 'checkbox', id: 'enabled', label: 'Enabled', default: true }],
		callback: async (action) => {
			await self.send(command(action.options.output, action.options.enabled))
			await self.refresh()
		},
	}
}

function profileAction(self, name, command) {
	return {
		name,
		options: [profileOption()],
		callback: async (action) => {
			await self.send(command(action.options.profile))
			await self.refresh()
		},
	}
}

function stateFeedback(self, name, property, bgcolor) {
	return {
		type: 'boolean',
		name,
		description: 'Uses the state reported by the matrix',
		defaultStyle: { bgcolor, color: combineRgb(255, 255, 255) },
		options: [portOption('output', 'Output')],
		callback: (feedback) => Boolean(self.outputs.get(Number(feedback.options.output))?.[property]),
	}
}

module.exports = IntelixInstance
