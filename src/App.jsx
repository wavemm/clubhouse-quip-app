import quip from "quip";
import LaunchIcon from '@material-ui/icons/Launch';
import ExpansionPanel from '@material-ui/core/ExpansionPanel';
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary';
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails';
import ExpansionPanelActions from '@material-ui/core/ExpansionPanelActions';
import Divider from '@material-ui/core/Divider';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Typography from '@material-ui/core/Typography';
import Toolbar from '@material-ui/core/Toolbar';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';
import Paper from '@material-ui/core/Paper';
import TextField from '@material-ui/core/TextField';
import Card from '@material-ui/core/Card';
import CardHeader from '@material-ui/core/CardHeader';
import CardActions from '@material-ui/core/CardActions';
import CardContent from '@material-ui/core/CardContent';
import Clubhouse from "clubhouse-lib";

const DEFAULT_QUERY = 'is:started'

function TabPanel(props) {
    const {children, value, index, ...other} = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`workflow-tab-${index}`}
            aria-labelledby={`workflow-tab-${index}`}
            {...other}
        >
            {value === index && children}
        </div>
    );
}

export default class App extends React.Component {

    constructor() {
        super();
        var record = quip.apps.getRootRecord();
        this.state = {
            token: (record.has('token') ? record.get('token') : null),
            query: (record.has('query') ? record.get('query') : DEFAULT_QUERY),
            showConfigure: !record.has('token'),
            data: null,
            memberById: null,
            selectedWorkflow: 0
        }
        this.client = null;
    }

    componentDidMount() {
        if (this.state.token) {
            this.fetchData();
        }
    }

    updateMenuToolbar() {
        if (!this.state.token) {
            return;
        }

        if (this.state.showConfigure) {
            quip.apps.updateToolbar({
                toolbarCommandIds: ["results"],
                menuCommands: [
                    {
                        id: "results",
                        label: quiptext("Back to results"),
                        handler: () => this.setState({showConfigure: false}),
                    },
                ]
            });
        } else {
            quip.apps.updateToolbar({
                toolbarCommandIds: ["refresh", "configure"],
                menuCommands: [
                    {
                        id: "refresh",
                        label: quiptext("Refresh"),
                        handler: () => this.fetchData(),
                    },
                    {
                        id: "configure",
                        label: quiptext("Configure"),
                        handler: () => this.setState({showConfigure: true}),
                    },
                ]
            });
        }
    }

    onConfigureSubmit(event) {
        var record = quip.apps.getRootRecord();
        record.set('query', this.state.query);
        if (!record.has('token')) {
            record.set('token', this.state.token);
        }
        this.setState({showConfigure: false});
        this.fetchData();
    }

    initClient() {
        this.client = Clubhouse.create(this.state.token);
        this.client.requestPerformer.performRequest = (r) => fetch(r);
    }

    fetchData() {
        if (this.client === null) {
            this.initClient();
        }
        this.client.listMembers().then((members) => {
            let memberById = {}
            members.forEach((member) => {
                memberById[member.id] = member.profile.name;
            })
            this.client.listWorkflows().then((workflows) => {
                let data = new Map(); // data[workflow][state] = Array[story]
                // Helper function similar to Python's dict.setdefault
                let setDefault = (map, key, _default) => {
                    if (_default === undefined) _default = new Map();
                    if (!map.has(key)) map.set(key, _default)
                    return map.get(key)
                }

                let statesById = {};
                let workflowByStateId = {};

                workflows.forEach((workflow) => {
                    workflow.states.forEach((state) => {
                        statesById[state.id] = state;
                        workflowByStateId[state.id] = workflow;
                    })
                })

                this.client.searchStories(this.state.query).then(
                    (result) => {
                        let stories = result.data;
                        stories.sort((a, b) => a.position - b.position);
                        stories.forEach((story) => {
                            let state = statesById[story.workflow_state_id];
                            let workflow = workflowByStateId[state.id];
                            setDefault(setDefault(data, workflow), state, []).push(story)
                        })
                        this.setState({data: data, memberById: memberById})
                    });
            })
        });


    }

    renderWorkflow(workflow) {
        let storiesByState = this.state.data.get(workflow);
        let states = Array.from(storiesByState.keys());
        // Showing the right-most states first
        states.sort((a, b) => b.position - a.position);
        let renderOwner = (story) => {
            if (story.owner_ids.length === 0) return '';
            return '[' + story.owner_ids.map((member_id) => this.state.memberById[member_id]).join(', ') + '] ';
        }
        return states.map((state) => (
            <Paper>
                <Toolbar variant="dense"><Typography className="quip-text-h3"
                                                     style={{'font-weight': 'bold'}}>{state.name}</Typography></Toolbar>
                <Divider/>
                {storiesByState.get(state).map((story) => (
                    <ExpansionPanel>
                        <ExpansionPanelSummary
                            expandIcon={<ExpandMoreIcon/>}
                        >
                            <Typography variant='body2'
                                        fontSize={"small"}>{renderOwner(story)}{story.name}</Typography>
                        </ExpansionPanelSummary>
                        <ExpansionPanelDetails>
                            <Typography variant="caption"
                                        style={{'max-width': '500px'}}>
                                {story.description}
                            </Typography>
                        </ExpansionPanelDetails>
                        <Divider/>
                        <ExpansionPanelActions>

                            <Button color="primary" variant="contained"
                                    size="small"
                                    startIcon={<LaunchIcon/>}
                                    onClick={() => quip.apps.openLink(story.app_url)}>Open {'#' + story.id} in
                                Clubhouse</Button>
                        </ExpansionPanelActions>
                    </ExpansionPanel>
                ))}

            </Paper>
        ))
    }

    renderConfigure() {
        return (
            <Card>
                <CardHeader title='Configuration'/>
                <CardContent>
                    {!this.state.token ?
                        <TextField label='Clubhouse API token' type='password'
                                   onChange={e => this.setState({token: e.target.value})}/>
                        : <TextField label='Clubhouse API token' type='password'
                                     disabled={true}
                                     value='This cannot be changed'/>
                    }
                    <div>
                        <TextField label='Query' multiline={true} name='query'
                                   onChange={e => this.setState({query: e.target.value})}
                                   value={this.state.query}

                        />
                    </div>

                </CardContent>
                <CardActions>
                    <Button onClick={this.onConfigureSubmit.bind(this)}
                            color='primary'>
                        Save configuration
                    </Button>
                </CardActions>
            </Card>
        )
    }


    render() {
        this.updateMenuToolbar();
        const {showConfigure, selectedWorkflow, data} = this.state

        if (showConfigure) {
            return this.renderConfigure()
        } else if (!data) {
            return <div>Loading data from Clubhouse</div>;
        } else {
            return (
                <Container>
                    <Paper square>
                        <Tabs value={selectedWorkflow} variant="scrollable"
                              scrollButtons="on"
                              onChange={(event, newValue) => {
                                  this.setState({selectedWorkflow: newValue});
                              }}>
                            {Array.from(data.keys()).map((workflow, index) => (
                                <Tab label={workflow.name}
                                     id={`workflow-tab-${index}`}
                                     aria-controls={`simple-tabpanel-${index}`}/>
                            ))}
                        </Tabs>
                    </Paper>
                    {Array.from(data.keys()).map((workflow, index) => (
                        <TabPanel value={selectedWorkflow} index={index}>
                            {this.renderWorkflow(workflow)}
                        </TabPanel>
                    ))}
                </Container>
            )
        }
    }
}

