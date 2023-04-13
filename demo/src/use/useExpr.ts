import {Expr, Value} from 'glisp'
import {ShallowRef, shallowRef, triggerRef, watchEffect} from 'vue'

interface Props<T extends Expr> {
	expr: T
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

	return {exprRef}
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
