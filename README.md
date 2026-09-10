# companion-module-tascam-dcp

Independent Companion integration for TASCAM DCP-series audio processors.

The first hardware gate targets MM-4D/IN-X firmware V1.04B0119. It implements the documented TCP login, serialized GET/SET queue with CID matching, NOTIFY state updates, a two-minute keepalive, and a constrained MM-4D inventory.

The module can set only three documented fader groups: analog-input level, mix master level, and analog-input level sent to a mix. It provides variables and threshold feedbacks for analog-input and mix faders. It does not alter input trim, phantom power, routing, meter enable, network settings, scenes, reset or test tone.

The MM-4D/IN-X has analog inputs and Dante outputs; it does not have analog output channels. Its published protocol exposes meter acquisition for analog inputs, but the meter-value conversion still needs a hardware capture before it can be presented as a trustworthy dB value.

This is an independent community project and is not affiliated with or endorsed by TASCAM or TEAC Corporation.
