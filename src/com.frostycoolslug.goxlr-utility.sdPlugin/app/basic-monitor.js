const basicMonitors = {};

function basicExternalStateChange() {
    // We should never fully remove the route monitors, so that when the connection comes back we can reestablish them..
    for (let monitor of Object.keys(basicMonitors)) {
        basicMonitors[monitor].setState();
    }
}

function createBasicMonitor(context, serial) {
    if (basicMonitors[context] !== undefined) {
        if (!basicMonitors[context].equal(context, serial)) {
            console.log("Settings Changed, creating new Monitor..");
            basicMonitors[context].destroy();
            basicMonitors[context] = new BasicMonitor(context, serial);
        } else {
            console.log("Same Settings, ignore creation.");
        }
    } else {
        basicMonitors[context] = new BasicMonitor(context, serial);
    }
    basicMonitors[context].setState();
}

function destroyBasicMontior(context) {
    basicMonitors[context].destroy();
    delete basicMonitors[context];
}

class BasicMonitor {
    // These are all arguably private, but because they're all used in the event scope, the event needs
    // access to them.
    context = undefined;
    serial = undefined;
    monitor = undefined;
    device = undefined;

    #event_handle = () => {};

    constructor(context, serial) {
        console.log("Creating Monitor..")
        this.context = context;
        this.serial = serial;
        this.device = `/mixers/${serial}`

        let self = this;
        this.#event_handle = function(e) {
            self.#onEvent(self, e);
        }
        eventTarget.addEventListener("patch", this.#event_handle);
    }

    equal(context, serial) {
        return (context === this.context && serial === this.serial);
    }

    destroy() {
        console.log("Removing Listener..")
        eventTarget.removeEventListener("patch", this.#event_handle);
    }

    #onEvent(self, event) {
        let patch = event.patch;
        if (patch.path === self.device) {
            self.setState();
        }
    }

    setState() {
        // We have no state to set outside 'Working' and 'Broken'
        if (status === undefined || status.mixers[this.serial] === undefined) {
            $SD.setImage(this.context, RedIcon);
            return;
        }
        $SD.setImage(this.context);
    }
}
