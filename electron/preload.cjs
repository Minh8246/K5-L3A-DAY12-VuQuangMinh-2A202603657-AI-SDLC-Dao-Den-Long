// Cầu nối an toàn giữa giao diện và tiến trình chính (contextIsolation bật mặc định).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ddl', {
  desktop: true,
  lbGet: () => ipcRenderer.invoke('lb:get'),
  lbAdd: (entry) => ipcRenderer.invoke('lb:add', entry),
  benchFirstFrame: () => ipcRenderer.send('bench:first-frame'),
  benchMeasureStart: () => ipcRenderer.send('bench:measure-start'),
  benchDone: (r) => ipcRenderer.send('bench:done', r),
});
