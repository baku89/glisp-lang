{{
	function zip(coll) {
		const as = []
		const bs = []
		const cs = []
		const ds = []

		for (const [a, b, c, d] of coll) {
			as.push(a)
			bs.push(b)
			cs.push(c)
			ds.push(d)
		}

		return [as, bs, cs, ds]
	}

	function unzip([as, bs]) {
		const unzipped = []
		const len = as.length

		for (let i = 0; i < len; i++) {
			unzipped.push([as[i], bs[i]])
		}

		return unzipped
	}

	const fromPairs = Object.fromEntries

	function getOptionalPos(optionalFlags, label) {
		let optionalPos = optionalFlags.length
		let i = 0
		
		for (;i < optionalFlags.length; i++) {
			if (optionalFlags[i]) {
				optionalPos = i
				break
			}
		}

		for (i++; i < optionalFlags.length; i++) {
			if (!optionalFlags[i]) {
				throw new Error(
					`A required ${label} cannot follow an optional ${label}`
				)
			}
		}

		return optionalPos
	}

	function checkDuplicatedKey(keys, label) {
	const set = new Set()
		for (const key of keys) {
			if (typeof key !== 'string') continue

			if (set.has(key)) {
				throw new Error(`Duplicated ${label} '${key}'.`)
			}
			set.add(key)
		}
	}

	function parseRestParameter(rest) {
		if (!rest) return

		const [[name, expr], optional] = rest

		if (optional) throw new Error('A rest parameter cannot be marked optional')

		return {name, expr}
	}

	function checkDelimitersNotEmpty(delimiters) {
		for (const d of delimiters) {
			if (d === '') {
				throw new Error('A delimiter between elements cannot be empty')
			}
		}
	}

}}

{
	const Expr = options.Expr
}

Program = _ exp:Expr _
	{
		return exp
	}

Expr =
	expr:ExprContent
	exprMeta:ExprMeta?
	{
		if (exprMeta) {
			expr.setExprMeta(exprMeta)
		}
		
		return expr
	}

ExprContent =
	NumLiteral / StringLiteral / Symbol /
	FnDef / Scope / App / TryCatch /
	VecLiteral / DictLiteral / ValueMeta

ExprMeta = d:_ "#" fields:DictLiteral
	{
		return new Expr.ExprMeta(fields, {delimiter: [d]})
	}

ValueMeta =
	"^" d0:_ fields:ExprContent d1:_ expr:Expr
	{
		const meta = Expr.valueMeta(fields, expr)
		meta.extras = {
			delimiters: [d0, d1]
		}
		return meta
	}
	
Reserved = "=>" / "let" / "return" / "try" / "type" / "enum" / "data" / "match"

Symbol "identifier" =
	!(Reserved End)
	!(Digit / End) .
	(!End .)*
	{
		return Expr.symbol(text())
	}

NumLiteral "number" = [+-]? (Digit* ".")? Digit+
	{
		const raw = text()
		const v = parseFloat(raw)
		
		const num = Expr.numberLiteral(v)
		num.extras = {raw}
		return num
	}

StringLiteral "string" = '"' value:$(!'"' .)* '"'
	{
		return Expr.stringLiteral(value)
	}

App "function application" = "(" d0:_ itemsDs:(Expr _)* ")"
	{
		const [items, ds] = zip(itemsDs)

		const delimiters = [d0, ...ds]

		const app = Expr.app(...items)
		app.extras = {delimiters}

		return app
	}

FnDef "function definition" =
	"(" d0:_ "=>" d1:_ typeVarsDs:(TypeVars _)?
	                   param:Params d3:_ returnTypeDs:(":" _ Expr _ )?
	                   bodyDs:(Expr _)? ")"
	{
		const [typeVars, d2] = typeVarsDs ?? [null, null]

		const [colon, d4, returnType, d5] = returnTypeDs ?? [null, null, null, null]
		const [body, d6] = bodyDs ?? [null, null]

		const fn = Expr.fnDef(typeVars, param, returnType, body)

		// Collects delimiters
		const delimiters = [d0, d1]
		if (d2 !== null) delimiters.push(d2)
		delimiters.push(d3)
		if (d4 !== null) delimiters.push(d4)
		if (d5 !== null) delimiters.push(d5)
		if (d6 !== null) delimiters.push(d6)

		fn.extras = {delimiters}

		return fn
	}
	
Params =
	"[" d0:_ entries:(NamedExpr _)* rest:("..." @NamedExpr @_)? "]"
	{
		let optionalFlags, d1s, d2s

		;[entries, d1s] = zip(entries)
		;[entries, optionalFlags] = zip(entries)
		;[rest, d2s] = rest ?? [undefined, []]

		const paramDict = fromPairs(entries)
		const optionalPos = getOptionalPos(optionalFlags, 'parameter')
		rest = parseRestParameter(rest)
	
		const paramNames = entries.map(([name]) => name)
		if (rest) paramNames.push(rest.name)
		checkDuplicatedKey(paramNames, 'parameter')

		const params =  Expr.paramsDef(paramDict, optionalPos, rest) 
		params.extras = {delimiters: [d0, ...d1s, ...d2s]}
		return params
	}

TypeVars = "(" d0:_ namesDs:($([a-zA-Z] [a-zA-Z0-9]*) _)* ")"
	{
		const [names, ds] = zip(namesDs)

		const typeVars = new Expr.TypeVarsDef(names)
		typeVars.extras = {delimiters: [d0, ...ds]}
		return typeVars
	}

NamedExpr = id:Symbol optional:"?"? ":" _ expr:Expr
	{
		return [[id.name, expr], optional]
	}

VecLiteral "vector" =
	"[" d0:_ entries:(Expr "?"? _)* restDs:("..." @Expr @_)? "]"
	{
		const [items, optionalFlags, ds] = zip(entries)
		const [rest, dsr] = restDs ?? [undefined, []]

		const optionalPos = getOptionalPos(optionalFlags, 'item')

		const delimiters = [d0, ...ds, ...dsr]

		const vec = Expr.vec(items, optionalPos, rest)
		vec.extras = {delimiters}
		return vec
	}

DictLiteral "dictionary" = "{"
	d0:_ entries:DictEntry* restDs:("..." @Expr @_)? "}"
	{
		const items = {}
		const optionalKeys = new Set()
		const [rest, dsr] = restDs ?? [undefined, []]

		const delimiters = [d0]

		for (const [key, value, optional, ds] of entries) {
			if (key in items) throw new Error(`Duplicated key: '${key}'`)

			items[key] = value
			if (optional) optionalKeys.add(key)

			delimiters.push(...ds)
		}

		delimiters.push(...dsr)

		const dict = Expr.dict(items, optionalKeys, rest)
		dict.extras = {delimiters}
		return dict
	}

DictEntry = key:DictKey optional:"?"? ":" d0:_ value:Expr d1:_
	{
		return [key, value, optional, [d0, d1]]
	}

// TODO: Why not allowing reserved words for key?
DictKey =
	id:Symbol {return id.name } /
	str: StringLiteral {return str.value }

Scope "scope" =
	"(" d0:_ "let" d1:__ pairs:(@Symbol ":" @_ @Expr @_)* out:Expr? dl:_ ")"
	{
		const items = {}
		const delimiters = [d0, d1]

		for (const [{name}, da, value, db] of pairs) {
			if (name in items) throw new Error(`Duplicated symbol name: '${name}'`)

			items[name] = value

			delimiters.push(da, db)
		}

		delimiters.push(dl)

		const scope = Expr.scope(items, out ?? null)
		scope.extras = {delimiters}
		return scope
	}

TryCatch = "(" d0:_ "try" d1:_ block:Expr d2:_ handler:Expr d3:_ ")"
	{
		const tryCatch = Expr.tryCatch(block, handler)
		tryCatch.extras = {delimiters: [d0, d1, d2, d3]}
		return tryCatch
	}

_ "delimiter" = Whitespace* (Comment? Newline Whitespace*)* (Comment EOF)?
	{
		return text()
	}

__ "non-zero length delimiter" =
	(
		Whitespace+ (Comment? Newline Whitespace*)* /
		Whitespace* (Comment? Newline Whitespace*)+ /
		Whitespace* &[)\]}]
	)
	{
		return text()
	}

Comment = ";" (!Newline .)*

Punctuation = [()[\]{}:`"?.;^@#~\\]

Newline = [\n\r]

Whitespace = [ \t,]

Digit = [0-9]

EOF = !.
End = EOF / Whitespace / Newline / Punctuation
