const changeProfile = new Action('com.frostycoolslug.goxlr-utility.profile');
const profileMonitors = {};

/// Utility Behaviours
function profileExternalStateChange() {
    console.log("Handling External Profile State Change..");

    // We should never fully remove the route monitors, so that when the connection comes back we can reestablish them..
    for (let monitor of Object.keys(profileMonitors)) {
        profileMonitors[monitor].setState();
    }
}

/// Activators
changeProfile.onKeyUp(({action, context, device, event, payload}) => {
    // Grab the profile to load from the payload..
    let profile = payload.settings.profile;
    let serial = payload.settings.serial;

    if (!websocket.is_connected()) {
        console.warn("Not Connected to Utility, Unable to Execute");
    } else {
        loadProfile(serial, profile);
    }
});

changeProfile.onDidReceiveSettings(({action, event, context, device, payload}) => {
    console.log("Got Settings..");
    createProfileMonitor(context, payload.settings, "profile_name");
});

changeProfile.onWillAppear(({action, event, context, device, payload}) => {
    createProfileMonitor(context, payload.settings, "profile_name");
});

changeProfile.onWillDisappear(({action, event, context, device, payload}) => {
    console.log("Button Going Away: " + context);
    profileMonitors[context].destroy();

    // Remove it from the struct...
    delete profileMonitors[context];
});

/// Monitors
function createProfileMonitor(context, settings, key) {
    let serial = settings.serial;
    let profile = settings.profile;

    if (profileMonitors[context] !== undefined) {
        if (!profileMonitors[context].equal(context, serial, profile, key)) {
            console.log("Settings Changed, creating new Monitor..");
            profileMonitors[context].destroy();
            profileMonitors[context] = new ProfileMonitor(context, settings.serial, profile, key);
        } else {
            console.log("Same Settings, ignore creation.");
        }
    } else {
        profileMonitors[context] = new ProfileMonitor(context, settings.serial, profile, key);
    }
    profileMonitors[context].setState();
}

class ProfileMonitor {
    // These are all arguably private, but because they're all used in the event scope, the event needs
    // access to them.
    context = undefined;
    serial = undefined;
    profile = undefined;
    key = undefined;
    monitor = undefined;
    device = undefined;

    #event_handle = () => {};

    constructor(context, serial, profile, key) {
        console.log("Creating Profile Monitor..")
        this.context = context;
        this.serial = serial;
        this.profile = profile;
        this.key = key;

        this.monitor = `/mixers/${serial}/${key}`;
        this.device = `/mixers/${serial}`

        let self = this;
        this.#event_handle = function(e) {
            self.#onEvent(self, e);
        }
        eventTarget.addEventListener("patch", this.#event_handle);
    }

    equal(context, serial, profile, key) {
        return (context === this.context && serial === this.serial && profile === this.profile && key === this.key);
    }

    destroy() {
        console.log("Removing Listener..")
        eventTarget.removeEventListener("patch", this.#event_handle);
    }

    #onEvent(self, event) {
        let patch = event.patch;
        console.log(patch.path + " - " + self.monitor);

        if (patch.path === self.device || patch.path === self.monitor) {
            self.setState();
        }
    }

    setState() {
        if (status === undefined || status.mixers[this.serial] === undefined) {
            $SD.setState(this.context, 2);
            return;
        }
        let active = status.mixers[this.serial][this.key];
        console.log(active);

        $SD.setState(this.context, (active === this.profile) ? 0 : 1);
    }
}


function loadProfile(serial, name) {
    websocket.send_command(serial, {
        "LoadProfile": [name, true]
    }).then(() => console.log("Loaded Profile " + name));
}