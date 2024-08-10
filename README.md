# goxlr-utility-streamdeck
A StreamDeck plugin for controlling a GoXLR through the [GoXLR Utility](https://github.com/GoXLR-on-Linux/goxlr-utility/),
Join us for discussion related to the plugin on the [GoXLR Utiltiy](https://discord.gg/BRBjkkbvmZ) discord.

## Features
* Mutli-Device Support
* Load Profile
* Load Mic Profile
* Load FX Preset
* Set / Adjust a Channel's Volume (includes submixes if available)
* Set / Toggle a Route
* Set / Toggle Fader Mute
* Set / Toggle Microphone Mute
* Set / Toggle FX Buttons

## Download
The latest version can be found on the [Releases Page](https://github.com/frostycoolslug/goxlr-utility-streamdeck/releases/latest)

## Configuration

### Local
If you're running your Stream Deck on the same computer as the GoXLR utility, it should automatically detect it running
and perform any configuration needed when you add your first action, and you should be good to go.

### Remote
If you're running your Stream Deck on a different PC to your GoXLR, you will need to configure the Plugin to connect
to where the GoXLR is.

Firstly, ensure the GoXLR Utility is configured to allow network access, open the UI, navigate to System -> Settings,
from there ensure 'Allow UI Network Access' is ticked. Restart the utility and make sure connections are allowed through
your firewall.

Going back to the Stream Deck software, add an Action, and a 'Configure' button should appear, click the button and the
global settings page will open. Change `localhost` to the IP of the computer running the GoXLR Utility (unless you've 
explicitly changed the port from `14564`, leave that there) and hit `Connect`.

You should see a green 'Success' message if the plugin was able to connect, if not, double-check the IP is correct and
that the connection isn't being blocked by the firewall.

Once connected, you should be able to configure actions.

## Troubleshooting
### The Icons are Red
This means that either the Stream Deck cannot connect to the GoXLR Utility, the GoXLR is unplugged or not found, or a
selected action cannot be performed on your device (For example, attempting to execute FX commands on a mini).
Double-check the Utility to make sure it's functional and present. If you've swapped your GoXLR with another one, click
on each of the actions, which should make them resync.
