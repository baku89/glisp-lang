import {testEval} from '../util/testUtil'
import {NumberType, unionType, unit} from '../value'

describe('functions in the prelude module', () => {
	testEval('(+ 1 2)', '3')
	testEval('(* 1 2)', '2')
	testEval('(< 1 2)', 'true')
	testEval('(if true 1 false)', '1')
	testEval('(< 4 (if true 1 2))', 'false')
	testEval('(! true)', 'false')
	testEval('(even? 2)', 'true')
	testEval('(div 15 5)', '3')
	testEval('(% 5 2)', '1')
	testEval('(** 6 3)', '216')
	testEval('(- 10 9)', '1')

	testEval('(union () Number)', unionType(unit, NumberType))

	testEval('(inc 10)', '11')
	testEval('(dec 10)', '9')
	testEval('(sqrt 25)', '5')
	testEval('(sqrt -2)', '0', true)
	testEval('(hypot 3 4)', '5')
	testEval('(id 10)', '10')
	testEval('((compose inc even?) 1)', 'true')
	testEval('((compose inc even?) 2)', 'false')
	testEval('((compose id id) 1)', '1')
	testEval('(filter even? [0 1 2 3 4 5 6])', '[0 2 4 6]')
})

describe('truthy values', () => {
	testEval('(truthy? 0)', 'false')
	testEval('(truthy? -0)', 'false')
	testEval('(truthy? "")', 'false')
	testEval('(truthy? NaN)', 'false')
	testEval('(truthy? ())', 'false')
	testEval('(truthy? 1)', 'true')
	testEval('(truthy? "hi")', 'true')
	testEval('(truthy? [])', 'true')
})
