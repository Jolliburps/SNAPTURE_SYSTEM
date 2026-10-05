from django.urls import path

from . import views

urlpatterns = [
    path("register/", views.register, name="register"),
    path("login/", views.login, name="login"),
    path("password-reset/request/", views.password_reset_request, name="password-reset-request"),
    path("password-reset/confirm/", views.password_reset_confirm, name="password-reset-confirm"),
    path("logout/", views.logout, name="logout"),
    path("me/", views.me, name="me"),
    path("me/photo/", views.profile_picture, name="profile-picture"),
    path("admin/overview/", views.admin_overview, name="admin-overview"),
    path("admin/predictions/<int:prediction_id>/", views.admin_prediction_detail, name="admin-prediction-detail"),
]
