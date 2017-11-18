import test from 'ava';
import { EventEmitter } from 'events';
import { registerProxy } from '../src/server';
import { createProxy } from '../src/client';

const proxiedObject = {
    stringMemberSync: 'a string',
    stringMemberAsync: Promise.resolve('a string promise'),
    throwErrorSync: () => { throw new Error('an error'); },
    throwErrorAsync: () => { return Promise.resolve(new Error('a rejection')); },
    addSync: (num1: number, num2: number) => num1 + num2,
    addAsync: (num1: number, num2: number) => Promise.resolve(num1 + num2),
}

interface ProxyObject {
    stringMemberSync: Promise<string>;
    stringMemberAsync: Promise<string>;
    throwErrorSync(): Promise<any>;
    throwErrorAsync(): Promise<any>;
    addSync(num1: number, num2: number): Promise<number>;
    addAsync(num1: number, num2: number): Promise<number>;
    newProperty: number;
}

const eventEmitter = new EventEmitter();
const server = registerProxy(proxiedObject, 'channelName', eventEmitter);
const client = createProxy<ProxyObject>('channelName', eventEmitter);

test('returns string property', async t => {
    t.is(await client.stringMemberSync, 'a string');
});

test('returns string property from promise', async t => {
    t.is(await client.stringMemberAsync, 'a string promise');
});

// test('returns errors thrown syncronously', async t => {
//     t.throws(client.throwErrorSync(), 'an error');
// });

// test('returns string promise member', async t => {
//     t.throws(client.throwErrorAsync(), 'a rejection');
// });

// test('calls function which returns result syncronously', async t => {
//     t.is(await client.addSync(4, 5), 9);
// });

// test('calls function which returns a promise', async t => {
//     t.is(await client.addAsync(4, 7), 11);
// });

test('throws when trying to set property', async t => {
    //client.newProperty = 12;
    t.throws(() => client.newProperty = 12);
});
