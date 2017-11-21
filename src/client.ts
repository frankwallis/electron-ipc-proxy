import { Observable } from 'rxjs/Observable';
import { IpcRenderer, Event } from 'electron';
import { Request, RequestType, Response, ResponseType, ProxyDescriptor, ProxyPropertyType, IpcProxyError } from './common';

const { ipcRenderer } = require('electron');
const uuidv4 = require('uuid/v4');
const Errio = require('errio');

export function createProxy<T>(descriptor: ProxyDescriptor, transport: IpcRenderer = ipcRenderer): T {
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
                        return reject(new IpcProxyError(`Unhandled response type [${response.type}]`));
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
                        return obs.error(new IpcProxyError(`Unhandled response type [${response.type}]`));
                }
            });

            this.makeRequest({ type: RequestType.Subscribe, propKey, subscriptionId })
                .catch((err: Error) => {
                    console.log('Error subscribing to remote observable', err);                    
                    obs.error(err);
                });

            return () => {
                this.transport.removeAllListeners(subscriptionId);
                this.makeRequest({ type: RequestType.Unsubscribe, subscriptionId })
                    .catch(err => {
                        console.log('Error unsubscribing from remote observale', err);
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
            throw new IpcProxyError(`Local property "${propKey}" has not been made available on the proxy object`);
        }
    }
    
    public isExtensible(target: any): boolean {
        return false;
    }
    
    private throwUnsupported(name: string): any {
        throw new IpcProxyError(`"${name}" is not supported by the proxy object`);
    }
    
    public set = () => this.throwUnsupported('set');
    public apply = () => this.throwUnsupported('apply');
    public deleteProperty = () => this.throwUnsupported('deleteProperty');
    public defineProperty = () => this.throwUnsupported('defineProperty');
    public getPrototypeOf = () => this.throwUnsupported('getPrototypeOf');
    public setPrototypeOf = () => this.throwUnsupported('setPrototypeOf');
    public getOwnPropertyDescriptor = () => this.throwUnsupported('getOwnPropertyDescriptor');
    public has = () => this.throwUnsupported('has');
    public enumerate = () => this.throwUnsupported('enumerate');
    public ownKeys = () => this.throwUnsupported('ownKeys');
    public preventExtensions = () => this.throwUnsupported('preventExtensions');
    public construct = () => this.throwUnsupported('construct');
}

export { ProxyDescriptor, ProxyPropertyType }