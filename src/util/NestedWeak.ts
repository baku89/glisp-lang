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
		this.#map = new WeakMap()
	}

	#map: WeakMap<K1, WeakSet<K2>>

	has(key1: K1, key2: K2): boolean {
		const inner = this.#map.get(key1)
		return inner ? inner.has(key2) : false
	}

	add(key1: K1, key2: K2): void {
		let inner = this.#map.get(key1)
		if (!inner) {
			inner = new WeakSet()
			this.#map.set(key1, inner)
		}
		inner.add(key2)
	}

	delete(key1: K1, key2: K2): void {
		const inner = this.#map.get(key1)
		if (inner) {
			inner.delete(key2)
		}
	}
}
