import React from 'react';

import AuthUserContext from './context';
import Parse from "parse";
import Chat from "twilio-chat";
import {Spin} from "antd";

const withAuthentication = Component => {
    class WithAuthentication extends React.Component {

        constructor(props) {
            super(props);
            this.authCallbacks = [];
            this.isLoggedIn = false;
            this.loadingProfiles = {};
            this.profiles = {};
            this.chatWaiters = [];
            this.liveChannel = null;
            this.channelChangeListeners = [];
            let exports ={
                getUsers: this.getUsers.bind(this),
                getRoleByName: this.getRoleByName.bind(this),
                setActiveConference: this.setActiveConference.bind(this),
                populateMembers: this.populateMembers.bind(this),
                setGlobalState: this.setState.bind(this)//well that seems dangerous...
            }
            this.state = {
                user: null,
                loading: true,
                roles: [],
                currentRoom: null,
                refreshUser: this.refreshUser.bind(this),
                initChatClient: this.initChatClient.bind(this),
                getUserProfile: this.getUserProfile.bind(this),
                getChatClient: this.getChatClient.bind(this),
                getLiveChannel: this.getLiveChannel.bind(this),
                setLiveChannelByName: this.setLiveChannelByName.bind(this),
                addLiveChannelListener: this.addLiveChannelListener.bind(this),
                removeLiveChannelListener: this.removeLiveChannelListener.bind(this),
                setActiveConferenceBySlack: this.setActiveConferenceBySlack.bind(this),
                setActiveConferenceByName: this.setActiveConferenceByName.bind(this),
                setActiveRoom: this.setActiveRoom.bind(this),
                teamID: null,
                currentConference: null,
                activeRoom: null,
                helpers: exports
            };
            this.fetchingUsers = false;
        }

        async getUsers() {
            if (this.state.users || this.fetchingUsers)
                return;
            this.fetchingUsers = true;
            let roleQ = new Parse.Query(Parse.Role);
            roleQ.equalTo("name",this.state.currentConference.id+"-conference");
            let role = await roleQ.first();
            let parseUserQ = role.getUsers().query();
            parseUserQ.limit(1000);
            parseUserQ.withCount();
            let nRetrieved = 0;
            let {count, results} = await parseUserQ.find();
            nRetrieved = results.length;
            let allUsers = [];
            allUsers = allUsers.concat(results);
            while (nRetrieved < count) {
                let parseUserQ = roleQ.getUsers().query();
                parseUserQ.limit(1000);
                parseUserQ.skip(nRetrieved);
                let results = await parseUserQ.find();
                // results = dat.results;
                nRetrieved += results.length;
                if (results)
                    allUsers = allUsers.concat(results);
            }
            let usersByID = {};
            allUsers.forEach((u)=>usersByID[u.id]=u);
            this.setState({users: usersByID});
        }

        async setActiveConference(conf) {
            this.setState({loading: true});
            let session = await Parse.Session.current();
            session.set("currentConference", conf);
            session.save();
            this.setState({currentConference: conf, users: null});
            this.setState({loading: false});
        }

        async getRoleByName(role) {
            let existingRoles = this.state.roles.find(i => i.get("name") == role);
            if(existingRoles)
                return existingRoles;
            //Make sure to refresh first...
            const roleQuery = new Parse.Query(Parse.Role);
            roleQuery.equalTo("users", this.state.user);
            const roles = await roleQuery.find();
            existingRoles = roles.find(i => i.get("name") == role);
            if(existingRoles){
                this.setState({roles: roles});
                return existingRoles;
            }
            if(!existingRoles){
                //maybe we are a mod.
                let roleQ = new Parse.Query(Parse.Role);
                roleQ.equalTo("name", role);
                existingRoles = await roleQ.first();
                return existingRoles;
            }
            return null;
        }
        setActiveRoom(room) {
            this.setState({activeRoom: room});
        }

        async setActiveConferenceByName(confName){
            let confQ = new Parse.Query("ClowdrInstance");
            confQ.equalTo("conferenceName", confName);
            let res = await confQ.first();
            let session = await Parse.Session.current();
            session.set("currentConference", res);
            session.save();
            this.setState({currentConference: res});
            return res;
        }
        async setActiveConferenceBySlack(teamId) {
            let confQ = new Parse.Query("ClowdrInstance");
            confQ.equalTo("slackWorkspace", teamId);
            let res = await confQ.first();
            let session = await Parse.Session.current();
            session.set("currentConference", res);
            session.save();
            this.setState({currentConference: res});

            return res;
        }

        // activeConference(teamID){
        //     if(teamID){
        //         this.setState({teamID: teamID})
        //     }
        //     else{
        //         return this.state.teamID;
        //     }
        // }

        getLiveChannel(cb) {
            if (this.liveChannel)
                cb(this.liveChannel);
            else
                this.setLiveChannelByName("general").then(() => {
                    cb(this.liveChannel)
                });
        }

        setLiveChannelByName(channelName) {
            let _this = this;
            return this.chatClient.getChannelByUniqueName(channelName).then(async (chan) => {
                _this.liveChannel = chan;
                try {
                    let room = await chan.join();
                } catch (err) {
                    //allready joined
                }
                this.channelChangeListeners.forEach((cb) => cb(chan));
            });
        }

        removeLiveChannelListener(cb) {
            this.channelChangeListeners = this.channelChangeListeners.filter((v) => v != cb);
        }

        addLiveChannelListener(cb) {
            this.channelChangeListeners.push(cb);
        }

        getChatClient(callback) {
            if (this.chatClient)
                callback(this.chatClient);
            else
                this.chatWaiters.push(callback);
        }

        async initChatClient(token) {
            if (!token)
                return undefined;
            if (!this.chatClient) {
                console.log("Created a new chat client");
                this.chatClient = await Chat.create(token);
                // await this.chatClient.initialize();
                this.chatWaiters.forEach((p) => p(this.chatClient));
                this.setLiveChannelByName("general");
            }
            return this.chatClient;
        }

        getUserProfile(authorID, callback) {
            //DEPRECATED
            console.log("This is deprecated and probably broken")
            if (!this.profiles[authorID]) {
                if (this.loadingProfiles[authorID]) {
                    this.loadingProfiles[authorID].push(callback);
                } else {
                    this.loadingProfiles[authorID] = [callback];
                    const query = new Parse.Query(Parse.User);
                    let _this = this;
                    return query.get(authorID).then((u) => {
                        _this.profiles[authorID] = u;
                        this.loadingProfiles[authorID].forEach(cb => cb(u));
                    }).catch(err => {
                        //no such user
                    });
                }
            }
            if (this.profiles[authorID]) {
                setTimeout(() => {
                    callback(this.profiles[authorID])
                }, 0);
            }
        }
        async getUserRecord(uid){
            if(this.state.users && this.state.users[uid])
                return this.state.users[uid];
            else{
                let uq = new Parse.Query(Parse.User);
                return await uq.get(uid);
            }
        }
        async populateMembers(breakoutRoom){
            let promises =[];
            if(breakoutRoom.get('members')) {
                for (let i = 0; i < breakoutRoom.get("members").length; i++) {
                    let member = breakoutRoom.get("members")[i];
                    if (!member.get("displayname")) {
                        promises.push(this.getUserRecord(member.id).then((fullUser) => {
                                breakoutRoom.get("members")[i] = fullUser;
                            }
                        ))
                    }
                }
                return Promise.all(promises).then(()=>breakoutRoom);
            }
            return breakoutRoom;
        }
        refreshUser(callback) {

            let _this = this;
            return Parse.User.currentAsync().then(async function (user) {
                if (user) {
                    console.log(user);
                    const query = new Parse.Query(Parse.User);
                    query.include(["tags.label", "tags.color", "roles.name"]);
                    try {
                        let userWithRelations = await query.get(user.id);

                        if (!_this.isLoggedIn) {
                            _this.isLoggedIn = true;
                            _this.authCallbacks.forEach((cb) => (cb(userWithRelations)));
                        }
                        let session = await Parse.Session.current();
                        console.log("Got session:")
                        console.log(session);
                        const roleQuery = new Parse.Query(Parse.Role);
                        roleQuery.equalTo("users", userWithRelations);

                        const roles = await roleQuery.find();
                        console.log(roles);
                        let isAdmin = false;
                        let validConferences = [];

                        let validConfQ= new Parse.Query("ClowdrInstanceAccess");
                        validConfQ.include('instance');
                        let validInstances = await validConfQ.find();
                        validConferences=validInstances.map(i=>i.get("instance"));

                        let conf = _this.state.currentConference;
                        if (session.get("currentConference")) {
                            let confID = session.get("currentConference").id;
                            let q = new Parse.Query("ClowdrInstance");
                            conf = await q.get(confID);
                        }
                        if (!conf) {
                            for (let role of roles) {
                                if (role.get("name") == "ClowdrSysAdmin")
                                    isAdmin = true;
                            }
                            if (process.env.REACT_APP_DEFAULT_CONFERENCE) {
                                console.log(process.env.REACT_APP_DEFAULT_CONFERENCE)
                                for (let c of validConferences) {
                                    console.log(c.get("conferenceName"))
                                }
                                conf = validConferences.find((c) => c.get("conferenceName") == process.env.REACT_APP_DEFAULT_CONFERENCE);
                                if (!conf) {
                                    console.log("This user does nto have access to " + process.env.REACT_APP_DEFAULT_CONFERENCE);
                                    conf = validConferences[0];
                                }
                            } else
                                conf = validConferences[0];
                        }
                        _this.setState({
                            user: userWithRelations,
                            teamID: session.get("activeTeam"),
                            isAdmin: isAdmin,
                            validConferences: validConferences,
                            currentConference: conf,
                            loading: false,
                            roles: roles
                        });

                        if (callback) {
                            _this.authCallbacks.push(callback);
                            callback(userWithRelations);
                        }
                        return userWithRelations;
                    } catch (err) {
                        console.log(err);
                        try {
                            await Parse.User.logOut();
                            _this.setState({loading: false, user: null});
                        }catch(err2){
                            console.log(err2);
                        }
                        return null;
                    }
                } else {
                    if (_this.isLoggedIn) {
                        _this.isLoggedIn = false;
                        _this.authCallbacks.forEach((cb) => (cb(null)));
                    }
                    if (_this.chatClient) {
                        await _this.chatClient.shutdown();
                        _this.chatClient = null;
                    }
                    _this.setState({
                        user: null,
                        loading: false
                    })
                    if (callback) {
                        _this.authCallbacks.push(callback);
                        callback(null);
                    }

                    return null;
                }
                // do stuff with your user
            });
        }

        componentDidMount() {
            this.refreshUser();
        }

        componentWillUnmount() {
        }

        render() {
            if (this.state.loading)
                return <div><Spin size="large"/>
                </div>
            return (
                <AuthUserContext.Provider value={this.state}>
                    <Component {...this.props}  authContext={this.state} />
                </AuthUserContext.Provider>
            );
        }
    }

    return WithAuthentication;
};

export default withAuthentication;
