package com.snapture_android

import android.Manifest
import android.content.ContentUris
import android.content.pm.PackageManager
import android.os.Build
import android.provider.MediaStore
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class LatestPhotoModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "LatestPhoto"

  @ReactMethod
  fun getLatest(promise: Promise) {
    val permission = if (Build.VERSION.SDK_INT >= 33) Manifest.permission.READ_MEDIA_IMAGES else Manifest.permission.READ_EXTERNAL_STORAGE
    val full = context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED
    val partial = Build.VERSION.SDK_INT >= 34 && context.checkSelfPermission(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED) == PackageManager.PERMISSION_GRANTED
    if (!full && !partial) { promise.resolve(null); return }
    try {
      val uri = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
      context.contentResolver.query(uri, arrayOf(MediaStore.Images.Media._ID), null, null,
        "${MediaStore.Images.Media.DATE_ADDED} DESC, ${MediaStore.Images.Media._ID} DESC")?.use { cursor ->
        if (cursor.moveToFirst()) {
          promise.resolve(ContentUris.withAppendedId(uri, cursor.getLong(0)).toString())
          return
        }
      }
      promise.resolve(null)
    } catch (_: SecurityException) { promise.resolve(null) }
      catch (_: Exception) { promise.resolve(null) }
  }
}
