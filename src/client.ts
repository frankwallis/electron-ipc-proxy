import { Observable } from 'rxjs/Observable';
import { IpcRenderer, Event } from 'electron';
import { Request, RequestType, Response, ResponseType, ProxyDescriptor, ProxyPropertyType } from './common';

const uuidv4 = require('uuid/v4');
const Errio = require('errio');

export function createProxy<T>(transport: IpcRenderer, descriptor: ProxyDescriptor): T {
    return new Proxy({}, new ProxyClientHandler(descriptor, transport)) as T;
}

class ProxyClientHandler implements ProxyHandler<any> {
    constructor(private descriptor: ProxyDescriptor, private transport: IpcRenderer) {}

    private makeRequest(request: Request): Promise<any> {
        const correlationId = uuidv4();
        this.transport.send(this.descriptor.channel, request, correlationId);

        return new Promise((resolve, reject) => {
            this.transport.once(correlationId, (event: Event, response: Response) => {
                switch (response.type) {
                    case ResponseType.Result:
                        return resolve(response.result);
                    case ResponseType.Error:
                        return reject(Errio.parse(response.error));
                    default:
                        return reject(new Error(`Unhandled response type [${response.type}]`));
                }
            });
        });
    }

    private makeObservable(propKey: string): Observable<any> {
        return new Observable((obs) => {
            const subscriptionId = uuidv4();
    
            this.transport.on(subscriptionId, (event: Event, response: Response) => {
                switch (response.type) {
                    case ResponseType.Next:
                        return obs.next(response.value);
                    case ResponseType.Error:
                        return obs.error(Errio.parse(response.error));
                    case ResponseType.Complete:
                        return obs.complete();
                    default:
                        return obs.error(new Error(`Unhandled response type [${response.type}]`));
                }
            });

            this.makeRequest({ type: RequestType.Subscribe, propKey, subscriptionId })
                .catch((err: Error) => {
                    console.log('Error subscribing to remote stream', err);                    
                    obs.error(err);
                });

            return () => {
                this.transport.removeAllListeners(subscriptionId);
                this.makeRequest({ type: RequestType.Unsubscribe, subscriptionId })
                    .catch(err => {
                        console.log('Error unsubscribing from remote stream', err);
                        obs.error(err);
                    });
            };
        });
    }

    public get(target: any, p: PropertyKey, receiver: any): any {
        const propKey = p as string;

        if (this.descriptor.properties[propKey] === ProxyPropertyType.Function) {
            if (!target[propKey]) {
                target[propKey] = (...args: any[]) => this.makeRequest({ type: RequestType.Apply, propKey, args });
            }
            return target[propKey];
        }
        else if (this.descriptor.properties[propKey] === ProxyPropertyType.Observable) {
            if (!target[propKey]) {
                target[propKey] = this.makeObservable(propKey);
            }
            return target[propKey];
        }
        else if (this.descriptor.properties[propKey] === ProxyPropertyType.Value) {
            return this.makeRequest({ type: RequestType.Get, propKey });
        }
        else {
            throw new Error(`property "${propKey}" has not been made available on the proxy object`);
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

export { ProxyDescriptor, ProxyPropertyType }