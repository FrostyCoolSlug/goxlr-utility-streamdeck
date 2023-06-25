
const websocket = new Websocket();

document.querySelector("#refresh-serials").addEventListener('click', (e) => {
    e.preventDefault();
    let refresh = document.querySelector("#refresh-serials");
    let warning = document.querySelector("#warning");
    let success = document.querySelector("#success");
    let saveButton = document.querySelector("#save");

    // Configure the default states..
    if (!success.classList.contains("hidden")) {
        success.classList.add("hidden");
    }
    if (!warning.classList.contains("hidden")) {
        warning.classList.add("hidden");
    }

    // Disable the 'Connect' button until this is resolved..
    refresh.disabled = true;
    refresh.innerHTML = "Connecting..";

    document.querySelector("#warning").classList.add("hidden");
    let address = "ws://" + document.querySelector("#websocket-address").value + "/api/websocket";
    console.log(address);
    websocket.set_address(address);
    websocket.connect().then(() => {
        websocket.send_daemon_command("GetStatus").then(() => {
            refresh.innerHTML = "Connected";
            saveButton.disabled = false;
            success.classList.remove("hidden");
        }).catch((e) => console.log(e))
    }).catch((e) => {
        console.log(e)
        document.querySelector("#warning").classList.remove("hidden");

        refresh.innerHTML = "Connect";
        refresh.disabled = false;
    });
})

document.querySelector("#save").addEventListener('click', (e) => {
    e.preventDefault();
    let message = {
        address: document.querySelector("#websocket-address").value,
    };

    // Send the message, and close this window.
    window.opener.sendToInspector(JSON.stringify(message));
    window.close();
})
