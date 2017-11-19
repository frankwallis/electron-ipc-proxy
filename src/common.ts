export enum ProxyPropertyType {
    Value = 'value',
    Function = 'function',
    Observable = 'observable'
}

export interface ProxyPropertyDescriptor {
    name: string;
    type: ProxyPropertyType
} 

export interface ProxyDescriptor {
    channel: string;
    properties: { [key: string]: ProxyPropertyType }
}

export enum RequestType {
    Get = 'get',
    Apply = 'apply'
}

export interface UnknownRequest {
    type: 'unknown';
}

export interface GetRequest {
    type: RequestType.Get;
    name: PropertyKey;
}

export interface ApplyRequest {
    type: RequestType.Apply;
    name: string;
    args: any[];
}

export type Request = UnknownRequest | GetRequest | ApplyRequest;

export enum ResponseType {
    Result = 'result',
    Error = 'error'
}

export interface UnknownResponse {
    type: 'unknown';
}

export interface ResultResponse {
    type: ResponseType.Result;
    result: any;
}

export interface ErrorResponse {
    type: ResponseType.Error;
    error: any;
}

export type Response = UnknownResponse | ResultResponse | ErrorResponse;