const changeProfile = new Action('com.frostycoolslug.goxlr-utility.profile');
const changeMicProfile = new Action('com.frostycoolslug.goxlr-utility.micprofile');
const profileMonitors = {};

/// Utility Behaviours
function profileExternalStateChange() {
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
        $SD.setState(context, payload.state);
        $SD.showAlert(context);
    } else if (status === undefined || status.mixers[serial] === undefined) {
        console.warn("Cannot Change Profile, Device not found");
        $SD.setState(context, payload.state);
        $SD.showAlert(context);
    } else {
        loadProfile(serial, profile);
        if (status.mixers[serial].profile_name === profile) {
            // Profile isn't changing, force state back.
            profileMonitors[context].setState();
        }
    }
});

changeMicProfile.onKeyUp(({action, context, device, event, payload}) => {
    // Grab the profile to load from the payload..
    let profile = payload.settings.profile;
    let serial = payload.settings.serial;

    if (!websocket.is_connected()) {
        console.warn("Not Connected to Utility, Unable to Execute");
        $SD.showAlert(context);
        $SD.setState(payload.state);
    } else if (status === undefined || status.mixers[serial] === undefined) {
        console.warn("Cannot Change Profile, Device not found");
        $SD.showAlert(context);
        $SD.setState(payload.state);
    } else {
        loadMicProfile(serial, profile);
        if (status.mixers[serial].mic_profile_name === profile) {
            // Profile isn't changing, force state back.
            profileMonitors[context].setState();
        }
    }
});


changeProfile.onDidReceiveSettings(({action, event, context, device, payload}) => {
    createProfileMonitor(context, payload.settings, "profile_name");
});

changeMicProfile.onDidReceiveSettings(({action, event, context, device, payload}) => {
    createProfileMonitor(context, payload.settings, "mic_profile_name");
});


changeProfile.onWillAppear(({action, event, context, device, payload}) => {
    createProfileMonitor(context, payload.settings, "profile_name");
});

changeMicProfile.onWillAppear(({action, event, context, device, payload}) => {
    createProfileMonitor(context, payload.settings, "mic_profile_name");
});

changeProfile.onWillDisappear(({action, event, context, device, payload}) => {
    profileMonitors[context].destroy();
    delete profileMonitors[context];
});

changeMicProfile.onWillDisappear(({action, event, context, device, payload}) => {
    profileMonitors[context].destroy();
    delete profileMonitors[context];
});

/// Monitors
function createProfileMonitor(context, settings, key) {
    let serial = settings.serial;
    let profile = settings.profile;

    if (profileMonitors[context] !== undefined) {
        if (!profileMonitors[context].equal(context, serial, profile, key)) {
            profileMonitors[context].destroy();
            profileMonitors[context] = new ProfileMonitor(context, settings.serial, profile, key);
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


        let active = status.mixers[this.serial][this.key];
        let state = (active === this.profile) ? 0 : 1;
        $SD.setImage(this.context);
        $SD.setState(this.context, state);
    }
}


function loadProfile(serial, name) {
    websocket.send_command(serial, {
        "LoadProfile": [name, true]
    });
}

function loadMicProfile(serial, name) {
    websocket.send_command(serial, {
        "LoadMicProfile": [name, true]
    });
}
