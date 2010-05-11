/*
Copyright (c) 2010, Leon Sorokin
All rights reserved.

handlebar.js - a javascript templating
framework based on a modified Mustache
syntax http://mustache.github.com/mustache.5.html
*/

var HandleBar = function(opts) {
	var formatters = opts && opts.formatters ? opts.formatters : {};
	var cache = {};

	function Tokenizer(tmpl) {
		var buf = [], idx = 0, match, end = null, pretxt, postxt,
			re = function(){return (/{{([{>?!]*([\w.]+)(?:[>~=][\w.]+)?)}}(?:([\s\S]+?){{\/\2}})?/gm)}();	// fixes chrome (webkit?) bug
		
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
		// 1: unescaped; 2: bool or useCache; 3: dataKey / cacheKey; 4: reformat or useCache; 5: formatter / cacheKey
		var m = tagStr.match(/({)?([>?!])?([\w.]+)(?:([>~=])([~\w.]+))?/),
			d = {bool: false, dataKey: null, propPath: null, cacheKey: null, inverted: false, formatter: null, escaped: !m[1], subTag: null};

		switch (m[2]) {
			case '>': d.cacheKey = m[3]; break;
			case '!': d.inverted = true;
			case '?': d.bool = true;
			default: d.dataKey = m[3];
		}

		switch (m[4]) {
			case '>': d.cacheKey = m[5]; break;
			case '~': d.formatter = m[5]; break;
			case '=': d.subTag = '{{' + m[5] + '}}'; break;
		}

		// handle property paths (items.length)
		if (d.dataKey && d.dataKey != '.' && d.dataKey.indexOf('.') != -1) {
			var dp = d.dataKey.split('.');
			d.dataKey = dp.shift() || '.';
			d.propPath = dp.length > 0 ? dp : null;
		}

		return d;
	}

	function Parse(template) {
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
				tag2.dataKey = null;
				cache[tag.cacheKey] = NodeFactory.Create(tag2, content);
				cacheOnly = !tag.dataKey;
			}
			
			if (!cacheOnly) {node = NodeFactory.Create(tag, content || tag.subTag);}					// create normal or cacheReader

			if (!node) {continue;}
			nodes.push(node);
		}

		return nodes;
	}
	
	this.Render = function(tpl, ctx) {
		var rootNode = NodeFactory.Create(ParseTag('root'), tpl);
		var buf = new StringWriter();
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

	var NodeFactory = new function() {

		this.Create = function(tag, content) {
			// text nodes
			if (!tag && content && content.indexOf('{{') == -1) {return new TextNode(content);}
			
			// cacheReader nodes {{items>blah}} {{>blah}}
			if (tag && tag.cacheKey) {return new CacheNode(tag.dataKey, tag.propPath, tag.cacheKey);}
			
			if (!content) {
				// {{item}} {{{item}} {{item~frm}} {{.}}
				return new PropNode(tag.dataKey, tag.propPath, tag.escaped, tag.formatter);
			}
			else {
				var node, children = Parse(content);
				
				if (!tag) {node = new BlockNode;}
				// {{?bool}} {{!bool}}
				else if (tag.bool) {node = new BoolNode(tag.dataKey, tag.propPath, tag.inverted);}
				// {{items}} {{items.blah}}
				else {node = new BlockNode(tag.dataKey, tag.propPath);}
				
				node.children = children;
				return node;
			}
		}
		
		var Node = function() {
			this.Clone = Clone;
		}
			
			var CacheNode = function(dataKey, propPath, cacheKey) {
				this.base = Node; this.base();
				this.dataKey = dataKey || null;
				this.propPath = propPath || null;
				this.cacheKey = cacheKey;
				
				this.Render = function(buf, ctx) {
					var node = cache[this.cacheKey].Clone();
					if (!dataKey)
						node.RenderChildren(buf, ctx);
					else {
						node.dataKey = this.dataKey;
						node.propPath = this.propPath;
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
			
			// data lookup node (all nodes where render directly depends on looked up data)
			var LookupNode = function(dataKey, propPath) {
				this.base = Node; this.base();
				this.dataKey = dataKey || null;
				this.propPath = propPath || null;
				
				// depth-traverses an object by properties
				this.dataCtx = function(ctx) {
					if (!this.propPath) return ctx;
					for (var i in this.propPath) {
						ctx = ctx[this.propPath[i]];
						if (typeof ctx == 'undefined') break;
					}
					return ctx;
				}
				
				this.rendCtx = function(ctx) {
					var ictx = this.dataKey == '.' ? ctx : ctx[this.dataKey];
					ictx = this.dataCtx(ictx)
					return ictx;
				}
			}
				// {{{price~blah}}
				var PropNode = function(dataKey, propPath, escape, formatter) {
					this.base = LookupNode;	this.base(dataKey, propPath);
					this.escape = escape || true;
					this.formatter = formatters[formatter] || function(val){return val;};
					
					this.Render = function(buf, ctx) {
						var rctx = this.rendCtx(ctx);
						if (isFalsy(rctx)) return;
						else buf.write(this.formatter(rctx), escape);
					}
				}

				// implements children rendering
				var BlockNode = function(dataKey, propPath) {
					this.base = LookupNode;	this.base(dataKey, propPath);
					this.children = [];
					
					this.Render = function(buf, ctx) {
						var rctx = this.rendCtx(ctx);
						this.RenderChildren(buf, rctx);
					}
					
					this.RenderChildren = function(buf, ctx) {
						var rctxs = arrayWrap(ctx);
						for (var i in rctxs) {
							for (var j in this.children) {
								this.children[j].Render(buf, rctxs[i]);
							}
						}
					}
				}
					var BoolNode = function(dataKey, propPath, inverted) {
						this.base = BlockNode;	this.base(dataKey, propPath);
						this.inverted = inverted || false;		// TODO: make better
						
						this.rendCtx = function(ctx) {return ctx};

						this.Render = function(buf, ctx) {
							if (!isFalsy(this.dataCtx(ctx[this.dataKey])) === this.inverted) return;
							
							var rctx = this.rendCtx(ctx);
							this.RenderChildren(buf, rctx);
						}
					}
	}
}