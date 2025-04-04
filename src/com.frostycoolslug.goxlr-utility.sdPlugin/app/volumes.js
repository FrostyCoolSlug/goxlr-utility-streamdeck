const changeVolume = new Action('com.frostycoolslug.goxlr-utility.volume');
const encoderVolumeMonitors = {};

// External handlers for if the device disappears, or we're not connected..
function encoderVolumeMonitorExternalStateChange() {
    // We should never fully remove the mute monitors, so that when the connection comes back we can reestablish them..
    for (let monitor of Object.keys(encoderVolumeMonitors)) {
        encoderVolumeMonitors[monitor].setState();
    }
}

function createEncoderVolumeMonitor(context, settings) {
    let serial = settings.serial;
    let mix = settings.mix;
    let channel_a = settings.channel;
    let channel_b = settings['sub-channel'];

    if (encoderVolumeMonitors[context] !== undefined) {
        encoderVolumeMonitors[context].destroy();
        encoderVolumeMonitors[context] = new EncoderVolumeMonitor(context, serial, mix, channel_a, channel_b);
    } else {
        encoderVolumeMonitors[context] = new EncoderVolumeMonitor(context, serial, mix, channel_a, channel_b);
    }
    encoderVolumeMonitors[context].setState();
}

class EncoderVolumeMonitor {
    // These are all arguably private, but because they're all used in the event scope, the event needs
    // access to them.
    context = undefined;

    serial = undefined;
    mix = undefined;
    channel_a = undefined;
    channel_b = undefined;

    monitor_a = undefined;
    monitor_b = undefined;
    device = undefined;

    #event_handle = () => {};

    constructor(context, serial, mix, channel_a, channel_b) {
        this.context = context;
        this.serial = serial;
        this.mix = mix;
        this.channel_a = channel_a;
        this.channel_b = channel_b;
        this.monitor_a = `/mixers/${serial}/levels/volumes/${ChannelNameReadable[channel_a]}`;
        this.monitor_b = `/mixers/${serial}/levels/submix/inputs/${ChannelNameReadable[channel_b]}/volume`;

        // Monitor for Submix Enable / Disable...
        this.monitor_submix = `/mixers/${serial}/levels/submix`;
        this.device = `/mixers/${serial}`

        this.fader_status = `/mixers/${serial}/fader_status/`;

        let self = this;
        this.#event_handle = function(e) {
            self.#onEvent(self, e);
        }
        eventTarget.addEventListener("patch", this.#event_handle);
    }

    equal(context, serial, mix, channel_a, channel_b) {
        return (context === this.context && serial === this.serial && mix === this.mix && channel_a === ChannelNameReadable[this.channel_a] && channel_b === ChannelNameReadable[this.channel_b])
    }

    destroy() {
        eventTarget.removeEventListener("patch", this.#event_handle);
    }

    #onEvent(self, event) {
        let patch = event.patch;
        if (patch.path === self.device || patch.path === self.monitor_a || patch.path === self.monitor_b || patch.path === self.monitor_submix) {
            self.setState();
        }
    }

    setState() {
        if (!websocket.is_connected() || status === undefined || status.mixers[this.serial] === undefined) {
            $SD.setFeedback(this.context, {
                indicator: {
                    value: 0
                },
                value: "??",
            })
            return;
        }

        let submix_supported = status.mixers[this.serial].levels.submix_supported === true;
        let submix_enabled = (status.mixers[this.serial].levels.submix !== null);

        // Before we do anything else, is the Mic Monitor active?
        let ch_a = ChannelNameReadable[this.channel_a];
        if (submix_supported && submix_enabled && this.mix === "A" && ch_a === "MicMonitor") {
            // Do nothing, we shouldn't be able to manipulate the Mic Monitor in this scenario
            return;
        }


        let title = (this.mix === "A") ? this.channel_a : this.channel_b;
        // Make sure submixes are supported and enabled, and that this channel supports submixing
        if (submix_supported && submix_enabled) {
            if (this.mix === "A" && (ch_a === "LineOut" || ch_a === "MicMonitor" || ch_a === "Headphones")) {
                // Do Nothing
            } else {
                title = title + " [" + this.mix + "]";
            }
        }

        // Get the channel A volume regardless..
        let volume = status.mixers[this.serial].levels.volumes[ChannelNameReadable[this.channel_a]];

        if (this.mix === "B" && (!submix_supported || !submix_enabled)) {
            // Submixes are disabled, get the Channel A for the defined B..
            volume = status.mixers[this.serial].levels.volumes[ChannelNameReadable[this.channel_b]];
        } else if (this.mix === "B" && submix_supported && submix_enabled) {
            volume = status.mixers[this.serial].levels.submix.inputs[ChannelNameReadable[this.channel_b]].volume;
        }

        let percent = Math.round(((volume / 255) * 100));
        $SD.setFeedback(this.context, {
            title: title,
            value: percent + "%",
            indicator: {
                value: percent,
            }
        });
    }
}


/// Activators
changeVolume.onKeyUp(({action, context, device, event, payload}) => {
    // Toggle the Setting..
    let serial = payload.settings.serial;
    let mix = payload.settings.mix;
    let mode = payload.settings.mode;

    let channel_a = ChannelNameReadable[payload.settings.channel];
    let channel_b = ChannelNameReadable[payload.settings["sub-channel"]];

    let volume = Math.round((payload.settings.volume / 100) * 255);

    if (!websocket.is_connected()) {
        console.warn("Not Connected to Utility, Unable to Execute");
        $SD.showAlert(context);
    } else if (status === undefined || status.mixers[serial] === undefined) {
        console.warn("Mixer isn't present, unable to perform action")
        $SD.showAlert(context);
    } else {
        let submix_supported = status.mixers[serial].levels.submix_supported === true;
        let submix_enabled = (status.mixers[serial].levels.submix !== null);

        // If submixes aren't supported, or enabled, always default back..
        if (!submix_supported || !submix_enabled || mix === "A") {
            let channel = channel_a;

            // If we have a B mix setup, the user has likely disabled submixes without reconfiguring this button,
            // so we'll fall back to the equivalent A mix for volume adjustment.
            if (mix === "B") {
                channel = channel_b;
            }

            if (mode === "set") {
                sendVolume(serial, channel, volume);
            } else {
                // Get the current volume for this channel..
                let current = status.mixers[serial].levels.volumes[channel];
                let newVolume = (mode === "up") ? (current + volume) : (current - volume);
                if (newVolume > 255) {
                    newVolume = 255;
                }
                if (newVolume < 0) {
                    newVolume = 0;
                }
                sendVolume(serial, channel, newVolume);
            }
        } else {
            // Submixes are enabled, and we're configured as channel B
            let channel = channel_b;

            if (mode === "set") {
                sendSubVolume(serial, channel, volume)
            } else {
                let current = status.mixers[serial].levels.submix.inputs[channel].volume;
                let newVolume = (mode === "up") ? (current + volume) : (current - volume);
                if (newVolume > 255) {
                    newVolume = 255;
                }
                if (newVolume < 0) {
                    newVolume = 0;
                }
                sendSubVolume(serial, channel, newVolume);
            }
        }
    }
});

changeVolume.onDialUp(({action, context, device, event, payload}) => {
    // Ok, we're going to change the setting here and flip our mix if supported
    let serial = payload.settings.serial;
    let mix = payload.settings.mix;
    let channel_a = ChannelNameReadable[payload.settings.channel];

    if (!websocket.is_connected()) {
        console.warn("Not Connected to Utility, Unable to Execute");
        $SD.showAlert(context);
    } else if (status === undefined || status.mixers[serial] === undefined) {
        console.log(serial);

        console.warn("Mixer isn't present, unable to perform action")
        $SD.showAlert(context);
    } else {
        let submix_supported = status.mixers[serial].levels.submix_supported === true;
        let submix_enabled = (status.mixers[serial].levels.submix !== null);

        if (!submix_enabled || !submix_supported) {
            return;
        }

        if (mix === "A") {
            // We need to do some checks before switching to Mix B.. 
            if (channel_a === "LineOut" || channel_a === "MicMonitor" || channel_a === "Headphones") {
                // Do nothing, these channels dont have a Mix B.
                return;
            }
        }

        let settings = payload.settings;
        settings.mix = (mix === "A") ? "B" : "A";
        if (mix === "A") {
            // We need to set the Mix B channel
            settings["sub-channel"] = payload.settings.channel;
            settings.mix = "B";
        } else {
            settings.channel = payload.settings["sub-channel"];
            settings.mix = "A";
        }


        $SD.setSettings(context, settings);
        $SD.getSettings(context);
    }
});

// This is incredibly similar to the button press above, but with some tiny changes
changeVolume.onDialRotate(({action, context, device, event, payload}) => {
    // Toggle the Setting..
    let serial = payload.settings.serial;
    let mix = payload.settings.mix;
    let mode = payload.settings.mode;

    let channel_a = ChannelNameReadable[payload.settings.channel];
    let channel_b = ChannelNameReadable[payload.settings["sub-channel"]];

    // Get the Adjustment, we're doing 2% per tick
    let adjustment = Math.round((2 / 100) * 255) * payload.ticks;

    if (!websocket.is_connected()) {
        console.warn("Not Connected to Utility, Unable to Execute");
        $SD.showAlert(context);
    } else if (status === undefined || status.mixers[serial] === undefined) {
        console.warn("Mixer isn't present, unable to perform action")
        $SD.showAlert(context);
    } else {
        let submix_supported = status.mixers[serial].levels.submix_supported === true;
        let submix_enabled = (status.mixers[serial].levels.submix !== null);

        if (submix_supported && submix_enabled && channel_a === "MicMonitor") {
            // Throw an error, we shouldn't be able to change this
            $SD.showAlert(context);
            return;
        }

        let channel = channel_a;
        let current = status.mixers[serial].levels.volumes[channel];
        if (submix_supported && submix_enabled) {
            // Get the Mix Directly
            channel = (mix === "A") ? channel_a : channel_b;
            current = (mix === "A") ? status.mixers[serial].levels.volumes[channel] : status.mixers[serial].levels.submix.inputs[channel].volume;
        } else if ((!submix_supported || !submix_enabled) && mix === "B") {
            // User has likely disabled submixing without reconfiguring this button, in the inspector the MixB selection is handled
            // separately from the MixA dropdown (due to MixB being a subset of MixA), so set the equivilant channel here
            channel = channel_b;
            current =  status.mixers[serial].levels.volumes[channel];
        }

        // We ignore 'mode' in this configuration, adjust and clamp..
        let newVolume = current + adjustment;
        newVolume = Math.min(Math.max(newVolume, 0), 255);

        // Send the new value based on settings
        if (submix_supported && submix_enabled && mix === "B") {
            sendSubVolume(serial, channel, newVolume);
        } else {
            sendVolume(serial, channel, newVolume);
        }
    }
});

/// Configuration
changeVolume.onDidReceiveSettings(({action, event, context, device, payload}) => {
    createBasicMonitor(context, payload.settings.serial);
    setupEncoder(context, payload);
});

changeVolume.onWillAppear(({action, event, context, device, payload}) => {
    createBasicMonitor(context, payload.settings.serial);
    setupEncoder(context, payload);
});

changeVolume.onWillDisappear(({action, event, context, device, payload}) => {
    destroyBasicMontior(context);

    if (encoderVolumeMonitors[context] !== undefined) {
        encoderVolumeMonitors.destroy();
        delete encoderVolumeMonitors[context];
    }
});

function setupEncoder(context, payload) {
    if (payload.controller === "Encoder") {
        let serial = payload.settings.serial;
        let mix = payload.settings.mix;
        let channel_a = payload.settings.channel;
        let ch_a = ChannelNameReadable[payload.settings.channel];
        let channel_b = payload.settings["sub-channel"];
        let title = (mix === "A") ? channel_a : channel_b;


        if (websocket.is_connected() && status !== undefined && status.mixers[serial] !== undefined) {
            let submix_supported = status.mixers[serial].levels.submix_supported === true;
            let submix_enabled = (status.mixers[serial].levels.submix !== null);

            // Make sure submixes are supported and enabled, and that this channel supports submixing
            if (submix_supported && submix_enabled) {
                // Are we Mix A using Line Out, MicMonitor or Headphones?
                if (mix === "A" && (ch_a === "LineOut" || ch_a === "MicMonitor" || ch_a === "Headphones")) {
                    // Do nothing..
                    console.log("NO MIX ADDED");
                } else {
                    title = title + " [" + mix + "]";
                }
            }
        }

        $SD.setFeedback(context, {
            title: title,
            indicator: {
                value: 0
            },
            value: "??"
        })

        createEncoderVolumeMonitor(context, payload.settings);
    }
}

/// IPC Commands
function sendVolume(serial, channel, value) {
    websocket.send_command(serial, {
        "SetVolume": [channel, value]
    });
}

function sendSubVolume(serial, channel, value) {
    websocket.send_command(serial, {
        "SetSubMixVolume": [channel, value]
    });
}
