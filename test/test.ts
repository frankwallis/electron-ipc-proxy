import test from 'ava';
import { EventEmitter } from 'events';
import { ProxyPropertyType } from '../src/common';
import { registerProxy } from '../src/server';
import { createProxy } from '../src/client';

const proxiedObject = {
    stringMemberSync: 'a string',
    stringMemberAsync: Promise.resolve('a string promise'),
    throwErrorSync: () => { throw new Error('an error'); },
    throwErrorAsync: () => { return Promise.reject(new Error('a rejection')); },
    addSync: (num1: number, num2: number) => num1 + num2,
    addAsync: (num1: number, num2: number) => Promise.resolve(num1 + num2),
    privateProperty: 42
}

interface ProxyObject {
    stringMemberSync: Promise<string>;
    stringMemberAsync: Promise<string>;
    throwErrorSync(): Promise<any>;
    throwErrorAsync(): Promise<any>;
    addSync(num1: number, num2: number): Promise<number>;
    addAsync(num1: number, num2: number): Promise<number>;
    newProperty: number;
    privateProperty: Promise<number>;
    missingFunction: () => Promise<number>;
}

const descriptor = {
    channel: 'channelName',
    properties: {
        stringMemberSync: ProxyPropertyType.Value,
        stringMemberAsync: ProxyPropertyType.Value,
        throwErrorSync: ProxyPropertyType.Function,
        throwErrorAsync: ProxyPropertyType.Function,
        addSync: ProxyPropertyType.Function,
        addAsync: ProxyPropertyType.Function,
        missingFunction: ProxyPropertyType.Function
    }
};

const eventEmitter = new EventEmitter();
const server = registerProxy(eventEmitter, proxiedObject, descriptor);
const client = createProxy<ProxyObject>(eventEmitter, descriptor);

test('returns string property', async t => {
    t.is(await client.stringMemberSync, 'a string');
});

test('returns string property from promise', async t => {
    t.is(await client.stringMemberAsync, 'a string promise');
});

test('returns errors thrown syncronously', t => {
    return t.throws(client.throwErrorSync(), 'an error');
});

test('returns string promise member', t => {
    return t.throws(client.throwErrorAsync(), 'a rejection');
});

test('calls function which returns result syncronously', async t => {
    t.is(await client.addSync(4, 5), 9);
});

test('calls function which returns a promise', async t => {
    t.is(await client.addAsync(4, 7), 11);
});

test('throws when trying to set property', t => {
    return t.throws(() => client.newProperty = 12);
});

test('throws when trying to access a property which has not been exposed', t => {
    return t.throws(() => client.privateProperty);
});

test('throws when trying to call a function which does not exist', t => {
    return t.throws(client.missingFunction());
});
