export enum ProxyPropertyType {
    Value = 'value',
    Function = 'function',
    Observable = 'observable'
}

export interface ProxyDescriptor {
    channel: string;
    properties: { [propKey: string]: ProxyPropertyType };
}

export enum RequestType {
    Get = 'get',
    Apply = 'apply',
    Subscribe = 'subscribe',
    Unsubscribe = 'unsubscribe'
}

export interface UnknownRequest {
    type: 'unknown';
}

export interface GetRequest {
    type: RequestType.Get;
    propKey: PropertyKey;
}

export interface ApplyRequest {
    type: RequestType.Apply;
    propKey: string;
    args: any[];
}

export interface SubscribeRequest {
    type: RequestType.Subscribe;
    propKey: string;
    subscriptionId: string;
}

export interface UnsubscribeRequest {
    type: RequestType.Unsubscribe;
    subscriptionId: string;
}

export type Request = UnknownRequest | GetRequest | ApplyRequest | SubscribeRequest | UnsubscribeRequest;

export enum ResponseType {
    Result = 'result',    
    Error = 'error',
    Next = 'next',
    Complete = 'complete'
}

export interface ResultResponse {
    type: ResponseType.Result;
    result: any;
}

export interface ErrorResponse {
    type: ResponseType.Error;
    error: any;
}

export interface NextResponse {
    type: ResponseType.Next;
    value: any;
}

export interface CompleteResponse {
    type: ResponseType.Complete;
}

export type Response = ResultResponse | ErrorResponse | NextResponse | CompleteResponse;