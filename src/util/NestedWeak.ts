export class NestedWeakMap<K1 extends object, K2 extends object, V> {
	constructor() {
		this.#map = new WeakMap()
	}

	#map: WeakMap<K1, WeakMap<K2, V>>

	get(key1: K1, key2: K2): V | undefined {
		const inner = this.#map.get(key1)
		if (inner) {
			return inner.get(key2)
		}
	}

	set(key1: K1, key2: K2, value: V): void {
		let inner = this.#map.get(key1)
		if (!inner) {
			inner = new WeakMap()
			this.#map.set(key1, inner)
		}
		inner.set(key2, value)
	}
}

export class NestedWeakSet<K1 extends object, K2 extends object> {
	constructor() {
		this.#map = new Map()
	}

	#map: Map<K1, Set<K2>>

	has(key1: K1, key2: K2): boolean {
		const inner = this.#map.get(key1)
		return inner ? inner.has(key2) : false
	}

	add(key1: K1, key2: K2): void {
		let inner = this.#map.get(key1)
		if (!inner) {
			inner = new Set()
			this.#map.set(key1, inner)
		}
		inner.add(key2)
	}

	forEach(fn: (key1: K1, key2: K2) => void): void {
		this.#map.forEach((inner, key1) => {
			inner.forEach(key2 => {
				fn(key1, key2)
			})
		})
	}

	delete(key1: K1, key2: K2): void {
		const inner = this.#map.get(key1)
		if (inner) {
			inner.delete(key2)
		}
		if (inner?.size === 0) {
			this.#map.delete(key1)
		}
	}
}
