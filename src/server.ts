import { Observable } from 'rxjs';
import { EventEmitter } from 'events';
import { Request, RequestType, Response, ResponseType, ProxyDescriptor } from './common';

const Errio = require('errio');

const registrations: any = {};

export function registerProxy<T>(transport: EventEmitter, target: T, descriptor: ProxyDescriptor): VoidFunction {
    const { channel } = descriptor;
    
    if (registrations[channel]) {
        throw new Error(`Channel ${channel} as already been registered`);
    }
    
    registrations[channel] = target;
    transport.on(channel, (request: Request, correlationId: string) => {
        handleRequest(target, request)
            .then(response => transport.emit(correlationId, response));
    });

    return () => unregisterProxy(channel);
}

function unregisterProxy(channel: string) {
    const registration = registrations[channel];

    if (!registration) {
        throw new Error(`Channel ${channel} is not registered`);
    }

    registration.transport.removeAllListeners(channel);
    registrations[channel] = null;
}

async function handleRequest(target: any, request: Request): Promise<Response> {
    try {
        const result = performRequest(target, request); 
        const response = await getResponse(result);
        return response;
    }
    catch (err) {
        return { type: ResponseType.Error, error: Errio.stringify(err) };
    }
}

function performRequest(target: any, request: Request): any {
    switch (request.type) {
        case RequestType.Get:
            return target[request.name];
        case RequestType.Apply:
            return target[request.name](...request.args);
        default:
            throw new Error(`Unhandled RequestType [${request.type}]`);
    }
}

async function getResponse(result: any): Promise<Response> {
    if (isObservable(result)) {
        throw new Error('Not supported');
        //return { type: 'observable', result };
    }
    else if (isPromise(result)) {
        return getResponse(await result);
    }
    else if (isFunction(result)) {
        throw new Error('Not supported');
    }
    else {
        return { type: ResponseType.Result, result };
    }
}

function isFunction(value: any): value is Function {
    return value && typeof value === 'function';
}

function isObservable<T>(value: any): value is Observable<T> {
    return value && typeof value.subscribe === 'function'
}

function isPromise<T>(value: any): value is Promise<T> {
    return value && typeof value.subscribe !== 'function' && typeof value.then === 'function';
}