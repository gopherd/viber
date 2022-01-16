export interface Unmarshaler {
    unmarshal(r: Reader): void;
}

export class Reader {
    private $view: DataView;
    private $littleEndian: boolean;
    private $offset: number;

    constructor(view: DataView, littleEndian?: boolean, offset?: number) {
        this.$view = view;
        this.$littleEndian = !!littleEndian;
        this.$offset = offset || 0;
    }

    view(): DataView {
        return new DataView(this.$view.buffer, this.$offset);
    }

    getInt8(): number {
        return this.$view.getInt8(this.$offset);
    }

    getInt16(): number {
        return this.$view.getInt16(this.$offset, this.$littleEndian);
    }

    getInt32(): number {
        return this.$view.getInt32(this.$offset, this.$littleEndian);
    }

    getInt64(): bigint {
        return this.$view.getBigInt64(this.$offset, this.$littleEndian);
    }

    getUint8(): number {
        return this.$view.getUint8(this.$offset);
    }

    getUint16(): number {
        return this.$view.getUint16(this.$offset, this.$littleEndian);
    }

    getUint32(): number {
        return this.$view.getUint32(this.$offset, this.$littleEndian);
    }

    getUint64(): bigint {
        return this.$view.getBigInt64(this.$offset, this.$littleEndian);
    }

    readInt8(): number {
        let x = this.getInt8();
        this.$offset++;
        return x;
    }

    readInt16(): number {
        let x = this.getInt16();
        this.$offset += 2;
        return x;
    }

    readInt32(): number {
        let x = this.getInt32();
        this.$offset += 4;
        return x;
    }

    readInt64(): bigint {
        let x = this.getInt64();
        this.$offset += 8;
        return x;
    }

    readUint8(): number {
        let x = this.getUint8();
        this.$offset++;
        return x;
    }

    readUint16(): number {
        let x = this.getUint16();
        this.$offset += 2;
        return x;
    }

    readUint32(): number {
        let x = this.getUint32();
        this.$offset += 4;
        return x;
    }

    readUint64(): bigint {
        let x = this.getInt64();
        this.$offset += 8;
        return x;
    }

    readInt<T extends number | bigint = number>(bits: number): T {
        switch (bits) {
            case 8:
                return this.readInt8() as T;
            case 16:
                return this.readInt16() as T;
            case 32:
                return this.readInt32() as T;
            case 64:
                return this.readInt64() as T;
        }
    }

    readUint<T extends number | bigint = number>(bits: number): T {
        switch (bits) {
            case 8:
                return this.readUint8() as T;
            case 16:
                return this.readUint16() as T;
            case 32:
                return this.readUint32() as T;
            case 64:
                return this.readUint64() as T;
        }
    }

    readInts<T extends number | bigint = number>(bits: number, unsigned?: boolean, dst?: T[]): T[] {
        return this.readFixedInts(this.readInt32(), bits, unsigned, dst);
    }

    readFixedInts<T extends number | bigint = number>(n: number, bits: number, unsigned?: boolean, dst?: T[]): T[] {
        if (!dst) {
            dst = [];
        }
        unsigned = unsigned || false;
        for (let i = 0; i < n; i++) {
            if (unsigned) {
                dst.push(this.readUint<T>(bits));
            } else {
                dst.push(this.readInt<T>(bits));
            }
        }
        return dst;
    }

    readObjects<T extends Unmarshaler>(ctor: { new(): T }, dst?: T[]): T[] {
        return this.readFixedObjects(this.readInt32(), ctor, dst);
    }

    readFixedObjects<T extends Unmarshaler>(n: number, ctor: { new(): T }, dst?: T[]): T[] {
        if (!dst) {
            dst = [];
        }
        for (let i = 0; i < n; i++) {
            let t = new ctor();
            t.unmarshal(this);
            dst.push(t);
        }
        return dst;
    }
}