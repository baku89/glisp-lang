import {mapValues, values} from 'lodash'

import type {Expr} from './expr'
import type {Value} from './value'

/**
 * ログを格納する
 */
export interface Log {
	level: 'error' | 'warn' | 'info'
	reason: string
	ref?: Expr
}

export interface EvalInfo {
	hasFreeVar: boolean
	log: Set<Log>
}

const emptyEvalInfo: EvalInfo = {
	hasFreeVar: false,
	log: new Set(),
}

function mergeEvalInfo(a: EvalInfo, b: EvalInfo): EvalInfo {
	return {
		hasFreeVar: a.hasFreeVar || b.hasFreeVar,
		log: new Set([...a.log, ...b.log]),
	}
}

/**
 * Writerモナドのような仕組みで、Expr.eval, inferの値を格納する。
 * evalの結果は、評価後の値に * Logと「自由変数か否か」という情報を付加させたものなので、
 * Writerモナドとして表せる。
 */
export class EvalResult<T = Value> {
	constructor(readonly value: T, readonly info: EvalInfo = emptyEvalInfo) {}

	get asArray(): [T, EvalInfo] {
		return [this.value, this.info]
	}

	/**
	 * f::m a -> b を適用
	 */
	bind<U>(f: (v: T) => EvalResult<U>): EvalResult<U> {
		const {value: result, info} = f(this.value)
		return new EvalResult(result, mergeEvalInfo(this.info, info))
	}

	/**
	 * f::a -> b を適用
	 */
	map<U>(f: (v: T) => U): EvalResult<U> {
		return new EvalResult(f(this.value), this.info)
	}

	withInfo(info: EvalInfo) {
		return new EvalResult(this.value, mergeEvalInfo(this.info, info))
	}

	withLog(...logs: Log[]): EvalResult<T> {
		const info: EvalInfo = {
			hasFreeVar: this.info.hasFreeVar,
			log: new Set([...this.info.log, ...logs]),
		}
		return new EvalResult(this.value, info)
	}

	withFreeVar() {
		return new EvalResult(this.value, {...this.info, hasFreeVar: true})
	}

	withRef(ref: Expr) {
		const log = new Set([...this.info.log].map(l => ({...l, ref})))

		return new EvalResult(this.value, {...this.info, log})
	}

	/**
	 * 配列の中身を f::m a -> b で移す
	 */
	static map<T, U>(
		arr: T[],
		f: (v: T, index: number) => EvalResult<U>
	): EvalResult<U[]> {
		const writers = arr.map(f)
		const result = writers.map(w => w.value)
		const info = writers.reduce(
			(a, w) => mergeEvalInfo(a, w.info),
			emptyEvalInfo
		)
		return new EvalResult(result, info)
	}

	/**
	 * オブジェクトの値をf::m a -> bで移す
	 */
	static mapValues<T, U>(obj: Record<string, T>, f: (v: T) => EvalResult<U>) {
		const writers = mapValues(obj, f)
		const result = mapValues(writers, w => w.value)
		const info = values(writers).reduce(
			(a, w) => mergeEvalInfo(a, w.info),
			emptyEvalInfo
		)
		return new EvalResult(result, info)
	}
}
