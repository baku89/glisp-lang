import {Expr, Value} from 'glisp'
import {computed, ShallowRef, shallowRef, triggerRef, watchEffect} from 'vue'

interface Props<T extends Expr> {
	expr: T
	expectedType: Value
}

/**
 * G.ExprをshallowRef化する際に、うまくreactivityが働くようにするための諸々
 */
export function useExpr<T extends Expr>(props: Props<T>) {
	const exprRef: ShallowRef<T> = shallowRef(props.expr)

	watchEffect(() => {
		exprRef.value = props.expr
		exprRef.value.on('edit', () => triggerRef(exprRef))
	})

	const inferred = computed(() => exprRef.value.infer())

	const typeInvalid = computed(() => {
		return !inferred.value.isSubtypeOf(props.expectedType)
	})

	return {exprRef, inferred, typeInvalid}
}

export function useExprEvaluated(exprRef: ShallowRef<Expr>): ShallowRef<Value> {
	const evaluated: ShallowRef<Value> = shallowRef(exprRef.value.eval())

	watchEffect(() => {
		evaluated.value = exprRef.value.eval()

		exprRef.value.on('change', () => {
			evaluated.value = exprRef.value.eval()
		})
	})

	return evaluated
}
