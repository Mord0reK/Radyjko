package pl.mordorek.radyjko

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class RadyjkoMediaActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        when (intent?.action) {
            ACTION_PLAY -> RadyjkoAutoService.requestResume(context)
            ACTION_PAUSE -> RadyjkoAutoService.requestPause()
            ACTION_NEXT -> RadyjkoAutoService.requestAdjacent(1)
            ACTION_PREVIOUS -> RadyjkoAutoService.requestAdjacent(-1)
        }
    }

    companion object {
        const val ACTION_PLAY = "pl.mordorek.radyjko.action.PLAY"
        const val ACTION_PAUSE = "pl.mordorek.radyjko.action.PAUSE"
        const val ACTION_NEXT = "pl.mordorek.radyjko.action.NEXT"
        const val ACTION_PREVIOUS = "pl.mordorek.radyjko.action.PREVIOUS"
    }
}
