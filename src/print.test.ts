import {describe, expect, test} from 'vitest'

import {s} from './ast'
import {print} from './print'

describe('print symbol', () => {
	test('print a', () => {
		expect(print(s`a`)).toBe('a')
	})
})
