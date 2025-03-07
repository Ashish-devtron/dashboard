import { BehaviorSubject } from 'rxjs';
import { ApplicationObject, iNode } from './appDetails.type';
import { URLS } from '../../../config';

let applicationObjectTabsSubject: BehaviorSubject<Array<ApplicationObject>> = new BehaviorSubject(
    [] as Array<ApplicationObject>,
);
let _nodeTreeActiveParentNode: iNode;
let _nodeTreeActiveNode: iNode;
let _maxTabAllowd = 6;

const addAOT = (tabName: string, tabUrl: string, isSelected: boolean, title?: string) => {
    let tab = {} as ApplicationObject;
    tab.name = tabName;
    tab.url = tabUrl;
    tab.isSelected = isSelected;
    tab.title = title || tabName;
    tab.isDeleted = false;
    return tab;
};

export const AppDetailsTabs = {
    k8s_Resources: 'K8s Resources',
    log_analyzer: 'Log Analyzer',
};

const AppDetailsStore = {
    getAppDetailsTabs: () => {
        return applicationObjectTabsSubject.getValue();
    },
    getAppDetailsTabsObservable: () => {
        return applicationObjectTabsSubject.asObservable();
    },
    initAppDetailsTabs: (
        _url: string,
        displayLogAnalyzer: boolean,
        isLogAnalyserURL: boolean,
        isResourceBrowserView?: boolean,
        nodeType?: string,
    ) => {
        const aots = [] as Array<ApplicationObject>
        const url = `${_url}${_url.endsWith('/') ? '' : '/'}`

        aots.push(
            addAOT(
                AppDetailsTabs.k8s_Resources,
                `${url}${isResourceBrowserView ? `${nodeType ?? ''}` : URLS.APP_DETAILS_K8}`,
                !isLogAnalyserURL,
                AppDetailsTabs.k8s_Resources,
            ),
        )

        if (displayLogAnalyzer) {
            aots.push(
                addAOT(
                    AppDetailsTabs.log_analyzer,
                    _url + '/' + URLS.APP_DETAILS_LOG,
                    isLogAnalyserURL,
                    AppDetailsTabs.log_analyzer,
                ),
            )
            _maxTabAllowd = 7
        }

        applicationObjectTabsSubject.next([...aots])

        _nodeTreeActiveParentNode = undefined
        _nodeTreeActiveNode = undefined
    },
    addAppDetailsTab: (objectKind: string, objectName: string, tabURL: string) => {
        if (!objectName || !tabURL || !objectKind) return;

        let applicationObjectTabs = applicationObjectTabsSubject.getValue();

        let alreadyAdded = false;
        let title = objectKind + '/' + objectName;
        objectName = `${objectKind.length <= 7 ? objectKind : `${objectKind.slice(0, 7)}...`}/...${objectName.slice(-6)}`

        for (let index = 0; index < applicationObjectTabs.length; index++) {
            const tab = applicationObjectTabs[index];
            tab.isSelected = false;
            if (tab.title.toLowerCase() === title.toLowerCase()) {
                tab.isSelected = true;
                tab.url = tabURL;
                alreadyAdded = true;
            }
        }

        if (!alreadyAdded) {
            if (applicationObjectTabs.length === _maxTabAllowd) {
                return false;
            }
            applicationObjectTabs.push(addAOT(objectName, tabURL, true, title));
        }

        applicationObjectTabsSubject.next([...applicationObjectTabs]);

        return true;
    },
    removeAppDetailsTabByIdentifier: (title: string): string => {
        const applicationObjectTabs = applicationObjectTabsSubject.getValue();
        let pushURL = '';

        var selectedRemoved = false;

        var remainingTabs = [] as Array<ApplicationObject>;
        for (let index = 0; index < applicationObjectTabs.length; index++) {
            const tab = applicationObjectTabs[index];
            if (tab.title.toLowerCase() == title.toLowerCase()) {
                selectedRemoved = tab.isSelected;
                continue;
            }
            remainingTabs.push(tab);
        }

        if (selectedRemoved) {
            applicationObjectTabs[0].isSelected = true;
            pushURL = applicationObjectTabs[0].url;
        }

        applicationObjectTabsSubject.next([...remainingTabs]);
        return pushURL;
    },
    markAppDetailsTabActiveByIdentifier: (objectName: string, objectKind?: string, tabUrl?: string) => {
        if (!objectName) return;
        let isTabFound = false;

        let applicationObjectTabs = applicationObjectTabsSubject.getValue();
        let title = objectName;
        if (objectKind) {
            title = objectKind + '/' + objectName;
        }

        for (let index = 0; index < applicationObjectTabs.length; index++) {
            const tab = applicationObjectTabs[index];
            tab.isSelected = false;
            if (tab.title.toLowerCase() === title.toLowerCase()) {
                tab.isSelected = true;
                tab.url = tabUrl || tab.url;
                isTabFound = true;
            }
        }

        applicationObjectTabsSubject.next([...applicationObjectTabs]);

        return isTabFound;
    },
    markResourceDeletedByIdentifier: (objectName: string, objectKind?: string) => {
        const applicationObjectTabs = applicationObjectTabsSubject.getValue();

        let title = objectName
        if (objectKind) {
            title = objectKind + '/' + objectName;
        }

        for (let index = 0; index < applicationObjectTabs.length; index++) {
            const tab = applicationObjectTabs[index];
            if (tab.title.toLowerCase() === title.toLowerCase()) {
                tab.isDeleted = true;
            }
        }
        applicationObjectTabsSubject.next([...applicationObjectTabs]);
    },
    updateK8sResourcesTabUrl: (url: string) => {
        const applicationObjectTabs = applicationObjectTabsSubject.getValue();
        for (const tab of applicationObjectTabs) {
            if (tab.name === AppDetailsTabs.k8s_Resources) {
                tab.url = url
            }
        }
        applicationObjectTabsSubject.next([...applicationObjectTabs]);
    },
    setNodeTreeActiveParentNode: (_n: iNode) => {
        _nodeTreeActiveParentNode = _n;
    },
    getNodeTreeActiveParentNode: () => {
        return _nodeTreeActiveParentNode;
    },

    setNodeTreeActiveNode: (_n: iNode) => {
        _nodeTreeActiveNode = _n;
    },

    getNodeTreeActiveNode: () => {
        return _nodeTreeActiveNode;
    },
};

export default AppDetailsStore;
