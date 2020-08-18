import { totalTime, parse, trimSoul, isRunning } from '../constants/Functions'
import * as store from '../data/Store'
import messenger from '../constants/Messenger'
import * as chain from '../data/Chains'

let debug = {
    state: true,
    data: true,
    listeners: true,
    parsing: true,
    sorting: true
}

let projectState = {}
let current = {} // current project in view state
let days = [] // set of days containing timers

const newProjectState = (projectId) => ({
    pages: [],
    pagesize: 5, // number of timers per `page`
    currentday: 0, // last day where timers were retrieved
    page: [], // set of timers sectioned by day
    currentPage: 1,
    pagelocation: { x: 0, y: 0 },
    project: { id: projectId ? projectId : 'none' }
})
const setCurrent = (projectId) => {
    if (!projectState[projectId]) {
        projectState[projectId] = newProjectState(projectId)
    }
    current = projectState[projectId]
}
const setState = (key, value) => current[key] = value

// LISTENERS
messenger.on(chain.timerDates(), event => {
    if (!event) return
    let item = parse(event)
    if (item && typeof item === 'object') {
        let found = Object.keys(item)
        days = found.sort((a, b) => new Date(b) - new Date(a))
        debug && console.log('found dates: ', days)
        // days.forEach(day => messenger.addListener(chain.timersInDay(day), event => timersInDayHandler(event, { day })))
    }
})
store.getAllOnce(chain.timerDates())


messenger.on('getProjectPages', msg => {
    if (msg && msg.projectId) {
        debug && console.log('getProjectPages received')
        setCurrentProject(msg)
        listenForPageLocation(projectState[msg.projectId])
    }
})

const listenForPageLocation = current => {
    messenger.removeAllListeners(`${current.project.id}/pagelocation`) // pre-clean, might be redundant?
    messenger.on(`${current.project.id}/pagelocation`, msg => {
        if (msg) {
            current.pagelocation.x = msg.x
            current.pagelocation.y = msg.y
            debug && console.log(current.pagelocation.y)
        }
    })
}

const setCurrentProject = (msg) => {
    setCurrent(msg.projectId)
    setState('pagesize', msg.pagesize)
    if (!current.project.name || current.project.id === 'none') {
        getProject(current.project.id).then(foundproject => {
            current.project = foundproject
            debug && console.log('Project: ', current.project)
            messenger.emit(`${current.project.id}/project`, current.project)
            handleProjectPages(msg)
        })
    } else {
        handleProjectPages(msg)
    }

}
const handleProjectPages = msg => {
    if (msg.currentday === 0) {
        if (current.pages && current.pages.length === 0) {
            setState('currentday', 0)
            debug && console.log('getting pages.')
            createPage(0)
        } else {
            debug && console.log('updating pages.')
            messenger.emit(`${current.project.id}/pages`, current.pages)
            debug && console.log('locating...', current.pagelocation.y)
            messenger.emit(`${current.project.id}/lastpagelocation`, current.pagelocation)
        }
    }
    else if (msg.currentday > 0) {
        debug && console.log('getting pages.')
        // update state if page has last retrieved day, otherwise use current state
        if (msg.currentday > current.currentday) {
            setState('currentday', msg.currentday)
        } else {
            setState('currentday', current.currentday + 1)
        }
        createPage(current.currentday)
    }

}


// STATE

/**
 * populate an array of sections
 *  
 * page
 * `[{title: 'dd-mm-yyyy', data: [{timer}, {timer}, ...]}, ...]`
 * 
 */
const createPage = (currentday) => {
    let day = days[currentday]
    debug.state && console.log(`[State] day: ${currentday}/${days.length} [${day}], timer: ${current.page.length}/${current.pagesize} `)

    if (currentday >= days.length) {
        debug.state && console.log('[State] No more days with full pages.')
        if (current.page.length > 0) {
            debug.state && console.log('[State] Last Page ' + current.currentPage + ' Complete.')
            setPage()
        }
        return
    }
    else if (day && current.page.length >= current.pagesize) {
        debug.state && console.log('[State] Page ' + current.currentPage + ' Complete.')
        setPage()
    }
    else if (day) {
        debug.state && console.log('[State] Create Page.')
        getTimersInDay(day)

    } else {
        return
    }

}

/**
 * add page to pages
 */
const setPage = () => {
    messenger.emit(`${current.project.id}/page`, current.page)
    current.pages.push(current.page)
    current.page = []
    current.currentPage++
}

/**
 * Add section and setup next
 * @param {Object} section 
 * @param {String} section.title 
 * @param {Array} section.data 
 */
const addSection = (section) => new Promise((resolve, reject) => {
    let alreadyInTimers = current.page.some(entry => entry.title === section.title)
    if (alreadyInTimers) reject('section already in timeline')
    //TODO: optimize, sometimes adding a random timer at beginning of new page... we filter that out here
    if (!alreadyInTimers && days[current.currentday] === section.title) {
        debug.state && console.log('[State] Adding Section: ', section)
        if (section.data.length > 0) {
            current.page.push(section)
        }
        current.currentday++
        createPage()
        resolve()
    }
})


// PARSING
/**
 * get timer entries for the `day`
 * @param {string} day simpledate `dd-mm-yyyy`
 */
const getTimersInDay = async day => {
    try {
        let event = await getDayTimers(day, current.project.id)
        let item = parse(event)
        debug.parsing && console.log('[Parsing] projectDates.', item)
        if (item && typeof item === 'object') {
            let section = { title: day, data: item }
            await addSection(section)
        }
    } catch (error) {
        console.log(error)
    }
}

// DATA

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



/**
* 
* @param {string} day simpledate `dd-mm-yyyy` 
* @param {string} projectId 
*/
const getDayTimers = (day, projectId) => {
    return new Promise((resolve, reject) => {
        try {
            let result = []
            store.chainer(chain.timersInDay(day), store.app).map().on((data, key) => {
                if (!data) {
                    debug && console.log('[GUN node] getAllOnce No Data Found',)
                }
                let foundData = trimSoul(data)
                if (foundData.project === projectId) result.push(foundData)
                debug && console.log('[GUN node] getAllOnce Data Found: ', typeof foundData, foundData)
            })
            resolve(result)
        } catch (err) {
            reject(err)
        }

    })
}