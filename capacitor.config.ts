import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor (ADR-0001): the game is a web build running in a WebView, wrapped
 * as a real Android app.
 *
 * Everything here is about making the WebView stop behaving like a browser.
 * The rest of the native configuration — portrait lock, immersive mode, keep
 * awake, the black background behind the GL surface — lives in the Android
 * project itself, in `android/app/src/main/`, because it has to happen before
 * a single frame is drawn.
 */
const config: CapacitorConfig = {
  appId: 'com.hektoryv.drivetosleep',
  appName: 'Drive to Sleep',
  webDir: 'dist',

  // The cabin colour, so the gap before the first frame is the same black the
  // game opens on rather than the WebView's white.
  backgroundColor: '#08080a',

  android: {
    backgroundColor: '#08080a',
    // Android 15 forces edge-to-edge and then, by default, Capacitor inserts
    // margins for the system bars. We want the canvas under them: the bars are
    // hidden (immersive sticky) and the game is drawn edge to edge.
    adjustMarginsForEdgeToEdge: 'disable',
    // No remote content, ever (non-negotiable 8). Nothing should be able to
    // load over plain HTTP because nothing should be loading at all.
    allowMixedContent: false,
  },
};

export default config;
