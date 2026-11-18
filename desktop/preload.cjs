const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('compcounterDesktop', {
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
