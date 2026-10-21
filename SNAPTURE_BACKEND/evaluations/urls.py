from django.urls import path
from . import views

urlpatterns = [path("", views.runs), path("<int:run_id>/", views.scorecard)]
