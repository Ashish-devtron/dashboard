import React, { useEffect, useState } from 'react'
import { ServerErrors } from '../../../modals/commonTypes'
import { useLocation, useHistory } from 'react-router'
import { OrderBy, SortBy } from '../list/types'
import { buildClusterVsNamespace, getDevtronInstalledHelmApps, AppListResponse, HelmApp } from './AppListService'
import { showError, Progressing, ErrorScreenManager, Pagination, LazyImage, handleUTCTime } from '../../common'
import {
    Host,
    SERVER_MODE,
    URLS,
    DOCUMENTATION,
    checkIfDevtronOperatorHelmRelease,
    ModuleNameMap,
} from '../../../config'
import { AppListViewType } from '../config'
import { Link } from 'react-router-dom'
import { ReactComponent as HelpOutlineIcon } from '../../../assets/icons/ic-help-outline.svg'
import NoClusterSelectImage from '../../../assets/gif/ic-empty-select-cluster.gif'
import defaultChartImage from '../../../assets/icons/ic-default-chart.svg'
import HelmCluster from '../../../assets/img/guided-helm-cluster.png'
import DeployCICD from '../../../assets/img/guide-onboard.png'
import { Empty } from '../list/emptyView/Empty'
import { AllCheckModal } from '../../checkList/AllCheckModal'
import EmptyState from '../../EmptyState/EmptyState'
import Tippy from '@tippyjs/react'
import { ReactComponent as InfoFill } from '../../../assets/icons/ic-info-filled.svg'
import { ReactComponent as InfoFillPurple } from '../../../assets/icons/ic-info-filled-purple.svg'
import { ReactComponent as ErrorExclamationIcon } from '../../../assets/icons/ic-error-exclamation.svg'
import { ReactComponent as CloseIcon } from '../../../assets/icons/ic-close.svg'
import { ReactComponent as AlertTriangleIcon } from '../../../assets/icons/ic-alert-triangle.svg'
import { ReactComponent as ArrowRight } from '../../../assets/icons/ic-arrow-right.svg'
import noChartInClusterImage from '../../../assets/img/ic-no-chart-in-clusters@2x.png'
import ContentCard from '../../common/ContentCard/ContentCard'
import { CardContentDirection, CardLinkIconPlacement } from '../../common/ContentCard/ContentCard.types'
import '../list/list.css'
import {
    APPLIST_EMPTY_STATE_MESSAGING,
    ENVIRONMENT_HEADER_TIPPY_CONTENT,
    EXTERNAL_HELM_APP_FETCH_CLUSTER_ERROR,
    EXTERNAL_HELM_APP_FETCH_ERROR,
    EXTERNAL_HELM_SSE_CONNECTION_ERROR,
    APP_LIST_HEADERS,
    HELM_PERMISSION_MESSAGE,
    SELECT_CLUSTER_FROM_FILTER_NOTE,
    ClearFiltersLabel,
} from './Constants'
import { LEARN_MORE } from '../../../config/constantMessaging'
import { HELM_GUIDED_CONTENT_CARDS_TEXTS } from '../../onboardingGuide/OnboardingGuide.constants'
import AppStatus from '../AppStatus';

export default function HelmAppList({
    serverMode,
    payloadParsedFromUrl,
    sortApplicationList,
    clearAllFilters,
    fetchingExternalApps,
    setFetchingExternalAppsState,
    updateDataSyncing,
    setShowPulsatingDotState,
    masterFilters,
    syncListData,
    isArgoInstalled
}) {
    const [dataStateType, setDataStateType] = useState(AppListViewType.LOADING)
    const [errorResponseCode, setErrorResponseCode] = useState(0)
    const [devtronInstalledHelmAppsList, setDevtronInstalledHelmAppsList] = useState<HelmApp[]>([])
    const [externalHelmAppsList, setExternalHelmAppsList] = useState<HelmApp[]>([])
    const [filteredHelmAppsList, setFilteredHelmAppsList] = useState<HelmApp[]>([])
    const [sortBy, setSortBy] = useState(SortBy.APP_NAME)
    const [sortOrder, setSortOrder] = useState(OrderBy.ASC)
    const [clusterIdsCsv, setClusterIdsCsv] = useState('')
    const [appStatus, setAppStatus] = useState('');
    const [sseConnection, setSseConnection] = useState<EventSource>(undefined)
    const [externalHelmListFetchErrors, setExternalHelmListFetchErrors] = useState<string[]>([])
    const [showGuidedContentCards, setShowGuidedContentCards] = useState(false)
    const location = useLocation()
    const history = useHistory()
    const params = new URLSearchParams(location.search)

    // component load
    useEffect(() => {
        init()
    }, [])

    // it means filter/sorting has been applied
    useEffect(() => {
        if (dataStateType === AppListViewType.LIST) {
            if (clusterIdsCsv === _getClusterIdsFromRequestUrl() && appStatus === _getAppStatusFromRequestUrl()) {
                handleFilteration();
            } else {
                init()
            }
        }
    }, [payloadParsedFromUrl])

    // on data rendering first time
    useEffect(() => {
        if (dataStateType == AppListViewType.LIST) {
            handleFilteration()
        }
    }, [dataStateType])

    // when external app data comes
    useEffect(() => {
        if (dataStateType == AppListViewType.LIST) {
            handleFilteration()
        }
    }, [externalHelmAppsList])

    useEffect(() => {
        updateDataSyncing(true)
        setDataStateType(AppListViewType.LOADING)
        if (serverMode == SERVER_MODE.EA_ONLY) {
            setDataStateType(AppListViewType.LIST)
            if (clusterIdsCsv) {
                _getExternalHelmApps()
                updateDataSyncing(false)
            }
        } else {
            getDevtronInstalledHelmApps(clusterIdsCsv,appStatus)
                .then((devtronInstalledHelmAppsListResponse: AppListResponse) => {
                    setDevtronInstalledHelmAppsList(
                        devtronInstalledHelmAppsListResponse.result
                            ? devtronInstalledHelmAppsListResponse.result.helmApps
                            : [],
                    )
                    setDataStateType(AppListViewType.LIST)
                    _getExternalHelmApps()
                })
                .catch((errors: ServerErrors) => {
                    showError(errors)
                    setDataStateType(AppListViewType.ERROR)
                    setErrorResponseCode(errors.code)
                })
                .finally(() => {
                    updateDataSyncing(false)
                })
        }

    }, [clusterIdsCsv,appStatus,syncListData]);

    // reset data
    function init() {
        setDataStateType(AppListViewType.LOADING)
        setDevtronInstalledHelmAppsList([])
        setFilteredHelmAppsList([])
        setClusterIdsCsv(_getClusterIdsFromRequestUrl())
        setAppStatus(_getAppStatusFromRequestUrl())
        setExternalHelmAppsList([])
        if (sseConnection) {
            sseConnection.close()
        }
        setSseConnection(undefined)
        setFetchingExternalAppsState(false)
        setExternalHelmListFetchErrors([])
    }

    function _getExternalHelmApps() {
        if (clusterIdsCsv) {
            setFetchingExternalAppsState(true)
            let _sseConnection = new EventSource(`${Host}/application?clusterIds=${clusterIdsCsv}`, {
                withCredentials: true,
            })
            let _externalAppRecievedClusterIds = []
            let _externalAppRecievedHelmApps = []
            let _externalAppFetchErrors: string[] = []
            _sseConnection.onmessage = function (message) {
                _onExternalAppDataFromSse(
                    message,
                    _externalAppRecievedClusterIds,
                    _externalAppRecievedHelmApps,
                    _externalAppFetchErrors,
                    _sseConnection,
                )
            }
            _sseConnection.onerror = function (err) {
                _externalAppFetchErrors.push(EXTERNAL_HELM_SSE_CONNECTION_ERROR)
                setExternalHelmListFetchErrors([..._externalAppFetchErrors])
                _closeSseConnection(_sseConnection)
            }
            setSseConnection(_sseConnection)
        }
    }

    function _getClusterIdsFromRequestUrl() {
        return [...buildClusterVsNamespace(payloadParsedFromUrl.namespaces.join(',')).keys()].join(',')
    }

    function _getAppStatusFromRequestUrl() {
        return payloadParsedFromUrl.appStatuses.join(',')
    }

    function _onExternalAppDataFromSse(
        message: MessageEvent,
        _externalAppRecievedClusterIds: string[],
        _externalAppRecievedHelmApps: HelmApp[],
        _externalAppFetchErrors: string[],
        _sseConnection: EventSource,
    ) {
        const externalAppData: AppListResponse = JSON.parse(message.data)
        if (!externalAppData.result.clusterIds?.length) {
            return
        }

        const _clusterId = externalAppData.result.clusterIds[0].toString()
        if (_externalAppRecievedClusterIds.includes(_clusterId)) {
            return
        }

        if (externalAppData.result.errored) {
            const _cluster = masterFilters.clusters.find((cluster) => {
                return cluster.key == _clusterId
            })
            let _errorMsg = ''
            if (_cluster) {
                _errorMsg = `${EXTERNAL_HELM_APP_FETCH_CLUSTER_ERROR} "${_cluster.label}". ERROR: `
            }
            _errorMsg = _errorMsg + (externalAppData.result.errorMsg || EXTERNAL_HELM_APP_FETCH_ERROR)
            _externalAppFetchErrors.push(_errorMsg)
            setExternalHelmListFetchErrors([..._externalAppFetchErrors])
        }

        _externalAppRecievedClusterIds.push(_clusterId)
        const _newExternalAppList = externalAppData.result.helmApps || []
        _newExternalAppList.every((element) => (element.isExternal = true))

        _externalAppRecievedHelmApps.push(..._newExternalAppList)
        setExternalHelmAppsList([..._externalAppRecievedHelmApps])

        // Show guided content card for connecting cluster or installing CI/CD integration
        // when there's only one cluster & no app other than devtron-operator is installed
        if (serverMode === SERVER_MODE.EA_ONLY) {
            setShowGuidedContentCards(
                masterFilters.clusters.length === 1 &&
                    _externalAppRecievedHelmApps.length === 1 &&
                    checkIfDevtronOperatorHelmRelease(
                        _externalAppRecievedHelmApps[0].appName,
                        _externalAppRecievedHelmApps[0].environmentDetail?.namespace,
                        `${_externalAppRecievedHelmApps[0].environmentDetail?.clusterId}`,
                    ),
            )
        }

        const _requestedSortedClusterIdsJson = JSON.stringify(
            clusterIdsCsv.split(',').sort((a, b) => a.localeCompare(b)),
        )
        const _recievedSortedClusterIdsJson = JSON.stringify(
            _externalAppRecievedClusterIds.sort((a, b) => a.localeCompare(b)),
        )

        if (_requestedSortedClusterIdsJson === _recievedSortedClusterIdsJson) {
            _closeSseConnection(_sseConnection)
        }
    }

    function _closeSseConnection(_sseConnection: EventSource) {
        _sseConnection.close()
        setSseConnection(undefined)
        setFetchingExternalAppsState(false)
    }

    function handleFilteration() {
        let _projects = payloadParsedFromUrl.teams || []
        let _clusterVsNamespaces = payloadParsedFromUrl.namespaces || []
        let _environments = payloadParsedFromUrl.environments || []
        let _search = payloadParsedFromUrl.appNameSearch
        let _sortBy = payloadParsedFromUrl.sortBy
        let _sortOrder = payloadParsedFromUrl.sortOrder
        let _filteredHelmAppsList = [...(devtronInstalledHelmAppsList || []), ...(externalHelmAppsList || [])]

        // apply project filter
        if (_projects?.length) {
            _filteredHelmAppsList = _filteredHelmAppsList.filter((app) => _projects.includes(app.projectId))
        }

        // apply cluster_namespace filter with OR condition with environments
        if (_clusterVsNamespaces?.length || _environments?.length) {
            _filteredHelmAppsList = _filteredHelmAppsList.filter((app) => {
                let _includes = _environments.includes(app.environmentDetail.environmentId)
                _clusterVsNamespaces.map((_clusterVsNamespace) => {
                    let _clusterId = _clusterVsNamespace.split('_')[0]
                    let _namespace = _clusterVsNamespace.split('_')[1]
                    _includes =
                        _includes ||
                        (app.environmentDetail.clusterId == _clusterId &&
                            (!_namespace || app.environmentDetail.namespace == _namespace))
                })
                return _includes
            })
        }

        // handle search
        if (_search?.length) {
            _filteredHelmAppsList = _filteredHelmAppsList.filter(
                (app) =>
                    app.appName.toLowerCase().includes(_search.toLowerCase()) ||
                    app.chartName.toLowerCase().includes(_search.toLowerCase()),
            )
        }

        // handle sort
        if (_sortOrder == OrderBy.ASC) {
            _filteredHelmAppsList = _filteredHelmAppsList.sort((a, b) => a.appName.localeCompare(b.appName))
        } else {
            _filteredHelmAppsList = _filteredHelmAppsList.sort((a, b) => b.appName.localeCompare(a.appName))
        }

        setSortBy(_sortBy)
        setSortOrder(_sortOrder)
        setFilteredHelmAppsList(_filteredHelmAppsList)
        setShowPulsatingDotState(_filteredHelmAppsList.length == 0 && !clusterIdsCsv)
    }

    function _isAnyFilterationAppliedExceptClusterAndNs() {
        return (
            payloadParsedFromUrl.teams?.length ||
            payloadParsedFromUrl.appNameSearch?.length ||
            payloadParsedFromUrl.environments?.length
        )
    }

    function _isAnyFilterationApplied() {
        return _isAnyFilterationAppliedExceptClusterAndNs() || payloadParsedFromUrl.namespaces?.length
    }

    function _isOnlyAllClusterFilterationApplied() {
        let _isAllClusterSelected = !masterFilters.clusters.some((_cluster) => !_cluster.isChecked)
        let _isAnyNamespaceSelected = masterFilters.namespaces.some((_namespace) => _namespace.isChecked)
        return !_isAnyFilterationAppliedExceptClusterAndNs() && _isAllClusterSelected && !_isAnyNamespaceSelected
    }

    function handleImageError(e) {
        const target = e.target as HTMLImageElement
        target.onerror = null
        target.src = defaultChartImage
    }

    function _buildAppDetailUrl(app: HelmApp) {
        if (app.isExternal) {
            return `${URLS.APP}/${URLS.EXTERNAL_APPS}/${app.appId}/${app.appName}`
        } else {
            return `${URLS.APP}/${URLS.DEVTRON_CHARTS}/deployments/${app.appId}/env/${app.environmentDetail.environmentId}`
        }
    }

    function _removeExternalAppFetchError(e) {
        const index = Number(e.currentTarget.dataset.id)
        const _externalHelmListFetchErrors = [...externalHelmListFetchErrors]
        _externalHelmListFetchErrors.splice(index, 1)
        setExternalHelmListFetchErrors(_externalHelmListFetchErrors)
    }

    function sortByAppName(e) {
        e.preventDefault()
        sortApplicationList('appNameSort')
    }

    function renderHeaders() {
        return (
            <div className="app-list__header">
                <div className="app-list__cell--icon"></div>
                <div className="app-list__cell app-list__cell--name">
                    {sseConnection && <span>{APP_LIST_HEADERS.ReleaseName}</span>}
                    {!sseConnection && (
                        <button className="app-list__cell-header flex" onClick={sortByAppName}>
                            {APP_LIST_HEADERS.AppName}
                            {sortBy == SortBy.APP_NAME ? (
                                <span className={`sort ${sortOrder == OrderBy.ASC ? 'sort-up' : ''} ml-4`}></span>
                            ) : (
                                <span className="sort-col ml-4"></span>
                            )}
                        </button>
                    )}
                </div>
                {isArgoInstalled && (
                    <div className="app-list__cell app-list__cell--app_status">
                        <span className="app-list__cell-header">{APP_LIST_HEADERS.AppStatus}</span>
                    </div>
                )}
                <div className="app-list__cell app-list__cell--env">
                    <span className="app-list__cell-header mr-4">{APP_LIST_HEADERS.Environment}</span>
                    <Tippy
                        className="default-tt"
                        arrow={true}
                        placement="top"
                        content={ENVIRONMENT_HEADER_TIPPY_CONTENT}
                    >
                        <HelpOutlineIcon className="icon-dim-20" />
                    </Tippy>
                </div>
                <div className="app-list__cell app-list__cell--cluster">
                    <span className="app-list__cell-header">{APP_LIST_HEADERS.Cluster}</span>
                </div>
                <div className="app-list__cell app-list__cell--namespace">
                    <span className="app-list__cell-header">{APP_LIST_HEADERS.Namespace}</span>
                </div>
                <div className="app-list__cell app-list__cell--time">
                    <span className="app-list__cell-header">{APP_LIST_HEADERS.LastDeployedAt}</span>
                </div>
            </div>
        )
    }

    const renderFetchError = (externalHelmListFetchError: string, index: number) => {
        return (
            <div className="bcn-0" key={index}>
                <div className="h-8"></div>
                <div className="ea-fetch-error-message above-header-message flex left">
                    <span className="mr-8 flex">
                        <ErrorExclamationIcon className="icon-dim-20" />
                    </span>
                    <span>{externalHelmListFetchError}</span>
                    <CloseIcon
                        data-id={index}
                        className="icon-dim-24 dc__align-right cursor"
                        onClick={_removeExternalAppFetchError}
                    />
                </div>
            </div>
        )
    }

    const renderHelmAppLink = (app: HelmApp): JSX.Element => {
        return (
            <Link key={app.appId} to={_buildAppDetailUrl(app)} className="app-list__row">
                <div className="app-list__cell--icon">
                    <LazyImage
                        className="dc__chart-grid-item__icon icon-dim-24"
                        src={app.chartAvatar}
                        onError={handleImageError}
                    />
                </div>
                <div className="app-list__cell app-list__cell--name flex column left">
                    <div className="dc__truncate-text  m-0 value">{app.appName}</div>
                    <div className="dc__truncate-text fs-12 m-0">{app.chartName}</div>
                </div>
                {isArgoInstalled && (
                    <div className="app-list__cell app-list__cell--namespace">
                        <AppStatus appStatus={app.appStatus} />
                    </div>
                )}
                <div className="app-list__cell app-list__cell--env">
                    <p className="dc__truncate-text  m-0">
                        {app.environmentDetail.environmentName
                            ? app.environmentDetail.environmentName
                            : app.environmentDetail.clusterName + '__' + app.environmentDetail.namespace}
                    </p>
                </div>
                <div className="app-list__cell app-list__cell--cluster">
                    <p className="dc__truncate-text  m-0"> {app.environmentDetail.clusterName}</p>
                </div>
                <div className="app-list__cell app-list__cell--namespace">
                    <p className="dc__truncate-text  m-0"> {app.environmentDetail.namespace}</p>
                </div>
                <div className="app-list__cell app-list__cell--time">
                    {app.lastDeployedAt && (
                        <Tippy
                            className="default-tt"
                            arrow={true}
                            placement="top"
                            content={handleUTCTime(app.lastDeployedAt, false)}
                        >
                            <p className="dc__truncate-text  m-0">{handleUTCTime(app.lastDeployedAt, true)}</p>
                        </Tippy>
                    )}
                </div>
            </Link>
        )
    }

    function renderApplicationList() {
        return (
            <>
                {!clusterIdsCsv && (
                    <div className="bcn-0">
                        <div className="h-8"></div>
                        <div className="cluster-select-message-strip above-header-message flex left">
                            <span className="mr-8 flex">
                                <InfoFillPurple className="icon-dim-20" />
                            </span>
                            <span>
                                {SELECT_CLUSTER_FROM_FILTER_NOTE}&nbsp;
                                <a className="dc__link cursor" target="_blank" href={DOCUMENTATION.HYPERION}>
                                    {LEARN_MORE}
                                </a>
                            </span>
                        </div>
                    </div>
                )}
                {externalHelmListFetchErrors.map((externalHelmListFetchError, index) =>
                    renderFetchError(externalHelmListFetchError, index),
                )}
                {filteredHelmAppsList.length > 0 && renderHeaders()}
                {filteredHelmAppsList
                    .slice(payloadParsedFromUrl.hOffset, payloadParsedFromUrl.hOffset + payloadParsedFromUrl.size)
                    .map((app) => renderHelmAppLink(app))}
                {showGuidedContentCards && (
                    <div className="helm-app-guided-cards-wrapper">
                        <ContentCard
                            redirectTo={URLS.GLOBAL_CONFIG_CLUSTER}
                            direction={CardContentDirection.Horizontal}
                            imgSrc={HelmCluster}
                            title={HELM_GUIDED_CONTENT_CARDS_TEXTS.GlobalConfigCluster.title}
                            linkText={HELM_GUIDED_CONTENT_CARDS_TEXTS.GlobalConfigCluster.linkText}
                            LinkIcon={ArrowRight}
                            linkIconClass="scb-5"
                            linkIconPlacement={CardLinkIconPlacement.AfterLinkApart}
                        />
                        <ContentCard
                            redirectTo={`${URLS.STACK_MANAGER_DISCOVER_MODULES_DETAILS}?id=${ModuleNameMap.CICD}`}
                            direction={CardContentDirection.Horizontal}
                            imgSrc={DeployCICD}
                            title={HELM_GUIDED_CONTENT_CARDS_TEXTS.StackManager.title}
                            linkText={HELM_GUIDED_CONTENT_CARDS_TEXTS.StackManager.installLinkText}
                            LinkIcon={ArrowRight}
                            linkIconClass="scb-5"
                            linkIconPlacement={CardLinkIconPlacement.AfterLinkApart}
                        />
                    </div>
                )}
            </>
        )
    }

    function renderAllCheckModal() {
        return (
            <div
                style={{ width: '600px', margin: 'auto', marginTop: '20px' }}
                className="bcn-0 pt-20 pb-20 pl-20 pr-20 br-8 en-1 bw-1 mt-20"
            >
                <AllCheckModal />
            </div>
        )
    }

    function askToSelectClusterId() {
        return (
            <div style={{ height: 'calc(100vh - 150px)' }}>
                <EmptyState>
                    <img
                        src={NoClusterSelectImage}
                        width="250"
                        height="250"
                        alt={APPLIST_EMPTY_STATE_MESSAGING.altText}
                    />
                    <h2 className="fs-16 fw-4 c-9">{APPLIST_EMPTY_STATE_MESSAGING.heading}</h2>
                    <p className="text-left" style={{ width: '300px' }}>
                        {APPLIST_EMPTY_STATE_MESSAGING.infoText}
                    </p>
                </EmptyState>
            </div>
        )
    }

    function askToClearFilters(showTipToSelectCluster?: boolean) {
        return (
            <Empty
                view={AppListViewType.NO_RESULT}
                title={APPLIST_EMPTY_STATE_MESSAGING.noAppsFound}
                message={APPLIST_EMPTY_STATE_MESSAGING.noAppsFoundInfoText}
                buttonLabel={ClearFiltersLabel}
                clickHandler={clearAllFilters}
            >
                {showTipToSelectCluster && (
                    <div className="mt-18">
                        <p
                            className="bcb-1 cn-9 fs-13 pt-10 pb-10 pl-16 pr-16 eb-2 bw-1 br-4 cluster-tip flex left top"
                            style={{ width: '300px' }}
                        >
                            <span>
                                <InfoFill className="icon-dim-20" />
                            </span>
                            <div className="ml-12 cn-9" style={{ textAlign: 'start' }}>
                                <span className="fw-6">Tip </span>
                                <span>{APPLIST_EMPTY_STATE_MESSAGING.selectCluster}</span>
                            </div>
                        </p>
                    </div>
                )}
            </Empty>
        )
    }

    function askToClearFiltersWithSelectClusterTip() {
        return <div className="flex column">{askToClearFilters(true)}</div>
    }

    function askToConnectAClusterForNoResult() {
        return (
            <div style={{ height: 'calc(100vh - 150px)' }}>
                <EmptyState>
                    <img
                        src={noChartInClusterImage}
                        width="250"
                        height="250"
                        alt={APPLIST_EMPTY_STATE_MESSAGING.connectClusterAltText}
                    />
                    <h2 className="fs-16 fw-4 c-9">{APPLIST_EMPTY_STATE_MESSAGING.noHelmChartsFound}</h2>
                    <p className="text-left" style={{ width: '450px' }}>
                        {APPLIST_EMPTY_STATE_MESSAGING.connectClusterInfoText}
                    </p>
                    <Link to={URLS.GLOBAL_CONFIG_CLUSTER}>
                        <button type="button" className="cta flex">
                            {APPLIST_EMPTY_STATE_MESSAGING.connectClusterLabel}
                        </button>
                    </Link>
                </EmptyState>
            </div>
        )
    }

    function renderHelmPermissionMessageStrip() {
        return (
            <>
                <div className="h-8"></div>
                <div className="helm-permission-message-strip above-header-message flex left">
                    <span className="mr-8 flex">
                        <AlertTriangleIcon className="icon-dim-20 icon" />
                    </span>
                    <span>{HELM_PERMISSION_MESSAGE}</span>
                </div>
            </>
        )
    }

    function renderNoApplicationState() {
        if (_isAnyFilterationAppliedExceptClusterAndNs() && !clusterIdsCsv) {
            return askToClearFiltersWithSelectClusterTip()
        } else if (_isOnlyAllClusterFilterationApplied()) {
            return askToConnectAClusterForNoResult()
        } else if (_isAnyFilterationApplied()) {
            return askToClearFilters()
        } else if (!clusterIdsCsv) {
            return askToSelectClusterId()
        } else {
            return renderAllCheckModal()
        }
    }

    function renderFullModeApplicationListContainer() {
        if (!sseConnection && filteredHelmAppsList.length == 0) {
            return (
                <>
                    {serverMode == SERVER_MODE.FULL && renderHelmPermissionMessageStrip()}
                    {renderNoApplicationState()}
                </>
            )
        } else {
            return renderApplicationList()
        }
    }

    function changePageSize(size: number): void {
        params.set('pageSize', size.toString())
        params.set('offset', '0')
        params.set('hOffset', '0')

        history.push(`${URLS.APP}/${URLS.APP_LIST}/${URLS.APP_LIST_HELM}?${params.toString()}`)
    }

    function changePage(pageNo: number): void {
        const newOffset = payloadParsedFromUrl.size * (pageNo - 1)

        params.set('hOffset', newOffset.toString())

        history.push(`${URLS.APP}/${URLS.APP_LIST}/${URLS.APP_LIST_HELM}?${params.toString()}`)
    }

    function renderPagination(): JSX.Element {
        return (
            filteredHelmAppsList.length > 20 &&
            !fetchingExternalApps && (
                <Pagination
                    size={filteredHelmAppsList.length}
                    pageSize={payloadParsedFromUrl.size}
                    offset={payloadParsedFromUrl.hOffset}
                    changePage={changePage}
                    changePageSize={changePageSize}
                />
            )
        )
    }

    return (
        <>
            {dataStateType == AppListViewType.LOADING && (
                <div className="dc__loading-wrapper">
                    <Progressing pageLoader />
                </div>
            )}
            {dataStateType == AppListViewType.ERROR && (
                <div className="dc__loading-wrapper">
                    <ErrorScreenManager code={errorResponseCode} />
                </div>
            )}
            {dataStateType == AppListViewType.LIST && (
                <div>
                    {renderFullModeApplicationListContainer()}
                    {renderPagination()}
                </div>
            )}
        </>
    )
}
