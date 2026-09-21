package com.hektoryv.drivetosleep;

import android.os.Bundle;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * The whole native side of the game.
 *
 * Three things the WebView will not do for itself, all of which have to happen
 * before the first frame:
 *
 *   1. **Keep the screen on.** The player holds one finger still for minutes
 *      at a time. Android reasonably concludes nobody is there and dims the
 *      display. FLAG_KEEP_SCREEN_ON needs no permission and is dropped the
 *      moment the activity stops, so it cannot leak into the rest of the
 *      phone's life.
 *   2. **Hide the system bars.** Portrait cockpit framing (ADR-0006) allocates
 *      every pixel of height; a navigation bar eats the bottom of the dash.
 *      BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE means a swipe from an edge still
 *      brings them back — the player is never trapped.
 *   3. **Re-hide them afterwards.** Any transient reveal leaves the bars up
 *      until something asks again, so onWindowFocusChanged asks again.
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // Draw behind the cutout and the bars rather than being letterboxed
        // away from them. Android 15 forces this anyway; doing it explicitly
        // means the layout is the same on every version we support.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemBars();
        }
    }

    private void hideSystemBars() {
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
}
