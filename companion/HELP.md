# TASCAM DCP

This initial test build monitors a TASCAM MM-4D/IN-X or MM-4D/IN-E through the documented DCP Ethernet protocol.

## Connection

Enter the processor IP address, leave TCP port `54726` unless the device documentation says otherwise, and enter the DCP password locally. The password is stored in Companion's secret store and is never written to the module log.

Only one DCP Ethernet controller can be connected at a time. Close TASCAM DCP CONNECT before testing. If another controller is connected, the module reports that condition and does not repeatedly retry the password.

## Read-only test scope

The module reads:

- device name, model, firmware, sample rate and mixer mode;
- names, mute state and fader state for four analog inputs;
- names for four Dante inputs;
- names, mute state and fader state for four mix buses;
- names for four Dante outputs.

The **Refresh read-only inventory** action repeats those GET requests. Incoming DCP NOTIFY messages update known state and feedbacks.

This build has no commands for gain, trim, phantom power, routing, meters, test tone, scenes, network settings, reset or firmware. It cannot replace Dante Controller.

## Hardware-test procedure

Use a non-production Companion instance or export its configuration first. Verify that the connection reaches OK, leave it connected for more than three minutes, run one inventory refresh, and return a redacted module log. Do not include device passwords, serial numbers, IP addresses or site/channel names in a public issue.

Protocol reference: TASCAM MX-8A/DCP Series RS-232C/ETHERNET protocol specification, version 1.00.
