module.exports = function (self) {
	const variables = [
		{ variableId: 'device_name', name: 'Device name' },
		{ variableId: 'device_model', name: 'Device model' },
		{ variableId: 'device_firmware', name: 'System firmware' },
		{ variableId: 'sample_rate', name: 'Sample rate' },
		{ variableId: 'mixer_mode', name: 'Mixer mode' },
		{ variableId: 'inventory_status', name: 'Inventory status' },
		{ variableId: 'last_refresh', name: 'Last inventory refresh (UTC)' },
	]
	for (let channel = 1; channel <= 4; channel++) {
		variables.push(
			{ variableId: `analog_input_${channel}_name`, name: `Analog input ${channel} name` },
			{ variableId: `analog_input_${channel}_mute`, name: `Analog input ${channel} mute` },
			{ variableId: `analog_input_${channel}_fader`, name: `Analog input ${channel} fader` },
			{ variableId: `dante_input_${channel}_name`, name: `Dante input ${channel} name` },
			{ variableId: `mix_${channel}_name`, name: `Mix ${channel} name` },
			{ variableId: `mix_${channel}_mute`, name: `Mix ${channel} mute` },
			{ variableId: `mix_${channel}_fader`, name: `Mix ${channel} fader` },
			{ variableId: `dante_output_${channel}_name`, name: `Dante output ${channel} name` },
		)
	}
	self.setVariableDefinitions(variables)
}
