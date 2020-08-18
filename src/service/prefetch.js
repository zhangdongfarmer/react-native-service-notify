import messenger from '../constants/Messenger'


// sources: 
// https://reactjs.org/docs/concurrent-mode-suspense.html#approach-3-render-as-you-fetch-using-suspense
// https://codesandbox.io/s/frosty-hermann-bztrp?file=/src/index.js
// 
function wrapPromise(promise) {
    let status = "pending";
    let result;
    let suspender = promise.then(
        r => {
            status = "success";
            result = r;
        },
        e => {
            status = "error";
            result = e;
        }
    );
    return {
        read() {
            if (status === "pending") {
                throw suspender;
            } else if (status === "error") {
                throw result;
            } else if (status === "success") {
                return result;
            }
        }
    };
}

let pagesize = 4
function fetchDaytimers() {
    return new Promise(resolve => {
        messenger.addListener("pages", event => {
            console.log('initial pages', event)
            resolve(event.flat(1))
        })
        messenger.emit('getPages', { currentday: 0, all: true, pagesize: pagesize })
    })

}


export function preFetch() {
    let dayTimersPromise = fetchDaytimers();
    return {
        daytimers: wrapPromise(dayTimersPromise),
    };
}