import { cloneTimer, newProject, doneTimer, newTimer } from './Models'
import { isRunning, multiDay, newEntryPerDay } from './Functions'
import store from './Store'

const debug = true

export const createProject = (name, color) => {
    const project = newProject(name, color)
    if (!project) return false
    debug && console.log('Creating Project', project)
    store.set(`history/projects${project.id}`, JSON.stringify(project))
    store.put(`projects/${project.id}`, JSON.stringify(project))
}

export const updateProject = (project, updates) => {
    let projectEdit = project
    Object.assign(projectEdit, updates)
    if (projectEdit.deleted) { projectEdit.deleted = null }
    projectEdit.edited = new Date().toString()
    debug && console.log('Updating Project', projectEdit)
    store.set(`history/projects/${project.id}`, projectEdit)
    store.put(`projects/${projectEdit.id}`, projectEdit)
}

export const restoreProject = (project) => {
    let restoredProject = project
    if (restoredProject.status === 'deleted') {
        restoredProject.status = 'active'
    }
    debug && console.log('Restoring Project', restoredProject)
    store.put(`projects/${restoreProject.id}`, restoreProject)
}


export const deleteProject = (project) => {
    debug && console.log('Deleting Project', project)
    let projectDelete = project
    projectDelete.deleted = new Date().toString()
    store.set(`history/projects/${projectDelete.id}`, projectDelete)
    projectDelete.status = 'deleted'
    store.put(`projects/${project.id}`, projectDelete)
}
/**
 * Generates a new timer using the standard timer model
 * TODO: consider doing a pre-create sync to eliminate unsynced deleted projects
 * @param {*} projectId 
 */
export const createTimer = (projectId) => {
    if (!projectId || typeof projectId !== 'string' || projectId.length < 9) return false
    debug && console.log('Creating Timer', projectId)
    const timer = newTimer(projectId)
    debug && console.log('Created Timer', timer)
    store.put('running', timer)
    store.set(`history/timers/${projectId}/${timer.id}`, timer)
    return true
}

export const runTimer = (timer) => {
    store.put('running/timer', JSON.stringify(timer))
}

export const updateTimer = (timer) => {
    let editedTimer = timer
    if (editedTimer.deleted) { editedTimer.deleted = null }
    editedTimer.edited = new Date().toString()
    debug && console.log('Updating Timer', editedTimer)
    store.set(`history/timers/${editedTimer.project}/${editedTimer.id}`, editedTimer)
    store.put(`timers/${editedTimer.project}/${editedTimer.id}`, editedTimer)
}

export const restoreTimer = (timer) => {
    let restoredTimer = timer
    // restoredTimer.restored = new Date().toString()
    if (restoredTimer.status === 'deleted') {
        restoredTimer.status = 'done'
        store.set(`history/timers/${restoreTimer.project}/${restoreTimer.id}`, restoredTimer)
    }
    debug && console.log('Restoring Timer', restoredTimer)
    store.put(`timer/${restoreTimer.project}/${restoreTimer.id}/`, restoredTimer)
}

export const endTimer = (timer) => {
    debug && console.log('Ending', timer)
    store.set(`history/timers/${timer.project}/${timer.id}`, timer)
    store.put(`timrs/${timer.project}/${timer.id}`, timer)
}

export const endTimerDestructured = (timer) => {
    debug && console.log('Ending', timer)
    store.set(`history/timers/${timer.project}/${timer.id}`, timer)
    const keys = Object.keys(timer)
    debug && console.log('destructure', keys)
    keys.map(key => {
        debug && console.log('Storing', key, timer[key])
        // timers > projectId > timerId > timerKey > timervalue
        store.put(`timers/${timer.project}/${timer.id}/${key}`, timer.key)
        return key
    })
}

export const deleteTimer = (timer) => {
    debug && console.log('Deleting Timer', timer)
    const timerDelete = timer
    timerDelete.deleted = new Date().toString()
    timerDelete.status = 'deleted'
    store.put(`timer/${timer.project}/${timer.id}`, timerDelete)
}

/**
 * Generates a new timer using the given timer model
 * @param {String} projectId project hashid
 * @param {Object} value a timer object
 */
export const addTimer = (projectId, value) => {
    const timer = cloneTimer(value)
    debug && console.log('Storing Timer', timer)
    store.set(`history/timers/${projectId}/${timer.id}`, timer)
    store.put(`timers/${projectId}/${timer.id}`, timer)
}

export const finishTimer = (timer) => {
    if (isRunning(timer)) {
        debug && console.log('Finishing', timer)
        let done = doneTimer(timer)
        store.put('running', {id: 'none'})
        // Danger zone until endTimer is called
        if (multiDay(done.started, done.ended)) {
            const dayEntries = newEntryPerDay(done.started, done.ended)
            dayEntries.map((dayEntry, i) => {
                let splitTimer = done
                splitTimer.started = dayEntry.start
                splitTimer.ended = dayEntry.end
                debug && console.log('Split', i, splitTimer)
                if (i === 0) { endTimer(splitTimer) } // use initial timer id for first day
                else { addTimer(splitTimer.project, splitTimer) }
                return splitTimer
            })
        } else {
            endTimer(done)
        }
    } else { return timer }
}

export const getProjects = () => {
    store.getAll('projects')
    // return store.off('projects')
}