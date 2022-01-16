import * as THREE from 'three'

export const MILLISECOND = 1;
export const SECOND = 1000 * MILLISECOND;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export declare interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export function vec3(x?: number | Vector3, y?: number, z?: number): THREE.Vector3 {
    if (typeof x === 'number') {
        return new THREE.Vector3(x, y, z)
    }
    if (x) {
        return new THREE.Vector3(x.x, x.y, x.z)
    }
    return new THREE.Vector3();
}

export declare interface Size {
    readonly width: number;
    readonly height: number;
}

export function size(w?: number | Size, h?: number): Size {
    if (typeof w === 'number') {
        return { width: w, height: h }
    }
    if (w) {
        return { width: w.width, height: w.height }
    }
    return { width: 0, height: 0 }
}

/**
 * 设置事件偏差（毫秒）
 */
let $offset = 0;

/**
 * 获取没有偏差的本地时间戳（毫秒）
 */
export function getLocalTimestamp(): number {
    return new Date().getTime();
}

/**
 * 同步服务器时间
 * @param timestamp
 */
export function sync(timestamp: number) {
    $offset = timestamp - getLocalTimestamp();
}

/**
 * 获取当前毫秒级别时间戳
 * @return {number}
 */
export function now(): number {
    return getLocalTimestamp() + $offset;
};

/**
 * 格式化毫秒时间戳
 * @param t
 * @param fmt
 */
export function formatTime(t: number, fmt?: string): string {
    fmt = fmt || "yyyy/MM/dd hh:mm:ss";
    var d = new Date(t);
    var o = {
        "M+": d.getMonth() + 1,
        "d+": d.getDate(),
        "h+": d.getHours(),
        "m+": d.getMinutes(),
        "s+": d.getSeconds(),
        "q+": Math.floor((d.getMonth() + 3) / 3),
        "S": d.getMilliseconds()
    };
    if (/(y+)/.test(fmt)) {
        fmt = fmt.replace(RegExp.$1, (d.getFullYear() + "").substr(4 - RegExp.$1.length));
    }
    for (var k in o) {
        if (new RegExp("(" + k + ")").test(fmt)) {
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length === 1) ?
                (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
        }
    }
    return fmt;
};

let $next: number = 0;

/**
 * 分配一个整数唯一ID，适用于一些游戏运行中序号等。
 *
 * 该 ID 从 1 开始，每次重启游戏后又会重新从 1 开始。如果需要更强的全球唯一ID，请使用 uuid.v4() 或 uuid.v4thin() 接口
 */
export function genNextID(): number {
    $next++;
    return $next;
}

/**
 * 获取第 4 版的全球唯一 ID
 */
export function genUUID(): string {
    let d = new Date().getTime();
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        d += performance.now();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

/**
 * 给文本打码，使中间至少 1/3 不可见
 * @param {string} s
 */
export function mask(s: string): string {
    if (typeof s !== 'string') {
        return "";
    }
    var totalLength = s.length;
    if (totalLength === 0) {
        return s;
    }
    if (totalLength > 3) {
        var tailLength = Math.floor(totalLength / 3);
        var headLength = tailLength;
        var maskLength = totalLength - headLength - tailLength;
        return s.substr(0, headLength) + "*".repeat(maskLength) + s.substr(headLength + maskLength);
    }
    return "*".repeat(totalLength);
};

/**
 * 格式化字符串
 * @param fmt 输出格式
 */
export function sprintf(fmt: string, ...params: any[]): string {
    if (arguments.length === 0) {
        return "";
    }
    var args = Array.prototype.slice.call(arguments, 1);
    return fmt.replace(/{(\d+)}/g, function (m, i) {
        return args[i];
    });
};
