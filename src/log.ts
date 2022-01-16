import * as util from "./util";

export enum Level {
    Off = 0,
    Error,
    Warn,
    Info,
    Debug,
    Trace,
}

let $level: Level = Level.Info;

/**
 * 设置日志等级
 * @param level 日志等级
 */
export function setLevel(level: Level) {
    $level = level;
}

function logHeader(level: Level): string {
    const now = util.now();
    let milliseconds = now % 1000;
    let ms = "" + milliseconds;
    while (ms.length < 3) {
        ms = "0" + ms;
    }
    let header = util.formatTime(now) + "." + ms + "] ";
    switch (level) {
        case Level.Error:
            return "[E " + header;
        case Level.Warn:
            return "[W " + header;
        case Level.Info:
            return "[I " + header;
        case Level.Debug:
            return "[D " + header;
        case Level.Trace:
            return "[T " + header;
        default:
            return "[- " + header;
    }
}

/**
 * 输出消息调试日志
 */
export function trace(format: string, ...params: any[]) {
    if ($level >= Level.Debug) {
        console.trace(logHeader(Level.Trace) + format, ...params);
    }
}

/**
 * 输出调试日志
 */
export function debug(format: string, ...params: any[]) {
    if ($level >= Level.Debug) {
        console.debug(logHeader(Level.Debug) + format, ...params);
    }
}

/**
 * 输出重要日志
 */
export function info(format: string, ...params: any[]) {
    if ($level >= Level.Info) {
        console.info(logHeader(Level.Info) + format, ...params);
    }
}

/**
 * 输出警告日志
 */
export function warn(format: string, ...params: any[]) {
    if ($level >= Level.Warn) {
        console.warn(logHeader(Level.Warn) + format, ...params);
    }
}

/**
 * 输出错误日志
 */
export function error(format: string, ...params: any[]) {
    if ($level >= Level.Error) {
        console.error(logHeader(Level.Error) + format, ...params);
    }
}