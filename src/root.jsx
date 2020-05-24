import quip from "quip";
import App from "./App.jsx";

class ClubhouseRoot extends quip.apps.RootRecord {
    static getProperties() {
        return {
            query: "string",
            token: "string",
        };
    }
}

quip.apps.registerClass(ClubhouseRoot, "root");

quip.apps.initialize({
    initializationCallback: function (rootNode) {
        ReactDOM.render(<App/>, rootNode);
    },
});
