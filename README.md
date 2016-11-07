
# joi-validate-patch

[![version][version-img]][version-url]
[![npm][npmjs-img]][npmjs-url]
[![build status][travis-img]][travis-url]
[![Coveralls][coveralls-img]][coveralls-url]
[![deps status][daviddm-img]][daviddm-url]
[![mit license][license-img]][license-url]

JoiValidatePatch is a node library which validates that operations in a JSON patch
document fit within a Joi validation schema describing a document structure.  Validation
is performed using only the schema, independently from the document(s) to be modified.

Note: only validation of independent values can be meaningfully supported.

The primary use-case is for simple schemas covering the basics of sanity validation
when accepting a JSON patch to be converted into some other form of dynamic operation
where loading the documents, applying the patch, and validating the result is impractical.
The typical example would be updating a mongo store or relational database

Within the limitations of the use-case, some validations are easy (can the path
of the operation exist in the schema?), others are challenging (if moving content
from one path to another, are the schema rules compatible?), and others still are
impossible (if two paths have interdependent rules, will they still be satisfied
when changing one of those paths?).  JoiValidatePatch only handles the easy rules
and leaves the rest up to custom solutions.  It can however sidestep some complexities
by simply receiving a subset of the true document schema, consisting only of the
paths that are safe to independently modify and/or covered by additional validation
logic elsewhere.


## Basic Usage

Validating a patch document against a Joi schema:
```js
const
    Joi = require('joi'),
    JVPatch = require('joi-validate-patch');

const schema = Joi.object().keys({
    id: Joi.string().guid().required().label('id'),
    name: Joi.string().required().label('name'),
    description: Joi.string().optional().label('description'),
    favoriteToys: Joi.array().items(Joi.string().label('toy')).default([]).label('favoriteToys'),
    meta: {
        born: Joi.date().required().label('born'),
        weight: Joi.number().positive().unit('pounds').label('weight')
    }
}).label('cat');

const patch = [
    {op: 'replace', path: '/name', value: 'Tigger'},
    {op: 'add', path: '/favoriteToys/-', value: 'laser pointer'},
];

const result = JVPatch.validate(patch, schema);

if(result.error) throw result.error;

const normalizedPatch = result.value;
```

## API

#### lib.ValidationError(message, details) ⇒ ValidationError

Constructor for custom error class.  Takes on the properties of a patch
step passed into it, or adds an `errors` property aggregating sub-errors.

Params:
 - string message
 - object details (optional single JSON patch operation or {errors: [ValidationError, ...]})

Returns: ValidationError

#### lib.validate(patchDocs, joiSchema, [options], [callback]) ⇒ {error: ValidationError|null, value: normalizedPatchDocs}

Main library method, performs validation against a Joi schema like Joi, but
accepts a json-patch item or array rather than the actual document.

Maintains consistency with Joi.validate signature and behavior (even down to the
non-async callback support).

Params:
 - array patchDocs (array of objects describing JSON patch operations)
 - object joiSchema
 - object options
   - abortEarly (default true)
   - allowedOps (array of strings for allowed patch operation types - default all)
   - allowUnknown (default false)
   - convert (default true)
 - function callback (if provided, called with error, value instead of returning an object)

Returns: `{error: ValidationError|null, value: [patchOperation, ...]}`

[version-url]: https://github.com/evan-king/joi-validate-patch/releases
[version-img]: https://img.shields.io/github/release/evan-king/joi-validate-patch.svg?style=flat

[npmjs-url]: https://www.npmjs.com/package/joi-validate-patch
[npmjs-img]: https://img.shields.io/npm/v/joi-validate-patch.svg?style=flat

[coveralls-url]: https://coveralls.io/r/evan-king/joi-validate-patch?branch=master
[coveralls-img]: https://img.shields.io/coveralls/evan-king/joi-validate-patch.svg?style=flat

[license-url]: https://github.com/evan-king/joi-validate-patch/blob/master/LICENSE
[license-img]: https://img.shields.io/badge/license-MIT-blue.svg?style=flat

[travis-url]: https://travis-ci.org/evan-king/joi-validate-patch
[travis-img]: https://img.shields.io/travis/evan-king/joi-validate-patch.svg?style=flat

[daviddm-url]: https://david-dm.org/evan-king/joi-validate-patch
[daviddm-img]: https://img.shields.io/david/evan-king/joi-validate-patch.svg?style=flat
