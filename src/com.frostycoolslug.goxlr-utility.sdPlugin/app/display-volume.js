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

    if (volumeMonitors[context] !== undefined) {
        if (!volumeMonitors[context].equal(context, serial, mix, channel_a, channel_b)) {
            volumeMonitors[context].destroy();
            volumeMonitors[context] = new VolumeMonitor(context, settings.serial, mix, channel_a, channel_b);
        }
    } else {
        volumeMonitors[context] = new VolumeMonitor(context, settings.serial, mix, channel_a, channel_b);
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

    constructor(context, serial, mix, channel_a, channel_b) {
        this.context = context;
        this.serial = serial;
        this.mix = mix;
        this.channel_a = channel_a;
        this.channel_b = channel_b;

        this.monitor_a = `/mixers/${serial}/levels/volumes/${channel_a}`;
        this.monitor_b = `/mixers/${serial}/levels/submix/inputs/${channel_b}/volume`;

        // Monitor for Submix Enable / Disable...
        this.monitor_submix = `/mixers/${serial}/levels/submix`;
        this.device = `/mixers/${serial}`

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
        if (patch.path === self.device || patch.path === self.monitor_a || patch.path === self.monitor_b || patch.path === self.monitor_submix) {
            self.setState();
        }
    }

    setState() {
        if (status === undefined || status.mixers[this.serial] === undefined) {
            $SD.setImage(this.context, RedIcon);
            return;
        }

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

        let svg = `<svg height="100" width="100"><text fill="#fff" font-family="Monospace" font-size="26px" x="50&#37;" y="50&#37;" dominant-baseline="middle" text-anchor="middle">${percent}&#37;</text></svg>`;
        let image = "data:image/svg+xml;charset=utf8," + svg;
        $SD.setImage(this.context, image);
    }
}
