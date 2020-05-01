import Heartbeat from './HeartbeatModule';
import { setHeartBeat, store } from './LocalStore';


const CountTask = async (name, log) => {

  // Heartbeat.configService(name && typeof name === 'string' ? name : 'Heartbeat Task')
  let state = store.getState()
  let project = state.App.project[1]
  let title = project && typeof project.name === 'string' ? project.name : 'Heartbeat Task'

  store.dispatch(setHeartBeat(state.App.heartBeat + 1))
  let tick = state.App.heartBeat
  Heartbeat.notificationUpdate(tick, title)
  // console.log('State: ', state.App)

};

export default CountTask