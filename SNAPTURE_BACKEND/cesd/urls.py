from django.urls import path
from cesd import views

urlpatterns = [
    path('api/cesd/csrf/', views.csrf),
    path('api/cesd/login/', views.login),
    path('api/cesd/logout/', views.logout),
    path('api/cesd/me/', views.me),
    path('api/cesd/password/request/', views.password_request),
    path('api/cesd/password/confirm/', views.password_confirm),
    path('api/cesd/staff/', views.staff),
    path('api/cesd/staff/<int:pk>/', views.staff),
    path('api/cesd/activity/', views.activity),
    path('api/cesd/metadata/', views.metadata),
    path('api/cesd/reports/', views.reports),
    path('api/cesd/dashboard/', views.dashboard),
    path('api/cesd/files/<str:resource>/<int:pk>/', views.file_view),
    path('api/cesd/<str:resource>/', views.records),
    path('api/cesd/<str:resource>/<int:pk>/', views.records),
    path('api/learning/', views.learning),
    path('api/collection/', views.collection),
    path('api/announcements/', views.announcements),
]
