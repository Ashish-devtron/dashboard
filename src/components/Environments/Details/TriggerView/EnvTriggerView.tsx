import React, { useState, useEffect } from 'react'
import { useHistory, useLocation, useParams, useRouteMatch } from 'react-router-dom'
import ReactGA from 'react-ga4'
import { BUILD_STATUS, DEFAULT_GIT_BRANCH_VALUE, SourceTypeMap, ViewType } from '../../../../config'
import { ServerErrors } from '../../../../modals/commonTypes'
import { CDMaterial } from '../../../app/details/triggerView/cdMaterial'
import { CIMaterial } from '../../../app/details/triggerView/ciMaterial'
import { TriggerViewContext } from '../../../app/details/triggerView/config'
import { CIMaterialType } from '../../../app/details/triggerView/MaterialHistory'
import {
    CIMaterialRouterProps,
    DeploymentNodeType,
    MATERIAL_TYPE,
    NodeAttr,
    WorkflowNodeType,
    WorkflowType,
} from '../../../app/details/triggerView/types'
import { Workflow } from '../../../app/details/triggerView/workflow/Workflow'
import {
    CDModalTab,
    getCDMaterialList,
    getCIMaterialList,
    getGitMaterialByCommitHash,
    getRollbackMaterialList,
    refreshGitMaterial,
    triggerCDNode,
    triggerCINode,
} from '../../../app/service'
import {
    createGitCommitUrl,
    ErrorScreenManager,
    ISTTimeModal,
    PopupMenu,
    preventBodyScroll,
    Progressing,
    showError,
    stopPropagation,
} from '../../../common'
import { getWorkflows, getWorkflowStatus } from '../../Environment.service'
import { TIME_STAMP_ORDER } from '../../../app/details/triggerView/Constants'
import { toast } from 'react-toastify'
import { CI_CONFIGURED_GIT_MATERIAL_ERROR } from '../../../../config/constantMessaging'
import { getLastExecutionByArtifactAppEnv } from '../../../../services/service'
import { getCIWebhookRes } from '../../../app/details/triggerView/ciWebhook.service'
import { AppNotConfigured } from '../../../app/details/appDetails/AppDetails'
import {
    BULK_CI_RESPONSE_STATUS_TEXT,
    BulkResponseStatus,
    ENV_TRIGGER_VIEW_GA_EVENTS,
    BULK_CD_RESPONSE_STATUS_TEXT,
} from '../../Constants'
import { ReactComponent as DeployIcon } from '../../../../assets/icons/ic-nav-rocket.svg'
import { ReactComponent as Close } from '../../../../assets/icons/ic-cross.svg'
import { ReactComponent as Dropdown } from '../../../../assets/icons/ic-chevron-down.svg'
import './EnvTriggerView.scss'
import BulkCDTrigger from './BulkCDTrigger'
import BulkCITrigger from './BulkCITrigger'
import { BulkCDDetailType, BulkCIDetailType, ResponseRowType } from '../../Environments.types'
import { handleSourceNotConfigured, processWorkflowStatuses } from '../../AppGrouping.utils'

let timerRef
let inprogressStatusTimer
export default function EnvTriggerView() {
    const { envId } = useParams<{ envId: string }>()
    const location = useLocation()
    const history = useHistory()
    const match = useRouteMatch<CIMaterialRouterProps>()
    const [pageViewType, setPageViewType] = useState<string>(ViewType.LOADING)
    const [loader, setLoader] = useState(false)
    const [isLoading, setLoading] = useState(false)
    const [errorCode, setErrorCode] = useState(0)
    const [showCIModal, setShowCIModal] = useState(false)
    const [showCDModal, setShowCDModal] = useState(false)
    const [showBulkCDModal, setShowBulkCDModal] = useState(false)
    const [showBulkCIModal, setShowBulkCIModal] = useState(false)
    const [showWebhookModal, setShowWebhookModal] = useState(false)
    const [isWebhookPayloadLoading, setWebhookPayloadLoading] = useState(false)
    const [invalidateCache, setInvalidateCache] = useState(false)
    const [webhookPayloads, setWebhookPayloads] = useState(null)
    const [isChangeBranchClicked, setChangeBranchClicked] = useState(false)
    const [webhookTimeStampOrder, setWebhookTimeStampOrder] = useState('')
    const [showMaterialRegexModal, setShowMaterialRegexModal] = useState(false)
    const [workflowID, setWorkflowID] = useState<number>()
    const [selectedAppID, setSelectedAppID] = useState<number>()
    const [selectedAppList, setSelectedAppList] = useState<{ id: number; name: string }[]>([])
    const [workflows, setWorkflows] = useState<WorkflowType[]>([])
    const [selectedCDNode, setSelectedCDNode] = useState<{ id: number; name: string; type: WorkflowNodeType }>(null)
    const [selectedCINode, setSelectedCINode] = useState<{ id: number; name: string; type: WorkflowNodeType }>(null)
    const [filteredCIPipelines, setFilteredCIPipelines] = useState(null)
    const [bulkTriggerType, setBulkTriggerType] = useState<DeploymentNodeType>(null)
    const [materialType, setMaterialType] = useState(MATERIAL_TYPE.inputMaterialList)
    const [responseList, setResponseList] = useState<ResponseRowType[]>([])

    const getWorkflowsData = async (): Promise<void> => {
        try {
            const { workflows: _workflows, filteredCIPipelines } = await getWorkflows(envId)
            if (showCIModal) {
                _workflows.forEach((wf) =>
                    wf.nodes.forEach((n) => {
                        if (+n.id === selectedCINode.id) {
                            workflows.forEach((sw) =>
                                sw.nodes.forEach((sn) => {
                                    if (+sn.id === selectedCINode.id) {
                                        n.inputMaterialList = sn.inputMaterialList
                                    }
                                }),
                            )
                        }
                    }),
                )
            }
            setWorkflows(_workflows)
            setFilteredCIPipelines(filteredCIPipelines)
            setErrorCode(0)
            setPageViewType(ViewType.FORM)
            getWorkflowStatusData(_workflows)
            timerRef && clearInterval(timerRef)
            timerRef = setInterval(() => {
                getWorkflowStatusData(_workflows)
            }, 30000)
        } catch (error) {
            showError(error)
            setErrorCode(error['code'])
            setPageViewType(ViewType.ERROR)
        }
    }

    const getWorkflowStatusData = (workflowsList: WorkflowType[]) => {
        getWorkflowStatus(envId)
            .then((response) => {
                const _processedWorkflowsData = processWorkflowStatuses(
                    response?.result?.ciWorkflowStatus ?? [],
                    response?.result?.cdWorkflowStatus ?? [],
                    workflowsList,
                )
                inprogressStatusTimer && clearTimeout(inprogressStatusTimer)
                if (_processedWorkflowsData.cicdInProgress) {
                    inprogressStatusTimer = setTimeout(() => {
                        getWorkflowStatusData(_processedWorkflowsData.workflows)
                    }, 10000)
                }
                setWorkflows(_processedWorkflowsData.workflows)
            })
            .catch((errors: ServerErrors) => {
                showError(errors)
            })
    }

    useEffect(() => {
        if (envId) {
            setPageViewType(ViewType.LOADING)
            getWorkflowsData()
        }
        return () => {
            timerRef && clearInterval(timerRef)
            inprogressStatusTimer && clearTimeout(inprogressStatusTimer)
        }
    }, [envId])

    const clearAppList = (): void => {
        setSelectedAppList([])
        const _workflows = workflows.map((wf) => {
            wf.isSelected = false
            return wf
        })
        setWorkflows(_workflows)
    }

    const handleSelectionChange = (e): void => {
        const _appId = Number(e.currentTarget.dataset.appId)
        const _selectedAppList = [...selectedAppList]
        const _workflows = workflows.map((wf) => {
            if (_appId === wf.appId) {
                const selectedAppIndex = selectedAppList.findIndex((app) => app.id === _appId)
                if (wf.isSelected) {
                    _selectedAppList.splice(selectedAppIndex, 1)
                    wf.isSelected = false
                } else {
                    _selectedAppList.push({
                        id: _appId,
                        name: wf.name,
                    })
                    wf.isSelected = true
                }
            }
            return wf
        })
        setWorkflows(_workflows)
        setSelectedAppList(_selectedAppList)
    }

    const getCommitHistory = (
        ciPipelineMaterialId: number,
        commitHash: string,
        workflows: WorkflowType[],
        _selectedMaterial: CIMaterialType,
    ) => {
        getGitMaterialByCommitHash(ciPipelineMaterialId.toString(), commitHash)
            .then((response) => {
                const _result = response.result
                if (_result) {
                    _selectedMaterial.history = [
                        {
                            commitURL: _selectedMaterial.gitURL
                                ? createGitCommitUrl(_selectedMaterial.gitURL, _result.Commit)
                                : '',
                            commit: _result.Commit || '',
                            author: _result.Author || '',
                            date: _result.Date ? ISTTimeModal(_result.Date, false) : '',
                            message: _result.Message || '',
                            changes: _result.Changes || [],
                            showChanges: true,
                            webhookData: _result.WebhookData,
                            isSelected: true,
                        },
                    ]
                    _selectedMaterial.isMaterialLoading = false
                } else {
                    _selectedMaterial.history = []
                    _selectedMaterial.noSearchResultsMsg = `Commit not found for ‘${commitHash}’ in branch ‘${_selectedMaterial.value}’`
                    _selectedMaterial.noSearchResult = true
                    _selectedMaterial.isMaterialLoading = false
                }
                setWorkflows(workflows)
            })
            .catch((error: ServerErrors) => {
                showError(error)
                _selectedMaterial.isMaterialLoading = false
                setWorkflows(workflows)
            })
    }

    const getMaterialByCommit = async (
        _ciNodeId: number,
        pipelineName: string,
        ciPipelineMaterialId: number,
        commitHash = null,
    ) => {
        let _selectedMaterial
        const _workflows = [...workflows].map((workflow) => {
            workflow.nodes.map((node) => {
                if (node.type === 'CI' && +node.id == _ciNodeId) {
                    node.inputMaterialList = node.inputMaterialList.map((material) => {
                        if (material.isSelected && material.searchText !== commitHash) {
                            material.isMaterialLoading = true
                            material.searchText = commitHash
                            _selectedMaterial = material
                        }
                        return material
                    })
                    return node
                } else return node
            })
            return workflow
        })

        if (commitHash && _selectedMaterial) {
            const commitInLocalHistory = _selectedMaterial.history.find((material) => material.commit === commitHash)
            if (commitInLocalHistory) {
                _selectedMaterial.history = [{ ...commitInLocalHistory, isSelected: true }]
                _selectedMaterial.isMaterialLoading = false

                setWorkflows(_workflows)
            } else {
                setWorkflows(_workflows)
                getCommitHistory(ciPipelineMaterialId, commitHash, _workflows, _selectedMaterial)
            }
        } else {
            setWorkflows(_workflows)
            updateCIMaterialList(selectedCINode.id.toString(), pipelineName, true).catch((errors: ServerErrors) => {
                showError(errors)
                setErrorCode(errors.code)
            })
        }
    }

    //NOTE: GIT MATERIAL ID
    const refreshMaterial = (ciNodeId: number, pipelineName: string, gitMaterialId: number) => {
        const _workflows = [...workflows].map((wf) => {
            wf.nodes = wf.nodes.map((node) => {
                if (node.id === ciNodeId.toString() && node.type === 'CI') {
                    node.inputMaterialList = node.inputMaterialList.map((material) => {
                        material.isMaterialLoading =
                            material.gitMaterialId === gitMaterialId ? true : material.isMaterialLoading
                        return material
                    })
                    return node
                }
                return node
            })
            return wf
        })
        setWorkflows(_workflows)
        refreshGitMaterial(gitMaterialId.toString())
            .then((response) => {
                updateCIMaterialList(ciNodeId.toString(), pipelineName, true).catch((errors: ServerErrors) => {
                    showError(errors)
                    setErrorCode(errors.code)
                })
            })
            .catch((error: ServerErrors) => {
                showError(error)
            })
    }

    const updateCIMaterialList = async (
        ciNodeId: string,
        ciPipelineName: string,
        preserveMaterialSelection: boolean,
    ): Promise<void> => {
        const params = {
            pipelineId: ciNodeId,
        }
        return getCIMaterialList(params).then((response) => {
            let _workflowId,
                _appID,
                showRegexModal = false
            const _workflows = [...workflows].map((workflow) => {
                workflow.nodes.map((node) => {
                    if (node.type === 'CI' && +node.id == +ciNodeId) {
                        const selectedCIPipeline = filteredCIPipelines.get(_appID)?.find((_ci) => _ci.id === +ciNodeId)
                        if (selectedCIPipeline?.ciMaterial) {
                            for (const mat of selectedCIPipeline.ciMaterial) {
                                const gitMaterial = response.result.find(
                                    (_mat) => _mat.gitMaterialId === mat.gitMaterialId,
                                )
                                if (mat.isRegex && gitMaterial) {
                                    node.branch = gitMaterial.value
                                    node.isRegex = !!gitMaterial.regex
                                }
                            }
                        }
                        _workflowId = workflow.id
                        _appID = workflow.appId
                        if (preserveMaterialSelection) {
                            const selectMaterial = node.inputMaterialList.find((mat) => mat.isSelected)
                            node.inputMaterialList = response.result.map((material) => {
                                return {
                                    ...material,
                                    isSelected: selectMaterial.id === material.id,
                                }
                            })
                        } else node.inputMaterialList = response.result
                        return node
                    } else return node
                })
                return workflow
            })
            showRegexModal = isShowRegexModal(_appID, +ciNodeId, response.result)
            setWorkflows(_workflows)
            setErrorCode(response.code)
            setSelectedCINode({ id: +ciNodeId, name: ciPipelineName, type: WorkflowNodeType.CI })
            setMaterialType(MATERIAL_TYPE.inputMaterialList)
            if (!showBulkCIModal) {
                setShowCIModal(!showRegexModal)
                setShowMaterialRegexModal(showRegexModal)
            }
            setWorkflowID(_workflowId)
            setSelectedAppID(_appID)
            getWorkflowStatusData(_workflows)
            preventBodyScroll(true)
        })
    }

    const isShowRegexModal = (_appId: number, ciNodeId: number, inputMaterialList: any[]): boolean => {
        let showRegexModal = false
        const selectedCIPipeline = filteredCIPipelines.get(_appId).find((_ci) => _ci.id === ciNodeId)
        if (selectedCIPipeline?.ciMaterial) {
            for (const mat of selectedCIPipeline.ciMaterial) {
                showRegexModal = inputMaterialList.some((_mat) => {
                    return _mat.gitMaterialId === mat.gitMaterialId && mat.isRegex && !_mat.value
                })
                if (showRegexModal) {
                    break
                }
            }
        }
        return showRegexModal
    }

    const onClickCIMaterial = (ciNodeId: string, ciPipelineName: string, preserveMaterialSelection: boolean) => {
        setLoader(true)
        ReactGA.event(ENV_TRIGGER_VIEW_GA_EVENTS.MaterialClicked)
        updateCIMaterialList(ciNodeId, ciPipelineName, preserveMaterialSelection)
            .catch((errors: ServerErrors) => {
                showError(errors)
                setErrorCode(errors.code)
            })
            .finally(() => {
                setLoader(false)
            })
    }

    const onClickCDMaterial = (cdNodeId, nodeType: DeploymentNodeType) => {
        ReactGA.event(ENV_TRIGGER_VIEW_GA_EVENTS.ImageClicked)
        let _workflowId, _appID
        getCDMaterialList(cdNodeId, nodeType)
            .then((data) => {
                let _selectedNode
                const _workflows = [...workflows].map((workflow) => {
                    const nodes = workflow.nodes.map((node) => {
                        if (cdNodeId == node.id && node.type === nodeType) {
                            node[MATERIAL_TYPE.inputMaterialList] = data
                            _selectedNode = node
                            _workflowId = workflow.id
                            _appID = workflow.appId
                        }
                        return node
                    })
                    workflow.nodes = nodes
                    return workflow
                })
                setWorkflowID(_workflowId)
                setSelectedAppID(_appID)
                setWorkflows(_workflows)
                setSelectedCDNode({ id: +cdNodeId, name: _selectedNode.name, type: _selectedNode.type })
                setMaterialType(MATERIAL_TYPE.inputMaterialList)
                setShowCDModal(true)
                setLoading(false)
                preventBodyScroll(true)
            })
            .catch((errors: ServerErrors) => {
                showError(errors)
                setErrorCode(errors.code)
            })
    }

    const onClickRollbackMaterial = (
        cdNodeId: number,
        offset?: number,
        size?: number,
        callback?: (loadingMore: boolean, noMoreImages?: boolean) => void,
    ) => {
        if (!offset && !size) {
            ReactGA.event(ENV_TRIGGER_VIEW_GA_EVENTS.RollbackClicked)
        }

        const _offset = offset || 1
        const _size = size || 20

        getRollbackMaterialList(cdNodeId, _offset, _size)
            .then((response) => {
                let _selectedNode
                const _workflows = [...workflows].map((workflow) => {
                    const nodes = workflow.nodes.map((node) => {
                        if (response.result && node.type === 'CD' && +node.id == cdNodeId) {
                            _selectedNode = node
                            if (!offset && !size) {
                                node.rollbackMaterialList = response.result
                            } else {
                                node.rollbackMaterialList = node.rollbackMaterialList.concat(response.result)
                            }
                        }
                        return node
                    })
                    workflow.nodes = nodes
                    return workflow
                })
                setWorkflows(_workflows)
                setSelectedCDNode({ id: +cdNodeId, name: _selectedNode.name, type: _selectedNode.type })
                setMaterialType(MATERIAL_TYPE.rollbackMaterialList)
                setShowCDModal(true)
                setLoading(false)
                preventBodyScroll(true)
                getWorkflowStatusData(_workflows)
                if (callback && response.result) {
                    callback(false, response.result.length < 20)
                }
            })
            .catch((errors: ServerErrors) => {
                showError(errors)
                setErrorCode(errors.code)

                if (callback) {
                    callback(false)
                }
            })
    }

    const onClickTriggerCDNode = (
        nodeType: DeploymentNodeType,
        _appId: number,
        deploymentWithConfig?: string,
        wfrId?: number,
    ): void => {
        ReactGA.event(ENV_TRIGGER_VIEW_GA_EVENTS.CDTriggered(nodeType))
        setLoading(true)
        let node
        for (const _wf of workflows) {
            node = _wf.nodes.find((nd) => +nd.id == selectedCDNode.id && nd.type == selectedCDNode.type)
            if (node) break
        }

        const pipelineId = node.id
        const ciArtifact = node[materialType].find((artifact) => artifact.isSelected)
        if (_appId && pipelineId && ciArtifact.id) {
            triggerCDNode(pipelineId, ciArtifact.id, _appId.toString(), nodeType, deploymentWithConfig, wfrId)
                .then((response: any) => {
                    if (response.result) {
                        const msg =
                            materialType == MATERIAL_TYPE.rollbackMaterialList
                                ? 'Rollback Initiated'
                                : 'Deployment Initiated'
                        toast.success(msg)
                        setShowCDModal(false)
                        setLoading(false)
                        setErrorCode(response.code)
                        preventBodyScroll(false)
                        getWorkflowStatusData(workflows)
                    }
                })
                .catch((errors: ServerErrors) => {
                    showError(errors)
                    setLoading(false)
                    setErrorCode(errors.code)
                })
        } else {
            let message = _appId ? '' : 'app id missing '
            message += pipelineId ? '' : 'pipeline id missing '
            message += ciArtifact.id ? '' : 'Artifact id missing '
            toast.error(message)
        }
    }

    const onClickTriggerCINode = () => {
        ReactGA.event(ENV_TRIGGER_VIEW_GA_EVENTS.CITriggered)
        setLoading(true)
        let node, dockerfileConfiguredGitMaterialId
        for (const wf of workflows) {
            node = wf.nodes.find((node) => {
                return node.type === selectedCINode.type && +node.id == selectedCINode.id
            })

            if (node) {
                dockerfileConfiguredGitMaterialId = wf.ciConfiguredGitMaterialId
                break
            }
        }

        const gitMaterials = new Map<number, string[]>()
        const ciPipelineMaterials = []
        for (const _inputMaterial of node.inputMaterialList) {
            gitMaterials[_inputMaterial.gitMaterialId] = [
                _inputMaterial.gitMaterialName.toLowerCase(),
                _inputMaterial.value,
            ]
            if (_inputMaterial) {
                if (_inputMaterial.value === DEFAULT_GIT_BRANCH_VALUE) continue
                const history = _inputMaterial.history.filter((hstry) => hstry.isSelected)
                if (!history.length) {
                    history.push(_inputMaterial.history[0])
                }

                history.forEach((element) => {
                    const historyItem = {
                        Id: _inputMaterial.id,
                        GitCommit: {
                            Commit: element.commit,
                        },
                    }
                    if (!element.commit) {
                        historyItem.GitCommit['WebhookData'] = {
                            id: element.webhookData.id,
                        }
                    }
                    ciPipelineMaterials.push(historyItem)
                })
            }
        }
        if (gitMaterials[dockerfileConfiguredGitMaterialId][1] === DEFAULT_GIT_BRANCH_VALUE) {
            toast.error(
                CI_CONFIGURED_GIT_MATERIAL_ERROR.replace(
                    '$GIT_MATERIAL_ID',
                    `"${gitMaterials[dockerfileConfiguredGitMaterialId][0]}"`,
                ),
            )
            setLoading(false)
            return
        }
        const payload = {
            pipelineId: +selectedCINode.id,
            ciPipelineMaterials: ciPipelineMaterials,
            invalidateCache: invalidateCache,
        }

        triggerCINode(payload)
            .then((response: any) => {
                if (response.result) {
                    toast.success('Pipeline Triggered')
                    setShowCIModal(false)
                    setLoading(false)
                    setErrorCode(response.code)
                    setInvalidateCache(false)
                    preventBodyScroll(false)
                    getWorkflowStatusData(workflows)
                }
            })
            .catch((errors: ServerErrors) => {
                showError(errors)

                setLoading(false)

                setErrorCode(errors.code)
            })
    }

    const selectCommit = (materialId: string, hash: string, ciPipelineId?: string): void => {
        const _workflows = [...workflows].map((workflow) => {
            const nodes = workflow.nodes.map((node) => {
                if (node.type === WorkflowNodeType.CI && +node.id == (ciPipelineId ?? selectedCINode.id)) {
                    node.inputMaterialList.map((material) => {
                        if (material.id == materialId && material.isSelected) {
                            material.history.map((hist) => {
                                if (material.type == SourceTypeMap.WEBHOOK) {
                                    hist.isSelected =
                                        hist.webhookData && hist.webhookData.id && hash == hist.webhookData.id
                                } else {
                                    hist.isSelected = hash == hist.commit
                                }
                            })
                        }
                    })
                    return node
                }
                return node
            })
            workflow.nodes = nodes
            return workflow
        })
        setWorkflows(_workflows)
    }

    const selectMaterial = (materialId, pipelineId?: number): void => {
        const _workflows = [...workflows].map((workflow) => {
            const nodes = workflow.nodes.map((node) => {
                if (node.type === WorkflowNodeType.CI && +node.id == (pipelineId ?? selectedCINode.id)) {
                    node.inputMaterialList = node.inputMaterialList.map((material) => {
                        return {
                            ...material,
                            searchText: material.searchText || '',
                            isSelected: material.id == materialId,
                        }
                    })
                }
                return node
            })
            workflow.nodes = nodes
            return workflow
        })
        setWorkflows(_workflows)
    }

    const selectImage = (
        index: number,
        materialType: string,
        selectedCDDetail?: { id: number; type: DeploymentNodeType },
    ): void => {
        const _workflows = [...workflows].map((workflow) => {
            const nodes = workflow.nodes.map((node) => {
                if (
                    (selectedCDDetail && selectedCDDetail.id === +node.id && selectedCDDetail.type === node.type) ||
                    (selectedCDNode && selectedCDNode.id == +node.id && node.type === selectedCDNode.type)
                ) {
                    const artifacts = node[materialType].map((artifact, i) => {
                        return {
                            ...artifact,
                            isSelected: i === index,
                        }
                    })
                    node[materialType] = artifacts
                }
                return node
            })
            workflow.nodes = nodes
            return workflow
        })
        setWorkflows(_workflows)
    }

    const toggleChanges = (materialId: string, hash: string): void => {
        const _workflows = [...workflows].map((workflow) => {
            const nodes = workflow.nodes.map((node) => {
                if (node.type === selectedCINode.type && +node.id == selectedCINode.id) {
                    node.inputMaterialList.map((material) => {
                        if (material.id == materialId) {
                            material.history.map((hist) => {
                                if (hist.commit == hash) hist.showChanges = !hist.showChanges
                            })
                        }
                    })
                }
                return node
            })
            workflow.nodes = nodes
            return workflow
        })

        setWorkflows(_workflows)
    }

    const toggleSourceInfo = (
        materialIndex: number,
        selectedCDDetail?: { id: number; type: DeploymentNodeType },
    ): void => {
        const _workflows = [...workflows].map((workflow) => {
            const nodes = workflow.nodes.map((node) => {
                if (
                    (selectedCDDetail && selectedCDDetail.id === +node.id && selectedCDDetail.type === node.type) ||
                    (selectedCDNode && selectedCDNode.id == +node.id && node.type === selectedCDNode.type)
                ) {
                    node[materialType][materialIndex].showSourceInfo = !node[materialType][materialIndex].showSourceInfo
                }
                return node
            })
            workflow.nodes = nodes
            return workflow
        })
        setWorkflows(_workflows)
    }

    const toggleInvalidateCache = (): void => {
        setInvalidateCache(!invalidateCache)
    }

    //TODO: refactor
    const changeTab = (
        materialIndex,
        artifactId: number,
        tab,
        selectedCDDetail?: { id: number; type: DeploymentNodeType },
        appId?: number,
    ): void => {
        if (tab === CDModalTab.Changes) {
            const _workflows = [...workflows].map((workflow) => {
                const nodes = workflow.nodes.map((node) => {
                    if (
                        (selectedCDDetail && selectedCDDetail.id === +node.id && selectedCDDetail.type === node.type) ||
                        (selectedCDNode && selectedCDNode.id == +node.id && node.type === selectedCDNode.type)
                    ) {
                        node[materialType][materialIndex].tab = tab
                    }
                    return node
                })
                workflow.nodes = nodes
                return workflow
            })
            setWorkflows(_workflows)
            return
        }

        let targetNode
        for (const _wf of workflows) {
            targetNode = _wf.nodes.find(
                (node) =>
                    (selectedCDDetail && selectedCDDetail.id === +node.id && selectedCDDetail.type === node.type) ||
                    (selectedCDNode && selectedCDNode.id == +node.id && node.type === selectedCDNode.type),
            )
            if (targetNode) break
        }

        if (targetNode || targetNode.scanned || targetNode.scanEnabled) {
            getLastExecutionByArtifactAppEnv(artifactId, appId || selectedAppID, targetNode.environmentId)
                .then((response) => {
                    const _workflows = [...workflows].map((workflow) => {
                        const nodes = workflow.nodes.map((node) => {
                            if (
                                (selectedCDDetail &&
                                    selectedCDDetail.id === +node.id &&
                                    selectedCDDetail.type === node.type) ||
                                (selectedCDNode && selectedCDNode.id == +node.id && node.type === selectedCDNode.type)
                            ) {
                                node[materialType][materialIndex].tab = tab
                                node[materialType][materialIndex]['vulnerabilities'] = response.result.vulnerabilities
                                node[materialType][materialIndex]['lastExecution'] = response.result.lastExecution
                                node[materialType][materialIndex]['vulnerabilitiesLoading'] = false
                            }
                            return node
                        })
                        workflow.nodes = nodes
                        return workflow
                    })
                    setWorkflows(_workflows)
                })
                .catch((error) => {
                    showError(error)
                    const _workflows = [...workflows].map((workflow) => {
                        const nodes = workflow.nodes.map((node) => {
                            if (
                                (selectedCDDetail &&
                                    selectedCDDetail.id === +node.id &&
                                    selectedCDDetail.type === node.type) ||
                                (selectedCDNode && selectedCDNode.id == +node.id && node.type === selectedCDNode.type)
                            ) {
                                node[materialType][materialIndex].tab = tab
                                node[materialType][materialIndex]['vulnerabilitiesLoading'] = false
                            }
                            return node
                        })
                        workflow.nodes = nodes
                        return workflow
                    })
                    setWorkflows(_workflows)
                })
        }
    }

    const closeCIModal = (): void => {
        preventBodyScroll(false)
        setShowCIModal(false)
        setShowMaterialRegexModal(false)
    }

    const closeCDModal = (e): void => {
        preventBodyScroll(false)
        setShowCDModal(false)
    }

    const hideWebhookModal = (e?) => {
        if (e) {
            stopPropagation(e)
        }
        setShowWebhookModal(false)
    }

    const onShowCIModal = () => {
        setShowCIModal(true)
    }

    const onClickWebhookTimeStamp = () => {
        if (webhookTimeStampOrder === TIME_STAMP_ORDER.DESCENDING) {
            setWebhookTimeStampOrder(TIME_STAMP_ORDER.ASCENDING)
        } else if (webhookTimeStampOrder === TIME_STAMP_ORDER.ASCENDING) {
            setWebhookTimeStampOrder(TIME_STAMP_ORDER.DESCENDING)
        }
    }

    const toggleWebhookModal = (id, _webhookTimeStampOrder) => {
        setWebhookPayloadLoading(true)
        getCIWebhookRes(id, _webhookTimeStampOrder).then((result) => {
            setShowWebhookModal(true)
            setWebhookPayloads(result?.result)
            setWebhookPayloadLoading(false)
        })
    }

    const onCloseBranchRegexModal = () => {
        setShowMaterialRegexModal(false)
    }

    const onClickShowBranchRegexModal = (isChangedBranch = false) => {
        setShowCIModal(false)
        setShowMaterialRegexModal(true)
        setChangeBranchClicked(isChangedBranch)
    }

    const hideBulkCDModal = () => {
        if (!isLoading) {
            setShowBulkCDModal(false)
            setResponseList([])
        }
    }

    const onShowBulkCDModal = (e) => {
        setLoading(true)
        setBulkTriggerType(e.currentTarget.dataset.triggerType)
        setTimeout(() => {
            setShowBulkCDModal(true)
        }, 100)
    }

    const hideBulkCIModal = () => {
        if (!isLoading) {
            setShowBulkCIModal(false)
            setResponseList([])
        }
    }

    const onShowBulkCIModal = () => {
        setLoading(true)
        setShowBulkCIModal(true)
    }

    const updateBulkCDInputMaterial = (materialList: Record<string, any[]>): void => {
        const _workflows = workflows.map((wf) => {
            if (wf.isSelected) {
                const _appId = wf.appId
                const _cdNode = wf.nodes.find(
                    (node) => node.type === WorkflowNodeType.CD && node.environmentId === +envId,
                )
                let _selectedNode: NodeAttr
                if (bulkTriggerType === DeploymentNodeType.PRECD) {
                    _selectedNode = _cdNode.preNode
                } else if (bulkTriggerType === DeploymentNodeType.CD) {
                    _selectedNode = _cdNode
                } else if (bulkTriggerType === DeploymentNodeType.POSTCD) {
                    _selectedNode = _cdNode.preNode
                }
                if (_selectedNode) {
                    _selectedNode.inputMaterialList = materialList[_appId]
                }
            }
            return wf
        })
        setWorkflows(_workflows)
    }

    const onClickTriggerBulkCD = (appsToRetry?: Record<string, boolean>) => {
        if (isLoading) return
        ReactGA.event(ENV_TRIGGER_VIEW_GA_EVENTS.BulkCDTriggered(bulkTriggerType))
        setLoading(true)
        const _appIdMap = new Map<string, string>(),
            nodeList: NodeAttr[] = [],
            triggeredAppList: { appId: number; appName: string }[] = []
        for (const _wf of workflows) {
            if (_wf.isSelected && (!appsToRetry || appsToRetry[_wf.appId])) {
                const _cdNode = _wf.nodes.find(
                    (node) => node.type === WorkflowNodeType.CD && node.environmentId === +envId,
                )
                let _selectedNode: NodeAttr
                if (bulkTriggerType === DeploymentNodeType.PRECD) {
                    _selectedNode = _cdNode.preNode
                } else if (bulkTriggerType === DeploymentNodeType.CD) {
                    _selectedNode = _cdNode
                } else if (bulkTriggerType === DeploymentNodeType.POSTCD) {
                    _selectedNode = _cdNode.preNode
                }

                if (_selectedNode && _selectedNode[materialType]) {
                    nodeList.push(_selectedNode)
                    _appIdMap.set(_selectedNode.id, _wf.appId.toString())
                    triggeredAppList.push({ appId: _wf.appId, appName: _wf.name })
                }
            }
        }
        const _CDTriggerPromiseList = []
        nodeList.forEach((node) => {
            const ciArtifact = node[materialType].find((artifact) => artifact.isSelected == true)
            if (ciArtifact) {
                _CDTriggerPromiseList.push(
                    triggerCDNode(node.id, ciArtifact.id, _appIdMap.get(node.id), bulkTriggerType),
                )
            }
        })
        handleBulkTrigger(_CDTriggerPromiseList, triggeredAppList, WorkflowNodeType.CD)
    }

    const handleBulkTrigger = (
        promiseList: any[],
        triggeredAppList: { appId: number; appName: string }[],
        type: WorkflowNodeType,
    ): void => {
        if (promiseList.length) {
            Promise.allSettled(promiseList).then((responses: any) => {
                const _responseList = []
                responses.forEach((response, index) => {
                    if (response.status === 'fulfilled') {
                        _responseList.push({
                            appId: triggeredAppList[index].appId,
                            appName: triggeredAppList[index].appName,
                            statusText:
                                type === WorkflowNodeType.CI
                                    ? BULK_CI_RESPONSE_STATUS_TEXT[BulkResponseStatus.PASS]
                                    : BULK_CD_RESPONSE_STATUS_TEXT[BulkResponseStatus.PASS],
                            status: BulkResponseStatus.PASS,
                            message: '',
                        })
                    } else {
                        const errorReason = response.reason
                        if (errorReason.code === 403) {
                            _responseList.push({
                                appId: triggeredAppList[index].appId,
                                appName: triggeredAppList[index].appName,
                                statusText:
                                    type === WorkflowNodeType.CI
                                        ? BULK_CI_RESPONSE_STATUS_TEXT[BulkResponseStatus.UNAUTHORIZE]
                                        : BULK_CD_RESPONSE_STATUS_TEXT[BulkResponseStatus.UNAUTHORIZE],
                                status: BulkResponseStatus.UNAUTHORIZE,
                                message: errorReason.errors[0].userMessage,
                            })
                        } else {
                            _responseList.push({
                                appId: triggeredAppList[index].appId,
                                appName: triggeredAppList[index].appName,
                                statusText:
                                    type === WorkflowNodeType.CI
                                        ? BULK_CI_RESPONSE_STATUS_TEXT[BulkResponseStatus.FAIL]
                                        : BULK_CD_RESPONSE_STATUS_TEXT[BulkResponseStatus.FAIL],
                                status: BulkResponseStatus.FAIL,
                                message: errorReason.errors[0].userMessage,
                            })
                        }
                    }
                })
                setResponseList(_responseList)
                setLoading(false)
                preventBodyScroll(false)
                getWorkflowStatusData(workflows)
            })
        } else {
            setLoading(false)
            setShowBulkCDModal(false)
            setShowBulkCIModal(false)
            setResponseList([])
        }
    }

    const updateBulkCIInputMaterial = (materialList: Record<string, any[]>): void => {
        const _workflows = [...workflows].map((wf) => {
            const _appId = wf.appId
            const _ciNode = wf.nodes.find((node) => node.type === WorkflowNodeType.CI)
            if (_ciNode) {
                _ciNode.inputMaterialList = materialList[_appId]
            }
            return wf
        })
        setWorkflows(_workflows)
    }

    const onClickTriggerBulkCI = (appIgnoreCache: Record<number, boolean>, appsToRetry?: Record<string, boolean>) => {
        if (isLoading) return
        ReactGA.event(ENV_TRIGGER_VIEW_GA_EVENTS.BulkCITriggered)
        setLoading(true)
        let node, dockerfileConfiguredGitMaterialId
        const nodeList: NodeAttr[] = [],
            triggeredAppList: { appId: number; appName: string }[] = []
        for (const _wf of workflows) {
            if (_wf.isSelected && (!appsToRetry || appsToRetry[_wf.appId])) {
                triggeredAppList.push({ appId: _wf.appId, appName: _wf.name })
                node = _wf.nodes.find((node) => {
                    return node.type === WorkflowNodeType.CI
                })

                if (node && !node.isLinkedCI) {
                    nodeList.push(node)
                    dockerfileConfiguredGitMaterialId = _wf.ciConfiguredGitMaterialId
                }
            }
        }
        const _CITriggerPromiseList = []
        nodeList.forEach((node) => {
            const gitMaterials = new Map<number, string[]>()
            const ciPipelineMaterials = []
            for (let i = 0; i < node.inputMaterialList.length; i++) {
                gitMaterials[node.inputMaterialList[i].gitMaterialId] = [
                    node.inputMaterialList[i].gitMaterialName.toLowerCase(),
                    node.inputMaterialList[i].value,
                ]
                if (node.inputMaterialList[i].value === DEFAULT_GIT_BRANCH_VALUE) continue
                const history = node.inputMaterialList[i].history.filter((hstry) => hstry.isSelected)
                if (!history.length) {
                    history.push(node.inputMaterialList[i].history[0])
                }

                history.forEach((element) => {
                    const historyItem = {
                        Id: node.inputMaterialList[i].id,
                        GitCommit: {
                            Commit: element.commit,
                        },
                    }
                    if (!element.commit) {
                        historyItem.GitCommit['WebhookData'] = {
                            id: element.webhookData.id,
                        }
                    }
                    ciPipelineMaterials.push(historyItem)
                })
            }
            // if (gitMaterials[dockerfileConfiguredGitMaterialId][1] === DEFAULT_GIT_BRANCH_VALUE) {
            //     toast.error(
            //         CI_CONFIGURED_GIT_MATERIAL_ERROR.replace(
            //             '$GIT_MATERIAL_ID',
            //             `"${gitMaterials[dockerfileConfiguredGitMaterialId][0]}"`,
            //         ),
            //     )
            //     setLoading(false)
            //     return
            // }
            const payload = {
                pipelineId: +node.id,
                ciPipelineMaterials: ciPipelineMaterials,
                invalidateCache: appIgnoreCache[+node.id],
            }
            _CITriggerPromiseList.push(triggerCINode(payload))
        })
        handleBulkTrigger(_CITriggerPromiseList, triggeredAppList, WorkflowNodeType.CI)
    }

    const createBulkCDTriggerData = (): BulkCDDetailType[] => {
        const _selectedAppWorkflowList: BulkCDDetailType[] = []
        workflows.forEach((wf) => {
            if (wf.isSelected) {
                const _cdNode = wf.nodes.find(
                    (node) => node.type === WorkflowNodeType.CD && node.environmentId === +envId,
                )
                let _selectedNode: NodeAttr
                if (bulkTriggerType === DeploymentNodeType.PRECD) {
                    _selectedNode = _cdNode.preNode
                } else if (bulkTriggerType === DeploymentNodeType.CD) {
                    _selectedNode = _cdNode
                } else if (bulkTriggerType === DeploymentNodeType.POSTCD) {
                    _selectedNode = _cdNode.preNode
                }
                if (_selectedNode) {
                    _selectedAppWorkflowList.push({
                        workFlowId: wf.id,
                        appId: wf.appId,
                        name: wf.name,
                        cdPipelineName: _cdNode.title,
                        cdPipelineId: _cdNode.id,
                        stageType: WorkflowNodeType[_selectedNode.type],
                        envName: _selectedNode.environmentName,
                        parentPipelineId: _selectedNode.parentPipelineId,
                        parentPipelineType: WorkflowNodeType[_selectedNode.parentPipelineType],
                        parentEnvironmentName: _selectedNode.parentEnvironmentName,
                        material: _selectedNode.inputMaterialList,
                    })
                } else {
                    let notFoundMessage = ''
                    if (bulkTriggerType === DeploymentNodeType.PRECD) {
                        notFoundMessage = 'No pre-deployment stage'
                    } else if (bulkTriggerType === DeploymentNodeType.CD) {
                        notFoundMessage = 'No deployment stage'
                    } else if (bulkTriggerType === DeploymentNodeType.POSTCD) {
                        notFoundMessage = 'No post-deployment stage'
                    }
                    _selectedAppWorkflowList.push({
                        workFlowId: wf.id,
                        appId: wf.appId,
                        name: wf.name,
                        notFoundMessage: notFoundMessage,
                        envName: _cdNode.environmentName,
                    })
                }
            }
        })
        return _selectedAppWorkflowList
    }

    const getWarningMessage = (_ciNode): string => {
        if (_ciNode.isLinkedCI) {
            return 'Has linked build pipeline'
        } else if (_ciNode.type === WorkflowNodeType.WEBHOOK) {
            return 'Has webhook build pipeline'
        }
    }

    const getErrorMessage = (_appId, _ciNode): string => {
        let errorMessage = ''
        if (_ciNode.inputMaterialList?.length > 0) {
            if (isShowRegexModal(_appId, +_ciNode.id, _ciNode.inputMaterialList)) {
                errorMessage = 'Primary branch is not set'
            } else {
                const selectedCIPipeline = filteredCIPipelines.get(_appId).find((_ci) => _ci.id === +_ciNode.id)
                if (selectedCIPipeline?.ciMaterial) {
                    const invalidInputMaterial = _ciNode.inputMaterialList.find((_mat) => {
                        return _mat.isBranchError || _mat.isRepoError
                    })
                    if (invalidInputMaterial) {
                        errorMessage = invalidInputMaterial.isBranchError
                            ? invalidInputMaterial.branchErrorMsg
                            : invalidInputMaterial.repoErrorMsg
                    }
                }
            }
        }
        return errorMessage
    }

    const createBulkCITriggerData = (): BulkCIDetailType[] => {
        const _selectedAppWorkflowList: BulkCIDetailType[] = []
        workflows.forEach((wf) => {
            if (wf.isSelected) {
                const _ciNode = wf.nodes.find(
                    (node) => node.type === WorkflowNodeType.CI || node.type === WorkflowNodeType.WEBHOOK,
                )
                if (_ciNode) {
                    const configuredMaterialList = new Map<number, Set<number>>()
                    configuredMaterialList[wf.name] = new Set<number>()
                    handleSourceNotConfigured(configuredMaterialList, wf, _ciNode[MATERIAL_TYPE.inputMaterialList])
                    _selectedAppWorkflowList.push({
                        workFlowId: wf.id,
                        appId: wf.appId,
                        name: wf.name,
                        ciPipelineName: _ciNode.title,
                        ciPipelineId: _ciNode.id,
                        isFirstTrigger: _ciNode.status?.toLowerCase() === BUILD_STATUS.NOT_TRIGGERED,
                        isCacheAvailable: _ciNode.storageConfigured,
                        isLinkedCI: _ciNode.isLinkedCI,
                        isWebhookCI: _ciNode.type === WorkflowNodeType.WEBHOOK,
                        parentAppId: _ciNode.parentAppId,
                        parentCIPipelineId: _ciNode.parentCiPipeline,
                        material: _ciNode.inputMaterialList,
                        warningMessage: getWarningMessage(_ciNode),
                        errorMessage: getErrorMessage(wf.appId, _ciNode),
                        hideSearchHeader: _ciNode.type === WorkflowNodeType.WEBHOOK || _ciNode.isLinkedCI,
                        filteredCIPipelines: filteredCIPipelines.get(wf.appId),
                    })
                }
            }
        })
        return _selectedAppWorkflowList
    }

    if (pageViewType === ViewType.LOADING) {
        return <Progressing pageLoader />
    } else if (pageViewType === ViewType.ERROR) {
        return <ErrorScreenManager code={errorCode} />
    } else if (!workflows.length) {
        return (
            <div>
                <AppNotConfigured />
            </div>
        )
    }

    const renderCIMaterial = (): JSX.Element | null => {
        if ((selectedCINode?.id && showCIModal) || showMaterialRegexModal) {
            let nd: NodeAttr, _appID
            const configuredMaterialList = new Map<number, Set<number>>()
            for (const _wf of workflows) {
                nd = _wf.nodes.find((node) => +node.id == selectedCINode.id && node.type === selectedCINode.type)
                if (nd) {
                    configuredMaterialList[_wf.name] = new Set<number>()
                    _appID = _wf.appId
                    handleSourceNotConfigured(configuredMaterialList, _wf, nd[materialType])
                    break
                }
            }
            const material = nd?.[materialType] || []
            return (
                <CIMaterial
                    workflowId={workflowID}
                    history={history}
                    location={location}
                    match={match}
                    material={material}
                    pipelineName={selectedCINode.name}
                    isLoading={isLoading}
                    title={selectedCINode.name}
                    pipelineId={selectedCINode.id}
                    showWebhookModal={showWebhookModal}
                    hideWebhookModal={hideWebhookModal}
                    toggleWebhookModal={toggleWebhookModal}
                    webhookPayloads={webhookPayloads}
                    isWebhookPayloadLoading={isWebhookPayloadLoading}
                    onClickWebhookTimeStamp={onClickWebhookTimeStamp}
                    webhhookTimeStampOrder={webhookTimeStampOrder}
                    showMaterialRegexModal={showMaterialRegexModal}
                    onCloseBranchRegexModal={onCloseBranchRegexModal}
                    filteredCIPipelines={filteredCIPipelines.get(_appID)}
                    onClickShowBranchRegexModal={onClickShowBranchRegexModal}
                    showCIModal={showCIModal}
                    onShowCIModal={onShowCIModal}
                    isChangeBranchClicked={isChangeBranchClicked}
                    getWorkflows={getWorkflowsData}
                    loader={loader}
                    setLoader={setLoader}
                    isFirstTrigger={nd?.status?.toLowerCase() === BUILD_STATUS.NOT_TRIGGERED}
                    isCacheAvailable={nd?.storageConfigured}
                    fromAppGrouping={true}
                    appId={_appID.toString()}
                />
            )
        }

        return null
    }

    const renderBulkCDMaterial = (): JSX.Element | null => {
        if (!showBulkCDModal) {
            return null
        }
        const _selectedAppWorkflowList: BulkCDDetailType[] = createBulkCDTriggerData()
        return (
            <BulkCDTrigger
                stage={bulkTriggerType}
                appList={_selectedAppWorkflowList}
                closePopup={hideBulkCDModal}
                updateBulkInputMaterial={updateBulkCDInputMaterial}
                onClickTriggerBulkCD={onClickTriggerBulkCD}
                changeTab={changeTab}
                toggleSourceInfo={toggleSourceInfo}
                selectImage={selectImage}
                responseList={responseList}
                isLoading={isLoading}
                setLoading={setLoading}
            />
        )
    }

    const renderBulkCIMaterial = (): JSX.Element | null => {
        if (!showBulkCIModal) {
            return null
        }
        const _selectedAppWorkflowList: BulkCIDetailType[] = createBulkCITriggerData()
        return (
            <BulkCITrigger
                appList={_selectedAppWorkflowList}
                closePopup={hideBulkCIModal}
                updateBulkInputMaterial={updateBulkCIInputMaterial}
                onClickTriggerBulkCI={onClickTriggerBulkCI}
                showWebhookModal={showWebhookModal}
                hideWebhookModal={hideWebhookModal}
                toggleWebhookModal={toggleWebhookModal}
                webhookPayloads={webhookPayloads}
                isWebhookPayloadLoading={isWebhookPayloadLoading}
                isShowRegexModal={isShowRegexModal}
                responseList={responseList}
                isLoading={isLoading}
                setLoading={setLoading}
            />
        )
    }

    const renderCDMaterial = (): JSX.Element | null => {
        if (showCDModal && selectedCDNode?.id) {
            let node: NodeAttr, _appID
            for (const _wf of workflows) {
                node = _wf.nodes.find((el) => {
                    return +el.id == selectedCDNode.id && el.type == selectedCDNode.type
                })
                if (node) {
                    _appID = _wf.appId
                    break
                }
            }
            const material = node?.[materialType] || []

            return (
                <CDMaterial
                    appId={_appID}
                    pipelineId={selectedCDNode.id}
                    stageType={DeploymentNodeType[selectedCDNode.type]}
                    material={material}
                    materialType={materialType}
                    envName={node.environmentName}
                    isLoading={isLoading}
                    changeTab={changeTab}
                    triggerDeploy={onClickTriggerCDNode}
                    onClickRollbackMaterial={onClickRollbackMaterial}
                    closeCDModal={closeCDModal}
                    selectImage={selectImage}
                    toggleSourceInfo={toggleSourceInfo}
                    parentPipelineId={node.parentPipelineId}
                    parentPipelineType={node.parentPipelineType}
                    parentEnvironmentName={node.parentEnvironmentName}
                />
            )
        }

        return null
    }

    const renderDeployPopupMenu = (): JSX.Element => {
        return (
            <PopupMenu autoClose>
                <PopupMenu.Button
                    isKebab
                    rootClassName="h-36 popup-button-kebab dc__border-left-n3 pl-4 pr-4 dc__no-left-radius flex bcb-5"
                >
                    <Dropdown className="icon-dim-20 fcn-0" />
                </PopupMenu.Button>
                <PopupMenu.Body>
                    <div
                        className="flex left p-10 dc__hover-n50 pointer"
                        data-trigger-type={'PRECD'}
                        onClick={onShowBulkCDModal}
                    >
                        Trigger Pre-deployment stage
                    </div>
                    <div
                        className="flex left p-10 dc__hover-n50 pointer"
                        data-trigger-type={'CD'}
                        onClick={onShowBulkCDModal}
                    >
                        Trigger Deployment
                    </div>
                    <div
                        className="flex left p-10 dc__hover-n50 pointer"
                        data-trigger-type={'POSTCD'}
                        onClick={onShowBulkCDModal}
                    >
                        Trigger Post-deployment stage
                    </div>
                </PopupMenu.Body>
            </PopupMenu>
        )
    }

    const renderBulkTriggerActionButtons = (): JSX.Element => {
        return (
            <div className="flex dc__min-width-fit-content">
                <button className="cta flex h-36 mr-12" onClick={onShowBulkCIModal}>
                    {isLoading ? <Progressing /> : 'Build image'}
                </button>
                <button
                    className="cta flex h-36 dc__no-right-radius"
                    data-trigger-type={'CD'}
                    onClick={onShowBulkCDModal}
                >
                    {isLoading ? (
                        <Progressing />
                    ) : (
                        <>
                            <DeployIcon className="icon-dim-16 dc__no-svg-fill mr-8" />
                            Deploy
                        </>
                    )}
                </button>
                {renderDeployPopupMenu()}
            </div>
        )
    }

    const renderSelectedApps = (): JSX.Element => {
        return (
            <div className="flex">
                <Close className="icon-dim-18 scr-5 mr-8 cursor mw-18" onClick={clearAppList} />
                <div>
                    <div className="fs-13 fw-6 cn-9">
                        {selectedAppList.length} application{selectedAppList.length > 1 ? 's' : ''} selected
                    </div>
                    <div className="fs-13 fw-4 cn-7">
                        {selectedAppList.map((app, index) => (
                            <span key={`selected-app-${app.id}`}>
                                {app.name}
                                {index !== selectedAppList.length - 1 && <span>, </span>}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    const renderWorkflow = (): JSX.Element => {
        return (
            <>
                {workflows.map((workflow) => {
                    return (
                        <Workflow
                            key={workflow.id}
                            id={workflow.id}
                            name={workflow.name}
                            startX={workflow.startX}
                            startY={workflow.startY}
                            height={workflow.height}
                            width={workflow.width}
                            nodes={workflow.nodes}
                            appId={workflow.appId}
                            isSelected={workflow.isSelected ?? false}
                            handleSelectionChange={handleSelectionChange}
                            fromAppGrouping={true}
                            history={history}
                            location={location}
                            match={match}
                        />
                    )
                })}
                {!!selectedAppList.length && (
                    <div
                        className="flexbox dc__content-space dc__position-fixed dc__bottom-0 dc__border-top w-100 bcn-0 pt-12 pr-20 pb-12 pl-20"
                        style={{ paddingLeft: '90px', right: 0 }}
                    >
                        {renderSelectedApps()}
                        {renderBulkTriggerActionButtons()}
                    </div>
                )}
            </>
        )
    }
    return (
        <div className="svg-wrapper-trigger" style={{ paddingBottom: selectedAppList.length ? '68px' : '16px' }}>
            <TriggerViewContext.Provider
                value={{
                    invalidateCache: invalidateCache,
                    refreshMaterial: refreshMaterial,
                    onClickTriggerCINode: onClickTriggerCINode,
                    onClickTriggerCDNode: onClickTriggerCDNode,
                    onClickCIMaterial: onClickCIMaterial,
                    onClickCDMaterial: onClickCDMaterial,
                    onClickRollbackMaterial: onClickRollbackMaterial,
                    closeCIModal: closeCIModal,
                    selectCommit: selectCommit,
                    selectMaterial: selectMaterial,
                    toggleChanges: toggleChanges,
                    toggleInvalidateCache: toggleInvalidateCache,
                    getMaterialByCommit: getMaterialByCommit,
                }}
            >
                {renderWorkflow()}
                {renderCIMaterial()}
                {renderCDMaterial()}
                {renderBulkCDMaterial()}
                {renderBulkCIMaterial()}
            </TriggerViewContext.Provider>
            <div></div>
        </div>
    )
}
