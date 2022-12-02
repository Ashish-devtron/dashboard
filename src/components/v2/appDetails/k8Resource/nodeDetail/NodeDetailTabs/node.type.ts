export interface TerminalViewProps {
    nodeName: string
    shell: any
    containerName: string
    socketConnection: SocketConnectionType
    terminalCleared: boolean
    setTerminalCleared: (terminalCleared: boolean) => void
    setSocketConnection: (socketConnection: SocketConnectionType) => void
    clusterTerminal?: boolean
    terminalId?: string
    fetchRetry?: boolean
    disconnectRetry?: () => void
    toggleOption?: boolean
    isFullScreen?: boolean
    isterminalTab?: boolean
    setTerminalTab?: (selectedTabIndex: number) => void
}

export enum SocketConnectionType {
    CONNECTING = 'CONNECTING',
    CONNECTED = 'CONNECTED',
    DISCONNECTING = 'DISCONNECTING',
    DISCONNECTED = 'DISCONNECTED',
}

export const ERROR_MESSAGE = {
    UNAUTHORIZED: 'Not authorized. You do not have permission to access the terminal for this application.',
}
