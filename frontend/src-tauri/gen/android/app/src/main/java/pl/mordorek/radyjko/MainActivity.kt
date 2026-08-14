package pl.mordorek.radyjko

import android.os.Bundle
import android.content.Intent
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    handleMediaSearchIntent(intent)
  }

  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleMediaSearchIntent(intent)
  }

  private fun handleMediaSearchIntent(intent: Intent?) {
    if (intent?.action != Intent.ACTION_MEDIA_PLAY_FROM_SEARCH) return
    RadyjkoAutoService.requestPlayFromSearch(this, null, intent.extras)
  }
}
