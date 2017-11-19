import { Observable } from 'rxjs';
import { EventEmitter } from 'events';
import { Request, RequestType, Response, ResponseType, ProxyDescriptor, ProxyPropertyType } from './common';

const uuidv4 = require('uuid/v4');
const Errio = require('errio');

export function createProxy<T>(transport: EventEmitter, descriptor: ProxyDescriptor): T {
    return new Proxy({}, new ProxyClientHandler(descriptor, transport)) as T;
}

class ProxyClientHandler implements ProxyHandler<any> {
    constructor(private descriptor: ProxyDescriptor, private transport: EventEmitter) {

    }

    private makeRequest(request: Request): Promise<any> {
        const correlationId = uuidv4();
        this.transport.emit(this.descriptor.channel, request, correlationId);

        return new Promise((resolve, reject) => {
            this.transport.once(correlationId, (response: Response) => {
                switch (response.type) {
                    case ResponseType.Result:
                        return resolve(response.result);
                    case ResponseType.Error:
                        return reject(Errio.parse(response.error));
                    default:
                        throw new Error(`Unhandled response type [${response.type}]`);
                }
            });
        });
    }

    public get(target: any, p: PropertyKey, receiver: any): any {
        const propName = p as string;

        if (this.descriptor.properties[propName] === ProxyPropertyType.Function) {
            if (!target[propName]) {
                target[propName] = (...args: any[]) => this.makeRequest({ type: RequestType.Apply, name: propName, args });
            }
            return target[propName];
        }
        else if (this.descriptor.properties[propName] === ProxyPropertyType.Value) {
            return this.makeRequest({ type: RequestType.Get, name: p });
        }
        else {
            throw new Error(`property "${p}" has not been made available on the proxy object`);
        }
    }
    
    public apply(target: any, thisArg: any, argArray?: any): any {
        throw new Error('"apply" is not supported by the proxy object');
    }

    public isExtensible(target: any): boolean {
        return false;
    }
    
    public preventExtensions(target: any): boolean {
        throw new Error('"preventExtensions" is not supported by the proxy object');
    }

    public set(target: any, p: PropertyKey, value: any, receiver: any): boolean {
        throw new Error('"set" is not supported by the proxy object');
    }

    public deleteProperty(target: any, p: PropertyKey): boolean {
        throw new Error('"deleteProperty" is not supported by the proxy object');
    }
    
    public defineProperty(target: any, p: PropertyKey, attributes: PropertyDescriptor): boolean {
        throw new Error('"defineProperty" is not supported by the proxy object');
    }

    // getPrototypeOf? (target: T): object | null {
    //     throw new Error("Not supported");
    // }
    // setPrototypeOf? (target: T, v: any): boolean;
    // getOwnPropertyDescriptor? (target: T, p: PropertyKey): PropertyDescriptor | undefined;
    // has? (target: T, p: PropertyKey): boolean;
    // enumerate? (target: T): PropertyKey[];
    // ownKeys? (target: T): PropertyKey[];
    // construct? (target: T, argArray: any, newTarget?: any): object;
}