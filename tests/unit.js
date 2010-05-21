/*
module("Modifiers");
test("'{' - HTML Pass-Through", function(){
	var data, tmpl, M = new HandleBar();
	tmpl = "{{one}} & {{{two}}!";
	data = {one:"<Hello>", two:"<World>"};
	equals(M.Render(tmpl, data), "&lt;Hello&gt; & <World>!", "Un/escaped HTML in templates and data");
})
*/
test("'>' - Use Cache", function(){
	var data, tmpl, M = new HandleBar();

	tmpl = "{{owner}}'s items: {{items>myItem}}---{{sku}}: ${{price}}---\n{{/items}}\n{{owner}}'s options: {{options}}{{>myItem}}{{/options}}";
	data = {owner: "Robert", items:[{sku:"AAA", price:44.33},{sku:"BBB", price:64.95}], options:[{sku:"CCC", price:66.55},{sku:"DDD", price:99.95}]};
	equals(M.Render(tmpl, data), "Robert's items: ---AAA: $44.33---\n---BBB: $64.95---\n\nRobert's options: ---CCC: $66.55---\n---DDD: $99.95---\n", "Implicit cache and re-use");

	var myItem = "{{>myItem}}---{{sku}}: ${{price}}---\n{{/myItem}}";
	tmpl = myItem + "{{owner}}'s items: {{items}}{{>myItem}}{{/items}}\n{{owner}}'s options: {{options}}{{>myItem}}{{/options}}";
	equals(M.Render(tmpl, data), "Robert's items: ---AAA: $44.33---\n---BBB: $64.95---\n\nRobert's options: ---CCC: $66.55---\n---DDD: $99.95---\n", "Cache first then use");

	var person = "{{>person}}---{{owner}}---{{/person}}";
	tmpl = person + "{{>person}}";
	equals(M.Render(tmpl, data), "---Robert---", "Apply to current context");

	M.Cache("---{{sku}}: ${{price}}---\n", "item");
	tmpl = "{{owner}}'s items: {{items>item}}";
	data = {owner: "Robert", items:[{sku:"AAA", price:44.33},{sku:"BBB", price:64.95}]};
	equals(M.Render(tmpl, data), "Robert's items: ---AAA: $44.33---\n---BBB: $64.95---\n", "Expand a partial template");

	tmpl = "{{items>xItem}}{{qty}},{{price}},{{parts>xItem}},{{/items}}";		// should render on non-existent parts, not just empty
	data = {items:[{qty:2,price:5.99,parts:[{qty: 1, price:6.99}, {qty:3,price:7.99}]},{qty:9,price:10.55}]};
	equals(M.Render(tmpl, data), "2,5.99,1,6.99,,3,7.99,,,9,10.55,,", "Recursively render a cached template.");
})

test("'! and ?' - Conditionals", function(){
	var data, tmpl, M = new HandleBar();

	tmpl = "{{!isHere}}shown{{/isHere}}";
	data = {isHere:false};
	equals(M.Render(tmpl, data), "shown", "Render inverted on falsy");

	tmpl = "{{?isHere}}shown{{/isHere}}";
	data = {isHere:true};
	equals(M.Render(tmpl, data), "shown", "Render regular on truthy");

	// check correct context and never switch contexts
	tmpl = "{{?items}}{{item_count}} items{{/items}}";
	data = {items:['one','two'], item_count: 2};
	equals(M.Render(tmpl, data), "2 items", "if");

	tmpl = "{{!items}}sorry, no items{{/items}}";
	data = {items:[], item_count: 0};
	equals(M.Render(tmpl, data), "sorry, no items", "not");

	tmpl = "{{?items}}{{item_count}} items{{/items}}{{!items}}sorry, no items{{/items}}";
	data = {items:["A","B"], item_count: 2};
	equals(M.Render(tmpl, data), "2 items", "if / not (non-empty)");

	data = {items:[], item_count: 0};
	equals(M.Render(tmpl, data), "sorry, no items", "if / not (empty)");

	data = {item:{fake:false}, item_count: 0};
	tmpl = "{{!item.fake}}{{item_count}}{{/item.fake}}";
	equals(M.Render(tmpl, data), "0", "bool property eval");

	tmpl = "{{?items=item_count}}";
	data = {items:["A","B"], item_count: 2};
	equals(M.Render(tmpl, data), "2", "block-free shorthand syntax");

	tmpl = "{{!items.fake=babies}}";
	data = {items:{fake:false}, babies:'yes'};
	equals(M.Render(tmpl, data), "yes", "block-free shorthand w/property condition");

	tmpl = "{{?items=items.length}}";
	data = {items:["A","B"]};
	equals(M.Render(tmpl, data), "2", "block-free shorthand w/property access");

	M = new HandleBar({checkers:{isEven: function(val){return val % 2 == 0;}}});
	tmpl = "{{!isEven}}x{{/isEven}}{{?isEven=.}}";
	data = [1,2,3,4];
	equals(M.Render(tmpl, data), "x2x4", "External checkers on current context");

//	tmpl = "{{?items=item_count~money}}";
//	tmpl = "{{?items=blah.haha~money}}";
//	tmpl = "{{?items=items.length}}";
})

module('Render Tests');
// test("Context Ident", function(){})
// simple block context checks
test("{} Hashes (simple)", function(){
	var data, tmpl, M = new HandleBar();

	tmpl = "{{one}}, {{two}}!";
	data = {one:"Hello", two:"World"};
	equals(M.Render(tmpl, data), "Hello, World!", "Flat (string)");

	data = {one:100, two:-20.2};
	equals(M.Render(tmpl, data), "100, -20.2!", "Flat (numeric)");

	tmpl = "{{one}}{{A}} {{B}}{{/one}} {{two}}";
	data = {one:{A:"i am", B:"a nice"}, two:"test string"};
	equals(M.Render(tmpl, data), "i am a nice test string", "Nested hashes");

	tmpl = "{{one}}{{num}} {{anim}}\n{{/one}} {{two}} now";
	data = {one:[{num:5, anim:"bears"},{num:9, anim:"oxes"}], two:"to eat"};
	equals(M.Render(tmpl, data), "5 bears\n9 oxes\n to eat now", "Arrays within hashes");
})
// simple enumeration checks
test("[] Arrays (simple)", function(){
	var data, tmpl, M = new HandleBar();

	tmpl = "{{one}}, {{two}}!\n";
	data = [{one:"Hello", two:"World"},	{one:"Privet", two:"Zemlya"}];
	equals(M.Render(tmpl, data), "Hello, World!\nPrivet, Zemlya!\n", "Array of flat hashes");

	tmpl = "{{one}}{{three}}{{/one}} {{two}}\n";
	data = [{one:{three: "test"}, two:"stringie"},	{one:{three: "another"}, two:"string thing"}];
	equals(M.Render(tmpl, data), "test stringie\nanother string thing\n", "Array of nested hashes");

	// arrays of arrays?
})

test("~ Formatters", function(){
	function formatMoney(n, c, d, t){
		var c = isNaN(c = Math.abs(c)) ? 2 : c,
			d = d == undefined ? "." : d,
			t = t == undefined ? "," : t,
			s = n < 0 ? "-" : "",
			i = parseInt(n = Math.abs(+n || 0).toFixed(c)) + "",
			j = (j = i.length) > 3 ? j % 3 : 0;
	  return s + (j ? i.substr(0, j) + t : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t) + (c ? d + Math.abs(n - i).toFixed(c).slice(2) : "");
	}

	function ucwords(str) {
	  return (str + '').replace(/^(.)|\s(.)/g, function ($1) {
		return $1.toUpperCase();
	  });
	}

	function commalist(arr) {
		return arr.join(",");
	}

	var opts = {
		formatters: {
			asMoney: formatMoney,
			myCase: ucwords,
			commalist: commalist
		}
	}

	var data, tmpl, M = new HandleBar(opts);

	tmpl = "${{one~asMoney}} {{two~myCase}} {{three~commalist}}";
	data = {one: 4535.834, two: "john q. public", three: [1,2,3]};
	equals(M.Render(tmpl, data), "$4,535.83 John Q. Public 1,2,3", "Reformat values w/ pre-defined callbacks");

	tmpl = "{{.~commalist}}";
//	data = [1,2,3];
	data = [[1,2,3]];
	equals(M.Render(tmpl, data), "1,2,3", "Only wrapped arrays not enumed");

})

test("{{.}} Self context", function(){
	var data, tmpl, M = new HandleBar();

	tmpl = "{{.}}";
	data = [1,2,3];
	equals(M.Render(tmpl, data), "123", "Straight array {{.}}");

	tmpl = "{{items}}{{.}}{{/items}}";
	data = {items:[1,2,3]};
//	data = [1,2,3];
	equals(M.Render(tmpl, data), "123", "Array in hash {{.}}");

	var opts = {formatters: {halved: function(val) {return val/2}}};
	M = new HandleBar(opts);
	tmpl = "{{items}}{{.~halved}},{{/items}}";
	equals(M.Render(tmpl, data), "0.5,1,1.5,", "Pass to formatter {{.~halved}}");

	data = ['<br />','&'];
	tmpl = "{{{.}}";
	equals(M.Render(tmpl, data), "<br />&", "Don't escape {{{.}}");

//	tmpl = "{{items}}{{.}},{{/items}}";
//	equals(M.Render(tmpl, data), ".5,1,1.5,", "Pass to formatter leave unescaped {{{.~halved}}");
})

test("{{a.b}} Property Accessors", function(){
	var data, tmpl, M = new HandleBar();

//	tmpl = "{{.length}}";		each length?
	tmpl = "{{items.length}}";
	data = {items:[1,2,3]};
	equals(M.Render(tmpl, data), "3", "Literal");

	tmpl = "{{items.0}}";
	equals(M.Render(tmpl, data), "1", "Array index");

	tmpl = "{{item.parts}}{{a}}{{b}}{{/item.parts}}";
	data = {item: {parts:{a:1,b:2}}};
	equals(M.Render(tmpl, data), "12", "As new context (hash)");

	tmpl = "{{item.parts}}{{.}}{{/item.parts}}";
	data = {item: {parts:[1,2,3]}};
	equals(M.Render(tmpl, data), "123", "As new context (enum/this)");

	tmpl = "{{item.parts}}{{a}}{{b}}{{/item.parts}}";
	data = {item: {parts:[{a:4,b:5},{a:8,b:2}]}};
	equals(M.Render(tmpl, data), "4582", "As new context (enum/hashes)");

	tmpl = "{{item.parts}}{{length}}{{/item.parts}}";
	data = {item: {parts:[[5,3],[8,3,2]]}};
	equals(M.Render(tmpl, data), "23", "As new context (enum/arrays)");

	tmpl = "{{item.parts.motor}}";
	data = {item: {parts:{motor:'big motor'}}};
	equals(M.Render(tmpl, data), "big motor", "Drill-down property access");

	tmpl = "{{item.parts.pieces}}{{.}}{{/item.parts.pieces}}";
	data = {item:{parts:{pieces:['X','Y','Z']}}};
	equals(M.Render(tmpl, data), "XYZ", "Drill-down contexting");

	tmpl = "{{item.parts.pieces}}{{head}}{{feet}}{{.}}{{/feet}}{{/item.parts.pieces}}";
	data = {item:{parts:{pieces:{head:'h',feet:['f1','f2']}}}};
	equals(M.Render(tmpl, data), "hf1f2", "Drill-down contexting 2");

	// super maybe: add numeric enum access? {{item.parts[2]}} or {{item.parts.2}}
})

test("{{#}} Enum Key Access", function(){
	var data, tmpl, M = new HandleBar();

	tmpl = "{{#}}";
	data = ["A","B","C"];
	equals(M.Render(tmpl, data), "012", "Access to current enum position");

	tmpl = "{{items}}{{#}}{{/items}}";
	data = {items:["A","B","C"]};
	equals(M.Render(tmpl, data), "012", "Access to current enum position #2");
});


test("{{#blah}} Enum Objects", function(){
	var data, tmpl, M = new HandleBar();

	tmpl = "{{#}}: {{.}},";
	data = {A:'one', B:'two', C:'three'};
	equals(M.Render(tmpl, data, true), "A: one,B: two,C: three,", "Enumerate root context properties");

	tmpl = "{{heading}}: {{#stuff}}{{#}}: {{.}},{{/stuff}}";
	data = {heading:"My Stuff", stuff: {A:'one', B:'two', C:'three'}};
	equals(M.Render(tmpl, data), "My Stuff: A: one,B: two,C: three,", "Enumerate explicit object contexts");
});

test("Empty Values", function(){
	var data, tmpl, M = new HandleBar();

	tmpl = "{{a}}{{b}}{{c}}{{d}}{{e}}{{f}}{{g}}{{h}}";
	data = {a: false, b: null, c: undefined, d: "", e: {}, f: [], g: function() {return false}};	// functions returning any of the above
	equals(M.Render(tmpl, data), "", "ALL");

	tmpl = "{{two}}";

	data = {};
	equals(M.Render(tmpl, data), "", "Non-existent hash keys");

	data.two = undefined;
	equals(M.Render(tmpl, data), "", "Undefined values");

	data.two = false;
	equals(M.Render(tmpl, data), "", "False values");

	data.two = null;
	equals(M.Render(tmpl, data), "", "Null values");

	data.two = [];
	equals(M.Render(tmpl, data), "", "Empty hashes");

	data.two = {};
	equals(M.Render(tmpl, data), "", "Empty arrays");

	data.two = "";
	equals(M.Render(tmpl, data), "", "Empty strings");

	data.two = function(){return {}};
	equals(M.Render(tmpl, data), "", "Functions returning empties");
})

test("Blind Recursive", function(){
	var data, tmpl, M = new HandleBar({checkers:{isEnum: function(val){return typeof val == "object"}}});

//	tmpl = "{{>list}}<ul>{{#.}}<li>{{#}}:{{?isEnum}}{{>list}}{{/isEnum}}{{!isEnum=.}}</li>{{/.}}</ul>{{/list}}";

//	tmpl = "{{>list}}<ul>{{#.}}<li>{{#}}:{{?isEnum=>list}}{{!isEnum=.}}</li>{{/.}}</ul>{{/list}}";
//	tmpl += "{{>list}}";


	tmpl = "<ul>{{#.>item}}<li>{{#}}:{{?isEnum}}<ul>{{>item}}</ul>{{/isEnum}}{{!isEnum=.}}</li>{{/.}}</ul>";


	data = {
		A: 'x',
		B: ['u'],
		C: ['y','z',{h: 2, i:6}],
		D: {k:3, m:4, r:[9,3,1]}
	};

	equals(M.Render(tmpl, data), "<ul><li>A:x</li><li>B:<ul><li>0:u</li></ul></li><li>C:<ul><li>0:y</li><li>1:z</li><li>2:<ul><li>h:2</li><li>i:6</li></ul></li></ul></li><li>D:<ul><li>k:3</li><li>m:4</li><li>r:<ul><li>0:9</li><li>1:3</li><li>2:1</li></ul></li></ul></li></ul>", "Access to current enum position");

});

//module("Public Methods");
//test("Render (new)", function(){})
//test("Render (cached)", function(){})
//test("Cache", function(){})
//test("Cache", function(){})