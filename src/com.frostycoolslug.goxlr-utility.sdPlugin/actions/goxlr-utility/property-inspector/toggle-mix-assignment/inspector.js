/// <reference path="../../../libs/js/property-inspector.js" />
/// <reference path="../../../libs/js/utils.js" />

const websocket = new Websocket();
let pluginSettings;

/**
 * This is called once we've had our handoff from the setup code, ensuring everything is good!
 * setup will leave the websocket open for us, so we can do our thing.
 */
function runPlugin() {
    // Show the refresh button..
    document.querySelector("#refresh").classList.remove("hidden");

    // Populate the Mixers
    let mixers = [];
    for (let serial in device.mixers) {
        mixers.push(serial);
    }

    if (mixers.length === 0) {
        document.querySelector("#no-mixers").classList.remove("hidden");
        return;
    }

    if (!device.mixers[mixers[0]].levels.submix) {
        document.querySelector("#no-submix").classList.remove("hidden");
        return;
    }

    let serialList = document.querySelector("#mixers");
    while (serialList.hasChildNodes()) {
        serialList.removeChild(serialList.firstChild);
    }

    // Populate the mixer input..
    for (let mixer of mixers) {
        let element = document.createElement("option");
        element.text = mixer;
        element.value = mixer;
        serialList.add(element);
    }

    serialList.disabled = false;
    if (mixers.length > 1) {
        document.querySelector("#mixer").classList.remove("hidden");
    }

    // We need to do a firmware version check to work out the correct Mix settings
    if (firmwareSupportsMix2()) {
        if (isDeviceMini()) {
            document.querySelector("#sampler").remove();
        }
    } else {
        document.querySelector("#mix2").remove();
    }

    document.querySelector("#settings").classList.remove("hidden");

    // Set any 'Known' form values, default others.
    Utils.setFormValue(pluginSettings, document.querySelector("#toggle-mix-assignment-form"))

    // Get all the default filled fields and store them to settings.
    pluginSettings = Utils.getFormValue(document.querySelector("#toggle-mix-assignment-form"));
    $PI.setSettings(pluginSettings);

    // We're done, disconnect the websocket.
    websocket.disconnect();
}

document.querySelector("#mixers").addEventListener('change', (e) => {
    pluginSettings = Utils.getFormValue(document.querySelector("#toggle-mix-assignment-form"));
    $PI.setSettings(pluginSettings);
});

document.querySelector("#output").addEventListener('change', (e) => {
    pluginSettings = Utils.getFormValue(document.querySelector("#toggle-mix-assignment-form"));
    $PI.setSettings(pluginSettings);
});

function firmwareSupportsMix2() {
    let current_mixer = document.querySelector("#mixers").value;
    if (device.mixers[current_mixer] === undefined) {
        return;
    }

    if (isDeviceMini()) {
        return versionNewerOrEqualTo( device.mixers[current_mixer].hardware.versions.firmware, [1,3,0,0]);
    }
    return versionNewerOrEqualTo( device.mixers[current_mixer].hardware.versions.firmware, [1,5,0,0]);
}

function isDeviceMini() {
    let current_mixer = document.querySelector("#mixers").value;
    // Do this here, rather than on created() so it can update if the device changes
    if (device.mixers[current_mixer] === undefined) {
        return;
    }

    return device.mixers[current_mixer].hardware.device_type === "Mini";
}

function versionNewerOrEqualTo(version, comparison) {
    // VersionNumber on the rust side requires the first two fields to be set.
    if (version[0] > comparison[0]) {
        return true;
    }
    if (version[0] < comparison[0]) {
        return false;
    }

    if (version[1] > comparison[1]) {
        return true;
    }
    if (version[1] < comparison[1]) {
        return false;
    }

    if (version[2] !== null) {
        if (comparison[2] !== null) {
            if (version[2] > comparison[2]) {
                return true;
            }
            if (version[2] < comparison[2]) {
                return false;
            }
        } else {
            return true;
        }
    } else if (comparison[2] !== null) {
        return false;
    }

    if (version[3] !== null) {
        if (comparison[3] !== null) {
            if (version[3] >= comparison[3]) {
                return true;
            }
        } else {
            return true;
        }
    }

    // If we get here, everything has matched.
    return true;
}