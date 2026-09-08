module.exports = function (self) {
	self.setActionDefinitions({
		refresh_inventory: {
			name: 'Refresh read-only inventory',
			description: 'Reads supported MM-4D device and channel state without changing the processor',
			options: [],
			callback: async () => {
				if (!self.client?.ready) throw new Error('TASCAM DCP session is not connected')
				await self.client.refreshInventory()
			},
		},
	})
}
