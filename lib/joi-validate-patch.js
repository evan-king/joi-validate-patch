"use strict";

const
    util = require('util'),
    jsonpatch = require('fast-json-patch'),
    Joi = require('joi');


const
    supportMap = {
        add: ['path', 'value'],
        remove: ['path'],
        replace: ['path', 'value'],
        copy: ['from', 'path'],
        move: ['from', 'path'],
        test: ['path', 'value']
    },
    defaultOptions = {
        abortEarly: true,
        allowedOps: Object.keys(supportMap),
        allowUnknown: false,
        convert: true
    };

// Custom error class
class ValidationError extends Error {
    constructor(message, patchStep) {
        super(message);
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
        
        if(!patchStep) return;
        
        ['op', 'from', 'path', 'value', 'errors'].forEach(addProp.bind(this, patchStep));
        if(this.path) this.path = this.path.replace('/', '.').substr(1);
    }
}
exports.ValidationError = ValidationError;
        
function addProp(patchStep, prop) {
    if(patchStep[prop]) this[prop] = patchStep[prop];
}

function getValidator(schema, pointer) {
    const parts = (pointer || '').split('/').splice(1);
    
    let cursor = schema;
    parts.forEach(function(key) {
        if(!cursor) return false;
        
        // support schemas not wholly wrapped in Joi
        if(!cursor.isJoi) return cursor = cursor[key];
        
        // indexing into arrays only supported when there's exactly one
        // rule - constraints on the array itself when altering its
        // contents also cannot be supported
        if(cursor._type == 'array') {
            return cursor = (cursor._inner.items.length == 1)
                ? cursor._inner.items[0]
                : undefined;
        }
        
        const child = cursor._inner.children.find(obj => obj.key == key);
        cursor = child ? child.schema : null;
    });
    
    return cursor;
}

function isArrayPath(path) {
    return false;
}

function validateStep(schema, options, step) {
    const
        fail = msg => { return {error: new ValidationError(msg, step), value: null}; },
        pass = () => { return {error: null, value: clean}; };
    
    const formatErr = jsonpatch.validate([step]);
    if(formatErr) return fail(new ValidationError(formatErr.message));
    
    const
        opts = Object.assign({}, options),
        clean = Object.assign({}, step),
        rule = getValidator(schema, step.path),
        allowed = opts.allowedOps;
    
    // Joi rejects unknown configuration options
    delete opts.allowedOps;
    
    if(allowed.indexOf(step.op) < 0) return fail(`disallowed op ${step.op}`);
    if(!rule && !opts.allowUnknown) return fail(`invalid path ${step.path}`);
    
    if(step.from) {
        const source = getValidator(schema, step.from);
        if(!source && !opts.allowUnknown) return fail(`invalid source ${step.path}`);
        
        if(source && step.op == 'move') {
            const result = Joi.validate(undefined, source, opts);
            if(result.error) return fail(result.error.toString());
        }
    }
    
    // TODO: handle specialized details of insert in array (add op with path ending in int or '-')
    //       (or are there none?)
    if(step.op == 'add' && isArrayPath(step.path)) {
        
    }
    
    if(rule && step.op == 'remove') {
        const result = Joi.validate(undefined, rule, opts);
        if(result.error) return fail(result.error.toString());
    }
    
    // validate and normalize value
    if(rule && step.value) {
        const result = Joi.validate(step.value, rule, opts);
        
        clean.value = result.value;
        if(result.error) return fail(result.error.toString());
    }
    
    return pass();
}


/**
 * validate
 * 
 * Validates a json patch according to a schema for the document(s) to be patched.
 * Also sanitizes the values in the patch the same way Joi would for a document.
 * 
 * Mirrors Joi's validate interface, down to the optional callback yet lack of
 * async support.
 * 
 * @param array patch A valid JSON patch array
 * @param object schema A Joi validation schema
 * @param function cb Optional standard node callback - if excluded {error: *, value: patch} is returned
 * @return a data-sanitized version of the json patch
 */
exports.validate = function(patch, schema, options, cb) {
    
    // normalize arguments
    if(!Array.isArray(patch)) patch = [patch];
    if(!cb && typeof options == 'function') {
        cb = options;
        options = {};
    }
    options = Object.assign({}, defaultOptions, options || {});
    
    const sanitized = [], errors = [];
    
    if(!patch || !patch[0]) {
        errors.push(new ValidationError('empty patch'));
        patch = [];
    }
    
    patch.every(function(step) {
        const result = validateStep(schema, options, step);
        
        if(result.value) sanitized.push(result.value);
        
        if(result.error) {
            errors.push(result.error);
            if(options.abortEarly) return false;
        }
        return true;
    });
    
    // encapsulate failures in a single error
    const err = errors.length == 1
        ? errors[0]
        : errors.length > 1
            ? new ValidationError('patch invalid', {errors: errors})
            : null;
    
    if(cb) {
        cb(err, sanitized);
    } else {
        return {error: err, value: sanitized};
    }
}
