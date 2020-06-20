import { cloneTimer, newProject, doneTimer, newTimer } from './Models'
import { isRunning, multiDay, newEntryPerDay, dateSimple, dateTestGen, endRandTestGen, startRandTestGen } from '../constants/Functions'
import * as store from './Store.native'
import * as chain from './Chains'

const debug = false

export const createProject = (name, color) => {
    const project = newProject(name, color)
    if (!project) return false
    debug && console.log('[react Data] Creating Project', project)
    store.set(chain.projectHistory(project.id), project)
    store.put(chain.project(project.id), project)
}

export const updateProject = (project, updates) => {
    let projectEdit = project
    Object.assign(projectEdit, updates)
    if (projectEdit.deleted) { projectEdit.deleted = null }
    projectEdit.edited = new Date().toString()
    debug && console.log('[react Data] Updating Project', projectEdit)
    store.set(chain.projectHistory(project.id), projectEdit)
    store.put(chain.project(projectEdit.id), projectEdit)
}

export const restoreProject = (project) => {
    let restoredProject = project
    if (restoredProject.status === 'deleted') {
        restoredProject.status = 'active'
    }
    debug && console.log('[react Data] Restoring Project', restoredProject)
    store.put(chain.project(restoreProject.id), restoreProject)
}


export const deleteProject = (project) => {
    debug && console.log('[react Data] Deleting Project', project)
    let projectDelete = project
    projectDelete.deleted = new Date().toString()
    store.set(chain.projectHistory(projectDelete.id), projectDelete)
    projectDelete.status = 'deleted'
    store.put(chain.project(project.id), projectDelete)
}
/**
 * Generates a new timer using the standard timer model
 * TODO: consider doing a pre-create sync to eliminate unsynced running timers/deleted projects
 * @param {*} projectId 
 */
export const createTimer = (projectId) => {
    if (!projectId || typeof projectId !== 'string' || projectId.length < 9) return false
    debug && console.log('[react Data] Creating Timer', projectId)
    const timer = newTimer(projectId)
    debug && console.log('[react Data] Created Timer', timer)
    store.put('running', timer)
    store.set(chain.timerHistory(timer.id), timer)
    return true
}

/**
 * Generates timer for testing
 * @param {array} projects 
 */
export const generateTimer = (projects) => {
    let projectId = projects[Math.floor(Math.random() * projects.length)].id
    debug && console.log('[react Data] Generating Timer', projectId)
    let timer = newTimer(projectId)
    // let start = randomDate(new Date(2020, 1, 1), new Date())
    // let end = randomDate(start, new Date())
    // let start = dateTestGen()
    let start = startRandTestGen()
    let end = endRandTestGen(start)
    // debug && console.log('start gen: ', start)
    timer.started = start.toString()
    timer.ended = end.toString()
    timer.status = 'done'
    debug && console.log('[react Data] Generated Timer', timer)
    store.set(chain.timerHistory(timer.id), timer)
    store.put(chain.timer(timer.id), timer)
    store.set(chain.projectTimer(projectId, timer.id), timer)
    store.set(chain.dateTimer(timer.started, timer.id), timer)
    return true
}

export const runTimer = (timer) => {
    store.put('running/timer', JSON.stringify(timer))
}

export const updateTimer = (timer) => {
    let editedTimer = timer
    if (editedTimer.deleted) { editedTimer.deleted = null }
    editedTimer.edited = new Date().toString()
    debug && console.log('[react Data] Updating Timer', editedTimer)
    store.set(chain.timerHistory(editedTimer.id), editedTimer)
    store.put(chain.timer(editedTimer.id), editedTimer)
    store.set(chain.projectTimer(editedTimer.project, editedTimer.id), editedTimer)
    if (timer.started !== editedTimer.started) {
        let timerMoved = timer
        timerMoved.deleted = new Date().toString()
        timerMoved.status = 'moved'
        store.set(chain.dateTimer(timer.started, timer.id), timerMoved)
    }
    store.set(chain.dateTimer(editedTimer.started, editedTimer.id), editedTimer)
}

export const restoreTimer = (timer) => {
    let restoredTimer = timer
    // restoredTimer.restored = new Date().toString()
    if (restoredTimer.status === 'deleted') {
        restoredTimer.status = 'done'
        store.set(chain.timerHistory(restoredTimer.id), restoredTimer)
    }
    debug && console.log('[react Data] Restoring Timer', restoredTimer)
    store.put(chain.timer(restoredTimer.id), restoredTimer)
    store.set(chain.projectTimer(restoredTimer.project), restoredTimer)
    store.set(chain.dateTimer(restoredTimer.started, restoredTimer.id), restoredTimer)
}

export const endTimer = (timer) => {
    debug && console.log('[react Data] Ending', timer)
    store.set(chain.timerHistory(timer.id), timer)
    store.put(chain.timer(timer.id), timer)
    store.set(chain.projectTimer(timer.project, timer.id), timer)
    store.set(chain.dateTimer(timer.started, timer.id), timer)
}

export const deleteTimer = (timer) => {
    debug && console.log('[react Data] Deleting Timer', timer)
    let timerDelete = timer
    timerDelete.deleted = new Date().toString()
    timerDelete.status = 'deleted'
    store.set(chain.timerHistory(timer.id), timerDelete)
    store.put(chain.timer(timer.id), timerDelete)
    store.set(chain.projectTimer(timer.project, timer.id), timerDelete)
    store.set(chain.dateTimer(timer.started, timer.id), timerDelete)
}

/**
 * Generates a new timer using the given timer model
 * @param {String} projectId project hashid
 */
export const addTimer = timer => {
    const clonedTimer = cloneTimer(timer)
    debug && console.log('[node Data] Storing Timer', clonedTimer)
    endTimer(clonedTimer)
}

export const finishTimer = (timer) => {
    if (isRunning(timer)) {
        debug && console.log('[react Data STOP] Finishing', timer)
        let done = doneTimer(timer)
        store.put('running', done)
        // Danger zone until endTimer is called
        if (multiDay(done.started, done.ended)) {
            const dayEntries = newEntryPerDay(done.started, done.ended)
            dayEntries.map((dayEntry, i) => {
                let splitTimer = done
                splitTimer.started = dayEntry.start
                splitTimer.ended = dayEntry.end
                debug && console.log('[react Data] Split', i, splitTimer)
                if (i === 0) { endTimer(splitTimer) } // use initial timer id for first day
                else { addTimer(splitTimer) }
                return splitTimer
            })
        } else {
            endTimer(done)
        }
    } else { return timer }
}

export const getProjects = () => {
    store.get(chain.projects())
    // return store.off('projects')
}

export const getProject = projectId => {
    store.get(chain.project(projectId))
}

export const getTimers = () => {
    store.get(chain.timers())
}

export const getTimerDates = () => {
    store.get(chain.timerDates())
}

export const getTimersForDate = (date) => {
    store.get(`date/timers/${date}`)
}

export const getProjectTimers = projectId => {
    store.get(chain.projectTimers(projectId))
    // store.getAll('timers', { key: 'project', value: projectId })
}

export const getTimer = timerId => {
    store.get(chain.timer(timerId))
}

export const getTimerHistory = timerId => {
    store.get(chain.timerHistory(timerId))
}

export const getProjectHistory = projectId => {
    store.get(chain.projectHistory(projectId))
}

export const getRunning = () => {
    store.get(chain.running())
}