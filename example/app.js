import { createProxy, ProxyPropertyType } from '../src/client';
const { ipcRenderer } = window.require('electron');

/* This is our proxy for accessing the service which executes in the main process */
const service = createProxy(ipcRenderer, {
    channel: 'service',
    properties: {
        createWindow: ProxyPropertyType.Function,
        add: ProxyPropertyType.Function,
        time: ProxyPropertyType.Observable
    }
});

/* Button for creating windows */
const buttonCreateWindow = document.querySelector('#button-create-window');
buttonCreateWindow.addEventListener('click', () => service.createWindow('newwindow'));

/* Elements for adding numbers */
const inputOperand1 = document.querySelector('#add-operand-1');
const inputOperand2 = document.querySelector('#add-operand-2');
const inputTotal = document.querySelector('#add-total');

async function updateTotal() {
    const num1 = parseInt(inputOperand1.value);
    const num2 = parseInt(inputOperand2.value);

    const total = await service.add(num1, num2);
    inputTotal.value = total;
}

inputOperand1.addEventListener('change', updateTotal);
inputOperand2.addEventListener('change', updateTotal);

/* Observable stream */
const timeDisplay = document.querySelector('#time-display');
const subscription = service.time.subscribe(str => timeDisplay.innerHTML = str);

window.addEventListener('beforeunload', () => subscription.unsubscribe());