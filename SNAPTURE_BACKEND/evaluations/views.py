import csv
import io

from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_GET

from core.auth import require_api_admin
from .models import EvaluationRun
from .scorecards import report


@require_api_admin
@require_GET
def runs(request):
    entries = EvaluationRun.objects.all()[:100]
    response = JsonResponse({"runs": [{"id": entry.id, "name": entry.name, "split": entry.split, "dataset_version": entry.dataset_version, "frozen": bool(entry.frozen_at)} for entry in entries]})
    response["Cache-Control"] = "no-store"
    return response


@require_api_admin
@require_GET
def scorecard(request, run_id):
    entry = EvaluationRun.objects.filter(pk=run_id).first()
    if entry is None:
        return JsonResponse({"detail": "Evaluation run not found."}, status=404)
    return scorecard_response(entry, request.GET.get("format"))


def scorecard_response(entry, output_format):
    result = report(entry)
    if output_format != "csv":
        response = JsonResponse(result)
    else:
        stream = io.StringIO()
        writer = csv.writer(stream)
        writer.writerow(["section", "metric", "numerator", "denominator", "proportion", "ci95_lower", "ci95_upper"])
        for section in ("identification", "segregation", "recommendations"):
            for metric, value in result[section].items():
                if isinstance(value, dict) and "denominator" in value:
                    writer.writerow([section, metric, value["numerator"], value["denominator"], value["value"], *(value["ci95"] or [None, None])])
        writer.writerow([])
        writer.writerow(["material", "support", "predicted_count", "precision", "recall", "f1"])
        for row in result["identification"]["per_material"]:
            writer.writerow([row[key] for key in ("label", "support", "predicted_count", "precision", "recall", "f1")])
        response = HttpResponse(stream.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="snapture-evaluation-{entry.id}.csv"'
    response["Cache-Control"] = "no-store"
    return response
