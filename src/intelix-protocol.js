const OUTPUT_STATUS = /^o(\d{2})\s+i(\d{2})\s+video\s+(on|off)\s+audio\s+(on|off)$/i

function twoDigit(value, label, maximum) {
	const number = Number(value)
	if (!Number.isInteger(number) || number < 1 || number > maximum)
		throw new Error(`${label} must be between 1 and ${maximum}`)
	return String(number).padStart(2, '0')
}

const commands = {
	route: (input, output) => `swi${twoDigit(input, 'Input', 8)}o${twoDigit(output, 'Output', 8)}`,
	routeAll: (input) => `swi${twoDigit(input, 'Input', 8)}o*`,
	nextInput: (output) => `swo${twoDigit(output, 'Output', 8)}+`,
	previousInput: (output) => `swo${twoDigit(output, 'Output', 8)}-`,
	video: (output, enabled) => `swo${twoDigit(output, 'Output', 8)}${enabled ? 'on' : 'off'}`,
	audio: (output, enabled) => `muteo${twoDigit(output, 'Output', 8)}${enabled ? 'off' : 'on'}`,
	loadProfile: (profile) => `profilef${twoDigit(profile, 'Profile', 32)}load`,
	saveProfile: (profile) => `profilef${twoDigit(profile, 'Profile', 32)}save`,
	read: () => 'read',
}

function parseStatusLine(line) {
	const match = String(line).trim().match(OUTPUT_STATUS)
	if (!match) return null
	return {
		output: Number(match[1]),
		input: Number(match[2]),
		video: match[3].toLowerCase() === 'on',
		audio: match[4].toLowerCase() === 'on',
	}
}

module.exports = { commands, parseStatusLine, twoDigit }
