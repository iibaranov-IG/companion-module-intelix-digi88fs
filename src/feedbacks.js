const { combineRgb } = require('@companion-module/base')

const channelOption = (label) => ({
	type: 'dropdown',
	id: 'channel',
	label,
	default: 1,
	choices: [1, 2, 3, 4].map((id) => ({ id, label: String(id) })),
})

module.exports = function (self) {
	self.setFeedbackDefinitions({
		connected: {
			type: 'boolean',
			name: 'DCP session connected',
			description: 'The TCP session is authenticated and ready',
			defaultStyle: { bgcolor: combineRgb(0, 128, 0), color: combineRgb(255, 255, 255) },
			options: [],
			callback: () => Boolean(self.client?.ready),
		},
		analog_input_muted: {
			type: 'boolean',
			name: 'Analog input is muted',
			description: 'Uses the state read from the processor; this feedback never changes mute',
			defaultStyle: { bgcolor: combineRgb(180, 0, 0), color: combineRgb(255, 255, 255) },
			options: [channelOption('Analog input')],
			callback: (feedback) => self.state.get(`ANLGIN/${feedback.options.channel}/MUTE`) === 'ON',
		},
		mix_muted: {
			type: 'boolean',
			name: 'Mix is muted',
			description: 'Uses the state read from the processor; this feedback never changes mute',
			defaultStyle: { bgcolor: combineRgb(180, 0, 0), color: combineRgb(255, 255, 255) },
			options: [channelOption('Mix')],
			callback: (feedback) => self.state.get(`MIX/${feedback.options.channel}/MUTE`) === 'ON',
		},
		analog_input_fader_at_or_above: faderFeedback('Analog input level is at or above', (channel) => `ANLGIN/${channel}/FADER`),
		mix_fader_at_or_above: faderFeedback('Mix output level is at or above', (channel) => `MIX/${channel}/FADER`),
	})
}

function faderFeedback(name, keyForChannel) {
	return {
		type: 'boolean',
		name,
		description: 'Uses the fader state reported by the processor.',
		defaultStyle: { bgcolor: combineRgb(0, 90, 180), color: combineRgb(255, 255, 255) },
		options: [channelOption('Channel'), { type: 'textinput', id: 'threshold', label: 'Minimum level in dB', default: '0.0', regex: /^-?\d+(?:\.\d+)?$/ }],
		callback: (feedback) => {
			const value = self.state.get(keyForChannel(feedback.options.channel))
			return value !== '-INF' && Number(value) >= Number(feedback.options.threshold)
		},
	}
}
