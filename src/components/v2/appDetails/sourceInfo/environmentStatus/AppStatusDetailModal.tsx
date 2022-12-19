import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Drawer } from '../../../../common'
import { ReactComponent as Close } from '../../../assets/icons/ic-close.svg'
import { ReactComponent as InfoIcon } from '../../../../../assets/icons/info-filled.svg'
import { ReactComponent as Chat } from '../../../../../assets/icons/ic-chat-circle-dots.svg'
import IndexStore from '../../index.store'
import { AggregatedNodes } from '../../../../app/types'
import { aggregateNodes } from '../../../../app/details/appDetails/utils'
import './environmentStatus.scss'
import { APP_STATUS_CUSTOM_MESSAGES, APP_STATUS_HEADERS } from '../../../../../config'
import { StatusFilterButtonComponent } from '../../k8Resource/StatusFilterButton.component'
import { AppStatusDetailType, NodeStatus } from '../../appDetails.type'
import ErrorBar from '../../../../common/error/ErrorBar'

interface NodeStreamMap {
    group: string
    kind: string
    message: string
    name: string
    namespace: string
    status: string
    syncPhase: string
    version: string
}

const STATUS_SORTING_ORDER = {
    [NodeStatus.Missing]: 1,
    [NodeStatus.Degraded]: 2,
    [NodeStatus.Progressing]: 3,
    [NodeStatus.Healthy]: 4,
}

function AppStatusDetailModal({
    close,
    appStreamData,
    showAppStatusMessage,
    title,
    appStatus,
    appStatusText,
    showFooter,
}: AppStatusDetailType) {
    const _appDetails = IndexStore.getAppDetails()

    const nodes: AggregatedNodes = useMemo(() => {
        return aggregateNodes(_appDetails.resourceTree?.nodes || [], _appDetails.resourceTree?.podMetadata || [])
    }, [_appDetails])
    const nodesKeyArray = Object.keys(nodes?.nodes || {})
    let flattenedNodes = []
    if (nodesKeyArray.length > 0) {
        for (let index = 0; index < nodesKeyArray.length; index++) {
            const element = nodes.nodes[nodesKeyArray[index]]
            element.forEach((childElement) => {
                childElement.health && flattenedNodes.push(childElement)
            })
        }
        flattenedNodes.sort((a, b) => {
            return (
                STATUS_SORTING_ORDER[a.health.status?.toLowerCase()] -
                STATUS_SORTING_ORDER[b.health.status?.toLowerCase()]
            )
        })
    }
    const appStatusDetailRef = useRef<HTMLDivElement>(null)
    const escKeyPressHandler = (evt): void => {
        if (evt && evt.key === 'Escape' && typeof close === 'function') {
            evt.preventDefault()
            close()
        }
    }
    const [nodeStatusMap, setNodeStatusMap] = useState<Map<string, NodeStreamMap>>()
    const [showSeeMore, setShowSeeMore] = useState(true)
    const [currentFilter, setCurrentFilter] = useState('')

    useEffect(() => {
        try {
            const stats = appStreamData.result.application.status.operationState.syncResult.resources.reduce(
                (agg, curr) => {
                    agg.set(`${curr.kind}/${curr.name}`, curr)
                    return agg
                },
                new Map(),
            )
            setNodeStatusMap(stats)
        } catch (error) {}
    }, [appStreamData])

    function getNodeMessage(kind: string, name: string) {
        if (nodeStatusMap && nodeStatusMap.has(`${kind}/${name}`)) {
            const { message } = nodeStatusMap.get(`${kind}/${name}`)
            return message
        }
        return ''
    }

    let message = ''
    const conditions = _appDetails.resourceTree?.conditions
    const Rollout = nodes?.nodes?.Rollout?.entries()?.next().value[1]
    if (
        ['progressing', 'degraded'].includes(_appDetails.resourceTree.status.toLowerCase()) &&
        Array.isArray(conditions) &&
        conditions.length > 0 &&
        conditions[0].message
    ) {
        message = conditions[0].message
    } else if (Rollout?.health?.message) {
        message = Rollout.health.message
    }

    function handleShowMoreButton() {
        setShowSeeMore(!showSeeMore)
    }

    const _hasMoreData = message.length >= 126

    function renderShowMoreButton() {
        return (
            <div onClick={handleShowMoreButton} className="cb-5 fw-6 cursor">
                {showSeeMore ? 'Show More' : 'Show Less'}
            </div>
        )
    }

    const outsideClickHandler = (evt): void => {
        if (
            appStatusDetailRef.current &&
            !appStatusDetailRef.current.contains(evt.target) &&
            typeof close === 'function'
        ) {
            close()
        }
    }

    const onFilterClick = (selectedFilter: string): void => {
        if (currentFilter !== selectedFilter.toLowerCase()) {
            setCurrentFilter(selectedFilter.toLowerCase())
        }
    }

    useEffect(() => {
        document.addEventListener('keydown', escKeyPressHandler)
        return (): void => {
            document.removeEventListener('keydown', escKeyPressHandler)
        }
    }, [escKeyPressHandler])

    useEffect(() => {
        document.addEventListener('click', outsideClickHandler)
        return (): void => {
            document.removeEventListener('click', outsideClickHandler)
        }
    }, [outsideClickHandler])

    return (
        <Drawer position="right" width="1024px">
            <div className="app-status-detail-modal bcn-0" ref={appStatusDetailRef}>
                <div className="app-status-detail__header dc__box-shadow pt-12 pr-20 pb-12 pl-20 bcn-0 flex dc__content-space">
                    <div>
                        <div className="title cn-9 fs-16 fw-6 mb-4">{title ? title : 'App status detail'}</div>
                        <div
                            className={`subtitle app-summary__status-name fw-6 fs-13 f-${
                                appStatus ? appStatus : _appDetails.resourceTree.status.toLowerCase()
                            } mr-16`}
                        >
                            {appStatusText ? appStatusText : _appDetails.resourceTree.status.toUpperCase()}
                        </div>
                    </div>
                    <span className="cursor" onClick={close}>
                        <Close className="icon-dim-24" />
                    </span>
                </div>

                <div className="app-status-detail__body">
                    <ErrorBar appDetails={_appDetails} />

                    {message && (
                        <div
                            className={` ${
                                showSeeMore ? 'app-status__message-wrapper' : ''
                            } bcr-1 cn-9 pt-10 pb-10 pl-20 pr-20`}
                        >
                            <span className="fw-6 ">Message: </span> {message}
                            {_hasMoreData && renderShowMoreButton()}
                        </div>
                    )}

                    {showAppStatusMessage && (
                        <div className="bcn-1 cn-9 pt-10 pb-10 pl-20 pr-20">
                            <span className="fw-6 ">Message: </span>
                            {APP_STATUS_CUSTOM_MESSAGES[_appDetails.resourceTree.status.toUpperCase()]}
                        </div>
                    )}
                    <div className="pt-16 pl-20 pb-8">
                        <div className="flexbox pr-20 w-100">
                            <div>
                                <StatusFilterButtonComponent nodes={flattenedNodes} handleFilterClick={onFilterClick} />
                            </div>
                        </div>
                    </div>
                    <div>
                        <div className="app-status-row dc__border-bottom pt-8 pr-20 pb-8 pl-20">
                            {APP_STATUS_HEADERS.map((headerKey, index) => (
                                <div className="fs-13 fw-6 cn-7" key={`header_${index}`}>
                                    {headerKey}
                                </div>
                            ))}
                        </div>
                        <div className={`resource-list fs-13 ${showFooter ? 'with-footer' : ''}`}>
                            {flattenedNodes.length > 0 ? (
                                flattenedNodes
                                    .filter(
                                        (nodeDetails) =>
                                            currentFilter === 'all' ||
                                            nodeDetails.health.status?.toLowerCase() === currentFilter,
                                    )
                                    .map((nodeDetails) => (
                                        <div
                                            className="app-status-row pt-8 pr-20 pb-8 pl-20"
                                            key={`${nodeDetails.kind}/${nodeDetails.name}`}
                                        >
                                            <div>{nodeDetails.kind}</div>
                                            <div>{nodeDetails.name}</div>
                                            <div
                                                className={`app-summary__status-name f-${
                                                    nodeDetails.health.status
                                                        ? nodeDetails.health.status.toLowerCase()
                                                        : ''
                                                }`}
                                            >
                                                {nodeDetails.status ? nodeDetails.status : nodeDetails.health.status}
                                            </div>
                                            <div>{getNodeMessage(nodeDetails.kind, nodeDetails.name)}</div>
                                        </div>
                                    ))
                            ) : (
                                <div className="flex dc__height-inherit">
                                    <div className="dc__align-center">
                                        <InfoIcon className="icon-dim-20" />
                                        <div>No resources available</div>
                                    </div>
                                </div>
                            )}
                        </div>
                        {showFooter && (
                            <div className="dc__position-fixed bcn-0 flexbox dc__content-space dc__border-top p-16 fs-13 fw-6 footer">
                                <span className="fs-13 fw-6">Facing issues in installing integration?</span>
                                <a
                                    className="help-chat cb-5 flex left"
                                    href="https://discord.devtron.ai/"
                                    target="_blank"
                                    rel="noreferrer noopener"
                                >
                                    <Chat className="icon-dim-20 mr-8" /> Chat with support
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Drawer>
    )
}

export default AppStatusDetailModal
