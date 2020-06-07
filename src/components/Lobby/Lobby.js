import React from 'react';
import {Avatar, Card, Divider, Layout, List, message, Popconfirm, Space, Typography, Spin} from "antd";
import {AuthUserContext} from "../Session";
import ParseLiveContext from "../parse/context";
import Parse from "parse";
import NewRoomForm from "./NewRoomForm";
import withLoginRequired from "../Session/withLoginRequired";

const { Content, Footer, Sider} = Layout;

// const {TabPane} = Tabs;
// const IconText = ({icon, text}) => (
//     <Space>
//         {React.createElement(icon)}
//         {text}
//     </Space>
// );


class MeetingSummary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {loadingMeeting: false, loading: false, members: this.props.item.members, profiles: {}};
    }

    componentDidMount() {
        // let ref = this.props.firebase.db.ref("users");
        // if (this.props.item && this.props.item.members)
        //     Object.keys(this.props.item.members).forEach((key) => {
        //         ref.child(key).once("value").then((v) => {
        //             this.setState((prevState) => {
        //                 let members = Object.assign({}, prevState.members);
        //                 members[key] = v.val();
        //                 return {members};
        //             })
        //         })
        //     })
    }

    differentMembers(a, b) {
        if (a && b)
            for (let i = 0; i < a.length && i < b.length; i++) {
                if (a[i] !== b[i])
                    return true;
                if (a[i] && b[i] && a[i].id !== b[i].id)
                    return true;
                if(a[i].get("displayname") !== b[i].get("displayname") || a[i].get("profilePhoto") !== b[i].get("profilePhoto"))
                    return true;
            }
        return false;
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.props.item.get('members') !== prevProps.item.get('members') || this.differentMembers(this.props.item.get("members"), prevProps.item.get("members"))) {
            this.setState({members: this.props.item.members});
        }
    }

    joinMeeting(meeting) {
        if (meeting.get("twilioID") && meeting.get('twilioID').startsWith("demo")) {
            message.error('Sorry, you can not join the demo meetings. Try to create a new one!');

        } else {
            console.log(meeting.get("conference"))
            this.props.history.push("/video/" + encodeURI(meeting.get("conference").get("conferenceName"))+ '/'+encodeURI(meeting.get("title")));
        }
    }

    render() {
        let item = this.props.item;
        let _this = this;
        return <Card title={item.get('title')} style={{width: "350px", "height": "350px", overflow: "scroll"}}
                     size={"small"}
                     extra={<Popconfirm
                         title="You are about to join a video call. Are you ready?"
                         onConfirm={_this.joinMeeting.bind(_this, item)}
                         okText="Yes"
                         cancelText="No"
                     ><a href="#">Join</a></Popconfirm>}
        >
            {(item.get('members') ? <span>
                {/*<h4>Currently here:</h4>*/}
                {/*<Divider orientation="left">Here now:</Divider>*/}
                <List
                    dataSource={item.get('members').filter((v)=>(v != null ))}
                    size={"small"}
                    renderItem={user => {
                        let avatar;
                        if (user.get("profilePhoto"))
                            avatar = <Avatar src={user.get("profilePhoto").url()}/>
                        else {
                            let initials = "";
                            if(user.get("displayname"))
                                user.get("displayname").split(" ").forEach((v=>initials+=v.substring(0,1)))

                            avatar = <Avatar>{initials}</Avatar>
                        }
                        return <List.Item key={user.id}>
                            <List.Item.Meta
                                avatar={
                                    avatar
                                }
                                title={user.get("displayname")}
                            />
                        </List.Item>
                    }}
                >
                    {this.state.loading && this.state.hasMore && (
                        <div className="demo-loading-container">
                            <Spin/>
                        </div>
                    )}
                </List>
            </span> : <span>Nobody's here yet</span>)}

        </Card>

    }
}

class Lobby extends React.Component {
    constructor(props) {
        super(props);
        this.state = {'loading': true, 'visible': false, maxDisplayedRooms: 10};
    }

    componentDidMount() {
        let user = this.props.auth.user;
        if (user) {
            if (this.sub) {
                this.sub.unsubscribe();
                this.sub = null;
            }
            let query = new Parse.Query("BreakoutRoom");
            query.include("members");
            query.addDescending("createdAt");
            query.equalTo("conference", this.props.auth.currentConference);

            query.find().then(res => {
                this.setState({
                    rooms: res,
                    loading: false
                });
                this.sub = this.props.parseLive.subscribe(query, this.props.auth.user.getSessionToken());
                this.sub.on('create', async (newItem) => {
                    newItem = await this.props.auth.helpers.populateMembers(newItem);
                    this.setState((prevState) => ({
                        rooms: [newItem, ...prevState.rooms]
                    }))
                })
                this.sub.on('update', async (newItem) => {
                    newItem = await this.props.auth.helpers.populateMembers(newItem);
                    this.setState((prevState) => ({
                        rooms: prevState.rooms.map(room => room.id === newItem.id ? newItem : room)
                    }))
                })
                this.sub.on("delete", vid => {
                    this.setState((prevState) => ({
                        rooms: prevState.rooms.filter((v) => (
                            v.id !== vid.id
                        ))
                    }));
                });
            })
        }
    }

    componentWillUnmount() {
        if(this.sub) {
            this.sub.unsubscribe();
        }
    }

    async onCreate(values) {
        let user = this.props.auth.user;
        let idToken = user.getSessionToken();
        const data = await fetch(
            `${process.env.REACT_APP_TWILIO_CALLBACK_URL}/video/new`

            // 'http://localhost:3001/video/token'
            , {
                method: 'POST',
                body: JSON.stringify({
                    room: values.title,
                    identity: idToken,
                    slackTeam: this.props.auth.currentConference.get("slackWorkspace"),
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        let res = await data.json();
        if(res.status === "error"){
            message.error(res.message);
        }
        else{
            this.props.history.push("/video/"+encodeURI(this.props.auth.currentConference.get("conferenceName"))+"/"+encodeURI(values.title));
        }
        // var _this = this;
        // let Room =Parse.Object.extend("BreakoutRoom");
        // let room = new Room();
        // room.set("title", values.title);
        // room.set("creator", this.props.auth.user);
        // // room.set("description", values.description);
        // // room.set("ephemeral",true);
        // room.set("conference", this.props.auth.currentConference);
        // room.save().then((val) => {
        //     _this.props.history.push("/video/" + room.id);
        // }).catch(err => {
        //     console.log(err);
        // });
    }

    setVisible() {
        this.setState({'visible': !this.state.visible});
    }


    displayMore() {
        this.setState((prevState) => ({
            maxDisplayedRooms: prevState.maxDisplayedRooms + 10
        }));
    }

    hasMoreRoomsToShow() {
        return this.state.maxDisplayedRooms < this.state.rooms.length;
    }

    render() {
        if (this.state.loading) {
            return (
                <Spin tip="Loading...">
                </Spin>)
        }
        return (
            // <Tabs defaultActiveKey="1">
            //     <TabPane tab="Breakout Areas" key="1">
            <div>
                <Typography.Title level={2}>Lobby Session</Typography.Title>

                <Typography.Paragraph>
                Some say that the most valuable part of an academic conference is the "lobby track" - where
                colleagues meet, catch up, and share
                casual conversation. To bring the metaphor into the digital world, the digital lobby session
                allows you to create a small group video chat, and switch between group chats. Take
                a look at the breakout rooms that participants have formed so far and join one, or create a new
                one!
                </Typography.Paragraph>
                <NewRoomForm style={{float: "right", paddingTop: "5px"}}/>

                <Space />
                <Divider/>
                    <div style={{maxHeight: "80vh", overflow: 'auto', border: '1px sold #FAFAFA'}}>
                        {/*<InfiniteScroll*/}
                        {/*    pageStart={0}*/}
                        {/*    // hasMore={Object.keys(this.state.activeUsers).length >= 20}*/}
                        {/*    hasMore={this.hasMoreRoomsToShow()}*/}
                        {/*    loadMore={this.displayMore.bind(this)}*/}
                        {/*    useWindow={false}*/}
                        {/*    initialLoad={false}*/}
                        {/*    loader={<Spin>Loading...</Spin>}*/}
                        {/*>*/}
                            <Space style={{
                                maxWidth: '80vw',
                                display: "flex",
                                marginLeft: "20px",
                                flexWrap: "wrap"
                            }}>
                                {
                                    Object.values(this.state.rooms).slice(0, this.state.maxDisplayedRooms).map((item) => (
                                        <MeetingSummary history={this.props.history} key={item.id} item={item} parseLive={this.props.parseLive} auth={this.props.auth} />
                                    ))}
                            </Space>
                        {/*</InfiniteScroll>*/}
                    </div>
                </div>
        );
    }
}

const AuthConsumer = (props) => (
    <ParseLiveContext.Consumer>
        {parseValue => (
            <AuthUserContext.Consumer>
                {value => (
                    <Lobby {...props} auth={value} parseLive={parseValue}/>
                )}
            </AuthUserContext.Consumer>
        )
        }

    </ParseLiveContext.Consumer>
);
export default withLoginRequired(AuthConsumer);