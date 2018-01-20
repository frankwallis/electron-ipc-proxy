import { Observable } from 'rxjs/Observable';
import { IpcRenderer, Event } from 'electron';
import { 
    Request, RequestType, 
    Response, ResponseType, 
    ProxyDescriptor, ProxyPropertyType 
} from './common';
import { IpcProxyError } from './utils';

const { ipcRenderer } = require('electron');
const uuidv4 = require('uuid/v4');
const Errio = require('errio');

export function createProxy<T>(descriptor: ProxyDescriptor, transport: IpcRenderer = ipcRenderer): T {
    const result = {};

    Object.keys(descriptor.properties).forEach(propKey => {
        const propertyType = descriptor.properties[propKey];

        if (propertyType === ProxyPropertyType.Value) {
            Object.defineProperty(result, propKey, {
                enumerable: true,
                get: () => makeRequest({ type: RequestType.Get, propKey }, descriptor.channel, transport)
            });
        }
        else if (propertyType === ProxyPropertyType.Value$) {
            Object.defineProperty(result, propKey, {
                enumerable: true,
                get: () => makeObservable({ type: RequestType.Subscribe, propKey }, descriptor.channel, transport)
            });
        }
        else if (propertyType === ProxyPropertyType.Function) {
            Object.defineProperty(result, propKey, {
                enumerable: true,
                get: () => (...args: any[]) => makeRequest({ type: RequestType.Apply, propKey, args }, descriptor.channel, transport)
            });
        }
        else if (propertyType === ProxyPropertyType.Function$) {
            Object.defineProperty(result, propKey, {
                enumerable: true,
                get: () => (...args: any[]) => makeObservable({ type: RequestType.ApplySubscribe, propKey, args }, descriptor.channel, transport)
            });
        }
    });

    return result as T;
}

function makeRequest(request: Request, channel: string, transport: IpcRenderer): Promise<any> {
    const correlationId = uuidv4();
    transport.send(channel, request, correlationId);

    return new Promise((resolve, reject) => {
        transport.once(correlationId, (event: Event, response: Response) => {
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

function makeObservable(request: Request, channel: string, transport: IpcRenderer): Observable<any> {
    return new Observable((obs) => {
        const subscriptionId = uuidv4();
        const subscriptionRequest = { ...request, subscriptionId };

        transport.on(subscriptionId, (event: Event, response: Response) => {
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

        makeRequest(subscriptionRequest, channel, transport)
            .catch((err: Error) => {
                console.log('Error subscribing to remote observable', err);                    
                obs.error(err);
            });

        return () => {
            transport.removeAllListeners(subscriptionId);
            makeRequest({ type: RequestType.Unsubscribe, subscriptionId }, channel, transport)
                .catch(err => {
                    console.log('Error unsubscribing from remote observale', err);
                    obs.error(err);
                });
        };
    });
}

export { ProxyDescriptor, ProxyPropertyType }