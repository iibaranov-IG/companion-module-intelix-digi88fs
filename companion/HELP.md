# Intelix DIGI-88FS

## Configuration

Enter the matrix IP address. The documented Telnet port is `23`. If the matrix prompts for a login, enter its username and password; otherwise leave both fields empty.

The module sends CRLF-terminated commands and periodically sends `read` to keep routes, audio and video states current.

## Actions

- Route input to output / route input to all outputs
- Select next or previous input for an output
- Enable or disable output video
- Enable or disable output audio
- Load profile 1–32
- Save profile 1–32
- Refresh matrix status

Loading a profile changes several routes at once. Saving overwrites the selected profile. Test both on non-production equipment first.

## Feedbacks and variables

Each output exposes its routed input and reported audio/video state. Feedbacks can highlight a selected route or whether audio/video is enabled.

This implementation follows the published DIGI-88FS manual. Physical hardware validation is still requested.
