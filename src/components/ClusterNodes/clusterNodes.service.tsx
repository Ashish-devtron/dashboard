import { Routes } from '../../config'
import { get, post, put } from '../../services/api'
import { ResponseType } from '../../services/service.types'
import {
    ClusterCapacityResponse,
    ClusterListResponse,
    NodeDetailResponse,
    NodeListResponse,
    UpdateNodeRequestBody,
} from './types'

export const getClusterList = (): Promise<ClusterListResponse> => {
    return get(Routes.CLUSTER_LIST)
}

export const getClusterCapacity = (clusterId: string): Promise<ClusterCapacityResponse> => {
    return get(`${Routes.CLUSTER_CAPACITY}/${clusterId}`)
}

export const getNodeList = (clusterId: string): Promise<NodeListResponse> => {
    return get(`${Routes.NODE_LIST}?clusterId=${clusterId}`)
}

export const getNodeCapacity = (clusterId: string, nodeName: string): Promise<NodeDetailResponse> => {
    return get(`${Routes.NODE_CAPACITY}?clusterId=${clusterId}&name=${nodeName}`)
}

export const updateNodeManifest = (
    clusterId: string,
    nodeName: string,
    nodeData: UpdateNodeRequestBody,
): Promise<ResponseType> => {
    return put(`${Routes.NODE_CAPACITY}?clusterId=${clusterId}&name=${nodeName}`, nodeData)
}

export const clusterTerminalStart = (data): Promise<ResponseType> => {
    return put(`user/terminal/start`, data)
}

export const clusterterminalUpdate = (data): Promise<ResponseType> => {
    return post(`user/terminal/update`, data)
}

export const clusterterminalDisconnect = (terminalAccessId): Promise<ResponseType> => {
    return post(`user/terminal/disconnect?terminalAccessId=${terminalAccessId}`, null)
}

export const clusterDisconnectAndRetry = (data):  Promise<ResponseType> => {
    return post(`user/terminal/disconnectAndRetry`, data)
}

export const clusterTerminalStop = (terminalAccessId):  Promise<ResponseType> => {
    return post(`user/terminal/stop?terminalAccessId=${terminalAccessId}`, null)
}

export const clusterTerminalTypeUpdate = (data): Promise<ResponseType> => {
    return post(`user/terminal/update/shell`, data)
}

export const clusterNamespaceList = (): Promise<ResponseType> => {
    return get('/cluster/namespaces')
}

export const getclusterManifest = (terminalAccessId):  Promise<ResponseType> => {
    return get(`user/terminal/pod/manifest?terminalAccessId=${terminalAccessId}`)
}

export const getclusterEvents = (terminalAccessId):  Promise<ResponseType> => {
    return get(`user/terminal/pod/events?terminalAccessId=${terminalAccessId}`)
}