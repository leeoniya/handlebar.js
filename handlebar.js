/*
Copyright (c) 2010, Leon Sorokin
All rights reserved.

handlebar.js - a javascript templating
framework based on a modified Mustache
syntax http://mustache.github.com/mustache.5.html
*/

var HandleBar = function(opts) {
	var formatters = opts && opts.formatters ? opts.formatters : {},
		checkers = opts && opts.checkers ? opts.checkers : {},
		cache = {};

	function Tokenizer(tmpl) {
		var buf = [], idx = 0, match, end = null, pretxt, postxt,
			re = function(){return (/{{([{>#]*([\w.]*)(?:[?!=~>\w.]+)?)(?:\/}}|}}(?:([\s\S]+?){{\/\2}})?)/gm)}();	// fixes chrome (webkit?) bug

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

			return buf.shift();
		}
	}

	function ParseTag(tagStr) {
		if (!tagStr) return null;

		var d = {};

		// cacheKey
		var tag_ck = tagStr.split('>');
		d.cacheKey = tag_ck[1] || null;
		tagStr = tag_ck[0];

		// subTag
		var tag_sub = tagStr.split('=');
		d.subTag = tag_sub[1] ? '{{' + tag_sub[1] + '}}' : null;
		tagStr = tag_sub[0];

		// formatter
		var tag_fmtr = tagStr.split('~');
		d.formatter = tag_fmtr[1] || null;
		tagStr = tag_fmtr[0];

		// bool + checkers
		d.bool = d.inverted = false;
		if (tagStr.indexOf('?') != -1) {d.bool = true;}
		else if (tagStr.indexOf('!') != -1) {d.bool = d.inverted = true;}
		if (d.bool) {
			var tag_chkr = tagStr.split(/[?!]/);
			d.checker = tag_chkr[1] || null;
			tagStr = tag_chkr[0];
		}

		// enumFlag (enumAcc)
		var enum_tag = tagStr.split('#');
		d.enumAcc = enum_tag.length == 2;
		tagStr = enum_tag.pop();

		// unescFlag (unescaped)
		var esc_tag = tagStr.split('{');
		d.escaped = esc_tag.length == 1;
		tagStr = esc_tag.pop();

		d.dataPath = tagStr == '.' ? [] : tagStr ? tagStr.split('.') : null;

		return d;
	}

	function Parse(template) {
		var params, nodes = [];
		if (!template) return nodes;

		var tkz = new Tokenizer(template);
		while ((params = tkz.next())) {
			var tag = ParseTag(params[0]), content = params[1], cacheOnly = false, node = null;
			// write data-unbound prototype node to cache
			if (tag && tag.cacheKey && content) {
				var tag2 = Clone(tag);
				tag2.cacheKey = null;
				tag2.dataPath = [];
				cache[tag.cacheKey] = NodeFactory.Create(tag2, content);
				cacheOnly = !tag.dataPath;
			}

			if (!cacheOnly) {node = NodeFactory.Create(tag, content || tag.subTag);}	// create normal or cacheReader

			if (!node) {continue;}

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

	function isTruthy(val) {
		return !isFalsy(val);
	}

	function arrayWrap(v) {
		switch (typeOf(v)) {
			case "array": return v;
			case "object": return [v];
			default: return v;
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
				else if (tag.bool) {node = new BoolNode(tag.dataPath, tag.inverted, tag.checker);}
				// {{items}} {{items.blah}}
				else {node = new BlockNode(tag.dataPath, tag.enumAcc);}

				node.children = Parse(content);
				return node;
			}
		}

		var Node = function() {}

			var CacheNode = function(dataPath, cacheKey) {
				this.base = Node; this.base();
				this.dataPath = dataPath || null;
				this.cacheKey = cacheKey;

				this.Render = function(buf, ctx) {
					cache[this.cacheKey].Render(buf, ctx, this.dataPath);
				}
			}

			var TextNode = function(content) {
				this.base = Node; this.base();
				this.content = content;

				this.Render = function(buf) {
					buf.write(this.content);
				}
			}

			var EnumPosNode = function() {
				this.base = Node; this.base();

				this.Render = function(buf, ctx, dataPath, enumPos) {
					buf.write(enumPos, false);
				}
			}

			// data lookup node (all nodes where render directly depends on looked up data)
			var LookupNode = function(dataPath) {
				this.base = Node; this.base();
				this.dataPath = dataPath || null;

				// depth-traverses an context by properties
				this.Lookup = function(dataPath, ctx) {
					for (var i in dataPath || []) {
						ctx = ctx[dataPath[i]];
						if (typeof ctx == 'undefined') break;
					}
					return ctx;
				}

				this.rendCtx = function(ctx, dataPath) {
					return this.Lookup(dataPath || this.dataPath, ctx);
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

					this.Render = function(buf, ctx, dataPath) {
						this.RenderChildren(buf, this.rendCtx(ctx, dataPath));
					}

					this.RenderChildren = function(buf, ctx) {
						var rctxs = this.enumObjs ? ctx : arrayWrap(ctx);
						for (var i in rctxs) {
							for (var j in this.children) {
								this.children[j].Render(buf, rctxs[i], null, i);
							}
						}
					}
				}

					var BoolNode = function(dataPath, inverted, checker) {
						this.base = BlockNode; this.base(dataPath);
						this.inverted = inverted || false;		// TODO: make better
						this.checker = checker;

						this.rendCtx = function(ctx) {return [ctx]};

						this.Render = function(buf, ctx) {
							var chkFunc = checkers[checker],
								chkVal = this.Lookup(this.dataPath, ctx),
								chkRes = isTruthy(chkFunc ? chkFunc(chkVal) : chkVal);

							if (chkRes === this.inverted) return;

							this.RenderChildren(buf, this.rendCtx(ctx));
						}
					}
	}
}