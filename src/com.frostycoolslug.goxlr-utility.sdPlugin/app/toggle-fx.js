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

    if (!websocket.is_connected()) {
        console.warn("Not Connected to Utility, Unable to Execute");
        $SD.setState(context, payload.state);
        $SD.showAlert(context);
    } else if (status === undefined || status.mixers[serial] === undefined) {
        console.warn("Mixer isn't present, unable to perform action")
        $SD.setState(context, payload.state);
        $SD.showAlert(context);
    } else {
        let newValue = !status.mixers[serial].effects.is_enabled;
        sendFxState(serial, newValue);
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
            fxMonitors[context] = new FxMonitor(context, settings.serial);
        }
    } else {
        fxMonitors[context] = new FxMonitor(context, settings.serial);
    }
    fxMonitors[context].setState();
}

class FxMonitor {
    // These are all arguably private, but because they're all used in the event scope, the event needs
    // access to them.
    context = undefined;
    serial = undefined;
    monitor = undefined;
    device = undefined;

    #event_handle = () => {};

    constructor(context, serial) {
        this.context = context;
        this.serial = serial;

        // status.mixers[serial].effects.is_enabled
        this.monitor = `/mixers/${serial}/effects/is_enabled`;
        this.device = `/mixers/${serial}`

        let self = this;
        this.#event_handle = function(e) {
            self.#onEvent(self, e);
        }
        eventTarget.addEventListener("patch", this.#event_handle);
    }

    equal(context, serial) {
        return (context === this.context && serial === this.serial)
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
        let value = status.mixers[this.serial].effects.is_enabled;
        let state = (value) ? 0 : 1;
        $SD.setImage(this.context);
        $SD.setState(this.context, state);
    }
}

/// IPC Commands
function sendFxState(serial, enabled) {
    websocket.send_command(serial, {
        "SetFXEnabled": enabled
    });
}
