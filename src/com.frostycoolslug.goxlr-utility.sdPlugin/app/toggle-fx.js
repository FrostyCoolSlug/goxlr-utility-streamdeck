const fxToggle = new Action('com.frostycoolslug.goxlr-utility.toggle-fx');
const fxMonitors = {};

/// Utility Behaviours
function fxToggleExternalStateChange() {
    // We should never fully remove the FX monitors, so that when the connection comes back we can reestablish them..
    for (let monitor of Object.keys(fxMonitors)) {
        fxMonitors[monitor].setState();
    }
}

/// Activators
fxToggle.onKeyUp(({action, context, device, event, payload}) => {
    // Toggle the Setting..
    let serial = payload.settings.serial;
    let button = payload.settings.button;
    let mode = payload.settings.mode;

    if (!websocket.is_connected()) {
        console.warn("Not Connected to Utility, Unable to Execute");
        $SD.setState(context, payload.state);
        $SD.showAlert(context);
    } else if (status === undefined || status.mixers[serial] === undefined) {
        console.warn("Mixer isn't present, unable to perform action")
        $SD.setState(context, payload.state);
        $SD.showAlert(context);
    } else {
        if (status.mixers[serial].hardware.device_type !== "Full") {
            // NOT A FULL SIZED GOXLR, DO NOTHING.
            $SD.setState(context, payload.state);
            $SD.showAlert(context);
            return;
        }

        let current = status.mixers[serial].effects.is_enabled;
        if (button !== "fx") {
            current = status.mixers[serial].effects.current[button].is_enabled;
        }
        let newValue = (mode === "toggle" || mode === undefined) ? !current : (mode === "enable");

        console.log(`State: ${current} -> ${newValue}`);
        if (newValue !== current) {
            sendEffectState(serial, button, newValue);
        }

        // Forcably update the icon, the SD software will always toggle, we need to tweak it so it restores.
        $SD.setState(context, newValue ? 0 : 1);
    }
});

/// Configuration
fxToggle.onDidReceiveSettings(({action, event, context, device, payload}) => {
    createFxMonitor(context, payload.settings);
});

fxToggle.onWillAppear(({action, event, context, device, payload}) => {
    createFxMonitor(context, payload.settings);
});

fxToggle.onWillDisappear(({action, event, context, device, payload}) => {
    fxMonitors[context].destroy();
   delete fxMonitors[context];
});

/// Monitors
function createFxMonitor(context, settings) {
    let serial = settings.serial;

    if (fxMonitors[context] !== undefined) {
        if (!fxMonitors[context].equal(context, serial)) {
            fxMonitors[context].destroy();
            fxMonitors[context] = new FxMonitor(context, settings.serial, settings.button);
        }
    } else {
        fxMonitors[context] = new FxMonitor(context, settings.serial, settings.button);
    }
    fxMonitors[context].setState();
}

class FxMonitor {
    // These are all arguably private, but because they're all used in the event scope, the event needs
    // access to them.
    context = undefined;
    serial = undefined;
    button = undefined;
    monitor = undefined;
    device = undefined;

    #event_handle = () => {};

    constructor(context, serial, button) {
        this.context = context;
        this.serial = serial;
        this.button = button;

        // status.mixers[serial].effects.is_enabled
        if (button === "fx") {
            this.monitor = `/mixers/${serial}/effects/is_enabled`;
        }  else {
            this.monitor = `/mixers/${serial}/effects/current/${button}/is_enabled`
        }
        this.device = `/mixers/${serial}`

        let self = this;
        this.#event_handle = function(e) {
            self.#onEvent(self, e);
        }
        eventTarget.addEventListener("patch", this.#event_handle);
    }

    equal(context, serial, button) {
        return (context === this.context && serial === this.serial && this.button === button)
    }

    destroy() {
        eventTarget.removeEventListener("patch", this.#event_handle);
    }

    #onEvent(self, event) {
        let patch = event.patch;
        if (patch.path === self.device || patch.path === self.monitor) {
            self.setState();
        }
    }

    setState() {
        if (status === undefined || status.mixers[this.serial] === undefined) {
            $SD.setImage(this.context, RedIcon);
            return;
        }

        // Don't do anything unless we're a full sized device.
        if (status.mixers[this.serial].hardware.device_type !== "Full") {
            $SD.setImage(this.context, RedIcon);
            return;
        }

        let value = status.mixers[this.serial].effects.is_enabled;
        if (this.button !== "fx") {
            value = status.mixers[this.serial].effects.current[this.button].is_enabled;
        }

        let state = (value) ? 0 : 1;
        $SD.setImage(this.context);
        $SD.setState(this.context, state);
    }
}

function sendEffectState(serial, button, enabled) {
    let command = "SetFXEnabled";
    if (button === "megaphone") {
        command = "SetMegaphoneEnabled";
    } else if (button === "robot") {
        command = "SetRobotEnabled";
    } else if (button === "hard_tune") {
        command = "SetHardTuneEnabled";
    }
    websocket.send_command(serial, {
        [command]: enabled
    });
}
