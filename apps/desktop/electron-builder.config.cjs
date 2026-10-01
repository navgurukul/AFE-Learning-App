module.exports = {
    appId: 'com.navgurukul.AFE',
    productName: 'Amazon Future Engineer',
    copyright: 'Copyright © 2026',

    // Directories
    directories: {
        output: 'release',
        buildResources: 'build',
    },

    // Files to include
    files: [
        'dist/**/*',
        'package.json',
        {
            from: '../renderer/dist',
            to: 'renderer/dist',
            filter: ['**/*'],
        },
    ],

    // Bundle STT and TTS binaries/models
    extraResources: [
        {
            from: '../../packages/backend/stt-engine',
            to: 'stt',
            filter: ['**/*', '!node_modules/**', '!tsconfig.json', '!tsconfig.tsbuildinfo'],
        },
        {
            from: '../../packages/backend/tts-engine',
            to: 'tts',
            filter: ['**/*', '!node_modules/**', '!tsconfig.json', '!tsconfig.tsbuildinfo'],
        },
        {
            from: '../../installer-assets',
            to: 'dev-data',
            filter: [
                '**/*',
                '!assets/videos2/**'
            ],
        },
    ],

    // Skip code signing (no certificate configured)
    forceCodeSigning: false,

    win: {
        icon: 'build/icon.ico',
        requestedExecutionLevel: 'requireAdministrator',
        legalTrademarks: 'Amazon Future Engineer is a registered mark of Amazon',
        verifyUpdateCodeSignature: false,
        target: [
            {
                target: 'nsis',
                arch: ['x64'],
            },
        ],
    },
    mac: {
        icon: 'build/icon.png',
        target: ['dmg'],
        category: 'public.app-category.education',
    },
    linux: {
        icon: 'build/icon.png',
        target: ['AppImage', 'deb'],
        category: 'Education',
        executableName: 'amazon-future-engineer',
        synopsis: 'Offline-first learning platform by NavGurukul',
        description: 'Amazon Future Engineer - Offline Learning App for students',
        executableArgs: ['--no-sandbox'],
        desktop: {
            Name: 'Amazon Future Engineer',
            Comment: 'Offline Learning Platform',
            Categories: 'Education;Science;',
            StartupWMClass: 'amazon-future-engineer',
        },
    },

    deb: {
        depends: [
            'libgtk-3-0',
            'libnotify4',
            'libnss3',
            'libxss1',
            'libxtst6',
            'xdg-utils',
            'libatspi2.0-0',
            'libuuid1',
            'libsecret-1-0',
            'libasound2',
        ],
        priority: 'optional',
        afterInstall: 'build/linux/after-install.sh',
        afterRemove: 'build/linux/after-remove.sh',
    },

    afterPack: async (context) => {
        if (context.electronPlatformName === 'linux') {
            const fs = require('fs');
            const path = require('path');
            const resourcesDir = path.join(context.appOutDir, 'resources');
            const binaries = [
                path.join(resourcesDir, 'stt', 'whisper-cli'),
                path.join(resourcesDir, 'tts', 'piper'),
            ];
            for (const bin of binaries) {
                try {
                    if (fs.existsSync(bin)) {
                        fs.chmodSync(bin, 0o755);
                    }
                } catch (err) {
                    console.warn(`[afterPack] Could not chmod ${bin}:`, err);
                }
            }
        }
    },

    // NSIS installer configuration (CRITICAL for silent 1-click install & update)
    nsis: {
        oneClick: true, // 1-click silent background updates
        allowToChangeInstallationDirectory: false, // Fixed install path
        perMachine: true, // System-wide installation (NOT per-user)

        installerIcon: 'build/icon.ico',
        uninstallerIcon: 'build/icon.ico',
        installerHeaderIcon: 'build/icon.ico',

        // Silent install support
        allowElevation: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        runAfterFinish: false,

        // Custom NSIS script for silent command-line / parameter handling
        include: 'build/installer-script.nsh',
        language: '1033', // English

        // Uninstall support
        deleteAppDataOnUninstall: true, // Prompt to delete data in ProgramData
        warningsAsErrors: false, // Allow non-critical NSIS warnings
    },

    // Publish configuration (disabled for offline app)
    publish: [
        {
            provider: 'github',
            owner: 'navgurukul',
            repo: 'AFE-Learning-App'
        }
    ],

    // Metadata
    compression: 'maximum',
    artifactName: '${productName}-Setup-${version}.${ext}',
};
