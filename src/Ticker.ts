import { Handler } from "./Handler";

export class Timer {
    private $handler: Handler;
    private $begin: number;
    private $interval: number;
    private $once: boolean;

    private static $nextId: number = 0;
    private $id: number;
    private $times: number;
    private $next: number;

    constructor(handler: Handler, begin: number, interval: number, once: boolean) {
        this.$handler = handler;
        this.$begin = begin;
        this.$interval = interval;
        this.$once = once;
        this.$times = 0;
        this.$next = this.$begin + this.$interval;
        Timer.$nextId++;
        this.$id = Timer.$nextId;
    }

    public get id(): number {
        return this.$id;
    }

    next(): number {
        return this.$next;
    }

    call(): boolean {
        this.$handler.call();
        this.$times++;
        this.$next = this.$begin + this.$interval * (this.$times + 1);
        return this.$once;
    }
}