import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { runPlatformCheck } from './pc.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper to run a command as child process
function execute(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        let isInterrupted = false;
        console.log(`[Runner] Executing: ${command} ${args.join(' ')}`);
        const proc = spawn(command, args, {
            cwd: options.cwd || rootDir,
            stdio: 'inherit',
            shell: true,
            env: {
                ...process.env,
                ...options.env
            }
        });

        proc.on('close', (code) => {
            if (code === 0 || code === 130 || isInterrupted) {
                resolve();
            } else {
                reject(new Error(`Command "${command} ${args.join(' ')}" exited with code ${code}`));
            }
        });

        proc.on('error', (err) => {
            reject(err);
        });

        // Forward signals
        const onSignal = () => {
            isInterrupted = true;
            if (!proc.killed) {
                proc.kill();
            }
        };
        process.on('SIGINT', onSignal);
        process.on('SIGTERM', onSignal);
    });
}

async function main() {
    const rawArgs = process.argv.slice(2);
    const commandName = rawArgs[0];
    const extraArgs = rawArgs.slice(1);

    if (!commandName) {
        console.error('[Runner] Error: No command specified.');
        console.error('Usage: node scripts/platform-runner.js <build | dev | build:installer | publish:installer> [--target=win|linux]');
        process.exit(1);
    }

    // Parse target override if any
    let target = process.env.TARGET_PLATFORM;
    for (const arg of extraArgs) {
        if (arg.startsWith('--target=')) {
            target = arg.split('=')[1].trim();
        }
    }

    // 1. Run Platform Check (PC)
    const pcResult = await runPlatformCheck({ target });
    if (!pcResult.success) {
        console.error('[Runner] Aborting because Platform Check (PC) failed.');
        process.exit(1);
    }

    const targetPlatform = pcResult.targetPlatform;
    const isWindows = targetPlatform === 'win32';
    const isLinux = targetPlatform === 'linux';
    const platformFlag = isWindows ? '--win' : '--linux';

    console.log(`[Runner] Starting task "${commandName}" for platform "${targetPlatform}" (${platformFlag})...\n`);

    switch (commandName) {
        case 'build': {
            // Build all workspace packages
            await execute('pnpm', ['-r', 'build']);
            console.log('\n[Runner] Build completed successfully for all workspace packages!');
            break;
        }

        case 'dev': {
            // Ensure preload is ready
            await execute('node', ['scripts/copy-preload.js']);

            // Build backend dependencies once if needed
            console.log('[Runner] Launching desktop and renderer dev servers...');
            const desktopDir = path.join(rootDir, 'apps/desktop');
            await execute('npx', [
                'concurrently',
                '--kill-others',
                '--success', 'first',
                '--prefix', '[{name}]',
                '--names', 'MAIN,UI',
                '--prefix-colors', 'blue,magenta',
                `"pnpm --filter desktop dev:main"`,
                `"pnpm --filter renderer dev"`
            ], { cwd: desktopDir });
            break;
        }

        case 'build:installer': {
            // 1. Full workspace build
            console.log('[Runner] Step 1/2: Compiling workspace packages and renderer frontend...');
            await execute('pnpm', ['-r', 'build']);

            // 2. Run electron-builder for the specific platform
            console.log(`\n[Runner] Step 2/2: Packaging ${targetPlatform} installer via electron-builder...`);
            const desktopDir = path.join(rootDir, 'apps/desktop');
            const forwardedArgs = extraArgs.filter(arg => !arg.startsWith('--target='));
            const builderArgs = [
                'cross-env',
                'CSC_IDENTITY_AUTO_DISCOVERY=false',
                'electron-builder',
                platformFlag,
                '--config',
                'electron-builder.config.cjs',
                '--publish',
                'never',
                ...forwardedArgs
            ];

            await execute('npx', builderArgs, { cwd: desktopDir });
            console.log(`\n[Runner] Installer build finished successfully for ${targetPlatform}! Output in apps/desktop/release/`);
            break;
        }

        case 'publish:installer': {
            // 1. Full workspace build
            console.log('[Runner] Step 1/2: Compiling workspace packages and renderer frontend...');
            await execute('pnpm', ['-r', 'build']);

            // 2. Run electron-builder with publish
            console.log(`\n[Runner] Step 2/2: Publishing ${targetPlatform} installer...`);
            const desktopDir = path.join(rootDir, 'apps/desktop');
            const forwardedArgs = extraArgs.filter(arg => !arg.startsWith('--target='));
            const builderArgs = [
                'cross-env',
                'CSC_IDENTITY_AUTO_DISCOVERY=false',
                'electron-builder',
                platformFlag,
                '--config',
                'electron-builder.config.cjs',
                '-p',
                'always',
                ...forwardedArgs
            ];

            await execute('npx', builderArgs, { cwd: desktopDir });
            console.log(`\n[Runner] Installer published successfully for ${targetPlatform}!`);
            break;
        }

        default: {
            console.error(`[Runner] Unknown command "${commandName}". Expected build, dev, build:installer, or publish:installer.`);
            process.exit(1);
        }
    }
}

main().catch(err => {
    console.error(`\n[Runner] Task failed:`, err.message);
    process.exit(1);
});
