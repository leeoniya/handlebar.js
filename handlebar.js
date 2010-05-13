/*
Copyright (c) 2010, Leon Sorokin
All rights reserved.

handlebar.js - a javascript templating
framework based on a modified Mustache
syntax http://mustache.github.com/mustache.5.html
*/

var HandleBar = function(opts) {
	var formatters = opts && opts.formatters ? opts.formatters : {},
		cache = {};

	function Tokenizer(tmpl) {
		var buf = [], idx = 0, match, end = null, pretxt, postxt,
			re = function(){return (/{{([{>?!#]*([\w.]+)?(?:[>~=][\w.]+)?)}}(?:([\s\S]+?){{\/\2}})?/gm)}();	// fixes chrome (webkit?) bug

		this.next = function() {
			if (end) return null;
			if (buf.length) return buf.shift();

			match = re.exec(tmpl);
			if (match) {
				pretxt = match.input.substring(idx, match.index) || '';
				if (pretxt) buf.push([null,pretxt]);
				buf.push([match[1],match[3] || null]);
				idx += match[0].length + pretxt.length;
			}
			else {
				postxt = tmpl.substring(idx);
				if (postxt) buf.push([null,postxt]);
				end = true;
			}

			return buf.shift() || null;
		}
	}

	function ParseTag(tagStr){
		if (!tagStr) return null;
		// 1: unescaped; 2: bool or useCache; 3: dataPathStr / cacheKey; 4: reformat or useCache; 5: formatter / cacheKey
		var m = tagStr.match(/({)?([>?!#])?([\w.]+)?(?:([>~=])([~\w.]+))?/),
			d = {bool: false, dataPath: [], cacheKey: null, inverted: false, formatter: null, escaped: !m[1], subTag: null, enumAcc: false},
			dataPathStr;

		switch (m[2]) {
			case '>': d.cacheKey = m[3]; break;
			case '#': d.enumAcc = true; dataPathStr = m[3]; break;		// serves both, force-enum objects and enum keys
			case '!': d.inverted = true;
			case '?': d.bool = true;
			default: dataPathStr = m[3];
		}

		switch (m[4]) {
			case '>': d.cacheKey = m[5]; break;
			case '~': d.formatter = m[5]; break;
			case '=': d.subTag = '{{' + m[5] + '}}'; break;
		}

		// handle property paths (items.length)
		if (dataPathStr && dataPathStr !== '.') {
			d.dataPath = dataPathStr.split('.');
		}

		return d;

	}

	function Parse(template, parent) {
		var params, node, nodes = [];
		if (!template) return nodes;

		var tkz = new Tokenizer(template);
		while ((params = tkz.next())) {
			var tag = ParseTag(params[0]),
				content = params[1], cacheOnly = false;
			// write data-unbound prototype node to cache
			if (tag && tag.cacheKey && content) {
				var tag2 = Clone(tag);
				tag2.cacheKey = null;
				tag2.dataPath = [];
				cache[tag.cacheKey] = NodeFactory.Create(tag2, content);
				cacheOnly = !tag.dataPath.length;
			}

			if (!cacheOnly) {node = NodeFactory.Create(tag, content || tag.subTag);}					// create normal or cacheReader

			if (!node) {continue;}

			node.parent = parent;
			nodes.push(node);
		}

		return nodes;
	}

	this.Render = function(tpl, ctx, enumRoot) {
		var enumRoot = enumRoot || false,
			rootTag = ParseTag((enumRoot ? '#' : '') + 'root'),
			rootNode = NodeFactory.Create(rootTag, tpl),
			buf = new StringWriter();

		rootNode.Render(buf, {root:ctx});
		return buf.toString();
	}

	this.Cache = function(tmpl, cacheKey) {
		cache[cacheKey] = NodeFactory.Create(null, tmpl);
	}

	function StringWriter() {
		function escapeHTML(s) {
			return (s + '').replace(/&(?!\w+;)|["<>\\]/g, function(s) {
				switch(s) {
					case "&": return "&amp;";
					case "\\": return "\\\\";;
					case '"': return '\"';;
					case "<": return "&lt;";
					case ">": return "&gt;";
					default: return s;
				}
			});
		}

		this.string = '';
		this.write = function(string, escape) {this.string += !escape ? string : escapeHTML(string);}
		this.toString = function() {return this.string;}
	}

	// a better typeof
	function typeOf(obj) {
		var ret = typeof obj;
		if (ret !== "object")
			return ret;
		if (obj === null)
			return "null";
		var str = Object.prototype.toString.call(obj);
		return (/^\[object (?:Boolean|Number|String|Function|Array|Date|RegExp)\]$/).test(str) ? str.slice(8,-1).toLowerCase() : ret;
	}

	// tests for false, null, undefined, empty arrays, strings, hashes,
	function isFalsy(val) {
		function isEmpty(obj) {
			for(var prop in obj) {
				if(obj.hasOwnProperty(prop))
					return false;
			}
			return true;
		}

		return val === null || val === false || typeof val === "undefined" || val.length === 0 || typeof val === "object" && isEmpty(val);
	}

	function arrayWrap(v) {
		switch (typeOf(v)) {
			case "array": return v;
			case "object": return [v];
			default: return [];
		}
	}

	function Clone(obj) {
		var ClonedObject = function(){};
		ClonedObject.prototype = obj || this;
		return new ClonedObject;
	}

	// depth-traverses an object by properties
	function getProp(obj, propPath) {
		for (var i in propPath) {
			obj = obj[propPath[i]];
			if (typeof obj == 'undefined') break;
		}
		return obj;
	}

	var NodeFactory = new function() {

		this.Create = function(tag, content) {
			// text nodes
			if (!tag && content && content.indexOf('{{') == -1) {return new TextNode(content);}

			// cacheReader nodes {{items>blah}} {{>blah}}
			if (tag && tag.cacheKey) {return new CacheNode(tag.dataPath, tag.cacheKey);}

			if (!content) {
				// {{#}}
				if (tag && tag.enumAcc) {return new EnumPosNode;}
				// {{item}} {{{item}} {{item~frm}} {{.}}
				return new PropNode(tag.dataPath, tag.escaped, tag.formatter);
			}
			else {
				var node;

				if (!tag) {node = new BlockNode;}
				// {{?bool}} {{!bool}}
				else if (tag.bool) {node = new BoolNode(tag.dataPath, tag.inverted);}
				// {{items}} {{items.blah}}
				else {node = new BlockNode(tag.dataPath, tag.enumAcc);}

				node.children = Parse(content, node);
				return node;
			}
		}

		var Node = function() {
			this.parent = null;
			this.Clone = Clone;
		}

			var CacheNode = function(dataPath, cacheKey) {
				this.base = Node; this.base();
				this.dataPath = dataPath || [];
				this.cacheKey = cacheKey;

				this.Render = function(buf, ctx) {
					var node = cache[this.cacheKey].Clone();
					if (!this.dataPath.length)
						node.RenderChildren(buf, ctx);
					else {
						node.dataPath = this.dataPath;
						node.Render(buf, ctx);
					}
				}
			}

			var TextNode = function(content) {
				this.base = Node; this.base();
				this.content = content;

				this.Render = function(buf, ctx) {
					buf.write(this.content);
				}
			}

			var EnumPosNode = function() {
				this.base = Node; this.base();
				this.Render = function(buf, ctx) {
					buf.write(this.parent.enumPos, false);
				}
			}

			// data lookup node (all nodes where render directly depends on looked up data)
			var LookupNode = function(dataPath) {
				this.base = Node; this.base();
				this.dataPath = dataPath || [];

				this.rendCtx = function(ctx) {
					return getProp(ctx, this.dataPath);
				}
			}
				// {{{price~blah}}
				var PropNode = function(dataPath, escape, formatter) {
					this.base = LookupNode; this.base(dataPath);
					this.escape = escape || true;
					this.formatter = formatters[formatter] || function(val){return val;};

					this.Render = function(buf, ctx) {
						var rctx = this.rendCtx(ctx);
						if (isFalsy(rctx)) return;
						else buf.write(this.formatter(rctx), escape);
					}
				}

				// implements children rendering
				var BlockNode = function(dataPath, enumObjs) {
					this.base = LookupNode; this.base(dataPath);
					this.children = [];
					this.enumObjs = enumObjs || false;

					this.Render = function(buf, ctx) {
						var rctx = this.rendCtx(ctx);
						this.RenderChildren(buf, rctx);
					}

					this.RenderChildren = function(buf, ctx) {
						var rctxs = this.enumObjs ? ctx : arrayWrap(ctx);
						for (var i in rctxs) {
							this.enumPos = i;
							for (var j in this.children) {
								this.children[j].Render(buf, rctxs[i]);
							}
						}
					}
				}
					var BoolNode = function(dataPath, inverted) {
						this.base = BlockNode; this.base(dataPath);
						this.inverted = inverted || false;		// TODO: make better

						this.rendCtx = function(ctx) {return ctx};

						this.Render = function(buf, ctx) {
							if (!isFalsy(getProp(ctx, this.dataPath)) === this.inverted) return;

							var rctx = this.rendCtx(ctx);
							this.RenderChildren(buf, rctx);
						}
					}
	}
}