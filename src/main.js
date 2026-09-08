const { InstanceBase, InstanceStatus, Regex, TCPHelper, runEntrypoint } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const UpdateActions = require('./actions')
const UpdateFeedbacks = require('./feedbacks')
const UpdateVariableDefinitions = require('./variables')
const { DcpClient } = require('./dcp-client')

class ModuleInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.client = undefined
		this.state = new Map()
	}

	async init(config, _isFirstInit, secrets) {
		this.config = config
		this.secrets = secrets || {}
		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.initConnection()
	}

	async destroy() {
		this.client?.destroy()
		this.client = undefined
	}

	async configUpdated(config, secrets) {
		this.config = config
		this.secrets = secrets || {}
		this.initConnection()
	}

	initConnection() {
		this.client?.destroy()
		this.client = undefined
		this.state.clear()

		const host = String(this.config.host || '').trim()
		const port = Number(this.config.port || 54726)
		if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
			this.updateStatus(InstanceStatus.BadConfig, 'Enter a valid device address and TCP port')
			return
		}

		this.client = new DcpClient({
			host,
			port,
			password: String(this.secrets.password || ''),
			socketFactory: (targetHost, targetPort) => new TCPHelper(targetHost, targetPort, { reconnect: false }),
			log: (level, message) => this.log(level, message),
			status: (status, message) => this.updateStatus(status, message),
			onState: (updates) => this.applyState(updates),
		})
		this.client.connect()
	}

	applyState(updates) {
		for (const [key, value] of Object.entries(updates)) this.state.set(key, value)
		this.setVariableValues(this.variableValues())
		this.checkFeedbacks('connected', 'analog_input_muted', 'mix_muted')
	}

	variableValues() {
		const values = {
			device_name: this.state.get('DEVICE/NAME') || '',
			device_model: this.state.get('DEVICE/MODELNAME') || '',
			device_firmware: this.state.get('DEVICE/VER/SYSTEM') || '',
			sample_rate: this.state.get('DEVICE/SAMPLE') || '',
			mixer_mode: this.state.get('DEVICE/MIXERMODE') || '',
			inventory_status: this.client?.inventoryStatus || 'Not read',
			last_refresh: this.client?.lastRefresh || '',
		}

		for (let channel = 1; channel <= 4; channel++) {
			values[`analog_input_${channel}_name`] = this.state.get(`ANLGIN/${channel}/NAME`) || ''
			values[`analog_input_${channel}_mute`] = this.state.get(`ANLGIN/${channel}/MUTE`) || ''
			values[`analog_input_${channel}_fader`] = this.state.get(`ANLGIN/${channel}/FADER`) || ''
			values[`dante_input_${channel}_name`] = this.state.get(`DANTEIN/${channel}/NAME`) || ''
			values[`mix_${channel}_name`] = this.state.get(`MIX/${channel}/NAME`) || ''
			values[`mix_${channel}_mute`] = this.state.get(`MIX/${channel}/MUTE`) || ''
			values[`mix_${channel}_fader`] = this.state.get(`MIX/${channel}/FADER`) || ''
			values[`dante_output_${channel}_name`] = this.state.get(`DANTEOUT/${channel}/NAME`) || ''
		}
		return values
	}

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'safety',
				label: 'Safety scope',
				value:
					'This test build only reads device and channel state. It contains no gain, routing, phantom-power, meter-enable, network, reset, or scene commands.',
				width: 12,
			},
			{ type: 'textinput', id: 'host', label: 'Device IP', width: 8, regex: Regex.IP },
			{ type: 'textinput', id: 'port', label: 'TCP port', width: 4, default: '54726', regex: Regex.PORT },
			{ type: 'secret-text', id: 'password', label: 'DCP password', default: '', width: 12 },
		]
	}

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions() {
		UpdateVariableDefinitions(this)
		this.setVariableValues(this.variableValues())
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
