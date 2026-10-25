"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.conf import settings
from django.urls import include, path, re_path
from predictions import scene_views
from predictions import photo_privacy
from cesd import views as cesd_views

urlpatterns = [
    path('', include('cesd.urls')),
    re_path(r'^media/(?P<path>(?:scenes|predictions)/.+)$', photo_privacy.protected_media),
    path('api/photo-privacy/preview/', photo_privacy.preview),
    path('api/scenes/', scene_views.scenes),
    path('api/scenes/capabilities/', scene_views.capabilities),
    path('api/scenes/<int:scene_id>/', scene_views.scene_detail),
    path('api/scenes/<int:scene_id>/items/', scene_views.add_region),
    path('api/scenes/<int:scene_id>/disposal-selection/', scene_views.disposal_selection),
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
    path('api/auth/', include('accounts.urls')),
    path('api/predictions/', include('predictions.urls')),
    path('api/projects/', include('predictions.project_urls')),
    path('api/datasets/', include('datasets.urls')),
    path('api/evaluations/', include('evaluations.urls')),
]

# Serve only allowed legacy images; CESD files must pass publication checks.
urlpatterns += [
    path('media/<path:filename>', cesd_views.legacy_media),
    path('protected-media/<path:filename>', cesd_views.legacy_media),
]

admin.site.site_header = 'SNAPTURE Administration'
admin.site.site_title = 'SNAPTURE Admin'
admin.site.index_title = 'Manage users, predictions, and dataset images'
admin.site.site_url = settings.ADMIN_WEB_URL
