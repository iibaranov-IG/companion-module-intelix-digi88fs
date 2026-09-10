module.exports = function (self) {
	self.setActionDefinitions({
		refresh_inventory: {
			name: 'Refresh MM-4D status',
			description: 'Reads supported MM-4D device and channel state',
			options: [],
			callback: async () => {
				if (!self.client?.ready) throw new Error('TASCAM DCP session is not connected')
				await self.client.refreshInventory()
			},
		},
		set_analog_input_fader: faderAction(self, 'Set analog input level', 'ANLGIN/{channel}/FADER', 'Analog input'),
		set_mix_fader: faderAction(self, 'Set mix output level', 'MIX/{channel}/FADER', 'Mix'),
		set_mix_analog_send_fader: {
			name: 'Set analog input level sent to a mix',
			description: 'Changes only this analog-input send level; it does not change phantom power, routing or Dante subscriptions.',
			options: [channelOption('Mix'), channelOption('Analog input', 'input'), faderOption()],
			callback: async (action) => {
				await setFader(self, `MIX/${action.options.channel}/ANLGIN/${action.options.input}/FADER`, action.options.value)
			},
		},
	})
}

function faderAction(self, name, keyPattern, label) {
	return {
		name,
		description: 'Sets a fader from -127.0 dB through +10.0 dB, or -INF. Test on a non-production channel first.',
		options: [channelOption(label), faderOption()],
		callback: async (action) => setFader(self, keyPattern.replace('{channel}', action.options.channel), action.options.value),
	}
}

function channelOption(label, id = 'channel') {
	return { type: 'dropdown', id, label, default: 1, choices: [1, 2, 3, 4].map((channel) => ({ id: channel, label: String(channel) })) }
}

function faderOption() {
	return { type: 'textinput', id: 'value', label: 'Level (dB, or -INF)', default: '0.0', regex: /^-?(?:INF|\d{1,3}(?:\.\d)?)$/ }
}

async function setFader(self, key, value) {
	if (!self.client?.ready) throw new Error('TASCAM DCP session is not connected')
	const normalized = String(value).trim().toUpperCase()
	if (normalized !== '-INF' && (!/^-?\d+(?:\.\d+)?$/.test(normalized) || Number(normalized) < -127 || Number(normalized) > 10)) {
		throw new Error('Level must be between -127.0 and +10.0 dB, or -INF')
	}
	await self.client.set(key, normalized)
}
