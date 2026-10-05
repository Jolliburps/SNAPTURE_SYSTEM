from django.urls import path

from . import project_views

urlpatterns = [
    path("", project_views.projects, name="projects"),
    path("<int:project_id>/steps/<int:step_index>/", project_views.project_step, name="project-step"),
]
