there are no docs yet. however, there are unit tests in the repo that cover all functionality, check out the source for all the goodness. hopefully the unit test names are somewhat intuitive.

one thing i will mention is that handlebar.js templates will not be compatible with the regular mustache. i'm not sure that this was the best decision on my part since no one will use it if they have to redo all their templates which can then not be parsed by other ready-made ports. however, the slightly altered and expanded syntax allows for many benefits in clarity and features over the original. if you're familiar with mustache syntax already, here's an overview of some changes:

- tags remain the same: {{price}}
- unescaped stays the same: {{{myHtml}}
- you can drill down: {{motor.parts.crankshaft.diameter}}
- blocks no longer have #, since they're always indicated by closing tags, like in HTML: {{pets}}{{/pets}}. these blocks will always change context
- conditional blocks must be indicated explicitly: {{goodPrice?}}price is good{{/goodPrice}} and {{goodPrice!}}no so good price{{/goodPrice}} these blocks will never change context
- the above conditional opening tags are actually just shortcuts to {{goodPrice?isTruthy}} and {{goodPrice!isTruthy}}, thus you can register and pass your own functions like {{weight?overLimit}}{{/weight}}
- furthermore, there's a shorthand output method so you dont need to write conditional and drill-down blocks all the time {{person.weight?overLimit=overClass}}{{person.weight!overLimit=underClass}}
- you can pass values to formatting functions. {{price~asMoney}}
- partials are now a full-blown block cache. {{>myItem}} will output the block in the current context, {{items>myItem}} will output the block in the context of items, {{>myItem}}blah!{{/myItem}} will cache the contents as "myItem" {{items>myItem}}blah{{/items}} will cache the block which makes it available for reuse later and at the same time applies it to the items context.
- a root template node and object wrapper with lookup key is no longer required for enumerated blocks.
- {{.}} refers to current context
- {{#}} refers to the key or index inside enumerated blocks
- {{#myObj}}{{/myObj}} will force enumerate object properties as well as arrays, so {{#}} becomes key/index, {{.}} becomes value.
- you can self close tags like in HTML if you have something like {{items}}{{items}}{{/items}} where nesting becomes ambiguous. eg: {{items/}}{{items}}{{/items}}

features which i felt were too much for a templating language and did not implement.
- pragmas
- in-template delimiter switching
- higher order sections

i think that covers most of the important stuff for now. message me with any questions/comments.

thanks.