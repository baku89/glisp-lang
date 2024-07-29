import {expect, test} from 'vitest'

import {isCompoundValue} from './ast'

test('isCompoundValue', () => {
	expect(isCompoundValue(0)).toBe(false)
})
