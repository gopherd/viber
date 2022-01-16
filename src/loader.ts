import * as log from "./log";
import { Reader, Unmarshaler } from "./Reader";

export function load<T>(url: string, options?: {
    parser?: Function,
    responseType?: XMLHttpRequestResponseType,
}): Promise<T> {
    return new Promise<T>((resolve: Function, reject: Function) => {
        let xhr = new XMLHttpRequest();
        if (options) {
            if (options.responseType) {
                xhr.responseType = options.responseType;
            }
        }
        xhr.open('GET', url);
        xhr.onload = function () {
            if (this.status >= 200 && this.status < 300) {
                try {
                    if (options && options.parser) {
                        let x = options.parser(xhr.response) as T;
                        resolve(x);
                    } else {
                        resolve(xhr.response as T);
                    }
                } catch (e: any) {
                    reject({
                        error: e
                    });
                }
            } else {
                reject({
                    error: xhr.statusText
                });
            }
        };
        xhr.onerror = function () {
            reject({
                error: xhr.statusText
            });
        };
        xhr.send();
    });
}

export function parse<T extends Unmarshaler>(ctor: { new(): T }, data: ArrayBuffer): T {
    log.debug("parse: length=%d", data.byteLength);
    const little = true;
    try {
        let t = new ctor();
        let r = new Reader(new DataView(data), little);
        t.unmarshal(r);
        return t;
    } catch (e) {
        log.error(e);
        return null;
    }
}

export function loadBinary<T extends Unmarshaler>(ctor: { new(): T }, url: string): Promise<T> {
    return load<T>(url, {
        responseType: "arraybuffer",
        parser: (data: ArrayBuffer) => { return parse(ctor, data) },
    });
}

export function async(fn: Function) {
    new Promise((resolve: Function) => {
        resolve();
    }).then(() => {
        fn();
    });
}