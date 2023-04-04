import {IterableWeakSet} from 'iterable-weak'

import type {Expr, Symbol} from '.'

export class FailedResolution {
	#map = new Map<string | number, IterableWeakSet<Expr>>()

	set(path: string | number, symbol: Symbol) {
		const set = this.#map.get(path) ?? new IterableWeakSet<Expr>()
		set.add(symbol)
		this.#map.set(path, set)
	}

	clearCache(path: string | number) {
		this.#map.get(path)?.forEach(s => s.clearCache())
	}
}
