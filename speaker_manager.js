/*
* Copyright (c) 2017 Baidu, Inc. All Rights Reserved.
* 
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
* 
*   http://www.apache.org/licenses/LICENSE-2.0
* 
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
///播放器控制类，解决播放列表的问题
const EventEmitter=require("events");
const util = require('util');
const child_process = require('child_process');
const system = require('./system');
const DcsProtocol=require("./dcs_protocol");

function SpeakerManager(){
    this.logicVolume=this.getCurrentVolume();
    this.isMute=false;
    this.handlers={
        "SetVolume":(directive)=>{
            this.logicVolume=directive.payload.volume;
            if(!this.isMute){
                this.setVolume(directive.payload.volume);
            }
        },
        "AdjustVolume":(directive)=>{
            /*
            let currentVolume=this.getCurrentVolume();
            if(currentVolume>0){
                this.logicVolume=currentVolume;
            }
            */
            this.logicVolume=this.logicVolume + directive.payload.volume;
            if(!this.isMute){
                this.setVolume(this.logicVolume);
            }
        },
        "SetMute":(directive)=>{
            this.isMute=directive.payload.mute;
            if(this.isMute){
                this.setVolume(0);
            }else{
                this.setVolume(this.logicVolume);
            }
        }
    };
}
util.inherits(SpeakerManager, EventEmitter);
SpeakerManager.prototype.getContext=function(){
    if(this.logicVolume===null){
        return;
    }
    return {
        "header": {
            "namespace": "ai.dueros.device_interface.speaker_controller",
            "name": "VolumeState"
        },
        "payload": {
            "volume": this.logicVolume,
            "muted": this.isMute
        }
    };
};
SpeakerManager.prototype.handleDirective=function (directive,controller){
    var name=directive.header.name;
    if(this.handlers[name]){
        this.handlers[name].call(this,directive);
        var volume=this.getCurrentVolume();
        setTimeout(()=>{
            controller.emit("event",DcsProtocol.createEvent("ai.dueros.device_interface.speaker_controller","VolumeChanged",controller.getContext(),
                {
                    "volume": this.logicVolume,
                    "muted": this.isMute
                }));
        },0);
    }
}
SpeakerManager.prototype.setVolume=function(volume){
    if(system.get()=="raspberrypi"){
        let output=child_process.execSync("for device in $(amixer controls|awk -F, '{print $2}'|awk -F= '{print $2}'|sort|uniq);do amixer set $device "+volume+"%;done").toString();
        console.log(output);
    }
    if(system.get()=="macos"){
        var f=volume/100*7;
        let output=child_process.execSync('osascript -e "set volume '+f.toFixed(2)+'"').toString();
        return parseInt(output,10);
    }
};

SpeakerManager.prototype.getCurrentVolume=function (){
    if(system.get()=="raspberrypi"){
        try{
            let output=child_process.execSync("for device in $(amixer controls|awk -F, '{print $2}'|awk -F= '{print $2}'|sort|uniq);do amixer get $device;done").toString();
            let matches=output.match(/\[([0-9]+)\%\]/);
            if(matches && matches[1]){
                return parseInt(matches[1],10);
            }else{
                return 100;
            }
        }catch(e){
            return 100;
        }
    }
    if(system.get()=="macos"){
        let output=child_process.execSync('osascript -e "get output volume of (get volume settings)"').toString();
        return parseInt(output,10);
    }
    return null;
};


module.exports=SpeakerManager;
