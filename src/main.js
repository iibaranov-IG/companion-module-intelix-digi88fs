const { InstanceBase, InstanceStatus, Regex, TCPHelper, combineRgb } = require('@companion-module/base')
const choices = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, label: String(i + 1) }))
const option = (id, label) => ({ type: 'dropdown', id, label, default: 1, choices })
class Intelix extends InstanceBase {
	constructor(internal) { super(internal); this.routes = new Map() }
	async init(config) { this.config = config; this.define(); this.connect() }
	async configUpdated(config) { this.config = config; this.connect() }
	async destroy() { this.socket?.destroy() }
	define() {
		this.setActionDefinitions({ route: { name: 'Route input to output', options: [option('input', 'Input'), option('output', 'Output')], callback: (a) => this.route(a.options.input, a.options.output) } })
		this.setFeedbackDefinitions({ routed: { type: 'boolean', name: 'Output has selected input', defaultStyle: { bgcolor: combineRgb(0, 150, 0), color: combineRgb(255, 255, 255) }, options: [option('input', 'Input'), option('output', 'Output')], callback: (f) => this.routes.get(Number(f.options.output)) === Number(f.options.input) } })
		this.setVariableDefinitions(Array.from({ length: 8 }, (_, i) => ({ variableId: `output_${i + 1}_input`, name: `Output ${i + 1}: routed input` })))
	}
	connect() { this.socket?.destroy(); const host = String(this.config.host || '').trim(), port = Number(this.config.port || 23); if (!host || !Number.isInteger(port)) return this.updateStatus(InstanceStatus.BadConfig, 'Enter IP address and port'); this.updateStatus(InstanceStatus.Connecting); this.socket = new TCPHelper(host, port); this.socket.on('connect', () => this.updateStatus(InstanceStatus.Ok)); this.socket.on('error', (e) => this.updateStatus(InstanceStatus.ConnectionFailure, e.message)) }
	async route(input, output) { if (!this.socket?.isConnected) throw new Error('Matrix is not connected'); const i = Number(input), o = Number(output); await this.socket.sendAsync(`i${String(i).padStart(2, '0')}o${String(o).padStart(2, '0')}\r\n`); this.routes.set(o, i); this.setVariableValues({ [`output_${o}_input`]: String(i) }); this.checkFeedbacks('routed') }
	getConfigFields() { return [{ type: 'textinput', id: 'host', label: 'Matrix IP address', regex: Regex.IP, width: 8 }, { type: 'textinput', id: 'port', label: 'Telnet port', default: '23', regex: Regex.PORT, width: 4 }] }
}
module.exports = Intelix
