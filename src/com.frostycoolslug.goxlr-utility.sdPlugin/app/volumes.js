const changeVolume = new Action('com.frostycoolslug.goxlr-utility.volume');


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

/// Configuration
changeVolume.onDidReceiveSettings(({action, event, context, device, payload}) => {
    createBasicMonitor(context, payload.settings.serial);
});

changeVolume.onWillAppear(({action, event, context, device, payload}) => {
    createBasicMonitor(context, payload.settings.serial);
});

changeVolume.onWillDisappear(({action, event, context, device, payload}) => {
    destroyBasicMontior(context);
});

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
