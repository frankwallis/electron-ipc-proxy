import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import { ipcMain, IpcMain, Event, WebContents } from 'electron';
import Errio from 'errio';
import { IpcProxyError, isFunction, isObservable } from './utils';
import { 
    Request, RequestType, ResponseType,
    GetRequest, ApplyRequest, SubscribeRequest, UnsubscribeRequest,
    ProxyDescriptor, ProxyPropertyType, ApplySubscribeRequest
} from './common';

const registrations: { [channel: string]: ProxyServerHandler | null } = {};

export function registerProxy<T>(target: T, descriptor: ProxyDescriptor, transport: IpcMain = ipcMain): VoidFunction {
    const { channel } = descriptor;
    
    if (registrations[channel]) {
        throw new IpcProxyError(`Proxy object has already been registered on channel ${channel}`);
    }
    
    const server = new ProxyServerHandler(target);
    registrations[channel] = server;

    transport.on(channel, (event: Event, request: Request, correlationId: string) => {
        let { sender } = event;
        sender.once('destroyed', () => { sender = null });

        server.handleRequest(request, sender)        
            .then(result => sender && sender.send(correlationId, { type: ResponseType.Result, result }))
            .catch(error => sender && sender.send(correlationId, { type: ResponseType.Error, error: Errio.stringify(error) }));
    });

    return () => unregisterProxy(channel, transport);
}

function unregisterProxy(channel: string, transport: IpcMain) {
    transport.removeAllListeners(channel);
    const server = registrations[channel];

    if (!server) {
        throw new IpcProxyError(`No proxy is registered on channel ${channel}`);
    }

    server.unsubscribeAll();
    registrations[channel] = null;
}

class ProxyServerHandler {
    constructor(private target: any) {}

    private subscriptions: { [subscriptionId: string]: Subscription } = {};
    
    public async handleRequest(request: Request, sender: WebContents): Promise<any> {
        switch (request.type) {
            case RequestType.Get:
                return this.handleGet(request);
            case RequestType.Apply:
                return this.handleApply(request);
            case RequestType.Subscribe:
                return this.handleSubscribe(request, sender);
            case RequestType.ApplySubscribe:
                return this.handleApplySubscribe(request, sender);
           case RequestType.Unsubscribe:
                return this.handleUnsubscribe(request);
            default:
                throw new IpcProxyError(`Unhandled RequestType [${request.type}]`);
        }
    }

    public unsubscribeAll() {
        Object.values(this.subscriptions).forEach(subscription => subscription.unsubscribe());
        this.subscriptions = {};
    }

    private handleGet(request: GetRequest): Promise<any> {
        return this.target[request.propKey];
    }

    private handleApply(request: ApplyRequest): any {
        const { propKey, args } = request;
        const func = this.target[propKey];

        if (!isFunction(func)) {
            throw new IpcProxyError(`Remote property [${propKey}] is not a function`)
        }

        return func.apply(this.target, args);
    }

    private handleSubscribe(request: SubscribeRequest, sender: WebContents) {
        const { propKey, subscriptionId } = request;
        const obs = this.target[propKey];

        if (!isObservable(obs)) {
            throw new IpcProxyError(`Remote property [${propKey}] is not an observable`);
        }

        this.doSubscribe(obs, subscriptionId, sender);
    }

    private handleApplySubscribe(request: ApplySubscribeRequest, sender: WebContents): any {
        const { propKey, subscriptionId, args } = request;
        const func = this.target[propKey];

        if (!isFunction(func)) {
            throw new IpcProxyError(`Remote property [${propKey}] is not a function`)
        }

        const obs = func.apply(this.target, args);        

        if (!isObservable(obs)) {
            throw new IpcProxyError(`Remote function [${propKey}] did not return an observable`);
        }

        this.doSubscribe(obs, subscriptionId, sender);
    }
    
    private doSubscribe(obs: Observable<any>, subscriptionId: string, sender: WebContents) {
        if (this.subscriptions[subscriptionId]) {
            throw new IpcProxyError(`A subscription with Id [${subscriptionId}] already exists`);
        }

        this.subscriptions[subscriptionId] = obs.subscribe(
            (value) => sender.send(subscriptionId, { type: ResponseType.Next, value }),
            (error: Error) => sender.send(subscriptionId, { type: ResponseType.Error, error: Errio.stringify(error) }),
            () => sender.send(subscriptionId, { type: ResponseType.Complete }),
        );

        /* If the sender does not clean up after itself then we need to do it */
        sender.once('destroyed', () => this.doUnsubscribe(subscriptionId));        
    }

    private handleUnsubscribe(request: UnsubscribeRequest) {
        const { subscriptionId } = request;

        if (!this.subscriptions[subscriptionId]) {
            throw new IpcProxyError(`Subscription with Id [${subscriptionId}] does not exist`);
        }

        this.doUnsubscribe(subscriptionId);
    }

    private doUnsubscribe(subscriptionId: string) {
        const subscription = this.subscriptions[subscriptionId];

        if (subscription) {        
            subscription.unsubscribe();
            delete this.subscriptions[subscriptionId];
        }
    }
}

export { ProxyDescriptor, ProxyPropertyType }