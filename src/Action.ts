import * as THREE from 'three';
import * as log from './log';
import * as util from './util';

export const FLT_EPSILON = 0.0000001192092896;
export const ENABLE_STACKABLE_ACTIONS = true;

type Node = THREE.Object3D;

/**
 * 抽象 Action 类
 */
export abstract class Action {
    public static readonly ACTION_TAG_INVALID = -1;

    protected $originalTarget: Node;
    protected $target: Node;
    protected $tag: number = Action.ACTION_TAG_INVALID;

    constructor() {
        this.$originalTarget = null;
        this.$target = null;
        this.$tag = Action.ACTION_TAG_INVALID;
    }

    /**
     * 拷贝动作
     */
    public abstract clone(): Action;

    /**
     * 动作是否已经结束
     */
    public isDone(): boolean {
        return true;
    }

    /**
     * 绑定到 target 节点
     * @param target
     */
    public startWithTarget(target: Node) {
        this.$originalTarget = target;
        this.$target = target;
    }

    /**
     * 停止动作
     */
    public stop() {
        this.$target = null;
    }

    /**
     * 每帧调用推进动作，该函数需要被重载
     * @abstract
     * @param dt
     */
    public step(dt: number): void { }

    /**
     * 每帧调用
     * @abstract
     * @param dt
     */
    public update(dt: number): void { }

    /**
     * tag
     */
    public get tag(): number {
        return this.$tag;
    }
    public set tag(value: number) {
        this.$tag = value;
    }

    /**
     * target
     */
    public get target(): Node {
        return this.$target;
    }
    public set target(value: Node) {
        this.$target = value;
    }

    /**
     * originalTarget
     */
    public get originalTarget(): Node {
        return this.$originalTarget;
    }
    public set originalTarget(value: Node) {
        this.$originalTarget = value;
    }

    /**
     * 获取速度
     */
    public get speed(): number {
        return 1;
    }

    /**
     * 反转动作
     */
    public reverse(): Action {
        return this;
    }
}

class HashElement {
    public actions: Action[];
    public target: Node;
    public actionIndex: number;
    public currentAction: Action;
    public paused: boolean;
    public lock: boolean;

    constructor() {
        this.actions = [];
        this.target = null;
        this.actionIndex = 0;
        this.currentAction = null;
        this.paused = false;
        this.lock = false;
    }
};

/**
 * ActionManager 管理 Action
 */
export class ActionManager {
    private $pool: HashElement[] = [];
    private $elementsMap: { [key: number]: HashElement };
    private $elementsArr: HashElement[];
    private $current: HashElement;

    constructor() {
        this.$elementsMap = {};
        this.$elementsArr = [];
        this.$current = null;
    }

    private $searchElementByTarget(elements: HashElement[], target: Node) {
        for (let i = 0; i < elements.length; i++) {
            if (target === elements[i].target) {
                return elements[i];
            }
        }
        return null;
    }

    private $getElement(target: Node, paused: boolean): HashElement {
        let element = this.$pool.pop();
        if (!element) {
            element = new HashElement();
        }
        element.target = target;
        element.paused = !!paused;
        return element;
    }

    private $putElement(element: HashElement) {
        element.actions.length = 0;
        element.actionIndex = 0;
        element.currentAction = null;
        element.paused = false;
        element.target = null;
        element.lock = false;
        this.$pool.push(element);
    }

    /**
     * 添加动作
     * @param action
     * @param target
     * @param paused
     */
    public addAction(action: Action, target: Node, paused?: boolean) {
        if (!action) {
            throw new Error("cc.ActionManager.addAction(): action must be non-null");
        }
        if (!target) {
            throw new Error("cc.ActionManager.addAction(): target must be non-null");
        }

        let element = this.$elementsMap[target.id];
        if (!element) {
            element = this.$getElement(target, paused);
            this.$elementsMap[target.id] = element;
            this.$elementsArr.push(element);
        } else if (!element.actions) {
            element.actions = [];
        }

        element.actions.push(action);
        action.startWithTarget(target);
    }

    /**
     * 删除所有动作
     */
    public removeAllActions() {
        let locTargets = this.$elementsArr;
        for (let i = 0; i < locTargets.length; i++) {
            let element = locTargets[i];
            if (element) {
                this.removeAllActionsFromTarget(element.target);
            }
        }
    }

    /**
     * 删除指定对象上的所有动作
     * @param target
     */
    public removeAllActionsFromTarget(target: Node) {
        if (target == null) {
            return;
        }
        let element = this.$elementsMap[target.id];
        if (element) {
            element.actions.length = 0;
            this.$deleteHashElement(element);
        }
    }

    /**
     * 删除指定动作
     * @param action
     */
    public removeAction(action: Action) {
        if (action == null) {
            return;
        }
        let target = action.originalTarget;
        let element = this.$elementsMap[target.id];

        if (element) {
            for (let i = 0; i < element.actions.length; i++) {
                if (element.actions[i] === action) {
                    element.actions.splice(i, 1);
                    if (element.actionIndex >= i) {
                        element.actionIndex--;
                    }
                    break;
                }
            }
        }
    }

    /**
     * 从指定对象中删除指定 tag 的动作
     * @param tag
     * @param target
     */
    public removeActionByTag(tag: number, target: Node) {
        let element = this.$elementsMap[target.id];

        if (element) {
            let limit = element.actions.length;
            for (let i = 0; i < limit; ++i) {
                let action = element.actions[i];
                if (action && action.tag === tag && action.originalTarget === target) {
                    this.$removeActionAtIndex(i, element);
                    break;
                }
            }
        }
    }

    /**
     * 获取指定 tag 的动作
     * @param tag
     * @param target
     */
    public getActionByTag(tag: number, target: Node): Action {
        let element = this.$elementsMap[target.id];
        if (element) {
            if (element.actions != null) {
                for (let i = 0; i < element.actions.length; ++i) {
                    let action = element.actions[i];
                    if (action && action.tag === tag) {
                        return action;
                    }
                }
            }
        }
        return null;
    }

    /**
     * 获取 target 上正在运行的动作数量
     * @param target
     */
    public numberOfRunningActionsInTarget(target: Node): number {
        let element = this.$elementsMap[target.id];
        if (element) {
            return (element.actions) ? element.actions.length : 0;
        }
        return 0;
    }

    /**
     * 暂停 target 上的动作
     * @param target
     */
    public pauseTarget(target: Node) {
        let element = this.$elementsMap[target.id];
        if (element) {
            element.paused = true;
        }
    }

    /**
     * 恢复 target 上的动作
     * @param target
     */
    public resumeTarget(target: Node) {
        let element = this.$elementsMap[target.id];
        if (element) {
            element.paused = false;
        }
    }

    /**
     * 暂停所有运行的动作
     */
    public pauseAllRunningActions(): Node[] {
        let idsWithActions = [];
        let locTargets = this.$elementsArr;
        for (let i = 0; i < locTargets.length; i++) {
            let element = locTargets[i];
            if (element && !element.paused) {
                element.paused = true;
                idsWithActions.push(element.target);
            }
        }
        return idsWithActions;
    }

    /**
     * 恢复指定 target 上的动作
     * @param targetsToResume
     */
    public resumeTargets(targetsToResume: Node[]) {
        if (!targetsToResume) {
            return;
        }
        for (let i = 0; i < targetsToResume.length; i++) {
            if (targetsToResume[i]) {
                this.resumeTarget(targetsToResume[i]);
            }
        }
    }

    private $removeActionAtIndex(index: number, element: HashElement) {
        element.actions.splice(index, 1);

        if (element.actionIndex >= index) {
            element.actionIndex--;
        }

        if (element.actions.length === 0) {
            this.$deleteHashElement(element);
        }
    }

    private $deleteHashElement(element: HashElement) {
        let ret = false;
        if (element && !element.lock) {
            if (this.$elementsMap[element.target.id]) {
                delete this.$elementsMap[element.target.id];
                let targets = this.$elementsArr;
                for (let i = 0, l = targets.length; i < l; i++) {
                    if (targets[i] === element) {
                        targets.splice(i, 1);
                        break;
                    }
                }
                this.$putElement(element);
                ret = true;
            }
        }
        return ret;
    }

    public update(dt: number): boolean {
        let elements = this.$elementsArr;
        for (let i = 0; i < elements.length; i++) {
            this.$current = elements[i];
            let element = this.$current;
            if (!element.paused && element.actions) {
                element.lock = true;
                for (element.actionIndex = 0; element.actionIndex < element.actions.length; element.actionIndex++) {
                    element.currentAction = element.actions[element.actionIndex];
                    if (!element.currentAction) {
                        continue;
                    }

                    element.currentAction.step(dt * element.currentAction.speed);

                    if (element.currentAction && element.currentAction.isDone()) {
                        element.currentAction.stop();
                        let action = element.currentAction;
                        element.currentAction = null;
                        this.removeAction(action);
                    }

                    element.currentAction = null;
                }
                element.lock = false;
            }
            if (element.actions.length === 0) {
                this.$deleteHashElement(element);
                i--;
            }
        }
        return false;
    }
}

/**
 * 有限时间动作
 */
export class FiniteTimeAction extends Action {
    constructor(duration: number = 0) {
        super();
        this.$duration = duration;
    }

    /**
     * 重复次数
     */
    protected $times: number;
    public get times(): number {
        return this.$times || 1;
    }
    public set times(value: number) {
        this.$times = value;
    }

    /**
     * 执行时间（秒）
     */
    protected $duration: number;
    public get duration(): number {
        return (this.$duration || 0) * (this.$times || 1);
    }
    public set duration(value: number) {
        this.$duration = value;
    }

    /**
     * 拷贝动作
     */
    public clone(): FiniteTimeAction {
        let action = new FiniteTimeAction();
        action.$duration = this.$duration;
        return action;
    }

    /**
     * 反转动作
     */
    public reverse(): FiniteTimeAction {
        return null;
    }
}

/**
 * 动作加速
 */
export class Speed extends Action {
    constructor(action: Action, speed: number) {
        super();
        this.$innerAction = action;
        this.$speed = speed;
    }

    /**
     * 拷贝动作
     */
    public clone(): Speed {
        return new Speed(this.$innerAction.clone(), this.$speed);
    }

    /**
     * 绑定到 target 节点
     * @param target
     */
    public startWithTarget(target: Node) {
        super.startWithTarget(target);
        this.$innerAction.startWithTarget(target);
    }

    /**
     * 停止动作
     */
    public stop() {
        this.$innerAction.stop();
        super.stop();
    }

    /**
     * 每帧调用推进动作
     * @param dt
     */
    public step(dt: number) {
        this.$innerAction.step(dt);
    }

    /**
     * 动作是否已经结束
     */
    public isDone(): boolean {
        return this.$innerAction.isDone();
    }

    /**
     * 反转动作
     */
    public reverse(): Speed {
        let rev = this.$innerAction.reverse();
        if (!rev) {
            return null;
        }
        return new Speed(rev, this.$speed);
    }

    /**
     * 被包装的内部动作
     */
    protected $innerAction: Action;
    public getInnerAction(): Action {
        return this.$innerAction;
    }
    public setInnerAction(value: Action) {
        this.$innerAction = value;
    }

    /**
     * 速度
     */
    protected $speed: number;
    public get speed(): number {
        return this.$speed;
    }
    public set speed(value: number) {
        this.$speed = value;
    }
}

/**
 * 创建 Speed 动作
 * @param action
 * @param speed
 */
export function speed(action: Action, speed: number): Speed {
    return new Speed(action, speed);
}

/**
 * 实现 cc.ActionInterval
 */
export class ActionInterval extends FiniteTimeAction {
    protected $elapsed: number;
    protected $firstTick: boolean;
    protected $easeList: Easing[];
    protected $forever: boolean;
    protected $speed: number;

    public MAX_VALUE: number;

    constructor(d: number/* seconds */) {
        super(d);
        this.$speed = 1;
        this.$forever = false;
        this.MAX_VALUE = 2;
        this.$initWithDuration(d);
    }

    protected $initWithDuration(d: number): boolean {
        this.$duration = (d === 0) ? FLT_EPSILON : d;
        this.$elapsed = 0;
        this.$firstTick = true;
        return true;
    }

    /**
     * 已经过秒数
     */
    public getElapsed(): number {
        return this.$elapsed;
    }

    /**
     * @override
     */
    public isDone(): boolean {
        return (this.$elapsed >= this.$duration);
    }

    protected $cloneDecoration(action: ActionInterval) {
        action.$forever = this.$forever;
        action.$speed = this.$speed;
        action.$times = this.$times;
        action.$easeList = this.$easeList;
    }

    protected $reverseEaseList(action: ActionInterval) {
        if (this.$easeList) {
            action.$easeList = [];
            for (let i = 0; i < this.$easeList.length; i++) {
                action.$easeList.push(this.$easeList[i].reverse());
            }
        }
    }

    /**
     * @override
     */
    public clone(): ActionInterval {
        let action = new ActionInterval(this.$duration);
        this.$cloneDecoration(action);
        return action;
    }

    /**
     * 设定动作缓和
     * @param easeObj
     */
    public easing(easeObj: Easing) {
        if (this.$easeList) {
            this.$easeList.length = 0;
        } else {
            this.$easeList = [];
        }
        for (let i = 0; i < arguments.length; i++) {
            this.$easeList.push(arguments[i]);
        }
        return this;
    }

    protected $computeEaseTime(dt: number): number {
        let locList = this.$easeList;
        if ((!locList) || (locList.length === 0)) {
            return dt;
        }
        for (let i = 0, n = locList.length; i < n; i++) {
            dt = locList[i].easing(dt);
        }
        return dt;
    }

    /**
     * @override
     */
    public step(dt: number) {
        if (this.$firstTick) {
            this.$firstTick = false;
            this.$elapsed = 0;
        } else
            this.$elapsed += dt;

        let t = this.$elapsed / (this.$duration > FLT_EPSILON ? this.$duration : FLT_EPSILON);
        t = (1 > t ? t : 1);
        this.update(t > 0 ? t : 0);

        if (this.$times > 1 && this.isDone()) {
            if (!this.$forever) {
                this.$times--;
            }
            this.startWithTarget(this.target);
            this.step(this.$elapsed - this.$duration);

        }
    }

    /**
     * @override
     */
    public startWithTarget(target: Node) {
        super.startWithTarget(target);
        this.$elapsed = 0;
        this.$firstTick = true;
    }

    /**
     * @override
     */
    public reverse(): ActionInterval {
        log.error("cc.IntervalAction: reverse not implemented.");
        return null;
    }

    /**
     * @abstract
     * @param amp
     */
    protected setAmplitudeRate(amp: number) {
        // Abstract method needs implementation
    }

    /**
     * @abstract
     */
    protected getAmplitudeRate(): number {
        // Abstract method needs implementation
        return 0;
    }

    /**
     * speed
     */
    public get speed(): number {
        return this.$speed;
    }
    public set speed(value: number) {
        this.$speed = value;
    }

    /**
     * 指定重复执行次数
     * @param times
     */
    public repeat(times: number): ActionInterval {
        times = Math.round(times);
        if (isNaN(times) || times < 1) {
            log.error("The repeat parameter error");
            return this;
        }
        this.$times *= times;
        return this;
    }

    /**
     * 一直重复执行
     */
    public repeatForever(): ActionInterval {
        this.times = this.MAX_VALUE;
        this.$forever = true;
        return this;
    }
}

/**
 * 延迟动作
 */
export class DelayTime extends ActionInterval {
    /**
     * @override
     */
    public update(dt: number) {
    }

    /**
     * @override
     */
    reverse(): DelayTime {
        var action = new DelayTime(this.duration);
        this.$cloneDecoration(action);
        this.$reverseEaseList(action);
        return action;
    }

    /**
     * @override
     */
    public clone() {
        var action = new DelayTime(this.duration);
        this.$cloneDecoration(action);
        return action;
    }
}

/**
 * 创建延迟动作
 * @param d
 */
export function delayTime(d: number): DelayTime {
    return new DelayTime(d);
}

/**
 * 一组动作构成的动作序列
 */
export class Sequence extends ActionInterval {
    protected $actions: FiniteTimeAction[];
    protected $split: number;
    protected $last: number;

    constructor(...params: FiniteTimeAction[]) {
        let d = 0;

        let actions = [];
        for (let i = 0; i < params.length; i++) {
            actions.push(params[i]);
            d += params[i].duration;
        }
        super(d);

        this.$actions = actions;
        let last = this.$actions.length - 1;

        if (last >= 0) {
            let prev = this.$actions[0];
            let curr: FiniteTimeAction;
            for (let i = 1; i < last; i++) {
                if (this.$actions[i]) {
                    curr = prev;
                    prev = Sequence.mergeTwoActions(curr, this.$actions[i]);
                }
            }
            this.$initWithTwoActions(prev, this.$actions[last]);
        }
    }

    public static mergeTwoActions(actionOne: FiniteTimeAction, actionTwo: FiniteTimeAction): Sequence {
        let sequence = new Sequence();
        sequence.$initWithTwoActions(actionOne, actionTwo);
        return sequence;
    }

    protected $initWithTwoActions(action1: FiniteTimeAction, action2: FiniteTimeAction): boolean {
        if (!action1 || !action2) {
            throw new Error("cc.Sequence.initWithTwoActions(): arguments must all be non nil");
        }

        let d = action1.duration + action2.duration;
        this.$initWithDuration(d);

        if (!this.$actions || this.$actions.length !== 2) {
            this.$actions = [action1, action2];
        } else {
            this.$actions[0] = action1;
            this.$actions[1] = action2;
        }
        return true;
    }

    /**
     * @override
     */
    public clone(): Sequence {
        let action = new Sequence();
        this.$cloneDecoration(action);
        action.$initWithTwoActions(this.$actions[0].clone(), this.$actions[1].clone());
        return action;
    }

    /**
     * @override
     */
    public startWithTarget(target: Node) {
        super.startWithTarget(target);
        this.$split = this.$actions[0].duration / this.duration;
        this.$last = -1;
    }

    /**
     * @override
     */
    public stop() {
        if (this.$last !== -1) {
            this.$actions[this.$last].stop();
        }
        super.stop();
    }

    /**
     * @override
     */
    public update(dt: number) {
        super.update(dt);

        let new_t = 0;
        let found = 0;
        let locSplit = this.$split, locActions = this.$actions, locLast = this.$last
        let actionFound: FiniteTimeAction;

        dt = this.$computeEaseTime(dt);
        if (dt < locSplit) {
            // action[0]
            new_t = (locSplit !== 0) ? dt / locSplit : 1;

            if (found === 0 && locLast === 1) {
                locActions[1].update(0);
                locActions[1].stop();
            }
        } else {
            // action[1]
            found = 1;
            new_t = (locSplit === 1) ? 1 : (dt - locSplit) / (1 - locSplit);

            if (locLast === -1) {
                // action[0] was skipped, execute it.
                locActions[0].startWithTarget(this.target);
                locActions[0].update(1);
                locActions[0].stop();
            }
            if (!locLast) {
                // switching to action 1. stop action 0.
                locActions[0].update(1);
                locActions[0].stop();
            }
        }

        actionFound = locActions[found];
        // Last action found and it is done.
        if (locLast === found && actionFound.isDone()) {
            return;
        }

        // Last action found and it is done
        if (locLast !== found) {
            actionFound.startWithTarget(this.target);
        }

        new_t = new_t * actionFound.times;
        actionFound.update(new_t > 1 ? new_t % 1 : new_t);
        this.$last = found;
    }

    /**
     * @override
     */
    public reverse(): Sequence {
        let action = Sequence.mergeTwoActions(this.$actions[1].reverse(), this.$actions[0].reverse());
        this.$cloneDecoration(action);
        this.$reverseEaseList(action);
        return action;
    }
}

/**
 * 创建动作序列
 * @param params
 */
export function sequence(...params: (FiniteTimeAction | FiniteTimeAction[])[]): Sequence {
    if (params[0] instanceof Array) {
        return new Sequence(...(params[0] as FiniteTimeAction[]));
    } else {
        return new Sequence(...(params as FiniteTimeAction[]));
    }
}

/**
 * 重复动作
 */
export class Repeat extends ActionInterval {
    protected $total: number;
    protected $nextDt: number;
    protected $actionInstant: boolean;
    protected $innerAction: FiniteTimeAction;

    constructor(action: FiniteTimeAction, times: number) {
        super(action.duration * times);
        this.$initWithAction(action, times);
    }

    protected $initWithAction(action: FiniteTimeAction, times: number): boolean {
        let duration = action.duration * times;

        if (this.$initWithDuration(duration)) {
            this.times = times;
            this.$innerAction = action;
            if (action instanceof ActionInstant) {
                this.$actionInstant = true;
                this.times -= 1;
            }
            this.$total = 0;
            return true;
        }
        return false;
    }

    /**
     * @override
     */
    public clone(): Repeat {
        let action = new Repeat(this.$innerAction.clone(), this.times);
        this.$cloneDecoration(action);
        return action;
    }

    /**
     * @override
     */
    public startWithTarget(target: Node) {
        this.$total = 0;
        this.$nextDt = this.$innerAction.duration / this.duration;
        super.startWithTarget(target);
        this.$innerAction.startWithTarget(target);
    }

    /**
     * @override
     */
    public stop() {
        this.$innerAction.stop();
        super.stop();
    }

    /**
     * Called once per frame. Time is the number of seconds of a frame interval.
     * @param {Number}  dt
     */
    public update(dt: number) {
        dt = this.$computeEaseTime(dt);
        let locInnerAction = this.$innerAction;
        let locDuration = this.$duration;
        let locTimes = this.$times;
        let locNextDt = this.$nextDt;

        if (dt >= locNextDt) {
            while (dt > locNextDt && this.$total < locTimes) {
                locInnerAction.update(1);
                this.$total++;
                locInnerAction.stop();
                locInnerAction.startWithTarget(this.target);
                locNextDt += locInnerAction.duration / locDuration;
                this.$nextDt = locNextDt;
            }

            // fix for issue #1288, incorrect end value of repeat
            if (dt >= 1.0 && this.$total < locTimes)
                this.$total++;

            // don't set a instant action back or update it, it has no use because it has no duration
            if (!this.$actionInstant) {
                if (this.$total === locTimes) {
                    locInnerAction.update(1);
                    locInnerAction.stop();
                } else {
                    // issue #390 prevent jerk, use right update
                    locInnerAction.update(dt - (locNextDt - locInnerAction.duration / locDuration));
                }
            }
        } else {
            locInnerAction.update((dt * locTimes) % 1.0);
        }
    }

    /**
     * @override
     */
    public isDone(): boolean {
        return this.$total === this.times;
    }

    /**
     * @override
     */
    public reverse(): Repeat {
        let action = new Repeat(this.$innerAction.reverse(), this.times);
        this.$cloneDecoration(action);
        this.$reverseEaseList(action);
        return action;
    }

    /**
     * Set inner Action.
     */
    public setInnerAction(action: FiniteTimeAction) {
        if (this.$innerAction !== action) {
            this.$innerAction = action;
        }
    }

    /**
     * Get inner Action.
     */
    public getInnerAction(): FiniteTimeAction {
        return this.$innerAction;
    }
}

/**
 * 创建重复动作
 * @param action
 * @param times
 */
export function repeat(action: FiniteTimeAction, times: number): Repeat {
    return new Repeat(action, times);
}

/**
 * 一直重复的动作
 */
export class RepeatForever extends ActionInterval {
    protected $innerAction: ActionInterval;

    constructor(action: ActionInterval) {
        super(0);
        this.$innerAction = null;

        this.$initWithAction(action);
    }

    /**
     * @return {Boolean}
     */
    protected $initWithAction(action: ActionInterval): boolean {
        this.$innerAction = action;
        return true;
    }

    /**
     * @override
     */
    public clone(): RepeatForever {
        var action = new RepeatForever(this.$innerAction.clone());
        this.$cloneDecoration(action);
        return action;
    }

    /**
     * @override
     */
    public startWithTarget(target: Node) {
        super.startWithTarget(target);
        this.$innerAction.startWithTarget(target);
    }

    /**
     * @override
     */
    public step(dt: number) {
        var locInnerAction = this.$innerAction;
        locInnerAction.step(dt);
        if (locInnerAction.isDone()) {
            locInnerAction.startWithTarget(this.target);
            locInnerAction.step(locInnerAction.getElapsed() - locInnerAction.duration);
        }
    }

    /**
     * @override
     */
    public isDone(): boolean {
        return false;
    }

    /**
     * @override
     */
    public reverse(): RepeatForever {
        var action = new RepeatForever(this.$innerAction.reverse());
        this.$cloneDecoration(action);
        this.$reverseEaseList(action);
        return action;
    }

    /**
     * Set inner action.
     */
    public setInnerAction(action: ActionInterval) {
        if (this.$innerAction !== action) {
            this.$innerAction = action;
        }
    }

    /**
     * Get inner action.
     */
    public getInnerAction(): ActionInterval {
        return this.$innerAction;
    }
}

/**
 * 创建一直重复的动作
 * @param action
 */
export function repeatForever(action: ActionInterval): RepeatForever {
    return new RepeatForever(action);
}


export class Spawn extends ActionInterval {
    protected $one: FiniteTimeAction;
    protected $two: FiniteTimeAction;

    constructor(...params: FiniteTimeAction[]) {
        let d = 0;

        let actions = [];
        for (let i = 0; i < params.length; i++) {
            actions.push(params[i]);
            let d2 = params[i].duration;
            if (d2 > d) {
                d = d2;
            }
        }

        super(d);
        this.$one = null;
        this.$two = null;

        let last = actions.length - 1;
        let prev = actions[0];
        let action1: FiniteTimeAction;
        for (let i = 1; i < last; i++) {
            if (actions[i]) {
                action1 = prev;
                prev = Spawn.mergeTwoActions(action1, actions[i]);
            }
        }
        this.$initWithTwoActions(prev, actions[last]);
    }

    protected $initWithTwoActions(action1: FiniteTimeAction, action2: FiniteTimeAction): boolean {
        var ret = false;

        var d1 = action1.duration;
        var d2 = action2.duration;

        if (this.$initWithDuration(Math.max(d1, d2))) {
            this.$one = action1;
            this.$two = action2;

            if (d1 > d2) {
                this.$two = Sequence.mergeTwoActions(action2, delayTime(d1 - d2));
            } else if (d1 < d2) {
                this.$one = Sequence.mergeTwoActions(action1, delayTime(d2 - d1));
            }

            ret = true;
        }
        return ret;
    }

    /**
     * @override
     */
    public clone(): Spawn {
        var action = new Spawn(this.$one.clone(), this.$two.clone());
        this.$cloneDecoration(action);
        return action;
    }

    /**
     * @override
     */
    public startWithTarget(target: Node) {
        super.startWithTarget(target);
        this.$one.startWithTarget(target);
        this.$two.startWithTarget(target);
    }

    /**
     * @override
     */
    public stop() {
        this.$one.stop();
        this.$two.stop();
        super.stop();
    }

    /**
     * Called once per frame. Time is the number of seconds of a frame interval.
     * @param {Number}  dt
     */
    public update(dt: number) {
        dt = this.$computeEaseTime(dt);
        if (this.$one) {
            this.$one.update(dt);
        }
        if (this.$two) {
            this.$two.update(dt);
        }
    }

    /**
     * @override
     */
    public reverse(): Spawn {
        var action = Spawn.mergeTwoActions(this.$one.reverse(), this.$two.reverse());
        this.$cloneDecoration(action);
        this.$reverseEaseList(action);
        return action;
    }

    public static mergeTwoActions(one: FiniteTimeAction, two: FiniteTimeAction): Spawn {
        return new Spawn(one, two);
    }
}

/**
 * 创建并行动作
 * @param params
 */
export function spawn(...params: (FiniteTimeAction | FiniteTimeAction[])[]): Spawn {
    if (params[0] instanceof Array) {
        return new Spawn(...(params[0] as FiniteTimeAction[]));
    } else {
        return new Spawn(...(params as FiniteTimeAction[]));
    }
}

/**
 * 瞬时动作
 */
export class ActionInstant extends FiniteTimeAction {
    /**
     * @override
     */
    public isDone(): boolean {
        return true;
    }

    /**
     * @override
     */
    public step(dt: number) {
        this.update(1);
    }

    /**
     * @override
     */
    public update(dt: number) {
    }

    /**
     * @override
     */
    public reverse(): ActionInstant {
        return this.clone();
    }

    /**
     * @override
     */
    clone() {
        return new ActionInstant();
    }
}

/**
 * 旋转动作
 */
export class RotateTo extends ActionInterval {
    protected $dst: util.Vector3;
    protected $start: util.Vector3;
    protected $delta: util.Vector3;

    constructor(duration: number, dst: util.Vector3) {
        super(duration);
        this.$dst = util.vec3(dst.x, dst.y, dst.z);
    }

    /**
     * @override
     */
    public clone() {
        var action = new RotateTo(this.duration, this.$dst);
        this.$cloneDecoration(action);
        return action;
    }

    /**
     * @override
     */
    public startWithTarget(target: Node) {
        super.startWithTarget(target);

        var locStartAngleX = target.rotation.x % 360.0;
        var locStartAngleY = target.rotation.y % 360.0;
        var locStartAngleZ = target.rotation.z % 360.0;
        var locDiffAngleX = this.$dst.x - locStartAngleX;
        var locDiffAngleY = this.$dst.y - locStartAngleY;
        var locDiffAngleZ = this.$dst.z - locStartAngleZ;
        this.$start = util.vec3(locDiffAngleX, locDiffAngleY, locDiffAngleZ);
        this.$delta = util.vec3(locDiffAngleX, locDiffAngleY, locDiffAngleZ);
    }

    /**
     * @override
     */
    public update(dt: number) {
        dt = this.$computeEaseTime(dt);
        if (this.target) {
            this.target.rotation.set(
                this.$start.x + this.$delta.x * dt,
                this.$start.y + this.$delta.y * dt,
                this.$start.z + this.$delta.z * dt
            );
        }
    }
}

/**
 * 创建旋转动作
 * @param duration
 * @param angle
 */
export function rotateTo(duration: number, angle: util.Vector3): RotateTo {
    return new RotateTo(duration, angle);
}

/**
 * 旋转动作
 */
export class RotateBy extends ActionInterval {
    protected $angle: util.Vector3;
    protected $start: util.Vector3;

    constructor(duration: number, delta: util.Vector3) {
        super(duration);
        this.$angle = util.vec3(delta.x, delta.y, delta.z);
    }

    /**
     * @override
     */
    public clone() {
        var action = new RotateBy(this.duration, this.$angle);
        this.$cloneDecoration(action);
        return action;
    }

    /**
     * @override
     */
    public startWithTarget(target: Node) {
        super.startWithTarget(target);
        this.$start = util.vec3(target.rotation.x, target.rotation.y, target.rotation.z);
    }

    /**
     * @override
     */
    public update(dt: number) {
        dt = this.$computeEaseTime(dt);
        if (this.target) {
            this.target.rotation.set(
                this.$start.x + this.$angle.x * dt,
                this.$start.y + this.$angle.y * dt,
                this.$start.z + this.$angle.z * dt
            );
        }
    }

    /**
     * @override
     */
    public reverse() {
        var action = new RotateBy(this.duration, util.vec3(-this.$angle.x, -this.$angle.y, -this.$angle.z));
        this.$cloneDecoration(action);
        this.$reverseEaseList(action);
        return action;
    }
}

/**
 * 创建旋转动作
 * @param duration
 * @param delta
 */
export function rotateBy(duration: number, delta: util.Vector3): RotateBy {
    return new RotateBy(duration, delta);
}

/**
 * 按增量移动
 */
export class MoveBy extends ActionInterval {
    protected $delta: util.Vector3;
    protected $start: util.Vector3;
    protected $prev: util.Vector3;

    constructor(duration: number, delta: util.Vector3) {
        super(duration);

        this.$delta = util.vec3(delta);
        this.$start = util.vec3(0, 0, 0);
        this.$prev = util.vec3(0, 0, 0);
    }

    /**
     * @override
     */
    public clone() {
        var action = new MoveBy(this.duration, this.$delta);
        this.$cloneDecoration(action);
        return action;
    }

    /**
     * @override
     */
    public startWithTarget(target: Node) {
        super.startWithTarget(target);
        var locPosX = target.position.x;
        var locPosY = target.position.y;
        var locPosZ = target.position.z;
        this.$prev.x = locPosX;
        this.$prev.y = locPosY;
        this.$prev.z = locPosZ;
        this.$start.x = locPosX;
        this.$start.y = locPosY;
        this.$start.z = locPosZ;
    }

    /**
     * @override
     */
    public update(dt: number) {
        dt = this.$computeEaseTime(dt);
        if (this.target) {
            var x = this.$delta.x * dt;
            var y = this.$delta.y * dt;
            var z = this.$delta.z * dt;
            var locStartPosition = this.$start;
            if (ENABLE_STACKABLE_ACTIONS) {
                var targetX = this.target.position.x;
                var targetY = this.target.position.y;
                var targetZ = this.target.position.z;
                var locPreviousPosition = this.$prev;

                locStartPosition.x += targetX - locPreviousPosition.x;
                locStartPosition.y += targetY - locPreviousPosition.y;
                locStartPosition.z += targetZ - locPreviousPosition.z;
                x += locStartPosition.x;
                y += locStartPosition.y;
                z += locStartPosition.z;
                locPreviousPosition.x = x;
                locPreviousPosition.y = y;
                locPreviousPosition.z = z;
                this.target.position.set(x, y, z);
            } else {
                x += locStartPosition.x;
                y += locStartPosition.y;
                z += locStartPosition.z;
                this.target.position.set(x, y, z);
            }
        }
    }

    /**
     * @override
     */
    public reverse(): MoveBy {
        var action = new MoveBy(this.duration, util.vec3(-this.$delta.x, -this.$delta.y, -this.$delta.z));
        this.$cloneDecoration(action);
        this.$reverseEaseList(action);
        return action;
    }
}

/**
 * 创建按增量移动的动作
 * @param duration
 * @param dx
 * @param dy
 */
export function moveBy(duration: number, delta: util.Vector3): MoveBy {
    return new MoveBy(duration, delta);
}

/**
 * 移动到指定位置
 */
export class MoveTo extends MoveBy {
    protected $end: util.Vector3;

    constructor(duration: number, dst: util.Vector3) {
        super(duration, util.vec3(0, 0, 0));
        this.$end = util.vec3(dst.x, dst.y, dst.z);
    }

    /**
     * @override
     */
    public clone(): MoveTo {
        var action = new MoveTo(this.duration, util.vec3(this.$end));
        this.$cloneDecoration(action);
        return action;
    }

    /**
     * @override
     */
    public startWithTarget(target: Node) {
        super.startWithTarget(target);
        this.$delta.x = this.$end.x - target.position.x;
        this.$delta.y = this.$end.y - target.position.y;
        this.$delta.z = this.$end.z - target.position.z;
    }
}

/**
 * 创建移动到指定位置的动作
 * @param duration
 * @param x
 * @param y
 */
export function moveTo(duration: number, dst: util.Vector3): MoveTo {
    return new MoveTo(duration, dst);
}

/**
 * 计算 Bezier 曲线插值
 * @param a
 * @param b
 * @param c
 * @param d
 * @param t
 */
export function bezierAt(a: number, b: number, c: number, d: number, t: number): number {
    return (Math.pow(1 - t, 3) * a +
        3 * t * (Math.pow(1 - t, 2)) * b +
        3 * Math.pow(t, 2) * (1 - t) * c +
        Math.pow(t, 3) * d);
};

/**
 * 沿着 Bezier 曲线增量移动
 */
export class BezierBy extends ActionInterval {
    protected $config: util.Vector3[];
    protected $start: util.Vector3;
    protected $prev: util.Vector3;

    constructor(duration: number, points: util.Vector3[]) {
        super(duration);
        this.$start = util.vec3(0, 0, 0);
        this.$prev = util.vec3(0, 0, 0);
        if (points) {
            this.$config = [];
            for (let i = 0; i < points.length; i++) {
                this.$config.push(util.vec3(points[i]));
            }
        }
    }

    /**
     * @override
     */
    public clone() {
        var action = new BezierBy(this.duration, this.$config);
        this.$cloneDecoration(action);
        return action;
    }

    /**
     * @override
     */
    public startWithTarget(target: Node) {
        super.startWithTarget(target);
        var locPosX = target.position.x;
        var locPosY = target.position.y;
        var locPosZ = target.position.z;
        this.$prev.x = locPosX;
        this.$prev.y = locPosY;
        this.$prev.z = locPosZ;
        this.$start.x = locPosX;
        this.$start.y = locPosY;
        this.$start.z = locPosZ;
    }

    /**
     * @override
     */
    public update(dt: number) {
        dt = this.$computeEaseTime(dt);
        if (this.target) {
            var locConfig = this.$config;
            var xa = 0;
            var xb = locConfig[0].x;
            var xc = locConfig[1].x;
            var xd = locConfig[2].x;

            var ya = 0;
            var yb = locConfig[0].y;
            var yc = locConfig[1].y;
            var yd = locConfig[2].y;

            var za = 0;
            var zb = locConfig[0].z;
            var zc = locConfig[1].z;
            var zd = locConfig[2].z;

            var x = bezierAt(xa, xb, xc, xd, dt);
            var y = bezierAt(ya, yb, yc, yd, dt);
            var z = bezierAt(za, zb, zc, zd, dt);

            var locStartPosition = this.$start;
            if (ENABLE_STACKABLE_ACTIONS) {
                var targetX = this.target.position.x;
                var targetY = this.target.position.y;
                var targetZ = this.target.position.z;
                var locPreviousPosition = this.$prev;

                locStartPosition.x += targetX - locPreviousPosition.x;
                locStartPosition.y += targetY - locPreviousPosition.y;
                locStartPosition.z += targetZ - locPreviousPosition.z;
                x += locStartPosition.x;
                y += locStartPosition.y;
                z += locStartPosition.z;
                locPreviousPosition.x = x;
                locPreviousPosition.y = y;
                locPreviousPosition.z = z;
                this.target.position.set(x, y, z);
            } else {
                x += locStartPosition.x;
                y += locStartPosition.y;
                z += locStartPosition.z;
                this.target.position.set(x, y, z);
            }
        }
    }

    /**
     * @override
     */
    public reverse(): BezierBy {
        var loc = this.$config;
        var r = [
            util.vec3(loc[1].x - loc[2].x, loc[1].y - loc[2].y, loc[1].z - loc[2].z),
            util.vec3(loc[0].x - loc[2].x, loc[0].y - loc[2].y, loc[0].z - loc[2].z),
            util.vec3(-loc[2].x, -loc[2].y, -loc[2].z),
        ];
        var action = new BezierBy(this.duration, r);
        this.$cloneDecoration(action);
        this.$reverseEaseList(action);
        return action;
    }
}

/**
 * 创建沿着 Bezier 曲线增量移动的动作
 */
export function bezierBy(duration: number, points: util.Vector3[]): BezierBy {
    return new BezierBy(duration, points);
}

/**
 * Bezier 曲线
 */
export class BezierTo extends BezierBy {
    protected $toConfig: util.Vector3[];

    constructor(duration: number, points: util.Vector3[]) {
        super(duration, null);
        if (points) {
            this.$toConfig = [];
            for (let i = 0; i < points.length; i++) {
                this.$toConfig.push(util.vec3(points[i]));
            }
        }
    }

    /**
     * @override
     */
    public clone(): BezierTo {
        var action = new BezierTo(this.duration, this.$toConfig);
        this.$cloneDecoration(action);
        return action;
    }

    /**
     * @override
     */
    startWithTarget(target: Node) {
        super.startWithTarget(target);
        var locStart = this.$start;
        var loc = this.$toConfig;
        this.$config = [
            util.vec3(loc[0].x - locStart.x, loc[0].y - locStart.y, loc[0].z - locStart.z),
            util.vec3(loc[1].x - locStart.x, loc[1].y - locStart.y, loc[1].z - locStart.z),
            util.vec3(loc[2].x - locStart.x, loc[2].y - locStart.y, loc[2].z - locStart.z),
        ]
    }
}

/**
 * 创建 Bezier 曲线动作
 * @param duration
 * @param points
 */
export function bezierTo(duration: number, points: util.Vector3[]): BezierTo {
    return new BezierTo(duration, points);
}

/**
 * 缩放到指定比例
 */
export class ScaleTo extends ActionInterval {
    protected $scaleX: number = 1;
    protected $scaleY: number = 1;
    protected $scaleZ: number = 1;
    protected $startScaleX: number = 1;
    protected $startScaleY: number = 1;
    protected $startScaleZ: number = 1;
    protected $endScaleX: number = 0;
    protected $endScaleY: number = 0;
    protected $endScaleZ: number = 0;
    protected $dx: number = 0;
    protected $dy: number = 0;
    protected $dz: number = 0;

    constructor(duration: number, sx: number, sy?: number) {
        super(duration);
        this.$endScaleX = sx;
        this.$endScaleY = typeof sy === 'number' ? sy : sx;
    }

    /**
     * @override
     */
    public clone() {
        var action = new ScaleTo(this.duration, this.$endScaleX, this.$endScaleY);
        this.$cloneDecoration(action);
        return action;
    }

    /**
     * @override
     */
    public startWithTarget(target: Node) {
        super.startWithTarget(target);
        this.$startScaleX = target.scale.x;
        this.$startScaleY = target.scale.y;
        this.$startScaleZ = target.scale.z;
        this.$dx = this.$endScaleX - this.$startScaleX;
        this.$dy = this.$endScaleY - this.$startScaleY;
        this.$dz = this.$endScaleZ - this.$startScaleZ;
    }

    /**
     * @override
     */
    public update(dt: number) {
        dt = this.$computeEaseTime(dt);
        if (this.target) {
            this.target.scale.set(
                this.$startScaleX + this.$dx * dt,
                this.$startScaleY + this.$dy * dt,
                this.$startScaleZ + this.$dz * dt
            );
        }
    }
}

/**
 * 创建缩放到指定比例的动作
 * @param duration
 * @param sx
 * @param sy
 */
export function scaleTo(duration: number, sx: number, sy?: number): ScaleTo {
    return new ScaleTo(duration, sx, sy);
}

/**
 * 按相对比例缩放
 */
export class ScaleBy extends ScaleTo {
    /**
     * @override
     * @param target
     */
    public startWithTarget(target: Node) {
        super.startWithTarget(target);
        this.$dx = this.$startScaleX * this.$endScaleX - this.$startScaleX;
        this.$dy = this.$startScaleY * this.$endScaleY - this.$startScaleY;
    }

    /**
     * @override
     */
    public reverse(): ScaleBy {
        var action = new ScaleBy(this.duration, 1 / this.$endScaleX, 1 / this.$endScaleY);
        this.$cloneDecoration(action);
        this.$reverseEaseList(action);
        return action;
    }

    /**
     * @override
     */
    public clone(): ScaleBy {
        var action = new ScaleBy(this.duration, this.$endScaleX, this.$endScaleY);
        this.$cloneDecoration(action);
        return action;
    }
}

/**
 * 创建按相对比例缩放的动作
 */
export function scaleBy(duration: number, sx: number, sy?: number) {
    return new ScaleBy(duration, sx, sy);
}

/**
 * 包装函数为一个 Action
 */
export class CallFunc extends ActionInstant {
    protected $thisObj: any;
    protected $fn: Function;
    protected $data: any;

    constructor(fn: Function, thisObj?: any, data?: any) {
        super();
        if (fn) {
            this.$fn = fn;
        }
        if (thisObj) {
            this.$thisObj = thisObj;
        }
        if (data !== undefined) {
            this.$data = data;
        }
    }

    /**
     * execute the function.
     */
    protected execute() {
        if (this.$fn) {
            this.$fn.call(this.$thisObj, this.target, this.$data);
        }
    }

    /**
     * @override
     */
    public update(dt: number) {
        this.execute();
    }

    /**
     * Get selectorTarget.
     * @return {object}
     */
    public getTargetCallback(): any {
        return this.$thisObj;
    }

    /**
     * Set selectorTarget.
     */
    public setTargetCallback(thisObj: any) {
        if (thisObj !== this.$thisObj) {
            if (this.$thisObj) {
                this.$thisObj = null;
            }
            this.$thisObj = thisObj;
        }
    }

    /**
     * @override
     */
    public clone() {
        return new CallFunc(this.$fn, this.$thisObj, this.$data);
    }
}

/**
 * 创建函数动作
 * @param fn
 * @param thisObj
 * @param data
 */
export function callFunc(fn: Function, thisObj?: any, data?: any) {
    return new CallFunc(fn, thisObj, data);
}

/**
 * Ease 动画
 */
export interface Easing {
    easing(dt: number): number;
    reverse(): Easing;
}

/**
 * easeIn
 * @param rate
 */
export function easeIn(rate: number): Easing {
    return {
        $rate: rate,
        easing(dt: number): number {
            return Math.pow(dt, this.$rate);
        },
        reverse(): Easing {
            return easeIn(1 / this.$rate);
        }
    } as Easing;
}

/**
 * easeOut
 * @param rate
 */
export function easeOut(rate: number): Easing {
    return {
        $rate: rate,
        easing(dt: number): number {
            return Math.pow(dt, 1 / this.$rate);
        },
        reverse(): Easing {
            return easeOut(1 / this.$rate)
        }
    } as Easing;
};

/**
 * easeInOut
 * @param rate
 */
export function easeInOut(rate: number): Easing {
    return {
        $rate: rate,
        easing(dt: number): number {
            dt *= 2;
            if (dt < 1) {
                return 0.5 * Math.pow(dt, this.$rate);
            } else {
                return 1.0 - 0.5 * Math.pow(2 - dt, this.$rate);
            }
        },
        reverse(): Easing {
            return easeInOut(this.$rate);
        }
    } as Easing;
};

const easeExponentialInObj = {
    easing(dt: number): number {
        return dt === 0 ? 0 : Math.pow(2, 10 * (dt - 1));
    },
    reverse: function (): Easing {
        return easeExponentialOutObj;
    }
};
const easeExponentialOutObj = {
    easing(dt: number): number {
        return dt === 1 ? 1 : (-(Math.pow(2, -10 * dt)) + 1);
    },
    reverse(): Easing {
        return easeExponentialInObj;
    }
};

/**
 * easeExponentialIn
 */
export function easeExponentialIn(): Easing {
    return easeExponentialInObj;
}

/**
 * easeExponentialOut
 */
export function easeExponentialOut(): Easing {
    return easeExponentialOutObj;
}

const easeExponentialInOutObj = {
    easing(dt: number): number {
        if (dt !== 1 && dt !== 0) {
            dt *= 2;
            if (dt < 1) {
                return 0.5 * Math.pow(2, 10 * (dt - 1));
            } else {
                return 0.5 * (-Math.pow(2, -10 * (dt - 1)) + 2);
            }
        }
        return dt;
    },
    reverse(): Easing {
        return easeExponentialInOutObj;
    }
};

/**
 * easeExponentialInOut
 */
export function easeExponentialInOut(): Easing {
    return easeExponentialInOutObj;
}

const easeSineInObj = {
    easing(dt: number): number {
        return (dt === 0 || dt === 1) ? dt : -1 * Math.cos(dt * Math.PI / 2) + 1;
    },
    reverse(): Easing {
        return easeSineOutObj;
    }
};
const easeSineOutObj = {
    easing(dt: number): number {
        return (dt === 0 || dt === 1) ? dt : Math.sin(dt * Math.PI / 2);
    },
    reverse(): Easing {
        return easeSineInObj;
    }
};

/**
 * easeSineIn
 */
export function easeSineIn(): Easing {
    return easeSineInObj;
}

/**
 * easeSineOut
 */
export function easeSineOut(): Easing {
    return easeSineOutObj;
}

const easeSineInOutObj = {
    easing(dt: number): number {
        return (dt === 0 || dt === 1) ? dt : -0.5 * (Math.cos(Math.PI * dt) - 1);
    },
    reverse(): Easing {
        return easeSineInOutObj;
    }
};

/**
 * easeSineInOut
 */
export function easeSineInOut(): Easing {
    return easeSineInOutObj;
}

const easeElasticInObj = {
    easing(dt: number): number {
        if (dt === 0 || dt === 1) {
            return dt;
        }
        dt = dt - 1;
        return -Math.pow(2, 10 * dt) * Math.sin((dt - (0.3 / 4)) * Math.PI * 2 / 0.3);
    },
    reverse(): Easing {
        return easeElasticOutObj;
    }
};
const easeElasticOutObj = {
    easing(dt: number): number {
        return (dt === 0 || dt === 1) ? dt : Math.pow(2, -10 * dt) * Math.sin((dt - (0.3 / 4)) * Math.PI * 2 / 0.3) + 1;
    },
    reverse(): Easing {
        return easeElasticInObj;
    }
};

/**
 * easeElasticIn
 * @param period
 */
export function easeElasticIn(period?: number): Easing {
    if (period && period !== 0.3) {
        return {
            $period: period,
            easing: function (dt) {
                if (dt === 0 || dt === 1)
                    return dt;
                dt = dt - 1;
                return -Math.pow(2, 10 * dt) * Math.sin((dt - (this.$period / 4)) * Math.PI * 2 / this.$period);
            },
            reverse: function () {
                return easeElasticOut(this.$period);
            }
        } as Easing;
    }
    return easeElasticInObj;
};

/**
 * easeElasticOut
 * @param period
 */
export function easeElasticOut(period?: number): Easing {
    if (period && period !== 0.3) {
        return {
            $period: period,
            easing: function (dt) {
                return (dt === 0 || dt === 1) ? dt :
                    Math.pow(2, -10 * dt) * Math.sin((dt - (this.$period / 4)) * Math.PI * 2 / this.$period) + 1;
            },
            reverse: function () {
                return easeElasticIn(this.$period);
            }
        } as Easing;
    }
    return easeElasticOutObj;
};

/**
 * easeElasticInOut
 * @param period
 */
export function easeElasticInOut(period?: number): Easing {
    period = period || 0.3;
    return {
        $period: period,
        easing(dt: number): number {
            var newT = 0;
            var locPeriod = this.$period;
            if (dt === 0 || dt === 1) {
                newT = dt;
            } else {
                dt = dt * 2;
                if (!locPeriod)
                    locPeriod = this.$period = 0.3 * 1.5;
                var s = locPeriod / 4;
                dt = dt - 1;
                if (dt < 0)
                    newT = -0.5 * Math.pow(2, 10 * dt) * Math.sin((dt - s) * Math.PI * 2 / locPeriod);
                else
                    newT = Math.pow(2, -10 * dt) * Math.sin((dt - s) * Math.PI * 2 / locPeriod) * 0.5 + 1;
            }
            return newT;
        },
        reverse(): Easing {
            return easeElasticInOut(this.$period);
        }
    } as Easing;
}