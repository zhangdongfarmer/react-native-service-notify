/* eslint-disable no-async-promise-executor */
/* eslint-disable no-unused-vars */
const messenger = require('../src/Messenger')
const { colorValid, nameValid, projectValid } = require('../src/Validators')
const { trimSoul } = require('../src/Functions')
const chain = require('../src/Chains')
const store = require('../src/Store')

let debug = false
let state = {
    edit: {},
    original: {}
}

messenger.on('ProjectDetails', event => {
    if (event && typeof event === 'string') getProject(event).then(project => {
        state.original = project
        debug && console.log(project)
        messenger.emit(`${project.id}_details`, { name: project.name, color: project.color })
    })
})

messenger.on('ProjectEdit', event => {
    if (typeof event === 'object' && event.name && event.color) {
        state.edit = state.original
        state.edit.color = event.color
        state.edit.name = event.name
        if (!nameValid(state.edit.name)) {
            messenger.emit('ProjectCreateError', `${state.edit.name} is not valid name`)
            return false
        }
        if (!colorValid(state.edit.color)) {
            // alert('Need valid color');
            messenger.emit('ProjectCreateError', `${state.edit.color} is not valid color`)
            return false
        }
        else if (projectValid(state.edit)) {
            updateProject(state.edit).then(project => {
                debug && console.log(`success! ${project.id}`)
                messenger.emit('ProjectCreateSuccess', project)
            })
        }
    }
    //TODO unhappy paths
})

messenger.on('ProjectDelete', event => {
    if (event && event.id && event.type === 'project') {
        deleteProject(event)
    }
})

messenger.on('ProjectRestore', event => {
    if (event && event.id && event.type === 'project') {
        restoreProject(event)
    }
})

// DATA \\
const getProject = (projectId) => {
    return new Promise((resolve, reject) => {
        if (!projectId) reject('no projectId passed')
        try {
            store.chainer(chain.project(projectId), store.app).once((data, key) => {
                const foundData = trimSoul(data)
                // debug && console.log('[GUN node] getProject Data Found: ', foundData)
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

const updateProject = (projectEdit) => {
    return new Promise(async (resolve, reject) => {
        if (projectEdit.deleted) { projectEdit.deleted = null }
        projectEdit.edited = new Date().toString()
        debug && console.log('[react Data] Updating Project', projectEdit)
        store.set(chain.projectHistory(projectEdit.id), projectEdit)
        store.put(chain.project(projectEdit.id), projectEdit)
        try {
            let days = Object.keys(await getTimerDates()) // OPTIMIZE: triple mapping
            console.log(days)
            if (days && days.length > 0) {
                days.forEach(async day => {
                    let projectDates = await getProjectDates(day)
                    console.log('projectDates: ', projectDates)
                    projectDates.forEach(projectDate => {
                        if (projectDate.id === projectEdit.id) {
                            console.log('Editing projectDate: ', projectDate)
                            store.put(chain.projectDate(day, projectEdit.id), projectEdit)
                        }
                    })
                })
            }
        } catch (error) {
            reject('could not update ', error)
        }

        // Callback message = UI
        // TODO: make this part of chaining?
        messenger.on(`project/${projectEdit.id}`, event => {
            if (event === projectEdit) resolve(projectEdit)
            else reject(event)
        })
    })
}

const deleteProject = (projectDelete) => {
    return new Promise(async (resolve, reject) => {
        projectDelete.status = 'deleted'
        projectDelete.deleted = new Date().toString()
        debug && console.log('[react Data] Deleting Project', projectDelete)
        store.set(chain.projectHistory(projectDelete.id), projectDelete)
        store.put(chain.project(projectDelete.id), projectDelete)
        try {
            let days = Object.keys(await getTimerDates()) // OPTIMIZE: triple mapping
            console.log(days)
            if (days && days.length > 0) {
                days.forEach(async day => {
                    let projectDates = await getProjectDates(day)
                    console.log('projectDates: ', projectDates)
                    projectDates.forEach(projectDate => {
                        if (projectDate.id === projectDelete.id) {
                            console.log('Deleting projectDate: ', projectDate)
                            store.put(chain.projectDate(day, projectDelete.id), projectDelete)
                        }
                    })
                })
            }
        } catch (error) {
            reject('could not delete ', error)
        }

        // Callback message = UI
        // TODO: make this part of chaining?
        messenger.on(`project/${projectDelete.id}`, event => {
            if (event === projectDelete) resolve(projectDelete)
            else reject(event)
        })
    })
}

const restoreProject = (project) => {
    return new Promise(async (resolve, reject) => {
        project.status = 'active'
        project.deleted = new Date().toString()
        debug && console.log('[react Data] Restoring Project', project)
        store.set(chain.projectHistory(project.id), project)
        store.put(chain.project(project.id), project)
        try {
            let days = Object.keys(await getTimerDates()) // OPTIMIZE: triple mapping
            console.log(days)
            if (days && days.length > 0) {
                days.forEach(async day => {
                    let projectDates = await getProjectDates(day)
                    console.log('projectDates: ', projectDates)
                    projectDates.forEach(projectDate => {
                        if (projectDate.id === project.id) {
                            console.log('Restoring projectDate: ', projectDate)
                            store.put(chain.projectDate(day, project.id), project)
                        }
                    })
                })
            }
        } catch (error) {
            reject('could not restore ', error)
        }

        // Callback message = UI
        // TODO: make this part of chaining?
        messenger.on(`project/${project.id}`, event => {
            if (event === project) resolve(project)
            else reject(event)
        })
    })
}


/**
* 
* @param {string} day simpledate `dd-mm-yyyy` 
*/
const getProjectDates = (day) => new Promise((resolve, reject) => {
    try {
        let result = []
        store.chainer(chain.projectDates(day), store.app).map().on((data, key) => {
            if (!data) {
                debug.data && console.log('[GUN node] getProjectDates No Data Found',)
            }
            let foundData = trimSoul(data)
            if (foundData.type === 'project') {
                result.push(foundData)
            }
            debug.data && console.log('[GUN node] getProjectDates Data Found: ', key, foundData)
        })
        resolve(result)
    } catch (err) {
        reject(err)
    }

})

/**
 * OPTIMIZE: double mapping, can just output expected map once
 */
const getTimerDates = () => new Promise((resolve, reject) => {
    try {
        let result = {}
        store.chainer(chain.timerDates(), store.app).map().on((data, key) => {
            if (!data) {
                debug.data && console.log('[GUN node] getTimerDates No Data Found',)
            }
            let foundData = trimSoul(data)
            result[key] = foundData
            debug.data && console.log('[GUN node] getTimerDates Data Found: ', key, foundData)
        })
        resolve(result)
    } catch (err) {
        reject(err)
    }
})