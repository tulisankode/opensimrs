import LogPelayananListener from "./log-pelayanan-listener.js";

export default class EventListener{
    static init(){
        LogPelayananListener.registerEvent();
    }
}