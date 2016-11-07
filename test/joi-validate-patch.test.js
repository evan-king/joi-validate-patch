"use strict";

const
    Joi = require('joi'),
    JVPatch = require('../index'),
    validate = JVPatch.validate,
    expect = require('chai').expect;

const testSchema = {
    id: Joi.string().guid().required().label('id'),
    name: Joi.string().required().label('name'),
    description: Joi.string().optional().label('description'),
    favoriteToys: Joi.array().items(Joi.string().label('toy')).default([]).label('favoriteToys'),
    meta: Joi.object().keys({
        born: Joi.date().required().label('born'),
        current: {
            weight: Joi.number().optional().positive().unit('pounds').label('weight')
        }
    })
};

const testDoc = {
    id: '230b3b0f-3c17-4827-a3a5-eeb924c88840',
    name: 'whiskers',
    favoriteToys: [],
    meta: {born: new Date()}
}


const patchProps = {
    add: ['path', 'value'],
    remove: ['path'],
    replace: ['path', 'value'],
    copy: ['from', 'path'],
    move: ['from', 'path'],
    test: ['path', 'value']
};

function asArray(arg) {
    if(!arg) return [];
    return Array.isArray(arg) ? arg : [arg];
}

function matchError(obj, msg) {
    expect(obj).instanceOf(Error);
    if(msg !== true) expect(obj.message).contain(msg);
}

function test(patch, match, errors, options) {
    if(match) match = asArray(match);
    errors = asArray(errors);
    
    const result = validate(patch, testSchema, options);
    expect(typeof result).eql('object');
    expect(result).keys('value', 'error');
    
    if(errors.length == 1) {
        matchError(result.error, errors[0]);
    } else if(errors.length > 1) {
        expect(result.error.errors).lengthOf(errors.length);
        for(let i = 0; i < errors.length; i++) {
            matchError(result.error.errors[i], errors[i]);
        }
    } else {
        expect(result.error).not.exist;
    }
    
    if(match) expect(result.value).eql(match);
}


describe('JoiValidatePatch', function() {
    
    it('rejects non-patch inputs', function() {
        test('blah', null, true);
        test(null, null, true);
        test(5, null, true);
    });
    
    it('rejects empty patches', function() {
        test([], null, 'empty patch'); 
    });
    
    it('validates step properties', function() {
        Object.keys(patchProps).forEach(function(type) {
            const patch = {op: type};
            patchProps[type].forEach(function(prop) {
                test(patch, null, true);
                patch[prop] = '/description';
            });
            
            test(patch, patch);
        });
    });
    
    it('validates paths', function() {
        const
            validSimplePath = {op: 'replace', path: '', value: testDoc},
            validDeepPath =  {op: 'remove', path: '/meta/current/weight'},
            validArrayPath =  {op: 'remove', path: '/favoriteToys'},
            validArrayItemPath =  {op: 'remove', path: '/favoriteToys/0'},
            validArrayAppendPath =  {op: 'add', path: '/favoriteToys/-', value: 'emu'},
            invalidFrom = {op: 'move', from: '/blah', path: '/description'},
            invalidPath = {op: 'remove', path: '/blah'};
        
        test(validSimplePath, validSimplePath);
        test(validDeepPath, validDeepPath);
        test(validArrayPath, validArrayPath);
        test(validArrayItemPath, validArrayItemPath);
        test(validArrayAppendPath, validArrayAppendPath);
        test(invalidFrom, null, 'invalid source');
        test(invalidPath, null, 'invalid path');
    });
    
    it('validates path contents', function() {
        test({op: 'add', path: '/description', value: new Date()}, null, true);
        test({op: 'add', path: '/description', value: 'string'}, null, false);
        
        test({op: 'add', path: '/meta/current/weight', value: 'blah'}, null, true);
        test({op: 'add', path: '/description', value: '5'}, null, false);
        
        test({op: 'add', path: '/id', value: 'blah'}, null, true);
        test({op: 'add', path: '/id', value: testDoc.id}, null, false);
    });
    
    it('normalizes path contents', function() {
        
        // Numeric conversion
        test(
            {op: 'add', path: '/meta/current/weight', value: '4'},
            {op: 'add', path: '/meta/current/weight', value: 4}
        );
        
        // Date conversion
        const
            patch = {op: 'add', path: '/meta/born', value: testDoc.meta.born.toString()},
            result = validate(patch, testSchema);
        
        expect(result.value[0].value).instanceOf(Date);
    });
    
    it('prevents clearing required fields', function() {
        test({op: 'remove', path: '/meta/current/weight'}, null, false);
        test({op: 'remove', path: '/id'}, null, true);
        test({op: 'move', from: '/id', path: '/description'}, null, true);
    });
    
    it('accepts a callback', function(done) {
        const
            pass = {op: 'add', path: '/description', value: 'blah'},
            fail = {op: 'remove', path: '/id'};
        
        let callcount = 3;
        function dec() {
            callcount--;
            if(callcount <= 0) done();
        }
        
        // passing
        const result = validate(pass, testSchema, function(err, value) {
            expect(err).not.exist;
            expect(value).eql([pass]);
            dec();
        });
        expect(result).not.exist;
        
        // failing
        validate(fail, testSchema, function(err, value) {
            expect(err).instanceOf(Error);
            dec();
        });
        
        // failing with options
        validate(fail, testSchema, {}, function(err, value) {
            expect(err).instanceOf(Error);
            dec();
        });
        
    });
    
    describe('options', function() {
        
        it('allowUnknown accepts out-of-schema paths', function() {
            const
                invalidFrom = {op: 'move', from: '/blah', path: '/description'},
                invalidPath = {op: 'remove', path: '/blah'};
            
            test(invalidFrom, invalidFrom, null, {allowUnknown: true});
            test(invalidPath, invalidPath, null, {allowUnknown: true});
        });
        
        it('allowedOps restricts operations', function() {
            test({op: 'test', path: '', value: ''}, null, 'disallowed', {allowedOps: ['add']});
        }); 
        
        it('abortEarly allows gathering all errors', function() {
            const result = validate([
                {op: 'move', from: '/blah', path: '/description'},
                {op: 'replace', path: '/meta/current/weight', value: 4},
                {op: 'remove', path: '/blah'}
            ], testSchema, {abortEarly: false});
            
            expect(result.error).instanceOf(Error);
            expect(result.error.errors).an('array').lengthOf(2);
        });
        
        it('convert allows disabling normalization (validation will fail)', function() {
            const patch = {op: 'replace', path: '/meta/current/weight', value: '4'};
            test(patch, null, true, {convert: false});
            test(patch, null, false, {convert: true});
        });
        
    });
    
});
