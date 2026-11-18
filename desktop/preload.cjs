const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('compcounterDesktop', {
  backup: {
    status: () => ipcRenderer.invoke('backup:status'),
    now: () => ipcRenderer.invoke('backup:now'),
    chooseFolder: () => ipcRenderer.invoke('backup:choose-folder'),
    defaultFolder: () => ipcRenderer.invoke('backup:default-folder'),
    openFolder: () => ipcRenderer.invoke('backup:open-folder'),
    restore: () => ipcRenderer.invoke('backup:restore'),
  },
  controllers: {
    get: () => ipcRenderer.invoke('controllers:get'),
    subscribe: (listener) => {
      const handler = (_event, state) => listener(state)
      ipcRenderer.on('controllers:state', handler)
      ipcRenderer.send('controllers:subscribe')
      return () => {
        ipcRenderer.removeListener('controllers:state', handler)
        ipcRenderer.send('controllers:unsubscribe')
      }
    },
    assign: (areaId, seat, exclude) => ipcRenderer.invoke('controllers:assign', { areaId, seat, exclude }),
    captureButton: () => ipcRenderer.invoke('controllers:capture-button'),
    cancel: () => ipcRenderer.invoke('controllers:cancel'),
    unassign: (slot) => ipcRenderer.invoke('controllers:unassign', slot),
    setMapping: (mapping) => ipcRenderer.invoke('controllers:set-mapping', mapping),
    identify: (slot) => ipcRenderer.invoke('controllers:identify', slot),
  },
})
