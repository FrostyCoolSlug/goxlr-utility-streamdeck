const displayVolume = new Action('com.frostycoolslug.goxlr-utility.display-volume');
const volumeMonitors = {};

// External handlers for if the device disappears, or we're not connected..
function volumeMonitorExternalStateChange() {
    // We should never fully remove the mute monitors, so that when the connection comes back we can reestablish them..
    for (let monitor of Object.keys(volumeMonitors)) {
        volumeMonitors[monitor].setState();
    }
}

/// Configuration
displayVolume.onDidReceiveSettings(({action, event, context, device, payload}) => {
    createVolumeMonitor(context, payload.settings);
});

displayVolume.onWillAppear(({action, event, context, device, payload}) => {
    createVolumeMonitor(context, payload.settings);
});

displayVolume.onWillDisappear(({action, event, context, device, payload}) => {
    volumeMonitors[context].destroy();
    delete volumeMonitors[context];
});

function createVolumeMonitor(context, settings) {
    let serial = settings.serial;
    let mix = settings.mix;
    let channel_a = ChannelNameReadable[settings.channel];
    let channel_b = ChannelNameReadable[settings['sub-channel']];
    let hide_name = settings.hide_name;

    if (volumeMonitors[context] !== undefined) {
        volumeMonitors[context].destroy();
        volumeMonitors[context] = new VolumeMonitor(context, serial, mix, channel_a, channel_b, hide_name);
    } else {
        volumeMonitors[context] = new VolumeMonitor(context, serial, mix, channel_a, channel_b, hide_name);
    }
    volumeMonitors[context].setState();
}

class VolumeMonitor {
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

    constructor(context, serial, mix, channel_a, channel_b, hide_name) {
        this.context = context;
        this.serial = serial;
        this.mix = mix;
        this.channel_a = channel_a;
        this.channel_b = channel_b;
        this.hide_name = hide_name;
        this.monitor_a = `/mixers/${serial}/levels/volumes/${channel_a}`;
        this.monitor_b = `/mixers/${serial}/levels/submix/inputs/${channel_b}/volume`;

        // Monitor for Submix Enable / Disable...
        this.monitor_submix = `/mixers/${serial}/levels/submix`;
        this.device = `/mixers/${serial}`

        this.fader_status = [ `/mixers/${serial}/fader_status/A/mute_state`, `/mixers/${serial}/fader_status/B/mute_state`, `/mixers/${serial}/fader_status/C/mute_state`, `/mixers/${serial}/fader_status/D/mute_state`];

        let self = this;
        this.#event_handle = function(e) {
            self.#onEvent(self, e);
        }
        eventTarget.addEventListener("patch", this.#event_handle);
    }

    equal(context, serial, mix, channel_a, channel_b) {
        return (context === this.context && serial === this.serial && mix === this.mix && channel_a === this.channel_a && channel_b === this.channel_b)
    }

    destroy() {
        eventTarget.removeEventListener("patch", this.#event_handle);
    }

    #onEvent(self, event) {
        let patch = event.patch;
        if (patch.path === self.device || patch.path === self.monitor_a || patch.path === self.monitor_b || patch.path === self.monitor_submix || this.fader_status.includes(patch.path)) {
            self.setState();
        }
    }

    setState() {
        if (status === undefined || status.mixers[this.serial] === undefined) {
            $SD.setImage(this.context, RedIcon);
            return;
        }

        let faders = status.mixers[this.serial].fader_status;

        // Get the channel A volume regardless..
        let volume = status.mixers[this.serial].levels.volumes[this.channel_a];

        if (this.mix === "B" && status.mixers[this.serial].levels.submix === null) {
            // Submixes are disabled, get the Channel A for the defined B..
            volume = status.mixers[this.serial].levels.volumes[this.channel_b];
        }

        if (this.mix === "B" && status.mixers[this.serial].levels.submix !== null) {
            volume = status.mixers[this.serial].levels.submix.inputs[this.channel_b].volume;
        }

        let percent = Math.round(((volume / 255) * 100));

        let muteStatus = '';
        let muteTarget = '';
        for (const [key, value] of Object.entries(faders)) {
            if (value.channel === this.channel_a) {
                if (value.mute_state !== "Unmuted") {
                    muteStatus = "MUTED"
                    if (value.mute_state === "MutedToX") {
                        switch (value.mute_type) {
                            case "ToStream":
                                muteTarget = "Stream";
                                break;
                            case "ToChat":
                                muteTarget = "Chat";
                                break;
                            case "ToHeadphones":
                                muteTarget = "Headphones";
                                break;
                            case "ToLineOut":
                                muteTarget = "Line Out";
                                break;
                        }
                    } else {
                        muteTarget = "GLOBAL";
                    }
                }
                break;
            }
        }

        let svg = `<svg height="100" width="100">`
        if (!this.hide_name) {
            svg += `<text fill="#fff" font-family="Monospace" font-size="26px" x="50&#37;" y="25&#37;" dominant-baseline="middle" text-anchor="middle">${this.channel_a}</text>`
        }            
        svg +=  `<text fill="#fff" font-family="Monospace" font-size="26px" x="50&#37;" y="50&#37;" dominant-baseline="middle" text-anchor="middle">${percent}&#37;</text>
                <text fill="#e00" font-family="Monospace" font-size="20px" x="50&#37;" y="70&#37;" dominant-baseline="middle" text-anchor="middle">${muteStatus}</text>
                <text fill="#fff" font-family="Monospace" font-size="20px" x="50&#37;" y="90&#37;" dominant-baseline="middle" text-anchor="middle">${muteTarget.toUpperCase()}</text>
                </svg>`;
                   
        let image = "data:image/svg+xml;charset=utf8," + svg;
        $SD.setImage(this.context, image);
    }
}
