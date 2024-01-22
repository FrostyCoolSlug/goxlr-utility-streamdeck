const loadFxBank = new Action('com.frostycoolslug.goxlr-utility.load-effect-bank');
const fxBankMonitors = {};

// External handlers for if the device disappears, or we're not connected..
function fxBankExternalStateChange() {
    // We should never fully remove the mute monitors, so that when the connection comes back we can reestablish them..
    for (let monitor of Object.keys(fxBankMonitors)) {
        fxBankMonitors[monitor].setState();
    }
}


loadFxBank.onKeyUp(({action, context, device, event, payload}) => {
    // Toggle the Setting..
    let serial = payload.settings.serial;
    let bank = payload.settings.bank;

    if (!websocket.is_connected()) {
        console.warn("Not Connected to Utility, Unable to Execute");
        $SD.setState(context, payload.state);
        $SD.showAlert(context);
    } else if (status === undefined || status.mixers[serial] === undefined) {
        console.warn("Mixer isn't present, unable to perform action")
        $SD.setState(context, payload.state);
        $SD.showAlert(context);
    } else {
        let currentValue = status.mixers[serial].effects.active_preset;
        console.log(bank);
        console.log(currentValue);

        if (bank !== currentValue) {
            loadBank(serial, bank);
        } else {
            // This will always be true..
            $SD.setState(context, 0);
        }
    }
});

/// Configuration
loadFxBank.onDidReceiveSettings(({action, event, context, device, payload}) => {
    createFxBankMonitor(context, payload.settings);
});

loadFxBank.onWillAppear(({action, event, context, device, payload}) => {
    createFxBankMonitor(context, payload.settings);
});

loadFxBank.onWillDisappear(({action, event, context, device, payload}) => {
    fxBankMonitors[context].destroy();
    delete fxBankMonitors[context];
});

function createFxBankMonitor(context, settings) {
    let serial = settings.serial;
    let bank = settings.bank;

    if (fxBankMonitors[context] !== undefined) {
        if (!fxBankMonitors[context].equal(context, serial, bank)) {
            fxBankMonitors[context].destroy();
            fxBankMonitors[context] = new FxBankMonitor(context, settings.serial, bank);
        }
    } else {
        fxBankMonitors[context] = new FxBankMonitor(context, settings.serial, bank);
    }
    fxBankMonitors[context].setState();
}

class FxBankMonitor {
    // These are all arguably private, but because they're all used in the event scope, the event needs
    // access to them.
    context = undefined;

    serial = undefined;
    bank = undefined;

    monitor = undefined;
    device = undefined;

    #event_handle = () => {};

    constructor(context, serial, bank) {
        this.context = context;
        this.serial = serial;
        this.bank = bank;

        this.monitor = `/mixers/${serial}/effects/active_preset`;
        this.device = `/mixers/${serial}`

        let self = this;
        this.#event_handle = function(e) {
            self.#onEvent(self, e);
        }
        eventTarget.addEventListener("patch", this.#event_handle);
    }

    equal(context, serial, bank) {
        return (context === this.context && serial === this.serial && bank === this.bank)
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
        console.log("Checking State..");
        if (status === undefined || status.mixers[this.serial] === undefined) {
            $SD.setImage(this.context, RedIcon);
            return;
        }
        let value = status.mixers[this.serial].effects.active_preset;


        let state = (value === this.bank) ? 0 : 1;
        $SD.setImage(this.context);
        $SD.setState(this.context, state);
    }
}

function loadBank(serial, preset) {
    websocket.send_command(serial, {
        "SetActiveEffectPreset": preset
    });
}
