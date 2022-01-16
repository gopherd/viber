export class Handler {
    fn: Function;
    args: any[];

    constructor(fn: Function, ...args: any[]) {
        this.fn = fn;
        this.args = args;
    }

    call() {
        this.fn(...this.args);
    }
}