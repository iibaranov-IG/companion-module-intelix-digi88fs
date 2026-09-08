# companion-module-tascam-dcp

Experimental read-only Bitfocus Companion integration for TASCAM DCP-series audio processors.

The first hardware gate targets MM-4D/IN-X firmware V1.04B0119. It implements the documented TCP login, serialized GET queue with CID matching, NOTIFY state updates, a two-minute keepalive, and a constrained MM-4D inventory. No state-changing device command is exposed.

This is an independent community project and is not affiliated with or endorsed by TASCAM or TEAC Corporation.
