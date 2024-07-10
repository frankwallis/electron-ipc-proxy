import { EventEmitter } from 'events';
import { IpcMain, IpcRenderer } from 'electron';

export function mockIpc() {
    const ipcMain = new EventEmitter() as IpcMain;
    const ipcRenderer = new EventEmitter() as IpcRenderer;

    ipcRenderer.send = (channel: string, ...args: any[]) => {
        ipcMain.emit(channel, createEvent(ipcRenderer, ipcMain), ...args);
    }

    return { ipcMain, ipcRenderer };
}

function createEvent(sender: EventEmitter, receiver: EventEmitter) {
    return {
        sender: {
            once: (channel: string, listener: Function) => sender.once(channel, listener),
            removeListener: (channel: string, listener: Function) => sender.removeListener(channel, listener),
            send: (channel: string, ...args: any[]) =>
                sender.emit(channel, createEvent(receiver, sender), ...args)
        }
    };
}

export function delay(millis: number) {
    return new Promise(resolve => setTimeout(resolve, millis));
}
