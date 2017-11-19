import { EventEmitter } from 'events';
import { IpcMain, IpcRenderer } from 'electron';

export function mockIpc() {
    const ipcMain = new EventEmitter() as IpcMain;
    const ipcRenderer = new EventEmitter() as IpcRenderer;

    ipcRenderer.send = (channel: string, ...args: any[]) => {
        ipcMain.emit(channel, createEvent(ipcRenderer), ...args);
    }

    return { ipcMain, ipcRenderer };
}

function createEvent(ipcRenderer: any): any {
    return {
        sender: {
            once: (...args: any[]) => ipcRenderer.once(...args),
            send: (channel: string, ...args: any[]) => ipcRenderer.emit(channel, {}, ...args)
        }
    };
}

export function delay(millis: number) {
    return new Promise(resolve => setTimeout(resolve, millis));
}
