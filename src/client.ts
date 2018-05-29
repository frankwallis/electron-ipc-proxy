import { Observable } from 'rxjs';
import { IpcRenderer, ipcRenderer, Event } from 'electron';
import uuidv4 from 'uuid/v4';
import Errio from 'errio';
import { IpcProxyError } from './utils';
import { 
    Request, RequestType, 
    Response, ResponseType, 
    ProxyDescriptor, ProxyPropertyType 
} from './common';

export function createProxy<T>(descriptor: ProxyDescriptor, transport: IpcRenderer = ipcRenderer): T {
    const result = {};

    Object.keys(descriptor.properties).forEach(propKey => {
        const propertyType = descriptor.properties[propKey];

        Object.defineProperty(result, propKey, {
            enumerable: true,
            get: memoize(() => getProperty(propertyType, propKey, descriptor.channel, transport))
        });
    });

    return result as T;
}

function getProperty(propertyType: ProxyPropertyType, propKey: string, channel: string, transport: IpcRenderer) {
    switch (propertyType) {
        case ProxyPropertyType.Value:
            return makeRequest({ type: RequestType.Get, propKey }, channel, transport);
        case ProxyPropertyType.Value$:
            return makeObservable({ type: RequestType.Subscribe, propKey }, channel, transport);
        case ProxyPropertyType.Function:
            return (...args: any[]) => makeRequest({ type: RequestType.Apply, propKey, args }, channel, transport);
        case ProxyPropertyType.Function$:
            return (...args: any[]) => makeObservable({ type: RequestType.ApplySubscribe, propKey, args }, channel, transport);            
        default:
            throw new IpcProxyError(`Unrecognised ProxyPropertyType [${propertyType}]`);
    }
}

function memoize<T>(getter: () => T): () => T {
    let result: T = null;
    return () => result ? result : result = getter();
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