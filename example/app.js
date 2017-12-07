import { createProxy, ProxyPropertyType } from '../';

/* This is our proxy for accessing the service which executes in the main process */
const service = createProxy({
    channel: 'service',
    properties: {
        createWindow: ProxyPropertyType.Function,
        add: ProxyPropertyType.Function,
        time: ProxyPropertyType.Value$,
        respondAfter: ProxyPropertyType.Function
    }
});

/* Panel for creating windows */
const buttonCreateWindow = document.querySelector('#button-create-window');
buttonCreateWindow.addEventListener('click', () => service.createWindow('newwindow'));

/* Panel for making errors */
let errorCount = 0;
async function makeError () {
    errorCount = (errorCount % 2) + 1;
    if (errorCount === 1) {
        return service.missing();
    }
    else if (errorCount === 2) {
        return service.time();
    }
    return Promise.reject(new Error('unexpcted'));
}
const buttonMakeError = document.querySelector('#button-make-error');
const displayError = document.querySelector('#error-display');
buttonMakeError.addEventListener('click', () =>
    makeError().catch(err => displayError.innerHTML = err.message));

/* Panel for adding numbers */
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

/* Long running promise */
const buttonRequestClose = document.querySelector('#button-request-close');
buttonRequestClose.addEventListener('click', () => {
    service.respondAfter(500).then(() => 'Received response');
    require('electron').remote.getCurrentWindow().close();
});