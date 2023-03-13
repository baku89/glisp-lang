interface IndexingStringategy {
	parse: (name: string) => [string, number] | null
	print: (index: number) => string
}

const SimpleIndexing: IndexingStringategy = {
	parse(name) {
		const match = /[0-9]+$/.exec(name)
		if (!match) return null
		const original = name.slice(0, match.index)
		const index = parseInt(match[0])
		return [original, index]
	},
	print(index) {
		return index.toString()
	},
}

export function createUniqueName(
	name: string,
	existingNames: string[],
	indexingStringategy: IndexingStringategy = SimpleIndexing
): string {
	const [original, start] = indexingStringategy.parse(name) ?? [name, 1]

	let index = start

	while (existingNames.includes(name)) {
		name = original + indexingStringategy.print(index)
		index++
	}

	return name
}

interface NamedObject {
	name: string
}

export function resolveNameCollision<T extends NamedObject>(
	values: Iterable<T>
): Map<T, string> {
	const map: Map<T, string> = new Map()
	const names = Array.from(values).map(v => v.name)

	for (const value of values) {
		const uniqueName = createUniqueName(value.name, names)

		map.set(value, uniqueName)

		names.push(uniqueName)
	}

	return map
}
