import React, {Component} from "react";
import {Button, Spin} from 'antd';
import moment from 'moment';
import AuthUserContext from "../Session/context";
import {ProgramContext} from "../Program";
import ReactPlayer from "react-player";
import {videoURLFromData} from './utils';
import { CollectionsOutlined } from "@material-ui/icons";
import { NavLink } from "react-router-dom";

class LiveStreamingPanel extends Component {
    constructor(props) {
        // props.parseLive
        super(props);
        this.state = {
            expanded: false,
            count: 0,
            video_url: undefined, 
            china: false
        };
    }
    
    changeSocialSpace() {
        if(this.props.video.get("socialSpace")) {
            //set the social space...
            let ss = this.props.video.get("socialSpace");
            // console.log('--> SS ' + ss)
            this.props.auth.setSocialSpace(ss.get("name"));
            this.props.auth.helpers.setGlobalState({forceChatOpen: true});
        }        

    }

    joinChatChannels() {
        var items = [];
        this.props.mysessions.map(session => {
            if (session.get("items")) 
                items = items.concat(session.get("items")) 
        });
        console.log('--> room: ' + this.props.video.get("name") + ": "+ items.length);

        // items.map(i => console.log("item: " + i.id+ " " + i.get("title") ));
        let chatChannels = items.map(i => i.get("chatSID"));
        chatChannels.map(cc => {
            if (cc) {
                console.log('[Live]: joining chat channel ' + cc);
                this.props.auth.chatClient.openChatAndJoinIfNeeded(cc);
            }
        })
    }

    joinChatChannel(sid) {
        if (sid)
            this.props.auth.chatClient.openChatAndJoinIfNeeded(sid);
        else
            console.log('[Live]: trying to joing chat channel with undef sid. Ignoring.');
    }

    async componentDidMount() {
        let country = this.props.auth.userProfile.get("country");
        var src = this.props.video.get("src1");
        var id = this.props.video.get("id1");
        var pwd = this.props.video.get("pwd1");

        var inChina = false;
        if (country && (country.toLowerCase().includes("china") || country.toLowerCase().trim() == "cn")) {
            src = this.props.video.get("src2");
            id = this.props.video.get("id2");
            inChina = true;
            console.log('User in China!');
        }
        // else
        //     console.log('User in ' + country ? country : "Unknown");
        // Where is this user?
        this.setState({video_url: src ? videoURLFromData(src, id, pwd, country): "", china:inChina});
    }

    componentWillUnmount() {
        if (this.state.expanded)
            this.props.auth.setSocialSpace("Lobby");
    }

    toggleExpanded() {
//        console.log('--> ' + this.state.expanded);
        if (!this.state.expanded) {// about to expand
            this.changeSocialSpace();
            // this.joinChatChannels();
        }
        else
            this.props.auth.setSocialSpace("Lobby");

        this.setState({
            expanded: !this.state.expanded
        });
        this.props.onExpand(this.props.video);
    }

    componentDidUpdate(prevProps) {
    }
    
    render() {

        let qa = "";
        if (this.props.vid && this.props.vid.id !== this.props.video.id) { // It's not us! Unmount!
            return ""
        }
        
        let navigation="";
        let sessionData = "";
        let roomName = this.props.video.get('name');
        if (this.state.expanded) {
            navigation = <Button type="primary" onClick={this.toggleExpanded.bind(this)}>Go Back</Button>
            let lengths = this.props.mysessions.map(s => (s.get("items") ? s.get("items").length : 0));
            let nrows = Math.max(...lengths);
            var rows = [];
            for (var r = 0; r < nrows; r++) {
                var row = [];
                for (var s = 0; s < this.props.mysessions.length; s++) {
                    let value = "";
                    let sid = "";
                    if (this.props.mysessions[s].get("items") &&  r < this.props.mysessions[s].get("items").length) {
                        value =  this.props.mysessions[s].get("items")[r].get("title");
                        sid = this.props.mysessions[s].get("items")[r].get("chatSID");
                    }
                    row = [...row, [value, sid]];
                }
                rows = [...rows, row];
            }
            // console.log(JSON.stringify(rows));
        
            sessionData = <table><tbody>
                <tr>{this.props.mysessions.map(s => {
                            return <td key={s.id}><b>{s.get("title")}</b></td>
                        })}</tr>
                        {rows.map(row => {
                            return <tr>{row.map(pair => {
                                return <td>{pair[1] ? <a href="#" onClick={this.joinChatChannel.bind(this, pair[1])}>{pair[0]}</a> : pair[0]}</td>
                            })}</tr>
                        })}
                </tbody></table>
        }
        else {
            navigation = <Button type="primary" onClick={this.toggleExpanded.bind(this)}>Enter</Button>
            roomName = this.props.video.get('name').length < 10 ? this.props.video.get('name'): 
                        <span title={this.props.video.get('name')}>{this.props.video.get('name').substring(0,10) + "..."}</span>;

            sessionData = this.props.mysessions.map(s => {
                            return <div key={s.id}>{s.get("title")}</div>
                        })

        }
        let viewers = 0;
        if (this.props.auth.presences) {
            let presences = Object.values(this.props.auth.presences);
            let pplInThisRoom = presences.filter(p => {
                return (p.get("socialSpace") && this.props.video.get("socialSpace") &&
                        p.get("socialSpace").id === this.props.video.get("socialSpace").id);
            });
            viewers = pplInThisRoom.length;
        }

        if (!this.state.video_url)
            return <Spin />

        let player = "";
        if (!this.state.china) {
            player = <ReactPlayer playing playsinline controls={true} muted={true} volume={1} 
                        width="100%" height="100%" style={{position:"absolute", top:0, left:0}} url={this.state.video_url}/>
        }
        else {
            player = <iframe width="100%" height="100%" style={{position:"absolute", top:0, left:0}} src={this.state.video_url}/>
        }
        return  <div>
                    <table style={{width:"100%"}}>
                        <tbody>
                        <tr >
                            <td style={{"textAlign":"left"}}><strong>{roomName}</strong></td>
                            <td style={{"textAlign":"left"}}>Viewers: {viewers}</td>
                            <td style={{"textAlign":"right"}}><strong>{navigation}</strong></td>
                        </tr>
                        </tbody>
                    </table>
                    <div className="player-wrapper" >{player}</div>
                    <div>
                        {sessionData}
                        {/* {this.props.mysessions.map(s => {
                            return <div key={s.id}>{s.get("title")}</div>
                        })} */}
                    </div>
                </div>
    }
}

export default LiveStreamingPanel;
