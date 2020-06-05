import React, {Component} from 'react';
import {BrowserRouter, NavLink, Route} from 'react-router-dom';

import Home from "./components/Home"
import Lobby from "./components/Lobby"
import SignUp from "./components/SignUp"
import SignIn from "./components/SignIn"
import {Layout, Select, Spin, Typography} from 'antd';
import './App.css';
import LinkMenu from "./components/linkMenu";
import SignOut from "./components/SignOut";
import Program from "./components/Program";
import VideoRoom from "./components/VideoChat/VideoRoom"
import SlackToVideo from "./components/Slack/slackToVideo"

import {withAuthentication} from "./components/Session";

import LiveStreaming from "./components/LiveStreaming";
import Parse from "parse";

import Account from "./components/Account";
import VideoChat from "./components/VideoChat";
// import ScheduleList from "./components/Admin/Schedule";
// import UsersList from "./components/Admin/Users";
//
import LiveVideosList from "./components/Admin/LiveVideos";
import withParseLive from "./components/parse/withParseLive";
import withGeoLocation from './components/GeoLocation/withGeoLocation';
// import EditUser from "./components/Admin/Users/EditUser";
// import ChannelList from "./components/ChannelList";
//import Chat from "./components/Chat";
import ContextualActiveUsers from "./components/Lobby/ContextualActiveusers";
import GenericHeader from "./components/GenericHeader";
import GenericLanding from "./components/GenericLanding";

Parse.initialize(process.env.REACT_APP_PARSE_APP_ID, process.env.REACT_APP_PARSE_JS_KEY);
Parse.serverURL = process.env.REACT_APP_PARSE_DATABASE_URL;

const {Header, Content, Footer, Sider} = Layout;

class App extends Component {

    constructor(props) {
        super(props);
        // this.state ={'activeKey'=routing}
        this.state = {
            conference: null,
            collapsed: false,
            showingLanding: this.props.authContext.showingLanding
        }
    }

    isSlackAuthOnly() {
        if(!this.state.conference)
            return true;
        return !this.state.conference.get("isIncludeAllFeatures");
    }

    siteHeader() {
        if (!this.state.conference){
            return <GenericHeader/>
        } else {
            let headerImage = this.state.conference.get("headerImage");
            let headerText = this.state.conference.get("headerText");
            let confSwitcher;
            if(this.props.authContext && this.props.authContext.validConferences.length > 1 && this.isSlackAuthOnly()){
                confSwitcher = <Select style={{width: 200, float: "right"}}
                                       placeholder="Change conference"
                                       onChange={(conf)=>{
                                           console.log(conf);
                    this.props.authContext.helpers.setActiveConference(this.props.authContext.validConferences[conf]);
                }}>
                    {
                        this.props.authContext.validConferences.map((conf,i)=>
                            <Select.Option key={i}>{conf.get("conferenceName")}</Select.Option>)
                    }
                </Select>
            }
            if (headerImage)
                return <Header className="site-layout-background" style={{height: "140px", clear: "both"}}>
                    <img src={headerImage.url()} className="App-logo" height="140"
                         alt="logo"/><span style={{paddingLeft: "20px"}}><Typography.Title
                    style={{display: "inherit"}}>{headerText}</Typography.Title>{confSwitcher}</span>
                </Header>
            else if (headerText) {
                return <Header className="site-layout-background" style={{height: "140px", clear: "both"}}>
                    <Typography.Title>{headerText}</Typography.Title>{confSwitcher}
                </Header>
            } else
                return <Header className="site-layout-background" style={{clear:'both' }}>
                   <div style={{float:'left'}}><Typography.Title>
                       {this.state.conference.get('conferenceName')} Group Video Chat</Typography.Title></div>{confSwitcher}</Header>
        }
    }

    navBar() {
        if (this.isSlackAuthOnly()) {
            return <div></div>
        }
        return <Header><LinkMenu/></Header>

    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (!prevProps.authContext || prevProps.authContext.currentConference != this.props.authContext.currentConference) {
            this.refreshConferenceInformation();
        }
        if(this.props.authContext.showingLanding != this.state.showingLanding){
            this.setState({showingLanding: this.props.authContext.showingLanding});
        }
    }

    componentDidMount() {
        if (this.props.authContext.currentConference)
            this.refreshConferenceInformation();
    }

    refreshConferenceInformation() {
        this.setState({conference: this.props.authContext.currentConference});
    }

    routes() {
        if (this.isSlackAuthOnly()) {
            return <div><Route exact path="/" component={Lobby}/>
                <Route exact path="/fromSlack/:team/:roomName/:token" component={SlackToVideo}/>
                <Route exact path="/video/:conf/:roomName" component={VideoRoom}/>
                <Route exact path="/signout" component={SignOut}/>
                <Route exact path="/lobby" component={Lobby}/>
                <Route exact path="/signin" component={SignIn}/>

                <Route exact path="/admin" component={(props)=><SignIn {...props} dontBounce={true}/>} />
            </div>

        }
        return (<div>
            <Route exact path="/" component={Home}/>
            <Route exact path="/live" component={LiveStreaming}/>
            <Route exact path="/program" component={Program}/>
            <Route exact path="/fromSlack/:team/:roomName/:token" component={SlackToVideo}/>
            <Route exact path="/video/:conf/:roomName" component={VideoRoom}/>


            {/*<Route exact path="/channelList" component={ChannelList}/>*/}

            <Route exact path="/account" component={Account}/>
            <Route exact path="/videoChat/:roomId" component={VideoChat}/>
            <Route exact path="/lobby" component={Lobby}/>
            <Route exact path="/signup" component={SignUp}/>
            <Route exact path="/signin" component={SignIn}/>
            <Route exact path="/signout" component={SignOut}/>
            <Route exact path="/admin" component={(props)=><SignIn {...props} dontBounce={true}/>} />

            {/*<Route exact path='/admin/schedule' component={withAuthentication(ScheduleList)} />*/}
            {/*<Route exact path='/admin/users' component={withAuthentication(UsersList)} />*/}
            {/*<Route exact path='/admin/users/edit/:userID' component={withAuthentication(EditUser)} />*/}
            <Route exact path='/admin/livevideos' component={LiveVideosList}/>
        </div>)
    }

    setCollapsed(collapsed) {
        console.log(collapsed)
        this.setState({collapsed: collapsed});
    }

    render() {
        if(this.state.showingLanding){
            return <GenericLanding />
        }
        if (!this.state.conference) {
            if (this.state.loadingUser) {
                return <div style={{
                    height: "100vh",
                    width: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                }}>
                    <Spin/>
                </div>
            }
        }
        return (
            <BrowserRouter basename={process.env.PUBLIC_URL}>
                <div className="App">
                    <Layout className="site-layout">
                        {this.siteHeader()}
                        <Layout>
                            {this.navBar()}

                            <Layout>
                                <Sider collapsible collapsed={this.state.collapsed}
                                       trigger={null}
                                       onCollapse={this.setCollapsed.bind(this)} width="350px"
                                       style={{backgroundColor: '#f0f2f5'}}>
                                    <ContextualActiveUsers collapsed={this.state.collapsed}
                                                           setCollapsed={this.setCollapsed.bind(this)}/>
                                </Sider>
                                <Content style={{margin: '24px 16px 0', overflow: 'initial'}}>
                                    <div className="site-layout-background" style={{padding: 24}}>
                                        {this.routes()}
                                    </div>
                                </Content>

                            </Layout>
                        </Layout>
                    </Layout>

                    {/* <div style={{position:
                    "sticky", bottom: 0}}>
                        <Chat />
                    </div> */}
                </div>
            </BrowserRouter>
        );
    }
}

export default withAuthentication(withParseLive(withGeoLocation(App)));
