import {IterableWeakSet} from 'iterable-weak'

import type {Expr, Symbol} from '.'
import type {Key} from './path'

export class FailedResolution {
	#map = new Map<Key, IterableWeakSet<Expr>>()

	set(key: Key, symbol: Symbol) {
		const set = this.#map.get(key) ?? new IterableWeakSet<Expr>()
		set.add(symbol)
		this.#map.set(key, set)
	}

	clearCache(path: Key) {
		this.#map.get(path)?.forEach(s => s.clearCache())
	}
}
