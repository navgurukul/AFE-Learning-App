const { contextBridge, ipcRenderer } = require('electron');

console.log('🔌 Preload script loading (CommonJS)...');

const VALID_CHANNELS = [
    // Student operations
    'student:create',
    'student:getAll',
    'student:getById',
    'student:updateLastActive',

    // Content operations
    'content:getModules',
    'content:getModuleById',
    'content:getLessonById',

    // Progress tracking
    'progress:updateVideo',
    'progress:getVideo',
    'progress:getAllForStudent',
    'progress:markModuleStarted',
    'progress:getStartedModules',
    'progress:updateReading',
    'progress:getReading',
    'progress:getAllReadingForStudent',

    // Quiz operations
    'quiz:submitAttempt',
    'quiz:getAttempts',
    'quiz:getBestScore',

    // Analytics
    'analytics:trackEvent',
    'analytics:getSummary',

    // AI Tutor
    'ai:sendMessage',
    'ai:getSessionHistory',
    'ai:session:getAll',
    'ai:session:create',
    'ai:session:rename',
    'ai:session:delete',
    'ai:clearHistory',
    'ai:streamChunk',
    'ai:session:updated',

    // STT (Speech-to-Text)
    'stt:start',
    'stt:stop',
    'stt:audioChunk',
    'stt:partial-result'
];

contextBridge.exposeInMainWorld('electronAPI', {
    invoke: async (channel, data) => {
        if (!VALID_CHANNELS.includes(channel)) {
            console.error(`❌ Blocked unauthorized IPC call: ${channel}`);
            throw new Error(`Invalid IPC channel: ${channel}`);
        }
        return await ipcRenderer.invoke(channel, data);
    },
    send: (channel, data) => {
        if (!VALID_CHANNELS.includes(channel)) {
            console.error(`❌ Blocked unauthorized IPC send: ${channel}`);
            return;
        }
        ipcRenderer.send(channel, data);
    },
    on: (channel, callback) => {
        if (!VALID_CHANNELS.includes(channel)) {
            console.error(`❌ Blocked unauthorized IPC listener: ${channel}`);
            return;
        }
        // Wrapping ensures we don't leak the event object
        const subscription = (_event, ...args) => callback(...args);
        ipcRenderer.on(channel, subscription);

        return () => {
            ipcRenderer.removeListener(channel, subscription);
        };
    },
    stt: {
        start: () => ipcRenderer.send('stt-start'),
        stop: () => ipcRenderer.send('stt-stop'),
        sendChunk: (chunk) => ipcRenderer.send('stt-chunk', chunk),
        onResult: (callback) => {
            const subscription = (_event, text) => callback(text);
            ipcRenderer.on('stt-partial-result', subscription);

            return () => {
                ipcRenderer.removeListener('stt-partial-result', subscription);
            };
        }
    }
});                                 
