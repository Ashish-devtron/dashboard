import React, { useEffect, useState } from 'react'
import { useParams, useRouteMatch } from 'react-router';
import IndexStore from '../../../index.store';
import { NodeDetailTab } from '../nodeDetail.type';
import { getEvent } from '../nodeDetail.api';
import { Pod as PodIcon } from '../../../../../common';
import moment from 'moment';
import { Spinner } from 'patternfly-react';
import { ReactComponent as InfoIcon } from '../../../../assets/icons/ic-info-filled-gray.svg'
import { NodeType } from '../../../appDetails.type';


function EventsComponent({ selectedTab }) {

    const params = useParams<{ actionName: string, podName: string, nodeType: string }>()
    const { url } = useRouteMatch()
    const [events, setEvents] = useState([])
    const [loading, setLoading] = useState(true)
    const appDetails = IndexStore.getAppDetails();
    const [podName, setPodName] = useState(params.podName)
    const pods = IndexStore.getNodesByKind(NodeType.Pod)

    useEffect(() => {
        selectedTab(NodeDetailTab.EVENTS, url)

        if (!appDetails) {
            //Refresh case -- need to sent to k8 , histrory push
        }

    }, [params.podName])

    useEffect(() => {
        setLoading(true)

        getEvent(appDetails, params.podName).then((response) => {
            setEvents(response.result.items || [])
            setLoading(false)
        }).catch((err) => {
            console.log("err", err)
            setEvents([])
            setLoading(false)
        })
    }, [podName])


    // const NoPod = ({ selectMessage = "Select a pod to view events", style = {} }) => {
    //     return <div data-testid="no-pod" className="no-pod no-pod--pod" style={{ ...style }}>
    //         <PodIcon color="var(--N400)" style={{ width: '48px', height: '48px', marginBottom: '12px' }} />
    //         <p>{selectMessage}</p>
    //     </div>
    // }

    // const NoEvents = ({ title = "Events not available" }) => {
    //     return (
    //         <div style={{ width: '100%', textAlign: 'center' }}>
    //             <InfoIcon />
    //             <div style={{ marginTop: '8px', color: 'rgb(156, 148, 148)' }}>{title}</div>
    //         </div>
    //     )
    // }

    return (
        <React.Fragment>
            {pods && pods.length > 0 && <div className="bcn-0 cn-9" >

                {!loading && events && events.length > 0 &&
                    <table className="table">
                        <thead>
                            <tr>
                                {['reason', 'message', 'count', 'last timestamp'].map((head, idx) => {
                                    return <th key={`eh_${idx}`}>{head}</th>
                                }
                                )}
                            </tr>
                        </thead>
                        <tbody>

                            {events.map((event, index) => {
                                return (
                                    <tr key={`eb_${index}`}>
                                        <td>{event.reason}</td>
                                        <td>{event.message}</td>
                                        <td>{event.count}</td>
                                        <td>{moment(event.lastTimestamp, 'YYYY-MM-DDTHH:mm:ss').add(5, 'hours').add(30, 'minutes').format('YYYY-MM-DD HH:mm:ss')}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                }

                {
                    (!loading && (!events || events.length === 0)) && <div className='flex column' style={{ minHeight: '600px' }}>
                        <div><InfoIcon /></div>
                        <div style={{ marginTop: '8px', color: 'rgb(156, 148, 148)' }}>Events not available</div>
                    </div>
                }


                {
                    loading && <div className="flex column h-100" style={{ minHeight: "600px" }}>
                        <Spinner loading></Spinner>
                        <div style={{ marginTop: '8px', color: 'rgb(156, 148, 148)' }}>fetching events</div>
                    </div>
                }


            </div>}

            {
                (pods.length === 0) &&
                <div data-testid="no-pod" className="no-pod no-pod--pod bcn-0" style={{ minHeight: "600px" }}>
                    <PodIcon color="var(--N400)" style={{ width: '48px', height: '48px', marginBottom: '12px' }} />
                    <p>Select a pod to view events</p>
                </div>
            }

        </React.Fragment>
    )
}

export default EventsComponent