declare interface Container<T> {
    /**
     * 获取元素个数
     * @return {number}
     */
    size(): number;

    /**
     * 获取第 i 个元素
     * @return {number}
     */
    get(i: number): null | T;

    /**
     * 交换两个元素
     * @param i
     * @param j
     */
    swap(i: number, j: number): void;

    /**
     * 比较两个元素的大小
     * @param i
     * @param j
     * @return {boolean}
     */
    less(i: number, j: number): boolean;

    /**
     * 新增元素到尾部
     * @param x
     */
    pushBack(x: T): void;

    /**
     * 移除并返回尾部元素
     * @return {*}
     */
    popBack(): null | T;
}

export class Heap<T, C extends Container<T> = Array<T>> {
    container: C;
    constructor(c: C) {
        this.container = c;
    }

    /**
     * 初始化堆
     */
    public init() {
        var n = this.container.size();
        for (var i = (n >> 1) - 1; i >= 0; i--) {
            this._down(i, n);
        }
    }

    /**
     * 获取元素个数
     * @return {number}
     */
    public size(): number {
        return this.container.size();
    }

    /**
     * 将 x 放入堆中
     * @param x
     */
    public push(x: T) {
        this.container.pushBack(x);
        this._up(this.container.size() - 1);
    }

    /**
     * 弹出堆中最小元素
     * @return {*}
     */
    public pop(): null | T {
        var n = this.container.size() - 1;
        this.container.swap(0, n);
        this._down(0, n);
        return this.container.popBack();
    }

    public remove(i: number): null | T {
        var n = this.container.size() - 1;
        if (n !== i) {
            this.container.swap(i, n);
            if (!this._down(i, n)) {
                this._up(i);
            }
        }
        return this.container.popBack();
    }

    public fix(i: number) {
        if (!this._down(i, this.container.size())) {
            this._up(i);
        }
    }

    private _up(j: number) {
        while (true) {
            var i = j - 1;
            if (i >= 0) {
                i = i >> 1;
            } else {
                i = 0;
            }
            if (i === j || !this.container.less(j, i)) {
                break;
            }
            this.container.swap(i, j);
            j = i;
        }
    }

    private _down(i0: number, n: number) {
        var i = i0;
        while (true) {
            var j1 = 2 * i + 1;
            if (j1 >= n || j1 < 0) {
                break;
            }
            var j = j1;
            var j2 = j1 + 1;
            if (j2 < n && this.container.less(j2, j1)) {
                j = j2;
            }
            if (!this.container.less(j, i)) {
                break;
            }
            this.container.swap(i, j);
            i = j;
        }
        return i > i0;
    }
}

export class Array<T> {
    /**
     * @type Array
     */
    protected elems: T[];
    /**
     * @type Function
     */
    protected lessFn: Function;

    constructor(elems?: T[], lessFn?: Function) {
        this.elems = elems || [];
        this.lessFn = lessFn;
    }

    /**
     * @return {number}
     */
    public size(): number {
        return this.elems.length;
    }

    /**
     * 获取第 i 个元素
     * @return {number}
     */
    public get(i: number): null | T {
        return this.elems[i];
    }

    /**
     * @param i
     * @param j
     * @return {boolean}
     */
    public less(i: number, j: number): boolean {
        if (this.lessFn) {
            return this.lessFn(this.elems[i], this.elems[j]);
        }
        return this.elems[i] < this.elems[j];
    }

    /**
     * @param i
     * @param j
     */
    public swap(i: number, j: number) {
        var tmp = this.elems[i];
        this.elems[i] = this.elems[j];
        this.elems[j] = tmp;
    }

    /**
     * @override
     * @param x
     */
    public pushBack(x: T) {
        this.elems.push(x);
    }

    /**
     * @override
     * @return {*}
     */
    public popBack(): T {
        return this.elems.pop();
    }
}

/**
 * 使用数组创建一个堆
 * @param {Array || null} [arr=[]]
 */
export function array<T>(elems?: T[], lessFn?: Function) {
    return new Heap<T, Array<T>>(new Array(elems, lessFn));
};

declare interface Identifiable {
    id: number | string;
}

export class Map<T extends Identifiable> extends Array<T> {
    private indices: { [key: number | string]: number };

    constructor(elems?: T[], lessFn?: Function) {
        super(elems, lessFn);
        this.indices = {};
        for (let i = 0; i < this.elems.length; i++) {
            this.indices[this.elems[i].id] = i;
        }
    }

    /**
     * @param i
     * @param j
     */
    swap(i: number, j: number) {
        var tmp = this.elems[i];
        this.elems[i] = this.elems[j];
        this.elems[j] = tmp;
        this.elems[i].id = i;
        this.elems[j].id = j;
    }

    /**
     * @override
     * @param x
     */
    pushBack(x: T) {
        this.indices[x.id] = this.elems.length;
        this.elems.push(x);
    }

    /**
     * @override
     * @return {*}
     */
    popBack(): T {
        const x = this.elems.pop();
        if (x) {
            delete this.indices[x.id]
        }
        return x;
    }

    /**
     * lookup element by id
     * @param id number
     * @returns T
     */
    indexof(id: number): number {
        const i = this.indices[id];
        if (typeof i === 'number') {
            return i;
        }
        return -1;
    }
}

/**
 * 使用数组和map创建一个堆
 */
export function map<T extends Identifiable>(elems?: T[], lessFn?: Function) {
    return new Heap<T, Map<T>>(new Map(elems, lessFn));
};