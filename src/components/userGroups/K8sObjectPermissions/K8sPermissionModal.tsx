import React, { useEffect, useState } from 'react'
import { ButtonWithLoader, Drawer, VisibleModal } from '../../common'
import { ActionTypes, OptionType } from '../userGroups.types'
import { ReactComponent as Close } from '../../../assets/icons/ic-close.svg'
import { ReactComponent as AddIcon } from '../../../assets/icons/ic-add.svg'
import K8sListItemCard from './K8sListItemCard'
import { getEmptyPermissionObject } from './K8sPermissions.utils'
import { toast } from 'react-toastify'

export default function K8sPermissionModal({ selectedPermissionAction, k8sPermission, setK8sPermission, close }) {
    const [k8PermissionList, setPermissionList] = useState([getEmptyPermissionObject(0, k8sPermission)])
    const [namespaceMapping, setNamespaceMapping] = useState<OptionType[]>()
    const [apiGroupMapping, setApiGroupMapping] = useState<Record<number, OptionType[]>>()
    const [kindMapping, setKindMapping] = useState<Record<number, OptionType[]>>()
    const [objectMapping, setObjectMapping] = useState<Record<number, OptionType[]>>()


    const handleK8sPermission = (action: string, key?: number, data?: any) => {
        const tempK8sPermission = [...k8PermissionList]
        switch (action) {
            case 'add':
                tempK8sPermission.splice(0, 0, getEmptyPermissionObject(tempK8sPermission.length))
                break
            case 'delete':
                tempK8sPermission.splice(key, 1)
                break
            case 'clone':
                tempK8sPermission.splice(0, 0, { ...tempK8sPermission[key], key: tempK8sPermission.length })
                break
            case 'edit':
                tempK8sPermission[key].cluster = data
                break
            case 'onClusterChange':
                tempK8sPermission[key].cluster = data
                tempK8sPermission[key].namespace = null
                tempK8sPermission[key].group = null
                tempK8sPermission[key].kind = null
                tempK8sPermission[key].resource = null
                break
            case 'onNamespaceChange':
                tempK8sPermission[key].namespace = data
                tempK8sPermission[key].group = null
                tempK8sPermission[key].kind = null
                tempK8sPermission[key].resource = null
                break
            case 'onApiGroupChange':
                tempK8sPermission[key].group = data
                tempK8sPermission[key].kind = null
                tempK8sPermission[key].resource = null
                break
            case 'onKindChange':
                tempK8sPermission[key].kind = data
                tempK8sPermission[key].resource = null
                break
            case 'onObjectChange':
                tempK8sPermission[key].resource = data
                break
            case 'onRoleChange':
                tempK8sPermission[key].action = data
                break
            default:
                break
        }
        setPermissionList(tempK8sPermission)
    }

    const stopPropogation = (e) => {
        e.stopPropagation()
    }

    const addNewPermissionCard = () => {
        handleK8sPermission('add')
    }

    const savePermission = () => {
        let isPermissionValid = k8PermissionList.reduce((valid,permission) => {
            valid = valid && !!permission.resource?.length
            return valid;
        }, true);
        
        if(isPermissionValid){
            setK8sPermission((prev) => {
                if (selectedPermissionAction?.action === 'edit') {
                    if(k8PermissionList?.length){
                        prev[selectedPermissionAction.index] = k8PermissionList[k8PermissionList.length - 1]
                        return [...prev]
                    }else {
                        const list = [...prev]
                        list.splice(selectedPermissionAction.index,1)
                        return list
                    }
                }else if(selectedPermissionAction?.action === 'clone' && !k8PermissionList?.length){
                    return [...prev]
                }
                return [...prev, ...k8PermissionList]
            })
            close(false)
        }else{
            toast.info("Some required inputs are not selected")
        }
        
    }

    return (
        <Drawer onClose={close} position={'right'} width="800px">
            <div onClick={stopPropogation} className="h-100 dc__overflow-hidden">
                <div className="flex pt-12 pb-12 pl-20 pr-20 dc__content-space bcn-0 dc__border-bottom">
                    <span className="flex left fw-6 lh-24 fs-16">Kubernetes resource permission</span>
                    <span className="icon-dim-20 cursor" onClick={close}>
                        <Close />
                    </span>
                </div>
                <div className="p-20 fs-13 dc__overflow-scroll dc__cluster-modal">
                    {!selectedPermissionAction && (
                        <div className="anchor pointer flex left fs-13 fw-6" onClick={addNewPermissionCard}>
                            <AddIcon className="add-svg fcb-5 mr-12" /> Add another
                        </div>
                    )}
                    {k8PermissionList?.map((_k8sPermission, index) => {
                        return (
                            <K8sListItemCard
                                k8sPermission={_k8sPermission}
                                handleK8sPermission={handleK8sPermission}
                                index={index}
                                namespaceMapping={namespaceMapping}
                                setNamespaceMapping={setNamespaceMapping}
                                apiGroupMapping={apiGroupMapping}
                                setApiGroupMapping={setApiGroupMapping}
                                kindMapping={kindMapping}
                                setKindMapping={setKindMapping}
                                objectMapping={objectMapping}
                                setObjectMapping={setObjectMapping}
                            />
                        )
                    })}
                </div>
                <div className="w-100 pt-16 pb-16 pl-20 pr-20 flex right bcn-0 dc__border-top">
                    <button type="button" className="cta cancel h-36 flex mr-16" onClick={close}>
                        Cancel
                    </button>
                    <button type="button" className="cta h-36 flex" onClick={savePermission}>
                        Done
                    </button>
                </div>
            </div>
        </Drawer>
    )
}
