module.exports = {
    appId: 'com.navgurukul.AFE',
    productName: 'Amazon Future Engineer',
    electronVersion: '28.1.3',
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
        target: process.platform === 'win32' ? ['dir'] : ['AppImage', 'deb'],
        category: 'Education',
        maintainer: 'NavGurukul <info@navgurukul.org>',
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

            // Chmod all binaries and shared libraries in stt and tts
            for (const sub of ['stt', 'tts']) {
                const subDir = path.join(resourcesDir, sub);
                if (fs.existsSync(subDir)) {
                    try {
                        const files = fs.readdirSync(subDir);
                        for (const file of files) {
                            if (file.includes('.so') || file === 'whisper-cli' || file === 'piper') {
                                const fullPath = path.join(subDir, file);
                                try {
                                    fs.chmodSync(fullPath, 0o755);
                                    console.log(`[afterPack] Chmod 0o755 applied to ${fullPath}`);
                                } catch (e) {
                                    console.warn(`[afterPack] Could not chmod ${fullPath}:`, e.message);
                                }
                            }
                        }
                    } catch (e) {
                        console.warn(`[afterPack] Could not inspect directory ${subDir}:`, e.message);
                    }
                }
            }
        }
    },

    afterAllArtifactBuild: async (buildResult) => {
        if (process.platform === 'win32') {
            const { execSync } = require('child_process');
            const path = require('path');
            const fs = require('fs');
            const releaseDir = path.resolve(__dirname, 'release');
            const unpackedDir = path.join(releaseDir, 'linux-unpacked');
            if (fs.existsSync(unpackedDir)) {
                const pkg = require('./package.json');
                const tarName = `Amazon Future Engineer-Setup-${pkg.version}.tar.gz`;
                const tarPath = path.join(releaseDir, tarName);
                console.log(`[afterAllArtifactBuild] Packaging ${tarName} via native tar...`);
                try {
                    execSync(`tar -czf "${tarPath}" -C "${unpackedDir}" .`);
                    console.log(`[afterAllArtifactBuild] Successfully created ${tarPath}`);
                } catch (err) {
                    console.warn(`[afterAllArtifactBuild] tar packaging warning:`, err);
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
    compression: process.platform === 'win32' ? 'normal' : 'maximum',
    artifactName: '${productName}-Setup-${version}.${ext}',
};
