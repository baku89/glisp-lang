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

		const [[name, node], optional] = rest

		if (optional) throw new Error('A rest parameter cannot be marked optional')

		return {name, node}
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

Program = _ exp:Node _
	{
		return exp
	}

Node =
	node:NodeContent
	nodeMeta:NodeMeta?
	{
		if (nodeMeta) {
			node.setNodeMeta(nodeMeta)
		}
		
		return node
	}

NodeContent =
	Num / Str / Identifier /
	FnDef / FnType / Scope / TryCatch / App /
	Vec / Dict / ValueMeta

NodeMeta = d:_ "#" fields:Dict
	{
		return new Expr.NodeMeta(fields, {delimiter: [d]})
	}

ValueMeta =
	"^" d0:_ fields:NodeContent d1:_ node:Node
	{
		const meta = Expr.valueMeta(fields, node)
		meta.extras = {
			delimiters: [d0, d1]
		}
		return meta
	}
	
Reserved = "=>" / "->" / "let" / "return" / "try" / "type" / "enum" / "data" / "match"

Identifier "identifier" =
	!(Reserved End)
	!(Digit / End) .
	(!End .)*
	{
		return Expr.id(text())
	}

Num "number" = [+-]? (Digit* ".")? Digit+
	{
		const raw = text()
		const v = parseFloat(raw)
		
		const num = Expr.num(v)
		num.extras = {raw}
		return num
	}

Str "string" = '"' value:$(!'"' .)* '"'
	{
		return Expr.str(value)
	}

App "function application" = "(" d0:_ itemsDs:(Node _)* ")"
	{
		const [items, ds] = zip(itemsDs)

		const delimiters = [d0, ...ds]

		const app = Expr.app(...items)
		app.extras = {delimiters}

		return app
	}

FnDef "function definition" =
	"(" d0:_ "=>" d1:__ typeVarsDs:(TypeVars __)? param:Params d3:__ body:Node d4:_ ")"
	{
		const [typeVars, d2] = typeVarsDs ?? [undefined, undefined]

		const fn = Expr.fnDef(typeVars, param, body)
		fn.extras = {delimiters: [d0, d1, ...(d2 ? [d2] : []), d3, d4]}
		return fn
	}

FnType "function type definition" =
	"(" d0:_ "->" d1:__ typeVarsDs:(TypeVars __)? param:Params d3:__ out:Node d4:_ ")"
	{
		const [typeVars, d2] = typeVarsDs ?? [undefined, undefined]

		const fnType = Expr.fnType(typeVars, param, out)
		fnType.extras = {delimiters: [d0, d1, ...(d2 ? [d2] : []), d3, d4]}
		return fnType
	}
	
Params =
	"[" d0:_ entries:(NamedNode __)* rest:("..." @NamedNode @_)? "]"
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

		const params =  Expr.params(paramDict, optionalPos, rest) 
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

NamedNode = id:Identifier optional:"?"? ":" _ node:Node
	{
		return [[id.name, node], optional]
	}

Vec "vector" =
	"[" d0:_ entries:(Node "?"? _)* restDs:("..." @Node @_)? "]"
	{
		const [items, optionalFlags, ds] = zip(entries)
		const [rest, dsr] = restDs ?? [undefined, []]

		const optionalPos = getOptionalPos(optionalFlags, 'item')

		const delimiters = [d0, ...ds, ...dsr]

		const vec = Expr.vec(items, optionalPos, rest)
		vec.extras = {delimiters}
		return vec
	}

Dict "dictionary" = "{"
	d0:_ entries:DictEntry* restDs:("..." @Node @_)? "}"
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

DictEntry = key:DictKey optional:"?"? ":" d0:_ value:Node d1:__
	{
		return [key, value, optional, [d0, d1]]
	}

// TODO: Why not allowing reserved words for key?
DictKey =
	id:Identifier {return id.name } /
	str: Str      {return str.value }

Scope "scope" =
	"(" d0:_ "let" d1:__ pairs:(@Identifier ":" @_ @Node @__)* out:Node? dl:_ ")"
	{
		const vars = {}
		const delimiters = [d0, d1]

		for (const [{name}, da, value, db] of pairs) {
			if (name in vars) throw new Error(`Duplicated symbol name: '${name}'`)

			vars[name] = value

			delimiters.push(da, db)
		}

		delimiters.push(dl)

		const scope = Expr.scope(vars, out ?? null)
		scope.extras = {delimiters}
		return scope
	}

TryCatch = "(" d0:_ "try" d1:__ block:Node d2:__ handler:Node d3:_ ")"
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
