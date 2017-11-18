import { Observable } from 'rxjs';
import { EventEmitter } from 'events';
import { Request, RequestType, Response, ResponseType } from './common';

const uuidv4 = require('uuid/v4');

export function createProxy<T>(channel: string, transport: EventEmitter): T {
    return new Proxy({}, new ProxyClientHandler<T>(channel, transport)) as T;
}

class ProxyClientHandler<T extends Object> implements ProxyHandler<T> {
    constructor(private channel: string, private transport: EventEmitter) {

    }

    private makeRequest(request: Request): Promise<any> {
        const correlationId = uuidv4();
        this.transport.emit(this.channel, request, correlationId);

        return new Promise((resolve, reject) => {
            this.transport.once(correlationId, (response: Response) => {
                switch (response.type) {
                    case ResponseType.Result:
                        return resolve(response.result);
                    case ResponseType.Error:
                        return reject(response.error);
                    default:
                        throw new Error(`Unhandled response type [${response.type}]`);
                }
            });
        });
    }

    public get(target: T, p: PropertyKey, receiver: any): any {
        return this.makeRequest({ type: RequestType.Get, name: p });
    }
    
    public apply(target: T, thisArg: any, argArray?: any): any {
        return this.makeRequest({ type: RequestType.Apply, name: 'a', args: argArray });
    }

    public isExtensible(target: T): boolean {
        return false;
    }
    
    public set(target: T, p: PropertyKey, value: any, receiver: any): boolean {
        throw new Error('"set" is not supported by the proxy object');
    }

    // getPrototypeOf? (target: T): object | null {
    //     throw new Error("Not supported");
    // }
    // setPrototypeOf? (target: T, v: any): boolean;
    // isExtensible? (target: T): boolean;
    // preventExtensions? (target: T): boolean;
    // getOwnPropertyDescriptor? (target: T, p: PropertyKey): PropertyDescriptor | undefined;
    // has? (target: T, p: PropertyKey): boolean;
    // deleteProperty? (target: T, p: PropertyKey): boolean;
    // defineProperty? (target: T, p: PropertyKey, attributes: PropertyDescriptor): boolean;
    // enumerate? (target: T): PropertyKey[];
    // ownKeys? (target: T): PropertyKey[];
    // construct? (target: T, argArray: any, newTarget?: any): object;
}