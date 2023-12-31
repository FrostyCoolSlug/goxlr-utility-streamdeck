/**
 * This websocket code was pulled from the GoXLR Utilities WebUI for use in the Stream Deck
 * plugin.
 */
class Websocket {
    #address = "";

    #connection_promise = [];

    #message_queue = []
    #websocket = undefined;
    #command_index = 0;

    #last_connect_error = false;

    #close_method = () => {
    };
    #patch_method = () => {
    }

    set_address(address) {
        this.#address = address;
    }

    is_connected() {
        if (this.#websocket !== undefined) {
            return (this.#websocket.readyState === 0 || this.#websocket.readyState === 1);
        }
        return false;
    }

    set_patch_method(fn) {
        this.#patch_method = fn;
    }

    connect() {
        if (this.#address === undefined) {
            console.error("Set Address First!");
            return;
        }

        if (this.is_connected()) {
            console.error("Already Connected!");
            return;
        }

        this.#websocket = new WebSocket(this.#address);

        let self = this;
        self.#websocket.addEventListener('message', function (event) {
            // A message can be one of two things, either a DaemonStatus, or an error..
            let json = JSON.parse(event.data);

            let message_id = json.id;
            let message_data = json.data;
            if (message_data["Status"] !== undefined) {
                self.#fulfill_promise(message_id, message_data, true);
            } else if (message_data["Patch"] !== undefined) {
                self.#patch_method(message_data['Patch']);
                // Nothing ever requests patch data, so we can ignore this.
            } else if (message_data === "Ok") {
                self.#fulfill_promise(message_id, message_data, true);
            } else {
                self.#fulfill_promise(message_id, message_data, false);
            }
        });

        self.#websocket.addEventListener('open', function () {
            self.#connection_promise[0]();
            self.#connection_promise[0] = undefined;
        });

        self.#websocket.addEventListener('close', function () {
            if (self.is_connected()) {
                return;
            }

            if (self.#last_connect_error) {
                self.#last_connect_error = false;
                return;
            }
            self.#close_method();
        });

        self.#websocket.addEventListener('error', function () {
            self.#last_connect_error = true;
            if (self.#connection_promise[0] !== undefined) {
                self.#connection_promise[1]();
                self.#connection_promise[0] = undefined;
            }
        });

        return new Promise((resolve, reject) => {
            self.#connection_promise[0] = resolve;
            self.#connection_promise[1] = reject;
        });
    }

    onClose(fn) {
        this.#close_method = fn;
    }

    disconnect() {
        if (this.is_connected()) {
            this.#websocket.close();
        }
    }

    send_daemon_command(command) {
        return this.#sendRequest(command);
    }

    send_command(serial, command) {
        let request = {
            "Command": [
                serial,
                command
            ]
        }
        return this.#sendRequest(request);
    }

    #sendRequest(request) {
        let id = this.#command_index++;

        // Wrap this request with an ID
        let final_request = {
            id: id,
            data: request,
        }

        this.#websocket.send(JSON.stringify(final_request));

        // Create and return a response promise...
        let self = this;
        return new Promise((resolve, reject) => {
            self.#message_queue[id] = [];
            self.#message_queue[id][0] = resolve;
            self.#message_queue[id][1] = reject;
        });
    }

    #fulfill_promise(id, data, is_success) {
        if (this.#message_queue[id] !== undefined) {
            this.#message_queue[id][is_success ? 0 : 1](data);
            delete this.#message_queue[id];
        }
    }
}
