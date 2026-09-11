# Companion module for Intelix DIGI-88FS

Controls the Intelix DIGI-88FS 8x8 HDMI matrix through its documented Telnet/RS-232 command set.

## Implemented

- Route any input to any output, or one input to all outputs
- Step an output to the next or previous input
- Enable or disable video and audio per output
- Load and save profiles 1–32
- Read all output routes and audio/video states
- Companion variables and feedbacks for every output

The default Telnet port is `23`. Commands are terminated with CRLF as required by the manual. Optional Telnet credentials can be configured when authentication is enabled on the matrix.

## Hardware status

Protocol encoding and response parsing are covered by automated tests. Physical DIGI-88FS verification is still requested; test on a non-production route first.

Protocol references: [DIGI-88FS manual](https://www.cs1.net/pic/intelix/DIGI-88FS_manual.pdf) and [quick start guide](https://www.cs1.net/pic/intelix/DIGI-88FS_quick_start_guide.pdf).

License: MIT.
