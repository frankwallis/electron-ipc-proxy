import test from 'ava';
import { Observable } from 'rxjs';
import { ProxyPropertyType, IpcProxyError } from '../src/common';
import { registerProxy } from '../src/server';
import { createProxy } from '../src/client';
import { mockIpc, delay } from './_mocks';

const proxiedObject = {
    stringMemberSync: 'a string',
    stringMemberAsync: Promise.resolve('a string promise'),
    throwErrorSync: () => { throw new Error('an error'); },
    throwErrorAsync: () => { return Promise.reject(new Error('a rejection')); },
    addSync: (num1: number, num2: number) => num1 + num2,
    addAsync: (num1: number, num2: number) => Promise.resolve(num1 + num2),
    observableProp: Observable.of(1, 2, 3),
    observableHot: Observable.interval(100),
    observableError: Observable.throw(new Error('error on stream')),
    privateProperty: 42
}

interface ProxyObject {
    stringMemberSync: Promise<string>;
    stringMemberAsync: Promise<string>;
    throwErrorSync(): Promise<any>;
    throwErrorAsync(): Promise<any>;
    addSync(num1: number, num2: number): Promise<number>;
    addAsync(num1: number, num2: number): Promise<number>;
    observableProp: Observable<number>;
    observableError: Observable<any>;
    observableHot: Observable<any>;
    privateProperty: Promise<number>;
    missingFunction: () => Promise<number>;
    newProperty: number;
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
        observableProp: ProxyPropertyType.Observable,
        observableError: ProxyPropertyType.Observable,
        observableHot: ProxyPropertyType.Observable,
        missingFunction: ProxyPropertyType.Function
    }
};

const { ipcMain, ipcRenderer } = mockIpc();
const unregister = registerProxy(proxiedObject, descriptor, ipcMain);
const client = createProxy<ProxyObject>(descriptor, ipcRenderer);

test('returns string property', async t => {
    t.is(await client.stringMemberSync, 'a string');
});

test('returns string property from promise', async t => {
    t.is(await client.stringMemberAsync, 'a string promise');
});

test('returns errors thrown synchronously', t => {
    return t.throws(client.throwErrorSync(), 'an error');
});

test('returns string promise member', t => {
    return t.throws(client.throwErrorAsync(), 'a rejection');
});

test('calls function which returns result synchronously', async t => {
    t.is(await client.addSync(4, 5), 9);
});

test('calls function which returns a promise', async t => {
    t.is(await client.addAsync(4, 7), 11);
});

test('returns observable property', async t => {
    t.deepEqual(await client.observableProp.toArray().toPromise(), [1, 2, 3]);
});

test('handles observable errors', async t => {
    return t.throws(client.observableError.toPromise());
});

test('handles hot observable streams', async t => {
    return t.is(await client.observableHot.bufferTime(250).take(1).toPromise().then(arr => arr.length), 2);
});

test('unsubscribes from hot observable streams', async t => {
    let counter = 0;
    const subscription = client.observableHot.subscribe(() => counter++);
    await delay(250);
    t.is(counter, 2);
    subscription.unsubscribe()
    await delay(250);
    t.is(counter, 2);
});

test('automatically unsubscribes when renderer emits "destroyed" event', async t => {
    let counter = 0;
    const subscription = client.observableHot.subscribe(() => counter++);
    await delay(250);
    t.is(counter, 2);
    ipcRenderer.emit('destroyed');
    await delay(250);
    t.is(counter, 2);
});

/* Programmer errors */

test('throws when trying to set property', t => {
    return t.throws(() => client.newProperty = 12);
});

test('throws when trying to access a property which has not been exposed', t => {
    return t.throws(() => client.privateProperty);
});

test('throws when trying to call a function which does not exist', t => {
    return t.throws(client.missingFunction());
});

test('shows "IpcProxyError" in the output', t => {
    return t.is(new IpcProxyError('some message').toString(), 'IpcProxyError: some message');
});

test('shows "IpcProxyError" in the remote output', t => {
    return client.missingFunction()
        .then(() => t.fail('unexpected resolve'))
        .catch(err => t.is(err.toString(), 'IpcProxyError: Remote property [missingFunction] is not a function'));
});

