electron-ipc-proxy
============================
Transparently proxy objects from the main thread to renderer threads in electron using asynchronous IPC communication

[![build status](https://secure.travis-ci.org/frankwallis/electron-ipc-proxy.png?branch=master)](http://travis-ci.org/frankwallis/electron-ipc-proxy)

### Overview ###

Say you have a service which exists in your main (nodejs) thread and you want to access it from one of your windows, simply register the service with electron-ipc-proxy and you will be able to create a proxy object in the browser window which acts exactly like calling the service directly. All communication happens asynchronously (unlike using electron remote) and so you won't freeze up your application.

### Example ###

You have a class which implements "TodoList" communications with the server, and has the following interface:

```js
interface TodoService {
    todos: Observable<Todo>;
    canAddTodos: Promise<boolean>;
    addTodo(user: string, description: string): Promise<void>;
    getTodosFor(user: string): Observable<Todo>;
}
```

You can make this service available to renderer threads by registering it with electron-ipc-proxy:

```js
import { registerProxy } from 'electron-ipc-proxy'

const todoService = createTodoService(...)
registerProxy(todoService, serviceDescriptor);
```

And then access it from renderer threads:
```js
import { createProxy } from 'electron-ipc-proxy'

const todoService = createProxy(serviceDescriptor)

todoService.addTodo('frank', 'write the docs')
    .then(res => console.log('successfully added a todo'))
todoService.todos.subscribe(...)
```

What's this "serviceDescriptor" thing? Service descriptors tell electron-ipc-proxy the shape of the object to be proxied and the name of a unique channel to communicate on, they're very simple:

```js
import { ProxyPropertyType } from 'electron-ipc-proxy'

const todoServiceDescriptor = {
    channel: "todoService",
    properties: {
        todos: ProxyPropertyType.Observable;
        canAddTodos: ProxyPropertyType.Property;
        addTodo: ProxyPropertyType.Function;
        getTodosFor: ProxyPropertyType.ObservableFactory;
    }
}
```

### Notes ###

All values and functions will return promises on the renderer side, no matter how they have been defined on the source object. This is because communication happens asynchronously. For this reason it is recommended that you make them promises on the source object as well, so the interface is the same on both sides.

Only plain objects can be passed between the 2 sides of the proxy, as the data is serialized to JSON, so no functions or prototypes will make it across to the other side.

The channel specified must be unique and match on both sides of the proxy.

The packages exposes 2 entry points in the "main" and "browser" fields of package.json. "main" is for the main thread and "browser" is for the renderer thread.

### See it working ###

```sh
git clone https://github.com/frankwallis/electron-ipc-proxy.git
npm install
npm run example
```