import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.abdo.iptvstream',
    appName: 'IPTV Stream',
    webDir: 'dist',
    server: {
        androidScheme: 'https', // Ensures local content loads over https
        cleartext: true,        // Critical: allows http:// streams
        allowNavigation: ['*']  // Allow navigating to any external URL
    },
    plugins: {
        Keyboard: {
            resize: 'body',
            style: 'dark',
            resizeOnFullScreen: true,
        },
        SplashScreen: {
            launchShowDuration: 2000,
            backgroundColor: "#0f0f0f",
            showSpinner: true,
            spinnerColor: "#00ff9d"
        }
    }
};

export default config;
