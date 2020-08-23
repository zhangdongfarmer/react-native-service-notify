/* eslint-disable no-async-promise-executor */
/* eslint-disable no-unused-vars */

const store = require('./src/Store')
const messenger = require('./src/Messenger')
const chain = require('./src/Chains')
const { cloneTimer, doneTimer, newTimer } = require('./src/Models')
const { getTodaysCount, dateSimple, totalTime, settingCount, isRunning, multiDay, newEntryPerDay, trimSoul } = require('./src/Functions')
const { runCounter, stopCounter, setCount } = require('./counter')

const debug = false 

let running = {}
let runningproject = {}

const stopRunning = async () => {
    try {
        stopCounter()
        debug && console.log('[STOP] ', running, runningproject)
        await finishRunning(running, runningproject)
    } catch (error) {
        debug && console.log('[Timer node] : Stop failed ' + error)
    }

}

const parseRunning = async (data) => {
    if (data.status === 'running' && data.id) {
        running = data
        try {
            runningproject = await getProject(data.project)
            if (runningproject && runningproject.status === 'active') {
                let count = totalTime(running.started, new Date()) + running.count
                debug && console.log('[START] running found, setting count, ', count)
                setCount(count)
                runCounter()
            }
            // TODO: handle if a project gets deleted offline/remotely -> stop and store it?
        } catch (error) {
            console.log(error)
        }

    }
    else if (!data.id) {
        debug && console.log('[STOP] running cleared')
        running = data
        stopCounter()
    }
    else if (data.status === 'done' && data.id === running.id) {
        debug && console.log('[STOP] running stopped')
        running = data
        stopCounter()
    }
    else {
        debug && console.log('[STOP] running timer')
        running = {}
        stopCounter()
    }
}


// Native Command Handlers
messenger.on('stop', async msg => {
    debug && console.log('[React node] incoming Stop: ' + typeof msg, msg)
    try {
        await stopRunning()
    } catch (error) {
        debug && console.log('[Timer node] : Stop failed ' + error)
    }
})

messenger.on('start', async msg => {
    debug && console.log('[React node] incoming Start: ' + typeof msg, msg)
    if (!msg || typeof msg !== 'object' || !msg.projectId || msg.projectId === 'none') {
        debug && console.log('Start Failed')
        return false
    }
    try {
        if (running && running.status === 'running') await stopRunning()
        runningproject = await getProject(msg.projectId)
        await createRunning(runningproject)
    } catch (error) {
        debug && console.log('[Timer node] : Create failed ' + error)
    }
})


// DATA
/**
 * creates a running timer entry, emits 'running'
 * @param {Object} project 
 */
const createRunning = project => new Promise((resolve, reject) => {
    if (!project || typeof project !== 'object' || !project.id || project.id.length < 9) {
        reject('invalid project')
        return
    }
    let timer = newTimer(project.id)
    console.log('last run: ', project.lastrun, project.lastcount)
    timer.name = project.name
    timer.color = project.color
    timer.count = project.lastrun && project.lastcount ? getTodaysCount(project.lastrun, project.lastcount) : 0
    debug && console.log('[react Data] Created Timer', timer)
    store.put(chain.running(), timer)
    store.set(chain.timerHistory(timer.id), timer) // TODO: might be un-necessary...
    resolve(timer)
})


/**
 * creates and updates entries to end a timer
 * @param {*} timer 
 */
const endTimer = (timer, project) => new Promise((resolve, reject) => {
    debug && console.log('[react Data] Ending', timer, project)
    if (!timer || !timer.id || timer.id === 'none') {
        reject('no timer')
    }
    else if (!project || !project.id || project.id === 'none' || project.id.length < 9) {
        reject('no project')
    } else {
        project.lastcount = settingCount(timer, project)
        project.lastrun = dateSimple(new Date())
        timer.total = totalTime(timer.started, timer.ended)
        // debug && console.log('[react Data] storing count', project.lastrun, project.lastcount)
        debug && console.log('[react Data] storing timer', timer)
        // debug && console.log('[react Data] storing project', project)
        store.put(chain.project(project.id), project)
        store.put(chain.timer(timer.id), timer)
        store.set(chain.timerHistory(timer.id), timer)
        store.put(chain.timerDate(timer.started, timer.id), true) // maybe have a count here?
        store.put(chain.projectDate(project.lastrun, project.id), project)
        store.put(chain.projectTimer(project.id, timer.id), timer)
        debug && console.log('[react Data] Ended', timer, project)
        resolve(timer)
    }
})

/**
 * Generates a new timer using the given timer model
 * @param {String} projectId project hashid
 */
const addTimer = (timer, project) => new Promise(async (resolve, reject) => {
    if (!timer) reject('no timer to add')
    const clonedTimer = cloneTimer(timer)
    debug && console.log('[node Data] Storing Timer', clonedTimer)
    await endTimer(clonedTimer, project)
    resolve(clonedTimer)
})

const finishRunning = (timer, project) => new Promise(async (resolve, reject) => {
    if (isRunning(timer)) {
        debug && console.log('[react Data STOP] Finishing', timer)
        let done = doneTimer(timer)
        store.put(chain.running(), done)
        // Danger zone until endTimer is called
        debug && console.log('[react Data STOP] Checking for Multi-day...')
        if (multiDay(done.started, done.ended)) {
            const dayEntries = newEntryPerDay(done.started, done.ended)
            dayEntries.map(async (dayEntry, i) => {
                let splitTimer = done
                splitTimer.started = dayEntry.start
                splitTimer.ended = dayEntry.end
                debug && console.log('[react Data] Split', i, splitTimer)
                if (i === 0) { await endTimer(splitTimer, project) } // use initial timer id for first day
                else { await addTimer(splitTimer, project) }
                resolve(splitTimer)
            })
        } else {
            try {
                let ended = await endTimer(done, project)
                resolve(ended)
            } catch (error) {
                reject('unable to Finish ', error)
            }
        }
    } else { reject('Timer not running.') }
})

const getProject = (projectId) => {
    return new Promise((resolve, reject) => {
        if (!projectId) reject('no projectId passed')
        try {
            store.chainer(chain.project(projectId), store.app).once((data, key) => {
                const foundData = trimSoul(data)
                //   debug && console.log('[GUN node] getProject Data Found: ', foundData)
                if (foundData && foundData.type === 'project') {
                    resolve(foundData)
                }

            })
        } catch (error) {
            debug && console.debug && console.log(error)
            reject(error)
        }
    })
}

const getRunning = () => new Promise((resolve, reject) => {
    store.chainer('running', store.app).once((data, key) => {
        if (!data) reject('no Running')
        data = trimSoul(data)
        if (data && data.type === 'timer') {
            debug && console.log('Got Running Timer...')
            resolve(data)
        }
    })

})

/**
 * Local Running Listener
 */
messenger.on('getRunning', async () => {
    //TODO: might not need this? could be redundant
    let data = await getRunning()
    parseRunning(data)
    if (running && running.id && running.project) {
        messenger.emit('running', running)
    }
})


/**
 * Listener for Remote or Offline changes
 */
store.chainer('running', store.app).on((data, key) => {
    if (!data) debug && console.log('no Running')
    data = trimSoul(data) // NOTE: always trimSoul of incoming data, soulFul data will destroy chains!!!
    if (data && data.type === 'timer') {
        debug && console.log('Received Running Timer...')
        parseRunning(data)
        messenger.emit('running', running)
    }
})