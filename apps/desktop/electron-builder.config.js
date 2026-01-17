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
    files: ['dist/**/*', 'package.json'],

    // Windows-specific configuration
    win: {
        target: [
            {
                target: 'nsis',
                arch: ['x64'],
            },
        ],
        icon: 'build/icon.ico', // You'll need to add this
    },

    // NSIS installer configuration (CRITICAL for silent install)
    nsis: {
        oneClick: false, // Allow custom install directory
        allowToChangeInstallationDirectory: false, // Fixed install path
        perMachine: true, // System-wide installation (NOT per-user)
        installerIcon: 'build/icon.ico',
        uninstallerIcon: 'build/icon.ico',
        installationDirectory: 'C:\\Program Files\\Offline Learning App',

        // Silent install support
        allowElevation: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,

        // CRITICAL: Enable silent install with /S flag
        // This allows: OfflineLearningApp-Setup.exe /S
        include: 'build/installer-script.nsh', // Custom NSIS script (optional)

        // Installer language
        language: '1033', // English

        // Uninstall support
        deleteAppDataOnUninstall: false, // Keep data in ProgramData
    },

    // Publish configuration (disabled for offline app)
    publish: null,

    // Auto-update (DISABLED - installer-only updates)
    autoUpdate: false,

    // Metadata
    compression: 'maximum',
    artifactName: '${productName}-Setup-${version}.${ext}',
};
